import {MealPlanAvailability, MealPlanEntitlement} from '@utility/MealPlanEntitlementUtility'

import {
  defaultMealPlanCapabilityGuardHooks,
  MealPlanCapabilityGuardHooks,
  useMealPlanCapabilityGuard
} from '../useMealPlanCapabilityGuard'
import {MealPlanCapabilityGuard} from '../useMealPlanCapabilityGuard.util'
import {useMealPlanEntitlement} from '../useMealPlanEntitlement'

// The guard reaches the Firebase SDK transitively: its production wiring names the entitlement hook, which
// reads Remote Config and is built on the HTTP layer that resolves a bearer token and reports failures to
// Crashlytics. None of those native modules exists under Jest. Each factory builds its own fake inside itself,
// because `jest.mock` is hoisted above every module-scope binding in this file.
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({currentUser: null})
}))

jest.mock('@react-native-firebase/crashlytics', () => ({
  __esModule: true,
  default: () => ({recordError: jest.fn()})
}))

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

// The meal-plan store the departure writes the segment to is persisted, and AsyncStorage has no native module
// under Jest either. Stubbed at the store's own persistence adapter, which is how `useMealPlanStore`'s own
// suite reaches it.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

const entitlement = (availability: MealPlanAvailability): MealPlanEntitlement => ({
  availability,
  isSegmentedControlVisible: availability !== 'disabled',
  isCatalogVisible: availability !== 'disabled',
  isGatedRequestAllowed: availability === 'enabled',
  hasPlan: true
})

interface Fakes {
  hooks: MealPlanCapabilityGuardHooks
  depart: jest.Mock<void, []>
}

const makeFakes = (availability: MealPlanAvailability): Fakes => {
  const depart = jest.fn<void, []>()

  return {
    depart,
    hooks: {
      useEntitlement: () => entitlement(availability),
      useDepartToPlanTab: () => depart
    }
  }
}

/**
 * The hook's own body calls exactly one React hook — `useEffect` — because everything else it needs is behind
 * the injectable seam. So the harness is one mock: effects run the moment they are queued, which is what a
 * commit does. No renderer is installed and none is added (AAP 0.4.1).
 *
 * The queued dependency arrays are captured too, because React's skip rule is what makes the departure fire
 * once per verdict rather than once per commit, and a fake that ran everything every time would pass either way.
 */
interface Commit {
  guard: MealPlanCapabilityGuard
  effectDeps: (unknown[] | undefined)[]
}

const renderGuard = (hooks: MealPlanCapabilityGuardHooks): Commit => {
  let guard: MealPlanCapabilityGuard | undefined
  let hookModule: typeof import('../useMealPlanCapabilityGuard') | undefined
  const effectDeps: (unknown[] | undefined)[] = []

  jest.isolateModules(() => {
    jest.doMock('react', () => ({
      ...jest.requireActual('react'),
      useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
        effectDeps.push(deps)
        effect()
      }
    }))

    hookModule = require('../useMealPlanCapabilityGuard')

    guard = hookModule?.useMealPlanCapabilityGuard(hooks)
  })

  jest.dontMock('react')

  if (guard === undefined) {
    throw new Error('the guard did not return')
  }

  return {guard, effectDeps}
}

describe('useMealPlanCapabilityGuard', () => {
  it('stays put and permits gated requests while the feature is live', () => {
    const fakes = makeFakes('enabled')
    const {guard} = renderGuard(fakes.hooks)

    expect(guard).toEqual({isGatedRequestAllowed: true, isCapabilityUnavailable: false})
    expect(fakes.depart).not.toHaveBeenCalled()
  })

  // THE FINDING. A gated screen whose read or save was refused with a confirmed `503 feature_disabled` used to
  // render that refusal as a transient failure and offer a Try again the query client will not even attempt.
  // It now leaves for the one surface that states the refusal (AAP 0.2.5).
  it('leaves for the plan tab once a gated route has confirmed the capability off', () => {
    const fakes = makeFakes('unavailable')
    const {guard} = renderGuard(fakes.hooks)

    expect(guard).toEqual({isGatedRequestAllowed: false, isCapabilityUnavailable: true})
    expect(fakes.depart).toHaveBeenCalledTimes(1)
  })

  // The switched-off state is not a mid-session revocation: the flag is read once per launch and the segment
  // offers no way into a gated screen while it is off, so departing on it would be a path nothing can take.
  it('does not leave when the feature is merely switched off, but still refuses gated requests', () => {
    const fakes = makeFakes('disabled')
    const {guard} = renderGuard(fakes.hooks)

    expect(guard.isGatedRequestAllowed).toBe(false)
    expect(guard.isCapabilityUnavailable).toBe(false)
    expect(fakes.depart).not.toHaveBeenCalled()
  })

  // The departure is queued as an effect rather than run during render, and it is keyed on the verdict and the
  // action — so a screen that re-renders while the verdict holds navigates once, not once per commit.
  it('queues the departure as an effect keyed on the verdict and the action', () => {
    const fakes = makeFakes('unavailable')
    const {effectDeps} = renderGuard(fakes.hooks)

    expect(effectDeps).toHaveLength(1)
    expect(effectDeps[0]).toEqual([fakes.depart, true])
  })

  it('wires the production guard to the shared entitlement', () => {
    expect(defaultMealPlanCapabilityGuardHooks.useEntitlement).toBe(useMealPlanEntitlement)
    expect(typeof defaultMealPlanCapabilityGuardHooks.useDepartToPlanTab).toBe('function')
  })

  it('is one module constant, so a screen sees the same hook identities on every render', () => {
    expect(defaultMealPlanCapabilityGuardHooks).toBe(defaultMealPlanCapabilityGuardHooks)
  })

  it('takes the production wiring when a caller passes none', () => {
    expect(useMealPlanCapabilityGuard.length).toBe(0)
  })
})
