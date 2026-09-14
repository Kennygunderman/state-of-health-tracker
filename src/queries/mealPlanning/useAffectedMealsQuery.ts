import {AffectedMeal} from '@data/models/MealPlan'
import {fetchAffectedMeals} from '@queries/api/mealPlanning/fetchAffectedMeals'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useAffectedMealsQuery = (planId: string): UseQueryResult<AffectedMeal[], DefaultError> =>
  useQuery({queryKey: queryKeys.affectedMeals(planId), queryFn: () => fetchAffectedMeals(planId)})
