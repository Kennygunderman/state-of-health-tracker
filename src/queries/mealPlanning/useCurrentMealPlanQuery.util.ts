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
