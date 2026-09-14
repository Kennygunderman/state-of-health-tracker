import {MealPlan} from '@data/models/MealPlan'
import {RegeneratePlanPayload} from '@data/models/PlanGenerationResult'
import {convertMealPlan} from '@queries/api/mealPlanning/converter/convertMealPlan'
import {MealPlanResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'

import Endpoints from '@constants/endpoints'

// The returned plan is a NEW plan: the server publishes it while the plan identified by `planId` becomes
// `superseded`, which is why the response carries a different id and revision 1 rather than the old plan's.
// No `startDate` is sent — a regeneration keeps the plan's own dates — and `expectedPlanRevision` in the
// payload is what makes a stale screen unable to replace a plan that has already moved on.
export async function regeneratePlan(planId: string, payload: RegeneratePlanPayload): Promise<MealPlan> {
  try {
    const response = await httpPost(Endpoints.RegenerateMealPlan(planId), MealPlanResponse, payload)

    // 201 on the first commit and on every replay of the same key, because the server returns the stored
    // first response verbatim; 200 is admitted so a replay can never be told apart from a fresh commit.
    // Every other outcome — 409 stale_plan / plan_not_active / stale_revision / idempotency_conflict,
    // 422 no_matching_meals, 502 plan_generation_failed, 503 feature_disabled, and any unknown one — rejects
    // in the transport and propagates unchanged, so the caller keeps the whole error to classify.
    if ((response?.status !== 201 && response?.status !== 200) || !response.data) {
      throw new Error(`Unexpected response regenerating meal plan: status=${response?.status}`)
    }

    return convertMealPlan(response.data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
