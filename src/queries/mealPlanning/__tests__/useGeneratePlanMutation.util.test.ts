import {MealPlan} from '@data/models/MealPlan'
import {GeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {mutationKeys, queryKeys} from '@queries/keys'
import {MutationFunctionContext, QueryClient, QueryKey} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {buildGeneratePlanMutationOptions} from '../useGeneratePlanMutation.util'

const PLAN_A = 'plan-a'
const PLAN_B = 'plan-b'
const DATE = '2026-07-06'
const OTHER_DATE = '2026-07-09'
const MEAL_ID = 'meal-1'
const RECIPE_VERSION_ID = 'recipe-version-1'
const PLAN_REVISION = 3

type GenerateOptions = ReturnType<typeof buildGeneratePlanMutationOptions>

type RetryPredicate = (failureCount: number, error: unknown) => boolean

const GENERATE_VARIABLES: GeneratePlanPayload = {
  startDate: DATE,
  idempotencyKey: 'b0a1c2d3-e4f5-4a6b-8c9d-0e1f2a3b4c5d',
  expectedPreferencesRevision: 4,
  expectedTargetsRevision: 2
}

// A different week, a different minted key and different expected revisions: nothing the factory does may be
// derived from them, so a second payload has to produce the same cache work.
const SECOND_GENERATE_VARIABLES: GeneratePlanPayload = {
  startDate: '2026-08-03',
  idempotencyKey: 'a9b8c7d6-e5f4-4a3b-8c2d-1e0f9a8b7c6d',
  expectedPreferencesRevision: 11,
  expectedTargetsRevision: 5
}

const makeMealPlan = (): MealPlan => ({
  id: PLAN_A,
  revision: 1,
  generationAttempt: 1,
  startDate: DATE,
  endDate: '2026-07-12',
  status: 'active',
  targets: {calories: 2100, protein: 150, carbs: 210, fat: 70},
  generationTargets: {calories: 2100, protein: 150, carbs: 210, fat: 70},
  targetsStale: false,
  preferencesRevision: 4,
  targetsRevision: 2,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 34, loggedEntryCount: 0},
  days: []
})

const INVALIDATED_KEYS: QueryKey[] = [
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll,
  queryKeys.groceryListAll,
  queryKeys.affectedMealsAll,
  queryKeys.swapAlternativesAll,
  queryKeys.mealPlanPreferences
]

// Details of two different plans, because a generation publishes a plan id nothing in the cache is keyed to:
// only a family root can reach both what the previous plan left behind and what the new one will write.
const DETAIL_KEYS: QueryKey[] = [
  queryKeys.mealPlanDay(PLAN_A, DATE),
  queryKeys.mealPlanDay(PLAN_B, OTHER_DATE),
  queryKeys.groceryList(PLAN_A),
  queryKeys.groceryList(PLAN_B),
  queryKeys.affectedMeals(PLAN_A),
  queryKeys.swapAlternatives(PLAN_A, MEAL_ID, PLAN_REVISION)
]

const UNRELATED_KEYS: QueryKey[] = [queryKeys.exercises, queryKeys.foods]

const PREVIEW_KEY = queryKeys.swapPreview(PLAN_A, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION)

const SEEDED_KEYS: QueryKey[] = [...INVALIDATED_KEYS, ...DETAIL_KEYS, ...UNRELATED_KEYS, PREVIEW_KEY]

const seedCache = (client: QueryClient): void => {
  SEEDED_KEYS.forEach(queryKey => client.setQueryData(queryKey, {seeded: true}))
}

const createQueryClient = (): QueryClient =>
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})

const invokeOnSuccess = (options: GenerateOptions, variables: GeneratePlanPayload = GENERATE_VARIABLES): void => {
  // Narrowed because this version of UseMutationOptions declares onSuccess optional plus the two trailing
  // parameters (onMutateResult, context) the parameterless factory handler ignores.
  const onSuccess = options.onSuccess as (data: MealPlan, variables: GeneratePlanPayload) => void

  onSuccess(makeMealPlan(), variables)
}

