import {MealPlan} from '@data/models/MealPlan'
import * as EntitlementPolicy from '@utility/MealPlanEntitlementUtility'

import * as HookEntitlementSurface from '../useMealPlanEntitlement.util'
import {
  createMealPlanEntitlementSessionStore,
  deriveMealPlanCapabilitySignals,
  hasMealPlan,
  httpStatusOf,
  isFeatureDisabledError,
  isRoutesMissingError,
  MealPlanAvailability,
  MealPlanCapabilityLatch,
  MealPlanCapabilitySignals,
  MealPlanEntitlement,
  MealPlanEntitlementInputs,
  MealPlanEntitlementQueryPlanInputs,
  MealPlanningFlagInputs,
  mergeMealPlanCapabilityLatch,
  NO_MEAL_PLAN_CAPABILITY_LATCH,
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
 * already permits. Policy behaviour assertions belong with the owner and are deliberately absent here.
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
  [
    'deriveMealPlanCapabilitySignals',
    deriveMealPlanCapabilitySignals,
    EntitlementPolicy.deriveMealPlanCapabilitySignals
  ],
  ['mergeMealPlanCapabilityLatch', mergeMealPlanCapabilityLatch, EntitlementPolicy.mergeMealPlanCapabilityLatch]
]

/**
 * The complete list of names this file may hold that the utility does not: the hook's own wiring, none of which
 * decides entitlement. Anything else appearing here is a policy rule that has been forked.
 */
