import {
  answerDayKeyFromUpdatedAt,
  isAnswerBeforeSessionDay,
  shouldInvalidateForSessionDayChange,
  shouldRefetchCurrentMealPlan
} from '../useCurrentMealPlanQuery.util'

const YESTERDAY = '2026-07-05'
const TODAY = '2026-07-06'

// Built from local parts, as day keys are: a fixed epoch value would name a different day in each zone the
// suite runs in, and Date.now() would make these cases drift into the next day at midnight.
const FETCHED_YESTERDAY_LATE = new Date(2026, 6, 5, 23, 58, 30).getTime()
const FETCHED_TODAY_EARLY = new Date(2026, 6, 6, 0, 1, 15).getTime()
const NEVER_FETCHED = 0

describe('shouldInvalidateForSessionDayChange', () => {
  it('invalidates when the session crosses into a new day, which is what promotes an upcoming plan', () => {
    expect(shouldInvalidateForSessionDayChange(YESTERDAY, TODAY)).toBe(true)
  })

  it('invalidates when the day key moves backwards, because the current plan still has to be re-resolved', () => {
    expect(shouldInvalidateForSessionDayChange(TODAY, YESTERDAY)).toBe(true)
  })

  it('does not invalidate while the day key is unchanged, so a re-render never refetches', () => {
    expect(shouldInvalidateForSessionDayChange(TODAY, TODAY)).toBe(false)
  })

  it('does not invalidate on the first key a caller supplies, which the query was already fetched against', () => {
    expect(shouldInvalidateForSessionDayChange(undefined, TODAY)).toBe(false)
  })

  it('does not invalidate when a caller stops supplying a key, since no rollover has been observed', () => {
    expect(shouldInvalidateForSessionDayChange(TODAY, undefined)).toBe(false)
  })

  it('does not invalidate for a caller that never supplies a key, so the mount stays request-free', () => {
    expect(shouldInvalidateForSessionDayChange(undefined, undefined)).toBe(false)
  })
})

describe('answerDayKeyFromUpdatedAt', () => {
  it('reads the day a pre-midnight answer was fetched on, which is the day it describes', () => {
    expect(answerDayKeyFromUpdatedAt(FETCHED_YESTERDAY_LATE)).toBe(YESTERDAY)
  })

  it('reads the day a post-midnight answer was fetched on', () => {
    expect(answerDayKeyFromUpdatedAt(FETCHED_TODAY_EARLY)).toBe(TODAY)
  })

  it('reports no day for an entry that has never resolved, which TanStack timestamps as 0', () => {
    expect(answerDayKeyFromUpdatedAt(NEVER_FETCHED)).toBeUndefined()
  })

  it('reports no day when there is no cache entry at all', () => {
    expect(answerDayKeyFromUpdatedAt(undefined)).toBeUndefined()
  })
})

describe('isAnswerBeforeSessionDay', () => {
  it('is true for an answer fetched before the session day, which is what a rollover leaves behind', () => {
    expect(isAnswerBeforeSessionDay(YESTERDAY, TODAY)).toBe(true)
  })

  it('is false for an answer fetched on the session day', () => {
    expect(isAnswerBeforeSessionDay(TODAY, TODAY)).toBe(false)
  })

  it('is false for an answer newer than the session day, so the comparison stays monotone', () => {
    expect(isAnswerBeforeSessionDay(TODAY, YESTERDAY)).toBe(false)
  })

  it('is false when either side is unknown, so an unfetched or unkeyed read decides nothing', () => {
    expect(isAnswerBeforeSessionDay(undefined, TODAY)).toBe(false)
    expect(isAnswerBeforeSessionDay(YESTERDAY, undefined)).toBe(false)
    expect(isAnswerBeforeSessionDay(undefined, undefined)).toBe(false)
  })
})

describe('shouldRefetchCurrentMealPlan', () => {
  it('refetches on a remount after midnight, where the fresh ref has no rollover to observe', () => {
    expect(shouldRefetchCurrentMealPlan({previousDayKey: TODAY, sessionDayKey: TODAY, answerDayKey: YESTERDAY})).toBe(
      true
    )
  })

  it('refetches on a persisted cold start after midnight, judged from the restored fetch timestamp', () => {
    expect(
      shouldRefetchCurrentMealPlan({
        previousDayKey: TODAY,
        sessionDayKey: TODAY,
        answerDayKey: answerDayKeyFromUpdatedAt(FETCHED_YESTERDAY_LATE)
      })
    ).toBe(true)
  })

  it('does not refetch on a same-day remount, so a tab switch never re-requests the plan', () => {
    expect(shouldRefetchCurrentMealPlan({previousDayKey: TODAY, sessionDayKey: TODAY, answerDayKey: TODAY})).toBe(false)
  })

  it('still refetches when the session day moves while mounted, which is what promotes an upcoming plan', () => {
    expect(
      shouldRefetchCurrentMealPlan({previousDayKey: YESTERDAY, sessionDayKey: TODAY, answerDayKey: YESTERDAY})
    ).toBe(true)
  })

  it('does not refetch when there is no cached answer, so a first mount stays request-free', () => {
    expect(shouldRefetchCurrentMealPlan({previousDayKey: TODAY, sessionDayKey: TODAY, answerDayKey: undefined})).toBe(
      false
    )
    expect(
      shouldRefetchCurrentMealPlan({
        previousDayKey: TODAY,
        sessionDayKey: TODAY,
        answerDayKey: answerDayKeyFromUpdatedAt(NEVER_FETCHED)
      })
    ).toBe(false)
  })

  it('does not refetch an answer newer than the session day, the case that would otherwise loop forever', () => {
    expect(
      shouldRefetchCurrentMealPlan({
        previousDayKey: YESTERDAY,
        sessionDayKey: YESTERDAY,
        answerDayKey: answerDayKeyFromUpdatedAt(FETCHED_TODAY_EARLY)
      })
    ).toBe(false)
  })
})
