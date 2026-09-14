import {CatalogFoodSuggestion, CatalogSuggestionKind} from '@data/models/CatalogFood'
import {fetchCatalogSuggestions} from '@queries/api/catalog/fetchCatalogSuggestions'
import {UndefinedInitialDataOptions} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const CATALOG_SUGGESTION_KIND: CatalogSuggestionKind = 'dislike'

export const CATALOG_SUGGESTION_LIMIT = 12

// The default limit is resolved here rather than inside fetchCatalogSuggestions so that the same number
// reaches the cache key and the request: a default at the request boundary would let an omitted limit and
// the limit actually sent mint two identities for one list (AAP 0.5.2 default 12, maximum 30).
export const buildCatalogSuggestionsQueryOptions = (
  limit: number = CATALOG_SUGGESTION_LIMIT
): UndefinedInitialDataOptions<CatalogFoodSuggestion[]> => ({
  queryKey: queryKeys.catalogSuggestions(CATALOG_SUGGESTION_KIND, limit),
  queryFn: () => fetchCatalogSuggestions(CATALOG_SUGGESTION_KIND, limit)
})
