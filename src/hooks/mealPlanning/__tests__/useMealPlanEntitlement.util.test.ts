import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  resolveMealPlanEntitlement
} from '../useMealPlanEntitlement.util'

const makeApiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

describe('resolveMealPlanEntitlement', () => {
  const baseInputs: MealPlanEntitlementInputs = {
    isFlagEnabled: true,
    preferencesError: undefined,
    currentPlanError: undefined,
    targetsError: undefined,
    hasPlan: false
  }

  const featureDisabledError = makeApiError(503, API_ERROR_CODES.featureDisabled)
  const bareNotFoundError = makeApiError(404)

  describe('the Remote Config flag', () => {
    it('is disabled when the packaged default or an explicit false flag is in force', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, isFlagEnabled: false})

      expect(entitlement.availability).toBe('disabled')
    })

    it('stays disabled when the flag is off and a gated route also reports feature_disabled', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        isFlagEnabled: false,
        preferencesError: featureDisabledError
      })

      expect(entitlement.availability).toBe('disabled')
    })

    it('is enabled when the flag is on and no query reported an error', () => {
      expect(resolveMealPlanEntitlement(baseInputs).availability).toBe('enabled')
    })
  })

  describe('signal (a) - a gated route reports feature_disabled', () => {
    it('is unavailable when the preferences query reports feature_disabled', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: featureDisabledError})

      expect(entitlement.availability).toBe('unavailable')
    })

    it('is unavailable when the current-plan query reports feature_disabled', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, currentPlanError: featureDisabledError})

      expect(entitlement.availability).toBe('unavailable')
    })

    // The targets routes are never gated: Account, Progress and the Diary editor use them while planning is off.
    it('stays enabled when only the ungated targets route reports feature_disabled', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, targetsError: featureDisabledError})

      expect(entitlement.availability).toBe('enabled')
    })
  })

  describe('signal (b) - a resource-less GET answers with a bare 404', () => {
    it('is unavailable when the preferences query answers with a bare 404', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: bareNotFoundError})

      expect(entitlement.availability).toBe('unavailable')
    })

    it('is unavailable when the current-plan query answers with a bare 404', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, currentPlanError: bareNotFoundError})

      expect(entitlement.availability).toBe('unavailable')
    })

    it('is unavailable when the targets query answers with a bare 404, unlike the feature_disabled signal', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, targetsError: bareNotFoundError})

      expect(entitlement.availability).toBe('unavailable')
    })
  })

  describe('the resource-route exclusion', () => {
    it('stays enabled when a 404 carries a decodable code such as plan_not_active', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        currentPlanError: makeApiError(404, API_ERROR_CODES.planNotActive)
      })

      expect(entitlement.availability).toBe('enabled')
    })

    it('stays enabled when the preferences query answers 404 with a decodable code', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        preferencesError: makeApiError(404, API_ERROR_CODES.stalePlan)
      })

      expect(entitlement.availability).toBe('enabled')
    })
  })

  describe('derived flags', () => {
    it('keeps the segmented control, the catalog and gated requests when enabled', () => {
      const expected: MealPlanEntitlement = {
        availability: 'enabled',
        isSegmentedControlVisible: true,
        isCatalogVisible: true,
        isGatedRequestAllowed: true,
        hasPlan: false
      }

      expect(resolveMealPlanEntitlement(baseInputs)).toEqual(expected)
    })

    it('hides the segmented control, the catalog and gated requests when disabled', () => {
      const expected: MealPlanEntitlement = {
        availability: 'disabled',
        isSegmentedControlVisible: false,
        isCatalogVisible: false,
        isGatedRequestAllowed: false,
        hasPlan: false
      }

      expect(resolveMealPlanEntitlement({...baseInputs, isFlagEnabled: false})).toEqual(expected)
    })

    it('keeps the segmented control but hides the catalog when unavailable', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: featureDisabledError})
      const expected: MealPlanEntitlement = {
        availability: 'unavailable',
        isSegmentedControlVisible: true,
        isCatalogVisible: false,
        isGatedRequestAllowed: true,
        hasPlan: false
      }

      expect(entitlement).toEqual(expected)
    })

    it('passes hasPlan through unchanged in every availability state', () => {
      const withPlan: MealPlanEntitlementInputs = {...baseInputs, hasPlan: true}

      expect(resolveMealPlanEntitlement(withPlan).hasPlan).toBe(true)
      expect(resolveMealPlanEntitlement({...withPlan, isFlagEnabled: false}).hasPlan).toBe(true)
      expect(resolveMealPlanEntitlement({...withPlan, preferencesError: bareNotFoundError}).hasPlan).toBe(true)
      expect(resolveMealPlanEntitlement(baseInputs).hasPlan).toBe(false)
    })
  })
})

describe('httpStatusOf', () => {
  it('returns null for null and undefined', () => {
    expect(httpStatusOf(null)).toBeNull()
    expect(httpStatusOf(undefined)).toBeNull()
  })

  it('returns null for an error carrying no response', () => {
    expect(httpStatusOf({})).toBeNull()
  })

  it('returns null for a response carrying no status', () => {
    expect(httpStatusOf({response: {}})).toBeNull()
  })

  it('returns null when the status is not a number', () => {
    expect(httpStatusOf({response: {status: '404'}})).toBeNull()
  })

  it('returns the numeric status of an axios-shaped error', () => {
    expect(httpStatusOf(makeApiError(404))).toBe(404)
    expect(httpStatusOf(makeApiError(503, API_ERROR_CODES.featureDisabled))).toBe(503)
  })
})

describe('isFeatureDisabledError', () => {
  it('returns true for a response carrying feature_disabled', () => {
    expect(isFeatureDisabledError(makeApiError(503, API_ERROR_CODES.featureDisabled))).toBe(true)
  })

  it('returns false for a bare 404', () => {
    expect(isFeatureDisabledError(makeApiError(404))).toBe(false)
  })

  it('returns false for a 404 carrying a decodable code', () => {
    expect(isFeatureDisabledError(makeApiError(404, API_ERROR_CODES.planNotActive))).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isFeatureDisabledError(null)).toBe(false)
    expect(isFeatureDisabledError(undefined)).toBe(false)
  })
})

describe('isRoutesMissingError', () => {
  it('returns true for a bare 404', () => {
    expect(isRoutesMissingError(makeApiError(404))).toBe(true)
  })

  it('returns false for a 404 carrying a decodable code', () => {
    expect(isRoutesMissingError(makeApiError(404, API_ERROR_CODES.planNotActive))).toBe(false)
  })

  it('returns false for a response carrying feature_disabled', () => {
    expect(isRoutesMissingError(makeApiError(503, API_ERROR_CODES.featureDisabled))).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isRoutesMissingError(null)).toBe(false)
    expect(isRoutesMissingError(undefined)).toBe(false)
  })
})
