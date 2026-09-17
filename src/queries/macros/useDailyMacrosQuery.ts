import {DailyMacros} from '@data/models/DailyMacros'
import {fetchMacrosForDay} from '@queries/api/macros/fetchMacrosForDay'
import {DefaultError, useQuery, UseQueryResult} from '@tanstack/react-query'

import {queryKeys} from '../keys'

// `enabled` exists because Macros mounts this hook for both of its segments: while the Meal Plan segment is
// selected the diary body is not rendered, yet a mounted observer still refetches on a stale mount and on
// every target/log invalidation, competing with the plan's own queries for the same connection. Passing the
// segment in is what stops those requests without a conditional hook call. It defaults to true, so a caller
// that always shows the day it reads behaves exactly as before.
export const useDailyMacrosQuery = (date: string, enabled = true): UseQueryResult<DailyMacros, DefaultError> =>
  useQuery({queryKey: queryKeys.dailyMacros(date), queryFn: () => fetchMacrosForDay(date), enabled})
