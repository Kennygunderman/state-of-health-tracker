import {MealPlanPreferencesSaveResult, SetupStepRequest} from '@data/models/MealPlanPreferences'
import {convertPreferencesSaveResult} from '@queries/api/mealPlanning/converter/convertPreferences'
import {PreferencesSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

/**
 * One argument rather than a step and a payload, because the pairing only survives while the two travel as a
 * single `SetupStepRequest`: as two parameters each widens to its own union, and both requests the server has
 * to refuse — a step sent with another step's payload, and the stored-only 'targets_manual' sent as a path
 * segment — compile again.
 */
export async function saveSetupStep(request: SetupStepRequest): Promise<MealPlanPreferencesSaveResult> {
  try {
    const response = await httpPut(
      Endpoints.MealPlanPreferenceStep(request.step),
      PreferencesSaveResponse,
      request.payload
    )

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response saving setup step: status=${response?.status}`)
    }

    return convertPreferencesSaveResult(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
