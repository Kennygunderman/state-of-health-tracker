import {
  MealPlanPreferences,
  MealPlanPreferencesSaveResult,
  SaveMealPlanPreferencesPayload
} from '@data/models/MealPlanPreferences'
import {mutationKeys, queryKeys} from '@queries/keys'
import {MutationFunctionContext, QueryClient, QueryKey} from '@tanstack/react-query'

import {buildSavePreferencesMutationOptions} from '../useSavePreferencesMutation.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const DATE = '2026-07-05'
const OTHER_DATE = '2026-07-08'
const MEAL_ID = 'meal-1'
const RECIPE_VERSION_ID = 'recipe-version-1'
const PLAN_REVISION = 4
const TIME_ZONE = 'America/New_York'

type SavePreferencesOptions = ReturnType<typeof buildSavePreferencesMutationOptions>

const SAVE_PREFERENCES_PAYLOAD: SaveMealPlanPreferencesPayload = {
  expectedRevision: 6,
  diet: 'pescatarian',
  allergens: ['shellfish'],
  mealSchedule: 'three_plus_snack',
  cookingTimeLimitMin: 45,
  timeZone: TIME_ZONE
}

const makePreferences = (): MealPlanPreferences => ({
  setupStatus: 'completed',
  setupStep: null,
  reviewStartDate: '2026-07-06',
  timeZone: TIME_ZONE,
  targetRoute: 'estimated',
  revision: 7,
  goal: 'maintain',
  goalWeightKg: null,
  paceLbPerWeek: null,
  age: 41,
  heightCm: 165,
  weightKg: 64,
  sexForEstimate: 'female',
  heightUnitPref: 'cm',
  weightUnitPref: 'kg',
  activityLevel: 'lightly_active',
  diet: 'pescatarian',
  allergens: ['shellfish'],
  dislikedFoods: [{id: 'food-1', name: 'Olives', foodGroup: 'vegetables'}],
  dislikedFoodGroups: ['organ_meat'],
  mealSchedule: 'three_plus_snack',
  mealTimes: [
    {slot: 'breakfast', time: '07:30'},
    {slot: 'lunch', time: '13:00'},
    {slot: 'dinner', time: '19:30'},
    {slot: 'snack', time: '16:00'}
  ],
  cookingTimeLimitMin: 45,
  budget: {amount: 120, currency: 'USD'},
  noBudgetPreference: false,
  budgetTier: 2,
  hasActivePlan: true
})

const makeSaveResult = (): MealPlanPreferencesSaveResult => ({
  preferences: makePreferences(),
  affectedMealCount: 5
})

const EXPECTED_INVALIDATED_KEYS: QueryKey[] = [
  queryKeys.mealPlanPreferences,
  queryKeys.targetEstimate,
  queryKeys.nutritionTargets,
  queryKeys.affectedMealsAll,
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll,
  queryKeys.swapAlternativesAll
]

const serialize = (keys: (QueryKey | undefined)[]): string[] => keys.map(key => JSON.stringify(key)).sort()

let queryClient: QueryClient

const seedCache = (): void => {
  queryClient.setQueryData(queryKeys.mealPlanPreferences, {seeded: true})
  queryClient.setQueryData(queryKeys.targetEstimate, {seeded: true})
  queryClient.setQueryData(queryKeys.nutritionTargets, {seeded: true})
  queryClient.setQueryData(queryKeys.affectedMeals(PLAN_ID), {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanDay(PLAN_ID, DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION), {seeded: true})
  queryClient.setQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION), {seeded: true})
  queryClient.setQueryData(queryKeys.dailyMacros(DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), {seeded: true})
  queryClient.setQueryData(queryKeys.exercises, {seeded: true})
  queryClient.setQueryData(queryKeys.foods, {seeded: true})
}

const makeFunctionContext = (): MutationFunctionContext => ({
  client: queryClient,
  meta: undefined,
  mutationKey: mutationKeys.savePreferences
})

const invokeOnSuccess = async (
  options: SavePreferencesOptions,
  onMutateResult: unknown = undefined
): Promise<unknown> => {
  const {onSuccess} = options

  if (!onSuccess) {
    throw new Error('buildSavePreferencesMutationOptions must declare onSuccess')
  }

  return onSuccess(makeSaveResult(), SAVE_PREFERENCES_PAYLOAD, onMutateResult, makeFunctionContext())
}

const isQueryInvalidated = (queryKey: QueryKey): boolean | undefined =>
  queryClient.getQueryState(queryKey)?.isInvalidated

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
  queryClient.clear()
})

describe('buildSavePreferencesMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized save-preferences mutation key, which is what useIsMutating matches on', () => {
      const options = buildSavePreferencesMutationOptions(queryClient)

      expect(options.mutationKey).toBe(mutationKeys.savePreferences)
    })

    it('declares the cache handler only, leaving the request function to the hook', () => {
      const options = buildSavePreferencesMutationOptions(queryClient)

      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onSuccess'])
    })

    it('declares no retry, because a revisioned save recovers through 409 stale_revision rather than a replay', () => {
      const options = buildSavePreferencesMutationOptions(queryClient)

      expect(options.retry).toBeUndefined()
      expect(options.retryDelay).toBeUndefined()
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')

      buildSavePreferencesMutationOptions(queryClient)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess cache contract', () => {
    it('invalidates exactly the same seven keys the setup-step save owns, and nothing else', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(invalidateSpy).toHaveBeenCalledTimes(EXPECTED_INVALIDATED_KEYS.length)
    })

    it('issues those invalidations in the order the cache contract states, so a reordering is a failure', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(EXPECTED_INVALIDATED_KEYS)
    })

    it('reaches every cached plan day, affected-meal set and alternatives set through their family roots', async () => {
      seedCache()

      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(isQueryInvalidated(queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.affectedMeals(PLAN_ID))).toBe(true)
      expect(isQueryInvalidated(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(true)
      expect(isQueryInvalidated(queryKeys.targetEstimate)).toBe(true)
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanCurrent)).toBe(true)
    })

    it('leaves the diary, the grocery list and unrelated domains valid', async () => {
      seedCache()

      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(isQueryInvalidated(queryKeys.dailyMacros(DATE))).toBe(false)
      expect(isQueryInvalidated(queryKeys.groceryList(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryKeys.exercises)).toBe(false)
      expect(isQueryInvalidated(queryKeys.foods)).toBe(false)
    })

    it('removes the swap previews rather than invalidating a preview bound to the old preferences', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).not.toContain(
        JSON.stringify(queryKeys.swapPreviewAll)
      )
      expect(
        queryClient.getQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION))
      ).toBeUndefined()
    })

    it('writes nothing optimistically', async () => {
      seedCache()

      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess edge cases', () => {
    it('issues every operation against a completely empty cache without throwing', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await expect(invokeOnSuccess(options)).resolves.toBeUndefined()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('tolerates the undefined onMutate result a factory declaring no onMutate always receives', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await expect(invokeOnSuccess(options, undefined)).resolves.toBeUndefined()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(true)
    })
  })
})