const hookWiringExports = ['createMealPlanEntitlementSessionStore', 'planMealPlanEntitlementQueries', 'hasMealPlan']

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
  // cannot be forked into the hook tree under a new name.
  it('adds exactly the enumerated hook-wiring helpers beyond the re-exports', () => {
    const addedNames = Object.keys(HookEntitlementSurface).filter(name => !(name in EntitlementPolicy))

    expect(addedNames.sort()).toEqual([...hookWiringExports].sort())
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

describe('planMealPlanEntitlementQueries', () => {
  const leadWithFlagOn: MealPlanEntitlementQueryPlanInputs = {
    isFlagEnabled: true,
    isLead: true,
    capabilityLatch: NO_MEAL_PLAN_CAPABILITY_LATCH,
    sessionDayKey: SESSION_DAY_KEY
  }

  const featureDisabledLatch: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: false}
  const routesMissingLatch: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: true}

  it('enables both gated reads for the lead while the flag is on and nothing is latched', () => {
    const plan = planMealPlanEntitlementQueries(leadWithFlagOn)

    expect(plan.preferences.enabled).toBe(true)
    expect(plan.currentPlan.enabled).toBe(true)
  })

  // Dropping the key silently stops the plan rollover refetch, which is why it is asserted rather than assumed.
  it('hands the session day key to the current-plan read unchanged', () => {
    expect(planMealPlanEntitlementQueries(leadWithFlagOn).currentPlan.sessionDayKey).toBe(SESSION_DAY_KEY)
  })

  it('still carries the day key while the gated reads are disabled, so re-enabling does not lose it', () => {
    const plan = planMealPlanEntitlementQueries({...leadWithFlagOn, isFlagEnabled: false})

    expect(plan.currentPlan).toEqual({enabled: false, sessionDayKey: SESSION_DAY_KEY})
  })

  it('disables the gated reads while the Remote Config flag is off', () => {
    const plan = planMealPlanEntitlementQueries({...leadWithFlagOn, isFlagEnabled: false})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  // The deduplication half: a follower reads the lead's cache entries through disabled observers, so three
  // mounted instances issue one set of requests rather than three.
  it('disables the gated reads for a follower instance', () => {
    const plan = planMealPlanEntitlementQueries({...leadWithFlagOn, isLead: false})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  it('disables the gated reads once feature_disabled is latched', () => {
    const plan = planMealPlanEntitlementQueries({...leadWithFlagOn, capabilityLatch: featureDisabledLatch})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  it('disables the gated reads once routes-missing is latched', () => {
    const plan = planMealPlanEntitlementQueries({...leadWithFlagOn, capabilityLatch: routesMissingLatch})

    expect(plan.preferences.enabled).toBe(false)
    expect(plan.currentPlan.enabled).toBe(false)
  })

  // The ungated targets read is the local-target fallback's supply line (AAP 0.7.5): no flag, latch or lead
  // state may switch it off.
  it('keeps the targets read enabled in every flag, lead and latch combination', () => {
    const latches: MealPlanCapabilityLatch[] = [NO_MEAL_PLAN_CAPABILITY_LATCH, featureDisabledLatch, routesMissingLatch]
    const booleans = [true, false]

    latches.forEach(capabilityLatch =>
      booleans.forEach(isFlagEnabled =>
        booleans.forEach(isLead => {
          const plan = planMealPlanEntitlementQueries({...leadWithFlagOn, capabilityLatch, isFlagEnabled, isLead})

          expect(plan.targets.enabled).toBe(true)
        })
      )
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

describe('createMealPlanEntitlementSessionStore', () => {
  const noSignals: MealPlanCapabilitySignals = {isFeatureDisabled: false, areRoutesMissing: false}
  const featureDisabledSignals: MealPlanCapabilitySignals = {isFeatureDisabled: true, areRoutesMissing: false}
  const routesMissingSignals: MealPlanCapabilitySignals = {isFeatureDisabled: false, areRoutesMissing: true}

  it('starts with no lead and nothing latched', () => {
    const store = createMealPlanEntitlementSessionStore()

    expect(store.getSnapshot()).toEqual({leadId: null, capabilityLatch: NO_MEAL_PLAN_CAPABILITY_LATCH})
  })

  it('elects the first instance that registers', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(7)

    expect(store.getSnapshot().leadId).toBe(7)
  })

  // Smallest id wins, and the hook hands ids out in render order, so the lead is the longest-lived instance
  // whatever order the effects run in.
  it('elects the smallest registered id regardless of registration order', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(4)
    store.registerInstance(2)
    store.registerInstance(9)

    expect(store.getSnapshot().leadId).toBe(2)
  })

  it('keeps the lead when a later instance registers, so the lead does not churn', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(1)

    const listener = jest.fn()

    store.subscribe(listener)
    store.registerInstance(5)

    expect(store.getSnapshot().leadId).toBe(1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('transfers the lead to the next smallest id when the lead is released', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(1)
    store.registerInstance(5)
    store.releaseInstance(1)

    expect(store.getSnapshot().leadId).toBe(5)
  })

  it('reports no lead once every instance has been released', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(1)
    store.releaseInstance(1)

    expect(store.getSnapshot().leadId).toBeNull()
  })

  it('ignores the release of an instance that never registered', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(3)

    const listener = jest.fn()

    store.subscribe(listener)
    store.releaseInstance(42)

    expect(store.getSnapshot().leadId).toBe(3)
    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies subscribers when the lead changes', () => {
    const store = createMealPlanEntitlementSessionStore()
    const listener = jest.fn()

    store.subscribe(listener)
    store.registerInstance(1)

    expect(listener).toHaveBeenCalledTimes(1)
  })

  // Identity, because `useSyncExternalStore` re-renders every consumer on a fresh snapshot reference.
  it('keeps the very same snapshot object while nothing changes', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(1)

    const snapshot = store.getSnapshot()

    store.registerInstance(2)
    store.recordCapabilitySignals(noSignals)
    store.resetCapabilityLatch()

    expect(store.getSnapshot()).toBe(snapshot)
  })

  it('records a signal into the latch and notifies once', () => {
    const store = createMealPlanEntitlementSessionStore()
    const listener = jest.fn()

    store.subscribe(listener)
    store.recordCapabilitySignals(featureDisabledSignals)

    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('accumulates the two signals across separate records', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.recordCapabilitySignals(featureDisabledSignals)
    store.recordCapabilitySignals(routesMissingSignals)

    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: true, areRoutesMissing: true})
  })

  it('does not notify when the recorded signals add nothing to the latch', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.recordCapabilitySignals(featureDisabledSignals)

    const listener = jest.fn()

    store.subscribe(listener)
    store.recordCapabilitySignals(featureDisabledSignals)
    store.recordCapabilitySignals(noSignals)

    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps the elected lead when signals are recorded', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.registerInstance(3)
    store.recordCapabilitySignals(routesMissingSignals)

    expect(store.getSnapshot().leadId).toBe(3)
  })

  // The forward-recovery release: a cleared latch is what lets an operator re-enable be re-probed once.
  it('clears a latched verdict on reset and notifies', () => {
    const store = createMealPlanEntitlementSessionStore()

    store.recordCapabilitySignals(routesMissingSignals)

    const listener = jest.fn()

    store.subscribe(listener)
    store.resetCapabilityLatch()

    expect(store.getSnapshot().capabilityLatch).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('does not notify when a reset finds nothing latched', () => {
    const store = createMealPlanEntitlementSessionStore()
    const listener = jest.fn()

    store.subscribe(listener)
    store.resetCapabilityLatch()

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops notifying an unsubscribed listener', () => {
    const store = createMealPlanEntitlementSessionStore()
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)

    unsubscribe()
    store.registerInstance(1)
    store.recordCapabilitySignals(routesMissingSignals)

    expect(listener).not.toHaveBeenCalled()
  })

  it('notifies every current subscriber', () => {
    const store = createMealPlanEntitlementSessionStore()
    const first = jest.fn()
    const second = jest.fn()

    store.subscribe(first)
    store.subscribe(second)
    store.registerInstance(1)

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  // The factory holds no shared state of its own, which is what lets a test own a store instead of resetting a
  // module singleton.
  it('builds independent stores', () => {
    const first = createMealPlanEntitlementSessionStore()
    const second = createMealPlanEntitlementSessionStore()

    first.registerInstance(1)
    first.recordCapabilitySignals(routesMissingSignals)

    expect(second.getSnapshot()).toEqual({leadId: null, capabilityLatch: NO_MEAL_PLAN_CAPABILITY_LATCH})
  })
})
