import {GroceryList} from '@data/models/GroceryList'
import {convertGroceryList} from '@queries/api/mealPlanning/converter/convertGroceryList'
import {GroceryListResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchGroceryList(planId: string): Promise<GroceryList> {
  try {
    const response = await httpGet(Endpoints.MealPlanGroceries(planId), GroceryListResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching grocery list: status=${response?.status}`)
    }

    return convertGroceryList(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
