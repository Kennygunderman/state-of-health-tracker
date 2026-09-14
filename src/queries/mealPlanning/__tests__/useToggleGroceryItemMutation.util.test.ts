import {GroceryItem, GroceryList, ToggleGroceryItemResult} from '@data/models/GroceryList'
import {mutationKeys, queryKeys} from '@queries/keys'
import {QueryClient} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {
  buildToggleGroceryItemMutationOptions,
  ToggleGroceryItemContext,
  ToggleGroceryItemVariables
} from '../useToggleGroceryItemMutation.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const SPINACH_ID = 'item-spinach'
const CHICKEN_ID = 'item-chicken'

type ToggleOptions = ReturnType<typeof buildToggleGroceryItemMutationOptions>

const makeItem = (overrides: Partial<GroceryItem> = {}): GroceryItem => ({
  id: SPINACH_ID,
  catalogFoodId: 'food-spinach',
  foodState: 'raw',
  name: 'Spinach',
  quantityGrams: 420,
  displayText: '7 cups',
  isChecked: false,
  flag: null,
  ...overrides
})

const makeGroceryList = (): GroceryList => ({
  planId: PLAN_ID,
  planRevision: 3,
  startDate: '2026-07-05',
  endDate: '2026-07-11',
  totalCount: 5,
  checkedCount: 2,
  banner: {code: 'amount_increased', itemNames: ['Chicken breast']},
  sections: [
    {
      category: 'produce',
      items: [
        makeItem(),
        makeItem({id: 'item-avocado', catalogFoodId: 'food-avocado', name: 'Avocado', displayText: '3'})
      ]
    },
    {
      category: 'protein',
      items: [makeItem({id: 'item-salmon', catalogFoodId: 'food-salmon', name: 'Salmon fillet', displayText: '1.2 lb'})]
    }
  ],
  checkedItems: [
    makeItem({
      id: CHICKEN_ID,
      catalogFoodId: 'food-chicken',
      name: 'Chicken breast',
      displayText: '3.1 lb',
      isChecked: true,
      flag: {
        previousDisplayText: '2.5 lb',
        newDisplayText: '3.1 lb',
        deltaDisplayText: '+0.6 lb',
        flaggedAt: '2026-07-06T10:00:00.000Z'
      }
    }),
    makeItem({
      id: 'item-rice',
      catalogFoodId: 'food-rice',
      name: 'Brown rice',
      displayText: '3 cups dry',
      isChecked: true
    })
  ]
})

const makeToggleResult = (): ToggleGroceryItemResult => ({item: makeItem({isChecked: true}), checkedCount: 3})

const planNotActiveError = {response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}} as unknown as Error

const stalePlanError = {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}} as unknown as Error

const numericCodeError = {response: {status: 409, data: {error: 409}}} as unknown as Error

const networkError = new Error('Network request failed')

// The option type declares every callback optional plus trailing parameters these invocations do not need, so
// each handler is narrowed to the shape the factory actually installs; the assertions prove it ran.
const invokeOnMutate = (
  options: ToggleOptions,
  variables: ToggleGroceryItemVariables
): Promise<ToggleGroceryItemContext> => {
  const onMutate = options.onMutate as (
    mutateVariables: ToggleGroceryItemVariables
  ) => Promise<ToggleGroceryItemContext>

  return onMutate(variables)
}

const invokeOnError = (options: ToggleOptions, error: Error, context: ToggleGroceryItemContext | undefined): void => {
  const onError = options.onError as (
    handledError: Error,
    variables: ToggleGroceryItemVariables,
    handledContext: ToggleGroceryItemContext | undefined
  ) => void

  onError(error, {itemId: SPINACH_ID, isChecked: true}, context)
}

const invokeOnSettled = (
  options: ToggleOptions,
  data: ToggleGroceryItemResult | undefined,
  error: Error | null
): void => {
  const onSettled = options.onSettled as (
    handledData: ToggleGroceryItemResult | undefined,
    handledError: Error | null,
    variables: ToggleGroceryItemVariables,
    handledContext: ToggleGroceryItemContext | undefined
  ) => void

  onSettled(data, error, {itemId: SPINACH_ID, isChecked: true}, {previousList: makeGroceryList()})
}