const invokeOnSuccessWithTrailingArguments = (options: GenerateOptions, client: QueryClient): void => {
  const onSuccess = options.onSuccess as (
    data: MealPlan,
    variables: GeneratePlanPayload,
    onMutateResult: unknown,
    context: MutationFunctionContext
  ) => void

  onSuccess(makeMealPlan(), GENERATE_VARIABLES, undefined, {
    client,
    meta: undefined,
    mutationKey: mutationKeys.generatePlan
  })
}

// Narrowed because retry is declared as RetryValue<Error> (boolean | number | predicate) and the fixtures
// below deliberately include non-Error values the transport can hand back.
const retryPredicateOf = (options: GenerateOptions): RetryPredicate => options.retry as RetryPredicate

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

const invalidatedKeysFrom = (spy: jest.SpyInstance): unknown[] => spy.mock.calls.map(([filters]) => filters?.queryKey)

// Serialised and sorted, because the contract is a set: a missing or an extra key has to fail, while the order
// the factory happens to call them in carries no meaning and must not.
const sortedSerialized = (keys: unknown[]): string[] => keys.map(queryKey => JSON.stringify(queryKey)).sort()

let queryClient: QueryClient

beforeEach(() => {
  queryClient = createQueryClient()
})

afterEach(() => {
  jest.restoreAllMocks()
  queryClient.clear()
})

