import {NutritionTargets} from '@data/models/NutritionTargets'
import {convertNutritionTargets} from '@queries/api/mealPlanning/converter/convertNutritionTargets'
import {TargetsResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import {getApiErrorCode} from '@utility/ApiErrorUtility'
import CrashUtility from '@utility/CrashUtility'
import axios from 'axios'

import Endpoints from '@constants/endpoints'

/** A backend without the meal-planning routes 404s this path, which means "no server targets" — the caller falls back to the local target, so a bare 404 (no `error` code in the body) resolves to null rather than an error. */
export async function fetchNutritionTargets(): Promise<NutritionTargets | null> {
  try {
    const response = await httpGet(Endpoints.MealPlanTargets, TargetsResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching nutrition targets: status=${response?.status}`)
    }

    return convertNutritionTargets(response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404 && getApiErrorCode(error) === null) {
      return null
    }

    CrashUtility.recordError(error)
    throw error
  }
}
