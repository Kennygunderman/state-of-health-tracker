import {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import {fetchCatalogSuggestions} from '@queries/api/catalog/fetchCatalogSuggestions'
import {queryKeys} from '@queries/keys'

import {
  buildCatalogSuggestionsQueryOptions,
  CATALOG_SUGGESTION_KIND,
  CATALOG_SUGGESTION_LIMIT
} from '../useCatalogSuggestionsQuery.util'

// Replaced by a factory rather than jest's automock, which would still evaluate the real module and pull in
// the native Firebase auth chain behind httpUtil; the mock only records the arguments the key is checked against.
jest.mock('@queries/api/catalog/fetchCatalogSuggestions', () => ({
  fetchCatalogSuggestions: jest.fn()
}))

const NON_DEFAULT_LIMIT = 25
const SMALLEST_LIMIT = 1
const LARGEST_LIMIT = 30

type CatalogSuggestionsOptions = ReturnType<typeof buildCatalogSuggestionsQueryOptions>

// Narrowed because queryFn is declared optional and may be a skip token; the factory always supplies it.
const requestOf = (options: CatalogSuggestionsOptions): (() => Promise<CatalogFoodSuggestion[]>) =>
  options.queryFn as () => Promise<CatalogFoodSuggestion[]>

describe('buildCatalogSuggestionsQueryOptions', () => {
  beforeEach(() => {
    jest.mocked(fetchCatalogSuggestions).mockClear()
  })

  describe('resolved request inputs', () => {
    it('asks for the one kind the suggestions endpoint answers', () => {
      expect(CATALOG_SUGGESTION_KIND).toBe('dislike')
    })

    it('defaults to the server default of 12 suggestions', () => {
      expect(CATALOG_SUGGESTION_LIMIT).toBe(12)
    })
  })

  describe('cache identity', () => {
    it('gives two different limits two different query keys', () => {
      const smallest = buildCatalogSuggestionsQueryOptions(SMALLEST_LIMIT)
      const largest = buildCatalogSuggestionsQueryOptions(LARGEST_LIMIT)

      expect(smallest.queryKey).not.toEqual(largest.queryKey)
    })

    it('gives the same limit the same query key', () => {
      const first = buildCatalogSuggestionsQueryOptions(NON_DEFAULT_LIMIT)
      const second = buildCatalogSuggestionsQueryOptions(NON_DEFAULT_LIMIT)

      expect(first.queryKey).toEqual(second.queryKey)
    })

    it('keys an omitted limit exactly as the default limit passed explicitly', () => {
      const omitted = buildCatalogSuggestionsQueryOptions()
      const explicit = buildCatalogSuggestionsQueryOptions(CATALOG_SUGGESTION_LIMIT)

      expect(omitted.queryKey).toEqual(explicit.queryKey)
    })

    it('keys on the shared registry factory rather than a locally built array', () => {
      const options = buildCatalogSuggestionsQueryOptions(NON_DEFAULT_LIMIT)

      expect(options.queryKey).toEqual(queryKeys.catalogSuggestions('dislike', NON_DEFAULT_LIMIT))
    })

    it('stays under the catalogSuggestionsAll prefix so one invalidation reaches every limit', () => {
      const options = buildCatalogSuggestionsQueryOptions(NON_DEFAULT_LIMIT)

      expect(options.queryKey.slice(0, queryKeys.catalogSuggestionsAll.length)).toEqual(queryKeys.catalogSuggestionsAll)
    })
  })

  describe('the request the key stands for', () => {
    it('issues the kind and limit its key names for an explicit limit', () => {
      const options = buildCatalogSuggestionsQueryOptions(NON_DEFAULT_LIMIT)

      requestOf(options)()

      expect(fetchCatalogSuggestions).toHaveBeenCalledWith(CATALOG_SUGGESTION_KIND, NON_DEFAULT_LIMIT)
      expect(options.queryKey).toEqual(queryKeys.catalogSuggestions(CATALOG_SUGGESTION_KIND, NON_DEFAULT_LIMIT))
    })

    it('issues the default limit its key names when no limit is given', () => {
      const options = buildCatalogSuggestionsQueryOptions()

      requestOf(options)()

      expect(fetchCatalogSuggestions).toHaveBeenCalledWith(CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT)
      expect(options.queryKey).toEqual(queryKeys.catalogSuggestions(CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT))
    })

    it('never issues one limit under the key of another', () => {
      const options = buildCatalogSuggestionsQueryOptions(SMALLEST_LIMIT)

      requestOf(options)()

      expect(fetchCatalogSuggestions).not.toHaveBeenCalledWith(CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT)
      expect(options.queryKey).not.toEqual(
        queryKeys.catalogSuggestions(CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT)
      )
    })
  })
})
