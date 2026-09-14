import {MealEntry} from '@data/models/MealEntry'
import {MealPlanMeal} from '@data/models/MealPlan'
import {convertMealEntry} from '@queries/api/macros/converter/convertDailyMacros'
import {MealEntryResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import {convertMealPlanMeal} from '@queries/api/mealPlanning/converter/convertMealPlanDay'
import {MealPlanMealResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

// The created entry is an ordinary diary row — the very row the next GET /macros/:date returns — so it is
// decoded by the diary's own codec and mapped by the diary's own converter instead of a second copy here.
// One row shape, one mapper: the 'From meal plan' caption MealEntryRow derives from inputMethod,
// mealPlanMealId and nutritionProvenance cannot drift between this response and the diary's.
const LogPlannedMealResponse = io.type({
  entry: MealEntryResponse,
  mealPlanMeal: MealPlanMealResponse,
  planRevision: io.number
})

export interface LogPlannedMealPayload {
  // The portion actually eaten, which may differ from the planned portion. Sent exactly as the stepper
  // produced it (0.25–10, at most two decimals); the server rounds the stored snapshot once, so adjusting it
  // here would break the log screen's integer agreement with the diary.
  servings: number
  // The diary date to log against: a 'YYYY-MM-DD' day key inside the plan's week, supplied by the caller.
  date: string
  // An existing diary bucket (meals.id) the caller resolved through GET /api/macros/:date, which self-heals
  // the four buckets. No meal-name field is accepted — the client picks a bucket, it never names one — and
  // ownership of that bucket is the server's check, answered with 404.
  diaryMealId: string
  expectedPlanRevision: number
  // Minted once at the press handler and replayed unchanged, which is what makes a double tap or a lost
  // response yield the first entry rather than a second one.
  idempotencyKey: string
}

export interface LogPlannedMealResult {
  entry: MealEntry
  mealPlanMeal: MealPlanMeal
  planRevision: number
}

export async function logPlannedMeal(
  planId: string,
  mealId: string,
  payload: LogPlannedMealPayload
): Promise<LogPlannedMealResult> {
  try {
    const response = await httpPost(Endpoints.LogPlannedMeal(planId, mealId), LogPlannedMealResponse, payload)

    // 201 is the only success, on the first commit and on every replay of the same key: the server stores the
    // create status with the response and returns it unchanged, so a replay answers 201 as well. A 200 here
    // would be undocumented server drift worth failing on rather than mapping blind, and a non-2xx rejects in
    // the transport and never reaches this guard — so a confirmed failure and an unconfirmed outcome both stay
    // rejections the caller classifies and can replay with the same key.
    if (response?.status !== 201 || !response.data) {
      throw new Error(`Unexpected response logging planned meal: status=${response?.status}`)
    }

    return {
      entry: convertMealEntry(response.data.entry),
      mealPlanMeal: convertMealPlanMeal(response.data.mealPlanMeal),
      planRevision: response.data.planRevision
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
