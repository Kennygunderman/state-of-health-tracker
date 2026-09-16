import {InputMethodEnum} from '@data/models/MealEntry'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {buildLogPlannedMealMutationOptions} from '../useLogPlannedMealMutation.util'

const DATE = '2026-07-05'
const OTHER_DATE = '2026-07-08'
const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const MEAL_ID = 'meal-1'
const RECIPE_VERSION_ID = 'recipe-version-1'
const IDEMPOTENCY_KEY = '6f1a0d64-8e8f-4c2b-9a35-3f1cbb3bb111'

type LogOptions = ReturnType<typeof buildLogPlannedMealMutationOptions>

// Read off the factory's own declared generics instead of imported from the api module that happens to declare
// them, so the fixtures below are bound to the signature this suite exercises: a variables type that stopped
// carrying `date` would fail here at compile time rather than let a stale fixture keep passing.
type LogOnSuccess = NonNullable<LogOptions['onSuccess']>
type LogPlannedMealResult = Parameters<LogOnSuccess>[0]
type LogPlannedMealPayload = Parameters<LogOnSuccess>[1]

const makePayload = (overrides: Partial<LogPlannedMealPayload> = {}): LogPlannedMealPayload => ({
  servings: 1,
  date: DATE,
  diaryMealId: 'diary-meal-1',
  expectedPlanRevision: 3,
  idempotencyKey: IDEMPOTENCY_KEY,
  ...overrides
})

const LOG_RESULT: LogPlannedMealResult = {
  entry: {
    id: 'entry-1',
    foodId: null,
    name: 'Lemon herb baked salmon',
    servingText: '1 serving',
    servings: 1,
    calories: 520,
    protein: 41,
    carbs: 28,
    fat: 24,
    inputMethod: InputMethodEnum.MEAL_PLAN,
    loggedAt: '2026-07-05T18:10:00.000Z',
    mealPlanMealId: MEAL_ID,
    nutritionProvenance: 'source_backed'
  },
  mealPlanMeal: {
    id: MEAL_ID,
    revision: 3,
    slot: 'dinner',
    slotTime: '18:30',
    sortOrder: 2,
    recipe: {
      versionId: RECIPE_VERSION_ID,
      recipeId: 'recipe-1',
      name: 'Lemon herb baked salmon',
      iconKey: 'fork_knife',
      totalMinutes: 25,
      badges: ['high_protein'],
      nutritionProvenance: 'source_backed'
    },
    portionMultiplier: 1,
    portionText: '1 serving',
    planned: {calories: 520, protein: 41, carbs: 28, fat: 24},
    flags: [],
    previousRecipe: null,
    loggedEntries: [
      {
        entryId: 'entry-1',
        date: DATE,
        mealName: 'Dinner',
        servings: 1,
        loggedAt: '2026-07-05T18:10:00.000Z',
        recipeVersionId: RECIPE_VERSION_ID,
        recipeName: 'Lemon herb baked salmon'
      }
    ]
  },
  planRevision: 4
}

// Duck-typed rejection shapes, exactly what classifyOutcome reads (`response.status` and `response.data.error`),
// so the retry table is pinned without importing axios or the http layer.
const TRANSPORT_LOSS_ERROR = {message: 'Network Error'}
const GATEWAY_ERROR_WITHOUT_CODE = {response: {status: 502, data: {}}}
const GATEWAY_ERROR_WITHOUT_BODY = {response: {status: 502}}
const UNDECODABLE_BODY_ERROR = {response: {status: 500, data: '<html><body>Bad Gateway</body></html>'}}
const SERVER_ERROR_WITH_UNRECOGNIZED_CODE = {response: {status: 503, data: {error: API_ERROR_CODES.stalePlan}}}
const SERVER_ERROR_WITH_HUMAN_STRING = {response: {status: 504, data: {error: 'Failed to log meal'}}}
const SERVER_ERROR_WITH_NON_STRING_CODE = {response: {status: 500, data: {error: 42}}}
const STALE_PLAN_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}}
const PLAN_NOT_ACTIVE_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}}
const IDEMPOTENCY_CONFLICT_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.idempotencyConflict}}}
const INVALID_REQUEST_ERROR = {response: {status: 400, data: {error: API_ERROR_CODES.invalidRequest}}}
const HUMAN_STRING_NOT_FOUND_ERROR = {response: {status: 404, data: {error: 'Meal plan meal not found'}}}
const FEATURE_DISABLED_SERVER_ERROR = {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}}

// The log fault seam of the plan's device checklist: the server commits the diary insert and then destroys the
// socket, so what reaches the client is an ordinary thrown Error over a write that already happened.
const DESTROYED_SOCKET_ERROR = new Error('socket hang up')

// The same confirmed refusal as STALE_PLAN_ERROR, thrown rather than plain: classification reads the two
// fields off whatever it is handed, and both shapes reach the predicate in practice.
const STALE_PLAN_ERROR_INSTANCE = Object.assign(new Error('Request failed with status code 409'), {
  response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}
})

