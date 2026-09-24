import {CatalogFoodSuggestion, CatalogSuggestionKind} from '@data/models/CatalogFood'
import {fetchCatalogSuggestions} from '@queries/api/catalog/fetchCatalogSuggestions'
import {UndefinedInitialDataOptions} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const CATALOG_SUGGESTION_KIND: CatalogSuggestionKind = 'dislike'

export const CATALOG_SUGGESTION_LIMIT = 12

// There is exactly one suggestions list, so its key is static and the kind and limit are fixed here rather
// than caller-settable: a caller-settable limit would mint two cache identities for that one list.
export const buildCatalogSuggestionsQueryOptions = (): UndefinedInitialDataOptions<CatalogFoodSuggestion[]> => ({
  queryKey: queryKeys.catalogSuggestions,
  queryFn: () => fetchCatalogSuggestions(CATALOG_SUGGESTION_KIND, CATALOG_SUGGESTION_LIMIT)
})
