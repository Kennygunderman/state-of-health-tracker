import {MealPlanDayEnvelope} from '@data/models/MealPlan'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {buildMealPlanDayQueryOptions} from './useMealPlanDayQuery.util'

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

  return useQuery(buildMealPlanDayQueryOptions(queryClient, planId, date, enabled))
}
