import {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import {CatalogSuggestionsResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchCatalogSuggestions(kind: 'dislike', limit: number = 12): Promise<CatalogFoodSuggestion[]> {
  try {
    const response = await httpGet(Endpoints.CatalogFoodSuggestions(kind, limit), CatalogSuggestionsResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching catalog suggestions: status=${response?.status}`)
    }

    return response.data.items.map(item => ({id: item.id, name: item.name, foodGroup: item.foodGroup}))
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
