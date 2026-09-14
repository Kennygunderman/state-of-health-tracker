import {getApiErrorCode, isFeatureDisabledError} from '@utility/ApiErrorUtility'

const NOT_FOUND_STATUS = 404

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
 */
export const isRoutesMissingError = (error: unknown): boolean =>
  httpStatusOf(error) === NOT_FOUND_STATUS && getApiErrorCode(error) === null

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
    availability: isGatedRouteDisabled || areRoutesMissing ? 'unavailable' : 'enabled',
    isSegmentedControlVisible: true,
    // Both unavailability signals hide Add Food's Catalog section. AAP 0.2.5 names them — (a) a gated route
    // answering `503 feature_disabled`, (b) a bare 404 from one of the resource-less GETs — and gives them one
    // shared effect, which lists "Add Food's Catalog section is hidden for the session" alongside the
    // segmented control's neutral card. It is true that `/catalog/*` is never gated by the server's
    // MEAL_PLANNING_ENABLED flag, so under signal (a) catalog search would still answer; the plan nonetheless
    // hides the section for either signal, and the plan is the frozen contract, so the two signals are treated
    // alike here rather than parted.
    isCatalogVisible: !(isGatedRouteDisabled || areRoutesMissing),
    isGatedRequestAllowed: true,
    hasPlan
  }
}
