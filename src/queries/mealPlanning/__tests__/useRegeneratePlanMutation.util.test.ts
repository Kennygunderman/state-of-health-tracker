import {MealPlan} from '@data/models/MealPlan'
import {RegeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {buildRegeneratePlanMutationOptions} from '../useRegeneratePlanMutation.util'

const DATE = '2026-07-06'
const OLD_PLAN_ID = 'plan-old'
const NEW_PLAN_ID = 'plan-new'
const MEAL_ID = 'meal-1'
const RECIPE_VERSION_ID = 'recipe-version-1'
const OLD_PLAN_REVISION = 3

type RegenerateOptions = ReturnType<typeof buildRegeneratePlanMutationOptions>

const REGENERATE_VARIABLES: RegeneratePlanPayload = {
  idempotencyKey: 'c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f',
  expectedPlanRevision: OLD_PLAN_REVISION,
  expectedPreferencesRevision: 5,
  expectedTargetsRevision: 2
}

const SECOND_REGENERATE_VARIABLES: RegeneratePlanPayload = {
  idempotencyKey: 'd2e3f4a5-b6c7-4d8e-9f0a-1b2c3d4e5f60',
  expectedPlanRevision: 9,
  expectedPreferencesRevision: 6,
  expectedTargetsRevision: 4
}

const MACROS = {calories: 1940, protein: 146, carbs: 194, fat: 65}

// The published plan carries a NEW id: regeneration supersedes the plan the request named, so nothing in the
// success path may be keyed to the id the caller sent.
const REGENERATED_PLAN: MealPlan = {
  id: NEW_PLAN_ID,
  revision: 1,
  generationAttempt: 2,
  startDate: DATE,
  endDate: '2026-07-12',
  status: 'active',
  targets: MACROS,
  generationTargets: MACROS,
  targetsStale: false,
  preferencesRevision: 5,
  targetsRevision: 2,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 34, loggedEntryCount: 2},
  days: []
}

const EXPECTED_INVALIDATED_KEYS: QueryKey[] = [
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll,
  queryKeys.groceryListAll,
  queryKeys.affectedMealsAll,
  queryKeys.swapAlternativesAll,
  queryKeys.mealPlanPreferences
]

// Details of both the superseded plan and its replacement: the family roots above are the only thing that can
// reach both, which is what makes a per-plan detail key the wrong choice here.
const SEEDED_DETAIL_KEYS: QueryKey[] = [
  queryKeys.mealPlanDay(OLD_PLAN_ID, DATE),
  queryKeys.mealPlanDay(NEW_PLAN_ID, DATE),
  queryKeys.groceryList(OLD_PLAN_ID),
  queryKeys.groceryList(NEW_PLAN_ID),
  queryKeys.affectedMeals(OLD_PLAN_ID),
  queryKeys.swapAlternatives(OLD_PLAN_ID, MEAL_ID, OLD_PLAN_REVISION)
]

const SEEDED_PREVIEW_KEY: QueryKey = queryKeys.swapPreview(OLD_PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, OLD_PLAN_REVISION)

const UNRELATED_KEYS: QueryKey[] = [queryKeys.exercises, queryKeys.foods]

const SEEDED_KEYS: QueryKey[] = [
  ...EXPECTED_INVALIDATED_KEYS,
  ...SEEDED_DETAIL_KEYS,
  SEEDED_PREVIEW_KEY,
  ...UNRELATED_KEYS
]

const createQueryClient = (): QueryClient =>
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})

const seedCache = (client: QueryClient): void => {
  SEEDED_KEYS.forEach(queryKey => client.setQueryData(queryKey, {seeded: true}))
}

const spyOnInvalidate = (client: QueryClient) => jest.spyOn(client, 'invalidateQueries')

const invalidatedKeys = (spy: ReturnType<typeof spyOnInvalidate>): QueryKey[] =>
  spy.mock.calls.map(([filters]) => filters?.queryKey as QueryKey)

const serialize = (keys: QueryKey[]): string[] => keys.map(queryKey => JSON.stringify(queryKey))

