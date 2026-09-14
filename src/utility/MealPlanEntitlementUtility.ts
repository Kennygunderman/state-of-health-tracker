import {getApiErrorCode, isFeatureDisabledError} from '@utility/ApiErrorUtility'

const NOT_FOUND_STATUS = 404

/**
 * The one place the meal-planning entitlement policy is decided.
 *
 * It lives in `src/utility/` rather than beside the hook that reads it because three trees depend on it and
 * none of them owns it: `@service/remoteConfig/initRemoteConfig` reads the flag inputs, the
 * `@hooks/mealPlanning/useMealPlanEntitlement` pair turns them plus the read errors into the entitlement, and
 * the Macros plan-body resolver reads the availability signals. A helper shared across trees belongs here with
 * its tests, and a low-level service importing a hook-private util would reverse the dependency direction.
 * `@hooks/mealPlanning/useMealPlanEntitlement.util` re-exports this module unchanged, so consumers reading
 * either path get one policy rather than two that can drift.
 */

/**
 * The `meal_planning_enabled` value shipped in `setDefaults`. It is `false` so an install that has never
 * activated a console value hides the feature instead of showing it unseeded.
 */
export const PACKAGED_MEAL_PLANNING_ENABLED = false

export type MealPlanAvailability = 'enabled' | 'disabled' | 'unavailable'

/** Mirrors `remoteConfig().lastFetchStatus`. */
export type RemoteConfigFetchStatus = 'success' | 'failure' | 'no_fetch_yet' | 'throttled'

/** Mirrors `remoteConfig().getValue(key).getSource()`: `'remote'` only once a console value was activated. */
export type RemoteConfigValueSource = 'static' | 'default' | 'remote'

export interface MealPlanningFlagInputs {
  lastFetchStatus: RemoteConfigFetchStatus
  valueSource: RemoteConfigValueSource
  value: boolean
}

export interface MealPlanEntitlementInputs {
  /**
   * Must come from `resolveMealPlanningFlagEnabled`: a bare `getValue(…).asBoolean()` read cannot separate a
   * never-activated default from an activated console value, so it cannot fail closed.
   */
  isFlagEnabled: boolean
  preferencesError: unknown
  currentPlanError: unknown
  targetsError: unknown
  hasPlan: boolean
}

export interface MealPlanEntitlement {
  availability: MealPlanAvailability
  isSegmentedControlVisible: boolean
  isCatalogVisible: boolean
  isGatedRequestAllowed: boolean
  hasPlan: boolean
}

/**
 * Fail-closed across the four Remote Config states a single boolean cannot separate. Only a value the SDK has
 * activated from the console (`valueSource === 'remote'`) may enable the feature, so a never-fetched or
 * offline install stays at the packaged `false`. `lastFetchStatus` names which state this is and deliberately
 * does not change the outcome — that invariance is the retention rule: the SDK caches an activated value
 * across launches, so a failed or throttled fetch keeps returning the last activated value, including `true`.
 */
export const resolveMealPlanningFlagEnabled = (flag: MealPlanningFlagInputs): boolean =>
  flag.valueSource === 'remote' ? flag.value : PACKAGED_MEAL_PLANNING_ENABLED

export const httpStatusOf = (error: unknown): number | null => {
  const status = (error as {response?: {status?: unknown}} | null)?.response?.status

  return typeof status === 'number' ? status : null
}

/**
 * The marker `isRoutesMissingError` actually tests for, rather than `instanceof`. The error is thrown inside a
 * request function, travels out through TanStack Query's error channel and is read by a pure predicate, and
 * `instanceof` across that path depends on how the class was downlevelled — so the check is a structural own
 * property, which no transform can take away. The class below remains the typed carrier and its prototype
 * chain is repaired, so `instanceof` also works for anyone who prefers it.
 */
const ROUTES_MISSING_MARKER = 'meal_planning_routes_missing'

/**
 * The typed answer of a resource-less meal-planning GET whose route is not mounted: a bare 404, meaning the
 * backend was rolled back to a build without the feature.
 *
 * It exists because that answer has two jobs at once and one of them cannot survive being turned into data.
 * The reads it comes from degrade their own surface to a local value — the targets read is the example: a
 * rolled-back backend must leave Account, Progress and the Diary editor showing the local target rather than
 * an error (AAP 0.7.5) — while the same answer is the entitlement's capability signal, which the Meal Plan
 * segment turns into its unavailable card. A request function that resolved the 404 to `null` would satisfy
 * the first job and erase the second, because "the server holds no targets" is already a successful response
 * (`TargetsResponse.targets === null`) and the two would then be indistinguishable. Throwing this instead keeps
 * both: the entitlement reads the error, and target consumers select the local fallback from the absence of
 * data (`@queries/mealPlanning/useNutritionTargetsQuery.util`).
 */
