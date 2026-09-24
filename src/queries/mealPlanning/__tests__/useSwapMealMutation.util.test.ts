import {MealPlanDay, MealPlanMeal} from '@data/models/MealPlan'
import {SwapMealPayload, SwapMealResult} from '@data/models/SwapAlternative'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'
import {API_ERROR_CODES, isUnknownOutcome} from '@utility/ApiErrorUtility'

import {buildSwapMealMutationOptions} from '../useSwapMealMutation.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const MEAL_ID = 'meal-1'
const OTHER_MEAL_ID = 'meal-2'
const DATE = '2026-07-05'
const OTHER_DATE = '2026-07-08'
const PLAN_REVISION = 4
const RECIPE_VERSION_ID = 'recipe-version-wrap'

type SwapOptions = ReturnType<typeof buildSwapMealMutationOptions>

const SWAP_PAYLOAD: SwapMealPayload = {
  recipeVersionId: RECIPE_VERSION_ID,
  portionMultiplier: 1,
  expectedPlanRevision: PLAN_REVISION,
  idempotencyKey: 'swap-intent-key-1'
}

const swappedMeal = (): MealPlanMeal => ({
  id: MEAL_ID,
  revision: 2,
  slot: 'lunch',
  slotTime: '12:30',
  sortOrder: 1,
  recipe: {
    versionId: RECIPE_VERSION_ID,
    recipeId: 'recipe-wrap',
    name: 'Turkey and hummus wrap',
    iconKey: 'wrap',
    totalMinutes: 15,
    badges: ['high_protein'],
    nutritionProvenance: 'source_backed'
  },
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: {calories: 540, protein: 38, carbs: 49, fat: 19},
  flags: [],
  previousRecipe: {versionId: 'recipe-version-bowl', name: 'Chicken burrito bowl'},
  loggedEntries: []
})

const swappedDay = (): MealPlanDay => ({
  id: 'day-1',
  date: DATE,
  dayIndex: 0,
  plannedTotals: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  isLastDay: false,
  meals: [swappedMeal()]
})

const swapResult = (): SwapMealResult => ({
  meal: swappedMeal(),
  day: swappedDay(),
  planRevision: PLAN_REVISION + 1,
  groceryChangeSummary: {added: 2, removed: 1, increased: 1}
})

const seedCache = (client: QueryClient): void => {
  client.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(PLAN_ID, DATE), {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.groceryList(PLAN_ID), {seeded: true})
  client.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), {seeded: true})
  client.setQueryData(queryKeys.affectedMeals(PLAN_ID), {seeded: true})
  client.setQueryData(queryKeys.affectedMeals(OTHER_PLAN_ID), {seeded: true})
  client.setQueryData(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION), {seeded: true})
  client.setQueryData(queryKeys.swapAlternatives(PLAN_ID, OTHER_MEAL_ID, PLAN_REVISION), {seeded: true})
  client.setQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION), {seeded: true})
  client.setQueryData(queryKeys.aiUsage, {seeded: true})
}

// The mix AAP 0.7.2 specifies for a committed swap: per-plan DETAIL keys for the one plan whose grocery list
// and flags moved, family ROOTS for the two families whose keys embed a date or the plan revision.
const expectedInvalidatedKeys = (planId: string): QueryKey[] => [
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll,
  queryKeys.groceryList(planId),
  queryKeys.affectedMeals(planId),
  queryKeys.swapAlternativesAll
]

const invokeOnSuccess = (options: SwapOptions, result: SwapMealResult = swapResult(), context?: unknown): void => {
  // Narrowed because UseMutationOptions declares onSuccess optional plus a trailing context parameter this
  // factory ignores; the assertions below prove it ran.
  const onSuccess = options.onSuccess as (data: SwapMealResult, variables: SwapMealPayload, context?: unknown) => void

  onSuccess(result, SWAP_PAYLOAD, context)
}

