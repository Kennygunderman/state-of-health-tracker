import {GroceryItem, GroceryItemFlag, GroceryList, ToggleGroceryItemResult} from '@data/models/GroceryList'
import {mutationKeys, queryKeys} from '@queries/keys'
import {MutationFunctionContext, QueryClient} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {
  buildToggleGroceryItemMutationOptions,
  ToggleGroceryItemContext,
  ToggleGroceryItemVariables
} from '../useToggleGroceryItemMutation.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const SPINACH_ID = 'item-spinach'
const AVOCADO_ID = 'item-avocado'
const SALMON_ID = 'item-salmon'
const CHICKEN_ID = 'item-chicken'
const RICE_ID = 'item-rice'

type ToggleOptions = ReturnType<typeof buildToggleGroceryItemMutationOptions>

const makeFlag = (): GroceryItemFlag => ({
  previousDisplayText: '2.5 lb',
  newDisplayText: '3.1 lb',
  deltaDisplayText: '+0.6 lb',
  flaggedAt: '2026-07-06T10:00:00.000Z'
})

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

// The aisle sections carry the unchecked rows and the checked card the checked ones, so a row belongs to
// exactly one of them: a fixture listing a checked row in both would be counted twice.
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
      items: [makeItem(), makeItem({id: AVOCADO_ID, catalogFoodId: 'food-avocado', name: 'Avocado', displayText: '3'})]
    },
    {
      category: 'protein',
      items: [makeItem({id: SALMON_ID, catalogFoodId: 'food-salmon', name: 'Salmon fillet', displayText: '1.2 lb'})]
    }
  ],
  checkedItems: [
    makeItem({
      id: CHICKEN_ID,
      catalogFoodId: 'food-chicken',
      name: 'Chicken breast',
      displayText: '3.1 lb',
      isChecked: true,
      flag: makeFlag()
    }),
    makeItem({id: RICE_ID, catalogFoodId: 'food-rice', name: 'Brown rice', displayText: '3 cups dry', isChecked: true})
  ]
})

const makeRowlessGroceryList = (): GroceryList => ({
  ...makeGroceryList(),
  totalCount: 0,
  checkedCount: 0,
  banner: null,
  sections: [],
  checkedItems: []
})

const makeToggleResult = (): ToggleGroceryItemResult => ({item: makeItem({isChecked: true}), checkedCount: 3})

const makeApiError = (data: unknown): Error =>
  Object.assign(new Error('Request failed'), {response: {status: 409, data}})

const makeNetworkError = (): Error => new Error('Network request failed')

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const callbackContext = (client: QueryClient): MutationFunctionContext => ({
  client,
  meta: undefined,
  mutationKey: mutationKeys.toggleGroceryItem
})

const runOnMutate = async (
  options: ToggleOptions,
  client: QueryClient,
  variables: ToggleGroceryItemVariables
): Promise<ToggleGroceryItemContext | undefined> => options.onMutate?.(variables, callbackContext(client))

const runOnError = (
  options: ToggleOptions,
  client: QueryClient,
  error: Error,
  context: ToggleGroceryItemContext | undefined
): void => {
  options.onError?.(error, {itemId: SPINACH_ID, isChecked: true}, context, callbackContext(client))
}

const runOnSettled = (
  options: ToggleOptions,
  client: QueryClient,
  data: ToggleGroceryItemResult | undefined,
  error: Error | null,
  context: ToggleGroceryItemContext | undefined
): void => {
  options.onSettled?.(data, error, {itemId: SPINACH_ID, isChecked: true}, context, callbackContext(client))
}

const readGroceryList = (client: QueryClient, planId: string): GroceryList | undefined =>
  client.getQueryData<GroceryList>(queryKeys.groceryList(planId))

const requireGroceryList = (client: QueryClient, planId: string): GroceryList => {
  const list = readGroceryList(client, planId)

  if (list === undefined) {
    throw new Error(`Expected a cached grocery list for ${planId}`)
  }

  return list
}

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

const aisleIds = (list: GroceryList, category: string): string[] => {
  const section = list.sections.find(candidate => candidate.category === category)

  return (section?.items ?? []).map(item => item.id)
}

const checkedIds = (list: GroceryList): string[] => list.checkedItems.map(item => item.id)

const invalidatedKeys = (spy: jest.SpyInstance): unknown[] => spy.mock.calls.map(([filters]) => filters?.queryKey)

