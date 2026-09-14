import {formatDayKey} from '@utility/MealPlanDateUtility'

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
