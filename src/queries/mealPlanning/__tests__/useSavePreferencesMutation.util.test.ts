import {
  MealPlanPreferences,
  MealPlanPreferencesSaveResult,
  SaveMealPlanPreferencesPayload
} from '@data/models/MealPlanPreferences'
import {mutationKeys, queryKeys} from '@queries/keys'
import {MutationFunctionContext, QueryClient, QueryKey} from '@tanstack/react-query'
import {API_ERROR_CODES, API_ERROR_DETAIL_CODES} from '@utility/ApiErrorUtility'

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

const SINGLE_FIELD_SAVE_PREFERENCES_PAYLOAD: SaveMealPlanPreferencesPayload = {
  expectedRevision: 6,
  noBudgetPreference: true
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

const makeSaveResult = (overrides: Partial<MealPlanPreferencesSaveResult> = {}): MealPlanPreferencesSaveResult => ({
  preferences: makePreferences(),
  affectedMealCount: 5,
  ...overrides
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

interface OnSuccessInvocation {
  result?: MealPlanPreferencesSaveResult
  variables?: SaveMealPlanPreferencesPayload
  onMutateResult?: unknown
}

const invokeOnSuccess = async (
  options: SavePreferencesOptions,
  invocation: OnSuccessInvocation = {}
): Promise<unknown> => {
  const {onSuccess} = options
  const {result = makeSaveResult(), variables = SAVE_PREFERENCES_PAYLOAD, onMutateResult} = invocation

  if (!onSuccess) {
    throw new Error('buildSavePreferencesMutationOptions must declare onSuccess')
  }

  return onSuccess(result, variables, onMutateResult, makeFunctionContext())
}

// Thrown Errors carrying a response shape, which is what the axios transport rejects with: classification
// reads only `response.status` and `response.data.error`, so this suite owes the transport no dependency.
const makeApiError = (status: number, code?: string, details?: {field: string; code: string}[]): Error =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {
      status,
      data: code === undefined ? {} : {error: code, ...(details === undefined ? {} : {details})}
    }
  })

const STALE_REVISION_ERROR = makeApiError(409, API_ERROR_CODES.staleRevision)
const READ_ONLY_FIELD_ERROR = makeApiError(400, API_ERROR_CODES.invalidRequest, [
  {field: 'setupStatus', code: API_ERROR_DETAIL_CODES.readOnlyField}
])
const INVALID_REQUEST_ERROR = makeApiError(400, API_ERROR_CODES.invalidRequest)
const FEATURE_DISABLED_ERROR = makeApiError(503, API_ERROR_CODES.featureDisabled)
const TRANSPORT_LOSS_ERROR = new Error('Network Error')
const SERVER_ERROR_WITHOUT_CODE = makeApiError(500)

const runOnError = (
  options: SavePreferencesOptions,
  error: Error,
  variables: SaveMealPlanPreferencesPayload = SAVE_PREFERENCES_PAYLOAD
): void => {
  const {onError} = options

  if (!onError) {
    throw new Error('buildSavePreferencesMutationOptions must declare onError')
  }

  onError(error, variables, undefined, makeFunctionContext())
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

    it('declares both cache handlers only, leaving the request function to the hook', () => {
      const options = buildSavePreferencesMutationOptions(queryClient)

      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onError', 'onSuccess'])
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

    it('invalidates the affected meals, so the plan-settings banner shows the recomputed flags', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.affectedMealsAll})
      expect(isQueryInvalidated(queryKeys.affectedMeals(PLAN_ID))).toBe(true)
    })

    it('invalidates the nutrition targets, because this save can flip the confirmed estimate to stale', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.nutritionTargets})
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(true)
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

    it('does the same cache work for a single-field payload as for a multi-field one', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options, {variables: SAVE_PREFERENCES_PAYLOAD})

      const multiFieldKeys = serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))
      const multiFieldRemovals = removeSpy.mock.calls.map(([filters]) => filters?.queryKey)

      invalidateSpy.mockClear()
      removeSpy.mockClear()

      await invokeOnSuccess(options, {variables: SINGLE_FIELD_SAVE_PREFERENCES_PAYLOAD})

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(multiFieldKeys)
      expect(removeSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(multiFieldRemovals)
      expect(multiFieldKeys).toEqual(serialize(EXPECTED_INVALIDATED_KEYS))
    })

    it('does the same cache work whether the save reports no affected meals or several', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      await invokeOnSuccess(options, {result: makeSaveResult({affectedMealCount: 0})})

      const noneFlaggedKeys = serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))
      const noneFlaggedRemovals = removeSpy.mock.calls.length

      invalidateSpy.mockClear()
      removeSpy.mockClear()

      await invokeOnSuccess(options, {result: makeSaveResult({affectedMealCount: 12})})

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(noneFlaggedKeys)
      expect(removeSpy).toHaveBeenCalledTimes(noneFlaggedRemovals)
      expect(noneFlaggedKeys).toEqual(serialize(EXPECTED_INVALIDATED_KEYS))
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

      await expect(invokeOnSuccess(options, {onMutateResult: undefined})).resolves.toBeUndefined()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(true)
    })
  })

  describe('onError cache contract', () => {
    it('applies the whole set after commit-response-loss, the 409 stale_revision the equality recovery resolves silently', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(invalidateSpy).toHaveBeenCalledTimes(EXPECTED_INVALIDATED_KEYS.length)
    })

    it('issues them in the same order the success path does, so the two cannot drift', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(EXPECTED_INVALIDATED_KEYS)
    })

    it('removes the swap previews exactly once on that recovery, rather than invalidating a bound preview', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).not.toContain(
        JSON.stringify(queryKeys.swapPreviewAll)
      )
      expect(
        queryClient.getQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION))
      ).toBeUndefined()
    })

    it('reaches every cached plan day, affected-meal set and alternatives set through their family roots', () => {
      seedCache()

      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)

      expect(isQueryInvalidated(queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.affectedMeals(PLAN_ID))).toBe(true)
      expect(isQueryInvalidated(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(true)
      expect(isQueryInvalidated(queryKeys.targetEstimate)).toBe(true)
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanCurrent)).toBe(true)
    })

    it('leaves the diary, the grocery list and unrelated domains valid on that recovery too', () => {
      seedCache()

      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)

      expect(isQueryInvalidated(queryKeys.dailyMacros(DATE))).toBe(false)
      expect(isQueryInvalidated(queryKeys.groceryList(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryKeys.exercises)).toBe(false)
      expect(isQueryInvalidated(queryKeys.foods)).toBe(false)
    })

    it('applies the whole set for a rejection that carries no response at all, which may still have committed', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, TRANSPORT_LOSS_ERROR)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('applies the whole set for a 500 carrying no recognised code, the other unknown outcome', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, SERVER_ERROR_WITHOUT_CODE)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('issues no cache operation for a confirmed answer that wrote nothing', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, INVALID_REQUEST_ERROR)
      runOnError(options, READ_ONLY_FIELD_ERROR)
      runOnError(options, FEATURE_DISABLED_ERROR)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(false)
      expect(
        queryClient.getQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION))
      ).toEqual({seeded: true})
    })

    it('issues every operation against a completely empty cache without throwing', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      expect(() => runOnError(options, STALE_REVISION_ERROR)).not.toThrow()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('writes nothing optimistically on any failure', () => {
      seedCache()

      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)
      runOnError(options, TRANSPORT_LOSS_ERROR)
      runOnError(options, INVALID_REQUEST_ERROR)

      expect(writeSpy).not.toHaveBeenCalled()
    })

    it('does the same cache work for a single-field payload as for a multi-field one', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSavePreferencesMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR, SAVE_PREFERENCES_PAYLOAD)

      const multiFieldKeys = serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))
      const multiFieldRemovals = removeSpy.mock.calls.map(([filters]) => filters?.queryKey)

      invalidateSpy.mockClear()
      removeSpy.mockClear()

      runOnError(options, STALE_REVISION_ERROR, SINGLE_FIELD_SAVE_PREFERENCES_PAYLOAD)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(multiFieldKeys)
      expect(removeSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(multiFieldRemovals)
      expect(multiFieldKeys).toEqual(serialize(EXPECTED_INVALIDATED_KEYS))
    })
  })
})
