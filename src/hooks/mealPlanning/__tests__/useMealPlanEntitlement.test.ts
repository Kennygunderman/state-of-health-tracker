import {CurrentMealPlans, MealPlan} from '@data/models/MealPlan'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {
  defaultMealPlanEntitlementHooks,
  MealPlanEntitlementHooks,
  resetMealPlanCapabilityLatch,
  useMealPlanEntitlement
} from '../useMealPlanEntitlement'
import {
  createMealPlanEntitlementSessionStore,
  deriveMealPlanCapabilitySignals,
  MealPlanCapabilityErrors,
  MealPlanCapabilityLatch,
  MealPlanEntitlementSessionStore,
  NO_MEAL_PLAN_CAPABILITY_LATCH,
  RoutesMissingError
} from '../useMealPlanEntitlement.util'

// The hook module reaches the Firebase SDK on the way in — the Remote Config service it reads the flag from,
// and the HTTP layer the three query hooks are built on, which resolves a bearer token and reports its failures
// to Crashlytics — and none of those native modules exists under Jest. Every factory builds its fake inside
// itself because `jest.mock` is hoisted above every module-scope binding in this file.
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

/**
 * The hook's wiring, which the re-export contract beside this file cannot see: whether the session day key
 * reaches the current-plan read, whether the ungated targets read stays ungated, which reads a follower or a
 * latched session is allowed to issue, and whether the errors it classifies are the ones it was given.
 *
 * It is exercised through the hook's injectable `MealPlanEntitlementHooks` rather than a renderer, because no
 * renderer or Testing Library is installed and AAP 0.4.1 keeps it that way. Every member of that object is a
 * `jest.fn`, so the shell runs with no React dispatcher and each read's arguments are recorded exactly as the
 * shell passed them.
 */
const SESSION_DAY_KEY = '2026-07-05'

const TARGETS_PATH = '/meal-planning/targets'

const makeApiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const featureDisabledError = makeApiError(503, API_ERROR_CODES.featureDisabled)

const bareNotFoundError = makeApiError(404)

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

interface FakeOptions {
  isFlagEnabled?: boolean
  isLead?: boolean
  capabilityLatch?: MealPlanCapabilityLatch
  sessionDayKey?: string
  plans?: CurrentMealPlans
  preferencesError?: unknown
  currentPlanError?: unknown
  targetsError?: unknown
}

interface Fakes {
  hooks: MealPlanEntitlementHooks
  useFlagEnabled: jest.Mock
  useSessionDayKey: jest.Mock
  usePreferencesRead: jest.Mock
  useCurrentPlanRead: jest.Mock
  useTargetsRead: jest.Mock
  useRecordedCapabilitySignals: jest.Mock
}

const makeFakes = (options: FakeOptions = {}): Fakes => {
  const {
    isFlagEnabled = true,
    isLead = true,
    capabilityLatch = NO_MEAL_PLAN_CAPABILITY_LATCH,
    sessionDayKey = SESSION_DAY_KEY,
    plans,
    preferencesError,
    currentPlanError,
    targetsError
  } = options

  const useFlagEnabled = jest.fn(() => isFlagEnabled)
  const useSessionParticipation = jest.fn(() => ({isLead, capabilityLatch}))
  const useSessionDayKey = jest.fn(() => sessionDayKey)
  const usePreferencesRead = jest.fn(() => ({error: preferencesError}))
  const useCurrentPlanRead = jest.fn(() => ({data: plans, error: currentPlanError}))
  const useTargetsRead = jest.fn(() => ({error: targetsError}))
  const useRecordedCapabilitySignals = jest.fn()

  return {
    hooks: {
      useFlagEnabled,
      useSessionParticipation,
      useSessionDayKey,
      usePreferencesRead,
      useCurrentPlanRead,
      useTargetsRead,
      useRecordedCapabilitySignals
    },
    useFlagEnabled,
    useSessionDayKey,
    usePreferencesRead,
    useCurrentPlanRead,
    useTargetsRead,
    useRecordedCapabilitySignals
  }
}