const EXPECTED_INVALIDATED_KEYS: QueryKey[] = [
  queryKeys.dailyMacros(DATE),
  queryKeys.macrosHistory,
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll
]

const seedCache = (client: QueryClient): void => {
  client.setQueryData(queryKeys.dailyMacros(DATE), {seeded: true})
  client.setQueryData(queryKeys.dailyMacros(OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.macrosHistory, {seeded: true})
  client.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(PLAN_ID, DATE), {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, 3), {seeded: true})
  client.setQueryData(queryKeys.groceryList(PLAN_ID), {seeded: true})
  client.setQueryData(queryKeys.aiUsage, {seeded: true})
}

const invokeOnSuccess = (options: LogOptions, variables: LogPlannedMealPayload, context?: unknown): void => {
  // Narrowed because UseMutationOptions declares onSuccess optional plus a trailing context parameter this
  // factory ignores; the assertions below prove it ran.
  const onSuccess = options.onSuccess as (
    data: LogPlannedMealResult,
    variables: LogPlannedMealPayload,
    context?: unknown
  ) => void

  onSuccess(LOG_RESULT, variables, context)
}

// Narrowed to `unknown` because `retry` is a union with a plain boolean and a number, and because the rejection
// the predicate is handed is only declared an Error: the transport also loses responses as bare shapes.
const retryPredicate = (options: LogOptions): ((failureCount: number, error: unknown) => boolean) =>
  options.retry as (failureCount: number, error: unknown) => boolean

const invalidatedKeys = (spy: jest.SpyInstance): (QueryKey | undefined)[] =>
  spy.mock.calls.map(([filters]) => filters?.queryKey)

const serializedInvalidatedKeys = (spy: jest.SpyInstance): string[] =>
  invalidatedKeys(spy).map(queryKey => JSON.stringify(queryKey))

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

