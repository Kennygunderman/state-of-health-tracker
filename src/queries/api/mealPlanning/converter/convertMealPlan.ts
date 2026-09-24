import {MealPlan} from '@data/models/MealPlan'
import {MealPlanResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

import {convertMealPlanDay} from './convertMealPlanDay'

export function convertMealPlan(data: io.TypeOf<typeof MealPlanResponse>): MealPlan {
  return {
    id: data.id,
    revision: data.revision,
    generationAttempt: data.generationAttempt,
    // The publishing write's idempotency key when the response carried one, so the screen that OWNS a pending
    // generation can recognise this plan as its own result (0.7.4). An additive extra rather than a contract
    // member, so absent and explicit null both land as null — "not proven", which is what every reader outside
    // that screen is left with anyway: a plan read never settles a pending intent (0.2.5).
    generationKey: data.generationKey ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    // Carried, never defaulted. The status decides whether Swap and Log are offered at all, so reading an
    // unrecognised one as 'active' would enable writes against a plan the server would refuse; the codec
    // admits only the two the contract defines.
    status: data.status,
    // Three distinct members by design: the targets as they are now, the snapshot this plan was built
    // against, and the server's verdict that the two differ — never merged, never recomputed here.
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
