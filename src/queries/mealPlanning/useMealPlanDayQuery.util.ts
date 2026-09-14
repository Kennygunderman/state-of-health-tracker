import {CurrentMealPlans, MealPlanDayEnvelope} from '@data/models/MealPlan'

/**
 * The day envelope already held by the cached `mealPlanCurrent` entry, or `undefined` when that entry cannot
 * answer the request. `undefined` is how "no seed" is expressed: the day query then starts pending and the
 * screen shows its skeleton rather than rendering an invented day.
 *
 * THE SEED IS DISPLAY-ONLY. It carries the cached week's day content so the screen renders immediately, and
 * `planLifecycle`/`isWritable` are `null` because this envelope did not come from the day route and no local
 * value could stand in for what that route answers: endedness is judged against the calendar day of the
 * user's saved IANA zone, which this cache does not carry and the device's own day does not match after
 * travel. Deriving a verdict here would mark a finished week writable — and `mealPlanCurrent` is persisted, so
 * the week most likely to be stale is exactly the one restored from AsyncStorage. Swap and Log therefore stay
 * inert until `GET .../days/:date` has answered, which is the only thing that replaces these two `null`s.
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
  return {
    planId: plan.id,
    planRevision: plan.revision,
    // The stored column, carried as it stands. It is not a capability — a week that finished last month still
    // reads 'active' — and nothing gates on it; the two members below are where capability lives.
    planStatus: plan.status,
    planLifecycle: null,
    isWritable: null,
    day
  }
}
