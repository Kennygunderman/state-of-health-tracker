import type {CatalogFood, CatalogFoodSearchResult} from '@data/models/CatalogFood'

import {
  CATALOG_QUERY_MIN_LENGTH,
  catalogResultsTotal,
  EMPTY_SEARCH_QUERY,
  flattenCatalogPages,
  isCatalogQuerySearchable,
  resolveSearchResultsView,
  SEARCH_SKELETON_ROWS,
  SearchGesture,
  searchQueryAfter,
  SearchQueryState,
  skeletonBarWidth
} from '../index.util'

const makeFood = (overrides: Partial<CatalogFood> = {}): CatalogFood => ({
  id: 'food-1',
  name: 'Mushrooms, white',
  category: 'produce_vegetable',
  foodState: 'raw',
  identitySource: 'usda',
  nutritionProvenance: 'source_backed',
  nutritionBasis: 'per_100g',
  basisAmount: 100,
  calories: 22,
  protein: 3.1,
  carbs: 3.3,
  fat: 0.3,
  fiber: 1,
  defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 96},
  allergenTags: [],
  allergenStatus: 'known',
  foodGroup: 'mushroom',
  ...overrides
})

const makePage = (items: CatalogFood[], total: number, page = 1): CatalogFoodSearchResult => ({
  items,
  pagination: {page, limit: 25, total, totalPages: Math.max(1, Math.ceil(total / 25))}
})

const typing = (text: string): SearchQueryState => ({text, query: text})

describe('searchQueryAfter', () => {
  it('shows a keystroke at once and holds the request back until the debounce elapses', () => {
    const typed = searchQueryAfter(EMPTY_SEARCH_QUERY, {kind: 'typed', text: 'mush'})

    expect(typed).toEqual({text: 'mush', query: ''})
    expect(searchQueryAfter(typed, {kind: 'debounce_elapsed'})).toEqual({text: 'mush', query: 'mush'})
  })

  it('reports no change when a keystroke leaves the text as it was', () => {
    const state = typing('mush')

    expect(searchQueryAfter(state, {kind: 'typed', text: 'mush'})).toBe(state)
  })

  it('reports no change when the debounce elapses with the request already made', () => {
    const state = typing('mush')

    expect(searchQueryAfter(state, {kind: 'debounce_elapsed'})).toBe(state)
  })

  it('empties both the field and the request when the query is cleared', () => {
    expect(searchQueryAfter(typing('mush'), {kind: 'query_cleared'})).toEqual({text: '', query: ''})
  })

  it('reports no change when there is nothing to clear', () => {
    expect(searchQueryAfter(EMPTY_SEARCH_QUERY, {kind: 'query_cleared'})).toBe(EMPTY_SEARCH_QUERY)
  })

  // Adding a food, taking one out and Clear all are answers to the query rather than changes to it: Figma
  // note 47:463 requires the query and its results to survive every one of them, so a food added by mistake
  // is one tap from being removed without searching again.
  describe('a gesture that changes only the staged selection', () => {
    const SELECTION_GESTURES: readonly SearchGesture[] = [
      {kind: 'food_pressed'},
      {kind: 'chip_removed'},
      {kind: 'clear_all_pressed'}
    ]

    it.each(SELECTION_GESTURES)('leaves the query exactly as it is (%o)', gesture => {
      const state = typing('mush')

      expect(searchQueryAfter(state, gesture)).toBe(state)
    })
  })

  describe('a gesture that leaves the screen', () => {
    const EXIT_GESTURES: readonly SearchGesture[] = [{kind: 'cancel_pressed'}, {kind: 'done_pressed'}]

    it.each(EXIT_GESTURES)('leaves the query exactly as it is (%o)', gesture => {
      const state = typing('mush')

      expect(searchQueryAfter(state, gesture)).toBe(state)
    })
  })
})

