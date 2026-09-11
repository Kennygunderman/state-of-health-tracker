/**
 * @jest-environment <rootDir>/src/testSupport/dstTimeZoneEnvironment.ts
 *
 * The companion suite runs in the runner's own zone, which is UTC and therefore has no transition to
 * cross. This one is pinned to America/New_York by the environment above, where the fall-back on
 * 2026-11-01 makes a local day 25 hours long: a helper that advanced by a fixed 24 hours, or that
 * parsed a day key as UTC midnight, would return the wrong calendar day and fail here.
 */
import {
  addDaysToDayKey,
  defaultSelectedPlanDate,
  formatDayKey,
  parseDayKey,
  planDates,
  planStartDateBounds
} from '../MealPlanDateUtility'

const FALL_BACK_WEEK_START = '2026-10-29'
const FALL_BACK_WEEK_END = '2026-11-04'
const SPRING_FORWARD_WEEK_START = '2026-03-08'
const SPRING_FORWARD_WEEK_END = '2026-03-14'
const EST_OFFSET_MINUTES = 300
const EDT_OFFSET_MINUTES = 240
const FIXED_DAY_MS = 24 * 60 * 60 * 1000

describe('daylight saving fixture', () => {
  it('runs in a zone whose offset changes across the year', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
  })

  it('places the fall-back transition between the first and the second of November 2026', () => {
    expect(new Date(2026, 10, 1).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
    expect(new Date(2026, 10, 2).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
  })

  it('places the spring-forward transition between the seventh and the ninth of March 2026', () => {
    expect(new Date(2026, 2, 7).getTimezoneOffset()).toBe(EST_OFFSET_MINUTES)
    expect(new Date(2026, 2, 9).getTimezoneOffset()).toBe(EDT_OFFSET_MINUTES)
  })

  it('would lose a day here if a helper advanced by a fixed twenty-four hours', () => {
    const fixedDayLater = new Date(parseDayKey('2026-11-01').getTime() + FIXED_DAY_MS)

    expect(formatDayKey(fixedDayLater)).toBe('2026-11-01')
    expect(fixedDayLater.getHours()).toBe(23)
  })
})

describe('addDaysToDayKey', () => {
  it('advances onto the fall-back day', () => {
    expect(addDaysToDayKey('2026-10-31', 1)).toBe('2026-11-01')
  })

  it('advances off the fall-back day instead of stopping an hour short of midnight', () => {
    expect(addDaysToDayKey('2026-11-01', 1)).toBe('2026-11-02')
  })

  it('steps back across the fall-back', () => {
    expect(addDaysToDayKey('2026-11-02', -1)).toBe('2026-11-01')
  })

  it('spans a plan week whose fourth day is the fall-back day', () => {
    expect(addDaysToDayKey(FALL_BACK_WEEK_START, 6)).toBe(FALL_BACK_WEEK_END)
    expect(addDaysToDayKey(FALL_BACK_WEEK_START, 7)).toBe('2026-11-05')
  })

  it('adds the thirty-day planning horizon from the fall-back day', () => {
    expect(addDaysToDayKey('2026-11-01', 30)).toBe('2026-12-01')
  })

  it('advances across the spring-forward day', () => {
    expect(addDaysToDayKey('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDaysToDayKey('2026-03-08', 1)).toBe('2026-03-09')
  })

  it('steps back across the spring-forward day', () => {
    expect(addDaysToDayKey('2026-03-09', -1)).toBe('2026-03-08')
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
    const dates = planDates(SPRING_FORWARD_WEEK_START)

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

describe('planStartDateBounds', () => {
  it('offers tomorrow and a thirty-day horizon from a late-evening now on the fall-back day', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 10, 1, 23, 30), activePlanEndDate: null})

    expect(bounds).toEqual({min: '2026-11-01', default: '2026-11-02', max: '2026-12-01'})
  })

  it('keeps the successor week reachable when the active plan ends past the horizon', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 10, 1, 23, 30), activePlanEndDate: '2026-12-05'})

    expect(bounds.max).toBe('2026-12-06')
  })

  it('offers tomorrow and a thirty-day horizon from an early-morning now on the spring-forward day', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 2, 8, 0, 30), activePlanEndDate: null})

    expect(bounds).toEqual({min: '2026-03-08', default: '2026-03-09', max: '2026-04-07'})
  })
})

describe('defaultSelectedPlanDate', () => {
  it('selects the fall-back day itself for a now inside its repeated hour', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 1, 1, 30))).toBe(
      '2026-11-01'
    )
  })

  it('selects the fall-back day for a late-evening now', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 1, 23, 30))).toBe(
      '2026-11-01'
    )
  })

  it('selects the following day just after the fall-back', () => {
    expect(defaultSelectedPlanDate(FALL_BACK_WEEK_START, FALL_BACK_WEEK_END, new Date(2026, 10, 2, 0, 30))).toBe(
      '2026-11-02'
    )
  })

  it('selects the spring-forward day for a now just after its skipped hour', () => {
    expect(
      defaultSelectedPlanDate(SPRING_FORWARD_WEEK_START, SPRING_FORWARD_WEEK_END, new Date(2026, 2, 8, 3, 30))
    ).toBe('2026-03-08')
  })
})

describe('parseDayKey', () => {
  it('builds local midnight rather than UTC midnight in a negative-offset zone', () => {
    expect(parseDayKey('2026-07-05').getTime()).toBe(Date.UTC(2026, 6, 5, 4))
    expect(parseDayKey('2026-11-01').getTime()).toBe(Date.UTC(2026, 10, 1, 4))
    expect(parseDayKey('2026-01-05').getTime()).toBe(Date.UTC(2026, 0, 5, 5))
  })

  it('keeps the calendar day that parsing the key as an instant would lose', () => {
    expect(formatDayKey(parseDayKey('2026-07-05'))).toBe('2026-07-05')
    expect(formatDayKey(new Date('2026-07-05'))).toBe('2026-07-04')
  })

  it('keeps the calendar day of an api timestamp that falls on the previous local day', () => {
    expect(formatDayKey(parseDayKey('2026-07-05T00:00:00.000Z'))).toBe('2026-07-05')
    expect(formatDayKey(parseDayKey('2026-11-01T02:00:00.000Z'))).toBe('2026-11-01')
  })
})
