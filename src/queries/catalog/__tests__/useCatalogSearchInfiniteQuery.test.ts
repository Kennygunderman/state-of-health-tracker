import {CatalogFood, CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {queryKeys} from '@queries/keys'

import {useCatalogSearchInfiniteQuery} from '../useCatalogSearchInfiniteQuery'

// Both dependencies are replaced by explicit factories rather than jest's automock, which would still evaluate
// the real modules and pull the native Firebase auth chain in behind httpUtil. `useInfiniteQuery` hands its own
// argument straight back, which is what lets this suite read the options the hook builds: no renderer and no
// Testing Library is installed, so the hook cannot be mounted.
jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn((options: unknown) => options)
}))

jest.mock('@queries/api/catalog/searchCatalogFoods', () => ({
  searchCatalogFoods: jest.fn()
}))

const QUERY = 'chicken'
const PADDED_QUERY = '  chicken  '
// Longer than the server's 60-character upper bound on `q`, which this hook does not police.
const OVERLONG_QUERY = 'c'.repeat(80)
// The page size `searchCatalogFoods` defaults to when the hook passes no limit.
const API_DEFAULT_LIMIT = 25

// Only the members this suite asserts are declared, and every assertion below reads one member: the hook is
// free to carry further options (cache retention, for one) without an exhaustive shape or a whole-object
// equality assertion here turning that addition into a failure.
interface CatalogSearchOptions {
  queryKey: readonly unknown[]
  queryFn: (context: {pageParam: number}) => Promise<CatalogFoodSearchResult>
  enabled: boolean
  initialPageParam: number
  getNextPageParam: (
    lastPage: CatalogFoodSearchResult,
    pages: CatalogFoodSearchResult[],
    lastPageParam: number
  ) => number | undefined
}

// The one place the mocked runtime is reconciled with the hook's declared type: `useInfiniteQuery` is stubbed to
// return its argument, so the declared `UseInfiniteQueryResult` is a lie here and the call really yields the
// options object above.
const optionsFor = (query: string): CatalogSearchOptions =>
  // eslint-disable-next-line react-hooks/rules-of-hooks -- a pure options builder under this suite's mock
  useCatalogSearchInfiniteQuery(query) as unknown as CatalogSearchOptions

const catalogFood: CatalogFood = {
  id: 'catalog-food-1',
  name: 'Chicken breast, boneless, skinless, raw',
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
}

const pageOf = (page: number, totalPages: number, items: CatalogFood[] = [catalogFood]): CatalogFoodSearchResult => ({
  items,
  pagination: {page, limit: API_DEFAULT_LIMIT, total: totalPages * API_DEFAULT_LIMIT, totalPages}
})

describe('useCatalogSearchInfiniteQuery', () => {
  beforeEach(() => {
    jest.mocked(searchCatalogFoods).mockClear()
  })

  describe('cache identity', () => {
    it('keys on the shared registry factory rather than a locally built array', () => {
      expect(optionsFor(QUERY).queryKey).toEqual(queryKeys.catalogSearch(QUERY))
    })

    it('keys on the raw query, so the cache key and the request cannot name different searches', () => {
      const options = optionsFor(PADDED_QUERY)

      expect(options.queryKey).toEqual(queryKeys.catalogSearch(PADDED_QUERY))
      expect(options.queryKey).not.toEqual(queryKeys.catalogSearch(QUERY))
    })

    it('gives two different queries two different keys', () => {
      expect(optionsFor(QUERY).queryKey).not.toEqual(optionsFor('salmon').queryKey)
    })

    it('gives the same query the same key', () => {
      expect(optionsFor(QUERY).queryKey).toEqual(optionsFor(QUERY).queryKey)
    })
  })

  // The gate exists because the server rejects anything shorter than two trimmed characters with
  // `400 invalid_request`, and `searchCatalogFoods` records that failure as a crash and rethrows it — so a
  // query the server would refuse has to leave this query idle rather than reach the api function at all.
  describe('the enable gate', () => {
    it('stays idle for an empty query', () => {
      expect(optionsFor('').enabled).toBe(false)
    })

    it('stays idle for a single character', () => {
      expect(optionsFor('a').enabled).toBe(false)
    })

    it('runs at two characters', () => {
      expect(optionsFor('ab').enabled).toBe(true)
    })

    it('stays idle for whitespace alone', () => {
      expect(optionsFor('   ').enabled).toBe(false)
    })

    it('stays idle for one character inside padding', () => {
      expect(optionsFor('  a  ').enabled).toBe(false)
    })

    it('runs for two characters inside padding', () => {
      expect(optionsFor('  ab  ').enabled).toBe(true)
    })

    it('runs for a query longer than the server bound, which is the server to answer and not this gate', () => {
      expect(optionsFor(OVERLONG_QUERY).enabled).toBe(true)
    })
  })

  describe('the request each page stands for', () => {
    it('starts at the first page', () => {
      expect(optionsFor(QUERY).initialPageParam).toBe(1)
    })

    it('asks the api function for the raw query and the page it was handed, and for nothing else', () => {
      optionsFor(QUERY).queryFn({pageParam: 2})

      expect(searchCatalogFoods).toHaveBeenCalledTimes(1)
      expect(searchCatalogFoods).toHaveBeenCalledWith(QUERY, 2)
      // No third argument, so the api function's own default page size stands rather than a page size the hook
      // invents and the pagination block would then disagree with.
      expect(jest.mocked(searchCatalogFoods).mock.calls[0]).toHaveLength(2)
    })

    it('requests the same raw query its key names', () => {
      const options = optionsFor(PADDED_QUERY)

      options.queryFn({pageParam: 1})

      expect(searchCatalogFoods).toHaveBeenCalledWith(PADDED_QUERY, 1)
      expect(options.queryKey).toEqual(queryKeys.catalogSearch(PADDED_QUERY))
    })
  })

  describe('pagination termination', () => {
    it('advances from the first page while pages remain', () => {
      expect(optionsFor(QUERY).getNextPageParam(pageOf(1, 3), [], 1)).toBe(2)
    })

    it('advances from an intermediate page while pages remain', () => {
      expect(optionsFor(QUERY).getNextPageParam(pageOf(2, 3), [], 2)).toBe(3)
    })

    it('stops on the last page of several', () => {
      expect(optionsFor(QUERY).getNextPageParam(pageOf(3, 3), [], 3)).toBeUndefined()
    })

    it('stops when the first page is the only page', () => {
      expect(optionsFor(QUERY).getNextPageParam(pageOf(1, 1), [], 1)).toBeUndefined()
    })

    it('stops when the answer holds no pages at all', () => {
      expect(optionsFor(QUERY).getNextPageParam(pageOf(1, 0, []), [], 1)).toBeUndefined()
    })

    it('advances on an empty page while the pagination block still reports pages', () => {
      expect(optionsFor(QUERY).getNextPageParam(pageOf(1, 3, []), [], 1)).toBe(2)
    })
  })
})
