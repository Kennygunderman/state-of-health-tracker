import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {convertCatalogFood} from '@queries/api/catalog/converter/convertCatalogFood'
import {CatalogSearchResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import {httpGet} from '@service/http/httpUtil'
import {CATALOG_SEARCH_MAX_QUERY_LENGTH} from '@utility/CatalogSearchStateUtility'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function searchCatalogFoods(
  query: string,
  page: number,
  limit: number = 25
): Promise<CatalogFoodSearchResult> {
  try {
    // The bound belongs to the request, not to the fields that feed it: Add Food's shared search bar and the
    // wizard's field both reach here, and the server measures the TRIMMED `q` against it before refusing an
    // over-long one with `400 invalid_request` — so trim first, then cut.
    const boundedQuery = query.trim().slice(0, CATALOG_SEARCH_MAX_QUERY_LENGTH)

    const response = await httpGet(Endpoints.CatalogFoodSearch(boundedQuery, page, limit), CatalogSearchResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response searching catalog foods: status=${response?.status}`)
    }

    return {
      items: response.data.items.map(convertCatalogFood),
      pagination: response.data.pagination
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
