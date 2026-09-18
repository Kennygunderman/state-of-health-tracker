import {MealPlan} from '@data/models/MealPlan'
import {mutationKeys, queryKeys} from '@queries/keys'
import * as EntitlementPolicy from '@utility/MealPlanEntitlementUtility'

import * as HookEntitlementSurface from '../useMealPlanEntitlement.util'
import {
  deriveMealPlanCapabilitySignals,
  deriveMealPlanCapabilitySignalsFromRequests,
  hasMealPlan,
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  latchFromCapabilityRecord,
  MealPlanAvailability,
  MealPlanCapabilityLatch,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanEntitlementQueryPlanInputs,
  MealPlanningFlagInputs,
  MealPlanRequestScope,
  mealPlanRequestScopeForMutationKey,
  mealPlanRequestScopeForQueryKey,
  mergeMealPlanCapabilityLatch,
  nextMealPlanCapabilityRecord,
  NO_MEAL_PLAN_CAPABILITY_LATCH,
  NO_MEAL_PLAN_REQUEST_SCOPE,
  PACKAGED_MEAL_PLANNING_ENABLED,
  planMealPlanEntitlementQueries,
  RemoteConfigFetchStatus,
  RemoteConfigValueSource,
  resolveMealPlanEntitlement,
  resolveMealPlanningFlagEnabled,
  RoutesMissingError
} from '../useMealPlanEntitlement.util'

const SESSION_DAY_KEY = '2026-07-05'

const makePlan = (): MealPlan => ({
  id: 'plan-current',
  revision: 1,
  generationKey: 'idem-generate-entitlement',
  generationAttempt: 1,
  startDate: SESSION_DAY_KEY,
  endDate: '2026-07-11',
  status: 'active',
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  generationTargets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  targetsStale: false,
  preferencesRevision: 4,
  targetsRevision: 2,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 14, loggedEntryCount: 0},
  days: []
})

/**
 * The entitlement policy itself is decided in `@utility/MealPlanEntitlementUtility` and its behaviour is
 * covered once, in `src/utility/__tests__/MealPlanEntitlementUtility.test.ts`. Two jobs here: pin the contract
 * that `useMealPlanEntitlement.util` re-exports that module rather than implementing any part of the policy —
 * what stops the policy being forked back into the hook tree, the defect these tests were written for — and
 * cover the hook's own pure wiring that the same file adds, which decides who issues the reads the policy
 * already permits and where each of the app's request keys sits in the gating policy. Policy behaviour
 * assertions belong with the owner and are deliberately absent here.
 */
const reExportedValues: [string, unknown, unknown][] = [
  ['PACKAGED_MEAL_PLANNING_ENABLED', PACKAGED_MEAL_PLANNING_ENABLED, EntitlementPolicy.PACKAGED_MEAL_PLANNING_ENABLED],
  ['resolveMealPlanningFlagEnabled', resolveMealPlanningFlagEnabled, EntitlementPolicy.resolveMealPlanningFlagEnabled],
  ['httpStatusOf', httpStatusOf, EntitlementPolicy.httpStatusOf],
  ['isFeatureDisabledError', isFeatureDisabledError, EntitlementPolicy.isFeatureDisabledError],
  ['isRoutesMissingError', isRoutesMissingError, EntitlementPolicy.isRoutesMissingError],
  ['resolveMealPlanEntitlement', resolveMealPlanEntitlement, EntitlementPolicy.resolveMealPlanEntitlement],
  ['RoutesMissingError', RoutesMissingError, EntitlementPolicy.RoutesMissingError],
  ['NO_MEAL_PLAN_CAPABILITY_LATCH', NO_MEAL_PLAN_CAPABILITY_LATCH, EntitlementPolicy.NO_MEAL_PLAN_CAPABILITY_LATCH],
  ['NO_MEAL_PLAN_REQUEST_SCOPE', NO_MEAL_PLAN_REQUEST_SCOPE, EntitlementPolicy.NO_MEAL_PLAN_REQUEST_SCOPE],
  [
    'deriveMealPlanCapabilitySignals',
    deriveMealPlanCapabilitySignals,
    EntitlementPolicy.deriveMealPlanCapabilitySignals
  ],
  [
    'deriveMealPlanCapabilitySignalsFromRequests',
    deriveMealPlanCapabilitySignalsFromRequests,
    EntitlementPolicy.deriveMealPlanCapabilitySignalsFromRequests
  ],
  ['mergeMealPlanCapabilityLatch', mergeMealPlanCapabilityLatch, EntitlementPolicy.mergeMealPlanCapabilityLatch],
  ['nextMealPlanCapabilityRecord', nextMealPlanCapabilityRecord, EntitlementPolicy.nextMealPlanCapabilityRecord],
  ['latchFromCapabilityRecord', latchFromCapabilityRecord, EntitlementPolicy.latchFromCapabilityRecord]
]

