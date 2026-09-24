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
 * the hook's own pure wiring: which reads the hook enables, and which of the app's request keys sit inside the
 * gating policy. Those decide nothing about entitlement — the first decides who issues the requests the
 * entitlement already permits, the second only says where a request sits so the utility's one rule can read its
 * failure — and they are covered by `__tests__/useMealPlanEntitlement.util.test.ts`, whose re-export assertions
 * enumerate exactly the names this file is allowed to add.
 *
 * Nothing in this file is mutable: no module state, no subscriptions, no snapshots. The session's capability
 * verdict is server-derived truth and lives in the query cache under `queryKeys.mealPlanCapability`, written and
 * read by the hook beside this file (`mobile-state-management`).
 */
import {CurrentMealPlans} from '@data/models/MealPlan'
import {mutationKeys, queryKeys} from '@queries/keys'
import {
  MealPlanCapabilityLatch,
  MealPlanRequestScope,
  NO_MEAL_PLAN_REQUEST_SCOPE
} from '@utility/MealPlanEntitlementUtility'

export {
  deriveMealPlanCapabilitySignals,
  deriveMealPlanCapabilitySignalsFromRequests,
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  latchFromCapabilityRecord,
  mergeMealPlanCapabilityLatch,
  nextMealPlanCapabilityRecord,
  NO_MEAL_PLAN_CAPABILITY_LATCH,
  NO_MEAL_PLAN_REQUEST_SCOPE,
  PACKAGED_MEAL_PLANNING_ENABLED,
  resolveMealPlanEntitlement,
  resolveMealPlanningFlagEnabled,
  RoutesMissingError
} from '@utility/MealPlanEntitlementUtility'

export type {
  MealPlanAvailability,
  MealPlanCapabilityErrors,
  MealPlanCapabilityLatch,
  MealPlanCapabilityRecord,
  MealPlanCapabilitySignals,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanningFlagInputs,
  MealPlanRequestScope,
  ObservedMealPlanRequest,
  RemoteConfigFetchStatus,
  RemoteConfigValueSource
} from '@utility/MealPlanEntitlementUtility'

/**
 * The gated query families: every read the server refuses with `503 feature_disabled` while
 * `MEAL_PLANNING_ENABLED` is off — `/meal-planning/*` except `/meal-planning/targets*`, plus `/recipes/*`
 * (AAP 0.3.1, 0.5.1). A confirmed refusal from any of them is signal (a) of AAP 0.2.5, which is why the nested
 * plan, swap, grocery and recipe reads are here and not only the entitlement's own two.
 *
 * Built from `queryKeys` rather than from re-typed strings: a renamed key must fail to compile here instead of
 * silently un-gating a route. `recipeVersion` is the one gated family with no collection key to read the root
 * from, so its root is taken from a key built with an empty id — only the first segment is ever compared.
 */
const ROOT_SEGMENT_PROBE = ''

const GATED_QUERY_ROOTS: ReadonlySet<string> = new Set<string>([
  queryKeys.mealPlanPreferences[0],
  queryKeys.mealPlanCurrent[0],
  queryKeys.mealPlanDayAll[0],
  queryKeys.swapAlternativesAll[0],
  queryKeys.swapPreviewAll[0],
  queryKeys.groceryListAll[0],
  queryKeys.affectedMealsAll[0],
  queryKeys.recipeVersion(ROOT_SEGMENT_PROBE)[0]
])

/**
 * The three resource-less GETs of AAP 0.2.5 signal (b): a feature-bearing backend answers them with 200 and
 * null members, so a 404 without a decodable code can only mean a backend rolled back to a build without the
 * routes (AAP 0.7.5). `nutritionTargets` is a probe and never gated — the rollback it detects takes the targets
 * route with it, while the server flag never does.
 */
const ROUTES_PROBE_QUERY_ROOTS: ReadonlySet<string> = new Set<string>([
  queryKeys.mealPlanPreferences[0],
  queryKeys.mealPlanCurrent[0],
  queryKeys.nutritionTargets[0]
])

/**
 * The gated writes: the setup saves and the four keyed actions, all of which the server refuses with
 * `503 feature_disabled` while the flag is off, so each of them is a producer of signal (a) too.
 *
 * `saveNutritionTargets` is deliberately absent, as its read is: `/meal-planning/targets*` is never gated, and
 * the Diary target editor writes through it while planning is off (AAP 0.3.1, 0.7.5).
 */