export class RoutesMissingError extends Error {
  /** The structural discriminant `isRoutesMissingError` reads. */
  readonly routesMissing: typeof ROUTES_MISSING_MARKER = ROUTES_MISSING_MARKER

  /** The 404 this stands for, so a reader of the error object alone still sees the status it came from. */
  readonly status: number = NOT_FOUND_STATUS

  constructor(readonly path: string) {
    super(`Meal-planning route is not mounted: ${path}`)

    this.name = 'RoutesMissingError'
    // Restores the prototype chain a downlevelled `extends Error` loses, so `instanceof RoutesMissingError`
    // holds for callers that use it even though the predicate does not depend on it.
    Object.setPrototypeOf(this, RoutesMissingError.prototype)
  }
}

// Re-exported rather than re-implemented: the predicate belongs with the rest of the error classification in
// @utility/ApiErrorUtility, where the keyed writes read it too, and this module's consumers keep reading it
// from the entitlement surface they already depend on.
export {isFeatureDisabledError}

/**
 * Meaningful only for the resource-less GETs — `/meal-planning/preferences`, `/meal-planning/plans/current`
 * and `/meal-planning/targets` — which a feature-bearing backend answers with 200 and null members, so a
 * bare 404 there can only mean the routes are not mounted. A 404 from a resource route
 * (`/plans/:planId/…`, `/recipes/:id`, `/macros/entry/:id`) is the server's combined not-found/not-yours
 * answer and must never be read as unavailability.
 *
 * Both forms of the same answer are accepted: the axios-shaped rejection a request function re-throws
 * untouched, and the `RoutesMissingError` a request function throws when it has already classified the 404
 * itself in order to degrade its own surface.
 */
export const isRoutesMissingError = (error: unknown): boolean => {
  if ((error as {routesMissing?: unknown} | null)?.routesMissing === ROUTES_MISSING_MARKER) {
    return true
  }

  return httpStatusOf(error) === NOT_FOUND_STATUS && getApiErrorCode(error) === null
}

export const resolveMealPlanEntitlement = ({
  isFlagEnabled,
  preferencesError,
  currentPlanError,
  targetsError,
  hasPlan
}: MealPlanEntitlementInputs): MealPlanEntitlement => {
  if (!isFlagEnabled) {
    return {
      availability: 'disabled',
      isSegmentedControlVisible: false,
      isCatalogVisible: false,
      isGatedRequestAllowed: false,
      hasPlan
    }
  }

  const isGatedRouteDisabled = isFeatureDisabledError(preferencesError) || isFeatureDisabledError(currentPlanError)
  const areRoutesMissing =
    isRoutesMissingError(preferencesError) ||
    isRoutesMissingError(currentPlanError) ||
    isRoutesMissingError(targetsError)

  return {
    // Either unavailability signal of AAP 0.2.5 — (a) a gated route answering `503 feature_disabled`, (b) a
    // bare 404 from one of the resource-less GETs — puts the Meal Plan segment on its neutral unavailable
    // card, while the segmented control itself stays.
    availability: isGatedRouteDisabled || areRoutesMissing ? 'unavailable' : 'enabled',
    isSegmentedControlVisible: true,
    // Add Food's Catalog section follows route absence alone, not the segment's verdict, because the two
    // signals mean different things for `/catalog/*`. Under signal (a) the backend is mounted and
    // `/catalog/*` is never gated by `MEAL_PLANNING_ENABLED` (AAP 0.3.1, 0.5.1), so catalog search still
    // answers and the section must stay — the operator scenario in AAP 0.9.4 states exactly that outcome
    // ("the Meal Plan body shows the unavailable card, Add Food keeps the Catalog section"). Under signal (b)
    // the backend has no `/catalog/*` either, so the section goes with the rest of the feature. Hiding it for
    // signal (a) as well would read AAP 0.2.5's shared-effect sentence over the operator scenario that
    // demonstrates the opposite, and would take away a working surface.
    isCatalogVisible: !areRoutesMissing,
    isGatedRequestAllowed: true,
    hasPlan
  }
}
