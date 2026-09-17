import remoteConfig from '@react-native-firebase/remote-config'
import {PACKAGED_MEAL_PLANNING_ENABLED} from '@utility/MealPlanEntitlementUtility'

import {
  getRemoteConfigActivation,
  initRemoteConfig,
  isMealPlanningEnabled,
  subscribeToRemoteConfigActivation
} from '../initRemoteConfig'

/**
 * The service half of the entitlement handoff: the packaged default it ships, and the one-shot broadcast that
 * tells a mounted consumer the single launch fetch has settled. Without that broadcast a first activation from
 * the packaged `false` to a console `true` reaches an already-rendered Macros or Add Food only through an
 * unrelated rerender.
 *
 * The fake SDK is built inside the `jest.mock` factory because the factory is hoisted above every module-scope
 * binding here, and the module under test is imported statically — a dynamic `import()` needs VM modules, which
 * this preset does not enable. `fakeState` is the fake's own mutable config, so a test can make an activation
 * actually change the value a consumer reads.
 */
jest.mock('@react-native-firebase/remote-config', () => {
  const fakeState = {minimumAppVersion: '1.4.3', valueSource: 'default', value: false, lastFetchStatus: 'no_fetch_yet'}

  const instance = {
    fakeState,
    setDefaults: jest.fn(),
    setConfigSettings: jest.fn(),
    onConfigUpdated: jest.fn(),
    fetchAndActivate: jest.fn(() => Promise.resolve(false)),
    getValue: jest.fn((key: string) => ({
      asString: () => (key === 'minimum_app_version' ? fakeState.minimumAppVersion : ''),
      asBoolean: () => fakeState.value,
      getSource: () => fakeState.valueSource
    })),
    get lastFetchStatus() {
      return fakeState.lastFetchStatus
    }
  }

  return {__esModule: true, default: () => instance}
})

interface RemoteConfigFake {
  fakeState: {minimumAppVersion: string; valueSource: string; value: boolean; lastFetchStatus: string}
  setDefaults: jest.Mock
  setConfigSettings: jest.Mock
  onConfigUpdated: jest.Mock
  fetchAndActivate: jest.Mock
  getValue: jest.Mock
}

const MINIMUM_FETCH_INTERVAL_MS = 900_000

const sdk = remoteConfig() as unknown as RemoteConfigFake

const activateConsoleValue = (value: boolean): void => {
  sdk.fakeState.valueSource = 'remote'
  sdk.fakeState.value = value
  sdk.fakeState.lastFetchStatus = 'success'
}

const resetFakeConfig = (): void => {
  sdk.fakeState.valueSource = 'default'
  sdk.fakeState.value = false
  sdk.fakeState.lastFetchStatus = 'no_fetch_yet'
}

afterEach(() => {
  sdk.fetchAndActivate.mockReset()
  sdk.fetchAndActivate.mockImplementation(() => Promise.resolve(false))
  resetFakeConfig()
})

describe('the packaged configuration', () => {
  // The packaged default has exactly one definition: the entitlement resolver reads the same constant for every
  // non-remote value source, so a literal written here could drift from the policy that interprets it.
  it('ships the meal-planning default from the entitlement policy that owns it', () => {
    expect(sdk.setDefaults).toHaveBeenCalledTimes(1)
    expect(sdk.setDefaults).toHaveBeenCalledWith(
      expect.objectContaining({meal_planning_enabled: PACKAGED_MEAL_PLANNING_ENABLED})
    )
  })

  // One launch fetch, throttled to 15 minutes, is the whole of the fetch policy (AAP 0.7.5): a console change
  // reaches a device on its next cold start, not while it stays in the foreground.
  it('sets the 15-minute minimum fetch interval once and configures nothing else', () => {
    expect(sdk.setConfigSettings).toHaveBeenCalledTimes(1)
    expect(sdk.setConfigSettings).toHaveBeenCalledWith({minimumFetchIntervalMillis: MINIMUM_FETCH_INTERVAL_MS})
  })

  it('registers no SDK config-update listener, so no foreground refresh exists', () => {
    expect(sdk.onConfigUpdated).not.toHaveBeenCalled()
  })
})

