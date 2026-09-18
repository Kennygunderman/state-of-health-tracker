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

/**
 * The longest query the catalog answers, and the bound both search fields cap their input at
 * (`CatalogSearchField`, and Add Food's `SearchBar` through `ADD_FOOD_SEARCH_MAX_QUERY_LENGTH`).
 */
export const CATALOG_SEARCH_MAX_QUERY_LENGTH = 60

const LAST_C0_CHARACTER_CODE = 0x1f
const DELETE_CHARACTER_CODE = 0x7f

// The C0 range plus DEL: the class the server's `q` parser refuses outright, because a null byte cannot be
// bound as a PostgreSQL text parameter at all and the rest only search for text no user typed
// (`backend/src/services/catalog.logic.ts`). Tested by code point rather than with the character class that
// states the same range, because a regular expression literal spelling C0 trips `no-control-regex`.
const hasControlCharacter = (query: string): boolean => {
  for (let index = 0; index < query.length; index += 1) {
    const code = query.charCodeAt(index)

    if (code <= LAST_C0_CHARACTER_CODE || code === DELETE_CHARACTER_CODE) {
      return true
    }
  }

  return false
}

/**
 * Whether the catalog will answer this query at all.
 *
 * The three conditions mirror the server's own `q` parser
 * (`backend/src/services/catalog.logic.ts::parseCatalogSearchQuery`, AAP 0.5.2): the TRIMMED query is 2 to
 * {@link CATALOG_SEARCH_MAX_QUERY_LENGTH} characters and carries no control character. Each refusal there is
 * a `400 invalid_request` that `searchCatalogFoods` records as a crash and rethrows, so a query the server is
 * certain to refuse has to leave the query hook disabled rather than reach the api function — which is the
 * same reason the predicate also decides the surface state below.
 */
export const isCatalogQuerySearchable = (query: string): boolean => {
  const trimmed = query.trim()

  return (
    trimmed.length >= CATALOG_SEARCH_MIN_QUERY_LENGTH &&
    trimmed.length <= CATALOG_SEARCH_MAX_QUERY_LENGTH &&
    !hasControlCharacter(trimmed)
  )
}

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
 * 2. Not searchable — outside the bounds {@link isCatalogQuerySearchable} states the query hook is disabled,
 *    so no request was issued and there is nothing to report.
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