const GATED_MUTATION_ROOTS: ReadonlySet<string> = new Set<string>([
  mutationKeys.saveSetupStep[0],
  mutationKeys.savePreferences[0],
  mutationKeys.generatePlan[0],
  mutationKeys.regeneratePlan[0],
  mutationKeys.swapMeal[0],
  mutationKeys.toggleGroceryItem[0],
  mutationKeys.uncheckAllGroceries[0],
  mutationKeys.logPlannedMeal[0]
])

// Signal (b) is defined on the three resource-less GETs only (AAP 0.2.5), so the write classification is handed
// an empty probe set rather than relying on no mutation key ever sharing a read key's root.
const NO_ROUTES_PROBE_ROOTS: ReadonlySet<string> = new Set<string>()

const scopeForRoot = (
  root: unknown,
  gatedRoots: ReadonlySet<string>,
  probeRoots: ReadonlySet<string>
): MealPlanRequestScope => {
  if (typeof root !== 'string') {
    return NO_MEAL_PLAN_REQUEST_SCOPE
  }

  const isGated = gatedRoots.has(root)
  const isRoutesProbe = probeRoots.has(root)

  return isGated || isRoutesProbe ? {isGated, isRoutesProbe} : NO_MEAL_PLAN_REQUEST_SCOPE
}

/**
 * Where a query's key sits in the gating policy, classified by its first segment — the family root every key
 * factory in `@queries/keys` shares, so a plan day, a swap preview or a recipe is recognised whatever
 * identifiers follow.
 *
 * A root this release has never heard of is outside the policy in both directions, which is the safe default:
 * an unclassified read can neither latch the session nor hide the catalog, and the key-by-key test beside this
 * file is what makes a newly added meal-planning key fail until it is classified here.
 */
export const mealPlanRequestScopeForQueryKey = (queryKey: readonly unknown[]): MealPlanRequestScope =>
  scopeForRoot(queryKey[0], GATED_QUERY_ROOTS, ROUTES_PROBE_QUERY_ROOTS)

/**
 * The same classification for a mutation's key, which TanStack leaves optional — an unkeyed mutation is
 * unidentifiable and therefore outside the policy.
 *
 * No mutation is a routes probe: signal (b) is defined on the three resource-less GETs only (AAP 0.2.5), and a
 * write's 404 carries no such meaning.
 */
export const mealPlanRequestScopeForMutationKey = (mutationKey: readonly unknown[] | undefined): MealPlanRequestScope =>
  scopeForRoot(mutationKey?.[0], GATED_MUTATION_ROOTS, NO_ROUTES_PROBE_ROOTS)

export interface MealPlanEntitlementQueryPlanInputs {
  isFlagEnabled: boolean
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
 * Two conditions gate the two gated reads, and they are different kinds of thing: the Remote Config flag is the
 * feature's own switch, and the latch is a terminal capability verdict already reached this session (AAP 0.2.5 —
 * a disabled or absent route answers a repeat probe identically, so the point is not to issue that probe).
 *
 * There is deliberately no third condition electing one instance to drive the reads. TanStack dedupes by key,
 * `staleTime` is 60s app-wide (`src/queries/queryClient.ts`), and the current-plan rollover is an idempotent
 * invalidate, so however many instances of this hook are mounted they cost at most one deduplicated refetch —
 * whereas an election is mutable session state that has to live somewhere, and the only honest home for it was a
 * module global.
 *
 * `targets` is enabled unconditionally and is listed rather than omitted so that "the targets read is never
 * gated" is an asserted fact instead of an absence: `/meal-planning/targets*` is ungated server-side, and
 * Account, Progress and the Diary target editor keep reading it under a rolled-back backend so their local
 * fallback keeps working (AAP 0.7.5).
 */
export const planMealPlanEntitlementQueries = ({
  isFlagEnabled,
  capabilityLatch,
  sessionDayKey
}: MealPlanEntitlementQueryPlanInputs): MealPlanEntitlementQueryPlan => {
  const isLatchedUnavailable = capabilityLatch.isFeatureDisabled || capabilityLatch.areRoutesMissing
  const enabled = isFlagEnabled && !isLatchedUnavailable

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
