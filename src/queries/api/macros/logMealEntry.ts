import {LogCatalogMealEntryPayload, LogMealEntryPayload, MealEntry} from '@data/models/MealEntry'
import {convertMealEntry} from '@queries/api/macros/converter/convertDailyMacros'
import {MealEntryResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

export async function logMealEntry(
  mealId: string,
  payload: LogMealEntryPayload | LogCatalogMealEntryPayload
): Promise<MealEntry> {
  try {
    const response = await httpPost(Endpoints.MacroMealEntries(mealId), MealEntryResponse, payload)

    if ((response?.status !== 201 && response?.status !== 200) || !response.data) {
      throw new Error(`Unexpected response logging entry: status=${response?.status}`)
    }

    return convertMealEntry(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
