import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanningFlagInputs,
  PACKAGED_MEAL_PLANNING_ENABLED,
  RemoteConfigFetchStatus,
  RemoteConfigValueSource,
  resolveMealPlanEntitlement,
  resolveMealPlanningFlagEnabled,
  RoutesMissingError
} from '@utility/MealPlanEntitlementUtility'

const FETCH_STATUSES: RemoteConfigFetchStatus[] = ['success', 'failure', 'no_fetch_yet', 'throttled']

const TARGETS_PATH = '/meal-planning/targets'

const makeApiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const makeFlagInputs = (
  lastFetchStatus: RemoteConfigFetchStatus,
  valueSource: RemoteConfigValueSource,
  value: boolean
): MealPlanningFlagInputs => ({lastFetchStatus, valueSource, value})

describe('resolveMealPlanningFlagEnabled', () => {
  describe('before any console value has been activated', () => {
    it('is false on a never-fetched install, where the packaged default is in force', () => {
      const flag = makeFlagInputs('no_fetch_yet', 'default', PACKAGED_MEAL_PLANNING_ENABLED)

      expect(resolveMealPlanningFlagEnabled(flag)).toBe(false)
    })

    it('is false when the very first fetch failed, so the packaged default still governs', () => {
      const flag = makeFlagInputs('failure', 'default', PACKAGED_MEAL_PLANNING_ENABLED)

      expect(resolveMealPlanningFlagEnabled(flag)).toBe(false)
    })

    it('fails closed on a default carrying true, because no console value has been activated', () => {
      const flag = makeFlagInputs('no_fetch_yet', 'default', true)

      expect(resolveMealPlanningFlagEnabled(flag)).toBe(false)
    })

    it('is false for a static value, the source the SDK reports when it holds no default', () => {
      const flag = makeFlagInputs('success', 'static', true)

      expect(resolveMealPlanningFlagEnabled(flag)).toBe(false)
    })
  })

  describe('after a successful fetchAndActivate', () => {
    it('is true when the activated console value is true', () => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs('success', 'remote', true))).toBe(true)
    })

    it('is false when the activated console value is false', () => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs('success', 'remote', false))).toBe(false)
    })
  })

  // The SDK caches an activated value across launches, so a fetch that does not succeed leaves that value in
  // force instead of falling back to the packaged default.
  describe('when a later fetch does not succeed', () => {
    it('retains an activated true after a failed fetch', () => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs('failure', 'remote', true))).toBe(true)
    })

    it('retains an activated false after a failed fetch', () => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs('failure', 'remote', false))).toBe(false)
    })

    it('retains an activated true when the minimum fetch interval throttled the fetch', () => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs('throttled', 'remote', true))).toBe(true)
    })

    it('retains an activated false when the minimum fetch interval throttled the fetch', () => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs('throttled', 'remote', false))).toBe(false)
    })
  })

  it('lets the value source decide, so no fetch status can change the outcome', () => {
    FETCH_STATUSES.forEach(status => {
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs(status, 'remote', true))).toBe(true)
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs(status, 'remote', false))).toBe(false)
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs(status, 'default', true))).toBe(false)
      expect(resolveMealPlanningFlagEnabled(makeFlagInputs(status, 'static', true))).toBe(false)
    })
  })
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

  const entitlementForFlag = (flag: MealPlanningFlagInputs): MealPlanEntitlement =>
    resolveMealPlanEntitlement({...baseInputs, isFlagEnabled: resolveMealPlanningFlagEnabled(flag)})

  describe('the Remote Config flag', () => {
    it('is disabled on a never-fetched install', () => {
      const flag = makeFlagInputs('no_fetch_yet', 'default', PACKAGED_MEAL_PLANNING_ENABLED)

      expect(entitlementForFlag(flag).availability).toBe('disabled')
    })

    it('is disabled when the activated console value is false', () => {
      expect(entitlementForFlag(makeFlagInputs('success', 'remote', false)).availability).toBe('disabled')
    })

    it('is enabled when the activated console value is true', () => {
      expect(entitlementForFlag(makeFlagInputs('success', 'remote', true)).availability).toBe('enabled')
    })

    it('stays enabled when a failed fetch retains an activated true', () => {
      expect(entitlementForFlag(makeFlagInputs('failure', 'remote', true)).availability).toBe('enabled')
    })

    it('stays disabled when a failed fetch retains an activated false', () => {
      expect(entitlementForFlag(makeFlagInputs('failure', 'remote', false)).availability).toBe('disabled')
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

    // What the targets read actually throws: it classifies the bare 404 itself so it can degrade its own
    // surface to the local target, and the typed error is how the capability signal survives that.
    it('is unavailable when the targets query throws the typed RoutesMissingError', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        targetsError: new RoutesMissingError(TARGETS_PATH)
      })

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

  describe("Add Food's catalog section", () => {
    it('stays visible while the feature is enabled', () => {
      expect(resolveMealPlanEntitlement(baseInputs).isCatalogVisible).toBe(true)
    })

    // The two unavailability signals differ for `/catalog/*`, so the section follows route absence and not the
    // segment's verdict. Under signal (a) the backend is mounted and never gates the catalog routes, and AAP
    // 0.9.4's operator scenario states the outcome: the Meal Plan body shows its unavailable card while Add
    // Food keeps its Catalog section.
    it('stays visible when a gated route reports feature_disabled, because /catalog/* is never gated', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: featureDisabledError})

      expect(entitlement.availability).toBe('unavailable')
      expect(entitlement.isCatalogVisible).toBe(true)
    })

    it('stays visible when the current-plan query reports feature_disabled', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, currentPlanError: featureDisabledError})

      expect(entitlement.isCatalogVisible).toBe(true)
    })

    it('is hidden after a rollback, whose backend has no /catalog/* routes either', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, currentPlanError: bareNotFoundError})

      expect(entitlement.availability).toBe('unavailable')
      expect(entitlement.isCatalogVisible).toBe(false)
    })

    it('is hidden when a bare 404 comes from the preferences or the targets query', () => {
      const fromPreferences = resolveMealPlanEntitlement({...baseInputs, preferencesError: bareNotFoundError})
      const fromTargets = resolveMealPlanEntitlement({...baseInputs, targetsError: bareNotFoundError})

      expect(fromPreferences.isCatalogVisible).toBe(false)
      expect(fromTargets.isCatalogVisible).toBe(false)
    })

    it('is hidden when the targets read throws the typed RoutesMissingError', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        targetsError: new RoutesMissingError(TARGETS_PATH)
      })

      expect(entitlement.isCatalogVisible).toBe(false)
    })

    it('is hidden when the Remote Config flag is off', () => {
      expect(resolveMealPlanEntitlement({...baseInputs, isFlagEnabled: false}).isCatalogVisible).toBe(false)
    })

    it('is hidden when both unavailability signals fire together, because the routes are gone', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        preferencesError: featureDisabledError,
        currentPlanError: bareNotFoundError
      })

      expect(entitlement.isCatalogVisible).toBe(false)
    })

    it('stays visible for a resource 404 that carries a decodable code', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        currentPlanError: makeApiError(404, API_ERROR_CODES.planNotActive)
      })

      expect(entitlement.isCatalogVisible).toBe(true)
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

    // Server-side planning being off keeps both the segmented control (so the Meal Plan segment can render its
    // neutral card) and the catalog section, because the backend is mounted and `/catalog/*` is ungated.
    it('keeps the segmented control and the catalog when only server-side planning is disabled', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: featureDisabledError})
      const expected: MealPlanEntitlement = {
        availability: 'unavailable',
        isSegmentedControlVisible: true,
        isCatalogVisible: true,
        isGatedRequestAllowed: true,
        hasPlan: false
      }

      expect(entitlement).toEqual(expected)
    })

    it('keeps the segmented control but hides the catalog when the routes are missing', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: bareNotFoundError})
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

  // The typed error is not an axios rejection and carries no `response`, which is what keeps the Macros
  // plan-body resolver from reading it as a resource 404 (`httpStatusOf(error) === 404 && !isRoutesMissing`).
  it('returns null for the typed RoutesMissingError, which carries its status on the error itself', () => {
    expect(httpStatusOf(new RoutesMissingError(TARGETS_PATH))).toBeNull()
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

  it('returns false for the typed RoutesMissingError', () => {
    expect(isFeatureDisabledError(new RoutesMissingError(TARGETS_PATH))).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isFeatureDisabledError(null)).toBe(false)
    expect(isFeatureDisabledError(undefined)).toBe(false)
  })
})

