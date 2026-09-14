import {CurrentMealPlans, MealPlanDayEnvelope} from '@data/models/MealPlan'
import {fetchMealPlanDay} from '@queries/api/mealPlanning/fetchMealPlanDay'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'
import {selectSeededMealPlanDay} from './useMealPlanDayQuery.util'

export const useMealPlanDayQuery = (
  planId: string,
  date: string
): UseQueryResult<MealPlanDayEnvelope, DefaultError> => {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.mealPlanDay(planId, date),
    queryFn: () => fetchMealPlanDay(planId, date),
    initialData: () =>
      selectSeededMealPlanDay(queryClient.getQueryData<CurrentMealPlans>(queryKeys.mealPlanCurrent), planId, date),
    // Stamped with the source entry's own dataUpdatedAt so the normal staleTime still decides the refetch: a
    // plan restored from AsyncStorage hours ago would otherwise be treated as freshly fetched.
    initialDataUpdatedAt: () => queryClient.getQueryState(queryKeys.mealPlanCurrent)?.dataUpdatedAt
  })
}
