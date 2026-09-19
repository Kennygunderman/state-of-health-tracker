import {CatalogSearchResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import {searchCatalogFoods} from '@queries/api/catalog/searchCatalogFoods'
import {httpGet} from '@service/http/httpUtil'
import {CATALOG_SEARCH_MAX_QUERY_LENGTH} from '@utility/CatalogSearchStateUtility'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

jest.mock('@service/http/httpUtil', () => ({
  httpGet: jest.fn()
}))

// The api function reports its failures through CrashUtility, which reaches the Crashlytics native module on
// the way in — absent under Jest — so the utility is faked here rather than loaded.
jest.mock('@utility/CrashUtility', () => ({
  __esModule: true,
  default: {recordError: jest.fn()}
}))

const mockHttpGet = jest.mocked(httpGet)
const mockRecordError = jest.mocked(CrashUtility.recordError)

type WireFood = io.TypeOf<typeof CatalogSearchResponse>['items'][number]

const WIRE_FOOD: WireFood = {
  id: 'catalog-food-1',
  name: 'Greek yogurt, plain, nonfat',
  category: 'dairy_yogurt',
  foodState: 'as_purchased',
  identitySource: 'usda',
  nutritionProvenance: 'source_backed',
  nutritionBasis: 'per_100g',
  basisAmount: 100,
  calories: 59,
  protein: 10.2,
  carbs: 3.6,
  fat: 0.4,
  fiber: 0,
  defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 245},
  allergenTags: ['milk'],
  allergenStatus: 'known',
  foodGroup: 'dairy'
}

const PAGINATION = {page: 1, limit: 25, total: 1, totalPages: 1}

const resolveWith = (status: number, data: unknown): void => {
  mockHttpGet.mockResolvedValue({status, data} as never)
}

const requestedUrl = (): URL => new URL(mockHttpGet.mock.calls[0][0])

const requestedQuery = (): string | null => requestedUrl().searchParams.get('q')

beforeEach(() => {
  jest.resetAllMocks()
})

describe('searchCatalogFoods', () => {
  describe('the query it asks the catalog for', () => {
    it('cuts an over-long query to the bound the server enforces', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('c'.repeat(150), 1, 25)

      expect(requestedQuery()).toHaveLength(CATALOG_SEARCH_MAX_QUERY_LENGTH)
      expect(requestedQuery()).toBe('c'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH))
    })

    it('trims before cutting, so padding cannot consume the bound', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods(`   ${'b'.repeat(70)}   `, 1, 25)

      expect(requestedQuery()).toBe('b'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH))
    })

    it('trims a query already inside the bound without shortening it further', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('  greek yogurt  ', 1, 25)

      expect(requestedQuery()).toBe('greek yogurt')
    })

    it('leaves a query inside the bound exactly as it was given', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('greek yogurt', 1, 25)

      expect(requestedQuery()).toBe('greek yogurt')
    })

    it('keeps a query of exactly the bound intact', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('a'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH), 1, 25)

      expect(requestedQuery()).toBe('a'.repeat(CATALOG_SEARCH_MAX_QUERY_LENGTH))
    })
  })

  describe('the rest of the request', () => {
    it('passes the page and limit through untouched', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('greek yogurt', 3, 10)

      expect(requestedUrl().searchParams.get('page')).toBe('3')
      expect(requestedUrl().searchParams.get('limit')).toBe('10')
    })

    it('defaults the limit to a full page when the caller states none', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('greek yogurt', 2)

      expect(requestedUrl().searchParams.get('page')).toBe('2')
      expect(requestedUrl().searchParams.get('limit')).toBe('25')
    })

    it('validates the response with the catalog search codec', async () => {
      resolveWith(200, {items: [], pagination: PAGINATION})

      await searchCatalogFoods('greek yogurt', 1, 25)

      expect(mockHttpGet.mock.calls[0][1]).toBe(CatalogSearchResponse)
    })
  })

  describe('a successful response', () => {
    it('returns the mapped rows and the pagination block', async () => {
      resolveWith(200, {items: [WIRE_FOOD], pagination: PAGINATION})

      const result = await searchCatalogFoods('greek yogurt', 1, 25)

      expect(result.pagination).toEqual(PAGINATION)
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        id: 'catalog-food-1',
        name: 'Greek yogurt, plain, nonfat',
        nutritionProvenance: 'source_backed',
        defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 245}
      })
      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe('a response the endpoint should never return', () => {
    it('reports and rejects a non-200 status', async () => {
      resolveWith(204, {items: [], pagination: PAGINATION})

      await expect(searchCatalogFoods('greek yogurt', 1, 25)).rejects.toThrow(
        'Unexpected response searching catalog foods: status=204'
      )
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('reports and rejects a 200 that carries no body', async () => {
      resolveWith(200, null)

      await expect(searchCatalogFoods('greek yogurt', 1, 25)).rejects.toThrow(
        'Unexpected response searching catalog foods: status=200'
      )
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })
  })

  describe('a request the transport rejects', () => {
    it('reports the failure and rethrows the error it was given', async () => {
      const transportError = new Error('Network request failed')

      mockHttpGet.mockRejectedValue(transportError)

      await expect(searchCatalogFoods('greek yogurt', 1, 25)).rejects.toBe(transportError)
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(transportError)
    })
  })
})
