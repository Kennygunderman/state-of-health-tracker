import {CatalogFood, CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {queryKeys} from '@queries/keys'
import {QueryClient} from '@tanstack/react-query'
import {CATALOG_SEARCH_MAX_QUERY_LENGTH, CATALOG_SEARCH_MIN_QUERY_LENGTH} from '@utility/CatalogSearchStateUtility'

import {
  buildCatalogSearchQueryOptions,
  CATALOG_SEARCH_GC_TIME_MS,
  CATALOG_SEARCH_STALE_TIME_MS
} from '../useCatalogSearchInfiniteQuery.util'

// Replaced by a factory rather than jest's automock, which would still evaluate the real module and pull in
// the native Firebase auth chain behind httpUtil; the mock only records the arguments the request is checked against.
jest.mock('@queries/api/catalog/searchCatalogFoods', () => ({
  searchCatalogFoods: jest.fn()
}))

const SEARCH_QUERY = 'chicken'
const OTHER_SEARCH_QUERY = 'chickpea'
const FIVE_MINUTES_MS = 300_000
const FIRST_PAGE = 1
const SECOND_PAGE = 2
const LAST_PAGE = 3
const PAGE_LIMIT = 25
// One more forward fetch than the five-page window this query used to declare, against a result set deeper
// still, so the sixth fetch is a page the server really answers rather than the end of the results.
const DEEP_PAGE_COUNT = 6
const DEEP_LAST_PAGE = 8

type CatalogSearchOptions = ReturnType<typeof buildCatalogSearchQueryOptions>

type CatalogSearchRequest = (context: {pageParam: number}) => Promise<CatalogFoodSearchResult>

// Narrowed because queryFn is declared optional and may be a skip token; the factory always supplies it.
const requestOf = (options: CatalogSearchOptions): CatalogSearchRequest => options.queryFn as CatalogSearchRequest

// items are irrelevant to paging — getNextPageParam reads the pagination block the server sends.
const resultPage = (page: number, totalPages: number): CatalogFoodSearchResult => ({
  items: [],
  pagination: {page, limit: PAGE_LIMIT, total: totalPages * PAGE_LIMIT, totalPages}
})

// The id identifies the page a row arrived on, which is what makes "page 1's rows are still there" an
// assertion about the rows rather than about the number of pages held.
const itemId = (page: number): string => `page-${page}-item`

const pageItem = (page: number): CatalogFood => ({
  id: itemId(page),
  name: `Chicken breast ${page}`,
  category: 'protein_poultry',
  foodState: 'raw',
  identitySource: 'usda',
  nutritionProvenance: 'source_backed',
  nutritionBasis: 'per_100g',
  basisAmount: 100,
  calories: 120,
  protein: 22.5,
  carbs: 0,
  fat: 2.6,
  fiber: 0,
  defaultPortion: {description: '4 oz', amount: 4, unit: 'oz', gramWeight: 113.4},
  allergenTags: [],
  allergenStatus: 'known',
  foodGroup: 'poultry'
})

const itemPage = (page: number, totalPages: number): CatalogFoodSearchResult => ({
  items: [pageItem(page)],
  pagination: {page, limit: PAGE_LIMIT, total: totalPages * PAGE_LIMIT, totalPages}
})

describe('buildCatalogSearchQueryOptions', () => {
  // Reset rather than clear, so the page factory the reachability case installs cannot leak into a case that
  // only inspects the arguments the request was made with.
  beforeEach(() => {
    jest.mocked(searchCatalogFoods).mockReset()
  })

  describe('cache identity', () => {
    it('keys on the shared registry factory rather than a locally built array', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)

      expect(options.queryKey).toEqual(queryKeys.catalogSearch(SEARCH_QUERY))
    })

    it('gives two different terms two different query keys', () => {
      const first = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const second = buildCatalogSearchQueryOptions(OTHER_SEARCH_QUERY)

      expect(first.queryKey).not.toEqual(second.queryKey)
    })
  })

  describe('the request the key stands for', () => {
    it('issues the term its key names for the page being fetched', async () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)

      await requestOf(options)({pageParam: SECOND_PAGE})

      expect(searchCatalogFoods).toHaveBeenCalledWith(SEARCH_QUERY, SECOND_PAGE)
    })

    it('starts from the first page', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)

      expect(options.initialPageParam).toBe(FIRST_PAGE)
    })
  })

  describe('the minimum query length', () => {
    it('is the two characters the search endpoint requires', () => {
      expect(CATALOG_SEARCH_MIN_QUERY_LENGTH).toBe(2)
    })

    it('enables the query at two characters', () => {
      const options = buildCatalogSearchQueryOptions('ch')

      expect(options.enabled).toBe(true)
    })

    it('enables a two-character term typed with surrounding whitespace', () => {
      const options = buildCatalogSearchQueryOptions('  ch  ')

      expect(options.enabled).toBe(true)
    })

    it('disables the query at one character', () => {
      const options = buildCatalogSearchQueryOptions('c')

      expect(options.enabled).toBe(false)
    })

    it('disables the query for an empty term', () => {
      const options = buildCatalogSearchQueryOptions('')

      expect(options.enabled).toBe(false)
    })

    it('disables the query for a whitespace-only term', () => {
      const options = buildCatalogSearchQueryOptions('   ')

      expect(options.enabled).toBe(false)
    })
  })

  // The gate is the shared catalog rule, so the upper bound the server enforces disables this query rather
  // than issuing a request it is certain to refuse with `400 invalid_request`.
  describe('the maximum query length', () => {
    it('is the sixty characters the search endpoint accepts', () => {
      expect(CATALOG_SEARCH_MAX_QUERY_LENGTH).toBe(60)
    })

    it('enables the query at exactly sixty characters', () => {
      const options = buildCatalogSearchQueryOptions('c'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH))

      expect(options.enabled).toBe(true)
    })

    it('disables the query at sixty-one characters', () => {
      const options = buildCatalogSearchQueryOptions('c'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH + 1))

      expect(options.enabled).toBe(false)
    })

    it('enables a sixty-character term typed with surrounding whitespace', () => {
      const options = buildCatalogSearchQueryOptions(` ${'c'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH)} `)

      expect(options.enabled).toBe(true)
    })

    it('disables the query for a term carrying a control character', () => {
      const options = buildCatalogSearchQueryOptions('chick\u0000en')

      expect(options.enabled).toBe(false)
    })
  })

  describe('paging through the result set', () => {
    it('advances to the next page while one remains', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const pages = [resultPage(FIRST_PAGE, LAST_PAGE)]

      expect(options.getNextPageParam(pages[0], pages, FIRST_PAGE, [FIRST_PAGE])).toBe(SECOND_PAGE)
    })

    it('stops on the last page', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const pages = [
        resultPage(FIRST_PAGE, LAST_PAGE),
        resultPage(SECOND_PAGE, LAST_PAGE),
        resultPage(LAST_PAGE, LAST_PAGE)
      ]

      expect(options.getNextPageParam(pages[2], pages, LAST_PAGE, [FIRST_PAGE, SECOND_PAGE, LAST_PAGE])).toBeUndefined()
    })

    it('stops on a single-page result', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const pages = [resultPage(FIRST_PAGE, 1)]

      expect(options.getNextPageParam(pages[0], pages, FIRST_PAGE, [FIRST_PAGE])).toBeUndefined()
    })

    it('stops on a result with no matches at all', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const pages = [resultPage(FIRST_PAGE, 0)]

      expect(options.getNextPageParam(pages[0], pages, FIRST_PAGE, [FIRST_PAGE])).toBeUndefined()
    })
  })

  describe('retention policy', () => {
    it('declares five minutes of freshness instead of the app-wide 60 seconds', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)

      expect(CATALOG_SEARCH_STALE_TIME_MS).toBe(FIVE_MINUTES_MS)
      expect(options.staleTime).toBe(FIVE_MINUTES_MS)
    })

    it('evicts an abandoned term after five minutes instead of the app-wide 24 hours', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)

      expect(CATALOG_SEARCH_GC_TIME_MS).toBe(FIVE_MINUTES_MS)
      expect(options.gcTime).toBe(FIVE_MINUTES_MS)
    })
  })

  // Exercised against a real QueryClient rather than by reading the options object, because what is being
  // asserted is what the cache HOLDS after paging: a `maxPages` window would satisfy every option-level
  // assertion above and still delete the rows of page 1 on the sixth forward fetch, which is the only way
  // either consumer pages (both call `fetchNextPage` alone).
  describe('reachability of the rows already fetched', () => {
    it('still holds the first page after six forward fetches of a longer result set', async () => {
      jest.mocked(searchCatalogFoods).mockImplementation(async (query, page) => itemPage(page, DEEP_LAST_PAGE))

      const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}}})

      // Cleared in `finally` so that a failing assertion cannot leave this query's five-minute gcTime timer
      // holding the jest worker open, which would report the regression as a hang rather than as a failure.
      try {
        const data = await queryClient.fetchInfiniteQuery({
          ...buildCatalogSearchQueryOptions(SEARCH_QUERY),
          pages: DEEP_PAGE_COUNT
        })

        expect(data.pages).toHaveLength(DEEP_PAGE_COUNT)
        expect(data.pageParams[0]).toBe(FIRST_PAGE)
        expect(data.pages[0].items.map(item => item.id)).toContain(itemId(FIRST_PAGE))
        expect(data.pages.flatMap(page => page.items.map(item => item.id))).toEqual([
          itemId(1),
          itemId(2),
          itemId(3),
          itemId(4),
          itemId(5),
          itemId(6)
        ])
      } finally {
        queryClient.clear()
      }
    })
  })
})
