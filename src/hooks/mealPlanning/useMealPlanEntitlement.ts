import {useEffect, useLayoutEffect, useRef, useSyncExternalStore} from 'react'

import {CurrentMealPlans} from '@data/models/MealPlan'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {
  getRemoteConfigActivation,
  isMealPlanningEnabled,
  subscribeToRemoteConfigActivation
} from '@service/remoteConfig/initRemoteConfig'
import {useSessionStore} from '@store/session/useSessionStore'

import {
  createMealPlanEntitlementSessionStore,
  deriveMealPlanCapabilitySignals,
  hasMealPlan,
  MealPlanCapabilityErrors,
  MealPlanCapabilityLatch,
  MealPlanEntitlement,
  planMealPlanEntitlementQueries,
  resolveMealPlanEntitlement
} from './useMealPlanEntitlement.util'

/** The half of a TanStack read this hook uses: the error it classifies, plus the data the plan read carries. */
export interface MealPlanEntitlementRead<TData> {
  data?: TData
  error: unknown
}

/** One instance's standing in the session: whether it drives the gated reads, and the verdict already reached. */
export interface MealPlanEntitlementParticipation {
  isLead: boolean
  capabilityLatch: MealPlanCapabilityLatch
}

/**
 * Every React, store and query access the hook makes, in one injectable object.
 *
 * It exists because the hook's wiring is worth pinning and no renderer or Testing Library is installed (AAP
 * 0.4.1 keeps it that way): with the accesses behind this seam the shell can be invoked in plain Jest with
 * fakes — no React dispatcher — and a test can assert what each read was actually called with. The pure
 * decisions the shell makes from these values live in `useMealPlanEntitlement.util.ts` and are tested there.
 */
export interface MealPlanEntitlementHooks {
  /** The Remote Config verdict, re-read whenever the single launch activation settles. */
  useFlagEnabled: () => boolean
  /** Registers this instance for the lead election and reads back the session's lead and latch. */
  useSessionParticipation: () => MealPlanEntitlementParticipation
  useSessionDayKey: () => string
  usePreferencesRead: (enabled: boolean) => MealPlanEntitlementRead<unknown>
  useCurrentPlanRead: (enabled: boolean, sessionDayKey: string) => MealPlanEntitlementRead<CurrentMealPlans>
  /** Takes no gate: `/meal-planning/targets*` is never gated (AAP 0.7.5), and the signature says so. */
  useTargetsRead: () => MealPlanEntitlementRead<unknown>
  /** Adds the signals the current errors carry to the session latch, after commit. */
  useRecordedCapabilitySignals: (errors: MealPlanCapabilityErrors) => void
}

const sessionStore = createMealPlanEntitlementSessionStore()

/**
 * Clears the retained capability verdict so the gated routes may be read again.
 *
 * Retention is what stops a known-unavailable route being re-probed on every mount, focus and reconnect, and
 * this release is its one counterweight: a `503 feature_disabled` seen before the launch activation settled (the
 * SDK serves a cached activated value straight away, so the gated reads can run and fail first) must not outlive
 * the activation that confirms the feature is on.
 *
 * A release is not a promise that a request follows. The recorder below re-asserts the latch from whatever
 * terminal error is still the current answer, so a release with a live `503` or route-missing 404 in hand
 * re-latches without issuing anything — a repeat probe of a route that just refused is exactly what the
 * retention rule forbids — and the gated reads resume only once that error is no longer the answer.
 *
 * Exported so the forward-recovery path has a name, which is also what lets a test start from a clean session.
 */
export const resetMealPlanCapabilityLatch = (): void => {
  sessionStore.resetCapabilityLatch()
}

let releasedActivationEpoch = getRemoteConfigActivation().epoch

// Guarded by the epoch rather than by the caller, because the latch is session-scoped: the activation that
// releases it must release it once however many instances observe the same broadcast.
const releaseCapabilityLatchForActivation = (epoch: number): void => {
  if (epoch === releasedActivationEpoch) {
    return
  }

  releasedActivationEpoch = epoch

  resetMealPlanCapabilityLatch()
}

// Handed out in first-render order, which is what makes the lead the longest-lived instance. React runs child
// effects before parent effects, so electing by effect order would make MealPlanTab's instance the lead and
// transfer the lead — and with it a refetch — every time the user leaves the Meal Plan segment. Render order
// puts Macros (the parent that stays mounted) first, so the lead does not churn when MealPlanTab unmounts or
// Add Food is pushed on top.
let nextInstanceId = 0

const useFlagEnabled = (): boolean => useSyncExternalStore(subscribeToRemoteConfigActivation, isMealPlanningEnabled)

