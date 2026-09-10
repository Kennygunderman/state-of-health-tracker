import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'

const NOT_FOUND_STATUS = 404

export type MealPlanAvailability = 'enabled' | 'disabled' | 'unavailable'

export interface MealPlanEntitlementInputs {
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

export const httpStatusOf = (error: unknown): number | null => {
  const status = (error as {response?: {status?: unknown}} | null)?.response?.status

  return typeof status === 'number' ? status : null
}

export const isFeatureDisabledError = (error: unknown): boolean =>
  getApiErrorCode(error) === API_ERROR_CODES.featureDisabled

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
  const isUnavailable = isGatedRouteDisabled || areRoutesMissing

  return {
    availability: isUnavailable ? 'unavailable' : 'enabled',
    isSegmentedControlVisible: true,
    isCatalogVisible: !isUnavailable,
    isGatedRequestAllowed: true,
    hasPlan
  }
}
