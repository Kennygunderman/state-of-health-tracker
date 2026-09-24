import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {
  deriveMealPlanCapabilitySignals,
  deriveMealPlanCapabilitySignalsFromRequests,
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  latchFromCapabilityRecord,
  MealPlanCapabilityErrors,
  MealPlanCapabilityLatch,
  MealPlanCapabilityRecord,
  MealPlanCapabilitySignals,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanningFlagInputs,
  MealPlanRequestScope,
  mergeMealPlanCapabilityLatch,
  nextMealPlanCapabilityRecord,
  NO_MEAL_PLAN_CAPABILITY_LATCH,
  NO_MEAL_PLAN_REQUEST_SCOPE,
  ObservedMealPlanRequest,
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
    // neutral card) and the catalog section, because the backend is mounted and `/catalog/*` is ungated. Gated
    // requests stop, because the routes that answered `feature_disabled` answer a repeat probe the same way.
    it('keeps the segmented control and the catalog but stops gated requests when server-side planning is off', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: featureDisabledError})
      const expected: MealPlanEntitlement = {
        availability: 'unavailable',
        isSegmentedControlVisible: true,
        isCatalogVisible: true,
        isGatedRequestAllowed: false,
        hasPlan: false
      }

      expect(entitlement).toEqual(expected)
    })

    it('keeps the segmented control but hides the catalog and stops gated requests when the routes are missing', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, preferencesError: bareNotFoundError})
      const expected: MealPlanEntitlement = {
        availability: 'unavailable',
        isSegmentedControlVisible: true,
        isCatalogVisible: false,
        isGatedRequestAllowed: false,
        hasPlan: false
      }

      expect(entitlement).toEqual(expected)
    })

    // The permission and the verdict are one decision: every state that puts the Meal Plan segment on its
    // unavailable card is a state in which no gated request may be issued (AAP 0.2.5, 0.7.5).
    it('never allows a gated request in a state it calls unavailable', () => {
      const unavailableStates: MealPlanEntitlementInputs[] = [
        {...baseInputs, preferencesError: featureDisabledError},
        {...baseInputs, currentPlanError: featureDisabledError},
        {...baseInputs, preferencesError: bareNotFoundError},
        {...baseInputs, currentPlanError: bareNotFoundError},
        {...baseInputs, targetsError: bareNotFoundError},
        {...baseInputs, targetsError: new RoutesMissingError(TARGETS_PATH)},
        {...baseInputs, capabilityLatch: {isFeatureDisabled: true, areRoutesMissing: false}},
        {...baseInputs, capabilityLatch: {isFeatureDisabled: false, areRoutesMissing: true}}
      ]

      unavailableStates.forEach(inputs => {
        const entitlement = resolveMealPlanEntitlement(inputs)

        expect(entitlement.availability).toBe('unavailable')
        expect(entitlement.isGatedRequestAllowed).toBe(false)
      })
    })

    it('passes hasPlan through unchanged in every availability state', () => {
      const withPlan: MealPlanEntitlementInputs = {...baseInputs, hasPlan: true}

      expect(resolveMealPlanEntitlement(withPlan).hasPlan).toBe(true)
      expect(resolveMealPlanEntitlement({...withPlan, isFlagEnabled: false}).hasPlan).toBe(true)
      expect(resolveMealPlanEntitlement({...withPlan, preferencesError: bareNotFoundError}).hasPlan).toBe(true)
      expect(resolveMealPlanEntitlement(baseInputs).hasPlan).toBe(false)
    })
  })

  // The retention half of AAP 0.2.5's "no gated request": the verdict has to survive the error object, because
  // the reads that carried the signal are refetched, remounted and eventually discarded, and re-probing a route
  // that is disabled or absent is exactly what the latch exists to prevent.
  describe('the retained capability latch', () => {
    const featureDisabledLatch: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: false}
    const routesMissingLatch: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: true}

    it('defaults to no retained signal, so a caller that retains nothing is answered from the live errors', () => {
      expect(resolveMealPlanEntitlement(baseInputs)).toEqual(
        resolveMealPlanEntitlement({...baseInputs, capabilityLatch: NO_MEAL_PLAN_CAPABILITY_LATCH})
      )
    })

    it('is unavailable with gated requests stopped on a latched feature_disabled and no live error', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, capabilityLatch: featureDisabledLatch})

      expect(entitlement.availability).toBe('unavailable')
      expect(entitlement.isGatedRequestAllowed).toBe(false)
    })

    // Signal (a) leaves `/catalog/*` answering, latched or live: the backend is mounted and never gates it.
    it('keeps the catalog section on a latched feature_disabled', () => {
      expect(resolveMealPlanEntitlement({...baseInputs, capabilityLatch: featureDisabledLatch}).isCatalogVisible).toBe(
        true
      )
    })

    it('is unavailable with gated requests stopped on a latched routes-missing and no live error', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, capabilityLatch: routesMissingLatch})

      expect(entitlement.availability).toBe('unavailable')
      expect(entitlement.isGatedRequestAllowed).toBe(false)
    })

    it('hides the catalog section on a latched routes-missing, whose backend has no /catalog/* either', () => {
      expect(resolveMealPlanEntitlement({...baseInputs, capabilityLatch: routesMissingLatch}).isCatalogVisible).toBe(
        false
      )
    })

    it('keeps the segmented control while latched, so the segment can render its neutral card', () => {
      const entitlement = resolveMealPlanEntitlement({...baseInputs, capabilityLatch: routesMissingLatch})

      expect(entitlement.isSegmentedControlVisible).toBe(true)
    })

    // The flag is the outer gate: a Remote Config disable is 'disabled', not a latched 'unavailable'.
    it('is disabled rather than unavailable when the flag is off, whatever the latch holds', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        isFlagEnabled: false,
        capabilityLatch: routesMissingLatch
      })

      expect(entitlement.availability).toBe('disabled')
      expect(entitlement.isGatedRequestAllowed).toBe(false)
    })

    it('adds a live signal to a latched one rather than replacing it', () => {
      const entitlement = resolveMealPlanEntitlement({
        ...baseInputs,
        capabilityLatch: featureDisabledLatch,
        currentPlanError: bareNotFoundError
      })

      expect(entitlement.availability).toBe('unavailable')
      expect(entitlement.isCatalogVisible).toBe(false)
      expect(entitlement.isGatedRequestAllowed).toBe(false)
    })
  })
})

