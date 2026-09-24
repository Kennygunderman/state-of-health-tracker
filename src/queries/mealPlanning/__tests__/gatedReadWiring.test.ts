import {queryKeys} from '@queries/keys'
import {isMealPlanningEnabled} from '@service/remoteConfig/initRemoteConfig'
import {focusManager, QueryClient, QueryObserver, useQuery, useQueryClient} from '@tanstack/react-query'
import {MealPlanCapabilityLatch, NO_MEAL_PLAN_CAPABILITY_LATCH} from '@utility/MealPlanEntitlementUtility'

import {useAffectedMealsQuery} from '../useAffectedMealsQuery'
import {useGroceryListQuery} from '../useGroceryListQuery'
import {useMealPlanDayQuery} from '../useMealPlanDayQuery'
import {useNutritionTargetsQuery} from '../useNutritionTargetsQuery'
import {useRecipeDetailQuery} from '../useRecipeDetailQuery'
import {useSwapAlternativesQuery} from '../useSwapAlternativesQuery'
import {useSwapPreviewQuery} from '../useSwapPreviewQuery'
import {useTargetEstimateQuery} from '../useTargetEstimateQuery'

// `useQuery` is replaced so the options each hook declares can be read, and `useQueryClient` so the two reads
// that take a client — and the capability latch the real gate reads — all see the one client built per case.
// Everything else stays real, because the gate under test is the real one.
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query')

  return {...actual, useQuery: jest.fn(), useQueryClient: jest.fn()}
})

// The gate is two `useSyncExternalStore` reads and needs a dispatcher; no renderer is installed (AAP 0.4.1).
// The two hooks are given the behaviour React gives them for a store that does not change mid-call — the
// snapshot is returned, and a memoised callback is the callback — which is what makes the REAL gate, rather
// than a stand-in for it, the thing these cases exercise.
jest.mock('react', () => {
  const actual = jest.requireActual('react')

  return {
    ...actual,
    useCallback: <T>(callback: T): T => callback,
    useSyncExternalStore: <T>(_subscribe: unknown, getSnapshot: () => T): T => getSnapshot()
  }
})

// The flag half of the gate. Mocked at the service rather than at the Firebase SDK so a case states the
// activated value directly instead of assembling a Remote Config instance to imply it.
jest.mock('@service/remoteConfig/initRemoteConfig', () => ({
  isMealPlanningEnabled: jest.fn(() => true),
  subscribeToRemoteConfigActivation: jest.fn(() => () => undefined)
}))

