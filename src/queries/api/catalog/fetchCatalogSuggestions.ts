import {CatalogFoodSuggestion, CatalogSuggestionKind} from '@data/models/CatalogFood'
import {CatalogSuggestionsResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

// Both inputs are required: a default here would be invisible to the cache key built by the query layer,
// which is how one key came to stand for several different lists.
export async function fetchCatalogSuggestions(
  kind: CatalogSuggestionKind,
  limit: number
): Promise<CatalogFoodSuggestion[]> {
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
