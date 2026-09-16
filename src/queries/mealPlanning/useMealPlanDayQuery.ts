import {CurrentMealPlans, MealPlanDayEnvelope} from '@data/models/MealPlan'
import {fetchMealPlanDay} from '@queries/api/mealPlanning/fetchMealPlanDay'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'
import {selectSeededMealPlanDay} from './useMealPlanDayQuery.util'

// enabled exists for the same reason it does on the preferences and current-plan reads: /meal-planning is
// gated by the kill switch, so no request may be issued while the flag is off, and a caller that renders the
// plan tab's own no-plan, loading, error and unavailable states holds no plan id to read a day for. It
// defaults to true, so a screen whose route already names a plan calls this hook with two arguments.
export const useMealPlanDayQuery = (
  planId: string,
  date: string,
  enabled = true
): UseQueryResult<MealPlanDayEnvelope, DefaultError> => {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.mealPlanDay(planId, date),
    queryFn: () => fetchMealPlanDay(planId, date),
    enabled,
    // Display-only: the seed renders the cached week's day content and reports its writeability as unknown,
    // because that verdict is computed in the user's saved zone and only the day route can answer it.
    initialData: () =>
      selectSeededMealPlanDay(queryClient.getQueryData<CurrentMealPlans>(queryKeys.mealPlanCurrent), planId, date),
    // Stamped with the source entry's own dataUpdatedAt so the normal staleTime still decides the refetch: a
    // plan restored from AsyncStorage hours ago would otherwise be treated as freshly fetched.
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.mealPlanCurrent)?.dataUpdatedAt
  })
}
