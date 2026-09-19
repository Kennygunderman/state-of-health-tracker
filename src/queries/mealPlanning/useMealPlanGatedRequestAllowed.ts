import {useCallback, useSyncExternalStore} from 'react'

import {isMealPlanningEnabled, subscribeToRemoteConfigActivation} from '@service/remoteConfig/initRemoteConfig'
import {QueryClient, useQueryClient} from '@tanstack/react-query'
import {
  latchFromCapabilityRecord,
  MealPlanCapabilityLatch,
  MealPlanCapabilityRecord,
  resolveMealPlanEntitlement
} from '@utility/MealPlanEntitlementUtility'

import {queryKeys} from '../keys'

/**
 * Whether a gated meal-planning request may be issued at all, read by the reads themselves.
 *
 * It lives in this layer, beside those reads, because that is the only place the answer can be applied
 * completely. The screens that mount them already hold the same verdict from
 * `@hooks/mealPlanning/useMealPlanCapabilityGuard` and hand it to `/plans/current` — but the route-scoped
 * reads (a plan day, a grocery list, swap alternatives, a swap preview, a recipe, the affected meals) took no
 * gate, so each of them kept issuing its request on every mount and re-probing on every stale focus and
 * reconnect after the session had already been refused; one of those screens mounts no guard at all. A gate
 * each read derives for itself cannot be forgotten at a call site, and covers a screen restored onto by
 * navigation state with no tab beneath it to have learned the verdict (AAP 0.2.5, 0.7.5).
 *
 * The direction of the import is what decides where this file sits: `@hooks/mealPlanning/useMealPlanEntitlement`
 * is built ON these reads, so it reads the two subscriptions and the two cache readers below from here rather
 * than declaring its own — one implementation of each, and no edge from this layer back into the one above it.
 * The policy itself is neither implemented nor restated here: `resolveMealPlanEntitlement` in
 * `@utility/MealPlanEntitlementUtility` decides it, and this file only supplies the two inputs it needs and
 * takes the one member the reads are asking about.
 */

/**
 * The session's capability verdict, read out of the query cache entry
 * `@hooks/mealPlanning/useMealPlanEntitlement` writes it to.
 *
 * Both readers take the `QueryClient` as an argument rather than calling `useQueryClient`, so the mechanism is
 * exercisable in plain Jest with no renderer and the writer above can use the same two functions.
 * `latchFromCapabilityRecord` answers a shared constant for the absent record, which is what keeps the
 * `useSyncExternalStore` snapshot below referentially stable while no request has been refused.
 */
export const readMealPlanCapabilityRecord = (queryClient: QueryClient): MealPlanCapabilityRecord | undefined =>
  queryClient.getQueryData<MealPlanCapabilityRecord>(queryKeys.mealPlanCapability)

export const readMealPlanCapabilityLatch = (queryClient: QueryClient): MealPlanCapabilityLatch =>
  latchFromCapabilityRecord(readMealPlanCapabilityRecord(queryClient))

export const useMealPlanFlagEnabled = (): boolean =>
  useSyncExternalStore(subscribeToRemoteConfigActivation, isMealPlanningEnabled)

export const useMealPlanCapabilityLatch = (): MealPlanCapabilityLatch => {
  const queryClient = useQueryClient()
  // Memoised: `useSyncExternalStore` resubscribes whenever the subscribe function's identity changes, and a
  // fresh closure per render would tear down and re-add a cache listener on every commit.
  const subscribe = useCallback(
    (onStoreChange: () => void) => queryClient.getQueryCache().subscribe(onStoreChange),
    [queryClient]
  )
  const getLatch = useCallback(() => readMealPlanCapabilityLatch(queryClient), [queryClient])

  return useSyncExternalStore(subscribe, getLatch)
}

/**
 * The two accesses the gate is composed of, in one injectable object — the seam
 * `@hooks/mealPlanning/useMealPlanEntitlement` uses, for the same reason: no renderer or Testing Library is
 * installed (AAP 0.4.1), so the only way to pin the composition is to invoke it with fakes in plain Jest.
 */
export interface MealPlanGatedRequestHooks {
  /** The Remote Config verdict, re-read whenever the single launch activation settles. */
  useFlagEnabled: () => boolean
  /** The session's capability verdict, re-read whenever the query cache that holds it changes. */
  useCapabilityLatch: () => MealPlanCapabilityLatch
}

/**
 * The production wiring, a module constant rather than an object built per render so the hook identities and
 * call order are fixed for the life of the process.
 */
export const defaultMealPlanGatedRequestHooks: MealPlanGatedRequestHooks = {
  useFlagEnabled: useMealPlanFlagEnabled,
  useCapabilityLatch: useMealPlanCapabilityLatch
}

/**
 * The verdict a gated read gates itself on: `false` while the Remote Config flag is off, and `false` for the
 * rest of the session once a gated route has answered a confirmed `503 feature_disabled` or one of the three
 * resource-less GETs has answered a bare 404 (AAP 0.2.5's two unavailability signals).
 *
 * The latch is the whole of the capability input, and the three live read errors are deliberately absent: they
 * belong to the entitlement's own three reads, which a read in this layer does not observe. Nothing is lost
 * by it — the recorder in `@hooks/mealPlanning/useMealPlanEntitlement` writes every settled gated request's
 * signal into the latch, so the same refusal arrives here one commit later, and the subscription above is what
 * makes an already-open screen stop asking rather than waiting for its next remount. For that one commit this
 * gate is the more permissive of the two, which is the safe direction: the screen's own guard has the live
 * errors and is already leaving for the surface that explains the refusal.
 */
export const useMealPlanGatedRequestAllowed = (
  hooks: MealPlanGatedRequestHooks = defaultMealPlanGatedRequestHooks
): boolean => {
  const isFlagEnabled = hooks.useFlagEnabled()
  const capabilityLatch = hooks.useCapabilityLatch()

  return resolveMealPlanEntitlement({
    isFlagEnabled,
    preferencesError: null,
    currentPlanError: null,
    targetsError: null,
    hasPlan: false,
    capabilityLatch
  }).isGatedRequestAllowed
}
