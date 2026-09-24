/**
 * @jest-environment <rootDir>/src/testSupport/dstTimeZoneEnvironment.ts
 *
 * The companion suite runs in the runner's own zone, which is UTC on CI and has no transition to cross and no
 * offset to lose a day to. This one is pinned to America/New_York by the environment above — `jest.config.js`
 * binds the same environment to every `*.dst.test.ts` file — where the fall-back on 2026-11-01 makes a local
 * day 25 hours long and the offset is negative all year: a helper that advanced by a fixed 24 hours, or that
 * read a `yyyy-MM-dd` key as a UTC instant, returns the wrong calendar day and fails here.
 *
 * Determinism comes from injected fixtures, exactly as it does in the companion suite: every `now` is a local
 * `Date` built from numeric parts, and there are no fake timers, no mocked clock and no `Date.now()`.
 */
import {
  addDaysToDayKey,
  clampDayKeyToPlan,
  dayStripLabel,
  defaultSelectedPlanDate,
  formatDayKey,
  formatPlanDayLabel,
  formatPlanRange,
  formatSlotTime,
  isDayKeyWithin,
  isLastPlanDay,
  parseDayKey,
  planDates,
  planStartDateBounds,
  resolvePostLogViewTarget
} from '../MealPlanDateUtility'

const FALL_BACK_DAY = '2026-11-01'
const FALL_BACK_WEEK_START = '2026-10-29'
const FALL_BACK_WEEK_END = '2026-11-04'
const SPRING_FORWARD_DAY = '2026-03-08'
const SPRING_FORWARD_WEEK_END = '2026-03-14'
const EST_OFFSET_MINUTES = 300
const EDT_OFFSET_MINUTES = 240
const FIXED_DAY_MS = 24 * 60 * 60 * 1000
const EN_DASH = '\u2013'