const invokeOnSuccess = (options: RegenerateOptions, variables: RegeneratePlanPayload): void => {
  // Narrowed to two parameters because v5's onSuccess also declares onMutateResult and a
  // MutationFunctionContext that this factory ignores; calling it with fewer than four args is otherwise a
  // type error. The assertions below prove it ran.
  const onSuccess = options.onSuccess as (data: MealPlan, variables: RegeneratePlanPayload) => void

  onSuccess(REGENERATED_PLAN, variables)
}

const retryPredicate = (options: RegenerateOptions): ((failureCount: number, error: unknown) => boolean) =>
  // RetryValue<Error> also admits a boolean and a number, and the predicate is documented against arbitrary
  // transport failures, so the fixtures below are typed as unknown rather than as Error.
  options.retry as (failureCount: number, error: unknown) => boolean

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

let queryClient: QueryClient

beforeEach(() => {
  queryClient = createQueryClient()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('buildRegeneratePlanMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized regenerate-plan mutation key', () => {
      const options = buildRegeneratePlanMutationOptions(queryClient)

      expect(options.mutationKey).toBe(mutationKeys.regeneratePlan)
    })

    it('takes the query client alone, so no plan id can narrow the invalidation to one plan', () => {
      expect(buildRegeneratePlanMutationOptions.length).toBe(1)
    })

    it('declares the success handler and the retry policy, and no mutation function', () => {
      const options = buildRegeneratePlanMutationOptions(queryClient)

      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onSuccess', 'retry', 'retryDelay'])
      expect('mutationFn' in options).toBe(false)
      expect(typeof options.onSuccess).toBe('function')
      expect(typeof options.retry).toBe('function')
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      seedCache(queryClient)

      const invalidateSpy = spyOnInvalidate(queryClient)
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')

      buildRegeneratePlanMutationOptions(queryClient)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(false)
    })
  })

  describe('onSuccess cache ownership', () => {
    it('invalidates exactly the six plan-wide roots, in order', () => {
      seedCache(queryClient)

      const invalidateSpy = spyOnInvalidate(queryClient)
      const options = buildRegeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options, REGENERATE_VARIABLES)

      expect(invalidatedKeys(invalidateSpy)).toEqual(EXPECTED_INVALIDATED_KEYS)
      expect(invalidateSpy).toHaveBeenCalledTimes(6)
    })

    it('reaches every seeded detail of both the superseded and the replacement plan through those roots', () => {
      seedCache(queryClient)

      const options = buildRegeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options, REGENERATE_VARIABLES)

      SEEDED_DETAIL_KEYS.forEach(queryKey => expect(isQueryInvalidated(queryClient, queryKey)).toBe(true))
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanPreferences)).toBe(true)
    })

    it('names no detail key in the invalidation, only the family roots', () => {
      seedCache(queryClient)

      const invalidateSpy = spyOnInvalidate(queryClient)
      const options = buildRegeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options, REGENERATE_VARIABLES)

      const invalidated = serialize(invalidatedKeys(invalidateSpy))

      serialize(SEEDED_DETAIL_KEYS).forEach(queryKey => expect(invalidated).not.toContain(queryKey))
    })

    it('leaves unrelated domains valid and readable', () => {
      seedCache(queryClient)

      const options = buildRegeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options, REGENERATE_VARIABLES)

      UNRELATED_KEYS.forEach(queryKey => {
        expect(isQueryInvalidated(queryClient, queryKey)).toBe(false)
        expect(queryClient.getQueryData(queryKey)).toEqual({seeded: true})
      })
    })

    it('removes the swap previews rather than invalidating them', () => {
      seedCache(queryClient)

      const invalidateSpy = spyOnInvalidate(queryClient)
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildRegeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options, REGENERATE_VARIABLES)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(serialize(invalidatedKeys(invalidateSpy))).not.toContain(JSON.stringify(queryKeys.swapPreviewAll))
      expect(queryClient.getQueryData(SEEDED_PREVIEW_KEY)).toBeUndefined()
    })

    it('writes nothing into the cache', () => {
      seedCache(queryClient)

      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildRegeneratePlanMutationOptions(queryClient)

      invokeOnSuccess(options, REGENERATE_VARIABLES)

      expect(writeSpy).not.toHaveBeenCalled()
    })

    it('performs the same cache work for a second idempotency key and expected plan revision', () => {
      const otherClient = createQueryClient()

      seedCache(queryClient)
      seedCache(otherClient)

      const firstInvalidateSpy = spyOnInvalidate(queryClient)
      const firstRemoveSpy = jest.spyOn(queryClient, 'removeQueries')
      const secondInvalidateSpy = spyOnInvalidate(otherClient)
      const secondRemoveSpy = jest.spyOn(otherClient, 'removeQueries')

      invokeOnSuccess(buildRegeneratePlanMutationOptions(queryClient), REGENERATE_VARIABLES)
      invokeOnSuccess(buildRegeneratePlanMutationOptions(otherClient), SECOND_REGENERATE_VARIABLES)

      expect(invalidatedKeys(secondInvalidateSpy)).toEqual(invalidatedKeys(firstInvalidateSpy))
      expect(invalidatedKeys(secondInvalidateSpy)).toEqual(EXPECTED_INVALIDATED_KEYS)
      expect(secondRemoveSpy.mock.calls).toEqual(firstRemoveSpy.mock.calls)
      expect(queryClient.getQueryData(SEEDED_PREVIEW_KEY)).toBeUndefined()
      expect(otherClient.getQueryData(SEEDED_PREVIEW_KEY)).toBeUndefined()
    })

    it('performs every operation against an empty cache without throwing', () => {
      const invalidateSpy = spyOnInvalidate(queryClient)
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildRegeneratePlanMutationOptions(queryClient)

      expect(() => invokeOnSuccess(options, REGENERATE_VARIABLES)).not.toThrow()
      expect(invalidatedKeys(invalidateSpy)).toEqual(EXPECTED_INVALIDATED_KEYS)
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('retry', () => {
    it('retries an unknown outcome exactly once', () => {
      const retry = retryPredicate(buildRegeneratePlanMutationOptions(queryClient))
      const transportError = new Error('Network Error')

      expect(retry(0, transportError)).toBe(true)
      expect(retry(1, transportError)).toBe(false)
      expect(retry(2, transportError)).toBe(false)
    })

    it('does not retry a confirmed refusal the same key would only repeat', () => {
      const retry = retryPredicate(buildRegeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(false)
      expect(retry(0, {response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(false)
      expect(retry(0, {response: {status: 409, data: {error: API_ERROR_CODES.staleRevision}}})).toBe(false)
      expect(retry(0, {response: {status: 409, data: {error: API_ERROR_CODES.idempotencyConflict}}})).toBe(false)
      expect(retry(0, {response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}})).toBe(false)
    })

    it('does not retry a 5xx carrying a recognised machine code, which is a confirmed failure', () => {
      const retry = retryPredicate(buildRegeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}})).toBe(false)
      expect(retry(0, {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(false)
    })

    it('retries a 5xx whose body carries no recognised machine code', () => {
      const retry = retryPredicate(buildRegeneratePlanMutationOptions(queryClient))

      expect(retry(0, {response: {status: 504, data: {error: 'Failed to regenerate plan'}}})).toBe(true)
      expect(retry(0, {response: {status: 502}})).toBe(true)
      expect(retry(0, {response: {status: 502, data: '<html>Bad Gateway</html>'}})).toBe(true)
    })

    it('retries an error it cannot read at all, without throwing', () => {
      const retry = retryPredicate(buildRegeneratePlanMutationOptions(queryClient))

      expect(() => retry(0, null)).not.toThrow()
      expect(retry(0, null)).toBe(true)
      expect(retry(0, undefined)).toBe(true)
      expect(retry(0, 'boom')).toBe(true)
      expect(retry(0, 42)).toBe(true)
    })

    it('waits 1500 ms before that single replay', () => {
      const options = buildRegeneratePlanMutationOptions(queryClient)

      expect(options.retryDelay).toBe(1500)
    })
  })
})
