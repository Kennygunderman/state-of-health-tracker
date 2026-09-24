import {InputMethodEnum, MealEntry, UpdateMealEntryPayload} from '@data/models/MealEntry'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'

import {buildUpdateMealEntryMutationOptions} from '../useUpdateMealEntryMutation.util'

// Stubbed only because the factory's import of the api layer reaches the native Firebase auth module at
// require time, which throws under Jest; the mutation function is never invoked here, and the injected
// QueryClient, the key registry and TanStack Query itself all stay real.
jest.mock('@queries/api/macros/updateMealEntry', () => ({
  updateMealEntry: jest.fn()
}))

const DATE = '2026-07-05'
const OTHER_DATE = '2026-07-08'
const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const ENTRY_ID = 'entry-1'

type UpdateOptions = ReturnType<typeof buildUpdateMealEntryMutationOptions>

type UpdateVariables = {entryId: string; payload: UpdateMealEntryPayload}

const UPDATE_VARIABLES: UpdateVariables = {entryId: ENTRY_ID, payload: {servings: 2}}

const makeMealEntry = (overrides: Partial<MealEntry> = {}): MealEntry => ({
  id: ENTRY_ID,
  foodId: null,
  name: 'Greek yogurt bowl',
  servingText: '1 serving',
  servings: 1,
  calories: 420,
  protein: 32,
  carbs: 44,
  fat: 11,
  inputMethod: InputMethodEnum.MEAL_PLAN,
  loggedAt: '2026-07-05T08:00:00.000Z',
  mealPlanMealId: 'meal-1',
  nutritionProvenance: 'source_backed',
  ...overrides
})

const seedCache = (client: QueryClient): void => {
  client.setQueryData(queryKeys.dailyMacros(DATE), {seeded: true})
  client.setQueryData(queryKeys.dailyMacros(OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.macrosHistory, {seeded: true})
  client.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(PLAN_ID, DATE), {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.aiUsage, {seeded: true})
}

const invokeOnSuccess = (options: UpdateOptions): void => {
  // Narrowed because UseMutationOptions declares onSuccess optional plus trailing
  // context parameters this factory ignores; the assertions below prove it ran.
  const onSuccess = options.onSuccess as (data: MealEntry, variables: UpdateVariables) => void

  onSuccess(makeMealEntry({servings: 2}), UPDATE_VARIABLES)
}

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

describe('buildUpdateMealEntryMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized update-meal-entry mutation key', () => {
      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      expect(options.mutationKey).toBe(mutationKeys.updateMealEntry)
    })

    it('exposes a mutation function and a success handler', () => {
      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      expect(typeof options.mutationFn).toBe('function')
      expect(typeof options.onSuccess).toBe('function')
    })

    it('declares no callbacks or retry policy beyond the success invalidation', () => {
      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      expect(Object.keys(options).sort()).toEqual(['mutationFn', 'mutationKey', 'onSuccess'])
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')

      buildUpdateMealEntryMutationOptions(queryClient, DATE)

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess invalidation', () => {
    it('invalidates the diary day, macros history, the current plan and every plan day', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(spy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
        queryKeys.dailyMacros(DATE),
        queryKeys.macrosHistory,
        queryKeys.mealPlanCurrent,
        queryKeys.mealPlanDayAll
      ])
      expect(spy).toHaveBeenCalledTimes(4)
    })

    it('reaches every plan-day detail through the plan-day family root', () => {
      seedCache(queryClient)

      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.macrosHistory)).toBe(true)
    })

    it('leaves other diary dates and unrelated domains valid', () => {
      seedCache(queryClient)

      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(OTHER_DATE))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.aiUsage)).toBe(false)
    })

    it('neither removes nor rewrites cache entries', () => {
      seedCache(queryClient)

      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildUpdateMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
    })
  })
})
