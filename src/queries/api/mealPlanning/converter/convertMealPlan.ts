import {MealPlan, MealPlanStatus} from '@data/models/MealPlan'
import {MealPlanResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

import {convertMealPlanDay} from './convertMealPlanDay'

const KNOWN_PLAN_STATUSES = ['active', 'superseded'] as const satisfies readonly MealPlanStatus[]

export function convertMealPlan(data: io.TypeOf<typeof MealPlanResponse>): MealPlan {
  return {
    id: data.id,
    revision: data.revision,
    generationAttempt: data.generationAttempt,
    startDate: data.startDate,
    endDate: data.endDate,
    // The server owns write eligibility (it answers 409 plan_not_active itself), so reading an unknown status as
    // active cannot cause an unsafe write, while defaulting to superseded would disable Swap and Log on a good plan.
    status: (KNOWN_PLAN_STATUSES as readonly string[]).includes(data.status)
      ? (data.status as MealPlanStatus)
      : 'active',
    // Three distinct members by design: the targets as they are now, the snapshot this plan was built against, and
    // the server's verdict that the two differ — never merged, never recomputed here.
    targets: data.targets,
    generationTargets: data.generationTargets,
    targetsStale: data.targetsStale,
    preferencesRevision: data.preferencesRevision,
    targetsRevision: data.targetsRevision,
    hasIncompatibilities: data.hasIncompatibilities,
    summary: {
      plannedMeals: data.summary.plannedMeals,
      groceryItemCount: data.summary.groceryItemCount,
      loggedEntryCount: data.summary.loggedEntryCount
    },
    days: data.days.map(convertMealPlanDay)
  }
}
