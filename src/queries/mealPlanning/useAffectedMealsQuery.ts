import {AffectedMeal} from '@data/models/MealPlan'
import {fetchAffectedMeals} from '@queries/api/mealPlanning/fetchAffectedMeals'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'
import {useMealPlanGatedRequestAllowed} from './useMealPlanGatedRequestAllowed'

// Gated like every other `/meal-planning` read, and gated here rather than at the plan-settings call site so
// the verdict cannot be forgotten by a caller (AAP 0.2.5, 0.7.5).
export const useAffectedMealsQuery = (planId: string): UseQueryResult<AffectedMeal[], DefaultError> => {
  const isGatedReadAllowed = useMealPlanGatedRequestAllowed()

  return useQuery({
    queryKey: queryKeys.affectedMeals(planId),
    queryFn: () => fetchAffectedMeals(planId),
    enabled: isGatedReadAllowed
  })
}
