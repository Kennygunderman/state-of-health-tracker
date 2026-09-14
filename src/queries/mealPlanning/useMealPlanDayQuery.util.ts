import {CurrentMealPlans, MealPlanDayEnvelope} from '@data/models/MealPlan'

/**
 * The day envelope already held by the cached `mealPlanCurrent` entry, or `undefined` when that entry cannot
 * answer the request. `undefined` is how "no seed" is expressed: the day query then starts pending and the
 * screen shows its skeleton rather than rendering an invented day.
 */
export const selectSeededMealPlanDay = (
  plans: CurrentMealPlans | undefined,
  planId: string,
  date: string
): MealPlanDayEnvelope | undefined => {
  // upcoming is matched alongside current because it is a legitimate target: the user can select next week.
  const plan = [plans?.current, plans?.upcoming].find(candidate => candidate?.id === planId)
  const day = plan?.days.find(planDay => planDay.date === date)

  if (!plan || !day) {
    return undefined
  }

  // The cached plan's own revision, never a fabricated one: the screen sends it back as expectedPlanRevision,
  // so a made-up value would turn a stale render into a 409 stale_plan loop.
  return {planId: plan.id, planRevision: plan.revision, planStatus: plan.status, day}
}
