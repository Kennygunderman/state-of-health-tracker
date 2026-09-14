import {useEffect, useRef} from 'react'

import {CurrentMealPlans} from '@data/models/MealPlan'
import {fetchCurrentMealPlan} from '@queries/api/mealPlanning/fetchCurrentMealPlan'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'
import {shouldInvalidateForSessionDayChange} from './useCurrentMealPlanQuery.util'

// enabled exists because /meal-planning/plans/current is gated by the meal-planning kill switch: no gated
// request may be issued while the flag is off, and the entitlement hook cannot skip a hook call to stop it.
// sessionDayKey is what makes rollover automatic: the server decides which plan is current from today's date,
// so when the session's day key moves the answer must be refetched or a long-lived observer keeps yesterday's
// plan and never promotes the upcoming one. It is passed in rather than read from the session store here, so
// this hook depends on no store of its own.
export const useCurrentMealPlanQuery = (
  enabled = true,
  sessionDayKey?: string
): UseQueryResult<CurrentMealPlans, DefaultError> => {
  const queryClient = useQueryClient()
  const observedDayKey = useRef(sessionDayKey)

  useEffect(() => {
    const previousDayKey = observedDayKey.current

    observedDayKey.current = sessionDayKey

    if (shouldInvalidateForSessionDayChange(previousDayKey, sessionDayKey)) {
      queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
    }
  }, [queryClient, sessionDayKey])

  return useQuery({
    queryKey: queryKeys.mealPlanCurrent,
    queryFn: fetchCurrentMealPlan,
    enabled
  })
}
