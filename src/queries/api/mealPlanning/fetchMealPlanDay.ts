import {MealPlanDayEnvelope, MealPlanStatus} from '@data/models/MealPlan'
import {convertMealPlanDay} from '@queries/api/mealPlanning/converter/convertMealPlanDay'
import {MealPlanDayEnvelopeResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import {resolveEnvelopeWriteability} from '@utility/MealPlanLifecycleUtility'

import Endpoints from '@constants/endpoints'

// Decoded as a plain string and resolved here, falling back to 'superseded' rather than 'active': an
// unrecognised status must never read as the live one. The writeability verdict beside it is resolved the same
// way by @utility/MealPlanLifecycleUtility. This is the ONLY place an affirmative verdict enters the app: it
// is a server value, judged against the user's saved-zone calendar day, and no client-side derivation of it
// exists to disagree with.
const KNOWN_PLAN_STATUSES: MealPlanStatus[] = ['active', 'superseded']

export async function fetchMealPlanDay(planId: string, date: string): Promise<MealPlanDayEnvelope> {
  try {
    const response = await httpGet(Endpoints.MealPlanDay(planId, date), MealPlanDayEnvelopeResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching meal plan day: status=${response?.status}`)
    }

    const data = response.data
    const writeability = resolveEnvelopeWriteability(data.planLifecycle, data.isWritable)

    return {
      planId: data.planId,
      planRevision: data.planRevision,
      planStatus: KNOWN_PLAN_STATUSES.includes(data.planStatus as MealPlanStatus)
        ? (data.planStatus as MealPlanStatus)
        : 'superseded',
      // The two members Swap and Log are gated on. A finished week is stored 'active', so the status above
      // cannot answer for them: only these carry the server's own judgement of the user's calendar day.
      planLifecycle: writeability.lifecycle,
      isWritable: writeability.isWritable,
      day: convertMealPlanDay(data.day)
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
