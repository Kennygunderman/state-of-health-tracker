import {ToggleGroceryItemPayload, ToggleGroceryItemResult} from '@data/models/GroceryList'
import {convertGroceryItem} from '@queries/api/mealPlanning/converter/convertGroceryList'
import {GroceryToggleResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function toggleGroceryItem(
  planId: string,
  itemId: string,
  payload: ToggleGroceryItemPayload
): Promise<ToggleGroceryItemResult> {
  try {
    const response = await httpPut(Endpoints.MealPlanGroceryItem(planId, itemId), GroceryToggleResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response toggling grocery item: status=${response?.status}`)
    }

    return {item: convertGroceryItem(response.data.item), checkedCount: response.data.checkedCount}
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