const useSessionParticipation = (): MealPlanEntitlementParticipation => {
  const instanceIdRef = useRef<number | null>(null)

  if (instanceIdRef.current === null) {
    instanceIdRef.current = nextInstanceId
    nextInstanceId += 1
  }

  const instanceId = instanceIdRef.current
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot)
  const {epoch: activationEpoch} = useSyncExternalStore(subscribeToRemoteConfigActivation, getRemoteConfigActivation)

  // A layout effect rather than a passive one, so the election is settled before any passive effect — the
  // current-plan read's rollover effect included — runs against a session that has no lead yet. The consequence
  // to accept: the lead's own gated reads start one render pass after its mount, because the render that elects
  // it has already computed its `enabled` flags. Nothing user-visible depends on that pass — MealPlanTab mounts
  // its own preferences and current-plan observers from the same entitlement and is unaffected.
  useLayoutEffect(() => {
    sessionStore.registerInstance(instanceId)

    return () => sessionStore.releaseInstance(instanceId)
  }, [instanceId])

  // The activation release, run from a mounted effect rather than an import-time subscription, so loading this
  // module mutates nothing and the release happens only while a consumer is on screen to act on it. The epoch
  // guard makes it once-per-activation across every instance, and this effect is declared before the recorder's
  // in shell order, so a release is followed in the same commit by the recorder re-asserting the latch from any
  // terminal error that is still the current answer.
  useEffect(() => {
    releaseCapabilityLatchForActivation(activationEpoch)
  }, [activationEpoch])

  return {isLead: session.leadId === instanceId, capabilityLatch: session.capabilityLatch}
}

const useSessionDayKey = (): string => useSessionStore(state => state.sessionStartDateIso)

const useRecordedCapabilitySignals = (errors: MealPlanCapabilityErrors): void => {
  const {isFeatureDisabled, areRoutesMissing} = deriveMealPlanCapabilitySignals(errors)

  // Recorded after commit rather than during render because it publishes to a store every instance subscribes
  // to: a sibling whose gated reads are now disabled re-renders once, and the merge returns the same latch
  // reference when nothing changed, so a settled read that carries no signal notifies nobody.
  //
  // Deliberately on every commit, with no dependency array. The signals are a reading of the errors currently in
  // hand, not an event, and the latch they feed can be released underneath them by an activation: gating this on
  // a change in the signals themselves would mean a release with an unchanged, still-live `503` never re-records,
  // leaving the latch empty and the gated observers enabled against a route that has already refused. Re-reading
  // unconditionally is what makes that release self-correcting, and it is cheap — the merge is a two-boolean
  // compare that returns the same reference unless a signal is newly true, so an unchanged reading publishes
  // nothing and cannot re-enter this effect.
  useEffect(() => {
    sessionStore.recordCapabilitySignals({isFeatureDisabled, areRoutesMissing})
  })
}

/**
 * The production wiring, a module constant rather than an object built per render so the shell's hook identities
 * and call order are fixed for the life of the process.
 */
export const defaultMealPlanEntitlementHooks: MealPlanEntitlementHooks = {
  useFlagEnabled,
  useSessionParticipation,
  useSessionDayKey,
  usePreferencesRead: useMealPlanPreferencesQuery,
  useCurrentPlanRead: useCurrentMealPlanQuery,
  useTargetsRead: useNutritionTargetsQuery,
  useRecordedCapabilitySignals
}

/**
 * The meal-planning entitlement every gated surface reads: Macros for the segmented control, Add Food for the
 * Catalog section, the Meal Plan tab for its availability and its permission to issue gated requests.
 *
 * Invoking it more than once per visible tree is expected and cheap: the instances elect one lead, the lead
 * drives the two gated reads, and the rest read the same cache entries through disabled observers, which issue
 * no request and run no rollover effect. The verdict itself is decided in `@utility/MealPlanEntitlementUtility`.
 */
export const useMealPlanEntitlement = (
  hooks: MealPlanEntitlementHooks = defaultMealPlanEntitlementHooks
): MealPlanEntitlement => {
  const isFlagEnabled = hooks.useFlagEnabled()
  const {isLead, capabilityLatch} = hooks.useSessionParticipation()
  // The current-plan query owns no store of its own and ignores an undefined day key, so the session's key is
  // read here and handed in — dropping it silently stops the plan rollover refetch.
  const sessionDayKey = hooks.useSessionDayKey()

  const queryPlan = planMealPlanEntitlementQueries({isFlagEnabled, isLead, capabilityLatch, sessionDayKey})

  const {error: preferencesError} = hooks.usePreferencesRead(queryPlan.preferences.enabled)
  const {data: plans, error: currentPlanError} = hooks.useCurrentPlanRead(
    queryPlan.currentPlan.enabled,
    queryPlan.currentPlan.sessionDayKey
  )
  // No gate is passed because `queryPlan.targets.enabled` is `true` in every state: the targets route is ungated
  // server-side and Account, Progress and the Diary editor depend on this read under a rolled-back backend.
  const {error: targetsError} = hooks.useTargetsRead()

  hooks.useRecordedCapabilitySignals({preferencesError, currentPlanError, targetsError})

  return resolveMealPlanEntitlement({
    isFlagEnabled,
    preferencesError,
    currentPlanError,
    targetsError,
    hasPlan: hasMealPlan(plans),
    capabilityLatch
  })
}