describe('deriveMealPlanCapabilitySignals', () => {
  const noErrors: MealPlanCapabilityErrors = {
    preferencesError: undefined,
    currentPlanError: undefined,
    targetsError: undefined
  }

  const featureDisabledError = makeApiError(503, API_ERROR_CODES.featureDisabled)
  const bareNotFoundError = makeApiError(404)

  it('reports neither signal when no read failed', () => {
    expect(deriveMealPlanCapabilitySignals(noErrors)).toEqual({isFeatureDisabled: false, areRoutesMissing: false})
  })

  it('reports feature_disabled from the preferences read', () => {
    const signals = deriveMealPlanCapabilitySignals({...noErrors, preferencesError: featureDisabledError})

    expect(signals).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
  })

  it('reports feature_disabled from the current-plan read', () => {
    const signals = deriveMealPlanCapabilitySignals({...noErrors, currentPlanError: featureDisabledError})

    expect(signals).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
  })

  // The exclusion the resolver has always applied, now stated where the classification lives: the targets route
  // is ungated, so a `feature_disabled` from it is not a statement about the feature.
  it('ignores a feature_disabled from the ungated targets read', () => {
    const signals = deriveMealPlanCapabilitySignals({...noErrors, targetsError: featureDisabledError})

    expect(signals).toEqual({isFeatureDisabled: false, areRoutesMissing: false})
  })

  it('reports routes-missing from any of the three reads, the targets one included', () => {
    expect(deriveMealPlanCapabilitySignals({...noErrors, preferencesError: bareNotFoundError}).areRoutesMissing).toBe(
      true
    )
    expect(deriveMealPlanCapabilitySignals({...noErrors, currentPlanError: bareNotFoundError}).areRoutesMissing).toBe(
      true
    )
    expect(deriveMealPlanCapabilitySignals({...noErrors, targetsError: bareNotFoundError}).areRoutesMissing).toBe(true)
  })

  it('reports routes-missing for the typed RoutesMissingError the targets read throws', () => {
    const signals = deriveMealPlanCapabilitySignals({...noErrors, targetsError: new RoutesMissingError(TARGETS_PATH)})

    expect(signals).toEqual({isFeatureDisabled: false, areRoutesMissing: true})
  })

  it('reports neither signal for a resource 404 that carries a decodable code', () => {
    const signals = deriveMealPlanCapabilitySignals({
      ...noErrors,
      currentPlanError: makeApiError(404, API_ERROR_CODES.planNotActive)
    })

    expect(signals).toEqual({isFeatureDisabled: false, areRoutesMissing: false})
  })

  it('reports both signals when the two arrive together', () => {
    const signals = deriveMealPlanCapabilitySignals({
      ...noErrors,
      preferencesError: featureDisabledError,
      currentPlanError: bareNotFoundError
    })

    expect(signals).toEqual({isFeatureDisabled: true, areRoutesMissing: true})
  })
})

