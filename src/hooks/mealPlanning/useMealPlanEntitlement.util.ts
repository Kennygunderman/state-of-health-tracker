/**
 * The hook tree's view of the meal-planning entitlement policy, which is *not* defined here, plus the pure
 * wiring the hook beside this file is assembled from.
 *
 * The policy lives in `@utility/MealPlanEntitlementUtility` because three trees consume it and none of them
 * owns it: `@service/remoteConfig/initRemoteConfig` reads the Remote Config flag inputs, the
 * `useMealPlanEntitlement` hook beside this file turns them plus the read errors into the entitlement, and
 * `screens/Macros/components/MealPlanTab/index.util.ts` reads the availability signals — and a low-level
 * service importing a hook-private util would reverse the dependency direction, which is what
 * `mobile-helper-functions` promotes to `src/utility/` instead.
 *
 * The re-exports below are the utility's own bindings, never wrappers: every value is the same reference and
 * every type the same declaration, so there is exactly one policy rather than two that can drift. No *policy*
 * rule may be added here — one implemented in this file would silently override the one under test in
 * `src/utility/__tests__/MealPlanEntitlementUtility.test.ts`. What does belong here, below the re-exports, is
 * the hook's own pure wiring: which reads the hook enables and the session store the hook's instances elect a
 * lead through. Those decide nothing about entitlement — they decide who issues the requests the entitlement
 * already permits — and they are covered by `__tests__/useMealPlanEntitlement.util.test.ts`, whose re-export
 * assertions enumerate exactly the names this file is allowed to add.
 */
import {CurrentMealPlans} from '@data/models/MealPlan'
import {
  MealPlanCapabilityLatch,
  MealPlanCapabilitySignals,
  mergeMealPlanCapabilityLatch,
  NO_MEAL_PLAN_CAPABILITY_LATCH
} from '@utility/MealPlanEntitlementUtility'

export {
  deriveMealPlanCapabilitySignals,
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  mergeMealPlanCapabilityLatch,
  NO_MEAL_PLAN_CAPABILITY_LATCH,
  PACKAGED_MEAL_PLANNING_ENABLED,
  resolveMealPlanEntitlement,
  resolveMealPlanningFlagEnabled,
  RoutesMissingError
} from '@utility/MealPlanEntitlementUtility'

export type {
  MealPlanAvailability,
  MealPlanCapabilityErrors,
  MealPlanCapabilityLatch,
  MealPlanCapabilitySignals,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanningFlagInputs,
  RemoteConfigFetchStatus,
  RemoteConfigValueSource
} from '@utility/MealPlanEntitlementUtility'

/** What every mounted instance of the hook reads from the session store. */
export interface MealPlanEntitlementSessionSnapshot {
  /** The registered instance elected to drive the gated reads, or `null` while none is mounted. */
  leadId: number | null
  capabilityLatch: MealPlanCapabilityLatch
}

/**
 * The session-scoped state shared by every mounted `useMealPlanEntitlement` instance: which one drives the
 * gated reads, and which capability signals have been seen. A `useSyncExternalStore`-shaped store rather than a
 * Zustand store because nothing outside this hook may read or write it — it is the hook's own bookkeeping, not
 * app state — and because the snapshot has to be identity-stable for React to stop re-rendering on it.
 */
export interface MealPlanEntitlementSessionStore {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => MealPlanEntitlementSessionSnapshot
  registerInstance: (id: number) => void
  releaseInstance: (id: number) => void
  recordCapabilitySignals: (signals: MealPlanCapabilitySignals) => void
  resetCapabilityLatch: () => void
}

/**
 * Builds one session store. A factory rather than a module singleton so the store is testable in isolation and
 * so this file stays pure — the hook module creates the single instance the app uses, and a test creates its
 * own.
 *
 * The lead is the *smallest* registered id, which makes the election deterministic and gives it the churn
 * profile the hook wants: see the hook for why the ids are handed out in render order.
 */
