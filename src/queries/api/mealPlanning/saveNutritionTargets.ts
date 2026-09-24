import {SaveNutritionTargetsPayload, SaveNutritionTargetsResult} from '@data/models/NutritionTargets'
import {convertNutritionTargetsSaveResult} from '@queries/api/mealPlanning/converter/convertNutritionTargets'
import {TargetsSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function saveNutritionTargets(payload: SaveNutritionTargetsPayload): Promise<SaveNutritionTargetsResult> {
  try {
    const response = await httpPut(Endpoints.MealPlanTargets, TargetsSaveResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response saving nutrition targets: status=${response?.status}`)
    }

    return convertNutritionTargetsSaveResult(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
