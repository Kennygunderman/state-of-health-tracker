import {MealPlanDayEnvelope, MealPlanStatus} from '@data/models/MealPlan'
import {convertMealPlanDay} from '@queries/api/mealPlanning/converter/convertMealPlanDay'
import {MealPlanDayResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

const MealPlanDayEnvelopeResponse = io.type({
  planId: io.string,
  planRevision: io.number,
  planStatus: io.string,
  day: MealPlanDayResponse
})

// Decoded as a plain string and resolved here, falling back to 'superseded' rather than 'active': the status is
// what leaves Swap and Log enabled and lets the screen send planRevision as expectedPlanRevision, so reading an
// unrecognised value as active would offer a write against a plan the server no longer accepts one for. A day
// shown read-only is recoverable; that write is not.
const KNOWN_PLAN_STATUSES: MealPlanStatus[] = ['active', 'superseded']

export async function fetchMealPlanDay(planId: string, date: string): Promise<MealPlanDayEnvelope> {
  try {
    const response = await httpGet(Endpoints.MealPlanDay(planId, date), MealPlanDayEnvelopeResponse)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response fetching meal plan day: status=${response?.status}`)
    }

    const data = response.data

    return {
      planId: data.planId,
      planRevision: data.planRevision,
      planStatus: KNOWN_PLAN_STATUSES.includes(data.planStatus as MealPlanStatus)
        ? (data.planStatus as MealPlanStatus)
        : 'superseded',
      day: convertMealPlanDay(data.day)
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
