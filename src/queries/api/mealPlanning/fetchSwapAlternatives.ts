import {SwapAlternatives} from '@data/models/SwapAlternative'
import {convertSwapAlternatives} from '@queries/api/mealPlanning/converter/convertSwapAlternatives'
import {SwapAlternativesResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchSwapAlternatives(planId: string, mealId: string): Promise<SwapAlternatives> {
  try {
    const response = await httpGet(Endpoints.MealPlanSwapAlternatives(planId, mealId), SwapAlternativesResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching swap alternatives: status=${response?.status}`)
    }

    return convertSwapAlternatives(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
