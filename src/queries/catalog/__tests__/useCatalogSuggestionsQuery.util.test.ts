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

const SMALLEST_ACCEPTED_LIMIT = 1
const LARGEST_ACCEPTED_LIMIT = 30

type CatalogSuggestionsOptions = ReturnType<typeof buildCatalogSuggestionsQueryOptions>

// Narrowed because queryFn is declared optional and may be a skip token; the factory always supplies it.
const requestOf = (options: CatalogSuggestionsOptions): (() => Promise<CatalogFoodSuggestion[]>) =>
  options.queryFn as () => Promise<CatalogFoodSuggestion[]>

describe('buildCatalogSuggestionsQueryOptions', () => {
  beforeEach(() => {
    jest.mocked(fetchCatalogSuggestions).mockClear()
  })

  describe('fixed request inputs', () => {
    it('asks for the one kind the suggestions endpoint answers', () => {
      expect(CATALOG_SUGGESTION_KIND).toBe('dislike')
    })

    it('asks for the server default of 12 suggestions', () => {
      expect(CATALOG_SUGGESTION_LIMIT).toBe(12)
    })

    it('asks for a count the endpoint accepts', () => {
      expect(CATALOG_SUGGESTION_LIMIT).toBeGreaterThanOrEqual(SMALLEST_ACCEPTED_LIMIT)
      expect(CATALOG_SUGGESTION_LIMIT).toBeLessThanOrEqual(LARGEST_ACCEPTED_LIMIT)
    })
  })

  describe('cache identity', () => {
    it('keys on the shared registry entry rather than a locally built array', () => {
      const options = buildCatalogSuggestionsQueryOptions()

      expect(options.queryKey).toEqual(queryKeys.catalogSuggestions)
    })

    it('carries no kind or limit segment, so invalidating the one key reaches the list', () => {
      const options = buildCatalogSuggestionsQueryOptions()

      // Asserted against the registry entry rather than a literal twin of it: a locally spelled array would
      // pass while the registry drifted underneath it.
      expect(options.queryKey).toHaveLength(queryKeys.catalogSuggestions.length)
      expect(queryKeys.catalogSuggestions).toHaveLength(1)
      expect(options.queryKey).not.toContain(CATALOG_SUGGESTION_KIND)
      expect(options.queryKey).not.toContain(CATALOG_SUGGESTION_LIMIT)
    })

    it('answers every call with the same key and the same request, so one list keeps one identity', () => {
      const first = buildCatalogSuggestionsQueryOptions()
      const second = buildCatalogSuggestionsQueryOptions()

      requestOf(first)()
      requestOf(second)()

      expect(first.queryKey).toEqual(second.queryKey)
      expect(jest.mocked(fetchCatalogSuggestions).mock.calls).toEqual([
        [CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT],
        [CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT]
      ])
    })
  })

  describe('the request the key stands for', () => {
    it('issues the fixed kind and limit and nothing else', () => {
      const options = buildCatalogSuggestionsQueryOptions()

      requestOf(options)()

      expect(fetchCatalogSuggestions).toHaveBeenCalledTimes(1)
      expect(fetchCatalogSuggestions).toHaveBeenCalledWith(CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT)
    })

    it('resolves to the list the request answers', async () => {
      const suggestions: CatalogFoodSuggestion[] = [{id: 'catalog-food-1', name: 'Broccoli', foodGroup: 'vegetables'}]

      jest.mocked(fetchCatalogSuggestions).mockResolvedValueOnce(suggestions)

      await expect(requestOf(buildCatalogSuggestionsQueryOptions())()).resolves.toBe(suggestions)
    })
  })
})
