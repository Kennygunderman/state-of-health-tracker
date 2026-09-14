import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {useInfiniteQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useCatalogSearchInfiniteQuery = (query: string) =>
  useInfiniteQuery({
    queryKey: queryKeys.catalogSearch(query),
    queryFn: ({pageParam}) => searchCatalogFoods(query, pageParam),
    enabled: query.trim().length >= 2,
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) =>
      lastPageParam < lastPage.pagination.totalPages ? lastPageParam + 1 : undefined
  })