describe('daylight saving fixture', () => {
  it('runs in a zone whose offset changes across the year', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
  })

  it('places the fall-back transition inside the first of November 2026', () => {
    expect(new Date(2026, 10, 1, 0, 30).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
    expect(new Date(2026, 10, 1, 23, 30).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
    expect(new Date(2026, 10, 2).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
  })

  it('places the spring-forward transition inside the eighth of March 2026', () => {
    expect(new Date(2026, 2, 7).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
    expect(new Date(2026, 2, 8, 0, 30).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
    expect(new Date(2026, 2, 8, 3, 30).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
    expect(new Date(2026, 2, 9).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
  })

  it('would lose a day here if a helper advanced by a fixed twenty-four hours', () => {
    const fixedDayLater = new Date(parseDayKey(FALL_BACK_DAY).getTime() + FIXED_DAY_MS)

    expect(formatDayKey(fixedDayLater)).toBe(FALL_BACK_DAY)
    expect(fixedDayLater.getHours()).toBe(23)
  })

  it('would lose a day here if a key were parsed as an instant', () => {
    expect(formatDayKey(new Date(FALL_BACK_DAY))).toBe('2026-10-31')
  })
})

describe('parseDayKey', () => {
  it('builds local midnight rather than UTC midnight in a negative-offset zone', () => {
    expect(parseDayKey('2026-07-05').getTime()).toBe(Date.UTC(2026, 6, 5, 4))
    expect(parseDayKey('2026-01-05').getTime()).toBe(Date.UTC(2026, 0, 5, 5))
  })

  it('parses the two days the fall-back separates at their own offsets', () => {
    expect(parseDayKey(FALL_BACK_DAY).getTime()).toBe(Date.UTC(2026, 10, 1, 4))
    expect(parseDayKey('2026-11-02').getTime()).toBe(Date.UTC(2026, 10, 2, 5))
  })

  it('reads the local date parts of a transition day', () => {
    const parsed = parseDayKey(FALL_BACK_DAY)

    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(10)
    expect(parsed.getDate()).toBe(1)
    expect(parsed.getHours()).toBe(0)
  })

  it('keeps the calendar day that parsing the key as an instant would lose', () => {
    expect(formatDayKey(parseDayKey('2026-07-05'))).toBe('2026-07-05')
    expect(formatDayKey(new Date('2026-07-05'))).toBe('2026-07-04')
  })

  it('keeps the calendar day of an api timestamp that falls on the previous local day', () => {
    expect(formatDayKey(parseDayKey('2026-07-05T00:00:00.000Z'))).toBe('2026-07-05')
    expect(formatDayKey(parseDayKey('2026-11-01T02:00:00.000Z'))).toBe(FALL_BACK_DAY)
  })
})

describe('formatDayKey', () => {
  it('keeps the local day of a late evening whose utc instant is already tomorrow', () => {
    const lateEvening = new Date(2026, 6, 5, 23, 30)

    expect(lateEvening.toISOString()).toBe('2026-07-06T03:30:00.000Z')
    expect(formatDayKey(lateEvening)).toBe('2026-07-05')
  })

  it('keeps the local day of a late evening on the fall-back day', () => {
    const lateEvening = new Date(2026, 10, 1, 23, 30)

    expect(lateEvening.toISOString()).toBe('2026-11-02T04:30:00.000Z')
    expect(formatDayKey(lateEvening)).toBe(FALL_BACK_DAY)
  })

  it('keeps the local day inside the repeated hour of the fall-back day', () => {
    expect(formatDayKey(new Date(2026, 10, 1, 1, 30))).toBe(FALL_BACK_DAY)
  })

  it('keeps the local day just after the skipped hour of the spring-forward day', () => {
    expect(formatDayKey(new Date(2026, 2, 8, 3, 30))).toBe(SPRING_FORWARD_DAY)
  })
})

describe('addDaysToDayKey', () => {
  it('advances onto the fall-back day', () => {
    expect(addDaysToDayKey('2026-10-31', 1)).toBe(FALL_BACK_DAY)
  })

  it('advances off the fall-back day instead of stopping an hour short of midnight', () => {
    expect(addDaysToDayKey(FALL_BACK_DAY, 1)).toBe('2026-11-02')
  })

  it('steps back across the fall-back', () => {
    expect(addDaysToDayKey('2026-11-02', -1)).toBe(FALL_BACK_DAY)
  })

  it('advances across the spring-forward day', () => {
    expect(addDaysToDayKey('2026-03-07', 1)).toBe(SPRING_FORWARD_DAY)
    expect(addDaysToDayKey(SPRING_FORWARD_DAY, 1)).toBe('2026-03-09')
  })

  it('steps back across the spring-forward day', () => {
    expect(addDaysToDayKey('2026-03-09', -1)).toBe(SPRING_FORWARD_DAY)
  })

  it('spans a plan week whose fourth day is the fall-back day', () => {
    expect(addDaysToDayKey(FALL_BACK_WEEK_START, 6)).toBe(FALL_BACK_WEEK_END)
    expect(addDaysToDayKey(FALL_BACK_WEEK_START, 7)).toBe('2026-11-05')
  })

  it('adds the thirty-day planning horizon from the fall-back day', () => {
    expect(addDaysToDayKey(FALL_BACK_DAY, 30)).toBe('2026-12-01')
  })

  it('normalizes a timestamp input on a transition day', () => {
    expect(addDaysToDayKey('2026-11-01T12:00:00.000Z', 1)).toBe('2026-11-02')
  })
})

describe('planDates', () => {
  it('returns seven contiguous distinct days across the fall-back', () => {
    const dates = planDates(FALL_BACK_WEEK_START)

    expect(dates).toEqual([
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04'
    ])
    expect(new Set(dates).size).toBe(7)
  })

  it('returns seven contiguous distinct days across the spring-forward', () => {
    const dates = planDates(SPRING_FORWARD_DAY)

    expect(dates).toEqual([
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
      '2026-03-12',
      '2026-03-13',
      '2026-03-14'
    ])
    expect(dates[6]).toBe(SPRING_FORWARD_WEEK_END)
    expect(new Set(dates).size).toBe(7)
  })
})

describe('dayStripLabel', () => {
  it('labels the fall-back day with its own weekday and number', () => {
    expect(dayStripLabel(FALL_BACK_DAY)).toEqual({weekday: 'Sun', dayNumber: '1'})
  })

  it('labels the last day of a week that contains the fall-back day', () => {
    expect(dayStripLabel(FALL_BACK_WEEK_END)).toEqual({weekday: 'Wed', dayNumber: '4'})
  })

  it('labels the spring-forward day with its own weekday and number', () => {
    expect(dayStripLabel(SPRING_FORWARD_DAY)).toEqual({weekday: 'Sun', dayNumber: '8'})
  })
})

describe('formatPlanDayLabel', () => {
  it('labels a transition day without shifting the month', () => {
    expect(formatPlanDayLabel(FALL_BACK_DAY)).toBe('Nov 1')
    expect(formatPlanDayLabel(SPRING_FORWARD_DAY)).toBe('Mar 8')
  })

  it('labels the first day of a week that contains the fall-back day', () => {
    expect(formatPlanDayLabel(FALL_BACK_WEEK_START)).toBe('Oct 29')
  })
})

describe('formatPlanRange', () => {
  it('renders a plan week that crosses the fall-back', () => {
    expect(formatPlanRange(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END)).toBe(`Oct 29 ${EN_DASH} Nov 4`)
  })

  it('renders a plan week that crosses the spring-forward', () => {
    expect(formatPlanRange(SPRING_FORWARD_DAY, SPRING_FORWARD_WEEK_END)).toBe(`Mar 8 ${EN_DASH} Mar 14`)
  })
})

describe('formatSlotTime', () => {
  // The helper reads the clock parts onto a January anchor precisely so this case holds: on the spring-forward
  // day a local 02:30 does not exist and normalises to 03:30, which would render the user a meal time they
  // never chose. Only a zone with a transition can catch that, so the case lives here.
  it('renders a meal time that falls inside the spring-forward gap as the time the user chose', () => {
    expect(formatSlotTime('02:30')).toBe('2:30 AM')
  })

  it('renders the plan default meal times', () => {
    expect(formatSlotTime('08:00')).toBe('8:00 AM')
    expect(formatSlotTime('12:30')).toBe('12:30 PM')
    expect(formatSlotTime('18:30')).toBe('6:30 PM')
  })
})

describe('defaultSelectedPlanDate', () => {
  it('selects the fall-back day for a now inside its repeated hour', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 1, 1, 30))).toBe(
      FALL_BACK_DAY
    )
  })

  it('selects the fall-back day for a late-evening now', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 1, 23, 30))).toBe(
      FALL_BACK_DAY
    )
  })

  it('selects the following day just after the fall-back', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 2, 0, 30))).toBe(
      '2026-11-02'
    )
  })

  it('selects the spring-forward day for a now just after its skipped hour', () => {
    expect(defaultSelectedPlanDate(SPRING_FORWARD_DAY, SPRING_FORWARD_WEEK_END, new Date(2026, 2, 8, 3, 30))).toBe(
      SPRING_FORWARD_DAY
    )
  })

  it('opens on the plan start date when the injected now sits outside the week', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 10, 12, 0))).toBe(
      FALL_BACK_WEEK_START
    )
  })
})

