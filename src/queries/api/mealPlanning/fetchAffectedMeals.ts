import {AffectedMeal} from '@data/models/MealPlan'
import {convertAffectedMeals} from '@queries/api/mealPlanning/converter/convertAffectedMeals'
import {AffectedMealsResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function fetchAffectedMeals(planId: string): Promise<AffectedMeal[]> {
  try {
    const response = await httpGet(Endpoints.MealPlanAffectedMeals(planId), AffectedMealsResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching affected meals: status=${response?.status}`)
    }

    return convertAffectedMeals(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