// Narrowed to `unknown` because `retry` is a union with a plain boolean and a number, and because the rejection
// the predicate is handed is only declared an Error: the transport also loses responses as bare shapes.
const retryPredicate = (options: SwapOptions): ((failureCount: number, error: unknown) => boolean) =>
  options.retry as (failureCount: number, error: unknown) => boolean

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

const serializeKeys = (keys: QueryKey[]): string[] => keys.map(queryKey => JSON.stringify(queryKey)).sort()

// Serialised and sorted, so the comparison is order-independent yet still exact: AAP 0.7.2 specifies a set, so
// the order of the calls is free to change while a missing or an extra key must fail.
const collectKeys = (spy: jest.SpyInstance): string[] =>
  spy.mock.calls.map(call => JSON.stringify((call[0] as {queryKey?: QueryKey} | undefined)?.queryKey)).sort()

// Plain shapes rather than AxiosError instances: classification reads only `response.status` and
// `response.data.error` off whatever it is handed, so this suite owes the transport no dependency.
const TRANSPORT_LOSS_ERROR = {message: 'Network Error'}

// The swap fault seam of the plan's device checklist: the server commits the swap and then destroys the
// socket, so what reaches the client is an ordinary thrown Error over a write that already happened.
const DESTROYED_SOCKET_ERROR = new Error('socket hang up')

const GATEWAY_ERROR_WITHOUT_CODE = {response: {status: 502, data: {}}}
const GATEWAY_ERROR_WITHOUT_BODY = {response: {status: 502}}
const UNDECODABLE_BODY_ERROR = {response: {status: 502, data: '<html><body>Bad Gateway</body></html>'}}
const SERVER_ERROR_WITH_NON_STRING_CODE = {response: {status: 500, data: {error: 42}}}
const SERVER_ERROR_WITH_HUMAN_STRING = {response: {status: 504, data: {error: 'Failed to swap meal'}}}
const SERVER_ERROR_WITH_UNRECOGNIZED_CODE = {response: {status: 503, data: {error: API_ERROR_CODES.stalePlan}}}
const SWAP_FAILED_ERROR = {response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}}
const PREVIEW_STALE_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.previewStale}}}
const STALE_PLAN_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}}
const PLAN_NOT_ACTIVE_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}}
const IDEMPOTENCY_CONFLICT_ERROR = {response: {status: 409, data: {error: API_ERROR_CODES.idempotencyConflict}}}
const RECIPE_INELIGIBLE_ERROR = {response: {status: 422, data: {error: API_ERROR_CODES.recipeIneligible}}}

// The same confirmed refusal as SWAP_FAILED_ERROR, thrown rather than plain: both shapes reach the predicate
// in practice, because classification duck-types whatever the transport rejected with.
const SWAP_FAILED_ERROR_INSTANCE = Object.assign(new Error('Request failed with status code 502'), {
  response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}
})

const EVERY_FAILURE_FIXTURE: unknown[] = [
  TRANSPORT_LOSS_ERROR,
  DESTROYED_SOCKET_ERROR,
  GATEWAY_ERROR_WITHOUT_CODE,
  GATEWAY_ERROR_WITHOUT_BODY,
  UNDECODABLE_BODY_ERROR,
  SERVER_ERROR_WITH_NON_STRING_CODE,
  SERVER_ERROR_WITH_HUMAN_STRING,
  SERVER_ERROR_WITH_UNRECOGNIZED_CODE,
  SWAP_FAILED_ERROR,
  PREVIEW_STALE_ERROR,
  STALE_PLAN_ERROR,
  PLAN_NOT_ACTIVE_ERROR,
  IDEMPOTENCY_CONFLICT_ERROR,
  RECIPE_INELIGIBLE_ERROR,
  SWAP_FAILED_ERROR_INSTANCE,
  null,
  undefined
]

let queryClient: QueryClient

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
  queryClient.clear()
})

