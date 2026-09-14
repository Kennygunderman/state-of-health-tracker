/**
 * The hook tree's view of the meal-planning entitlement policy, which is *not* defined here.
 *
 * The policy lives in `@utility/MealPlanEntitlementUtility` because three trees consume it and none of them
 * owns it: `@service/remoteConfig/initRemoteConfig` reads the Remote Config flag inputs, the
 * `useMealPlanEntitlement` hook beside this file turns them plus the read errors into the entitlement, and
 * `screens/Macros/components/MealPlanTab/index.util.ts` reads the availability signals — and a low-level
 * service importing a hook-private util would reverse the dependency direction, which is what
 * `mobile-helper-functions` promotes to `src/utility/` instead.
 *
 * This module exists only so the consumers that already import this path keep compiling, and it re-exports the
 * utility's own bindings, never wrappers: every value below is the same reference and every type the same
 * declaration, so there is exactly one policy rather than two that can drift. Add nothing else here — a rule
 * implemented in this file would silently override the one under test in
 * `src/utility/__tests__/MealPlanEntitlementUtility.test.ts`.
 */
export {
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  PACKAGED_MEAL_PLANNING_ENABLED,
  resolveMealPlanEntitlement,
  resolveMealPlanningFlagEnabled,
  RoutesMissingError
} from '@utility/MealPlanEntitlementUtility'

export type {
  MealPlanAvailability,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanningFlagInputs,
  RemoteConfigFetchStatus,
  RemoteConfigValueSource
} from '@utility/MealPlanEntitlementUtility'
