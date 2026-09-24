import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'

import {buildDeleteMealEntryMutationOptions} from '../useDeleteMealEntryMutation.util'

// Stubbed only to keep the factory's import of the api layer from loading the native Firebase auth
// module; the mutation function is never invoked here, and the injected QueryClient stays real.
jest.mock('@queries/api/macros/deleteMealEntry', () => ({
  deleteMealEntry: jest.fn()
}))

const DATE = '2026-07-05'
const OTHER_DATE = '2026-07-08'
const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const ENTRY_ID = 'entry-1'

type DeleteOptions = ReturnType<typeof buildDeleteMealEntryMutationOptions>

const seedCache = (client: QueryClient): void => {
  client.setQueryData(queryKeys.dailyMacros(DATE), {seeded: true})
  client.setQueryData(queryKeys.dailyMacros(OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.macrosHistory, {seeded: true})
  client.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(PLAN_ID, DATE), {seeded: true})
  client.setQueryData(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE), {seeded: true})
  client.setQueryData(queryKeys.aiUsage, {seeded: true})
}

const invokeOnSuccess = (options: DeleteOptions): void => {
  // Narrowed because UseMutationOptions declares onSuccess optional plus trailing
  // context parameters this factory ignores; the assertions below prove it ran.
  const onSuccess = options.onSuccess as (data: void, variables: string) => void

  onSuccess(undefined, ENTRY_ID)
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

describe('buildDeleteMealEntryMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized delete-meal-entry mutation key', () => {
      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

      expect(options.mutationKey).toBe(mutationKeys.deleteMealEntry)
    })

    it('exposes a mutation function and a success handler', () => {
      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

      expect(typeof options.mutationFn).toBe('function')
      expect(typeof options.onSuccess).toBe('function')
    })

    it('declares no callbacks or retry policy beyond the success invalidation', () => {
      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

      expect(Object.keys(options).sort()).toEqual(['mutationFn', 'mutationKey', 'onSuccess'])
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const spy = jest.spyOn(queryClient, 'invalidateQueries')

      buildDeleteMealEntryMutationOptions(queryClient, DATE)

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess invalidation', () => {
    it('invalidates the diary day, macros history, the current plan and every plan day', () => {
      seedCache(queryClient)

      const spy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

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

      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryClient, queryKeys.macrosHistory)).toBe(true)
    })

    it('leaves other diary dates and unrelated domains valid', () => {
      seedCache(queryClient)

      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(isQueryInvalidated(queryClient, queryKeys.dailyMacros(OTHER_DATE))).toBe(false)
      expect(isQueryInvalidated(queryClient, queryKeys.aiUsage)).toBe(false)
    })

    it('neither removes nor rewrites cache entries', () => {
      seedCache(queryClient)

      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildDeleteMealEntryMutationOptions(queryClient, DATE)

      invokeOnSuccess(options)

      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
    })
  })
})
