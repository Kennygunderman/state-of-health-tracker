import {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {buildCatalogSuggestionsQueryOptions} from './useCatalogSuggestionsQuery.util'

export const useCatalogSuggestionsQuery = (limit?: number): UseQueryResult<CatalogFoodSuggestion[], DefaultError> =>
  useQuery(buildCatalogSuggestionsQueryOptions(limit))
