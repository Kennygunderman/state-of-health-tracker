import {MealPlan} from '@data/models/MealPlan'
import {GeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {convertMealPlan} from '@queries/api/mealPlanning/converter/convertMealPlan'
import {MealPlanResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function generatePlan(payload: GeneratePlanPayload): Promise<MealPlan> {
  try {
    const response = await httpPost(Endpoints.MealPlans, MealPlanResponse, payload)

    if ((response?.status !== 201 && response?.status !== 200) || !response.data) {
      throw new Error(`Unexpected response generating meal plan: status=${response?.status}`)
    }

    return convertMealPlan(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
