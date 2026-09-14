import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {DefaultError, InfiniteData, useInfiniteQuery, UseInfiniteQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useCatalogSearchInfiniteQuery = (
  query: string
): UseInfiniteQueryResult<InfiniteData<CatalogFoodSearchResult, number>, DefaultError> =>
  useInfiniteQuery({
    queryKey: queryKeys.catalogSearch(query),
    queryFn: ({pageParam}) => searchCatalogFoods(query, pageParam),
    enabled: query.trim().length >= 2,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPageParam < lastPage.pagination.totalPages ? lastPageParam + 1 : undefined
  })
