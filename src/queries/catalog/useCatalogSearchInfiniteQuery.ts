import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {DefaultError, InfiniteData, useInfiniteQuery, UseInfiniteQueryResult} from '@tanstack/react-query'

import {buildCatalogSearchQueryOptions} from './useCatalogSearchInfiniteQuery.util'

export const useCatalogSearchInfiniteQuery = (
  query: string
): UseInfiniteQueryResult<InfiniteData<CatalogFoodSearchResult, number>, DefaultError> =>
  useInfiniteQuery(buildCatalogSearchQueryOptions(query))
