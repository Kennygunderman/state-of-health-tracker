import {fetchAffectedMeals} from '@queries/api/mealPlanning/fetchAffectedMeals'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useAffectedMealsQuery = (planId: string) =>
  useQuery({queryKey: queryKeys.affectedMeals(planId), queryFn: () => fetchAffectedMeals(planId)})
