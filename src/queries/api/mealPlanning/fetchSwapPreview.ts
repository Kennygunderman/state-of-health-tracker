import {SwapPreview} from '@data/models/SwapAlternative'
import {convertSwapPreview} from '@queries/api/mealPlanning/converter/convertSwapAlternatives'
import {SwapPreviewResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchSwapPreview(planId: string, mealId: string, recipeVersionId: string): Promise<SwapPreview> {
  try {
    const response = await httpGet(Endpoints.MealPlanSwapPreview(planId, mealId, recipeVersionId), SwapPreviewResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching swap preview: status=${response?.status}`)
    }

    return convertSwapPreview(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
