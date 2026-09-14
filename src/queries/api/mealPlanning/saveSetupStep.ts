import {MealPlanPreferencesSaveResult, SetupStep, SetupStepPayload} from '@data/models/MealPlanPreferences'
import {convertPreferencesSaveResult} from '@queries/api/mealPlanning/converter/convertPreferences'
import {PreferencesSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function saveSetupStep(
  step: SetupStep,
  payload: SetupStepPayload
): Promise<MealPlanPreferencesSaveResult> {
  try {
    const response = await httpPut(Endpoints.MealPlanPreferenceStep(step), PreferencesSaveResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response saving setup step: status=${response?.status}`)
    }

    return convertPreferencesSaveResult(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
