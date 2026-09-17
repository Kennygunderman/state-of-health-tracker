import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {queryKeys} from '@queries/keys'

import {
  buildCatalogSearchQueryOptions,
  CATALOG_SEARCH_GC_TIME_MS,
  CATALOG_SEARCH_MAX_PAGES,
  CATALOG_SEARCH_MIN_QUERY_LENGTH,
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

type CatalogSearchOptions = ReturnType<typeof buildCatalogSearchQueryOptions>

type CatalogSearchRequest = (context: {pageParam: number}) => Promise<CatalogFoodSearchResult>

// Narrowed because queryFn is declared optional and may be a skip token; the factory always supplies it.
const requestOf = (options: CatalogSearchOptions): CatalogSearchRequest => options.queryFn as CatalogSearchRequest

// items are irrelevant to paging — getNextPageParam reads the pagination block the server sends.
const resultPage = (page: number, totalPages: number): CatalogFoodSearchResult => ({
  items: [],
  pagination: {page, limit: PAGE_LIMIT, total: totalPages * PAGE_LIMIT, totalPages}
})

describe('buildCatalogSearchQueryOptions', () => {
  beforeEach(() => {
    jest.mocked(searchCatalogFoods).mockClear()
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

    it('holds at most five pages of one term, so an active search cannot grow without bound', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)

      expect(CATALOG_SEARCH_MAX_PAGES).toBe(5)
      expect(options.maxPages).toBe(CATALOG_SEARCH_MAX_PAGES)
    })

    // The cap is only safe while what it drops can come back: both screens page strictly forward, so a
    // dropped leading page would otherwise be rows deleted from a rendered list for good.
    it('can page backwards, so a page the cap dropped is recoverable', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const windowPages = [resultPage(SECOND_PAGE, LAST_PAGE), resultPage(LAST_PAGE, LAST_PAGE)]

      expect(options.getPreviousPageParam?.(windowPages[0], windowPages, SECOND_PAGE, [SECOND_PAGE, LAST_PAGE])).toBe(
        FIRST_PAGE
      )
    })

    it('offers no previous page while the first page is still resident', () => {
      const options = buildCatalogSearchQueryOptions(SEARCH_QUERY)
      const pages = [resultPage(FIRST_PAGE, LAST_PAGE)]

      expect(options.getPreviousPageParam?.(pages[0], pages, FIRST_PAGE, [FIRST_PAGE])).toBeUndefined()
    })
  })
})
