import {MealPlan} from '@data/models/MealPlan'
import {GeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'
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

const PREVIEW_KEY = queryKeys.swapPreview(PLAN_A, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION)

const seedCache = (client: QueryClient): void => {
  INVALIDATED_KEYS.forEach(queryKey => client.setQueryData(queryKey, {seeded: true}))
  client.setQueryData(queryKeys.mealPlanDay(PLAN_A, DATE), {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(PLAN_B, OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.groceryList(PLAN_A), {seeded: true})
  client.setQueryData(queryKeys.groceryList(PLAN_B), {seeded: true})
  client.setQueryData(queryKeys.affectedMeals(PLAN_A), {seeded: true})
  client.setQueryData(PREVIEW_KEY, {seeded: true})
  client.setQueryData(queryKeys.exercises, {seeded: true})
  client.setQueryData(queryKeys.foods, {seeded: true})
}

const invokeOnSuccess = (options: GenerateOptions): void => {
  // Narrowed because this version of UseMutationOptions declares onSuccess optional plus the two trailing
  // parameters (onMutateResult, context) the parameterless factory handler ignores.
  const onSuccess = options.onSuccess as (data: MealPlan, variables: GeneratePlanPayload) => void

  onSuccess(makeMealPlan(), GENERATE_VARIABLES)
}

// Narrowed because retry is declared as RetryValue<Error> (boolean | number | predicate) and the fixtures
// below deliberately include non-Error values the transport can hand back.
const retryPredicateOf = (options: GenerateOptions): RetryPredicate => options.retry as RetryPredicate

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

const invalidatedKeysFrom = (spy: jest.SpyInstance): unknown[] => spy.mock.calls.map(([filters]) => filters?.queryKey)

let queryClient: QueryClient

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
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

      expect(invalidatedKeysFrom(spy)).toEqual(INVALIDATED_KEYS)
      expect(spy).toHaveBeenCalledTimes(INVALIDATED_KEYS.length)
    })

    it('reaches the detail entries of both plans through the family roots', () => {
      seedCache(queryClient)

      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_A, DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_B, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.groceryList(PLAN_A))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.groceryList(PLAN_B))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.affectedMeals(PLAN_A))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanPreferences)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.swapAlternativesAll)).toBe(true)
    })

    it('leaves unrelated domains valid', () => {
      seedCache(queryClient)

      const options = buildGeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.exercises)).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.foods)).toBe(false)
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

    it('runs every operation against an empty cache without throwing', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildGeneratePlanMutationOptions(queryClient)

      expect(() => invokeOnSuccess(options)).not.toThrow()
      expect(invalidatedKeysFrom(invalidateSpy)).toEqual(INVALIDATED_KEYS)
      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
    })
  })

  describe('retry policy', () => {
    it('retries an unknown outcome exactly once', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))
      const networkError = new Error('Network Error')

      expect(retry(0, networkError)).toBe(true)
      expect(retry(1, networkError)).toBe(false)
      expect(retry(2, networkError)).toBe(false)
    })

    it('does not retry a confirmed 4xx refusal', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}})).toBe(false)
      expect(retry(0, {response: {status: 409, data: {error: API_ERROR_CODES.staleRevision}}})).toBe(false)
    })

    it('does not retry a 5xx carrying a recognised machine code', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}})).toBe(false)
    })

    it('retries a 5xx whose body carries no recognised machine code', () => {
      const retry = retryPredicateOf(buildGeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 504, data: {error: 'Failed to generate plan'}}})).toBe(true)
      expect(retry(0, {response: {status: 502}})).toBe(true)
      expect(retry(0, {response: {status: 502, data: '<html>Bad Gateway</html>'}})).toBe(true)
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
