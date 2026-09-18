import {GroceryItem, GroceryList} from '@data/models/GroceryList'
import {fetchGroceryList} from '@queries/api/mealPlanning/fetchGroceryList'
import {queryKeys} from '@queries/keys'
import {QueryClient} from '@tanstack/react-query'

import {buildGroceryListQueryOptions} from '../useGroceryListQuery.util'

// Replaced by a factory rather than jest's automock, which would still evaluate the real module and pull in
// the native Firebase auth chain behind httpUtil; the mock only records the plan id the read asks for and
// supplies the answer being stamped. Every QueryClient below is real, because the aisle the read retains is
// taken out of a real cache entry.
jest.mock('@queries/api/mealPlanning/fetchGroceryList', () => ({
  fetchGroceryList: jest.fn()
}))

const fetchGroceryListMock = fetchGroceryList as jest.MockedFunction<typeof fetchGroceryList>

const PLAN_ID = 'plan-1'
const CHICKEN_ID = 'item-chicken'

const makeItem = (overrides: Partial<GroceryItem> = {}): GroceryItem => ({
  id: 'item-spinach',
  catalogFoodId: 'food-spinach',
  foodState: 'raw',
  name: 'Spinach',
  quantityGrams: 420,
  displayText: '7 cups',
  isChecked: false,
  flag: null,
  ...overrides
})

const makeList = (overrides: Partial<GroceryList> = {}): GroceryList => ({
  planId: PLAN_ID,
  planRevision: 3,
  startDate: '2026-07-05',
  endDate: '2026-07-11',
  totalCount: 3,
  checkedCount: 1,
  banner: null,
  sections: [{category: 'produce', items: [makeItem()]}],
  checkedItems: [makeItem({id: CHICKEN_ID, catalogFoodId: 'food-chicken', name: 'Chicken breast', isChecked: true})],
  ...overrides
})

// The answer as it arrives: the ticked row sits in checkedItems with no category, because the response states
// the aisle per section and holds the checked rows out of the sections (0.5.2).
const makeAnswer = (): GroceryList => makeList()

const findChecked = (list: GroceryList): GroceryItem | undefined =>
  list.checkedItems.find(item => item.id === CHICKEN_ID)

type GroceryListOptions = ReturnType<typeof buildGroceryListQueryOptions>

// Narrowed because queryFn is declared optional and may be a skip token; the factory always supplies it.
const requestOf = (options: GroceryListOptions): (() => Promise<GroceryList>) =>
  options.queryFn as () => Promise<GroceryList>

let queryClient: QueryClient

beforeEach(() => {
  fetchGroceryListMock.mockReset()
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  queryClient.clear()
})

describe('buildGroceryListQueryOptions', () => {
  it('keys the read by plan id and enables it', () => {
    const options = buildGroceryListQueryOptions(queryClient, PLAN_ID)

    expect(options.queryKey).toEqual(queryKeys.groceryList(PLAN_ID))
    expect(options.enabled).toBe(true)
  })

  it('disables the read for the no-plan state and still names a well-formed key', () => {
    const options = buildGroceryListQueryOptions(queryClient, null)

    expect(options.enabled).toBe(false)
    expect(options.queryKey).toEqual(queryKeys.groceryList(''))
  })

  it('requests the named plan', async () => {
    fetchGroceryListMock.mockResolvedValue(makeAnswer())

    const options = buildGroceryListQueryOptions(queryClient, PLAN_ID)

    await requestOf(options)()

    expect(fetchGroceryListMock).toHaveBeenCalledWith(PLAN_ID)
  })

  it('retains the aisle the cached list knew for a row that arrives checked and bare', async () => {
    queryClient.setQueryData(
      queryKeys.groceryList(PLAN_ID),
      makeList({
        sections: [
          {category: 'produce', items: [makeItem()]},
          {category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}
        ],
        checkedItems: []
      })
    )
    fetchGroceryListMock.mockResolvedValue(makeAnswer())

    const options = buildGroceryListQueryOptions(queryClient, PLAN_ID)
    const result = await requestOf(options)()

    expect(findChecked(result)?.category).toBe('protein')
  })

  it('carries a retained stamp forward, so an aisle survives more than one refetch of the ticked row', async () => {
    queryClient.setQueryData(
      queryKeys.groceryList(PLAN_ID),
      makeList({
        sections: [{category: 'produce', items: [makeItem()]}],
        checkedItems: [makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true, category: 'grains_bread'})]
      })
    )
    fetchGroceryListMock.mockResolvedValue(makeAnswer())

    const options = buildGroceryListQueryOptions(queryClient, PLAN_ID)
    const result = await requestOf(options)()

    expect(findChecked(result)?.category).toBe('grains_bread')
  })

  it('leaves an answer alone when the cache holds no list for the plan', async () => {
    const answer = makeAnswer()

    fetchGroceryListMock.mockResolvedValue(answer)

    const options = buildGroceryListQueryOptions(queryClient, PLAN_ID)
    const result = await requestOf(options)()

    expect(result).toBe(answer)
    expect(findChecked(result)?.category).toBeUndefined()
  })

  it('declares only the key, the request and its gate, so no other read behaviour is introduced silently', () => {
    expect(Object.keys(buildGroceryListQueryOptions(queryClient, PLAN_ID)).sort()).toStrictEqual([
      'enabled',
      'queryFn',
      'queryKey'
    ])
  })

  it('reads the cache before the request is awaited, so the aisle retained is the one the shopper was looking at', async () => {
    queryClient.setQueryData(
      queryKeys.groceryList(PLAN_ID),
      makeList({
        sections: [{category: 'protein', items: [makeItem({id: CHICKEN_ID, name: 'Chicken breast'})]}],
        checkedItems: []
      })
    )

    let release: (list: GroceryList) => void = () => undefined

    fetchGroceryListMock.mockReturnValue(
      new Promise<GroceryList>(resolve => {
        release = resolve
      })
    )

    const options = buildGroceryListQueryOptions(queryClient, PLAN_ID)
    const pending = requestOf(options)()

    // An optimistic write lands while the read is in flight and files the row under the catch-all, which is
    // exactly the guess this retention exists to prevent. The answer must not adopt it.
    queryClient.setQueryData(
      queryKeys.groceryList(PLAN_ID),
      makeList({
        sections: [],
        checkedItems: [makeItem({id: CHICKEN_ID, name: 'Chicken breast', isChecked: true, category: 'pantry_other'})]
      })
    )
    release(makeAnswer())

    const result = await pending

    expect(findChecked(result)?.category).toBe('protein')
  })
})