describe('RoutesMissingError', () => {
  it('is an Error carrying the path it was thrown for', () => {
    const error = new RoutesMissingError(TARGETS_PATH)

    expect(error).toBeInstanceOf(Error)
    expect(error.path).toBe(TARGETS_PATH)
    expect(error.message).toContain(TARGETS_PATH)
  })

  it('names itself and records the 404 it stands for', () => {
    const error = new RoutesMissingError(TARGETS_PATH)

    expect(error.name).toBe('RoutesMissingError')
    expect(error.status).toBe(404)
  })

  it('keeps its own prototype, so instanceof holds for callers that use it', () => {
    expect(new RoutesMissingError(TARGETS_PATH)).toBeInstanceOf(RoutesMissingError)
  })

  // The path the error actually travels: thrown inside a request function, caught by a query observer, read by
  // a pure predicate. The structural marker is what survives that, whatever the class transform does.
  it('is still recognized after being thrown and caught', () => {
    let caught: unknown

    try {
      throw new RoutesMissingError(TARGETS_PATH)
    } catch (error) {
      caught = error
    }

    expect(isRoutesMissingError(caught)).toBe(true)
  })
})

describe('isRoutesMissingError', () => {
  it('returns true for a bare 404', () => {
    expect(isRoutesMissingError(makeApiError(404))).toBe(true)
  })

  it('returns true for the typed RoutesMissingError', () => {
    expect(isRoutesMissingError(new RoutesMissingError(TARGETS_PATH))).toBe(true)
  })

  it('returns false for a 404 carrying a decodable code', () => {
    expect(isRoutesMissingError(makeApiError(404, API_ERROR_CODES.planNotActive))).toBe(false)
  })

  it('returns false for a response carrying feature_disabled', () => {
    expect(isRoutesMissingError(makeApiError(503, API_ERROR_CODES.featureDisabled))).toBe(false)
  })

  it('returns false for an unrelated error that carries no response', () => {
    expect(isRoutesMissingError(new Error('network down'))).toBe(false)
  })

  it('returns false for a foreign object whose marker value is not the routes-missing one', () => {
    expect(isRoutesMissingError({routesMissing: 'something_else'})).toBe(false)
  })

  it('returns false for null and undefined', () => {
    expect(isRoutesMissingError(null)).toBe(false)
    expect(isRoutesMissingError(undefined)).toBe(false)
  })
})
