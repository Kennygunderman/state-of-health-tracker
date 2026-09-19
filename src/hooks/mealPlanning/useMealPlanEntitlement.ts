import {useEffect, useSyncExternalStore} from 'react'

import {CurrentMealPlans} from '@data/models/MealPlan'
import {queryKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {
  MealPlanGatedRequestHooks,
  readMealPlanCapabilityRecord,
  useMealPlanCapabilityLatch,
  useMealPlanFlagEnabled
} from '@queries/mealPlanning/useMealPlanGatedRequestAllowed'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {getRemoteConfigActivation, subscribeToRemoteConfigActivation} from '@service/remoteConfig/initRemoteConfig'
import {useSessionStore} from '@store/session/useSessionStore'
import {QueryClient, useQueryClient} from '@tanstack/react-query'

import {
  deriveMealPlanCapabilitySignalsFromRequests,
  hasMealPlan,
  latchFromCapabilityRecord,
  MealPlanCapabilityLatch,
  MealPlanCapabilitySignals,
  MealPlanEntitlement,
  mealPlanRequestScopeForMutationKey,
  mealPlanRequestScopeForQueryKey,
  nextMealPlanCapabilityRecord,
  ObservedMealPlanRequest,
  planMealPlanEntitlementQueries,
  resolveMealPlanEntitlement
} from './useMealPlanEntitlement.util'

export {readMealPlanCapabilityLatch} from '@queries/mealPlanning/useMealPlanGatedRequestAllowed'

/** The half of a TanStack read this hook uses: the error it classifies, plus the data the plan read carries. */
export interface MealPlanEntitlementRead<TData> {
  data?: TData
  error: unknown
}

/**
 * Every React, store and query access the hook makes, in one injectable object.
 *
 * It exists because the hook's wiring is worth pinning and no renderer or Testing Library is installed (AAP
 * 0.4.1 keeps it that way): with the accesses behind this seam the shell can be invoked in plain Jest with
 * fakes — no React dispatcher — and a test can assert what each read was actually called with. The pure
 * decisions the shell makes from these values live in `useMealPlanEntitlement.util.ts` and are tested there.
 */
export interface MealPlanEntitlementHooks extends MealPlanGatedRequestHooks {
  useSessionDayKey: () => string
  usePreferencesRead: (enabled: boolean) => MealPlanEntitlementRead<unknown>
  useCurrentPlanRead: (enabled: boolean, sessionDayKey: string) => MealPlanEntitlementRead<CurrentMealPlans>
  /** Takes no gate: `/meal-planning/targets*` is never gated (AAP 0.7.5), and the signature says so. */
  useTargetsRead: () => MealPlanEntitlementRead<unknown>
  /**
   * Adds the signals every settled gated request carries to the session verdict, after commit.
   *
   * Takes no arguments, and that is the contract rather than an omission: the recorder derives the verdict
   * from the request caches alone, so the verdict can never outlive the requests that justify it.
   */
  useRecordedCapabilitySignals: () => void
}

/**
 * The capability verdict lives in the query cache, under `queryKeys.mealPlanCapability`, and this module is its
 * only writer.
 *
 * It is server-derived truth — read out of the errors of the gated requests themselves — so the query cache is
 * where `mobile-state-management` puts it, beside the requests that produce it and inside the client that
 * `queryClient.clear()` empties on logout. Reading it belongs to
 * `@queries/mealPlanning/useMealPlanGatedRequestAllowed`, one layer down, because the gated reads are the other
 * consumer of the verdict: both cache readers and both subscriptions live there and are imported here, so there
 * is one implementation of each, and `readMealPlanCapabilityLatch` is re-exported above for this module's own
 * callers. All of them take the `QueryClient` as an argument rather than reading a hook-internal one, which is
 * what keeps the whole mechanism exercisable in plain Jest with no renderer (AAP 0.4.1).
 *
 * These defaults matter because the entry is written with `setQueryData` and observed through the cache rather
 * than through a `QueryObserver`: nothing marks it active, so it would otherwise inherit the app-wide 24-hour
 * `gcTime` in `src/queries/queryClient.ts` and be collected inside a still-running process. `Infinity` is what
 * makes "session-scoped" true for the whole process — the verdict is dropped by `queryClient.clear()` on logout
 * and by process death and by nothing else, where a collection would re-enable the gated reads and send out
 * exactly the probe AAP 0.2.5 says a latched client must not issue. The key is deliberately absent from
 * `PERSISTED_QUERY_KEYS`, which keeps `Infinity` off disk and makes a cold start probe the gated routes once
 * more, the forward-recovery path an operator re-enable needs (AAP 0.7.5).
 *
 * Applied before every write because defaults are consulted when a query is first built: setting them on the
 * one path that can create this entry is what guarantees they are in place by then, and repeating it is free.
 */
const CAPABILITY_RECORD_QUERY_DEFAULTS = {gcTime: Infinity} as const

/**
 * Reads the whole session for capability signals: every settled query and every settled mutation in the two
 * caches.
 *
 * Scanning the caches is what makes *every* gated request a producer of the verdict rather than only the
 * entitlement's own reads (AAP 0.2.5 — "the explicit capability code a mounted backend returns from any gated
 * route"). A setup step or full-preferences save, a plan-day, grocery, alternatives, preview, affected-meals or
 * recipe read, and each of the four keyed writes can all answer a confirmed `503 feature_disabled`; before this
 * scan existed the verdict never learned about any of them, so the Meal Plan segment kept claiming the feature
 * was live and further gated probes kept going out.
 *
 * THE CACHES ARE THE WHOLE INPUT, and nothing is appended from the shell's own render. That is what keeps the
 * verdict from outliving the evidence for it: `queryClient.clear()` on logout empties both caches, so a scan
 * taken after it finds nothing and writes nothing, and the next account cannot inherit the previous one's
 * terminal verdict. Appending the shell's three live errors — which survive in a render for as long as the
 * observers hold their last result, i.e. past the clear — was exactly the path by which a cleared verdict came
 * back. Nothing is lost by dropping them: while this hook is mounted it *is* an observer of those three
 * queries, so their errors are in the cache by construction, and the immediate, pre-effect reading the UI needs
 * is served by `resolveMealPlanEntitlement`, which merges the live errors with the latch on the read path.
 *
 * Which requests may produce which signal is not decided here — the classification is
 * `mealPlanRequestScopeFor*Key`, and the rule reading it is `deriveMealPlanCapabilitySignalsFromRequests`.
 */
export const observeMealPlanCapabilitySignals = (queryClient: QueryClient): MealPlanCapabilitySignals => {
  const observed: ObservedMealPlanRequest[] = queryClient
    .getQueryCache()
    .getAll()
    .map(query => ({...mealPlanRequestScopeForQueryKey(query.queryKey), error: query.state.error}))

  queryClient
    .getMutationCache()
    .getAll()
    .forEach(mutation => {
      observed.push({
        ...mealPlanRequestScopeForMutationKey(mutation.options.mutationKey),
        error: mutation.state.error
      })
    })

  return deriveMealPlanCapabilitySignalsFromRequests(observed)
}

/**
 * Whether a cache event can have introduced a request failure, and is therefore worth re-scanning for.
 *
 * Only `added` and `updated` can: a request appears, or its state moves — and a failure is one such move.
 * `removed` is excluded because it is the event of evidence going away, and a scan triggered by evidence going
 * away is precisely the wrong moment to re-decide anything. It is also the only event `queryClient.clear()`
 * emits, for every entry it drops, so excluding it is what stops the logout clear from re-creating the verdict
 * it has just discarded. The observer events carry no state change at all.
 *
 * `observerAdded` is deliberately absent: a mount re-scans anyway, because attaching runs the full scan.
 */
const RECORDABLE_EVENT_TYPES: ReadonlySet<string> = new Set<string>(['added', 'updated'])

const isRecordableCacheEvent = (event: {type: string}): boolean => RECORDABLE_EVENT_TYPES.has(event.type)

// The recorder's own writes land in the cache it subscribes to. Reference equality already stops the write
// from repeating, but skipping the verdict's own key removes the re-entrancy rather than surviving it.
const isCapabilityRecordEvent = (event: {type: string; query?: {queryKey: readonly unknown[]}}): boolean =>
  event.query?.queryKey[0] === queryKeys.mealPlanCapability[0]

/**
 * Writes the reading into the session's verdict and answers with the latch that now holds.
 *
 * The write happens only when `nextMealPlanCapabilityRecord` returns a different record. That guard is
 * mandatory, not an optimisation: `setQueryData` emits a query-cache event, and the recorder below subscribes to
 * that very cache, so an unconditional write would notify itself forever. It is also what keeps an unchanged
 * reading from re-rendering every consumer, since the latch is published through `useSyncExternalStore`.
 *
 * `activationEpoch` carries the release of AAP 0.7.5: a verdict recorded under an earlier activation is dropped
 * by the first reading taken under a new one, and the signals in hand re-latch it immediately when the terminal
 * error is still the answer.
 */
export const recordMealPlanCapability = (
  queryClient: QueryClient,
  activationEpoch: number,
  signals: MealPlanCapabilitySignals
): MealPlanCapabilityLatch => {
  const record = readMealPlanCapabilityRecord(queryClient)
  const next = nextMealPlanCapabilityRecord(record, activationEpoch, signals)

  if (next === record) {
    return latchFromCapabilityRecord(record)
  }

  queryClient.setQueryDefaults(queryKeys.mealPlanCapability, CAPABILITY_RECORD_QUERY_DEFAULTS)
  queryClient.setQueryData(queryKeys.mealPlanCapability, next)

  return latchFromCapabilityRecord(next)
}

const useSessionDayKey = (): string => useSessionStore(state => state.sessionStartDateIso)

const useRecordedCapabilitySignals = (): void => {
  const queryClient = useQueryClient()
  const {epoch: activationEpoch} = useSyncExternalStore(subscribeToRemoteConfigActivation, getRemoteConfigActivation)

  // Deliberately on every commit, with no dependency array. The reading is the state of both caches rather than
  // an event, and the verdict it feeds can be released underneath it by an activation: gating this on a change
  // in the requests themselves would mean a release with an unchanged, still-cached `503` never re-records,
  // leaving the verdict empty and the gated observers enabled against a route that has already refused.
  // Re-reading unconditionally is what makes that release self-correcting, and it is cheap — the reducer returns
  // the same record unless a signal is newly true, so an unchanged reading writes nothing and cannot re-enter
  // this effect.
  //
  // The same effect owns the cache listeners, because a request that settles outside a commit of ours — a
  // nested screen's gated read, a setup save, a keyed write — is exactly the producer this recorder was widened
  // to include. Re-attaching on every commit is harmless: attaching re-runs the full scan, so an event that
  // arrives between this commit's cleanup and its re-subscribe is read anyway.
  useEffect(() => {
    const record = (): void => {
      recordMealPlanCapability(queryClient, activationEpoch, observeMealPlanCapabilitySignals(queryClient))
    }

    record()

    const unsubscribeFromQueries = queryClient.getQueryCache().subscribe(event => {
      if (isRecordableCacheEvent(event) && !isCapabilityRecordEvent(event)) {
        record()
      }
    })
    const unsubscribeFromMutations = queryClient.getMutationCache().subscribe(event => {
      if (isRecordableCacheEvent(event)) {
        record()
      }
    })

    return () => {
      unsubscribeFromQueries()
      unsubscribeFromMutations()
    }
  })
}

/**
 * The production wiring, a module constant rather than an object built per render so the shell's hook identities
 * and call order are fixed for the life of the process.
 */
export const defaultMealPlanEntitlementHooks: MealPlanEntitlementHooks = {
  useFlagEnabled: useMealPlanFlagEnabled,
  useCapabilityLatch: useMealPlanCapabilityLatch,
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
 * Invoking it more than once per visible tree is expected and cheap: the instances mount observers for the same
 * two keys, which TanStack dedupes against the 60s `staleTime` in `src/queries/queryClient.ts`, and they read
 * one shared capability verdict out of the query cache. The verdict itself is decided in
 * `@utility/MealPlanEntitlementUtility`.
 */
export const useMealPlanEntitlement = (
  hooks: MealPlanEntitlementHooks = defaultMealPlanEntitlementHooks
): MealPlanEntitlement => {
  const isFlagEnabled = hooks.useFlagEnabled()
  const capabilityLatch = hooks.useCapabilityLatch()
  // The current-plan query owns no store of its own and ignores an undefined day key, so the session's key is
  // read here and handed in — dropping it silently stops the plan rollover refetch.
  const sessionDayKey = hooks.useSessionDayKey()

  const queryPlan = planMealPlanEntitlementQueries({isFlagEnabled, capabilityLatch, sessionDayKey})

  const {error: preferencesError} = hooks.usePreferencesRead(queryPlan.preferences.enabled)
  const {data: plans, error: currentPlanError} = hooks.useCurrentPlanRead(
    queryPlan.currentPlan.enabled,
    queryPlan.currentPlan.sessionDayKey
  )
  // No gate is passed because `queryPlan.targets.enabled` is `true` in every state: the targets route is ungated
  // server-side and Account, Progress and the Diary editor depend on this read under a rolled-back backend.
  const {error: targetsError} = hooks.useTargetsRead()

  // Takes nothing: the recorder reads the request caches, which is where these three errors already live while
  // this hook observes them, and where they stop living the moment logout clears the client.
  hooks.useRecordedCapabilitySignals()

  return resolveMealPlanEntitlement({
    isFlagEnabled,
    preferencesError,
    currentPlanError,
    targetsError,
    hasPlan: hasMealPlan(plans),
    capabilityLatch
  })
}