const readGroceryList = (client: QueryClient, planId: string): GroceryList | undefined =>
  client.getQueryData<GroceryList>(queryKeys.groceryList(planId))

const everyRow = (list: GroceryList): GroceryItem[] => [
  ...list.sections.flatMap(section => section.items),
  ...list.checkedItems
]

const findRow = (list: GroceryList, itemId: string): GroceryItem | undefined =>
  everyRow(list).find(item => item.id === itemId)

const rowIds = (list: GroceryList): string[] => {
  const ids = everyRow(list).map(item => item.id)

  return ids.sort()
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

describe('buildToggleGroceryItemMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized toggle-grocery-item mutation key', () => {
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      expect(options.mutationKey).toBe(mutationKeys.toggleGroceryItem)
    })

    it('installs the optimistic lifecycle handlers and leaves the mutation function to the hook', () => {
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      expect(typeof options.onMutate).toBe('function')
      expect(typeof options.onError).toBe('function')
      expect(typeof options.onSettled).toBe('function')
      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onError', 'onMutate', 'onSettled'])
    })

    it('declares no retry policy — a grocery write carries no idempotency key and last write wins', () => {
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      expect(options.retry).toBeUndefined()
      expect(options.retryDelay).toBeUndefined()
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const cancelSpy = jest.spyOn(queryClient, 'cancelQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      expect(cancelSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
      expect(invalidateSpy).not.toHaveBeenCalled()
    })
  })

  describe('onMutate', () => {
    it('cancels the in-flight grocery read before it snapshots and writes', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const cancelSpy = jest.spyOn(queryClient, 'cancelQueries')
      const readSpy = jest.spyOn(queryClient, 'getQueryData')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      expect(cancelSpy).toHaveBeenCalledWith({queryKey: queryKeys.groceryList(PLAN_ID)})
      expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(readSpy.mock.invocationCallOrder[0])
      expect(readSpy.mock.invocationCallOrder[0]).toBeLessThan(writeSpy.mock.invocationCallOrder[0])
    })

    it('moves a newly checked row out of its aisle and into the checked card', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // The aisle sections carry the unchecked rows and the checked card the checked ones, so a row left in
      // its aisle would be dropped by GroceryList's section ordering and vanish under the shopper's finger.
      expect(written.sections[0].items.map(item => item.id)).toEqual(['item-avocado'])
      expect(written.checkedItems.map(item => item.id)).toEqual([CHICKEN_ID, 'item-rice', SPINACH_ID])
      expect(findRow(written, SPINACH_ID)?.isChecked).toBe(true)
      expect(written.checkedCount).toBe(3)
    })

    it('keeps every row the list holds when a row changes collection', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(rowIds(written)).toEqual(rowIds(seeded))
      expect(everyRow(written)).toHaveLength(written.totalCount)
    })

    it('clears the toggled row flag', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: CHICKEN_ID, isChecked: false})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(findRow(written, CHICKEN_ID)?.flag).toBeNull()
      expect(findRow(written, CHICKEN_ID)?.isChecked).toBe(false)
    })

    it('unchecks a row where it sits, because the response names no aisle to re-file it into', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: CHICKEN_ID, isChecked: false})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // GroceryItem carries no category (0.5.2), so the row stays visible where the shopper tapped it and the
      // settle refetch returns it to its aisle; it is never dropped from the list.
      expect(written.checkedItems.map(item => item.id)).toEqual([CHICKEN_ID, 'item-rice'])
      expect(findRow(written, CHICKEN_ID)?.isChecked).toBe(false)
      expect(written.checkedCount).toBe(1)
      expect(rowIds(written)).toEqual(rowIds(seeded))
    })

    it('holds the checked count steady when a row is toggled to the state it already carries', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: CHICKEN_ID, isChecked: true})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // The count is recounted from the rows rather than nudged by a delta, so a repeated tap cannot inflate it.
      expect(written.checkedCount).toBe(2)
      expect(findRow(written, CHICKEN_ID)?.isChecked).toBe(true)
    })

    it('leaves the banner, totals, revision and dates alone', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(written.banner).toEqual(seeded.banner)
      expect(written.totalCount).toBe(5)
      expect(written.planRevision).toBe(3)
      expect(written.startDate).toBe('2026-07-05')
      expect(written.endDate).toBe('2026-07-11')
      expect(written.planId).toBe(PLAN_ID)
    })

    it('mutates nothing in the cached list and writes a new object instead', async () => {
      const seeded = makeGroceryList()
      const seededClone = JSON.parse(JSON.stringify(seeded)) as GroceryList

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(seeded).toEqual(seededClone)
      expect(written).not.toBe(seeded)
      expect(written.sections).not.toBe(seeded.sections)
      expect(written.sections[0]).not.toBe(seeded.sections[0])
      expect(written.checkedItems).not.toBe(seeded.checkedItems)
      // The toggled row is a restated copy; the seeded object it came from still reads as it did.
      expect(findRow(written, SPINACH_ID)).not.toBe(seeded.sections[0].items[0])
      expect(seeded.sections[0].items[0].isChecked).toBe(false)
    })

    it('returns the untouched previous list as rollback context', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)
      const context = await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      expect(context.previousList).toBe(seeded)
      expect(context.previousList?.checkedCount).toBe(2)
    })

    it('leaves the list and the checked count unchanged for an item id it does not hold', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: 'item-not-on-this-list', isChecked: true})

      expect(readGroceryList(queryClient, PLAN_ID)).toEqual(seeded)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(2)
    })

    it('writes nothing and reports an empty snapshot when the grocery list is not cached', async () => {
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)
      const context = await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      expect(context.previousList).toBeUndefined()
      expect(writeSpy).not.toHaveBeenCalled()
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))).toBeUndefined()
    })

    it('writes only the grocery list of its own plan', async () => {
      const otherPlanList = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), otherPlanList)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      expect(readGroceryList(queryClient, OTHER_PLAN_ID)).toBe(otherPlanList)
    })
  })

  describe('onError', () => {
    it('restores the snapshot it was handed', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)
      const context = await invokeOnMutate(options, {itemId: SPINACH_ID, isChecked: true})

      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(3)

      invokeOnError(options, networkError, context)

      // Deep equality rather than identity: TanStack applies structural sharing to every cache write.
      expect(readGroceryList(queryClient, PLAN_ID)).toEqual(seeded)
      expect(readGroceryList(queryClient, PLAN_ID)?.sections[0].items[0].isChecked).toBe(false)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(2)
    })

    it('invalidates the current plan on 409 plan_not_active', () => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnError(options, planNotActiveError, {previousList: makeGroceryList()})

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.mealPlanCurrent])
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(true)
    })

    it('leaves the current plan alone for another machine code, a plain error and a non-string code', () => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnError(options, stalePlanError, {previousList: makeGroceryList()})
      invokeOnError(options, networkError, {previousList: makeGroceryList()})
      invokeOnError(options, numericCodeError, {previousList: makeGroceryList()})

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })

    it('rolls nothing back when no snapshot was captured', () => {
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnError(options, networkError, undefined)
      invokeOnError(options, networkError, {previousList: undefined})

      expect(writeSpy).not.toHaveBeenCalled()
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
    })

    it('still recovers the plan state when a 409 arrives without a snapshot', () => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnError(options, planNotActiveError, undefined)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.mealPlanCurrent])
    })
  })

  describe('onSettled', () => {
    it('refetches the grocery list once after a successful write', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnSettled(options, makeToggleResult(), null)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(true)
    })

    it('refetches the grocery list once after a failed write', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnSettled(options, undefined, planNotActiveError)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(true)
    })

    it('leaves another plan grocery list and the current plan valid', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      invokeOnSettled(options, makeToggleResult(), null)

      expect(queryClient.getQueryState(queryKeys.groceryList(OTHER_PLAN_ID))?.isInvalidated).toBe(false)
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })
  })
})
