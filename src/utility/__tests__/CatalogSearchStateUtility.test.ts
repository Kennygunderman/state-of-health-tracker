import {
  CATALOG_SEARCH_MIN_QUERY_LENGTH,
  CatalogSearchStateInput,
  isCatalogQuerySearchable,
  resolveCatalogSearchState
} from '../CatalogSearchStateUtility'

// A visible, searchable surface whose query has answered nothing yet — every case below states only the
// members it is about, so the precedence being asserted is the only thing that varies.
const makeInput = (overrides: Partial<CatalogSearchStateInput> = {}): CatalogSearchStateInput => ({
  isVisible: true,
  isSearchable: true,
  rowCount: 0,
  isLoading: false,
  isError: false,
  isSuccess: false,
  ...overrides
})

describe('CATALOG_SEARCH_MIN_QUERY_LENGTH', () => {
  it('is the two characters the catalog query hook enables itself on', () => {
    expect(CATALOG_SEARCH_MIN_QUERY_LENGTH).toBe(2)
  })
})

describe('isCatalogQuerySearchable', () => {
  it('rejects an empty query', () => {
    expect(isCatalogQuerySearchable('')).toBe(false)
  })

  it('rejects a single character', () => {
    expect(isCatalogQuerySearchable('a')).toBe(false)
  })

  it('accepts the minimum length exactly', () => {
    expect(isCatalogQuerySearchable('ab')).toBe(true)
  })

  it('rejects whitespace alone', () => {
    expect(isCatalogQuerySearchable('   ')).toBe(false)
  })

  it('rejects a single character padded with whitespace', () => {
    expect(isCatalogQuerySearchable('  a  ')).toBe(false)
  })

  it('accepts the minimum length padded with whitespace', () => {
    expect(isCatalogQuerySearchable('  ab  ')).toBe(true)
  })

  it('accepts a longer query', () => {
    expect(isCatalogQuerySearchable('brown rice')).toBe(true)
  })
})

describe('resolveCatalogSearchState', () => {
  describe('hidden', () => {
    it('hides an unentitled surface that has nothing to report', () => {
      expect(resolveCatalogSearchState(makeInput({isVisible: false}))).toBe('hidden')
    })

    it('hides an unentitled surface whatever every other input says', () => {
      expect(
        resolveCatalogSearchState({
          isVisible: false,
          isSearchable: true,
          rowCount: 12,
          isLoading: true,
          isError: true,
          isSuccess: true
        })
      ).toBe('hidden')
    })

    it('hides an unentitled surface holding rows', () => {
      expect(resolveCatalogSearchState(makeInput({isVisible: false, rowCount: 3, isSuccess: true}))).toBe('hidden')
    })

    it('hides an unentitled surface whose query failed', () => {
      expect(resolveCatalogSearchState(makeInput({isVisible: false, isError: true}))).toBe('hidden')
    })
  })

  describe('idle below the minimum query length', () => {
    it('reports nothing while the query is too short', () => {
      expect(resolveCatalogSearchState(makeInput({isSearchable: false}))).toBe('idle')
    })

    it('outranks rows left from a longer query', () => {
      expect(resolveCatalogSearchState(makeInput({isSearchable: false, rowCount: 4, isSuccess: true}))).toBe('idle')
    })

    it('outranks a loading query', () => {
      expect(resolveCatalogSearchState(makeInput({isSearchable: false, isLoading: true}))).toBe('idle')
    })

    it('outranks a failed query', () => {
      expect(resolveCatalogSearchState(makeInput({isSearchable: false, isError: true}))).toBe('idle')
    })

    it('outranks a decoded empty page', () => {
      expect(resolveCatalogSearchState(makeInput({isSearchable: false, isSuccess: true}))).toBe('idle')
    })
  })

  describe('rows outrank every request state', () => {
    it('reports rows for an answered page', () => {
      expect(resolveCatalogSearchState(makeInput({rowCount: 20, isSuccess: true}))).toBe('rows')
    })

    it('keeps the rows on screen while a stale refetch is in flight', () => {
      expect(resolveCatalogSearchState(makeInput({rowCount: 20, isLoading: true}))).toBe('rows')
    })

    it('keeps the rows on screen when a background refetch fails', () => {
      expect(resolveCatalogSearchState(makeInput({rowCount: 20, isError: true}))).toBe('rows')
    })

    it('never pairs rows with the no-results caption', () => {
      expect(resolveCatalogSearchState(makeInput({rowCount: 1, isSuccess: true, isError: true}))).toBe('rows')
    })

    it('reports rows from a single result', () => {
      expect(resolveCatalogSearchState(makeInput({rowCount: 1, isSuccess: true}))).toBe('rows')
    })
  })

  describe('loading', () => {
    it('reports the first load of a searchable query', () => {
      expect(resolveCatalogSearchState(makeInput({isLoading: true}))).toBe('loading')
    })

    it('outranks an error', () => {
      expect(resolveCatalogSearchState(makeInput({isLoading: true, isError: true}))).toBe('loading')
    })

    it('outranks a decoded empty page', () => {
      expect(resolveCatalogSearchState(makeInput({isLoading: true, isSuccess: true}))).toBe('loading')
    })
  })

  describe('error', () => {
    it('reports a retryable failure with no rows to show instead', () => {
      expect(resolveCatalogSearchState(makeInput({isError: true}))).toBe('error')
    })

    it('outranks the no-results caption, which only a decoded page may reach', () => {
      expect(resolveCatalogSearchState(makeInput({isError: true, isSuccess: true}))).toBe('error')
    })
  })

  describe('empty', () => {
    it('reports no results only for a decoded empty page', () => {
      expect(resolveCatalogSearchState(makeInput({isSuccess: true}))).toBe('empty')
    })
  })

  describe('idle fallthrough', () => {
    it('says nothing about a query that has neither loaded, failed nor answered', () => {
      expect(resolveCatalogSearchState(makeInput())).toBe('idle')
    })
  })
})
