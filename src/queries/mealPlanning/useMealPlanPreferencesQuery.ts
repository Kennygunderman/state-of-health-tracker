import {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {fetchMealPlanPreferences} from '@queries/api/mealPlanning/fetchMealPlanPreferences'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// `enabled` exists because /meal-planning/preferences is gated by the meal-planning kill switch: no gated
// request may be issued while the flag is off, and the entitlement hook cannot skip a hook call to stop it.
// Passing the flag in is what lets `useMealPlanEntitlement` read the flag and this query without a conditional
// hook call. It defaults to true so a caller that has no gate to apply behaves exactly as before.
export const useMealPlanPreferencesQuery = (enabled = true): UseQueryResult<MealPlanPreferences, DefaultError> =>
  useQuery({
    queryKey: queryKeys.mealPlanPreferences,
    queryFn: fetchMealPlanPreferences,
    enabled
  })