// The producer every other request reaches the latch through: a setup step save, a nested plan/recipe/grocery
// read, a keyed write. What decides whether a failure is a signal is the request's place in the gating policy,
// not the error alone, so each case states a scope and an error together.
describe('deriveMealPlanCapabilitySignalsFromRequests', () => {
  const NO_SIGNALS: MealPlanCapabilitySignals = {isFeatureDisabled: false, areRoutesMissing: false}

  const GATED_PROBE: MealPlanRequestScope = {isGated: true, isRoutesProbe: true}
  const GATED_RESOURCE: MealPlanRequestScope = {isGated: true, isRoutesProbe: false}
  const UNGATED_PROBE: MealPlanRequestScope = {isGated: false, isRoutesProbe: true}

  const featureDisabledError = makeApiError(503, API_ERROR_CODES.featureDisabled)
  const bareNotFoundError = makeApiError(404)

  it('reports neither signal for no requests at all', () => {
    expect(deriveMealPlanCapabilitySignalsFromRequests([])).toEqual(NO_SIGNALS)
  })

  it('reports neither signal for requests that failed outside the gating policy', () => {
    const requests: ObservedMealPlanRequest[] = [
      {...NO_MEAL_PLAN_REQUEST_SCOPE, error: featureDisabledError},
      {...NO_MEAL_PLAN_REQUEST_SCOPE, error: bareNotFoundError},
      {...NO_MEAL_PLAN_REQUEST_SCOPE, error: new RoutesMissingError(TARGETS_PATH)}
    ]

    expect(deriveMealPlanCapabilitySignalsFromRequests(requests)).toEqual(NO_SIGNALS)
  })

  it('reports neither signal for requests that did not fail', () => {
    const requests: ObservedMealPlanRequest[] = [
      {...GATED_PROBE, error: null},
      {...GATED_RESOURCE, error: undefined},
      {...UNGATED_PROBE, error: undefined}
    ]

    expect(deriveMealPlanCapabilitySignalsFromRequests(requests)).toEqual(NO_SIGNALS)
  })

  // Signal (a) from a gated request that is not one of the entitlement's own three reads — the finding this
  // producer exists for: a setup step save, a recipe read, a swap commit.
  it('reports feature_disabled from any gated request, resource route or not', () => {
    const fromResource = deriveMealPlanCapabilitySignalsFromRequests([{...GATED_RESOURCE, error: featureDisabledError}])
    const fromProbe = deriveMealPlanCapabilitySignalsFromRequests([{...GATED_PROBE, error: featureDisabledError}])

    expect(fromResource).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
    expect(fromProbe).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
  })

  // The signal is `503 feature_disabled` exactly (AAP 0.2.5, 0.7.5), and the status is load-bearing here for a
  // reason that only shows up on a gated RESOURCE route: AAP 0.5.2 makes every 404 from one the
  // not-found/not-yours answer, so a 404 carrying this code — from a proxy, a rewritten route, a future
  // handler — must not latch the whole session off one plan day or one recipe the caller cannot see. Any other
  // 4xx is likewise some other refusal of this request, not a statement about the feature.
  it('ignores the capability code on a resource 404, which AAP 0.5.2 reserves for not-found/not-yours', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([
      {...GATED_RESOURCE, error: makeApiError(404, API_ERROR_CODES.featureDisabled)}
    ])

    expect(signals).toEqual(NO_SIGNALS)
  })

  it('ignores the capability code on any other 4xx from a gated request', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([
      {...GATED_RESOURCE, error: makeApiError(403, API_ERROR_CODES.featureDisabled)},
      {...GATED_PROBE, error: makeApiError(409, API_ERROR_CODES.featureDisabled)}
    ])

    expect(signals).toEqual(NO_SIGNALS)
  })

  // A gateway echoing the string describes nothing about the attempt, so latching every gated request in the
  // session on it would spend the feature on a failure a second attempt would have resolved.
  it('ignores the capability code on a 5xx that is not the 503 it arrives as', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([
      {...GATED_RESOURCE, error: makeApiError(502, API_ERROR_CODES.featureDisabled)},
      {...GATED_PROBE, error: makeApiError(500, API_ERROR_CODES.featureDisabled)}
    ])

    expect(signals).toEqual(NO_SIGNALS)
  })

  // And the bare resource 404 itself, which is signal (b) only from one of the three resource-less GETs: from a
  // gated resource route it is neither signal.
  it('reports neither signal for a bare 404 from a gated resource route', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([{...GATED_RESOURCE, error: bareNotFoundError}])

    expect(signals).toEqual(NO_SIGNALS)
  })

  // The ungated exception: `/meal-planning/targets*` and `/catalog/*` are never gated server-side (AAP 0.3.1),
  // so a `feature_disabled` from them is not a statement about the feature.
  it('ignores feature_disabled from an ungated request', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([{...UNGATED_PROBE, error: featureDisabledError}])

    expect(signals).toEqual(NO_SIGNALS)
  })

  // Confirmed-ness is the difference between a refusal and a retry: no response status means nothing described
  // this attempt, so the code in the body is not an answer about the capability.
  it('ignores a feature_disabled body that carries no response status', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([
      {...GATED_RESOURCE, error: {response: {data: {error: API_ERROR_CODES.featureDisabled}}}}
    ])

    expect(signals).toEqual(NO_SIGNALS)
  })

  it('reports routes-missing from a bare 404 on a resource-less probe', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([{...UNGATED_PROBE, error: bareNotFoundError}])

    expect(signals).toEqual({isFeatureDisabled: false, areRoutesMissing: true})
  })

  it('reports routes-missing for the typed RoutesMissingError a probe throws', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([
      {...GATED_PROBE, error: new RoutesMissingError(TARGETS_PATH)}
    ])

    expect(signals).toEqual({isFeatureDisabled: false, areRoutesMissing: true})
  })

  // The resource-route exclusion of AAP 0.5.2, which is why the scope carries two members: a plan-day or recipe
  // read is gated, but its bare 404 is the not-found/not-yours answer and never unavailability.
  it('never reports routes-missing from a gated resource route, whose 404 is its not-found answer', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([{...GATED_RESOURCE, error: bareNotFoundError}])

    expect(signals).toEqual(NO_SIGNALS)
  })

  it('never reports routes-missing from a 404 that carries a decodable code', () => {
    const signals = deriveMealPlanCapabilitySignalsFromRequests([
      {...GATED_PROBE, error: makeApiError(404, API_ERROR_CODES.planNotActive)}
    ])

    expect(signals).toEqual(NO_SIGNALS)
  })

  it('finds the one request carrying a signal among many that do not', () => {
    const requests: ObservedMealPlanRequest[] = [
      {...GATED_PROBE, error: undefined},
      {...NO_MEAL_PLAN_REQUEST_SCOPE, error: featureDisabledError},
      {...GATED_RESOURCE, error: makeApiError(409, API_ERROR_CODES.stalePlan)},
      {...GATED_RESOURCE, error: featureDisabledError},
      {...UNGATED_PROBE, error: undefined}
    ]

    expect(deriveMealPlanCapabilitySignalsFromRequests(requests)).toEqual({
      isFeatureDisabled: true,
      areRoutesMissing: false
    })
  })

  it('reports both signals when separate requests carry one each', () => {
    const requests: ObservedMealPlanRequest[] = [
      {...GATED_RESOURCE, error: featureDisabledError},
      {...UNGATED_PROBE, error: bareNotFoundError}
    ]

    expect(deriveMealPlanCapabilitySignalsFromRequests(requests)).toEqual({
      isFeatureDisabled: true,
      areRoutesMissing: true
    })
  })

  // The caller scans the query and mutation caches, so it hands over whatever iterable it has rather than
  // materializing an array.
  it('accepts any iterable of requests', () => {
    const requests = new Set<ObservedMealPlanRequest>([{...GATED_RESOURCE, error: featureDisabledError}])

    expect(deriveMealPlanCapabilitySignalsFromRequests(requests).isFeatureDisabled).toBe(true)
  })
})

