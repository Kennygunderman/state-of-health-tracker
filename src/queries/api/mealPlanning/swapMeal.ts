import {SwapMealPayload, SwapMealResult} from '@data/models/SwapAlternative'
import {convertMealPlanDay, convertMealPlanMeal} from '@queries/api/mealPlanning/converter/convertMealPlanDay'
import {MealPlanDayResponse, MealPlanMealResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

// The swapped meal and its whole day are ordinary plan rows — the same rows GET .../days/:date returns — so
// they are decoded by the plan's shared codecs and mapped by the plan's own converter instead of a second copy
// here. One row shape, one mapper: the logged state, flags and planned totals a swap returns cannot drift from
// the ones the day query returns. The envelope itself has a single consumer, so it stays local to this file.
const SwapMealResponse = io.type({
  meal: MealPlanMealResponse,
  day: MealPlanDayResponse,
  planRevision: io.number,
  groceryChangeSummary: io.type({added: io.number, removed: io.number, increased: io.number})
})

/**
 * Commits a previewed swap.
 *
 * The payload is forwarded verbatim, and both of its bindings depend on that: `portionMultiplier` is the
 * portion the preview was computed at, which the server re-derives and rejects with `409 preview_stale` when
 * the two disagree, and `idempotencyKey` is the one the press handler minted, whose replay is what makes a
 * committed swap return its stored result instead of swapping twice. Rounding the first or re-minting the
 * second would manufacture exactly the conflict each is there to prevent.
 */
export async function swapMeal(planId: string, mealId: string, payload: SwapMealPayload): Promise<SwapMealResult> {
  try {
    const response = await httpPost(Endpoints.MealPlanSwap(planId, mealId), SwapMealResponse, payload)

    // A single 200 check, not the created-resource guard the generate, regenerate and log writes use: a swap
    // replaces the recipe of a meal that already exists, so it creates nothing, and a replay of the same key
    // answers with that stored 200 verbatim. Any other 2xx would be an undocumented server change worth
    // failing on rather than mapping blind, and every non-2xx rejects in the transport before this guard —
    // so `502 swap_failed` and an unconfirmed outcome both stay rejections the caller classifies.
    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response swapping meal: status=${response?.status}`)
    }

    const data = response.data

    return {
      meal: convertMealPlanMeal(data.meal),
      day: convertMealPlanDay(data.day),
      planRevision: data.planRevision,
      groceryChangeSummary: data.groceryChangeSummary
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