describe('buildGeneratePlanMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized generate-plan mutation key', () => {
      const options = buildGeneratePlanMutationOptions(queryClient)

      expect(options.mutationKey).toBe(mutationKeys.generatePlan)
    })

    it('declares exactly the key, the retry policy and the success handler, and no mutation function', () => {
      const options = buildGeneratePlanMutationOptions(queryClient)

      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onSuccess', 'retry', 'retryDelay'])
      expect('mutationFn' in options).toBe(false)
      expect(typeof options.onSuccess).toBe('function')
      expect(typeof options.retry).toBe('function')
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      seedCache(queryClient)

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')

      buildGeneratePlanMutationOptions(queryClient)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
      expect(queryClient.getQueryData(PREVIEW_KEY)).toEqual({seeded: true})
    })
  })

  describe('onSuccess cache ownership', () => {
    it('invalidates exactly the current plan, plan days, groceries, affected meals, alternatives and preferences', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      expect(sortedSerialized(invalidatedKeysFrom(spy))).toEqual(sortedSerialized(INVALIDATED_KEYS))
      expect(spy).toHaveBeenCalledTimes(INVALIDATED_KEYS.length)
    })

    it('invalidates the saved preferences, which a published plan completes the setup status of', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      expect(sortedSerialized(invalidatedKeysFrom(spy))).toContain(JSON.stringify(queryKeys.mealPlanPreferences))
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanPreferences)).toBe(true)
    })

    it('names family roots only, never a per-plan detail key the new plan id would not match', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      const invalidated = sortedSerialized(invalidatedKeysFrom(spy))

      sortedSerialized(DETAIL_KEYS).forEach(queryKey => expect(invalidated).not.toContain(queryKey))
    })

    it('reaches the detail entries of both plans through the family roots', () => {
      seedCache(queryClient)

      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      DETAIL_KEYS.forEach(queryKey => expect(isQueryInvalidated(queryClient, queryKey)).toBe(true))
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanPreferences)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.swapAlternativesAll)).toBe(true)
    })

    it('leaves unrelated domains valid and readable', () => {
      seedCache(queryClient)

      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      UNRELATED_KEYS.forEach(queryKey => {
        expect(isQueryInvalidated(queryClient, queryKey)).toBe(false)
        expect(queryClient.getQueryData(queryKey)).toEqual({seeded: true})
      })
    })

    it('removes the preview family instead of invalidating it', () => {
      seedCache(queryClient)

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(invalidatedKeysFrom(invalidateSpy)).not.toContainEqual(queryKeys.swapPreviewAll)
      expect(queryClient.getQueryData(PREVIEW_KEY)).toBeUndefined()
    })

    it('never rewrites a cache entry', () => {
      seedCache(queryClient)

      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      expect(writeSpy).not.toHaveBeenCalled()
    })

    it('performs the same cache work for a second start date and idempotency key', () => {
      const otherClient = createQueryClient()

      seedCache(queryClient)
      seedCache(otherClient)

      const firstInvalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const firstRemoveSpy = jest.spyOn(queryClient, 'removeQueries')
      const secondInvalidateSpy = jest.spyOn(otherClient, 'invalidateQueries')
      const secondRemoveSpy = jest.spyOn(otherClient, 'removeQueries')

      invokeOnSuccess(buildGeneratePlanMutationOptions(queryClient), GENERATE_VARIABLES)
      invokeOnSuccess(buildGeneratePlanMutationOptions(otherClient), SECOND_GENERATE_VARIABLES)

      expect(invalidatedKeysFrom(secondInvalidateSpy)).toEqual(invalidatedKeysFrom(firstInvalidateSpy))
      expect(sortedSerialized(invalidatedKeysFrom(secondInvalidateSpy))).toEqual(sortedSerialized(INVALIDATED_KEYS))
      expect(secondRemoveSpy.mock.calls).toEqual(firstRemoveSpy.mock.calls)
      expect(otherClient.getQueryData(PREVIEW_KEY)).toBeUndefined()
    })

    it('ignores the onMutateResult and mutation context TanStack passes after the variables', () => {
      seedCache(queryClient)

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      expect(() => invokeOnSuccessWithTrailingArguments(options, queryClient)).not.toThrow()
      expect(sortedSerialized(invalidatedKeysFrom(invalidateSpy))).toEqual(sortedSerialized(INVALIDATED_KEYS))
      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
    })

    it('runs every operation against an empty cache without throwing', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      expect(() => invokeOnSuccess(options)).not.toThrow()
      expect(sortedSerialized(invalidatedKeysFrom(invalidateSpy))).toEqual(sortedSerialized(INVALIDATED_KEYS))
      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
    })
  })

  describe('retry policy', () => {
    it('retries an unknown outcome once, since the same key replays a generation that committed', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))
      const networkError = new Error('Network Error')

      expect(retry(0, networkError)).toBe(true)
      expect(retry(1, networkError)).toBe(false)
      expect(retry(2, networkError)).toBe(false)
    })

    it('does not retry a confirmed 4xx refusal, which the drawn failure screen reports as final', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}})).toBe(false)
      expect(retry(0, {response: {status: 409, data: {error: API_ERROR_CODES.staleRevision}}})).toBe(false)
    })

    it('does not retry a 5xx carrying a recognised machine code', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}})).toBe(false)
      expect(retry(0, {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(false)
    })

    it('reads a class instance and a plain object of the same shape as the same outcome', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))
      const refusal = {response: {status: 409, data: {error: API_ERROR_CODES.staleRevision}}}
      const thrownRefusal = Object.assign(new Error('Request failed'), refusal)

      expect(retry(0, thrownRefusal)).toBe(false)
      expect(retry(0, refusal)).toBe(false)
    })

    it('retries a 5xx whose body carries no recognised machine code', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 504, data: {error: 'Failed to generate plan'}}})).toBe(true)
      expect(retry(0, {response: {status: 502}})).toBe(true)
    })

    it('retries a response whose body does not decode to a machine-readable error', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 502, data: '<html>Bad Gateway</html>'}})).toBe(true)
      expect(retry(0, {response: {status: 500, data: {error: 42}}})).toBe(true)
      expect(retry(0, {response: {status: 500, data: null}})).toBe(true)
      expect(retry(0, {response: {status: 409, data: {}}})).toBe(true)
    })

    it('retries an error shape it cannot classify at all', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, null)).toBe(true)
      expect(retry(0, undefined)).toBe(true)
      expect(retry(0, 'boom')).toBe(true)
      expect(retry(0, 42)).toBe(true)
    })

    it('waits 1500 ms before the single replay', () => {
      const options = buildGeneratePlanMutationOptions(queryClient)

      expect(options.retryDelay).toBe(1500)
    })
  })
})