describe('isCatalogQuerySearchable', () => {
  it('refuses a query the server would reject, so no request is sent below the minimum', () => {
    expect(isCatalogQuerySearchable({text: 'm', query: 'm'})).toBe(false)
    expect(CATALOG_QUERY_MIN_LENGTH).toBe(2)
  })

  it('refuses whitespace standing in for a query', () => {
    expect(isCatalogQuerySearchable({text: '   ', query: '   '})).toBe(false)
  })

  it('accepts a query at the minimum length', () => {
    expect(isCatalogQuerySearchable(typing('mu'))).toBe(true)
  })

  it('reads the request rather than the field, so a keystroke does not search before the debounce', () => {
    expect(isCatalogQuerySearchable({text: 'mush', query: ''})).toBe(false)
  })
})

describe('resolveSearchResultsView', () => {
  const RESULTS = {isSearchable: true, isError: false, isPending: false, resultCount: 4}

  it('shows nothing at all until the query is long enough to search', () => {
    expect(resolveSearchResultsView({...RESULTS, isSearchable: false, isPending: true, resultCount: 0})).toBe('idle')
  })

  it('reports a failed search rather than an empty one', () => {
    expect(resolveSearchResultsView({...RESULTS, isError: true, resultCount: 0})).toBe('error')
  })

  it('reports a search in flight rather than an empty one', () => {
    expect(resolveSearchResultsView({...RESULTS, isPending: true, resultCount: 0})).toBe('loading')
  })

  it('reports no results only once a search has answered with none', () => {
    expect(resolveSearchResultsView({...RESULTS, resultCount: 0})).toBe('no_results')
  })

  it('reports results when the search returned some', () => {
    expect(resolveSearchResultsView(RESULTS)).toBe('results')
  })
})

describe('SEARCH_SKELETON_ROWS', () => {
  it('describes three rows as proportions of the column they are measured against', () => {
    expect(SEARCH_SKELETON_ROWS).toHaveLength(3)

    SEARCH_SKELETON_ROWS.forEach(row => {
      expect(row.primary).toBeGreaterThan(0)
      expect(row.primary).toBeLessThanOrEqual(1)
      expect(row.secondary).toBeGreaterThan(0)
      expect(row.secondary).toBeLessThan(row.primary)
    })
  })

  it('cannot be rewritten by a screen that renders it', () => {
    expect(Object.isFrozen(SEARCH_SKELETON_ROWS)).toBe(true)
    expect(Object.isFrozen(SEARCH_SKELETON_ROWS[0])).toBe(true)
  })
})

describe('flattenCatalogPages', () => {
  it('reads every loaded page in the order it arrived', () => {
    const pages = [makePage([makeFood({id: 'a'}), makeFood({id: 'b'})], 3), makePage([makeFood({id: 'c'})], 3, 2)]

    expect(flattenCatalogPages(pages).map(food => food.id)).toEqual(['a', 'b', 'c'])
  })

  it('reads nothing before the first page arrives', () => {
    expect(flattenCatalogPages(undefined)).toEqual([])
  })

  it('reads nothing from a page that matched no food', () => {
    expect(flattenCatalogPages([makePage([], 0)])).toEqual([])
  })
})

describe('catalogResultsTotal', () => {
  it('announces what the search found rather than what has been loaded', () => {
    expect(catalogResultsTotal([makePage([makeFood()], 137)], 1)).toBe(137)
  })

  it('keeps announcing the total the search reported, even if a later page disagrees', () => {
    const pages = [makePage([makeFood({id: 'a'})], 137), makePage([makeFood({id: 'b'})], 136, 2)]

    expect(catalogResultsTotal(pages, 2)).toBe(137)
  })

  it('falls back to what is loaded when no page has arrived', () => {
    expect(catalogResultsTotal(undefined, 0)).toBe(0)
    expect(catalogResultsTotal([], 4)).toBe(4)
  })

  it('announces no results for a search that matched none', () => {
    expect(catalogResultsTotal([makePage([], 0)], 0)).toBe(0)
  })
})

describe('skeletonBarWidth', () => {
  it('measures a bar against the column it sits in', () => {
    expect(skeletonBarWidth(281, 0.69)).toBe(194)
  })

  it('measures nothing before the column has been laid out', () => {
    expect(skeletonBarWidth(0, 0.69)).toBe(0)
  })

  it('never measures a negative width', () => {
    expect(skeletonBarWidth(-10, 0.69)).toBe(0)
  })

  it('returns whole pixels', () => {
    expect(Number.isInteger(skeletonBarWidth(281, 0.46))).toBe(true)
  })
})