describe('buildSwapMealMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized swap-meal mutation key', () => {
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(options.mutationKey).toBe(mutationKeys.swapMeal)
    })

    it('exposes a retry predicate and a success handler', () => {
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(typeof options.retry).toBe('function')
      expect(typeof options.onSuccess).toBe('function')
    })

    it('declares the key, the retry policy and the success invalidation and nothing else', () => {
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onSuccess', 'retry', 'retryDelay'])
    })

    it('delays the single replay by 1500 ms', () => {
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(options.retryDelay).toBe(1500)
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')

      buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess cache ownership', () => {
    it('invalidates exactly the five keys a committed swap affects and nothing besides them', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(collectKeys(spy)).toEqual(serializeKeys(expectedInvalidatedKeys(PLAN_ID)))
      expect(spy).toHaveBeenCalledTimes(5)
    })

    it('invalidates this plan grocery list and affected meals through their per-plan detail keys, not their roots', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(collectKeys(spy)).toContain(JSON.stringify(queryKeys.groceryList(PLAN_ID)))
      expect(collectKeys(spy)).toContain(JSON.stringify(queryKeys.affectedMeals(PLAN_ID)))
      expect(collectKeys(spy)).not.toContain(JSON.stringify(queryKeys.groceryListAll))
      expect(collectKeys(spy)).not.toContain(JSON.stringify(queryKeys.affectedMealsAll))
    })

    it('invalidates the plan-day and alternatives families through their roots, not through one date or revision', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(collectKeys(spy)).toContain(JSON.stringify(queryKeys.mealPlanDayAll))
      expect(collectKeys(spy)).toContain(JSON.stringify(queryKeys.swapAlternativesAll))
      expect(collectKeys(spy)).not.toContain(JSON.stringify(queryKeys.mealPlanDay(PLAN_ID, DATE)))
      expect(collectKeys(spy)).not.toContain(
        JSON.stringify(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))
      )
    })

    it('builds the two detail keys from the planId it was constructed with, not from the swapped meal payload', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, OTHER_PLAN_ID)

      invokeOnSuccess(options)

      expect(collectKeys(spy)).toEqual(serializeKeys(expectedInvalidatedKeys(OTHER_PLAN_ID)))
      expect(collectKeys(spy)).not.toContain(JSON.stringify(queryKeys.groceryList(PLAN_ID)))
      expect(collectKeys(spy)).not.toContain(JSON.stringify(queryKeys.affectedMeals(PLAN_ID)))
    })

    it('does the same cache work whether the swap added, removed or increased any grocery item', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options, {...swapResult(), groceryChangeSummary: {added: 0, removed: 0, increased: 0}})

      expect(collectKeys(spy)).toEqual(serializeKeys(expectedInvalidatedKeys(PLAN_ID)))
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('issues all six operations against an empty cache without throwing', () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(() => invokeOnSuccess(options)).not.toThrow()
      expect(collectKeys(spy)).toEqual(serializeKeys(expectedInvalidatedKeys(PLAN_ID)))
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('tolerates the undefined context of a factory that declares no onMutate', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      expect(() => invokeOnSuccess(options, swapResult(), undefined)).not.toThrow()
      expect(collectKeys(spy)).toEqual(serializeKeys(expectedInvalidatedKeys(PLAN_ID)))
    })

    it('still emits well-formed detail keys when built with an empty planId', () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, '')

      expect(() => invokeOnSuccess(options)).not.toThrow()
      expect(collectKeys(spy)).toEqual(serializeKeys(expectedInvalidatedKeys('')))
    })

    it('removes the preview family exactly once and writes nothing', () => {
      seedCache(queryClient)

      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(writeSpy).not.toHaveBeenCalled()
    })

    it('reaches every plan-day and alternatives detail through their family roots', () => {
      seedCache(queryClient)

      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.swapAlternatives(PLAN_ID, OTHER_MEAL_ID, PLAN_REVISION))).toBe(
        true
      )
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.groceryList(PLAN_ID))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.affectedMeals(PLAN_ID))).toBe(true)
    })

    it('leaves another plan grocery list, its affected meals and unrelated domains valid', () => {
      seedCache(queryClient)

      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.groceryList(OTHER_PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.affectedMeals(OTHER_PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.aiUsage)).toBe(false)
    })

    it('drops the cached preview entry while invalidated entries stay in the cache', () => {
      seedCache(queryClient)

      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      const previewKey = queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION)

      expect(queryClient.getQueryData(previewKey)).toBeUndefined()
      expect(queryClient.getQueryData(queryKeys.mealPlanCurrent)).toEqual({seeded: true})
      expect(queryClient.getQueryData(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))).toEqual({
        seeded: true
      })
    })
  })

  describe('the unknown-outcome-only retry', () => {
    it('retries once when the outcome is unknown, because replaying the same idempotency key returns the stored swap instead of swapping twice', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, TRANSPORT_LOSS_ERROR)).toBe(true)
    })

    it('retries the destroyed socket of an already committed swap, which the replay answers with that swap', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, DESTROYED_SOCKET_ERROR)).toBe(true)
    })

    it('allows that one automatic replay only, however long the outcome stays unknown', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(1, TRANSPORT_LOSS_ERROR)).toBe(false)
      expect(retry(2, TRANSPORT_LOSS_ERROR)).toBe(false)
      expect(retry(1, DESTROYED_SOCKET_ERROR)).toBe(false)
    })

    it('does not retry a confirmed 502 swap_failed, the response whose 13e copy promises the meal is unchanged', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, SWAP_FAILED_ERROR)).toBe(false)
    })

    it('does not retry a stale preview or an ineligible recipe, which a refreshed preview resolves rather than a replay', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, PREVIEW_STALE_ERROR)).toBe(false)
      expect(retry(0, RECIPE_INELIGIBLE_ERROR)).toBe(false)
    })

    it('does not retry a plan-state refusal, which the client answers by refetching the current plan', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, STALE_PLAN_ERROR)).toBe(false)
      expect(retry(0, PLAN_NOT_ACTIVE_ERROR)).toBe(false)
    })

    it('does not retry an idempotency conflict, the answer to reusing this key under a changed body', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, IDEMPOTENCY_CONFLICT_ERROR)).toBe(false)
    })

    it('retries a 5xx that carries no recognised machine code, a human string, no body at all or an unrecognised code', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, GATEWAY_ERROR_WITHOUT_CODE)).toBe(true)
      expect(retry(0, SERVER_ERROR_WITH_HUMAN_STRING)).toBe(true)
      expect(retry(0, GATEWAY_ERROR_WITHOUT_BODY)).toBe(true)
      expect(retry(0, SERVER_ERROR_WITH_UNRECOGNIZED_CODE)).toBe(true)
    })

    it('retries a body that does not decode to a machine code, whether it is markup or a non-string code', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, UNDECODABLE_BODY_ERROR)).toBe(true)
      expect(retry(0, SERVER_ERROR_WITH_NON_STRING_CODE)).toBe(true)
    })

    it('retries a rejection of any other shape, having no described outcome to trust', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, null)).toBe(true)
      expect(retry(0, undefined)).toBe(true)
      expect(retry(0, 'socket hang up')).toBe(true)
      expect(retry(0, 502)).toBe(true)
      expect(retry(0, {})).toBe(true)
    })

    it('reads a thrown Error carrying the response shape exactly as it reads the bare shape', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, SWAP_FAILED_ERROR_INSTANCE)).toBe(retry(0, SWAP_FAILED_ERROR))
      expect(retry(0, SWAP_FAILED_ERROR_INSTANCE)).toBe(false)
    })

    it('defers the confirmed-or-unknown decision to the shared classification for every failure shape', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      EVERY_FAILURE_FIXTURE.forEach(error => {
        expect(retry(0, error)).toBe(isUnknownOutcome(error))
      })
    })

    it('touches no cache while classifying a failure', () => {
      seedCache(queryClient)

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      retry(0, TRANSPORT_LOSS_ERROR)
      retry(0, SWAP_FAILED_ERROR)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })
  })
})
