import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {DefaultError, InfiniteData, UndefinedInitialDataInfiniteOptions} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// The server rejects a shorter term, so below this length the query is disabled rather than requested.
export const CATALOG_SEARCH_MIN_QUERY_LENGTH = 2

export const CATALOG_SEARCH_STALE_TIME_MS = 5 * 60_000

export const CATALOG_SEARCH_GC_TIME_MS = 5 * 60_000

// The ceiling on pages held for one term: 5 × the server's 25-row page is 125 results, far more of one
// search than either screen's flow needs, and it is what makes retention bounded rather than merely
// short-lived — gcTime evicts a term once it goes idle, this bounds the term that stays active.
export const CATALOG_SEARCH_MAX_PAGES = 5

type CatalogSearchQueryKey = ReturnType<typeof queryKeys.catalogSearch>

// Both cache times are declared here rather than inherited, because the app-wide defaults in
// `src/queries/queryClient.ts` — 60-second staleTime, 24-hour gcTime — are wrong for this query in opposite
// directions. The catalog is a versioned static release an operator loads and only then enables (AAP 0.7.5),
// so the answer to one term cannot change under a user mid-session; five minutes of freshness means the
// ordinary round trip of tapping a result and coming back re-requests nothing, which matters more here than
// for a single-page query because TanStack Query refetches *every* retained page when a stale infinite query
// remounts. Five minutes of gcTime is the other half: each distinct term is its own cache entry, and a typing
// session mints one per debounced keystroke that clears the minimum length, so an abandoned term is evicted
// minutes after the user leaves it instead of being held for a day.
//
// maxPages is the other half, and it is paired with getPreviousPageParam on purpose. A page cap drops pages
// from the far end of the window, and both consumers page strictly forward with `fetchNextPage`
// (`src/screens/AddFood/index.tsx`, `src/screens/MealPlanFoodSearch/index.tsx`), so without a backward page
// param a dropped leading page would be rows deleted from a rendered list with no way to fetch them back.
// Declaring it makes the window recoverable: `hasPreviousPage` stays false while the first page is resident
// (page 1 has no predecessor) and becomes true only once the cap has actually dropped one, which is the point
// at which a screen can call `fetchPreviousPage`. Neither screen wires that today, which is why the cap sits
// at 125 rows of a single term rather than at the handful the flow really uses.
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
  enabled: query.trim().length >= CATALOG_SEARCH_MIN_QUERY_LENGTH,
  initialPageParam: 1,
  getNextPageParam: (lastPage, _pages, lastPageParam) =>
    lastPageParam < lastPage.pagination.totalPages ? lastPageParam + 1 : undefined,
  getPreviousPageParam: (_firstPage, _pages, firstPageParam) => (firstPageParam > 1 ? firstPageParam - 1 : undefined),
  maxPages: CATALOG_SEARCH_MAX_PAGES,
  staleTime: CATALOG_SEARCH_STALE_TIME_MS,
  gcTime: CATALOG_SEARCH_GC_TIME_MS
})