/**
 * The complete list of names this file may hold that the utility does not: the hook's own wiring, none of which
 * decides entitlement. Anything else appearing here is a policy rule that has been forked.
 */
const hookWiringExports = [
  'mealPlanRequestScopeForQueryKey',
  'mealPlanRequestScopeForMutationKey',
  'planMealPlanEntitlementQueries',
  'hasMealPlan'
]

describe('useMealPlanEntitlement.util re-export contract', () => {
  it.each(reExportedValues)(
    "re-exports %s as the utility's own binding, not a wrapper",
    (_name, fromHookSurface, fromUtility) => {
      expect(fromHookSurface).toBe(fromUtility)
    }
  )

  it("re-exports every one of the utility's own exports, so no policy rule can be dropped here", () => {
    const surfaceByName = new Map<string, unknown>(Object.entries(HookEntitlementSurface))

    Object.entries(EntitlementPolicy).forEach(([name, binding]) => {
      expect(surfaceByName.get(name)).toBe(binding)
    })

    expect(Object.keys(EntitlementPolicy).sort()).toEqual(reExportedValues.map(([name]) => name).sort())
  })

  // The other half of the guard: the file may add the hook's own wiring and nothing else, so a policy rule
  // cannot be forked into the hook tree under a new name — and the mutable session store this file used to own
  // cannot come back under one either.
  it('adds exactly the enumerated hook-wiring helpers beyond the re-exports', () => {
    const addedNames = Object.keys(HookEntitlementSurface).filter(name => !(name in EntitlementPolicy))

    expect(addedNames.sort()).toEqual([...hookWiringExports].sort())
  })

  // Purity, asserted rather than assumed: every added binding is a function, so nothing here holds state a
  // consumer could mutate or a session could inherit (`mobile-helper-functions`).
  it('adds only pure functions, so the file holds no mutable state', () => {
    const surface = HookEntitlementSurface as unknown as Record<string, unknown>

    hookWiringExports.forEach(name => {
      expect(typeof surface[name]).toBe('function')
    })
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

  it('annotate the request scope the key classifiers answer with', () => {
    const scope: MealPlanRequestScope = {isGated: true, isRoutesProbe: false}

    expect(Object.keys(scope).sort()).toEqual(['isGated', 'isRoutesProbe'])
  })
})

const GATED_PROBE_SCOPE: MealPlanRequestScope = {isGated: true, isRoutesProbe: true}
const GATED_RESOURCE_SCOPE: MealPlanRequestScope = {isGated: true, isRoutesProbe: false}
const UNGATED_PROBE_SCOPE: MealPlanRequestScope = {isGated: false, isRoutesProbe: true}

/**
 * The expected scope of every key in `@queries/keys`, by name.
 *
 * Exhaustive on purpose: the first case asserts that this table covers exactly the keys the app declares, so a
 * meal-planning key added without a classification fails here instead of silently answering a confirmed
 * `503 feature_disabled` that the session's capability verdict never learns about (AAP 0.2.5).
 */
const expectedQueryScopes: Record<string, MealPlanRequestScope> = {
  exercises: NO_MEAL_PLAN_REQUEST_SCOPE,
  templates: NO_MEAL_PLAN_REQUEST_SCOPE,
  workoutSummaries: NO_MEAL_PLAN_REQUEST_SCOPE,
  weeklyWorkoutSummaries: NO_MEAL_PLAN_REQUEST_SCOPE,
  records: NO_MEAL_PLAN_REQUEST_SCOPE,
  exerciseHistories: NO_MEAL_PLAN_REQUEST_SCOPE,
  exerciseHistory: NO_MEAL_PLAN_REQUEST_SCOPE,
  runs: NO_MEAL_PLAN_REQUEST_SCOPE,
  runsTotal: NO_MEAL_PLAN_REQUEST_SCOPE,
  run: NO_MEAL_PLAN_REQUEST_SCOPE,
  weighIns: NO_MEAL_PLAN_REQUEST_SCOPE,
  activitySteps: NO_MEAL_PLAN_REQUEST_SCOPE,
  dailySteps: NO_MEAL_PLAN_REQUEST_SCOPE,
  hourlySteps: NO_MEAL_PLAN_REQUEST_SCOPE,
  runWindowSteps: NO_MEAL_PLAN_REQUEST_SCOPE,
  healthAuthStatus: NO_MEAL_PLAN_REQUEST_SCOPE,
  dailyMacrosAll: NO_MEAL_PLAN_REQUEST_SCOPE,
  dailyMacros: NO_MEAL_PLAN_REQUEST_SCOPE,
  macrosHistory: NO_MEAL_PLAN_REQUEST_SCOPE,
  foods: NO_MEAL_PLAN_REQUEST_SCOPE,
  foodSearch: NO_MEAL_PLAN_REQUEST_SCOPE,
  brandedFoodSearch: NO_MEAL_PLAN_REQUEST_SCOPE,
  userAvatar: NO_MEAL_PLAN_REQUEST_SCOPE,
  aiUsage: NO_MEAL_PLAN_REQUEST_SCOPE,
  // Gated and resource-less at once: the server refuses them while the flag is off, and a feature-bearing
  // backend never answers either with a bare 404.
  mealPlanPreferences: GATED_PROBE_SCOPE,
  mealPlanCurrent: GATED_PROBE_SCOPE,
  // Never gated (AAP 0.3.1) but still resource-less: its bare 404 is the rollback signal of AAP 0.7.5.
  nutritionTargets: UNGATED_PROBE_SCOPE,
  // The estimate route lives under `/meal-planning/targets/estimate`, which the server flag does not gate.
  targetEstimate: NO_MEAL_PLAN_REQUEST_SCOPE,
  // Gated resource routes: their own 404 is the not-found/not-yours answer of AAP 0.5.2, never unavailability.
  mealPlanDayAll: GATED_RESOURCE_SCOPE,
  mealPlanDay: GATED_RESOURCE_SCOPE,
  swapAlternativesAll: GATED_RESOURCE_SCOPE,
  swapAlternatives: GATED_RESOURCE_SCOPE,
  swapPreviewAll: GATED_RESOURCE_SCOPE,
  swapPreview: GATED_RESOURCE_SCOPE,
  groceryListAll: GATED_RESOURCE_SCOPE,
  groceryList: GATED_RESOURCE_SCOPE,
  affectedMealsAll: GATED_RESOURCE_SCOPE,
  affectedMeals: GATED_RESOURCE_SCOPE,
  recipeVersion: GATED_RESOURCE_SCOPE,
  // `/catalog/*` is never gated, so Add Food keeps searching while planning is off (AAP 0.5.1, 0.9.4).
  catalogSearch: NO_MEAL_PLAN_REQUEST_SCOPE,
  catalogSuggestions: NO_MEAL_PLAN_REQUEST_SCOPE,
  // The capability record itself is not a request: nothing fetches it, so it can produce no signal.
  mealPlanCapability: NO_MEAL_PLAN_REQUEST_SCOPE
}

const expectedMutationScopes: Record<string, MealPlanRequestScope> = {
  completeWorkout: NO_MEAL_PLAN_REQUEST_SCOPE,
  createExercise: NO_MEAL_PLAN_REQUEST_SCOPE,
  deleteExercise: NO_MEAL_PLAN_REQUEST_SCOPE,
  createTemplate: NO_MEAL_PLAN_REQUEST_SCOPE,
  deleteTemplate: NO_MEAL_PLAN_REQUEST_SCOPE,
  completeRun: NO_MEAL_PLAN_REQUEST_SCOPE,
  discardRun: NO_MEAL_PLAN_REQUEST_SCOPE,
  syncOfflineRuns: NO_MEAL_PLAN_REQUEST_SCOPE,
  logWeighIn: NO_MEAL_PLAN_REQUEST_SCOPE,
  deleteWeighIn: NO_MEAL_PLAN_REQUEST_SCOPE,
  requestHealthPermissions: NO_MEAL_PLAN_REQUEST_SCOPE,
  logMealEntry: NO_MEAL_PLAN_REQUEST_SCOPE,
  updateMealEntry: NO_MEAL_PLAN_REQUEST_SCOPE,
  deleteMealEntry: NO_MEAL_PLAN_REQUEST_SCOPE,
  estimateMacros: NO_MEAL_PLAN_REQUEST_SCOPE,
  scanNutritionLabel: NO_MEAL_PLAN_REQUEST_SCOPE,
  createFood: NO_MEAL_PLAN_REQUEST_SCOPE,
  deleteFood: NO_MEAL_PLAN_REQUEST_SCOPE,
  updateAvatar: NO_MEAL_PLAN_REQUEST_SCOPE,
  // The setup saves: the finding's own case — a step or full-preferences save answering a confirmed
  // `503 feature_disabled` is signal (a) and must reach the session's verdict.
  saveSetupStep: GATED_RESOURCE_SCOPE,
  savePreferences: GATED_RESOURCE_SCOPE,
  // Exempt with its read: the Diary target editor writes targets while planning is off (AAP 0.3.1, 0.7.5).
  saveNutritionTargets: NO_MEAL_PLAN_REQUEST_SCOPE,
  generatePlan: GATED_RESOURCE_SCOPE,
  regeneratePlan: GATED_RESOURCE_SCOPE,
  swapMeal: GATED_RESOURCE_SCOPE,
  toggleGroceryItem: GATED_RESOURCE_SCOPE,
  uncheckAllGroceries: GATED_RESOURCE_SCOPE,
  logPlannedMeal: GATED_RESOURCE_SCOPE
}

// Every key is either a constant array or a factory, and only the first segment is classified, so the
// placeholder arguments below never reach the comparison.
const keyFrom = (declared: unknown): readonly unknown[] => {
  if (Array.isArray(declared)) {
    return declared
  }

  return (declared as (...args: unknown[]) => readonly unknown[])('placeholder', 'placeholder', 'placeholder', 1)
}

const declaredQueryKey = (name: string): readonly unknown[] =>
  keyFrom((queryKeys as unknown as Record<string, unknown>)[name])

const declaredMutationKey = (name: string): readonly unknown[] =>
  keyFrom((mutationKeys as unknown as Record<string, unknown>)[name])

describe('mealPlanRequestScopeForQueryKey', () => {
  it('classifies every query key the app declares, so a new one cannot go unclassified', () => {
    expect(Object.keys(expectedQueryScopes).sort()).toEqual(Object.keys(queryKeys).sort())
  })

  it.each(Object.keys(expectedQueryScopes))('classifies the %s query key', name => {
    expect(mealPlanRequestScopeForQueryKey(declaredQueryKey(name))).toEqual(expectedQueryScopes[name])
  })

  // The family root is what is classified, so the identifiers a factory appends cannot change the answer.
  it('classifies a gated family by its root, whatever identifiers follow', () => {
    expect(mealPlanRequestScopeForQueryKey(queryKeys.mealPlanDay('plan-1', SESSION_DAY_KEY))).toEqual(
      GATED_RESOURCE_SCOPE
    )
    expect(mealPlanRequestScopeForQueryKey(queryKeys.swapPreview('plan-1', 'meal-1', 'recipe-1', 3))).toEqual(
      GATED_RESOURCE_SCOPE
    )
  })

  it('leaves a root this release does not know outside the policy, in both directions', () => {
    expect(mealPlanRequestScopeForQueryKey(['somethingNew', 'plan-1'])).toBe(NO_MEAL_PLAN_REQUEST_SCOPE)
  })

  it('leaves a key with no segments, or a non-string root, outside the policy', () => {
    expect(mealPlanRequestScopeForQueryKey([])).toBe(NO_MEAL_PLAN_REQUEST_SCOPE)
    expect(mealPlanRequestScopeForQueryKey([42, 'plan-1'])).toBe(NO_MEAL_PLAN_REQUEST_SCOPE)
  })
})

describe('mealPlanRequestScopeForMutationKey', () => {
  it('classifies every mutation key the app declares, so a new one cannot go unclassified', () => {
    expect(Object.keys(expectedMutationScopes).sort()).toEqual(Object.keys(mutationKeys).sort())
  })

  it.each(Object.keys(expectedMutationScopes))('classifies the %s mutation key', name => {
    expect(mealPlanRequestScopeForMutationKey(declaredMutationKey(name))).toEqual(expectedMutationScopes[name])
  })

  // TanStack leaves `mutationKey` optional, and an unidentifiable mutation cannot be placed in the policy.
  it('leaves an unkeyed mutation outside the policy', () => {
    expect(mealPlanRequestScopeForMutationKey(undefined)).toBe(NO_MEAL_PLAN_REQUEST_SCOPE)
  })

  // No write is a routes probe: signal (b) is defined on the three resource-less GETs only (AAP 0.2.5).
  it('never reports a mutation as a routes probe', () => {
    Object.keys(expectedMutationScopes).forEach(name => {
      expect(mealPlanRequestScopeForMutationKey(declaredMutationKey(name)).isRoutesProbe).toBe(false)
    })
  })
})

describe('planMealPlanEntitlementQueries', () => {
  const flagOn: MealPlanEntitlementQueryPlanInputs = {
    isFlagEnabled: true,
    capabilityLatch: NO_MEAL_PLAN_CAPABILITY_LATCH,
    sessionDayKey: SESSION_DAY_KEY
  }

  const featureDisabledLatch: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: false}
  const routesMissingLatch: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: true}

  it('enables both gated reads while the flag is on and nothing is latched', () => {
    const plan = planMealPlanEntitlementQueries(flagOn)

    expect(plan.preferences.enabled).toBe(true)
    expect(plan.currentPlan.enabled).toBe(true)
  })

  // Dropping the key silently stops the plan rollover refetch, which is why it is asserted rather than assumed.
  it('hands the session day key to the current-plan read unchanged', () => {
    expect(planMealPlanEntitlementQueries(flagOn).currentPlan.sessionDayKey).toBe(SESSION_DAY_KEY)
  })

  it('still carries the day key while the gated reads are disabled, so re-enabling does not lose it', () => {
    const plan = planMealPlanEntitlementQueries({...flagOn, isFlagEnabled: false})

    expect(plan.currentPlan).toEqual({enabled: false, sessionDayKey: SESSION_DAY_KEY})
  })

  it('disables the gated reads while the Remote Config flag is off', () => {
    const plan = planMealPlanEntitlementQueries({...flagOn, isFlagEnabled: false})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  it('disables the gated reads once feature_disabled is latched', () => {
    const plan = planMealPlanEntitlementQueries({...flagOn, capabilityLatch: featureDisabledLatch})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  it('disables the gated reads once routes-missing is latched', () => {
    const plan = planMealPlanEntitlementQueries({...flagOn, capabilityLatch: routesMissingLatch})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  // Deduplication is TanStack's, not an election's: every mounted instance plans the same enabled reads, and
  // the cache answers them once.
  it('plans the same reads for every instance, because nothing elects one of them', () => {
    expect(planMealPlanEntitlementQueries(flagOn)).toEqual(planMealPlanEntitlementQueries({...flagOn}))
  })

  // The ungated targets read is the local-target fallback's supply line (AAP 0.7.5): no flag or latch state may
  // switch it off.
  it('keeps the targets read enabled in every flag and latch combination', () => {
    const latches: MealPlanCapabilityLatch[] = [NO_MEAL_PLAN_CAPABILITY_LATCH, featureDisabledLatch, routesMissingLatch]

    latches.forEach(capabilityLatch =>
      [true, false].forEach(isFlagEnabled => {
        const plan = planMealPlanEntitlementQueries({...flagOn, capabilityLatch, isFlagEnabled})

        expect(plan.targets.enabled).toBe(true)
      })
    )
  })
})

describe('hasMealPlan', () => {
  it('is true for an active current plan', () => {
    expect(hasMealPlan({current: makePlan(), upcoming: null})).toBe(true)
  })

  // A plan generated for tomorrow is visible the moment it exists: ignoring `upcoming` would send a user with
  // next week's plan back to the no-plan state.
  it('is true for an upcoming-only answer', () => {
    expect(hasMealPlan({current: null, upcoming: makePlan()})).toBe(true)
  })

  it('is true when both are present', () => {
    expect(hasMealPlan({current: makePlan(), upcoming: makePlan()})).toBe(true)
  })

  it('is false when the answer holds neither', () => {
    expect(hasMealPlan({current: null, upcoming: null})).toBe(false)
  })

  it('is false before the read has answered', () => {
    expect(hasMealPlan(undefined)).toBe(false)
  })
})
