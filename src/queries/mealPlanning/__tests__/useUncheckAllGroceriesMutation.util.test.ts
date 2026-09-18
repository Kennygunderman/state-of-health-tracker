import {GroceryCategory, GroceryItem, GroceryList, UncheckAllGroceriesResult} from '@data/models/GroceryList'
import {mutationKeys, queryKeys} from '@queries/keys'
import {MutationFunctionContext, QueryClient} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {buildUncheckAllGroceriesMutationOptions} from '../useUncheckAllGroceriesMutation.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const SPINACH_ID = 'item-spinach'
const CHICKEN_ID = 'item-chicken'

type UncheckAllOptions = ReturnType<typeof buildUncheckAllGroceriesMutationOptions>

// Derived rather than imported, so the rollback value stays opaque here: these tests capture whatever onMutate
// returns and hand it straight back, which is all TanStack does with it. Naming the context shape would pin an
// internal of the factory instead of the cache outcome that actually matters.
type UncheckAllSnapshot = Awaited<ReturnType<NonNullable<UncheckAllOptions['onMutate']>>> | undefined

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
  // The checked rows carry the aisle the cached list retained for them — what `retainKnownAisles` stamps on
  // every answer from what the client already knew, since the response states the category per section and
  // holds the checked rows out of the sections (0.5.2). Two aisles the sections do not hold, so a cleared row
  // reaching its own aisle is visible rather than hidden among the rows that were already there.
  checkedItems: [
    makeItem({
      id: CHICKEN_ID,
      catalogFoodId: 'food-chicken',
      name: 'Chicken breast',
      displayText: '3.1 lb',
      isChecked: true,
      category: 'dairy_alternatives',
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
      isChecked: true,
      category: 'grains_bread'
    })
  ]
})

// The same list as it arrives on a cold start: rows already checked on the server, so nothing in the answer
// and nothing in the cache names their aisle. Clearing these two would have to invent one.
const makeUnfiledCheckedGroceryList = (): GroceryList => {
  const seeded = makeGroceryList()

  return {
    ...seeded,
    checkedItems: seeded.checkedItems.map(({category: _category, ...item}) => item)
  }
}

// A plan whose rows are all unchecked and whose flags were already cleared: the write must be a no-op on it.
const makeUncheckedGroceryList = (): GroceryList => ({
  ...makeGroceryList(),
  checkedCount: 0,
  banner: null,
  checkedItems: []
})

const makeEmptyGroceryList = (): GroceryList => ({
  ...makeGroceryList(),
  totalCount: 0,
  checkedCount: 0,
  banner: null,
  sections: [],
  checkedItems: []
})

const makeUncheckAllResult = (): UncheckAllGroceriesResult => ({checkedCount: 0})

// getApiErrorCode duck-types `error.response.data.error`, so an Error carrying a response body is the honest
// fixture and no axios dependency is needed. Object.assign keeps it an Error, so nothing has to be cast.
const makeApiError = (data: unknown): Error =>
  Object.assign(new Error('Request failed'), {response: {status: 409, data}})

const networkError = new Error('Network request failed')

// Every mutation callback takes a trailing MutationFunctionContext in this version, so it is supplied here
// rather than asserted on: passing the real thing is what keeps these invocations free of casts, which is the
// point — a cast would hide a change to the very signature under test.
const callbackContext = (client: QueryClient): MutationFunctionContext => ({
  client,
  meta: undefined,
  mutationKey: mutationKeys.uncheckAllGroceries
})

const runOnMutate = async (options: UncheckAllOptions, client: QueryClient): Promise<UncheckAllSnapshot> =>
  options.onMutate?.(undefined, callbackContext(client))

const runOnError = (
  options: UncheckAllOptions,
  client: QueryClient,
  error: Error,
  snapshot: UncheckAllSnapshot
): void => {
  options.onError?.(error, undefined, snapshot, callbackContext(client))
}

const runOnSettled = (
  options: UncheckAllOptions,
  client: QueryClient,
  data: UncheckAllGroceriesResult | undefined,
  error: Error | null,
  snapshot: UncheckAllSnapshot
): void => {
  options.onSettled?.(data, error, undefined, snapshot, callbackContext(client))
}