let queryClient: QueryClient

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('buildLogPlannedMealMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized planned-log mutation key', () => {
      const options = buildLogPlannedMealMutationOptions(queryClient)

      expect(options.mutationKey).toBe(mutationKeys.logPlannedMeal)
    })

    it('leaves the mutation function to the hook, which alone knows the plan and meal ids', () => {
      const options = buildLogPlannedMealMutationOptions(queryClient)

      expect('mutationFn' in options).toBe(false)
      expect(typeof options.onSuccess).toBe('function')
      expect(typeof options.retry).toBe('function')
    })

    it('declares the retry policy and the success invalidation and no other callback', () => {
      const options = buildLogPlannedMealMutationOptions(queryClient)

      expect(Object.keys(options)).toEqual(['mutationKey', 'retry', 'retryDelay', 'onSuccess'])
    })

    it('waits 1500 ms before the single automatic retry', () => {
      const options = buildLogPlannedMealMutationOptions(queryClient)

      expect(options.retryDelay).toBe(1500)
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')

      buildLogPlannedMealMutationOptions(queryClient)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess invalidation', () => {
    it('invalidates exactly the logged diary day, macros history, the current plan and every plan day', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload())

      expect(invalidatedKeys(spy)).toEqual(EXPECTED_INVALIDATED_KEYS)
      expect(serializedInvalidatedKeys(spy).sort()).toEqual(
        EXPECTED_INVALIDATED_KEYS.map(queryKey => JSON.stringify(queryKey)).sort()
      )
      expect(spy).toHaveBeenCalledTimes(4)
    })

    it('reaches every plan-day detail through the plan-day family root', () => {
      seedCache(queryClient)

      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload())

      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.macrosHistory)).toBe(true)
    })

    it('leaves the grocery list, swap previews and unrelated domains valid', () => {
      seedCache(queryClient)

      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload())

      expect(isQueryInvalidated(queryClient, queryKeys.groceryList(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, 3))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.aiUsage)).toBe(false)
    })

    it('neither removes nor rewrites cache entries, because a diary write recomputes nothing locally', () => {
      seedCache(queryClient)

      const previewKey = queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, 3)
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload())

      expect(removeSpy).toHaveBeenCalledTimes(0)
      expect(writeSpy).toHaveBeenCalledTimes(0)
      expect(queryClient.getQueryData(previewKey)).toEqual({seeded: true})
    })

    it('performs the same cache work whatever portion of the meal was eaten', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload({servings: 0.5}))

      const halfPortionKeys = serializedInvalidatedKeys(spy)

      spy.mockClear()
      invokeOnSuccess(options, makePayload({servings: 3}))

      expect(serializedInvalidatedKeys(spy)).toEqual(halfPortionKeys)
      expect(halfPortionKeys).toEqual(EXPECTED_INVALIDATED_KEYS.map(queryKey => JSON.stringify(queryKey)))
    })

    it('ignores the mutation context, so the absence of an onMutate cannot break the settle', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload(), undefined)
      invokeOnSuccess(options, makePayload(), {previousDay: {seeded: true}})

      expect(invalidatedKeys(spy)).toEqual([...EXPECTED_INVALIDATED_KEYS, ...EXPECTED_INVALIDATED_KEYS])
    })

    it('invalidates the same four keys against an empty cache', () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload())

      expect(invalidatedKeys(spy)).toEqual(EXPECTED_INVALIDATED_KEYS)
      expect(queryClient.getQueryState(queryKeys.dailyMacros(DATE))).toBeUndefined()
    })
  })

  describe('the diary date comes from the mutation variables', () => {
    it('invalidates the day the variables name and leaves the other day valid', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload({date: DATE}))

      expect(invalidatedKeys(spy)[0]).toEqual(queryKeys.dailyMacros(DATE))
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(OTHER_DATE))).toBe(false)
    })

    it('follows the date stepper to another day of the plan week on the next invocation', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload({date: OTHER_DATE}))

      expect(invalidatedKeys(spy)[0]).toEqual(queryKeys.dailyMacros(OTHER_DATE))
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(DATE))).toBe(false)
    })

    it('never invalidates the whole daily-macros family through its root key', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload({date: DATE}))
      invokeOnSuccess(options, makePayload({date: OTHER_DATE}))

      expect(serializedInvalidatedKeys(spy)).not.toContain(JSON.stringify(queryKeys.dailyMacrosAll))
    })

    it('keeps an empty date string a detail key rather than the daily-macros root', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildLogPlannedMealMutationOptions(queryClient)

      invokeOnSuccess(options, makePayload({date: ''}))

      expect(invalidatedKeys(spy)[0]).toEqual(queryKeys.dailyMacros(''))
      expect(spy).toHaveBeenCalledTimes(4)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(DATE))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(OTHER_DATE))).toBe(false)
    })
  })

  describe('the unknown-outcome-only retry', () => {
    it('retries a lost response once, because the same idempotency key cannot log a second entry', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, TRANSPORT_LOSS_ERROR)).toBe(true)
    })

    it('stops after that one retry however the outcome stays unknown', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(1, TRANSPORT_LOSS_ERROR)).toBe(false)
      expect(retry(2, TRANSPORT_LOSS_ERROR)).toBe(false)
    })

    it('retries the destroyed socket of an already committed log, which a replay answers with that entry', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, DESTROYED_SOCKET_ERROR)).toBe(true)
      expect(retry(1, DESTROYED_SOCKET_ERROR)).toBe(false)
    })

    it('retries a 5xx that carries no recognised machine code, an undecodable body, null or undefined', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, GATEWAY_ERROR_WITHOUT_CODE)).toBe(true)
      expect(retry(0, SERVER_ERROR_WITH_UNRECOGNIZED_CODE)).toBe(true)
      expect(retry(0, UNDECODABLE_BODY_ERROR)).toBe(true)
      expect(retry(0, null)).toBe(true)
      expect(retry(0, undefined)).toBe(true)
    })

    it('never retries a 4xx whose body decodes, whether it carries a code or a human string', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, STALE_PLAN_ERROR)).toBe(false)
      expect(retry(0, HUMAN_STRING_NOT_FOUND_ERROR)).toBe(false)
    })

    it('never retries a 5xx that carries a recognised failure code', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, FEATURE_DISABLED_SERVER_ERROR)).toBe(false)
    })

    it('retries a 5xx carrying a human string, no body at all, or a code that is not a string', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, SERVER_ERROR_WITH_HUMAN_STRING)).toBe(true)
      expect(retry(0, GATEWAY_ERROR_WITHOUT_BODY)).toBe(true)
      expect(retry(0, SERVER_ERROR_WITH_NON_STRING_CODE)).toBe(true)
    })

    it('never retries a plan-state or key refusal, which the same key would only be answered again', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, PLAN_NOT_ACTIVE_ERROR)).toBe(false)
      expect(retry(0, IDEMPOTENCY_CONFLICT_ERROR)).toBe(false)
      expect(retry(0, INVALID_REQUEST_ERROR)).toBe(false)
    })

    it('reads a thrown Error carrying the response shape exactly as it reads the bare shape', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, STALE_PLAN_ERROR_INSTANCE)).toBe(retry(0, STALE_PLAN_ERROR))
      expect(retry(0, STALE_PLAN_ERROR_INSTANCE)).toBe(false)
    })

    it('retries a rejection of any other shape, having no described outcome to trust', () => {
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      expect(retry(0, 'socket hang up')).toBe(true)
      expect(retry(0, 502)).toBe(true)
      expect(retry(0, {})).toBe(true)
    })

    it('touches no cache while classifying a failure', () => {
      seedCache(queryClient)

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const retry = retryPredicate(buildLogPlannedMealMutationOptions(queryClient))

      retry(0, TRANSPORT_LOSS_ERROR)
      retry(0, STALE_PLAN_ERROR)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })
  })
})
