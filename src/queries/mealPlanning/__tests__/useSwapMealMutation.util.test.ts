import {MealPlanDay, MealPlanMeal} from '@data/models/MealPlan'
import {SwapMealPayload, SwapMealResult} from '@data/models/SwapAlternative'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'
import {AxiosError, AxiosResponse} from 'axios'

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

const invokeOnSuccess = (options: SwapOptions): void => {
  // Narrowed because UseMutationOptions declares onSuccess optional plus trailing
  // context parameters this factory ignores; the assertions below prove it ran.
  const onSuccess = options.onSuccess as (data: SwapMealResult, variables: SwapMealPayload) => void

  onSuccess(swapResult(), SWAP_PAYLOAD)
}

const retryPredicate = (options: SwapOptions): ((failureCount: number, error: Error) => boolean) =>
  // Narrowed because `retry` is declared as boolean | number | predicate; the option-surface test
  // above pins that this factory supplies the predicate form.
  options.retry as (failureCount: number, error: Error) => boolean

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

const axiosError = (status?: number, body?: unknown): AxiosError => {
  const response = status === undefined ? undefined : ({status, data: body} as AxiosResponse)

  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response)
}

let queryClient: QueryClient

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
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
    it('invalidates the current plan, every plan day, this plan grocery list and affected meals, then every alternatives list', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSwapMealMutationOptions(queryClient, PLAN_ID)

      invokeOnSuccess(options)

      expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
        queryKeys.mealPlanCurrent,
        queryKeys.mealPlanDayAll,
        queryKeys.groceryList(PLAN_ID),
        queryKeys.affectedMeals(PLAN_ID),
        queryKeys.swapAlternativesAll
      ])
      expect(spy).toHaveBeenCalledTimes(5)
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

  describe('retry policy', () => {
    it('replays a lost response once and then stops', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))
      const transportLoss = axiosError()

      expect(retry(0, transportLoss)).toBe(true)
      expect(retry(1, transportLoss)).toBe(false)
    })

    it('replays a 5xx that carries no recognised failure code', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, axiosError(502, {}))).toBe(true)
    })

    it('never replays a confirmed swap failure', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, axiosError(502, {error: 'swap_failed'}))).toBe(false)
    })

    it('never replays a stale preview or an ineligible recipe', () => {
      const retry = retryPredicate(buildSwapMealMutationOptions(queryClient, PLAN_ID))

      expect(retry(0, axiosError(409, {error: 'preview_stale'}))).toBe(false)
      expect(retry(0, axiosError(422, {error: 'recipe_ineligible'}))).toBe(false)
    })
  })
})