export const createMealPlanEntitlementSessionStore = (): MealPlanEntitlementSessionStore => {
  const listeners = new Set<() => void>()
  const registeredIds = new Set<number>()

  let snapshot: MealPlanEntitlementSessionSnapshot = {
    leadId: null,
    capabilityLatch: NO_MEAL_PLAN_CAPABILITY_LATCH
  }

  const electLeadId = (): number | null => {
    const ids = Array.from(registeredIds)

    return ids.length === 0 ? null : ids.reduce((lowest, id) => (id < lowest ? id : lowest), ids[0])
  }

  // The snapshot object is replaced only when a member actually changes, so `useSyncExternalStore` compares an
  // unchanged session by reference and re-renders nobody.
  const publish = (leadId: number | null, capabilityLatch: MealPlanCapabilityLatch): void => {
    if (leadId === snapshot.leadId && capabilityLatch === snapshot.capabilityLatch) {
      return
    }

    snapshot = {leadId, capabilityLatch}

    listeners.forEach(listener => listener())
  }

  return {
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: (): MealPlanEntitlementSessionSnapshot => snapshot,
    registerInstance: (id: number): void => {
      registeredIds.add(id)

      publish(electLeadId(), snapshot.capabilityLatch)
    },
    releaseInstance: (id: number): void => {
      registeredIds.delete(id)

      publish(electLeadId(), snapshot.capabilityLatch)
    },
    recordCapabilitySignals: (signals: MealPlanCapabilitySignals): void => {
      publish(snapshot.leadId, mergeMealPlanCapabilityLatch(snapshot.capabilityLatch, signals))
    },
    resetCapabilityLatch: (): void => {
      publish(snapshot.leadId, NO_MEAL_PLAN_CAPABILITY_LATCH)
    }
  }
}

export interface MealPlanEntitlementQueryPlanInputs {
  isFlagEnabled: boolean
  isLead: boolean
  capabilityLatch: MealPlanCapabilityLatch
  sessionDayKey: string
}

/** The arguments the hook hands to each of its three reads. */
export interface MealPlanEntitlementQueryPlan {
  preferences: {enabled: boolean}
  currentPlan: {enabled: boolean; sessionDayKey: string}
  targets: {enabled: boolean}
}

/**
 * Decides which of the hook's reads may run.
 *
 * Three conditions gate the two gated reads, and they are different kinds of thing: the Remote Config flag is
 * the feature's own switch, the latch is a terminal capability verdict already reached this session (AAP 0.2.5 —
 * a disabled or absent route answers a repeat probe identically), and the lead election is the deduplication of
 * AAP 0.7.2's one-observer-per-key intent, since three mounted instances of this hook must not each mount an
 * observer for the same key.
 *
 * `targets` is enabled unconditionally and is listed rather than omitted so that "the targets read is never
 * gated" is an asserted fact instead of an absence: `/meal-planning/targets*` is ungated server-side, and
 * Account, Progress and the Diary target editor keep reading it under a rolled-back backend so their local
 * fallback keeps working (AAP 0.7.5).
 */
export const planMealPlanEntitlementQueries = ({
  isFlagEnabled,
  isLead,
  capabilityLatch,
  sessionDayKey
}: MealPlanEntitlementQueryPlanInputs): MealPlanEntitlementQueryPlan => {
  const isLatchedUnavailable = capabilityLatch.isFeatureDisabled || capabilityLatch.areRoutesMissing
  const enabled = isFlagEnabled && isLead && !isLatchedUnavailable

  return {
    preferences: {enabled},
    currentPlan: {enabled, sessionDayKey},
    targets: {enabled: true}
  }
}

/**
 * A plan generated for tomorrow counts: it is visible the moment it exists, with the day strip on its first day
 * (AAP 0.7.4), so a session with only an `upcoming` plan has a plan and must not be sent back to the no-plan
 * state.
 */
export const hasMealPlan = (plans: CurrentMealPlans | undefined): boolean => Boolean(plans?.current ?? plans?.upcoming)