// The production default hooks share one process-wide session store, so a case that ever reaches them starts
// from a clean session rather than from whatever an earlier import recorded.
beforeEach(() => {
  resetMealPlanCapabilityLatch()
})

describe('defaultMealPlanEntitlementHooks', () => {
  // The production wiring reuses the three existing query hooks: no second observer is built for a key that
  // already has one, and the targets hook is the ungated one by identity rather than by resemblance.
  it('reads through the existing query hooks rather than observers of its own', () => {
    expect(defaultMealPlanEntitlementHooks.usePreferencesRead).toBe(useMealPlanPreferencesQuery)
    expect(defaultMealPlanEntitlementHooks.useCurrentPlanRead).toBe(useCurrentMealPlanQuery)
    expect(defaultMealPlanEntitlementHooks.useTargetsRead).toBe(useNutritionTargetsQuery)
  })

  it('is one module constant, so the shell sees the same hook identities on every render', () => {
    expect(defaultMealPlanEntitlementHooks).toBe(defaultMealPlanEntitlementHooks)
  })
})

describe('useMealPlanEntitlement query wiring', () => {
  it('hands the session day key to the current-plan read unchanged', () => {
    const fakes = makeFakes()

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.useSessionDayKey).toHaveBeenCalledTimes(1)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(true, SESSION_DAY_KEY)
  })

  it('hands through whatever day key the session holds, including after a rollover', () => {
    const fakes = makeFakes({sessionDayKey: '2026-07-06'})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(true, '2026-07-06')
  })

  it('keeps the day key while the gated reads are disabled', () => {
    const fakes = makeFakes({isFlagEnabled: false})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  it('enables both gated reads for the lead while the flag is on and nothing is latched', () => {
    const fakes = makeFakes()

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(true)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(true, SESSION_DAY_KEY)
  })

  it('disables both gated reads while the Remote Config flag is off', () => {
    const fakes = makeFakes({isFlagEnabled: false})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  it('disables both gated reads for a follower instance', () => {
    const fakes = makeFakes({isLead: false})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  it('disables both gated reads once feature_disabled is latched', () => {
    const fakes = makeFakes({capabilityLatch: {isFeatureDisabled: true, areRoutesMissing: false}})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  it('disables both gated reads once routes-missing is latched', () => {
    const fakes = makeFakes({capabilityLatch: {isFeatureDisabled: false, areRoutesMissing: true}})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  // The targets read carries the local-target fallback of AAP 0.7.5, so it is called with no gate at all — not
  // with `true`, which a later change could flip.
  it('calls the targets read with no argument in every flag, lead and latch state', () => {
    const states: FakeOptions[] = [
      {},
      {isFlagEnabled: false},
      {isLead: false},
      {capabilityLatch: {isFeatureDisabled: true, areRoutesMissing: false}},
      {capabilityLatch: {isFeatureDisabled: false, areRoutesMissing: true}},
      {isFlagEnabled: false, isLead: false, capabilityLatch: {isFeatureDisabled: true, areRoutesMissing: true}}
    ]

    states.forEach(state => {
      const fakes = makeFakes(state)

      useMealPlanEntitlement(fakes.hooks)

      expect(fakes.useTargetsRead).toHaveBeenCalledTimes(1)
      expect(fakes.useTargetsRead.mock.calls[0]).toEqual([])
    })
  })

  it('reads the flag once per invocation', () => {
    const fakes = makeFakes()

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.useFlagEnabled).toHaveBeenCalledTimes(1)
  })
})

describe('useMealPlanEntitlement hasPlan', () => {
  it('is true for an active current plan', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({plans: {current: makePlan(), upcoming: null}}).hooks)

    expect(entitlement.hasPlan).toBe(true)
  })

  // The case the hook must not drop: a plan generated for tomorrow is a plan.
  it('is true for an upcoming-only answer', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({plans: {current: null, upcoming: makePlan()}}).hooks)

    expect(entitlement.hasPlan).toBe(true)
  })

  it('is false when the answer holds neither plan', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({plans: {current: null, upcoming: null}}).hooks)

    expect(entitlement.hasPlan).toBe(false)
  })

  it('is false before the current-plan read has answered', () => {
    expect(useMealPlanEntitlement(makeFakes().hooks).hasPlan).toBe(false)
  })
})

describe('useMealPlanEntitlement error classification', () => {
  it('is enabled with gated requests allowed when no read failed', () => {
    const entitlement = useMealPlanEntitlement(makeFakes().hooks)

    expect(entitlement).toEqual({
      availability: 'enabled',
      isSegmentedControlVisible: true,
      isCatalogVisible: true,
      isGatedRequestAllowed: true,
      hasPlan: false
    })
  })

  // Signal (a): the backend is mounted with server-side planning off, so the Meal Plan segment goes to its
  // unavailable card, Add Food keeps its Catalog section (`/catalog/*` is never gated, AAP 0.9.4) and no further
  // gated request may be issued.
  it('maps a 503 feature_disabled on the preferences read to unavailable with the catalog kept', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({preferencesError: featureDisabledError}).hooks)

    expect(entitlement).toEqual({
      availability: 'unavailable',
      isSegmentedControlVisible: true,
      isCatalogVisible: true,
      isGatedRequestAllowed: false,
      hasPlan: false
    })
  })

  it('maps a 503 feature_disabled on the current-plan read the same way', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({currentPlanError: featureDisabledError}).hooks)

    expect(entitlement.availability).toBe('unavailable')
    expect(entitlement.isCatalogVisible).toBe(true)
    expect(entitlement.isGatedRequestAllowed).toBe(false)
  })

  // The targets route is ungated, so its 503 says nothing about the feature — the wiring must not read it as a
  // capability signal.
  it('stays enabled when only the ungated targets read reports feature_disabled', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({targetsError: featureDisabledError}).hooks)

    expect(entitlement.availability).toBe('enabled')
    expect(entitlement.isGatedRequestAllowed).toBe(true)
  })

  // Signal (b): a rolled-back backend has no meal-planning routes at all, the targets one included.
  it('maps a bare 404 on the targets read to unavailable with the catalog hidden', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({targetsError: bareNotFoundError}).hooks)

    expect(entitlement).toEqual({
      availability: 'unavailable',
      isSegmentedControlVisible: true,
      isCatalogVisible: false,
      isGatedRequestAllowed: false,
      hasPlan: false
    })
  })

  it('maps the typed RoutesMissingError the targets read throws the same way', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({targetsError: new RoutesMissingError(TARGETS_PATH)}).hooks)

    expect(entitlement.availability).toBe('unavailable')
    expect(entitlement.isCatalogVisible).toBe(false)
    expect(entitlement.isGatedRequestAllowed).toBe(false)
  })

  it('stays enabled for a resource 404 that carries a decodable code', () => {
    const fakes = makeFakes({currentPlanError: makeApiError(404, API_ERROR_CODES.planNotActive)})

    expect(useMealPlanEntitlement(fakes.hooks).availability).toBe('enabled')
  })

  it('is disabled with nothing visible while the Remote Config flag is off', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({isFlagEnabled: false}).hooks)

    expect(entitlement).toEqual({
      availability: 'disabled',
      isSegmentedControlVisible: false,
      isCatalogVisible: false,
      isGatedRequestAllowed: false,
      hasPlan: false
    })
  })

  it('is unavailable from the latch alone, with no live error to read', () => {
    const fakes = makeFakes({capabilityLatch: {isFeatureDisabled: false, areRoutesMissing: true}})
    const entitlement = useMealPlanEntitlement(fakes.hooks)

    expect(entitlement.availability).toBe('unavailable')
    expect(entitlement.isCatalogVisible).toBe(false)
    expect(entitlement.isGatedRequestAllowed).toBe(false)
  })
})