// Each read's request function, replaced so requiring these hooks does not pull in the native Firebase auth
// chain behind httpUtil. Nothing here is called: what is asserted is the gate the options carry.
jest.mock('@queries/api/mealPlanning/fetchMealPlanDay', () => ({fetchMealPlanDay: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchGroceryList', () => ({fetchGroceryList: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchSwapAlternatives', () => ({fetchSwapAlternatives: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchSwapPreview', () => ({fetchSwapPreview: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchRecipeDetail', () => ({fetchRecipeDetail: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchAffectedMeals', () => ({fetchAffectedMeals: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchNutritionTargets', () => ({fetchNutritionTargets: jest.fn()}))
jest.mock('@queries/api/mealPlanning/fetchTargetEstimate', () => ({fetchTargetEstimate: jest.fn()}))

/**
 * Whether every route-scoped meal-planning read now refuses to issue its request on a session the server has
 * already refused, and whether the two target reads still refuse to be gated.
 *
 * Four of these six reads took no gate of any kind: they fired whenever mounted and re-probed on every stale
 * focus and reconnect after a gated route had answered `503 feature_disabled` or the routes had gone missing
 * under a rolled-back backend. The gate is derived inside each hook rather than threaded from the screens
 * because six screens mount them, one of them mounts no capability guard at all, and a call site that forgets
 * the verdict reintroduces the defect silently. These cases are what make forgetting it fail here instead.
 */

const PLAN_ID = 'plan-1'
const MEAL_ID = 'meal-1'
const DATE = '2026-07-06'
const RECIPE_VERSION_ID = 'recipe-version-1'
const PLAN_REVISION = 4

interface CapturedOptions {
  queryKey: readonly unknown[]
  enabled?: unknown
}

let queryClient: QueryClient
let captured: CapturedOptions[]

const enabledOf = (): unknown => {
  expect(captured).toHaveLength(1)

  return captured[0].enabled
}

const keyOf = (): readonly unknown[] => captured[0].queryKey

const refuse = (overrides: Partial<MealPlanCapabilityLatch>): void => {
  queryClient.setQueryData(queryKeys.mealPlanCapability, {
    activationEpoch: 1,
    latch: {...NO_MEAL_PLAN_CAPABILITY_LATCH, ...overrides}
  })
}

// Each gated read, invoked the way its screen invokes it: every argument the route already names, and no gate,
// because taking the gate from the caller is exactly what these hooks stopped doing.
/* eslint-disable react-hooks/rules-of-hooks -- each entry is a hook call under this suite's dispatcher mock */
const GATED_READS: {name: string; read: () => void}[] = [
  {name: 'useMealPlanDayQuery', read: () => useMealPlanDayQuery(PLAN_ID, DATE)},
  {name: 'useGroceryListQuery', read: () => useGroceryListQuery(PLAN_ID)},
  {name: 'useSwapAlternativesQuery', read: () => useSwapAlternativesQuery(PLAN_ID, MEAL_ID, PLAN_REVISION)},
  {
    name: 'useSwapPreviewQuery',
    read: () => useSwapPreviewQuery(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION)
  },
  {name: 'useRecipeDetailQuery', read: () => useRecipeDetailQuery(RECIPE_VERSION_ID)},
  {name: 'useAffectedMealsQuery', read: () => useAffectedMealsQuery(PLAN_ID)}
]

const UNGATED_READS: {name: string; read: () => void}[] = [
  {name: 'useNutritionTargetsQuery', read: () => useNutritionTargetsQuery()},
  {name: 'useTargetEstimateQuery', read: () => useTargetEstimateQuery()}
]
/* eslint-enable react-hooks/rules-of-hooks */

beforeEach(() => {
  captured = []
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})

  jest.mocked(useQueryClient).mockReturnValue(queryClient)
  jest.mocked(useQuery).mockImplementation(((options: CapturedOptions) => {
    captured.push(options)

    return {} as unknown
  }) as typeof useQuery)
  jest.mocked(isMealPlanningEnabled).mockReturnValue(true)
})

afterEach(() => {
  queryClient.clear()
})

describe.each(GATED_READS)('$name', ({read}) => {
  it('issues its request while the flag is on and nothing has been refused', () => {
    read()

    expect(enabledOf()).toBe(true)
  })

  it('withholds its request once a gated route has answered feature_disabled', () => {
    refuse({isFeatureDisabled: true})
    read()

    expect(enabledOf()).toBe(false)
  })

  it('withholds its request once the routes have gone missing, the rolled-back-backend signal', () => {
    refuse({areRoutesMissing: true})
    read()

    expect(enabledOf()).toBe(false)
  })

  it('withholds its request while the Remote Config flag is off', () => {
    jest.mocked(isMealPlanningEnabled).mockReturnValue(false)
    read()

    expect(enabledOf()).toBe(false)
  })

  it('keeps naming its key, so a refusal takes away the request and not the cached answer', () => {
    refuse({isFeatureDisabled: true})
    read()

    expect(keyOf()).toBeDefined()
    expect(keyOf().length).toBeGreaterThan(0)
  })
})

describe.each(UNGATED_READS)('$name', ({read}) => {
  it('is never gated, because the server never gates /meal-planning/targets* (AAP 0.3.1, 0.7.5)', () => {
    refuse({isFeatureDisabled: true, areRoutesMissing: true})
    jest.mocked(isMealPlanningEnabled).mockReturnValue(false)
    read()

    // Undefined rather than `false`: the read declares no gate at all, which is what keeps Account, Progress
    // and the Diary target editor working while planning is off or the routes have gone.
    expect(enabledOf()).toBeUndefined()
  })
})

/**
 * The re-probe the findings actually measured: every gated read fired again on each stale focus event, three
 * rounds running, after the session had been refused. `enabled` is what stops it — `shouldFetchOn`, which
 * `shouldFetchOnWindowFocus` goes through, returns false for a disabled query — and driving a real observer is
 * what turns that from a claim about query-core into an observation about these reads.
 */
describe('the focus re-probe', () => {
  const FOCUS_ROUNDS = 3

  // The client's focus subscriber resumes paused mutations before it notifies the cache, and `Query#onFocus`
  // refetches with `cancelRefetch: false` — so a round that arrives while the previous fetch is still in flight
  // JOINS it and issues nothing. Draining the queue between rounds is what makes each round its own event.
  const drain = (): Promise<void> => new Promise<void>(resolve => setImmediate(resolve))

  const mountDeclaredRead = (): {requests: () => number; focus: () => Promise<void>} => {
    expect(captured).toHaveLength(1)

    let requests = 0
    // The declared key and gate, with a counter in place of the read's own request function: what a round is
    // being asked about is whether the request went out, not what came back.
    const options = {
      ...captured[0],
      queryFn: () => {
        requests += 1

        return Promise.resolve({})
      }
    } as QueryObserver['options']
    const observer = new QueryObserver(queryClient, options)

    observer.subscribe(() => undefined)
    observers.push(observer)

    return {
      requests: () => requests,
      focus: async () => {
        focusManager.setFocused(false)
        focusManager.setFocused(true)
        await drain()
        await drain()
      }
    }
  }

  let observers: QueryObserver[] = []

  beforeEach(() => {
    observers = []
    // Required for focusManager events to reach the cache at all; without it nothing would fetch on focus and
    // every case below would pass for the wrong reason, which the allowed-gate control catches.
    queryClient.mount()
  })

  afterEach(() => {
    observers.forEach(observer => observer.destroy())
    queryClient.unmount()
    focusManager.setFocused(undefined)
  })

  it.each(GATED_READS)('$name asks nothing on three stale focus rounds once refused', async ({read}) => {
    refuse({isFeatureDisabled: true})
    read()

    const mounted = mountDeclaredRead()

    expect(mounted.requests()).toBe(0)

    for (let round = 0; round < FOCUS_ROUNDS; round += 1) {
      await mounted.focus()
    }

    expect(mounted.requests()).toBe(0)
  })

  it.each(GATED_READS)('$name re-probes on those same rounds while allowed, which is the control', async ({read}) => {
    read()

    const mounted = mountDeclaredRead()

    // The premise: with the gate open these reads are exactly as eager as the findings measured them to be.
    expect(mounted.requests()).toBe(1)
    await drain()

    for (let round = 0; round < FOCUS_ROUNDS; round += 1) {
      await mounted.focus()
    }

    expect(mounted.requests()).toBe(1 + FOCUS_ROUNDS)
  })
})

describe('the caller-supplied half of the gate', () => {
  it('is still honoured by the day read, so a caller with no plan to read issues nothing', () => {
    useMealPlanDayQuery(PLAN_ID, DATE, false)

    expect(enabledOf()).toBe(false)
  })

  it('is still honoured by the preview read, so an observing caller issues nothing', () => {
    useSwapPreviewQuery(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION, false)

    expect(enabledOf()).toBe(false)
  })

  it('cannot override a refusal, because the two halves are required together', () => {
    refuse({isFeatureDisabled: true})
    useMealPlanDayQuery(PLAN_ID, DATE, true)

    expect(enabledOf()).toBe(false)
  })

  it('is honoured by the grocery read through its own no-plan state', () => {
    useGroceryListQuery(null)

    expect(enabledOf()).toBe(false)
  })
})
