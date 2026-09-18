import {CurrentMealPlans, MealPlan} from '@data/models/MealPlan'
import {mutationKeys, queryKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {QueryClient} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {
  defaultMealPlanEntitlementHooks,
  MealPlanEntitlementHooks,
  observeMealPlanCapabilitySignals,
  readMealPlanCapabilityLatch,
  recordMealPlanCapability,
  useMealPlanEntitlement
} from '../useMealPlanEntitlement'
import {
  MealPlanCapabilityLatch,
  MealPlanCapabilityRecord,
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
 * reaches the current-plan read, whether the ungated targets read stays ungated, which reads a latched session
 * is allowed to issue, and whether the errors it classifies are the ones it was given — and, below that, the
 * capability mechanism itself against a real `QueryClient`.
 *
 * The shell is exercised through its injectable `MealPlanEntitlementHooks` rather than a renderer, because no
 * renderer or Testing Library is installed and AAP 0.4.1 keeps it that way. Every member of that object is a
 * `jest.fn`, so the shell runs with no React dispatcher and each read's arguments are recorded exactly as the
 * shell passed them. The three `QueryClient`-injected functions need no dispatcher at all, which is what lets
 * the cache scan, the write guard and the activation release be proven directly.
 */
const SESSION_DAY_KEY = '2026-07-05'

const TARGETS_PATH = '/meal-planning/targets'

const RECIPE_VERSION_ID = 'recipe-version-1'

const PLAN_ID = 'plan-current'

const makeApiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const featureDisabledError = makeApiError(503, API_ERROR_CODES.featureDisabled)

const bareNotFoundError = makeApiError(404)

const featureDisabledLatch: MealPlanCapabilityLatch = {isFeatureDisabled: true, areRoutesMissing: false}

const routesMissingLatch: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: true}

const makePlan = (): MealPlan => ({
  id: PLAN_ID,
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
  useCapabilityLatch: jest.Mock
  useSessionDayKey: jest.Mock
  usePreferencesRead: jest.Mock
  useCurrentPlanRead: jest.Mock
  useTargetsRead: jest.Mock
  useRecordedCapabilitySignals: jest.Mock
}

const makeFakes = (options: FakeOptions = {}): Fakes => {
  const {
    isFlagEnabled = true,
    capabilityLatch = NO_MEAL_PLAN_CAPABILITY_LATCH,
    sessionDayKey = SESSION_DAY_KEY,
    plans,
    preferencesError,
    currentPlanError,
    targetsError
  } = options

  const useFlagEnabled = jest.fn(() => isFlagEnabled)
  const useCapabilityLatch = jest.fn(() => capabilityLatch)
  const useSessionDayKey = jest.fn(() => sessionDayKey)
  const usePreferencesRead = jest.fn(() => ({error: preferencesError}))
  const useCurrentPlanRead = jest.fn(() => ({data: plans, error: currentPlanError}))
  const useTargetsRead = jest.fn(() => ({error: targetsError}))
  const useRecordedCapabilitySignals = jest.fn()

  return {
    hooks: {
      useFlagEnabled,
      useCapabilityLatch,
      useSessionDayKey,
      usePreferencesRead,
      useCurrentPlanRead,
      useTargetsRead,
      useRecordedCapabilitySignals
    },
    useFlagEnabled,
    useCapabilityLatch,
    useSessionDayKey,
    usePreferencesRead,
    useCurrentPlanRead,
    useTargetsRead,
    useRecordedCapabilitySignals
  }
}

const activeQueryClients: QueryClient[] = []

/**
 * A client for one case, remembered so it can be emptied afterwards.
 *
 * `gcTime: Infinity` is not a convenience: every query and mutation otherwise schedules a real
 * garbage-collection timeout for its whole `gcTime`, `MutationCache.clear()` does not cancel it, and one such
 * timer keeps the Jest worker alive long after the run reports green. `Infinity` makes the entries live exactly
 * as long as the client, which is one case.
 */
const makeQueryClient = (): QueryClient => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {gcTime: Infinity, retry: false},
      mutations: {gcTime: Infinity, retry: false}
    }
  })

  activeQueryClients.push(queryClient)

  return queryClient
}

afterEach(() => {
  activeQueryClients.forEach(queryClient => {
    queryClient.getMutationCache().clear()
    queryClient.clear()
  })

  activeQueryClients.length = 0
})

const FIRST_EPOCH = 1

