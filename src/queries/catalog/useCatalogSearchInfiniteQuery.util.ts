import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {DefaultError, InfiniteData, UndefinedInitialDataInfiniteOptions} from '@tanstack/react-query'
import {isCatalogQuerySearchable} from '@utility/CatalogSearchStateUtility'

import {queryKeys} from '../keys'

export const CATALOG_SEARCH_STALE_TIME_MS = 5 * 60_000

export const CATALOG_SEARCH_GC_TIME_MS = 5 * 60_000

type CatalogSearchQueryKey = ReturnType<typeof queryKeys.catalogSearch>

// Both cache times are declared here rather than inherited, because the app-wide defaults in
// `src/queries/queryClient.ts` — 60-second staleTime, 24-hour gcTime — are wrong for this query in opposite
// directions. The catalog is a versioned static release an operator loads and only then enables (AAP 0.7.5),
// so the answer to one term cannot change under a user mid-session; five minutes of freshness means the
// ordinary round trip of tapping a result and coming back re-requests nothing, which matters more here than
// for a single-page query because TanStack Query refetches *every* retained page when a stale infinite query
// remounts. Five minutes of gcTime is the other half, and it is the whole of what bounds retention: each
// distinct term is its own cache entry, and a typing session mints one per debounced keystroke that clears
// the minimum length, so an abandoned term is evicted minutes after the user leaves it instead of being held
// for a day.
//
// No page window is declared, deliberately. TanStack's `maxPages` drops pages from the far end of the
// window, and both consumers page strictly forward with `fetchNextPage` (`src/screens/AddFood/index.tsx`,
// `src/screens/MealPlanFoodSearch/index.tsx`) — so a cap of N would delete the first page from a rendered
// list on the fetch that exceeded it, and neither list calls `fetchPreviousPage` to bring it back. Every
// page a term has fetched therefore stays reachable for as long as the term itself is resident.
export const buildCatalogSearchQueryOptions = (
  query: string
): UndefinedInitialDataInfiniteOptions<
  CatalogFoodSearchResult,
  DefaultError,
  InfiniteData<CatalogFoodSearchResult, number>,
  CatalogSearchQueryKey,
  number
> => ({
  queryKey: queryKeys.catalogSearch(query),
  queryFn: ({pageParam}) => searchCatalogFoods(query, pageParam),
  // The shared catalog rule decides the request and the surface state from one module, so a term this query
  // would issue and the server would then refuse with `400 invalid_request` cannot exist
  // (@utility/CatalogSearchStateUtility).
  enabled: isCatalogQuerySearchable(query),
  initialPageParam: 1,
  getNextPageParam: (lastPage, _pages, lastPageParam) =>
    lastPageParam < lastPage.pagination.totalPages ? lastPageParam + 1 : undefined,
  staleTime: CATALOG_SEARCH_STALE_TIME_MS,
  gcTime: CATALOG_SEARCH_GC_TIME_MS
})
