import {queryKeys} from '@queries/keys'
import {QueryClient} from '@tanstack/react-query'
import {
  MealPlanCapabilityLatch,
  MealPlanCapabilityRecord,
  NO_MEAL_PLAN_CAPABILITY_LATCH
} from '@utility/MealPlanEntitlementUtility'

import {
  defaultMealPlanGatedRequestHooks,
  MealPlanGatedRequestHooks,
  readMealPlanCapabilityLatch,
  readMealPlanCapabilityRecord,
  useMealPlanCapabilityLatch,
  useMealPlanFlagEnabled,
  useMealPlanGatedRequestAllowed
} from '../useMealPlanGatedRequestAllowed'

// This module reads the Remote Config flag, and the service it reads it from reaches the Firebase SDK on the
// way in; no native module exists under Jest. Each factory builds its fake inside itself because `jest.mock`
// is hoisted above every module-scope binding in this file.
jest.mock('@react-native-firebase/remote-config', () => {
  const instance = {
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    fetchAndActivate: jest.fn(() => Promise.resolve(false)),
    getValue: jest.fn(() => ({
      asString: () => '',
      asBoolean: () => false,
      getSource: () => 'default'
    })),
    lastFetchStatus: 'no_fetch_yet'
  }

  return {__esModule: true, default: () => instance}
})

/**
 * The gate every route-scoped meal-planning read now derives for itself.
 *
 * It is exercised through its injectable `MealPlanGatedRequestHooks` rather than a renderer, because no
 * renderer or Testing Library is installed (AAP 0.4.1) and the two real hooks are `useSyncExternalStore` calls
 * that need a dispatcher. What is worth pinning here is the composition and the wiring: that the flag and the
 * latch are both consulted, that neither one alone can open the gate, and that the production object really
 * points at the two real hooks — a fake-only test would pass while the app read nothing.
 */

const latch = (overrides: Partial<MealPlanCapabilityLatch> = {}): MealPlanCapabilityLatch => ({
  ...NO_MEAL_PLAN_CAPABILITY_LATCH,
  ...overrides
})

const hooksFor = (isFlagEnabled: boolean, capabilityLatch: MealPlanCapabilityLatch): MealPlanGatedRequestHooks => ({
  useFlagEnabled: () => isFlagEnabled,
  useCapabilityLatch: () => capabilityLatch
})

describe('useMealPlanGatedRequestAllowed', () => {
  it('allows the read when the flag is on and nothing has been refused', () => {
    expect(useMealPlanGatedRequestAllowed(hooksFor(true, latch()))).toBe(true)
  })

  it('refuses the read while the flag is off, whatever the session has learned', () => {
    expect(useMealPlanGatedRequestAllowed(hooksFor(false, latch()))).toBe(false)
    expect(useMealPlanGatedRequestAllowed(hooksFor(false, latch({isFeatureDisabled: true})))).toBe(false)
  })

  it('refuses the read for the rest of the session once a gated route answered feature_disabled', () => {
    expect(useMealPlanGatedRequestAllowed(hooksFor(true, latch({isFeatureDisabled: true})))).toBe(false)
  })

  it('refuses the read once the routes themselves answered as missing, which is the other unavailability signal', () => {
    expect(useMealPlanGatedRequestAllowed(hooksFor(true, latch({areRoutesMissing: true})))).toBe(false)
  })

  it('reads BOTH inputs on every call, so neither can be dropped without a case failing', () => {
    const hooks = {useFlagEnabled: jest.fn(() => true), useCapabilityLatch: jest.fn(() => latch())}

    useMealPlanGatedRequestAllowed(hooks)

    expect(hooks.useFlagEnabled).toHaveBeenCalledTimes(1)
    expect(hooks.useCapabilityLatch).toHaveBeenCalledTimes(1)
  })

  it('wires the production object to the two real hooks, so the app reads the flag and the latch it asserts on', () => {
    expect(defaultMealPlanGatedRequestHooks.useFlagEnabled).toBe(useMealPlanFlagEnabled)
    expect(defaultMealPlanGatedRequestHooks.useCapabilityLatch).toBe(useMealPlanCapabilityLatch)
  })
})

describe('the capability verdict read out of the query cache', () => {
  let queryClient: QueryClient

  const record = (value: MealPlanCapabilityRecord): void => {
    queryClient.setQueryData(queryKeys.mealPlanCapability, value)
  }

  beforeEach(() => {
    queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('finds no record before anything has been refused', () => {
    expect(readMealPlanCapabilityRecord(queryClient)).toBeUndefined()
  })

  it('answers the shared no-latch constant for an absent record, so the snapshot identity is stable', () => {
    // Referential, not structural: the latch is published through `useSyncExternalStore`, which re-renders
    // every consumer whenever the snapshot changes identity. A fresh object per read would never settle.
    expect(readMealPlanCapabilityLatch(queryClient)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
    expect(readMealPlanCapabilityLatch(queryClient)).toBe(readMealPlanCapabilityLatch(queryClient))
  })

  it('reads the recorded latch out of the entry the entitlement writes', () => {
    const recorded = latch({isFeatureDisabled: true})

    record({activationEpoch: 1, latch: recorded})

    expect(readMealPlanCapabilityRecord(queryClient)).toStrictEqual({activationEpoch: 1, latch: recorded})
    expect(readMealPlanCapabilityLatch(queryClient)).toBe(recorded)
  })

  it('reads the key through queryKeys.mealPlanCapability rather than a literal of the same shape', () => {
    const recorded = latch({areRoutesMissing: true})

    record({activationEpoch: 2, latch: recorded})
    queryClient.removeQueries({queryKey: queryKeys.mealPlanCapability})

    expect(readMealPlanCapabilityLatch(queryClient)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('composes with the gate, so a recorded refusal closes it', () => {
    record({activationEpoch: 1, latch: latch({isFeatureDisabled: true})})

    const hooks = hooksFor(true, readMealPlanCapabilityLatch(queryClient))

    expect(useMealPlanGatedRequestAllowed(hooks)).toBe(false)
  })
})
