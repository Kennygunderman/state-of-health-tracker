import {CurrentMealPlans, MealPlanDayEnvelope} from '@data/models/MealPlan'
import {fetchMealPlanDay} from '@queries/api/mealPlanning/fetchMealPlanDay'
import type {DefaultError, QueryClient, UndefinedInitialDataOptions} from '@tanstack/react-query'
import {isPlanReadInvalidatedError} from '@utility/ApiErrorUtility'

import {queryKeys} from '../keys'

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

/**
 * The options `useMealPlanDayQuery` hands to `useQuery`, for one plan day.
 *
 * `initialData` and `initialDataUpdatedAt` are FUNCTIONS, not values: they are re-evaluated per render against
 * the live cache, so a day that had no seed when the screen mounted picks one up as soon as the current-plan
 * read resolves, and neither reads the cache at build time.
 */
export const buildMealPlanDayQueryOptions = (
  queryClient: QueryClient,
  planId: string,
  date: string,
  enabled: boolean
): UndefinedInitialDataOptions<MealPlanDayEnvelope> => ({
  queryKey: queryKeys.mealPlanDay(planId, date),
  queryFn: () => fetchMealPlanDay(planId, date),
  enabled,
  // Display-only: the seed renders the cached week's day content and reports its writeability as unknown,
  // because that verdict is computed in the user's saved zone and only the day route can answer it.
  initialData: () =>
    selectSeededMealPlanDay(queryClient.getQueryData<CurrentMealPlans>(queryKeys.mealPlanCurrent), planId, date),
  // Stamped with the source entry's own dataUpdatedAt so the normal staleTime still decides the refetch: a
  // plan restored from AsyncStorage hours ago would otherwise be treated as freshly fetched.
  initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.mealPlanCurrent)?.dataUpdatedAt,
  // One retry for a lost or unexplained answer, none for an answer that disowns the plan: a replaced or ended
  // plan and a resource 404 return the same refusal however many times they are asked, and the recovery for
  // them is a current-plan refetch rather than another read of this day. Mirrors the targets read, which
  // declines to retry its own terminal answer the same way.
  retry: (failureCount: number, error: DefaultError) => failureCount < 1 && !isPlanReadInvalidatedError(error)
})
