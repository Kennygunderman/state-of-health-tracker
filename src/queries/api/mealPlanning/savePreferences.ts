import {MealPlanPreferencesSaveResult, SaveMealPlanPreferencesPayload} from '@data/models/MealPlanPreferences'
import {convertPreferencesSaveResult} from '@queries/api/mealPlanning/converter/convertPreferences'
import {PreferencesSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function savePreferences(payload: SaveMealPlanPreferencesPayload): Promise<MealPlanPreferencesSaveResult> {
  try {
    const response = await httpPut(Endpoints.MealPlanPreferences, PreferencesSaveResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response saving meal plan preferences: status=${response?.status}`)
    }

    return convertPreferencesSaveResult(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