describe('buildToggleGroceryItemMutationOptions', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
    // otherwise hold the Node event loop open after the assertions are done.
    queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    queryClient.clear()
  })

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

    it('declares no onSuccess, because onSettled already reconciles both outcomes', () => {
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      expect(options.onSuccess).toBeUndefined()
    })

    it('declares no retry policy, because a grocery write carries no idempotency key and last write wins', () => {
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      expect(options.retry).toBeUndefined()
      expect(options.retryDelay).toBeUndefined()
    })

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

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      expect(cancelSpy).toHaveBeenCalledWith({queryKey: queryKeys.groceryList(PLAN_ID)})
      expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(readSpy.mock.invocationCallOrder[0])
      expect(readSpy.mock.invocationCallOrder[0]).toBeLessThan(writeSpy.mock.invocationCallOrder[0])
    })

    it('moves a newly checked row out of its aisle and into the checked card', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(aisleIds(written, 'produce')).toEqual([AVOCADO_ID])
      expect(checkedIds(written)).toEqual([CHICKEN_ID, RICE_ID, SPINACH_ID])
      expect(findRow(written, SPINACH_ID)?.isChecked).toBe(true)
      expect(written.checkedCount).toBe(3)
    })

    it('clears the increase flag on the row it toggles', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: CHICKEN_ID, isChecked: false})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(findRow(written, CHICKEN_ID)?.flag).toBeNull()
      expect(findRow(written, CHICKEN_ID)?.isChecked).toBe(false)
    })

    it('moves an unchecked row out of the checked card and back onto the list', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: CHICKEN_ID, isChecked: false})

      const written = requireGroceryList(queryClient, PLAN_ID)

      // The response named no aisle for a row that arrived checked, so it lands in the closing catch-all and
      // the settle refetch re-files it. It is never dropped from the list.
      expect(checkedIds(written)).toEqual([RICE_ID])
      expect(aisleIds(written, 'pantry_other')).toEqual([CHICKEN_ID])
      expect(written.checkedCount).toBe(1)
      expect(written.checkedItems).toHaveLength(written.checkedCount)
      expect(rowIds(written)).toEqual(rowIds(seeded))
    })

    it('returns a row the shopper ticks and unticks to its own aisle', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})
      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: false})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(aisleIds(written, 'produce')).toEqual([AVOCADO_ID, SPINACH_ID])
      expect(written.sections.map(section => section.category)).toEqual(['produce', 'protein'])
      expect(checkedIds(written)).toEqual([CHICKEN_ID, RICE_ID])
      expect(written.checkedCount).toBe(2)
    })

    it('keeps every row the list holds when a row changes collection', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(rowIds(written)).toEqual(rowIds(seeded))
      expect(everyRow(written)).toHaveLength(written.totalCount)
      expect(written.checkedItems.every(item => item.isChecked)).toBe(true)
      expect(written.sections.flatMap(section => section.items).every(item => !item.isChecked)).toBe(true)
    })

    it('holds the checked count steady when a row is toggled to the state it already carries', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: CHICKEN_ID, isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      // The count is recounted from the rows rather than nudged by a delta, so a repeated tap cannot inflate it.
      expect(written.checkedCount).toBe(2)
      expect(findRow(written, CHICKEN_ID)?.isChecked).toBe(true)
    })

    it('leaves the banner, totals, revision, dates and plan id alone', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(written.banner).toEqual(seeded.banner)
      expect(written.totalCount).toBe(5)
      expect(written.planRevision).toBe(3)
      expect(written.startDate).toBe('2026-07-05')
      expect(written.endDate).toBe('2026-07-11')
      expect(written.planId).toBe(PLAN_ID)
    })

    it('mutates nothing in the cached list and writes a new object instead', async () => {
      const seeded = makeGroceryList()
      const before = clone(seeded)

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(seeded).toEqual(before)
      expect(seeded.sections[0].items[0]).toEqual(before.sections[0].items[0])
      expect(seeded.sections[0].items[0].isChecked).toBe(false)
      expect(written).not.toBe(seeded)
      expect(written.sections).not.toBe(seeded.sections)
      expect(written.sections[0]).not.toBe(seeded.sections[0])
      expect(written.checkedItems).not.toBe(seeded.checkedItems)
      expect(findRow(written, SPINACH_ID)).not.toBe(seeded.sections[0].items[0])
    })

    it('returns the untouched previous list as rollback context', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)
      const context = await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      expect(context).toBeDefined()
      expect(context?.previousList).toBe(seeded)
      expect(context?.previousList?.checkedCount).toBe(2)
    })

    it('leaves the list and the checked count unchanged for an item id it does not hold', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: 'item-not-on-this-list', isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(written).toEqual(seeded)
      expect(rowIds(written)).toEqual(rowIds(seeded))
      expect(written.checkedCount).toBe(2)
    })

    it('writes nothing and reports an empty snapshot when the grocery list is not cached', async () => {
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)
      const context = await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      expect(context?.previousList).toBeUndefined()
      expect(writeSpy).not.toHaveBeenCalled()
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))).toBeUndefined()
    })

    it('completes without throwing for a plan whose list holds no rows at all', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeRowlessGroceryList())

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      const written = requireGroceryList(queryClient, PLAN_ID)

      expect(everyRow(written)).toEqual([])
      expect(written.sections).toEqual([])
      expect(written.checkedItems).toEqual([])
      expect(written.checkedCount).toBe(0)
    })

    it('writes only the grocery list of its own plan', async () => {
      const otherPlanList = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), otherPlanList)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      expect(readGroceryList(queryClient, OTHER_PLAN_ID)).toBe(otherPlanList)
    })

    it('does not invalidate the current plan, because ticking a row is not a plan change', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })
  })

  describe('onError', () => {
    it('restores the snapshot the optimistic write replaced', async () => {
      const seeded = makeGroceryList()
      const before = clone(seeded)

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)
      const context = await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})

      expect(requireGroceryList(queryClient, PLAN_ID).checkedCount).toBe(3)

      runOnError(options, queryClient, makeNetworkError(), context)

      const restored = requireGroceryList(queryClient, PLAN_ID)

      // Deep equality rather than identity: TanStack applies structural sharing to every cache write.
      expect(restored).toEqual(before)
      expect(aisleIds(restored, 'produce')).toEqual([SPINACH_ID, AVOCADO_ID])
      expect(findRow(restored, SPINACH_ID)?.isChecked).toBe(false)
      expect(restored.checkedCount).toBe(2)
    })

    it('invalidates the current plan when the server answers 409 plan_not_active', () => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnError(options, queryClient, makeApiError({error: API_ERROR_CODES.planNotActive}), {
        previousList: makeGroceryList()
      })

      expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.mealPlanCurrent])
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(true)
    })

    it.each([
      ['another machine-readable plan code', makeApiError({error: API_ERROR_CODES.stalePlan})],
      ['a response body carrying no code', makeApiError({})],
      ['a response body that is null', makeApiError(null)],
      ['a non-string code', makeApiError({error: 409})],
      ['a plain error with no response at all', makeNetworkError()]
    ])('leaves the current plan alone for %s', (_label, error) => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnError(options, queryClient, error, {previousList: makeGroceryList()})

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })

    it('rolls nothing back when the write failed before the optimistic update', () => {
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnError(options, queryClient, makeNetworkError(), undefined)
      runOnError(options, queryClient, makeNetworkError(), {previousList: undefined})

      expect(writeSpy).not.toHaveBeenCalled()
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
    })

    it('still recovers the plan state when a 409 arrives without a snapshot', () => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnError(options, queryClient, makeApiError({error: API_ERROR_CODES.planNotActive}), undefined)

      expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.mealPlanCurrent])
    })
  })

  describe('onSettled', () => {
    it('refetches this plan grocery list once after a successful write', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, makeToggleResult(), null, {previousList: makeGroceryList()})

      expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(true)
    })

    it('refetches this plan grocery list after a failed write too, so the server counts win', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, undefined, makeApiError({error: API_ERROR_CODES.planNotActive}), {
        previousList: makeGroceryList()
      })

      expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(true)
    })

    it('leaves another plan grocery list and the current plan valid', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, makeToggleResult(), null, {previousList: makeGroceryList()})

      expect(queryClient.getQueryState(queryKeys.groceryList(OTHER_PLAN_ID))?.isInvalidated).toBe(false)
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })

    it('completes without throwing when nothing is cached for the plan', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, undefined, makeNetworkError(), undefined)

      expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
    })
  })

  describe('the plan the options were built for', () => {
    it('builds every key from the planId it was constructed with', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), makeGroceryList())

      const cancelSpy = jest.spyOn(queryClient, 'cancelQueries')
      const options = buildToggleGroceryItemMutationOptions(queryClient, OTHER_PLAN_ID)
      const context = await runOnMutate(options, queryClient, {itemId: SPINACH_ID, isChecked: true})
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      runOnSettled(options, queryClient, makeToggleResult(), null, context)

      expect(cancelSpy).toHaveBeenCalledWith({queryKey: queryKeys.groceryList(OTHER_PLAN_ID)})
      expect(invalidatedKeys(invalidateSpy)).toEqual([queryKeys.groceryList(OTHER_PLAN_ID)])
      expect(requireGroceryList(queryClient, OTHER_PLAN_ID).checkedCount).toBe(3)
      expect(requireGroceryList(queryClient, PLAN_ID).checkedCount).toBe(2)
    })
  })
})
