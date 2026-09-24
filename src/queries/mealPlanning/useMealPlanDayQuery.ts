import {MealPlanDayEnvelope} from '@data/models/MealPlan'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {buildMealPlanDayQueryOptions} from './useMealPlanDayQuery.util'
import {useMealPlanGatedRequestAllowed} from './useMealPlanGatedRequestAllowed'

// enabled is the CALLER's half of the gate, and it is only a half: a caller that renders the plan tab's own
// no-plan, loading, error and unavailable states holds no plan id to read a day for. It defaults to true, so a
// screen whose route already names a plan calls this hook with two arguments. The capability half is not the
// caller's to remember — it is read here, from the flag and the session verdict, so a latched session cannot
// issue this request from any call site (AAP 0.2.5, 0.7.5).
export const useMealPlanDayQuery = (
  planId: string,
  date: string,
  enabled = true
): UseQueryResult<MealPlanDayEnvelope, DefaultError> => {
  const queryClient = useQueryClient()
  const isGatedReadAllowed = useMealPlanGatedRequestAllowed()

  return useQuery(buildMealPlanDayQueryOptions(queryClient, planId, date, enabled && isGatedReadAllowed))
}