const readGroceryList = (client: QueryClient, planId: string): GroceryList | undefined =>
  client.getQueryData<GroceryList>(queryKeys.groceryList(planId))

const everyRow = (list: GroceryList): GroceryItem[] => [
  ...list.sections.flatMap(section => section.items),
  ...list.checkedItems
]

const rowIds = (list: GroceryList): string[] => {
  const ids = everyRow(list).map(item => item.id)

  return ids.sort()
}

// An absent aisle and an emptied one both read as no rows here: the screen hides a stocked-nothing section,
// so which of the two the write produced is not a difference the shopper can see.
const aisleRowIds = (list: GroceryList, category: GroceryCategory): string[] => {
  const section = list.sections.find(candidate => candidate.category === category)

  return section === undefined ? [] : section.items.map(item => item.id)
}

let queryClient: QueryClient

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
  queryClient.clear()
})

describe('buildUncheckAllGroceriesMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized uncheck-all-groceries mutation key', () => {
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      expect(options.mutationKey).toBe(mutationKeys.uncheckAllGroceries)
    })

    it('installs the optimistic lifecycle handlers and leaves the mutation function to the hook', () => {
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      expect(typeof options.onMutate).toBe('function')
      expect(typeof options.onError).toBe('function')
      expect(typeof options.onSettled).toBe('function')
      // The settle refetch already reconciles a success, so there is nothing for onSuccess to do.
      expect(options.onSuccess).toBeUndefined()
      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onError', 'onMutate', 'onSettled'])
    })

    it('declares no retry policy — a grocery write carries no idempotency key and last write wins', () => {
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      expect(options.retry).toBeUndefined()
      expect(options.retryDelay).toBeUndefined()
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const cancelSpy = jest.spyOn(queryClient, 'cancelQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

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
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      expect(cancelSpy).toHaveBeenCalledWith({queryKey: queryKeys.groceryList(PLAN_ID)})
      expect(cancelSpy.mock.invocationCallOrder[0]).toBeLessThan(readSpy.mock.invocationCallOrder[0])
      expect(readSpy.mock.invocationCallOrder[0]).toBeLessThan(writeSpy.mock.invocationCallOrder[0])
    })

    it('unchecks every row whose aisle is known and clears every flag', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(everyRow(written).every(item => !item.isChecked)).toBe(true)
      expect(everyRow(written).every(item => item.flag === null)).toBe(true)
    })

    it('zeroes the checked count and empties the checked card, because nothing is checked any more', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // The checked card renders every row it is handed under a "Checked · n" heading, so a cleared row left
      // in it would be filed as checked while reading as unchecked.
      expect(written.checkedCount).toBe(0)
      expect(written.checkedItems).toEqual([])
      expect(written.checkedItems).toHaveLength(written.checkedCount)
    })

    it('puts every cleared row back in its own aisle rather than stranding it in the checked card', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList
      const aisleRows = written.sections.flatMap(section => section.items)

      // The aisle each row returns to is the one the list retained for it, never the closing catch-all: the
      // checked card renders whatever it is handed, so a cleared row left in it reads as unchecked under a
      // "Checked · n" heading, and a cleared row filed under "Pantry & other" claims an aisle nobody stated.
      expect(aisleRows.map(item => item.id).sort()).toEqual([
        'item-avocado',
        CHICKEN_ID,
        'item-rice',
        'item-salmon',
        SPINACH_ID
      ])
      expect(aisleRowIds(written, 'dairy_alternatives')).toEqual([CHICKEN_ID])
      expect(aisleRowIds(written, 'grains_bread')).toEqual(['item-rice'])
      expect(aisleRowIds(written, 'pantry_other')).toEqual([])
      expect(aisleRows.every(item => !item.isChecked)).toBe(true)
      expect(aisleRows.every(item => item.flag === null)).toBe(true)
    })

    it('clears the tick on a checked row whose aisle is known and returns it to that aisle', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), {
        ...seeded,
        checkedItems: [{...seeded.checkedItems[0], category: 'produce' as const}]
      })

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList
      const produce = written.sections.find(section => section.category === 'produce')
      const returned = produce?.items.find(item => item.id === CHICKEN_ID)

      // The aisle the client retained is an aisle the server itself stated for this row, so clearing the tick
      // states nothing the next answer will contradict.
      expect(produce?.items.map(item => item.id)).toEqual([SPINACH_ID, 'item-avocado', CHICKEN_ID])
      expect(returned?.isChecked).toBe(false)
      expect(returned?.flag).toBeNull()
      expect(written.checkedItems).toEqual([])
      expect(written.checkedCount).toBe(0)
    })

    it('keeps the tick on a checked row no aisle is known for, rather than moving it to Pantry & other', async () => {
      const seeded = makeUnfiledCheckedGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // Guessing the aisle would state something false about the store in front of the shopper; a tick the
      // settle refetch clears a moment later states nothing false, and that refetch is the only answer that
      // can name the aisle. The flag stays with the tick — it is the amount the shopper has not acknowledged.
      expect(written.checkedItems.map(item => item.id)).toEqual([CHICKEN_ID, 'item-rice'])
      expect(written.checkedItems.every(item => item.isChecked)).toBe(true)
      expect(written.checkedItems[0].flag).toEqual(seeded.checkedItems[0].flag)
      expect(written.checkedCount).toBe(2)
      expect(written.sections.map(section => section.category)).toEqual(['produce', 'protein'])
      expect(aisleRowIds(written, 'pantry_other')).toEqual([])
    })

    it('clears the rows whose aisle is known and only those, on a list holding both kinds', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), {
        ...seeded,
        checkedItems: [
          seeded.checkedItems[0],
          makeItem({id: 'item-eggs', catalogFoodId: 'food-eggs', name: 'Eggs', displayText: '12', isChecked: true})
        ]
      })

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(aisleRowIds(written, 'dairy_alternatives')).toEqual([CHICKEN_ID])
      expect(written.checkedItems.map(item => item.id)).toEqual(['item-eggs'])
      expect(written.checkedItems[0].isChecked).toBe(true)
      expect(written.checkedCount).toBe(1)
      expect(aisleRowIds(written, 'pantry_other')).toEqual([])
    })

    it('returns a cleared row to its own aisle when one was stamped on it', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), {
        ...seeded,
        checkedItems: seeded.checkedItems.map(item => ({...item, category: 'protein' as const}))
      })

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList
      const protein = written.sections.find(section => section.category === 'protein')

      expect(protein?.items.map(item => item.id)).toEqual(['item-salmon', CHICKEN_ID, 'item-rice'])
      expect(written.sections.map(section => section.category)).toEqual(['produce', 'protein'])
    })

    it('leaves an active list readable rather than resolving to the empty-list state', async () => {
      // The case the false empty state came from: every row checked, so the response carries no aisles at all.
      const allChecked: GroceryList = {
        ...makeGroceryList(),
        totalCount: 2,
        checkedCount: 2,
        banner: null,
        sections: [],
        checkedItems: [
          makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true}),
          makeItem({id: 'item-rice', name: 'Brown rice', isChecked: true})
        ]
      }

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), allChecked)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // Neither row has an aisle to return to, so both keep their ticks and the list still holds every row it
      // held. That is what keeps the shopper's groceries on screen: the empty-list state needs `totalCount`
      // 0 *and* no rows at all, so a list this write declined to move can never resolve to it.
      expect(rowIds(written)).toEqual([CHICKEN_ID, 'item-rice'])
      expect(everyRow(written)).toHaveLength(written.totalCount)
      expect(written.totalCount).toBe(2)
      expect(written.checkedItems.every(item => item.isChecked)).toBe(true)
      expect(aisleRowIds(written, 'pantry_other')).toEqual([])
    })

    it('leaves a partly checked list with stocked aisles and nothing in the checked card', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(written.sections.some(section => section.items.length > 0)).toBe(true)
      expect(written.checkedItems).toHaveLength(0)
      expect(written.checkedCount).toBe(0)
    })

    it('keeps every row the list holds, so nothing leaves the shopper list before the refetch lands', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(rowIds(written)).toEqual(rowIds(seeded))
      expect(everyRow(written)).toHaveLength(written.totalCount)
    })

    it('leaves the already-unchecked aisles and their row order alone', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(written.sections[0].category).toBe('produce')
      expect(written.sections[0].items.map(item => item.id)).toEqual([SPINACH_ID, 'item-avocado'])
      expect(written.sections[1].category).toBe('protein')
      expect(written.sections[1].items.map(item => item.id)).toEqual(['item-salmon'])
    })

    it('opens no closing catch-all aisle for a row the response named no aisle for', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeUnfiledCheckedGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      // The response states the aisle per section and holds the checked rows back, so these two have no aisle
      // to return to. 'Pantry & other' would read as the shopper's own answer to "which aisle is this in",
      // which is exactly what the client does not know; the settle refetch is what names it.
      expect(written.sections.map(section => section.category)).toEqual(['produce', 'protein'])
      expect(written.checkedItems.map(item => item.id)).toEqual([CHICKEN_ID, 'item-rice'])
    })

    it('leaves the banner, totals, revision and dates alone', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

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

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(seeded).toEqual(seededClone)
      expect(written).not.toBe(seeded)
      expect(written.checkedItems).not.toBe(seeded.checkedItems)
    })

    it('hands back a rollback snapshot for the error handler', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)
      const snapshot = await runOnMutate(options, queryClient)

      // What the snapshot holds is the factory's business; that it restores the list is asserted under onError.
      expect(snapshot).toBeDefined()
    })

    it('leaves a list that has nothing checked unchanged', async () => {
      const seeded = makeUncheckedGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      expect(readGroceryList(queryClient, PLAN_ID)).toEqual(seeded)
    })

    it('handles a list with no sections and no checked rows', async () => {
      const seeded = makeEmptyGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      const written = readGroceryList(queryClient, PLAN_ID) as GroceryList

      expect(written.sections).toEqual([])
      expect(written.checkedItems).toEqual([])
      expect(written.checkedCount).toBe(0)
      expect(written.totalCount).toBe(0)
    })

    it('writes no fabricated list when the grocery list is not cached', async () => {
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      expect(writeSpy).not.toHaveBeenCalled()
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))).toBeUndefined()
    })

    it('invalidates nothing, because clearing check marks is not a plan change', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })

    it('writes only the grocery list of its own plan', async () => {
      const otherPlanList = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), otherPlanList)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      await runOnMutate(options, queryClient)

      expect(readGroceryList(queryClient, OTHER_PLAN_ID)).toBe(otherPlanList)
    })
  })

  describe('onError', () => {
    it('restores the snapshot it was handed', async () => {
      const seeded = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), seeded)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)
      const snapshot = await runOnMutate(options, queryClient)

      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(0)

      runOnError(options, queryClient, networkError, snapshot)

      // Deep equality rather than identity: TanStack applies structural sharing to every cache write.
      expect(readGroceryList(queryClient, PLAN_ID)).toEqual(seeded)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(2)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedItems[0].flag).not.toBeNull()
    })

    it('restores the untouched previous list when the write only cleared the rows it had an aisle for', async () => {
      const seeded = makeGroceryList()
      const mixed: GroceryList = {
        ...seeded,
        checkedItems: [
          seeded.checkedItems[0],
          makeItem({id: 'item-eggs', catalogFoodId: 'food-eggs', name: 'Eggs', displayText: '12', isChecked: true})
        ]
      }

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), mixed)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)
      const snapshot = await runOnMutate(options, queryClient)

      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(1)

      runOnError(options, queryClient, networkError, snapshot)

      // The snapshot is the list as it was, whichever rows the optimistic write chose to move: a declined row
      // must not come back re-filed, and a cleared one must come back checked.
      expect(readGroceryList(queryClient, PLAN_ID)).toEqual(mixed)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedItems.map(item => item.id)).toEqual([
        CHICKEN_ID,
        'item-eggs'
      ])
      expect(aisleRowIds(readGroceryList(queryClient, PLAN_ID) as GroceryList, 'dairy_alternatives')).toEqual([])
    })

    it('invalidates the current plan on 409 plan_not_active', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)
      const snapshot = await runOnMutate(options, queryClient)

      runOnError(options, queryClient, makeApiError({error: API_ERROR_CODES.planNotActive}), snapshot)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.mealPlanCurrent])
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(true)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(2)
    })

    it('leaves the current plan alone for every error that is not plan_not_active', async () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)
      const snapshot = await runOnMutate(options, queryClient)
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

      runOnError(options, queryClient, makeApiError({error: API_ERROR_CODES.stalePlan}), snapshot)
      runOnError(options, queryClient, networkError, snapshot)
      runOnError(options, queryClient, makeApiError({error: 409}), snapshot)
      runOnError(options, queryClient, makeApiError({}), snapshot)
      runOnError(options, queryClient, makeApiError(null), snapshot)
      runOnError(options, queryClient, makeApiError(undefined), snapshot)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })

    it('rolls nothing back when no snapshot was captured', async () => {
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)
      // onMutate against an empty cache produces the genuinely empty snapshot, so nothing here is hand-built.
      const emptySnapshot = await runOnMutate(options, queryClient)
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')

      runOnError(options, queryClient, networkError, undefined)
      runOnError(options, queryClient, networkError, emptySnapshot)

      expect(writeSpy).not.toHaveBeenCalled()
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
    })

    it('still recovers the plan state when a 409 arrives without a snapshot', () => {
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      runOnError(options, queryClient, makeApiError({error: API_ERROR_CODES.planNotActive}), undefined)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.mealPlanCurrent])
    })
  })

  describe('onSettled', () => {
    it('refetches the grocery list once after a successful write', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, makeUncheckAllResult(), null, undefined)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(true)
    })

    it('refetches the grocery list once after a failed write, so the server counts win either way', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, undefined, makeApiError({error: API_ERROR_CODES.planNotActive}), undefined)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(true)
    })

    it('still asks for the refetch when the list is no longer cached', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, makeUncheckAllResult(), null, undefined)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([queryKeys.groceryList(PLAN_ID)])
      expect(readGroceryList(queryClient, PLAN_ID)).toBeUndefined()
    })

    it('leaves another plan grocery list and the current plan valid', () => {
      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, PLAN_ID)

      runOnSettled(options, queryClient, makeUncheckAllResult(), null, undefined)

      expect(queryClient.getQueryState(queryKeys.groceryList(OTHER_PLAN_ID))?.isInvalidated).toBe(false)
      expect(queryClient.getQueryState(queryKeys.mealPlanCurrent)?.isInvalidated).toBe(false)
    })
  })

  describe('the planId it was built with', () => {
    it('targets that plan throughout the lifecycle and never the one it was not given', async () => {
      const otherPlanList = makeGroceryList()

      queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), makeGroceryList())
      queryClient.setQueryData(queryKeys.groceryList(OTHER_PLAN_ID), otherPlanList)

      const options = buildUncheckAllGroceriesMutationOptions(queryClient, OTHER_PLAN_ID)
      const cancelSpy = jest.spyOn(queryClient, 'cancelQueries')

      await runOnMutate(options, queryClient)
      runOnSettled(options, queryClient, makeUncheckAllResult(), null, undefined)

      expect(cancelSpy).toHaveBeenCalledWith({queryKey: queryKeys.groceryList(OTHER_PLAN_ID)})
      expect(readGroceryList(queryClient, OTHER_PLAN_ID)?.checkedCount).toBe(0)
      expect(queryClient.getQueryState(queryKeys.groceryList(OTHER_PLAN_ID))?.isInvalidated).toBe(true)
      expect(readGroceryList(queryClient, PLAN_ID)?.checkedCount).toBe(2)
      expect(queryClient.getQueryState(queryKeys.groceryList(PLAN_ID))?.isInvalidated).toBe(false)
    })
  })
})
