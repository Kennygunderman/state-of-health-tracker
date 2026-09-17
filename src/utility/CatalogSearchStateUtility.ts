/**
 * What a catalog search surface should be showing, as one verdict.
 *
 * WHY THIS IS ITS OWN UTILITY. Two screens search the catalog — Add Food's third section and the wizard's
 * 06b food search — and both have to answer the same question in the same order. Neither may import the
 * other's `index.util.ts` (Rule mobile-component-structure), and a second spelling of the order is how a
 * failed background refetch wipes the rows on one surface and not the other, so the rule lives here with its
 * test (the same promotion AAP 0.3.3 made for `ServingsUtility`).
 */
export type CatalogSearchState = 'hidden' | 'idle' | 'rows' | 'loading' | 'error' | 'empty'

/**
 * The shortest query the catalog answers. `useCatalogSearchInfiniteQuery` is disabled below it and the server
 * rejects it, so this bound decides a branch of the verdict below rather than a request.
 */
export const CATALOG_SEARCH_MIN_QUERY_LENGTH = 2

export const isCatalogQuerySearchable = (query: string): boolean =>
  query.trim().length >= CATALOG_SEARCH_MIN_QUERY_LENGTH

export interface CatalogSearchStateInput {
  isVisible: boolean
  isSearchable: boolean
  rowCount: number
  /**
   * A first load is in flight: TanStack's `isLoading`, or `isPending` on a screen that destructures only that
   * — past the `isSearchable` gate the two agree, because a disabled query reports `isPending` without ever
   * fetching.
   */
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
}

/**
 * The one precedence rule both catalog search surfaces follow.
 *
 * The order is the whole of it:
 *
 * 1. Not visible — the entitlement gate (Remote Config off, or a backend whose meal-planning routes are
 *    gone). Nothing is rendered and nothing was requested.
 * 2. Not searchable — below {@link CATALOG_SEARCH_MIN_QUERY_LENGTH} the query hook is disabled, so no request
 *    was issued and there is nothing to report.
 * 3. Rows before every request state. This is the load-bearing step: a failed background refetch and a stale
 *    refetch in flight both keep the rows the user is reading on screen instead of replacing them with an
 *    error or a no-results caption. TanStack reports `isError` on a refetch failure while retaining the data,
 *    which is precisely the case this ordering answers.
 * 4. A first load in flight.
 * 5. An error, which only reaches the user when there are no rows to show instead.
 * 6. A DECODED empty page — the only thing that is "no results". An error must never reach that caption.
 * 7. Anything else is idle: a query that is neither loading, failed nor answered has nothing to say (a paused
 *    offline fetch is the reachable case).
 */
export const resolveCatalogSearchState = ({
  isVisible,
  isSearchable,
  rowCount,
  isLoading,
  isError,
  isSuccess
}: CatalogSearchStateInput): CatalogSearchState => {
  if (!isVisible) {
    return 'hidden'
  }

  if (!isSearchable) {
    return 'idle'
  }

  if (rowCount > 0) {
    return 'rows'
  }

  if (isLoading) {
    return 'loading'
  }

  if (isError) {
    return 'error'
  }

  return isSuccess ? 'empty' : 'idle'
}