describe('useMealPlanEntitlement capability recording', () => {
  it('hands the three reads errors to the recorder exactly as it read them', () => {
    const targetsError = new RoutesMissingError(TARGETS_PATH)
    const fakes = makeFakes({preferencesError: featureDisabledError, targetsError})

    useMealPlanEntitlement(fakes.hooks)

    const expected: MealPlanCapabilityErrors = {
      preferencesError: featureDisabledError,
      currentPlanError: undefined,
      targetsError
    }

    expect(fakes.useRecordedCapabilitySignals).toHaveBeenCalledTimes(1)
    expect(fakes.useRecordedCapabilitySignals).toHaveBeenCalledWith(expected)
  })

  // The whole loop, with the real session store and the real classifier standing in for the production effect:
  // a terminal 503 seen on one invocation must be latched and must disable the gated reads on the next one, so a
  // remount, a focus or a reconnect issues no further probe.
  it('latches a terminal signal so the next invocation issues no gated read', () => {
    const store = createMealPlanEntitlementSessionStore()
    const hooksFor = (preferencesError: unknown): Fakes => {
      const fakes = makeFakes({preferencesError, capabilityLatch: store.getSnapshot().capabilityLatch})

      fakes.hooks.useRecordedCapabilitySignals = errors =>
        store.recordCapabilitySignals(deriveMealPlanCapabilitySignals(errors))

      return fakes
    }

    const first = hooksFor(featureDisabledError)

    expect(useMealPlanEntitlement(first.hooks).isGatedRequestAllowed).toBe(false)
    expect(first.usePreferencesRead).toHaveBeenCalledWith(true)
    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: true, areRoutesMissing: false})

    const second = hooksFor(undefined)
    const entitlement = useMealPlanEntitlement(second.hooks)

    expect(entitlement.availability).toBe('unavailable')
    expect(entitlement.isGatedRequestAllowed).toBe(false)
    expect(second.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(second.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
    expect(second.useTargetsRead.mock.calls[0]).toEqual([])
  })
})

