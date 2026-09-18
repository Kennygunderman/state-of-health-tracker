import type {CatalogFood, CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {
  CATALOG_SEARCH_MIN_QUERY_LENGTH,
  isCatalogQuerySearchable as isCatalogQueryTextSearchable,
  resolveCatalogSearchState
} from '@utility/CatalogSearchStateUtility'

// What the search field holds. `text` is what the user sees; `query` is what the request is made with, and
// trails it by the debounce interval.
export interface SearchQueryState {
  text: string
  query: string
}

// Every gesture the screen reports, including the ones that touch the staged selection rather than the
// query. They are listed here so that "staging a food leaves the search alone" is a rule this module
// decides, rather than an accident of which handler happens to call setState.
export type SearchGesture =
  | {kind: 'typed'; text: string}
  | {kind: 'debounce_elapsed'}
  | {kind: 'query_cleared'}
  | {kind: 'food_pressed'}
  | {kind: 'chip_removed'}
  | {kind: 'clear_all_pressed'}
  | {kind: 'cancel_pressed'}
  | {kind: 'done_pressed'}

export const EMPTY_SEARCH_QUERY: SearchQueryState = Object.freeze({text: '', query: ''})

// The server rejects a shorter query and useCatalogSearchInfiniteQuery is disabled below it, which leaves
// that query permanently pending — so this bound decides the first branch of the results view, not a request.
// The one bound, from the shared catalog rule: `useCatalogSearchInfiniteQuery` is disabled below it and the
// server rejects it, so it decides a branch of the verdict rather than a request.
export const CATALOG_QUERY_MIN_LENGTH = CATALOG_SEARCH_MIN_QUERY_LENGTH

export const searchQueryAfter = (state: SearchQueryState, gesture: SearchGesture): SearchQueryState => {
  switch (gesture.kind) {
    case 'typed':
      return gesture.text === state.text ? state : {text: gesture.text, query: state.query}
    case 'debounce_elapsed':
      return state.text === state.query ? state : {text: state.text, query: state.text}
    case 'query_cleared':
      return state.text.length === 0 && state.query.length === 0 ? state : EMPTY_SEARCH_QUERY
    // Adding a food, removing one, Clear all and both ways out of the screen answer the query rather than
    // change it: the text and the results it produced stay exactly as they are, so a selection made from a
    // search can be continued or undone without searching again (Figma note 47:463).
    default:
      return state
  }
}

export const isCatalogQuerySearchable = (state: SearchQueryState): boolean => isCatalogQueryTextSearchable(state.query)

export type SearchResultsView = 'idle' | 'error' | 'loading' | 'no_results' | 'results'

export interface SearchResultsInput {
  isSearchable: boolean
  isError: boolean
  isPending: boolean
  resultCount: number
}

// One order for the four states the results area can be in, so a query below the minimum reads as "nothing
// asked for yet" rather than as the no-results line for a search that was never sent.
export const resolveSearchResultsView = ({
  isSearchable,
  isError,
  isPending,
  resultCount
}: SearchResultsInput): SearchResultsView => {
  // The order is the shared catalog rule's, not a second spelling of it: rows outrank every request state, so
  // a failed background refetch or a stale refetch in flight leaves the results the user is reading on screen
  // instead of replacing them with the retry card or the no-results caption. This screen sits inside the
  // entitled wizard, so it is never hidden, and its rows are drawn by the list itself.
  switch (
    resolveCatalogSearchState({
      isVisible: true,
      isSearchable,
      rowCount: resultCount,
      isLoading: isPending,
      isError,
      isSuccess: !isPending && !isError
    })
  ) {
    case 'rows':
      return 'results'
    case 'loading':
      return 'loading'
    case 'error':
      return 'error'
    case 'empty':
      return 'no_results'
    case 'hidden':
    case 'idle':
      return 'idle'
  }
}

export interface SelectedFoodChip {
  id: string
  name: string
}

export interface SearchSkeletonRow {
  primary: number
  secondary: number
}

// The bars of 13c's own skeleton card `36:340` (193.68/129.12, 156.02/107.59, 177.54/139.88) as proportions of
// the 281px text column a row leaves beside its control. A swap-screen geometry is the source for a food-search
// screen because AAP 0.2.5 prescribes the catalog-search loading rows as Skeleton rows "as 13c".
export const SEARCH_SKELETON_ROWS: ReadonlyArray<SearchSkeletonRow> = Object.freeze([
  Object.freeze({primary: 0.69, secondary: 0.46}),
  Object.freeze({primary: 0.55, secondary: 0.38}),
  Object.freeze({primary: 0.63, secondary: 0.5})
])

export const flattenCatalogPages = (pages: readonly CatalogFoodSearchResult[] | undefined): CatalogFood[] =>
  pages === undefined ? [] : pages.flatMap(page => page.items)

// What the search found, not what has been scrolled into memory: the count is announced once and every page
// carries the same total, so the newest answer is the one to read.
export const catalogResultsTotal = (
  pages: readonly CatalogFoodSearchResult[] | undefined,
  loadedCount: number
): number => {
  if (pages === undefined || pages.length === 0) {
    return loadedCount
  }

  // The first page's total is the size of the result set this query announced, and it stays put as later
  // pages load. Reading the newest page instead would move the announced figure under a screen reader
  // whenever the catalog changed mid-scroll.
  return pages[0].pagination.total
}

export const skeletonBarWidth = (areaWidth: number, widthProportion: number): number =>
  areaWidth > 0 ? Math.round(areaWidth * widthProportion) : 0
