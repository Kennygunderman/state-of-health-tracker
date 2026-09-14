import {fetchMealPlanPreferences} from '@queries/api/mealPlanning/fetchMealPlanPreferences'
import {useQuery} from '@tanstack/react-query'

import {queryKeys} from '../keys'

export const useMealPlanPreferencesQuery = () =>
  useQuery({
    queryKey: queryKeys.mealPlanPreferences,
    queryFn: fetchMealPlanPreferences
  })