describe('mergeMealPlanCapabilityLatch', () => {
  const noSignals: MealPlanCapabilitySignals = {isFeatureDisabled: false, areRoutesMissing: false}

  it('adds a newly seen signal to the latch', () => {
    const merged = mergeMealPlanCapabilityLatch(NO_MEAL_PLAN_CAPABILITY_LATCH, {
      ...noSignals,
      isFeatureDisabled: true
    })

    expect(merged).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
  })

  it('accumulates the two signals across separate merges', () => {
    const afterFirst = mergeMealPlanCapabilityLatch(NO_MEAL_PLAN_CAPABILITY_LATCH, {
      ...noSignals,
      isFeatureDisabled: true
    })
    const afterSecond = mergeMealPlanCapabilityLatch(afterFirst, {...noSignals, areRoutesMissing: true})

    expect(afterSecond).toEqual({isFeatureDisabled: true, areRoutesMissing: true})
  })

  // A read that succeeds after a terminal signal does not unlatch it: the route was not probed again, and a
  // probe is what the latch exists to stop.
  it('never clears a latched signal that the new signals do not carry', () => {
    const latched: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: true}

    expect(mergeMealPlanCapabilityLatch(latched, noSignals)).toEqual(latched)
  })

  // Identity, not just value: the session store publishes through `useSyncExternalStore`, which re-renders every
  // consumer when the snapshot reference changes.
  it('returns the very same latch object when nothing changed', () => {
    const latched: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: false}

    expect(mergeMealPlanCapabilityLatch(latched, noSignals)).toBe(latched)
    expect(mergeMealPlanCapabilityLatch(latched, {...noSignals, isFeatureDisabled: true})).toBe(latched)
    expect(mergeMealPlanCapabilityLatch(NO_MEAL_PLAN_CAPABILITY_LATCH, noSignals)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('returns a new latch object when a signal is added', () => {
    const merged = mergeMealPlanCapabilityLatch(NO_MEAL_PLAN_CAPABILITY_LATCH, {
      ...noSignals,
      areRoutesMissing: true
    })

    expect(merged).not.toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('leaves the latch it was given unmutated', () => {
    const latched: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: false}

    mergeMealPlanCapabilityLatch(latched, {isFeatureDisabled: true, areRoutesMissing: true})

    expect(latched).toEqual({isFeatureDisabled: false, areRoutesMissing: false})
  })

  it('starts from a latch holding nothing, which is what NO_MEAL_PLAN_CAPABILITY_LATCH is', () => {
    expect(NO_MEAL_PLAN_CAPABILITY_LATCH).toEqual({isFeatureDisabled: false, areRoutesMissing: false})
  })
})

// The retention rule as data: what is remembered, under which activation, and what the activation release does
// to it. The reducer is what replaced the module-level `let` the release used to be guarded by.
describe('nextMealPlanCapabilityRecord', () => {
  const FIRST_EPOCH = 1
  const SECOND_EPOCH = 2

  const noSignals: MealPlanCapabilitySignals = {isFeatureDisabled: false, areRoutesMissing: false}
  const featureDisabledSignals: MealPlanCapabilitySignals = {isFeatureDisabled: true, areRoutesMissing: false}
  const routesMissingSignals: MealPlanCapabilitySignals = {isFeatureDisabled: false, areRoutesMissing: true}

  // No record is created for a session that has seen no signal, so the holder stays empty rather than filling
  // with a "nothing is wrong" entry on every settled read.
  it('records nothing when there is nothing held and nothing seen', () => {
    expect(nextMealPlanCapabilityRecord(undefined, FIRST_EPOCH, noSignals)).toBeUndefined()
  })

  it('records the first signal seen, at the activation it was seen under', () => {
    const record = nextMealPlanCapabilityRecord(undefined, FIRST_EPOCH, featureDisabledSignals)

    expect(record).toEqual({activationEpoch: FIRST_EPOCH, latch: {isFeatureDisabled: true, areRoutesMissing: false}})
  })

  it('accumulates a second signal into the record held for the same activation', () => {
    const first = nextMealPlanCapabilityRecord(undefined, FIRST_EPOCH, featureDisabledSignals)
    const second = nextMealPlanCapabilityRecord(first, FIRST_EPOCH, routesMissingSignals)

    expect(second).toEqual({activationEpoch: FIRST_EPOCH, latch: {isFeatureDisabled: true, areRoutesMissing: true}})
  })

  // A read that succeeds after a terminal signal does not unlatch it: the route was not probed again.
  it('never drops a latched signal the new reading does not carry', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: false}
    }

    expect(nextMealPlanCapabilityRecord(held, FIRST_EPOCH, noSignals)).toBe(held)
  })

  // Identity, not value: the writer writes only when the reference changes, and the write notifies the writer's
  // own subscription — so an allocating "unchanged" result would be an infinite write loop.
  it('returns the very same record when the reading changes nothing', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: true}
    }

    expect(nextMealPlanCapabilityRecord(held, FIRST_EPOCH, featureDisabledSignals)).toBe(held)
    expect(nextMealPlanCapabilityRecord(held, FIRST_EPOCH, routesMissingSignals)).toBe(held)
    expect(nextMealPlanCapabilityRecord(held, FIRST_EPOCH, noSignals)).toBe(held)
  })

  it('returns a new record when a signal is added', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: false}
    }
    const next = nextMealPlanCapabilityRecord(held, FIRST_EPOCH, routesMissingSignals)

    expect(next).not.toBe(held)
    expect(next?.latch).toEqual({isFeatureDisabled: true, areRoutesMissing: true})
  })

  // The release: a verdict reached before the launch activation settled is dropped by that activation, and the
  // signal still in hand re-latches in the same reading — which is what makes the release self-correcting.
  it('releases the held verdict on a new activation and re-merges the signal still in hand', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: true}
    }
    const next = nextMealPlanCapabilityRecord(held, SECOND_EPOCH, featureDisabledSignals)

    expect(next).toEqual({activationEpoch: SECOND_EPOCH, latch: {isFeatureDisabled: true, areRoutesMissing: false}})
  })

  it('clears the held verdict on a new activation whose reading carries no signal', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: false}
    }
    const next = nextMealPlanCapabilityRecord(held, SECOND_EPOCH, noSignals)

    expect(next).toEqual({activationEpoch: SECOND_EPOCH, latch: NO_MEAL_PLAN_CAPABILITY_LATCH})
    expect(next?.latch).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  // The stored epoch is the whole release mechanism: once it has advanced, every further reading under the same
  // activation accumulates again rather than releasing, however many observers record it.
  it('releases once per activation, so the next reading under it accumulates', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: true}
    }
    const released = nextMealPlanCapabilityRecord(held, SECOND_EPOCH, noSignals)
    const afterRelease = nextMealPlanCapabilityRecord(released, SECOND_EPOCH, routesMissingSignals)

    expect(afterRelease).toEqual({
      activationEpoch: SECOND_EPOCH,
      latch: {isFeatureDisabled: false, areRoutesMissing: true}
    })
    expect(nextMealPlanCapabilityRecord(afterRelease, SECOND_EPOCH, noSignals)).toBe(afterRelease)
  })

  // A reading taken under an earlier activation is stale — its observer has not seen the newer one yet — so it
  // may add signals but must never release. Two observers allowed to release each other's verdict would
  // exchange writes without end, because each write notifies the other.
  it('never releases on a reading taken under an earlier activation', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: SECOND_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: false}
    }

    expect(nextMealPlanCapabilityRecord(held, FIRST_EPOCH, noSignals)).toBe(held)
    expect(nextMealPlanCapabilityRecord(held, FIRST_EPOCH, routesMissingSignals)).toEqual({
      activationEpoch: SECOND_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: true}
    })
  })

  it('leaves the record it was given unmutated', () => {
    const held: MealPlanCapabilityRecord = {
      activationEpoch: FIRST_EPOCH,
      latch: {isFeatureDisabled: true, areRoutesMissing: false}
    }

    nextMealPlanCapabilityRecord(held, SECOND_EPOCH, routesMissingSignals)

    expect(held).toEqual({activationEpoch: FIRST_EPOCH, latch: {isFeatureDisabled: true, areRoutesMissing: false}})
  })
})

describe('latchFromCapabilityRecord', () => {
  it('reads the empty latch when no verdict has been recorded, by reference', () => {
    expect(latchFromCapabilityRecord(undefined)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  // By reference again: this is the snapshot a `useSyncExternalStore` consumer compares between commits.
  it('reads the record\u2019s own latch object', () => {
    const latch: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: false}

    expect(latchFromCapabilityRecord({activationEpoch: 3, latch})).toBe(latch)
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