/** Fails one query for real, through TanStack's own error channel, so the cache holds what a screen would see. */
const failQuery = async (queryClient: QueryClient, queryKey: readonly unknown[], error: unknown): Promise<void> => {
  await queryClient
    .fetchQuery({queryKey: [...queryKey], queryFn: () => Promise.reject(error), retry: false})
    .catch(() => undefined)
}

/** The same for a mutation, so `mutation.options.mutationKey` and `mutation.state.error` are the real ones. */
const failMutation = async (
  queryClient: QueryClient,
  mutationKey: readonly unknown[],
  error: unknown
): Promise<void> => {
  const mutation = queryClient.getMutationCache().build(queryClient, {
    mutationKey: [...mutationKey],
    mutationFn: () => Promise.reject(error),
    retry: false
  })

  await mutation.execute(undefined).catch(() => undefined)
}

const recordFrom = (queryClient: QueryClient): MealPlanCapabilityLatch =>
  recordMealPlanCapability(queryClient, FIRST_EPOCH, observeMealPlanCapabilitySignals(queryClient))

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

  it('enables both gated reads while the flag is on and nothing is latched', () => {
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

  it('disables both gated reads once feature_disabled is latched', () => {
    const fakes = makeFakes({capabilityLatch: featureDisabledLatch})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  it('disables both gated reads once routes-missing is latched', () => {
    const fakes = makeFakes({capabilityLatch: routesMissingLatch})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(fakes.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
  })

  // The targets read carries the local-target fallback of AAP 0.7.5, so it is called with no gate at all — not
  // with `true`, which a later change could flip.
  it('calls the targets read with no argument in every flag and latch state', () => {
    const states: FakeOptions[] = [
      {},
      {isFlagEnabled: false},
      {capabilityLatch: featureDisabledLatch},
      {capabilityLatch: routesMissingLatch},
      {isFlagEnabled: false, capabilityLatch: {isFeatureDisabled: true, areRoutesMissing: true}}
    ]

    states.forEach(state => {
      const fakes = makeFakes(state)

      useMealPlanEntitlement(fakes.hooks)

      expect(fakes.useTargetsRead).toHaveBeenCalledTimes(1)
      expect(fakes.useTargetsRead.mock.calls[0]).toEqual([])
    })
  })

  it('reads the flag and the session verdict once per invocation', () => {
    const fakes = makeFakes()

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.useFlagEnabled).toHaveBeenCalledTimes(1)
    expect(fakes.useCapabilityLatch).toHaveBeenCalledTimes(1)
    expect(fakes.useCapabilityLatch.mock.calls[0]).toEqual([])
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

  it('is unavailable from the session verdict alone, with no live error to read', () => {
    const entitlement = useMealPlanEntitlement(makeFakes({capabilityLatch: routesMissingLatch}).hooks)

    expect(entitlement.availability).toBe('unavailable')
    expect(entitlement.isCatalogVisible).toBe(false)
    expect(entitlement.isGatedRequestAllowed).toBe(false)
  })
})

describe('useMealPlanEntitlement capability recording', () => {
  // The recorder is invoked once per render and is handed NOTHING. Its input is the request caches, so there is
  // no per-render error payload to forward — which is what stops a verdict from being rebuilt out of a render
  // whose cache has already been cleared. Asserted as an argument count rather than as an absence of a call, so
  // a payload reintroduced later fails here.
  it('invokes the recorder once per render, with no error payload to forward', () => {
    const targetsError = new RoutesMissingError(TARGETS_PATH)
    const fakes = makeFakes({preferencesError: featureDisabledError, targetsError})

    useMealPlanEntitlement(fakes.hooks)

    expect(fakes.useRecordedCapabilitySignals).toHaveBeenCalledTimes(1)
    expect(fakes.useRecordedCapabilitySignals).toHaveBeenCalledWith()
  })

  // The whole loop, with the real capability functions and a real `QueryClient` standing in for the production
  // effect: a terminal 503 seen on one invocation must be recorded and must disable the gated reads on the next
  // one, so a remount, a focus or a reconnect issues no further probe.
  it('records a terminal signal so the next invocation issues no gated read', async () => {
    const queryClient = makeQueryClient()
    const hooksFor = (preferencesError: unknown): Fakes => {
      const fakes = makeFakes({preferencesError, capabilityLatch: readMealPlanCapabilityLatch(queryClient)})

      fakes.hooks.useRecordedCapabilitySignals = () => {
        recordFrom(queryClient)
      }

      return fakes
    }

    // The refusal is staged in the cache, because that is the recorder's only input: the live error the read
    // hands back is what the entitlement answers *this* render from, and the cache entry is what the verdict is
    // recorded from. A production render has both, and so does this one.
    await failQuery(queryClient, queryKeys.mealPlanPreferences, featureDisabledError)

    const first = hooksFor(featureDisabledError)

    expect(useMealPlanEntitlement(first.hooks).isGatedRequestAllowed).toBe(false)
    expect(first.usePreferencesRead).toHaveBeenCalledWith(true)
    expect(readMealPlanCapabilityLatch(queryClient)).toEqual(featureDisabledLatch)

    const second = hooksFor(undefined)
    const entitlement = useMealPlanEntitlement(second.hooks)

    expect(entitlement.availability).toBe('unavailable')
    expect(entitlement.isGatedRequestAllowed).toBe(false)
    expect(second.usePreferencesRead).toHaveBeenCalledWith(false)
    expect(second.useCurrentPlanRead).toHaveBeenCalledWith(false, SESSION_DAY_KEY)
    expect(second.useTargetsRead.mock.calls[0]).toEqual([])
  })
})

/**
 * The capability mechanism itself, against a real `QueryClient` and with no renderer: the cache scan that makes
 * every gated request a producer of the verdict, the write guard that keeps the recorder from notifying itself,
 * and the activation release now that it is data rather than a module `let`.
 */
describe('readMealPlanCapabilityLatch', () => {
  it('reads the empty verdict from a client that holds none, by reference', () => {
    expect(readMealPlanCapabilityLatch(makeQueryClient())).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('reads the latch the stored record holds', () => {
    const queryClient = makeQueryClient()
    const record: MealPlanCapabilityRecord = {activationEpoch: FIRST_EPOCH, latch: featureDisabledLatch}

    queryClient.setQueryData(queryKeys.mealPlanCapability, record)

    expect(readMealPlanCapabilityLatch(queryClient)).toEqual(featureDisabledLatch)
  })

  // THE PROCESS-SESSION CONTRACT, against a finite app-wide `gcTime` like production's 24 hours.
  //
  // The verdict is written with `setQueryData` and observed through the cache rather than through a
  // `QueryObserver`, so nothing marks its entry active and a cache subscription does not: left on the app-wide
  // `gcTime` it would be collected inside a still-running process, the gated reads would re-enable, and the app
  // would issue exactly the probe AAP 0.2.5 says a latched client must not. The entry therefore carries
  // `gcTime: Infinity` of its own, and the two ends of "session-scoped" are asserted together — collection can
  // never take it, and `clear()` always can.
  it('keeps the verdict through garbage collection, whatever the app-wide gcTime is', async () => {
    jest.useFakeTimers()

    try {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {gcTime: 1_000, retry: false},
          mutations: {gcTime: 1_000, retry: false}
        }
      })

      await failQuery(queryClient, queryKeys.mealPlanPreferences, featureDisabledError)
      recordFrom(queryClient)

      expect(readMealPlanCapabilityLatch(queryClient)).toEqual(featureDisabledLatch)

      jest.advanceTimersByTime(10 * 60_000)

      // The read that produced the verdict has been collected — it had no observer — which is precisely why the
      // verdict has to be retained rather than re-derived, and precisely why it must not be collected with it.
      expect(queryClient.getQueryCache().find({queryKey: [...queryKeys.mealPlanPreferences]})).toBeUndefined()
      expect(queryClient.getQueryCache().find({queryKey: [...queryKeys.mealPlanCapability]})).toBeDefined()
      expect(readMealPlanCapabilityLatch(queryClient)).toEqual(featureDisabledLatch)

      queryClient.clear()

      expect(readMealPlanCapabilityLatch(queryClient)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
    } finally {
      jest.useRealTimers()
    }
  })

  // Session-scoped by construction: the verdict is a memory-only cache entry, so the logout path's
  // `queryClient.clear()` drops it and no account inherits another's verdict (AAP 0.7.5 forward recovery).
  it('reads the empty verdict again once the client is cleared on logout', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.recipeVersion(RECIPE_VERSION_ID), featureDisabledError)
    recordFrom(queryClient)

    expect(readMealPlanCapabilityLatch(queryClient)).toEqual(featureDisabledLatch)

    queryClient.clear()

    expect(readMealPlanCapabilityLatch(queryClient)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })
})

describe('observeMealPlanCapabilitySignals over the query cache', () => {
  // The finding, route by route: a confirmed `503 feature_disabled` from any gated read — nested screens
  // included — is signal (a) and must reach the session's verdict (AAP 0.2.5).
  const gatedQueryKeys: [string, readonly unknown[]][] = [
    ['recipe detail', queryKeys.recipeVersion(RECIPE_VERSION_ID)],
    ['plan day', queryKeys.mealPlanDay(PLAN_ID, SESSION_DAY_KEY)],
    ['grocery list', queryKeys.groceryList(PLAN_ID)],
    ['swap alternatives', queryKeys.swapAlternatives(PLAN_ID, 'meal-1', 3)],
    ['swap preview', queryKeys.swapPreview(PLAN_ID, 'meal-1', RECIPE_VERSION_ID, 3)],
    ['affected meals', queryKeys.affectedMeals(PLAN_ID)],
    ['preferences', queryKeys.mealPlanPreferences],
    ['current plan', queryKeys.mealPlanCurrent]
  ]

  it.each(gatedQueryKeys)('reads feature_disabled from the %s read', async (_name, queryKey) => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKey, featureDisabledError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(featureDisabledLatch)
  })

  const ungatedQueryKeys: [string, readonly unknown[]][] = [
    ['nutrition targets', queryKeys.nutritionTargets],
    ['target estimate', queryKeys.targetEstimate],
    ['catalog search', queryKeys.catalogSearch('oats')],
    ['catalog suggestions', queryKeys.catalogSuggestions]
  ]

  // The routes the server never gates (AAP 0.3.1): Account, Progress and the Diary editor read targets while
  // planning is off, and Add Food keeps its Catalog section, so their 503 is not a statement about the feature.
  it.each(ungatedQueryKeys)('ignores feature_disabled from the ungated %s read', async (_name, queryKey) => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKey, featureDisabledError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  // Signal (b) belongs to the three resource-less GETs only.
  it.each([
    ['preferences', queryKeys.mealPlanPreferences],
    ['current plan', queryKeys.mealPlanCurrent],
    ['nutrition targets', queryKeys.nutritionTargets]
  ] as [string, readonly unknown[]][])('reads a bare 404 on the %s read as routes-missing', async (_name, queryKey) => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKey, bareNotFoundError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(routesMissingLatch)
  })

  // The resource-route exclusion of AAP 0.5.2: a plan-day 404 is the not-found/not-yours answer, and reading it
  // as a rollback would put a whole session on the unavailable card over one missing day.
  it('ignores a bare 404 from a gated resource route', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.mealPlanDay(PLAN_ID, SESSION_DAY_KEY), bareNotFoundError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('ignores a 404 that carries a decodable code, wherever it came from', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.mealPlanCurrent, makeApiError(404, API_ERROR_CODES.planNotActive))

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('reports neither signal for a client whose reads all succeeded', async () => {
    const queryClient = makeQueryClient()

    await queryClient.fetchQuery({queryKey: [...queryKeys.mealPlanCurrent], queryFn: () => Promise.resolve(null)})

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  // THE CACHE IS THE WHOLE INPUT. The entitlement's own three reads are read here exactly as every other
  // request is — out of the cache, by key — and nothing is taken from a caller's render. That is the property
  // that keeps a cleared client unlatchable, and it is asserted as the same three scopes the shell used to hand
  // over by hand: preferences is gated and a probe, targets is a probe only.
  it('reads the entitlement’s own three reads from the cache, with their own scopes', async () => {
    const disabledFromPreferences = makeQueryClient()
    const disabledFromTargets = makeQueryClient()
    const missingFromTargets = makeQueryClient()

    await failQuery(disabledFromPreferences, queryKeys.mealPlanPreferences, featureDisabledError)
    await failQuery(disabledFromTargets, queryKeys.nutritionTargets, featureDisabledError)
    await failQuery(missingFromTargets, queryKeys.nutritionTargets, bareNotFoundError)

    expect(observeMealPlanCapabilitySignals(disabledFromPreferences)).toEqual(featureDisabledLatch)
    expect(observeMealPlanCapabilitySignals(disabledFromTargets)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
    expect(observeMealPlanCapabilitySignals(missingFromTargets)).toEqual(routesMissingLatch)
  })

  // The corollary, stated on its own because it is the logout guarantee: an error a render still holds is not
  // evidence once the cache no longer holds it, so a scan taken after `queryClient.clear()` finds nothing.
  it('reads nothing from a client whose cache has been cleared', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.mealPlanPreferences, featureDisabledError)
    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(featureDisabledLatch)

    queryClient.clear()

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('reads both signals when separate requests carry one each', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.recipeVersion(RECIPE_VERSION_ID), featureDisabledError)
    await failQuery(queryClient, queryKeys.nutritionTargets, bareNotFoundError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual({
      isFeatureDisabled: true,
      areRoutesMissing: true
    })
  })
})

describe('observeMealPlanCapabilitySignals over the mutation cache', () => {
  // The setup saves and the keyed writes: a step save refused with a confirmed 503 used to become a generic
  // retry toast that stranded the user on a gated screen, because the verdict never heard about it.
  const gatedMutationKeys: [string, readonly unknown[]][] = [
    ['setup step save', mutationKeys.saveSetupStep],
    ['full preferences save', mutationKeys.savePreferences],
    ['plan generation', mutationKeys.generatePlan],
    ['plan regeneration', mutationKeys.regeneratePlan],
    ['swap commit', mutationKeys.swapMeal],
    ['grocery toggle', mutationKeys.toggleGroceryItem],
    ['grocery uncheck-all', mutationKeys.uncheckAllGroceries],
    ['planned-meal log', mutationKeys.logPlannedMeal]
  ]

  it.each(gatedMutationKeys)('reads feature_disabled from the %s', async (_name, mutationKey) => {
    const queryClient = makeQueryClient()

    await failMutation(queryClient, mutationKey, featureDisabledError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(featureDisabledLatch)
  })

  // The targets write is exempt with its read: the Diary target editor saves while planning is off.
  it('ignores feature_disabled from the ungated targets save', async () => {
    const queryClient = makeQueryClient()

    await failMutation(queryClient, mutationKeys.saveNutritionTargets, featureDisabledError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('ignores a mutation failure that is not the capability code', async () => {
    const queryClient = makeQueryClient()

    await failMutation(queryClient, mutationKeys.swapMeal, makeApiError(409, API_ERROR_CODES.stalePlan))

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  // Confirmed-ness again: a lost response is an unknown outcome that a same-key retry can still resolve, so it
  // must not stop every gated request (AAP 0.2.5).
  it('ignores a mutation whose feature_disabled body carries no response status', async () => {
    const queryClient = makeQueryClient()

    await failMutation(queryClient, mutationKeys.saveSetupStep, {
      response: {data: {error: API_ERROR_CODES.featureDisabled}}
    })

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })

  it('never reads a mutation failure as routes-missing', async () => {
    const queryClient = makeQueryClient()

    await failMutation(queryClient, mutationKeys.saveSetupStep, bareNotFoundError)

    expect(observeMealPlanCapabilitySignals(queryClient)).toEqual(NO_MEAL_PLAN_CAPABILITY_LATCH)
  })
})

describe('recordMealPlanCapability', () => {
  // An error that settled before the recorder ever ran is still the reading: the scan is over state, not events.
  it('picks up a failure that was already in the cache on its first pass', async () => {
    const queryClient = makeQueryClient()

    await failMutation(queryClient, mutationKeys.saveSetupStep, featureDisabledError)

    expect(recordFrom(queryClient)).toEqual(featureDisabledLatch)
    expect(readMealPlanCapabilityLatch(queryClient)).toEqual(featureDisabledLatch)
  })

  // No entry is created for a healthy session, so the memory-only key stays absent until there is a verdict.
  it('creates no cache entry when there is nothing to remember', () => {
    const queryClient = makeQueryClient()

    expect(recordFrom(queryClient)).toBe(NO_MEAL_PLAN_CAPABILITY_LATCH)
    expect(queryClient.getQueryCache().find({queryKey: queryKeys.mealPlanCapability})).toBeUndefined()
  })

  // The write guard, which is why the recorder can subscribe to the cache it writes to: an unchanged reading
  // writes nothing at all, so it emits no cache event and cannot notify itself into a loop.
  it('writes nothing for an unchanged reading, so it cannot re-enter through its own subscription', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.recipeVersion(RECIPE_VERSION_ID), featureDisabledError)
    recordFrom(queryClient)

    const stored = queryClient.getQueryCache().find({queryKey: queryKeys.mealPlanCapability})
    const writtenAt = stored?.state.dataUpdatedAt
    const record = queryClient.getQueryData(queryKeys.mealPlanCapability)

    let events = 0
    const unsubscribe = queryClient.getQueryCache().subscribe(() => {
      events += 1
    })

    recordFrom(queryClient)
    recordFrom(queryClient)

    unsubscribe()

    expect(events).toBe(0)
    expect(queryClient.getQueryData(queryKeys.mealPlanCapability)).toBe(record)
    expect(queryClient.getQueryCache().find({queryKey: queryKeys.mealPlanCapability})?.state.dataUpdatedAt).toBe(
      writtenAt
    )
  })

  it('accumulates a second signal into the verdict it already holds', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.recipeVersion(RECIPE_VERSION_ID), featureDisabledError)
    recordFrom(queryClient)

    await failQuery(queryClient, queryKeys.nutritionTargets, new RoutesMissingError(TARGETS_PATH))

    expect(recordFrom(queryClient)).toEqual({isFeatureDisabled: true, areRoutesMissing: true})
  })

  // A read that succeeds after a terminal signal does not unlatch it: the disabled route was not probed again.
  it('keeps the verdict when a later reading carries no signal', async () => {
    const queryClient = makeQueryClient()

    recordMealPlanCapability(queryClient, FIRST_EPOCH, featureDisabledLatch)
    await queryClient.fetchQuery({queryKey: [...queryKeys.mealPlanCurrent], queryFn: () => Promise.resolve(null)})

    expect(recordFrom(queryClient)).toEqual(featureDisabledLatch)
  })

  // The release, and the only reason the activation epoch is stored: a verdict reached before the launch
  // activation settled must not outlive the activation that confirms the feature is on — and must come straight
  // back when the terminal error is still the answer, without a repeat probe (AAP 0.2.5, 0.7.5).
  it('re-latches on a new activation while the terminal error is still the answer', async () => {
    const queryClient = makeQueryClient()

    await failQuery(queryClient, queryKeys.mealPlanPreferences, featureDisabledError)
    recordFrom(queryClient)

    const nextEpoch = FIRST_EPOCH + 1
    const signals = observeMealPlanCapabilitySignals(queryClient)

    expect(recordMealPlanCapability(queryClient, nextEpoch, signals)).toEqual(featureDisabledLatch)
    expect(queryClient.getQueryData<MealPlanCapabilityRecord>(queryKeys.mealPlanCapability)?.activationEpoch).toBe(
      nextEpoch
    )
  })

  it('clears the verdict on a new activation whose reading carries no signal', () => {
    const queryClient = makeQueryClient()

    recordMealPlanCapability(queryClient, FIRST_EPOCH, featureDisabledLatch)

    const nextEpoch = FIRST_EPOCH + 1

    expect(recordMealPlanCapability(queryClient, nextEpoch, NO_MEAL_PLAN_CAPABILITY_LATCH)).toBe(
      NO_MEAL_PLAN_CAPABILITY_LATCH
    )
  })

  // Once per activation: after the release, the same epoch accumulates again rather than releasing on every
  // reading, so a still-live refusal cannot be repeatedly forgotten.
  it('releases only once for an activation', () => {
    const queryClient = makeQueryClient()
    const nextEpoch = FIRST_EPOCH + 1

    recordMealPlanCapability(queryClient, FIRST_EPOCH, featureDisabledLatch)
    recordMealPlanCapability(queryClient, nextEpoch, NO_MEAL_PLAN_CAPABILITY_LATCH)
    recordMealPlanCapability(queryClient, nextEpoch, routesMissingLatch)

    expect(recordMealPlanCapability(queryClient, nextEpoch, NO_MEAL_PLAN_CAPABILITY_LATCH)).toEqual(routesMissingLatch)
  })
})

// The production effect the recording is made of, driven directly. React's hook dispatcher stands in for a
// renderer here — `useEffect` runs the moment it is queued, which is what a commit does — so the real classifier,
// the real activation epoch and a real `QueryClient` take part. This is where the shape of that effect is
// pinned: it must carry no dependency array, it must attach and detach the cache listeners, and loading the
// module must register no activation listener at all.
describe('useMealPlanEntitlement production effects', () => {
  // The recorder takes no payload, so a terminal signal is staged where it actually lives: in the client's own
  // query cache, through TanStack's error channel, exactly as the failing read would have left it.
  const seedTerminalFailure = (queryClient: QueryClient): Promise<void> =>
    failQuery(queryClient, queryKeys.mealPlanPreferences, featureDisabledError)

  const clearTerminalFailure = (queryClient: QueryClient): void => {
    queryClient.removeQueries({queryKey: [...queryKeys.mealPlanPreferences]})
  }

  // Compared by value rather than by identity: an isolated copy of the module has its own clear-latch
  // constant, so the exported one is a different object here.
  const CLEAR_LATCH: MealPlanCapabilityLatch = {isFeatureDisabled: false, areRoutesMissing: false}

  interface Dispatcher {
    /** The client the hooks read and write, so a test can fail a request in it. */
    queryClient: QueryClient
    /** Invokes the recorder and returns the arguments it passed to `useEffect`. */
    commitRecorder: () => unknown[]
    /** Runs the cleanup the last committed effect returned, which is what an unmount does. */
    detachRecorder: () => void
    /** Another mounted read: the latch as that render saw it. */
    readLatch: () => MealPlanCapabilityLatch
    /** The app's single launch fetch, which settles an activation and advances its epoch. */
    activate: () => Promise<boolean>
  }

  /**
   * Loads its own copy of the hook module against a `react` whose effects run the moment they are queued, which
   * is what a commit does, and a `useQueryClient` that answers with the client below — the provider is the one
   * piece of the tree a dispatcher-less harness cannot supply. Everything else in that copy is production code,
   * and each call gets a fresh copy and a fresh client, so no case inherits another's verdict.
   */
  const loadWithImmediateEffects = (): Dispatcher => {
    const queryClient = makeQueryClient()
    const effectCalls: unknown[][] = []
    const previousDeps = new Map<string, unknown[] | undefined>()
    const cleanups = new Map<string, (() => void) | void>()

    // Which hook is being invoked, so each one's effect remembers its own dependencies and its own cleanup. The
    // recorder queues exactly one passive effect, so a slot needs no index.
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
      // Passthroughs rather than replacements: the module graph behind the three query hooks reaches React and
      // TanStack at import time, and only the hooks this module calls are stood in for.
      jest.doMock('react', () => ({
        ...jest.requireActual('react'),
        useCallback: (callback: unknown) => callback,
        useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
        useEffect: (effect: () => (() => void) | void, deps?: unknown[]) => {
          effectCalls.push(deps === undefined ? [effect] : [effect, deps])

          if (!shouldRun(deps)) {
            return
          }

          // React's order, and the reason this harness keeps it: the previous effect's cleanup runs before the
          // new one, so a commit replaces its consumer's cache listeners instead of adding a second pair.
          const previousCleanup = cleanups.get(slot)

          if (typeof previousCleanup === 'function') {
            previousCleanup()
          }

          cleanups.set(slot, effect())
        }
      }))

      jest.doMock('@tanstack/react-query', () => ({
        ...jest.requireActual('@tanstack/react-query'),
        useQueryClient: () => queryClient
      }))

      hookModule = require('../useMealPlanEntitlement')
      service = require('@service/remoteConfig/initRemoteConfig')
    })

    jest.dontMock('react')
    jest.dontMock('@tanstack/react-query')

    const hooks = (hookModule as typeof import('../useMealPlanEntitlement')).defaultMealPlanEntitlementHooks
    const {initRemoteConfig: activate} = service as typeof import('@service/remoteConfig/initRemoteConfig')

    return {
      queryClient,
      commitRecorder: (): unknown[] => {
        effectCalls.length = 0
        slot = 'recorder'

        hooks.useRecordedCapabilitySignals()

        return effectCalls[0]
      },
      detachRecorder: (): void => {
        const cleanup = cleanups.get('recorder')

        if (typeof cleanup === 'function') {
          cleanup()
        }

        cleanups.delete('recorder')
      },
      readLatch: (): MealPlanCapabilityLatch => hooks.useCapabilityLatch(),
      activate
    }
  }

  // The line the whole loop rests on: a reading is the state of both caches, so it is re-read on every commit.
  // A dependency array here would skip the re-read after a release that changed no request, leaving the verdict
  // empty and the gated observers enabled against a route that has already refused.
  it('queues the capability recorder with no dependency array', () => {
    const dispatcher = loadWithImmediateEffects()

    const args = dispatcher.commitRecorder()

    expect(args).toHaveLength(1)
    expect(typeof args[0]).toBe('function')
  })

  it('records a terminal signal from the recorder effect', async () => {
    const dispatcher = loadWithImmediateEffects()

    await seedTerminalFailure(dispatcher.queryClient)
    dispatcher.commitRecorder()

    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)
  })

  it('records nothing for a reading that carries no signal', () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder()

    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // The listeners the same effect attaches, which is what makes a request settling outside our own commits — a
  // nested screen's gated read, a setup save — reach the verdict.
  it('records a gated read that fails after the commit, through its own cache listener', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder()

    await failQuery(dispatcher.queryClient, queryKeys.recipeVersion(RECIPE_VERSION_ID), featureDisabledError)

    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)
  })

  it('records a gated mutation that fails after the commit', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder()

    await failMutation(dispatcher.queryClient, mutationKeys.saveSetupStep, featureDisabledError)

    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)
  })

  // THE LOGOUT REGRESSION, with the production recorder and its listeners attached — the state the earlier
  // logout test could not reach, because it cleared a client nothing was listening to.
  //
  // `queryClient.clear()` empties the query cache before the mutation cache, and it empties each by removing
  // every entry one at a time. Each removal notifies the recorder. A recorder that re-scanned on a removal
  // would, part-way through that sweep, still see a gated failure — or the verdict's own entry going away — and
  // write the verdict straight back into the client the logout had just emptied, leaving the next account's
  // session latched off a previous account's refusal. A removal is the event of evidence going away, so it is
  // not a reading.
  it('leaves no verdict behind when logout clears the client under the attached recorder', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder()

    await failQuery(dispatcher.queryClient, queryKeys.mealPlanPreferences, featureDisabledError)
    await failMutation(dispatcher.queryClient, mutationKeys.saveSetupStep, featureDisabledError)

    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)

    dispatcher.queryClient.clear()

    expect(dispatcher.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(dispatcher.queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // The same sweep in the other order, because `clear()` is not the only way a session ends: an explicit
  // removal of the verdict's own key must not be answered by writing it again either.
  it('does not write the verdict back when its own entry is removed', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder()

    await failQuery(dispatcher.queryClient, queryKeys.mealPlanPreferences, featureDisabledError)
    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)

    dispatcher.queryClient.removeQueries({queryKey: [...queryKeys.mealPlanCapability]})

    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // The cleanup half: an unmounted consumer leaves no listener behind on either cache.
  it('stops recording once the effect is cleaned up', async () => {
    const dispatcher = loadWithImmediateEffects()

    dispatcher.commitRecorder()
    dispatcher.detachRecorder()

    await failQuery(dispatcher.queryClient, queryKeys.recipeVersion(RECIPE_VERSION_ID), featureDisabledError)
    await failMutation(dispatcher.queryClient, mutationKeys.saveSetupStep, featureDisabledError)

    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // The regression, end to end on production code: recorded before the launch activation settled, released by
  // that activation, and re-latched in the same reading because the same terminal error is still the answer.
  it('re-latches after the activation release when the terminal error is still live', async () => {
    const dispatcher = loadWithImmediateEffects()

    await seedTerminalFailure(dispatcher.queryClient)
    dispatcher.commitRecorder()
    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)

    await dispatcher.activate()

    dispatcher.commitRecorder()
    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)

    // Every later commit observes the same activation, so nothing releases it again.
    dispatcher.commitRecorder()
    expect(dispatcher.readLatch()).toEqual(featureDisabledLatch)
  })

  it('leaves the verdict clear when the reading after the release carries no signal', async () => {
    const dispatcher = loadWithImmediateEffects()

    await seedTerminalFailure(dispatcher.queryClient)
    dispatcher.commitRecorder()

    await dispatcher.activate()

    // The refusal is gone from the cache as well as from the epoch, so the release has nothing to re-latch on.
    clearTerminalFailure(dispatcher.queryClient)
    dispatcher.commitRecorder()

    expect(dispatcher.readLatch()).toEqual(CLEAR_LATCH)
  })

  // Loading the module must mutate nothing: the release is carried by the recorded epoch, so no activation
  // listener may be registered on the way in.
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

    jest.dontMock('@service/remoteConfig/initRemoteConfig')
  })

  // Nothing is written on the way in either: the verdict is a cache entry, so a freshly loaded module holds none
  // and a cold start probes the gated routes once (AAP 0.7.5).
  it('writes no capability record when the module is loaded', () => {
    const dispatcher = loadWithImmediateEffects()

    expect(dispatcher.queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})