describe('the activation broadcast', () => {
  // Declared before any case that fetches: the module's activation state is process-wide, and this is the only
  // assertion that depends on its starting value. Every case below compares against the epoch it read itself.
  it('starts unsettled, because a process that has not fetched has activated nothing', () => {
    expect(getRemoteConfigActivation()).toEqual({epoch: 0, isSettled: false})
  })

  it('notifies every subscriber once when the launch fetch succeeds', async () => {
    const first = jest.fn()
    const second = jest.fn()
    const unsubscribeFirst = subscribeToRemoteConfigActivation(first)
    const unsubscribeSecond = subscribeToRemoteConfigActivation(second)

    sdk.fetchAndActivate.mockImplementation(() => Promise.resolve(true))

    await initRemoteConfig()
    unsubscribeFirst()
    unsubscribeSecond()

    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  // A failed fetch settles the launch state just as much as a successful one: the last activated value, or the
  // packaged default, is now the answer, and a consumer waiting on the launch must stop waiting.
  it('notifies once when the launch fetch fails', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToRemoteConfigActivation(listener)

    sdk.fetchAndActivate.mockImplementation(() => Promise.reject(new Error('fetch failed')))

    await expect(initRemoteConfig()).rejects.toThrow('fetch failed')
    unsubscribe()

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('marks the activation settled and advances the epoch exactly once per launch fetch', async () => {
    const before = getRemoteConfigActivation().epoch

    await initRemoteConfig()

    expect(getRemoteConfigActivation()).toEqual({epoch: before + 1, isSettled: true})
  })

  it('advances the epoch once for a failed fetch too', async () => {
    const before = getRemoteConfigActivation().epoch

    sdk.fetchAndActivate.mockImplementation(() => Promise.reject(new Error('offline')))

    await expect(initRemoteConfig()).rejects.toThrow('offline')

    expect(getRemoteConfigActivation().epoch).toBe(before + 1)
  })

  // Identity, because the consumer reads this through `useSyncExternalStore`: a fresh object per read would
  // re-render every entitlement consumer forever.
  it('keeps the same activation object between activations', () => {
    expect(getRemoteConfigActivation()).toBe(getRemoteConfigActivation())
  })

  it('replaces the activation object when a new one settles', async () => {
    const before = getRemoteConfigActivation()

    await initRemoteConfig()

    expect(getRemoteConfigActivation()).not.toBe(before)
  })

  it('stops notifying a listener that unsubscribed', async () => {
    const listener = jest.fn()
    const unsubscribe = subscribeToRemoteConfigActivation(listener)

    unsubscribe()

    await initRemoteConfig()

    expect(listener).not.toHaveBeenCalled()
  })

  it('performs exactly one fetch per call and adds none of its own', async () => {
    await initRemoteConfig()

    expect(sdk.fetchAndActivate).toHaveBeenCalledTimes(1)
  })

  it("resolves to the SDK's own activation verdict", async () => {
    sdk.fetchAndActivate.mockImplementation(() => Promise.resolve(true))

    await expect(initRemoteConfig()).resolves.toBe(true)
  })

  // The defect this broadcast exists for: the flag is sampled synchronously during render, so the first
  // activation from the packaged `false` to a console `true` has to arrive as a notification.
  it('lets a subscriber observe the flag flip from the packaged default to the activated console value', async () => {
    const observed: boolean[] = []

    const unsubscribe = subscribeToRemoteConfigActivation(() => observed.push(isMealPlanningEnabled()))

    expect(isMealPlanningEnabled()).toBe(PACKAGED_MEAL_PLANNING_ENABLED)

    sdk.fetchAndActivate.mockImplementation(() => {
      activateConsoleValue(true)

      return Promise.resolve(true)
    })

    await initRemoteConfig()
    unsubscribe()

    expect(observed).toEqual([true])
  })

  it('lets a subscriber observe a fetched kill-switch disable', async () => {
    activateConsoleValue(true)

    const observed: boolean[] = []

    const unsubscribe = subscribeToRemoteConfigActivation(() => observed.push(isMealPlanningEnabled()))

    sdk.fetchAndActivate.mockImplementation(() => {
      activateConsoleValue(false)

      return Promise.resolve(true)
    })

    await initRemoteConfig()
    unsubscribe()

    expect(observed).toEqual([false])
  })
})
