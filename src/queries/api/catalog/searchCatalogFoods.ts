import {CatalogFoodSearchResult} from '@data/models/CatalogFood'
import {convertCatalogFood} from '@queries/api/catalog/converter/convertCatalogFood'
import {CatalogSearchResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function searchCatalogFoods(
  query: string,
  page: number,
  limit: number = 25
): Promise<CatalogFoodSearchResult> {
  try {
    const response = await httpGet(Endpoints.CatalogFoodSearch(query, page, limit), CatalogSearchResponse)

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