// The activation release, and what the retention rule requires of it. A terminal `503` can be reached before the
// launch activation settles — the SDK serves a cached activated value straight away, so the gated reads run and
// fail first — so the activation that confirms the feature is on is allowed to release the latch it produced. A
// release is not a promise that the feature came back, and these cases pin the loop the production effects run:
// release, at most one probe, and a re-latch from whatever terminal error is still the current answer, with
// nothing left enabled for the remount, focus or reconnect that follows.
describe('useMealPlanEntitlement activation release', () => {
  interface Pass {
    entitlement: ReturnType<typeof useMealPlanEntitlement>
    usePreferencesRead: jest.Mock
    useCurrentPlanRead: jest.Mock
    useTargetsRead: jest.Mock
  }

  interface Session {
    store: MealPlanEntitlementSessionStore
    mount: (errors?: {preferencesError?: unknown; targetsError?: unknown}) => Pass
  }

  /**
   * The production composition with React taken out: the real session store, the real classifier, and a recorder
   * that records on every invocation exactly as the hook's effect does — that effect carries no dependency array
   * precisely so a still-live signal is re-read after a release rather than skipped as unchanged.
   */
  const startSession = (): Session => {
    const store = createMealPlanEntitlementSessionStore()

    // Named as a hook because it calls one: `react-hooks/rules-of-hooks` allows a hook call only inside a
    // component or another hook, and this pass is the test's stand-in for a mounted consumer.
    const useEntitlementPass = (errors: {preferencesError?: unknown; targetsError?: unknown} = {}): Pass => {
      const fakes = makeFakes({...errors, capabilityLatch: store.getSnapshot().capabilityLatch})

      fakes.hooks.useRecordedCapabilitySignals = recorded =>
        store.recordCapabilitySignals(deriveMealPlanCapabilitySignals(recorded))

      const entitlement = useMealPlanEntitlement(fakes.hooks)

      return {
        entitlement,
        usePreferencesRead: fakes.usePreferencesRead,
        useCurrentPlanRead: fakes.useCurrentPlanRead,
        useTargetsRead: fakes.useTargetsRead
      }
    }

    return {store, mount: useEntitlementPass}
  }

  // The regression the release exists to avoid causing: a released latch whose terminal error is still live must
  // come back, or the gated observers stay enabled against a route that has already refused.
  it('re-latches when the probe after a release meets the same terminal error', () => {
    const {store, mount} = startSession()

    expect(mount({preferencesError: featureDisabledError}).entitlement.isGatedRequestAllowed).toBe(false)
    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: true, areRoutesMissing: false})

    // The activation settles and releases the verdict it may have raced.
    store.resetCapabilityLatch()
    expect(store.getSnapshot().capabilityLatch).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)

    // One probe: this pass is the only one allowed to read a gated route, and it meets the same refusal.
    const probe = mount({preferencesError: featureDisabledError})

    expect(probe.usePreferencesRead).toHaveBeenCalledWith(true)
    expect(probe.entitlement.availability).toBe('unavailable')
    expect(probe.entitlement.isGatedRequestAllowed).toBe(false)
    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: true, areRoutesMissing: false})

    // The next pass — a re-render, a remount, a focus or a reconnect — issues nothing, with or without the error
    // still in the cache.
    const remount = mount()

    expect(remount.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(remount.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
    expect(remount.entitlement.availability).toBe('unavailable')
    expect(remount.entitlement.isGatedRequestAllowed).toBe(false)

    const focus = mount({preferencesError: featureDisabledError})

    expect(focus.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(focus.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  // Signal (b) behaves the same way, and the release must not leave the Catalog section hidden on a session that
  // has recovered — so the visibility that follows the re-latch is asserted too.
  it('re-latches a route-missing verdict and keeps the catalog hidden while it holds', () => {
    const {store, mount} = startSession()

    mount({targetsError: bareNotFoundError})
    store.resetCapabilityLatch()

    const probe = mount({targetsError: new RoutesMissingError(TARGETS_PATH)})

    expect(probe.entitlement.availability).toBe('unavailable')
    expect(probe.entitlement.isCatalogVisible).toBe(false)
    expect(store.getSnapshot().capabilityLatch).toEqual({isFeatureDisabled: false, areRoutesMissing: true})

    const remount = mount()

    expect(remount.entitlement.isCatalogVisible).toBe(false)
    expect(remount.entitlement.isGatedRequestAllowed).toBe(false)
  })

  // The release earns its keep on the state it was added for: the feature really is on, the probe succeeds, and
  // the gated reads stay enabled from then on.
  it('leaves the gated reads enabled when the probe after a release succeeds', () => {
    const {store, mount} = startSession()

    mount({preferencesError: featureDisabledError})
    store.resetCapabilityLatch()

    const probe = mount()

    expect(probe.usePreferencesRead).toHaveBeenCalledWith(true)
    expect(probe.entitlement.availability).toBe('enabled')
    expect(probe.entitlement.isGatedRequestAllowed).toBe(true)
    expect(store.getSnapshot().capabilityLatch).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)

    const next = mount()

    expect(next.usePreferencesRead).toHaveBeenCalledWith(true)
    expect(next.useCurrentPlanRead).toHaveBeenCalledWith(true, SESSION_DAY_KEY)
    expect(next.entitlement.availability).toBe('enabled')
  })

  // What makes recording on every commit safe rather than noisy, and what makes it effective after a release:
  // an unchanged reading is the same latch reference, so it notifies nobody and cannot re-enter the effect that
  // wrote it, while a reading identical to one cleared by a release is recorded again rather than deduplicated
  // against history the store no longer holds.
  it('publishes nothing for an unchanged reading and re-records one the release cleared', () => {
    const store = createMealPlanEntitlementSessionStore()
    const listener = jest.fn()
    const signals = {isFeatureDisabled: true, areRoutesMissing: false}

    store.subscribe(listener)
    store.recordCapabilitySignals(signals)

    const latched = store.getSnapshot().capabilityLatch

    expect(listener).toHaveBeenCalledTimes(1)

    store.recordCapabilitySignals(signals)

    expect(store.getSnapshot().capabilityLatch).toBe(latched)
    expect(listener).toHaveBeenCalledTimes(1)

    store.resetCapabilityLatch()
    store.recordCapabilitySignals(signals)

    expect(store.getSnapshot().capabilityLatch).toEqual(signals)
  })
})

// The two production effects the release loop is made of, driven directly. React's hook dispatcher stands in for
// a renderer here — `useEffect` and `useLayoutEffect` are run the moment they are queued, which is what a commit
// does — so the real session store, the real classifier and the real activation epoch take part. This is where
// the shape of those effects is pinned: the recorder must carry no dependency array, and the release must come
// from a mounted effect rather than from loading the module.
describe('useMealPlanEntitlement production effects', () => {
  const LIVE_ERRORS: MealPlanCapabilityErrors = {
    preferencesError: featureDisabledError,
    currentPlanError: undefined,
    targetsError: undefined
  }

  // Compared by value rather than by identity: an isolated copy of the module has its own clear-latch
  // constant, so the exported one is a different object here.
  const CLEAR_LATCH: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: false}

  const NO_ERRORS: MealPlanCapabilityErrors = {
    preferencesError: undefined,
    currentPlanError: undefined,
    targetsError: undefined
  }

  interface Dispatcher {
    /** Invokes the recorder and returns the arguments it passed to `useEffect`. */
    commitRecorder: (errors: MealPlanCapabilityErrors) => unknown[]
    /** Mounts a consumer: elects it, and runs the activation release its effect carries. */
    commitParticipation: () => void
    /** Another mounted read. It returns the latch as that render saw it, before its own effects ran. */
    readLatch: () => MealPlanCapabilityLatch
    /** The app's single launch fetch, which settles an activation and advances its epoch. */
    activate: () => Promise<boolean>
  }

  /**
   * Loads its own copy of the hook module against a `react` whose effects run the moment they are queued, which
   * is what a commit does. Everything else in that copy is production code — the same session store, classifier
   * and activation epoch — and each call gets a fresh copy, so no case inherits another's latch.
   */
  const loadWithImmediateEffects = (): Dispatcher => {
    const effectCalls: unknown[][] = []
    const previousDeps = new Map<string, unknown[] | undefined>()

    // Which hook is being invoked, so each one's effect remembers its own dependencies. Both hooks queue exactly
    // one passive effect, so a slot needs no index.
    let slot = 'recorder'

    // React's rule, kept rather than simplified away: an effect with a dependency array is skipped when every
    // dependency is unchanged, and one without an array runs on every commit. A fake that ran everything every
    // time would pass whether or not the recorder carries an array, which is the regression below.
    const shouldRun = (deps: unknown[] | undefined): boolean => {
      const hasRun = previousDeps.has(slot)
      const previous = previousDeps.get(slot)

      previousDeps.set(slot, deps)

      if (!hasRun || deps === undefined || previous === undefined) {
        return true
      }

      return deps.length !== previous.length || deps.some((dep, index) => !Object.is(dep, previous[index]))
    }

    let hookModule: typeof import('../useMealPlanEntitlement') | undefined
    let service: typeof import('@service/remoteConfig/initRemoteConfig') | undefined

    jest.isolateModules(() => {
      // A passthrough rather than a replacement: the module graph behind the three query hooks reaches React at
      // import time, and only the four hooks this module calls are stood in for.
      jest.doMock('react', () => ({
        ...jest.requireActual('react'),
        useRef: (initial: unknown) => ({current: initial}),
        useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
        useLayoutEffect: (effect: () => void) => effect(),
        useEffect: (effect: () => void, deps?: unknown[]) => {
          effectCalls.push(deps === undefined ? [effect] : [effect, deps])

          if (shouldRun(deps)) {
            effect()
          }
        }
      }))

      hookModule = require('../useMealPlanEntitlement')
      service = require('@service/remoteConfig/initRemoteConfig')
    })

    jest.dontMock('react')

    const hooks = (hookModule as typeof import('../useMealPlanEntitlement')).defaultMealPlanEntitlementHooks
    const {initRemoteConfig: activate} = service as typeof import('@service/remoteConfig/initRemoteConfig')

    return {
      commitRecorder: (errors: MealPlanCapabilityErrors): unknown[] => {
        effectCalls.length = 0
        slot = 'recorder'

        hooks.useRecordedCapabilitySignals(errors)

        return effectCalls[0]
      },
      commitParticipation: (): void => {
        slot = 'participation'

        hooks.useSessionParticipation()
      },
      readLatch: (): MealPlanCapabilityLatch => {
        slot = 'participation'

        return hooks.useSessionParticipation().capabilityLatch
      },
      activate
    }
  }

  // The line the whole loop rests on: a reading is the errors currently in hand, so it is re-read on every
  // commit. A dependency array here would skip the re-read after a release that changed no error, leaving the
  // latch empty and the gated observers enabled against a route that has already refused.
  it('queues the capability recorder with no dependency array', () => {
    const dispatcher = loadWithImmediateEffects()

    const args = dispatcher.commitRecorder(LIVE_ERRORS)

    expect(args).toHaveLength(1)
    expect(typeof args[0]).toBe('function')
  })

  it('latches a terminal signal from the recorder effect', () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder(LIVE_ERRORS)

    expect(dispatcher.readLatch()).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
  })

  it('records nothing for a reading that carries no signal', () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder(NO_ERRORS)

    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // The regression, end to end on production code: latched before the launch activation settled, released by
  // that activation, probed once, and re-latched because the same terminal error is still the answer.
  it('re-latches after the activation release when the terminal error is still live', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder(LIVE_ERRORS)
    expect(dispatcher.readLatch()).toEqual({isFeatureDisabled: true, areRoutesMissing: false})

    await dispatcher.activate()

    // The mounted effect releases the verdict the activation may have raced — exactly once for that activation.
    dispatcher.commitParticipation()
    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)

    // The probe that follows meets the same refusal, and the commit that carries it re-latches.
    dispatcher.commitRecorder(LIVE_ERRORS)
    expect(dispatcher.readLatch()).toEqual({isFeatureDisabled: true, areRoutesMissing: false})

    // Every later mount, focus and reconnect observes the same activation, so nothing releases it again.
    dispatcher.commitParticipation()
    dispatcher.commitParticipation()
    expect(dispatcher.readLatch()).toEqual({isFeatureDisabled: true, areRoutesMissing: false})
  })

  it('leaves the latch clear when the probe after the release carries no signal', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder(LIVE_ERRORS)

    await dispatcher.activate()

    dispatcher.commitParticipation()
    dispatcher.commitRecorder(NO_ERRORS)

    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // Loading the module must mutate nothing: the release belongs to a mounted consumer, so no activation listener
  // may be registered on the way in.
  it('registers no activation listener when the module is loaded', () => {
    jest.isolateModules(() => {
      const subscribeToRemoteConfigActivation = jest.fn(() => () => undefined)

      jest.doMock('@service/remoteConfig/initRemoteConfig', () => ({
        __esModule: true,
        isMealPlanningEnabled: () => true,
        getRemoteConfigActivation: () => ({epoch: 0, isSettled: false}),
        subscribeToRemoteConfigActivation
      }))

      require('../useMealPlanEntitlement')

      expect(subscribeToRemoteConfigActivation).not.toHaveBeenCalled()
    })
  })
})
