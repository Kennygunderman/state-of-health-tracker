import {MealPlanPreferencesSaveResult, SaveMealPlanPreferencesPayload} from '@data/models/MealPlanPreferences'
import {convertPreferencesSaveResult} from '@queries/api/mealPlanning/converter/convertPreferences'
import {PreferencesSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

/**
 * The body `PUT /api/meal-planning/preferences` accepts: the edited answers,
 * the pinned revision, and — required, not optional — the device's IANA time
 * zone.
 *
 * The server requires the zone on every full save and resolves the user's
 * "today" from the value the request carried, so that a user who has travelled
 * sees plan days in the calendar they are in now; a body without one is
 * refused with a `timeZone` detail rather than silently keeping the stored
 * zone. `SaveMealPlanPreferencesPayload` leaves it optional because the shared
 * model also describes a draft being assembled on screen, so the requirement is
 * stated here, at the request boundary that has to satisfy it.
 */
export type SaveMealPlanPreferencesRequest = SaveMealPlanPreferencesPayload & {timeZone: string}

export async function savePreferences(payload: SaveMealPlanPreferencesRequest): Promise<MealPlanPreferencesSaveResult> {
  try {
    const response = await httpPut(Endpoints.MealPlanPreferences, PreferencesSaveResponse, payload)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response saving meal plan preferences: status=${response?.status}`)
    }

    return convertPreferencesSaveResult(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
