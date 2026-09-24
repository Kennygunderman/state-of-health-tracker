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

    // 201 is the only success, on the first commit and on every replay of the same key: the server stores the
    // create status with the response and returns it unchanged, so a replay is a 201 too. A 200 here would be
    // undocumented server drift worth failing on rather than mapping blind, and every non-2xx rejects in the
    // transport before this guard — so a confirmed failure and an unconfirmed outcome both stay rejections the
    // caller classifies.
    if (response?.status !== 201 || !response.data) {
      throw new Error(`Unexpected response generating meal plan: status=${response?.status}`)
    }

    return convertMealPlan(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
