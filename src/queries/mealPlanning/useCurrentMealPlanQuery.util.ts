import {CurrentMealPlans} from '@data/models/MealPlan'
import {fetchCurrentMealPlan} from '@queries/api/mealPlanning/fetchCurrentMealPlan'
import type {QueryClient, UndefinedInitialDataOptions} from '@tanstack/react-query'
import {formatDayKey} from '@utility/MealPlanDateUtility'

import {queryKeys} from '../keys'

export interface CurrentMealPlanRefetchInputs {
  previousDayKey: string | undefined
  sessionDayKey: string | undefined
  answerDayKey: string | undefined
}

/**
 * Whether the session's day key moving from `previousDayKey` to `nextDayKey` is a rollover the current-plan
 * cache must be invalidated for. True only for a change between two known day keys: the first key a caller
 * supplies is what the query was already fetched against, and a caller that supplies none at all (the key is
 * optional) must not provoke a refetch on every mount.
 */
export const shouldInvalidateForSessionDayChange = (
  previousDayKey: string | undefined,
  nextDayKey: string | undefined
): boolean => previousDayKey !== undefined && nextDayKey !== undefined && previousDayKey !== nextDayKey

/**
 * The local day key a cached answer was fetched on, read from the cache entry's own `dataUpdatedAt`. It is the
 * only rollover signal a fresh observer has: a remount or a restore from AsyncStorage carries no previous
 * session day to compare against, but it does carry the timestamp of the answer it is about to render.
 *
 * TanStack reports `0` for an entry that has never resolved, which is the same "there is no answer to judge"
 * case as `undefined` — neither may be read as a day, because inventing one would make a first mount refetch.
 */
export const answerDayKeyFromUpdatedAt = (dataUpdatedAt: number | undefined): string | undefined =>
  dataUpdatedAt === undefined || dataUpdatedAt === 0 ? undefined : formatDayKey(new Date(dataUpdatedAt))

/**
 * Whether the cached answer predates the session's day, which is exactly when `{current, upcoming}` has to be
 * re-resolved: the server picks the current plan from today's date, so an answer fetched yesterday can show an
 * ended plan as current and never promote the upcoming one.
 *
 * Strictly earlier is load-bearing, not stylistic. It makes the decision monotone, so an answer that is newer
 * than a momentarily stale session key cannot invalidate and no refetch loop is reachable. The keys are
 * fixed-width and zero-padded, so comparing them as strings is chronological — the same reason
 * `isDayKeyWithin` compares day keys directly.
 */
export const isAnswerBeforeSessionDay = (
  answerDayKey: string | undefined,
  sessionDayKey: string | undefined
): boolean => answerDayKey !== undefined && sessionDayKey !== undefined && answerDayKey < sessionDayKey

/**
 * The single decision behind the current-plan refetch: a rollover observed while mounted, or an answer that
 * was already fetched on an earlier day. Every time-dependent value arrives as a parameter, so this reads no
 * clock and no store.
 */
export const shouldRefetchCurrentMealPlan = ({
  previousDayKey,
  sessionDayKey,
  answerDayKey
}: CurrentMealPlanRefetchInputs): boolean =>
  shouldInvalidateForSessionDayChange(previousDayKey, sessionDayKey) ||
  isAnswerBeforeSessionDay(answerDayKey, sessionDayKey)

/**
 * The options `useCurrentMealPlanQuery` hands to `useQuery`. The key is `queryKeys.mealPlanCurrent` itself
 * rather than a literal of the same shape: it is the persisted read, the entry `useMealPlanDayQuery` seeds
 * from by exact key and the root every plan mutation invalidates by prefix, so all of them have to name one
 * array and none of them may spell it out again.
 *
 * `enabled` is passed through untouched because /meal-planning/plans/current is gated by the meal-planning
 * kill switch — no gated request may be issued while the flag is off, and a hook call cannot be skipped.
 */
export const buildCurrentMealPlanQueryOptions = (enabled: boolean): UndefinedInitialDataOptions<CurrentMealPlans> => ({
  queryKey: queryKeys.mealPlanCurrent,
  queryFn: fetchCurrentMealPlan,
  enabled
})

/**
 * Invalidates the current-plan answer when the day it was resolved for has moved, which is the whole of the
 * rollover effect's body: the server picks the current plan from today's date, so a stale answer can show an
 * ended plan as current and never promote the upcoming one.
 *
 * Invalidation, not a refetch or a reset, is what does it: it keeps the stale plan as data when the refetch
 * fails, which is what leaves an offline session with its read-only plan and its last-saved-plan banner
 * rather than the no-plan state. A disabled read is skipped entirely, because marking a kill-switched entry
 * stale would send the gated request the flag exists to prevent as soon as an observer is active.
 */
export const applyCurrentMealPlanRollover = (
  queryClient: QueryClient,
  enabled: boolean,
  inputs: CurrentMealPlanRefetchInputs
): void => {
  if (!enabled || !shouldRefetchCurrentMealPlan(inputs)) {
    return
  }

  queryClient.invalidateQueries({queryKey: queryKeys.mealPlanCurrent})
}
