import * as EntitlementPolicy from '@utility/MealPlanEntitlementUtility'

import * as HookEntitlementSurface from '../useMealPlanEntitlement.util'
import {
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  MealPlanAvailability,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanningFlagInputs,
  PACKAGED_MEAL_PLANNING_ENABLED,
  RemoteConfigFetchStatus,
  RemoteConfigValueSource,
  resolveMealPlanEntitlement,
  resolveMealPlanningFlagEnabled,
  RoutesMissingError
} from '../useMealPlanEntitlement.util'

/**
 * The entitlement policy itself is decided in `@utility/MealPlanEntitlementUtility` and its behaviour is
 * covered once, in `src/utility/__tests__/MealPlanEntitlementUtility.test.ts`. This file has one job: pin the
 * contract that `useMealPlanEntitlement.util` re-exports that module rather than implementing anything, which
 * is what stops the policy being forked back into the hook tree — the defect these tests were written for.
 * Behaviour assertions belong with the owner and are deliberately absent here.
 */
const reExportedValues: [string, unknown, unknown][] = [
  ['PACKAGED_MEAL_PLANNING_ENABLED', PACKAGED_MEAL_PLANNING_ENABLED, EntitlementPolicy.PACKAGED_MEAL_PLANNING_ENABLED],
  ['resolveMealPlanningFlagEnabled', resolveMealPlanningFlagEnabled, EntitlementPolicy.resolveMealPlanningFlagEnabled],
  ['httpStatusOf', httpStatusOf, EntitlementPolicy.httpStatusOf],
  ['isFeatureDisabledError', isFeatureDisabledError, EntitlementPolicy.isFeatureDisabledError],
  ['isRoutesMissingError', isRoutesMissingError, EntitlementPolicy.isRoutesMissingError],
  ['resolveMealPlanEntitlement', resolveMealPlanEntitlement, EntitlementPolicy.resolveMealPlanEntitlement],
  ['RoutesMissingError', RoutesMissingError, EntitlementPolicy.RoutesMissingError]
]

describe('useMealPlanEntitlement.util re-export contract', () => {
  it.each(reExportedValues)(
    "re-exports %s as the utility's own binding, not a wrapper",
    (_name, fromHookSurface, fromUtility) => {
      expect(fromHookSurface).toBe(fromUtility)
    }
  )

  it('exports exactly what the utility exports, so no rule can be added or dropped here', () => {
    expect(Object.keys(HookEntitlementSurface).sort()).toEqual(Object.keys(EntitlementPolicy).sort())
  })

  it('exports every name its consumers import, including the three the Macros plan body reads', () => {
    expect(Object.keys(HookEntitlementSurface).sort()).toEqual(reExportedValues.map(([name]) => name).sort())
  })
})

describe('the re-exported RoutesMissingError', () => {
  it('is the same constructor, so an instance built through either path satisfies both', () => {
    const throughHookSurface = new RoutesMissingError('/api/meal-planning/targets')
    const throughUtility = new EntitlementPolicy.RoutesMissingError('/api/meal-planning/targets')

    expect(throughHookSurface).toBeInstanceOf(EntitlementPolicy.RoutesMissingError)
    expect(throughUtility).toBeInstanceOf(RoutesMissingError)
  })
})

describe('the re-exported types', () => {
  it('annotate the flag inputs a Remote Config read produces', () => {
    const lastFetchStatus: RemoteConfigFetchStatus = 'throttled'
    const valueSource: RemoteConfigValueSource = 'remote'
    const flag: MealPlanningFlagInputs = {lastFetchStatus, valueSource, value: true}

    expect(flag).toEqual({lastFetchStatus: 'throttled', valueSource: 'remote', value: true})
  })

  it('annotate the resolver inputs the hook assembles', () => {
    const inputs: MealPlanEntitlementInputs = {
      isFlagEnabled: true,
      preferencesError: undefined,
      currentPlanError: undefined,
      targetsError: new RoutesMissingError('/api/meal-planning/targets'),
      hasPlan: false
    }

    expect(Object.keys(inputs).sort()).toEqual([
      'currentPlanError',
      'hasPlan',
      'isFlagEnabled',
      'preferencesError',
      'targetsError'
    ])
  })

  it('annotate the entitlement and the availability alias the consumers read', () => {
    const availability: MealPlanAvailability = 'unavailable'
    const entitlement: MealPlanEntitlement = {
      availability,
      isSegmentedControlVisible: true,
      isCatalogVisible: true,
      isGatedRequestAllowed: true,
      hasPlan: false
    }

    expect(Object.keys(entitlement).sort()).toEqual([
      'availability',
      'hasPlan',
      'isCatalogVisible',
      'isGatedRequestAllowed',
      'isSegmentedControlVisible'
    ])
  })
})
