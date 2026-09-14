import {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import {fetchCatalogSuggestions} from '@queries/api/catalog/fetchCatalogSuggestions'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useCatalogSuggestionsQuery = (limit?: number): UseQueryResult<CatalogFoodSuggestion[], DefaultError> =>
  useQuery({
    queryKey: queryKeys.catalogSuggestions,
    queryFn: () => fetchCatalogSuggestions('dislike', limit)
  })
