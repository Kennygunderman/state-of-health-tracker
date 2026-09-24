import {useEffect, useRef} from 'react'

import {CurrentMealPlans} from '@data/models/MealPlan'
import {DefaultError, useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query'

import {
  answerDayKeyFromUpdatedAt,
  applyCurrentMealPlanRollover,
  buildCurrentMealPlanQueryOptions
} from './useCurrentMealPlanQuery.util'

// enabled exists because /meal-planning/plans/current is gated by the meal-planning kill switch: no gated
// request may be issued while the flag is off, and the entitlement hook cannot skip a hook call to stop it.
// sessionDayKey is what makes rollover automatic: the server decides which plan is current from today's date,
// so when the session's day key moves the answer must be refetched or a long-lived observer keeps yesterday's
// plan and never promotes the upcoming one. It is passed in rather than read from the session store here, so
// this hook depends on no store of its own.
//
// The day is bound to freshness rather than to the key, because the key is deliberately day-independent (see
// queryKeys.mealPlanCurrent) — it is the one persisted read and the entry useMealPlanDayQuery seeds from by
// exact key. That makes observedDayKey's initial value no longer load-bearing: a fresh observer has no
// previous session day to compare against, so a remount or a cold start restored from AsyncStorage decides
// from the answer's own fetch-day (dataUpdatedAt) instead, and refetches anything fetched on an earlier day.
//
// The ref and the effect stay here because they are React state; the options and the rollover action they
// drive live in the .util factories, which is what the suite exercises (no renderer is installed).
export const useCurrentMealPlanQuery = (
  enabled = true,
  sessionDayKey?: string
): UseQueryResult<CurrentMealPlans, DefaultError> => {
  const queryClient = useQueryClient()
  const observedDayKey = useRef(sessionDayKey)

  const query = useQuery(buildCurrentMealPlanQueryOptions(enabled))

  const answerDayKey = answerDayKeyFromUpdatedAt(query.dataUpdatedAt)

  useEffect(() => {
    const previousDayKey = observedDayKey.current

    observedDayKey.current = sessionDayKey

    applyCurrentMealPlanRollover(queryClient, enabled, {previousDayKey, sessionDayKey, answerDayKey})
  }, [answerDayKey, enabled, queryClient, sessionDayKey])

  return query
}