describe('planStartDateBounds', () => {
  it('offers tomorrow and a thirty-day horizon from a late-evening now on the fall-back day', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 10, 1, 23, 30), activePlanEndDate: null})

    expect(bounds).toEqual({min: FALL_BACK_DAY, default: '2026-11-02', max: '2026-12-01'})
  })

  it('keeps the successor week reachable when the active plan ends past the horizon', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 10, 1, 23, 30), activePlanEndDate: '2026-12-05'})

    expect(bounds.max).toBe('2026-12-06')
  })

  it('offers tomorrow and a thirty-day horizon from an early-morning now on the spring-forward day', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 2, 8, 0, 30), activePlanEndDate: null})

    expect(bounds).toEqual({min: SPRING_FORWARD_DAY, default: '2026-03-09', max: '2026-04-07'})
  })

  it('does not mutate the injected now', () => {
    const now = new Date(2026, 10, 1, 23, 30)
    const before = now.getTime()

    planStartDateBounds({now, activePlanEndDate: null})
    defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, now)

    expect(now.getTime()).toBe(before)
  })
})

describe('day stepper across a transition', () => {
  it('steps forward through the fall-back day inside the plan week', () => {
    expect(isDayKeyWithin(addDaysToDayKey(FALL_BACK_DAY, 1), FALL_BACK_WEEK_START, FALL_BACK_WEEK_END)).toBe(true)
    expect(isDayKeyWithin(addDaysToDayKey(FALL_BACK_DAY, -1), FALL_BACK_WEEK_START, FALL_BACK_WEEK_END)).toBe(true)
  })

  it('stops at the end of a week that contains the fall-back day', () => {
    const pastTheEnd = addDaysToDayKey(FALL_BACK_WEEK_END, 1)

    expect(isDayKeyWithin(pastTheEnd, FALL_BACK_WEEK_START, FALL_BACK_WEEK_END)).toBe(false)
    expect(clampDayKeyToPlan(pastTheEnd, FALL_BACK_WEEK_START, FALL_BACK_WEEK_END)).toBe(FALL_BACK_WEEK_END)
  })

  it('marks only the last day of a week that contains the fall-back day', () => {
    expect(isLastPlanDay(FALL_BACK_WEEK_END, FALL_BACK_WEEK_END)).toBe(true)
    expect(isLastPlanDay(FALL_BACK_DAY, FALL_BACK_WEEK_END)).toBe(false)
  })
})

describe('resolvePostLogViewTarget', () => {
  it('opens the diary for a meal logged on the fall-back day when now is its late evening', () => {
    expect(resolvePostLogViewTarget(FALL_BACK_DAY, formatDayKey(new Date(2026, 10, 1, 23, 30)))).toBe('diary')
  })

  it('opens history for the day before the fall-back', () => {
    expect(resolvePostLogViewTarget('2026-10-31', formatDayKey(new Date(2026, 10, 1, 23, 30)))).toBe('history')
  })
})
