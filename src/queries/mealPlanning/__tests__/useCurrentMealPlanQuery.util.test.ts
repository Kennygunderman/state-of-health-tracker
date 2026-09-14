import {shouldInvalidateForSessionDayChange} from '../useCurrentMealPlanQuery.util'

const YESTERDAY = '2026-07-05'
const TODAY = '2026-07-06'

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
