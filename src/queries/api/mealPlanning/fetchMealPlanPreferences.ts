import {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {convertPreferences} from '@queries/api/mealPlanning/converter/convertPreferences'
import {PreferencesResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchMealPlanPreferences(): Promise<MealPlanPreferences> {
  try {
    const response = await httpGet(Endpoints.MealPlanPreferences, PreferencesResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching meal plan preferences: status=${response?.status}`)
    }

    return convertPreferences(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
