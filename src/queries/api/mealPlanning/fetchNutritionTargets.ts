import {NutritionTargets} from '@data/models/NutritionTargets'
import {convertNutritionTargets} from '@queries/api/mealPlanning/converter/convertNutritionTargets'
import {TargetsResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import {getApiErrorCode} from '@utility/ApiErrorUtility'
import CrashUtility from '@utility/CrashUtility'
import {RoutesMissingError} from '@utility/MealPlanEntitlementUtility'
import axios from 'axios'

import Endpoints from '@constants/endpoints'

/**
 * The user's confirmed nutrition targets, or a `RoutesMissingError` when this route is not mounted.
 *
 * A backend rolled back to a build without meal planning 404s this path with no `error` code in the body, and
 * that answer has two jobs which a resolved `null` could only serve one of. "The server holds no targets" is
 * already a *successful* response here (`TargetsResponse.targets === null`), so resolving the 404 to `null`
 * too would make a rolled-back backend indistinguishable from a user who has never confirmed targets: the
 * capability signal of AAP 0.2.5 signal (b) — which `@hooks/mealPlanning/useMealPlanEntitlement` turns into
 * the Meal Plan segment's unavailable card — would be erased. Throwing the typed error keeps both jobs, since
 * AAP 0.7.5's other requirement is served by the absence of data rather than by its value: target consumers
 * select the local fallback through `@queries/mealPlanning/useNutritionTargetsQuery.util::selectNutritionTargets`,
 * so Account, Progress and the Diary target editor keep showing the local target and clear nothing.
 *
 * That branch deliberately records no crash: a rolled-back backend answers every request this way, and
 * reporting an expected release state once per request is noise. Every other failure is recorded and
 * re-thrown, so a genuine read failure still reaches Crashlytics.
 */
export async function fetchNutritionTargets(): Promise<NutritionTargets> {
  try {
    const response = await httpGet(Endpoints.MealPlanTargets, TargetsResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching nutrition targets: status=${response?.status}`)
    }

    return convertNutritionTargets(response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404 && getApiErrorCode(error) === null) {
      throw new RoutesMissingError(Endpoints.MealPlanTargets)
    }

    CrashUtility.recordError(error)
    throw error
  }
}
