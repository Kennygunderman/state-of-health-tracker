import {MealPlanDayEnvelope} from '@data/models/MealPlan'
import {convertMealPlanDayEnvelope} from '@queries/api/mealPlanning/converter/convertMealPlanDay'
import {MealPlanDayEnvelopeResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchMealPlanDay(planId: string, date: string): Promise<MealPlanDayEnvelope> {
  try {
    const response = await httpGet(Endpoints.MealPlanDay(planId, date), MealPlanDayEnvelopeResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching meal plan day: status=${response?.status}`)
    }

    // The envelope's status, lifecycle and writeability verdict are resolved by the converter rather than
    // here: this is the only route that answers them, but the rule for reading them — the server's judgement
    // when it sends one, the contract's `planStatus` when it does not — belongs where it can be tested.
    return convertMealPlanDayEnvelope(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
