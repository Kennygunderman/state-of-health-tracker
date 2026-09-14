import {CurrentMealPlans} from '@data/models/MealPlan'
import {convertMealPlan} from '@queries/api/mealPlanning/converter/convertMealPlan'
import {CurrentMealPlanResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchCurrentMealPlan(): Promise<CurrentMealPlans> {
  try {
    const response = await httpGet(Endpoints.CurrentMealPlan, CurrentMealPlanResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching current meal plan: status=${response?.status}`)
    }

    const data = response.data

    return {
      current: data.current ? convertMealPlan(data.current) : null,
      upcoming: data.upcoming ? convertMealPlan(data.upcoming) : null
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
