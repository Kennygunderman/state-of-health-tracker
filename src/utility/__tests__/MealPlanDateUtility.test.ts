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
  planStartDateBounds
} from '../MealPlanDateUtility'

// The time-dependent helpers take `now` as a parameter, so fixtures inject it instead of faking the system clock
const PLAN_START = '2026-07-05'
const PLAN_END = '2026-07-11'
const EN_DASH = '\u2013'

// No case here depends on the runner's zone; the negative-offset and DST cases live in MealPlanDateUtility.dst.test.ts
describe('parseDayKey', () => {
  it('returns the local calendar day rather than UTC midnight', () => {
    const parsed = parseDayKey('2026-07-05')

    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(6)
    expect(parsed.getDate()).toBe(5)
  })

  it('returns local midnight, not the UTC instant the key would parse to', () => {
    expect(parseDayKey(PLAN_START).getTime()).toBe(new Date(2026, 6, 5).getTime())
  })

  it('round-trips through formatDayKey without a day shift', () => {
    expect(formatDayKey(parseDayKey('2026-07-05'))).toBe('2026-07-05')
  })

  it('round-trips the first and last day of a year', () => {
    expect(formatDayKey(parseDayKey('2026-01-01'))).toBe('2026-01-01')
    expect(formatDayKey(parseDayKey('2026-12-31'))).toBe('2026-12-31')
  })

  it('ignores a UTC-midnight time component', () => {
    expect(formatDayKey(parseDayKey('2026-07-05T00:00:00.000Z'))).toBe('2026-07-05')
  })

  it('keeps the day of a mid-afternoon api timestamp', () => {
    expect(formatDayKey(parseDayKey('2026-07-05T14:30:00.000Z'))).toBe('2026-07-05')
  })

  it('ignores a late time component', () => {
    expect(formatDayKey(parseDayKey('2026-07-05T23:59:59.000Z'))).toBe('2026-07-05')
  })

  it('uses a zero-based month index for January', () => {
    expect(parseDayKey('2026-01-31').getMonth()).toBe(0)
  })

  it('returns a fresh Date on every call, so mutating one cannot affect the next', () => {
    const first = parseDayKey(PLAN_START)
    const second = parseDayKey(PLAN_START)

    first.setDate(first.getDate() + 10)

    expect(first).not.toBe(second)
    expect(formatDayKey(second)).toBe(PLAN_START)
    expect(formatDayKey(parseDayKey(PLAN_START))).toBe(PLAN_START)
  })
})

describe('formatDayKey', () => {
  it('formats a local date as yyyy-MM-dd', () => {
    expect(formatDayKey(new Date(2026, 6, 5))).toBe('2026-07-05')
  })

  it('zero-pads single-digit months and days', () => {
    expect(formatDayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('keeps the local day for a late local time', () => {
    expect(formatDayKey(new Date(2026, 6, 5, 23, 59))).toBe('2026-07-05')
  })

  it('keeps the local day for an early local time', () => {
    expect(formatDayKey(new Date(2026, 6, 5, 0, 1))).toBe('2026-07-05')
  })

  it('does not mutate the date it is given', () => {
    const date = new Date(2026, 6, 5, 12, 30)
    const before = date.getTime()

    formatDayKey(date)

    expect(date.getTime()).toBe(before)
  })
})

describe('addDaysToDayKey', () => {
  it('advances a day within the month', () => {
    expect(addDaysToDayKey('2026-07-05', 1)).toBe('2026-07-06')
  })

  it('returns the same key for zero days', () => {
    expect(addDaysToDayKey('2026-07-05', 0)).toBe('2026-07-05')
  })

  it('spans the six days of a plan week', () => {
    expect(addDaysToDayKey(PLAN_START, 6)).toBe(PLAN_END)
  })

  it('rolls forward across a month boundary', () => {
    expect(addDaysToDayKey('2026-07-31', 1)).toBe('2026-08-01')
  })

  it('rolls forward across a year boundary', () => {
    expect(addDaysToDayKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('rolls back across a year boundary', () => {
    expect(addDaysToDayKey('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('rolls back across a month boundary', () => {
    expect(addDaysToDayKey('2026-07-01', -1)).toBe('2026-06-30')
  })

  it('produces the leap day in a leap year', () => {
    expect(addDaysToDayKey('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('skips the leap day outside a leap year', () => {
    expect(addDaysToDayKey('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('rolls back onto the leap day', () => {
    expect(addDaysToDayKey('2024-03-01', -1)).toBe('2024-02-29')
  })

  it('subtracts a full week', () => {
    expect(addDaysToDayKey('2026-07-05', -7)).toBe('2026-06-28')
  })

  it('adds the thirty-day planning horizon across a month boundary', () => {
    expect(addDaysToDayKey('2026-07-04', 30)).toBe('2026-08-03')
  })

  it('normalizes a timestamp input before adding', () => {
    expect(addDaysToDayKey('2026-07-05T12:00:00.000Z', 1)).toBe('2026-07-06')
  })
})

describe('isDayKeyWithin', () => {
  it('accepts a key inside the range', () => {
    expect(isDayKeyWithin('2026-07-08', PLAN_START, PLAN_END)).toBe(true)
  })

  it('includes the lower bound', () => {
    expect(isDayKeyWithin(PLAN_START, PLAN_START, PLAN_END)).toBe(true)
  })

  it('includes the upper bound', () => {
    expect(isDayKeyWithin(PLAN_END, PLAN_START, PLAN_END)).toBe(true)
  })

  it('rejects a key below the range', () => {
    expect(isDayKeyWithin('2026-07-04', PLAN_START, PLAN_END)).toBe(false)
  })

  it('rejects a key above the range', () => {
    expect(isDayKeyWithin('2026-07-12', PLAN_START, PLAN_END)).toBe(false)
  })

  it('handles a single-day range', () => {
    expect(isDayKeyWithin(PLAN_START, PLAN_START, PLAN_START)).toBe(true)
    expect(isDayKeyWithin('2026-07-06', PLAN_START, PLAN_START)).toBe(false)
  })

  it('compares correctly across a month boundary', () => {
    expect(isDayKeyWithin('2026-08-01', '2026-07-28', '2026-08-03')).toBe(true)
    expect(isDayKeyWithin('2026-07-27', '2026-07-28', '2026-08-03')).toBe(false)
  })

  it('compares correctly across a year boundary', () => {
    expect(isDayKeyWithin('2026-01-01', '2025-12-28', '2026-01-03')).toBe(true)
    expect(isDayKeyWithin('2025-12-27', '2025-12-28', '2026-01-03')).toBe(false)
  })

  it('drives a stepper that cannot leave the plan week', () => {
    expect(isDayKeyWithin(addDaysToDayKey(PLAN_END, 1), PLAN_START, PLAN_END)).toBe(false)
    expect(isDayKeyWithin(addDaysToDayKey(PLAN_START, -1), PLAN_START, PLAN_END)).toBe(false)
    expect(isDayKeyWithin(addDaysToDayKey('2026-07-08', 1), PLAN_START, PLAN_END)).toBe(true)
    expect(isDayKeyWithin(addDaysToDayKey('2026-07-08', -1), PLAN_START, PLAN_END)).toBe(true)
  })
})

describe('planDates', () => {
  it('returns exactly seven days', () => {
    expect(planDates(PLAN_START)).toHaveLength(7)
  })

  it('starts on the plan start date and ends six days later', () => {
    const dates = planDates(PLAN_START)

    expect(dates[0]).toBe(PLAN_START)
    expect(dates[6]).toBe(PLAN_END)
  })

  it('returns contiguous ascending days', () => {
    expect(planDates(PLAN_START)).toEqual([
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11'
    ])
  })

  it('returns seven distinct days', () => {
    expect(new Set(planDates(PLAN_START)).size).toBe(7)
  })

  it('spans a month boundary', () => {
    expect(planDates('2026-07-29')).toEqual([
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04'
    ])
  })

  it('spans a year boundary', () => {
    const dates = planDates('2026-12-28')

    expect(dates[0]).toBe('2026-12-28')
    expect(dates[6]).toBe('2027-01-03')
  })

  it('includes the leap day', () => {
    const dates = planDates('2024-02-26')

    expect(dates).toContain('2024-02-29')
    expect(dates[6]).toBe('2024-03-03')
  })

  it('normalizes a timestamp start date', () => {
    expect(planDates('2026-07-05T00:00:00.000Z')[0]).toBe(PLAN_START)
  })
})

describe('dayStripLabel', () => {
  it('labels the first day of the plan week', () => {
    expect(dayStripLabel(PLAN_START)).toEqual({weekday: 'Sun', dayNumber: '5'})
  })

  it('labels the last day of the plan week', () => {
    expect(dayStripLabel(PLAN_END)).toEqual({weekday: 'Sat', dayNumber: '11'})
  })

  it('labels the second day of the plan week', () => {
    expect(dayStripLabel('2026-07-06')).toEqual({weekday: 'Mon', dayNumber: '6'})
  })

  it('returns the weekday in natural case, leaving uppercasing to the style layer', () => {
    const label = dayStripLabel(PLAN_START)

    expect(label.weekday).toBe('Sun')
    expect(label.weekday).not.toBe('SUN')
  })

  it('returns an unpadded day number as a string', () => {
    expect(dayStripLabel(PLAN_START).dayNumber).toBe('5')
    expect(dayStripLabel(PLAN_END).dayNumber).toBe('11')
  })

  it('ignores a time component', () => {
    expect(dayStripLabel('2026-07-05T23:59:00.000Z')).toEqual({weekday: 'Sun', dayNumber: '5'})
  })
})

describe('formatPlanDayLabel', () => {
  it('formats an abbreviated month and unpadded day', () => {
    expect(formatPlanDayLabel('2026-07-05')).toBe('Jul 5')
  })

  it('formats a double-digit day', () => {
    expect(formatPlanDayLabel('2026-07-11')).toBe('Jul 11')
  })

  it('formats the first day of a year', () => {
    expect(formatPlanDayLabel('2026-01-01')).toBe('Jan 1')
  })

  it('omits the year for a day in the following year', () => {
    expect(formatPlanDayLabel('2027-01-03')).toBe('Jan 3')
  })

  it('formats the last day of a year', () => {
    expect(formatPlanDayLabel('2026-12-25')).toBe('Dec 25')
  })

  it('ignores a time component', () => {
    expect(formatPlanDayLabel('2026-07-05T23:59:00.000Z')).toBe('Jul 5')
  })
})

describe('formatPlanRange', () => {
  it('joins the plan bounds with an en dash', () => {
    expect(formatPlanRange(PLAN_START, PLAN_END)).toBe(`Jul 5 ${EN_DASH} Jul 11`)
  })

  it('uses an en dash rather than a hyphen or a minus sign', () => {
    const range = formatPlanRange(PLAN_START, PLAN_END)

    expect(range).toContain(EN_DASH)
    expect(range).not.toContain('-')
    expect(range).not.toContain('\u2212')
  })

  it('separates the two labels with the en dash code point', () => {
    const separator = formatPlanRange(PLAN_START, PLAN_END).split(' ')[2]

    expect(separator.codePointAt(0)).toBe(0x2013)
  })

  it('formats a range spanning two months', () => {
    expect(formatPlanRange('2026-07-29', '2026-08-04')).toBe(`Jul 29 ${EN_DASH} Aug 4`)
  })

  it('formats a range spanning two years', () => {
    expect(formatPlanRange('2026-12-28', '2027-01-03')).toBe(`Dec 28 ${EN_DASH} Jan 3`)
  })

  it('formats a single-day range', () => {
    expect(formatPlanRange(PLAN_START, PLAN_START)).toBe(`Jul 5 ${EN_DASH} Jul 5`)
  })
})

describe('formatSlotTime', () => {
  it('formats the default meal times without padding the hour', () => {
    expect(formatSlotTime('08:00')).toBe('8:00 AM')
    expect(formatSlotTime('12:30')).toBe('12:30 PM')
    expect(formatSlotTime('15:30')).toBe('3:30 PM')
    expect(formatSlotTime('18:30')).toBe('6:30 PM')
  })

  it('formats both ends of the clock', () => {
    expect(formatSlotTime('00:00')).toBe('12:00 AM')
    expect(formatSlotTime('00:15')).toBe('12:15 AM')
    expect(formatSlotTime('12:00')).toBe('12:00 PM')
    expect(formatSlotTime('23:59')).toBe('11:59 PM')
  })

  it('accepts an unpadded hour and surrounding whitespace', () => {
    expect(formatSlotTime('7:05')).toBe('7:05 AM')
    expect(formatSlotTime(' 18:30 ')).toBe('6:30 PM')
  })

  it('formats a time inside a spring-forward hour rather than shifting it', () => {
    expect(formatSlotTime('02:30')).toBe('2:30 AM')
  })

  it('returns a value that is not a clock time unchanged', () => {
    expect(formatSlotTime('')).toBe('')
    expect(formatSlotTime('24:00')).toBe('24:00')
    expect(formatSlotTime('12:60')).toBe('12:60')
    expect(formatSlotTime('noon')).toBe('noon')
    expect(formatSlotTime('8:00 AM')).toBe('8:00 AM')
    expect(formatSlotTime('2026-07-05T08:00')).toBe('2026-07-05T08:00')
  })
})

describe('defaultSelectedPlanDate', () => {
  it('selects today when today falls inside the plan week', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 8, 13, 0))).toBe('2026-07-08')
  })

  it('selects the start date when today is before the plan week', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 1))).toBe(PLAN_START)
  })

  it('selects the start date when today is after the plan week', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 20))).toBe(PLAN_START)
  })

  it('selects the first day when today is the first day', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 5, 8, 0))).toBe(PLAN_START)
  })

  it('selects the last day when today is the last day', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 11, 18, 30))).toBe(PLAN_END)
  })

  it('keeps the last day for a late-evening now on the last day', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 11, 23, 30))).toBe(PLAN_END)
  })

  it('uses the local day for a late-evening now', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 9, 23, 59))).toBe('2026-07-09')
  })

  it('selects the start date the day before the week begins', () => {
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, new Date(2026, 6, 4, 23, 59))).toBe(PLAN_START)
  })
})

describe('clampDayKeyToPlan', () => {
  it('clamps a key below the week up to the start date', () => {
    expect(clampDayKeyToPlan('2026-07-01', PLAN_START, PLAN_END)).toBe(PLAN_START)
    expect(clampDayKeyToPlan('2026-07-04', PLAN_START, PLAN_END)).toBe(PLAN_START)
  })

  it('clamps a key above the week down to the end date', () => {
    expect(clampDayKeyToPlan('2026-07-20', PLAN_START, PLAN_END)).toBe(PLAN_END)
  })

  it('leaves a key inside the week untouched', () => {
    expect(clampDayKeyToPlan('2026-07-08', PLAN_START, PLAN_END)).toBe('2026-07-08')
  })

  it('leaves the bounds themselves untouched', () => {
    expect(clampDayKeyToPlan(PLAN_START, PLAN_START, PLAN_END)).toBe(PLAN_START)
    expect(clampDayKeyToPlan(PLAN_END, PLAN_START, PLAN_END)).toBe(PLAN_END)
  })

  it('clamps across month and year boundaries', () => {
    expect(clampDayKeyToPlan('2025-12-31', PLAN_START, PLAN_END)).toBe(PLAN_START)
    expect(clampDayKeyToPlan('2027-01-01', PLAN_START, PLAN_END)).toBe(PLAN_END)
  })
})

describe('isLastPlanDay', () => {
  it('is true on the last day of the plan', () => {
    expect(isLastPlanDay(PLAN_END, PLAN_END)).toBe(true)
  })

  it('is false on the day before the last day', () => {
    expect(isLastPlanDay('2026-07-10', PLAN_END)).toBe(false)
  })

  it('is false on the first day of the plan', () => {
    expect(isLastPlanDay(PLAN_START, PLAN_END)).toBe(false)
  })

  it('is false after the plan has ended', () => {
    expect(isLastPlanDay('2026-07-12', PLAN_END)).toBe(false)
  })

  it('tolerates a timestamp form on either side', () => {
    expect(isLastPlanDay('2026-07-11T00:00:00.000Z', PLAN_END)).toBe(true)
    expect(isLastPlanDay(PLAN_END, '2026-07-11T23:59:59.000Z')).toBe(true)
  })

  it('is false for the same day number in a different month', () => {
    expect(isLastPlanDay('2026-06-11', PLAN_END)).toBe(false)
  })

  it('is false for the same day number in a different year', () => {
    expect(isLastPlanDay('2025-07-11', PLAN_END)).toBe(false)
  })
})

describe('planStartDateBounds', () => {
  it('offers today, tomorrow and a thirty-day horizon when no plan is active', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: null})

    expect(bounds).toEqual({min: '2026-07-04', default: '2026-07-05', max: '2026-08-03'})
  })

  it('extends the maximum so the successor week of a later plan stays reachable', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: '2026-08-20'})

    expect(bounds.max).toBe('2026-08-21')
  })

  it('keeps the thirty-day horizon when the active plan ends sooner', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: PLAN_END})

    expect(bounds.max).toBe('2026-08-03')
  })

  it('keeps the horizon when the successor week falls exactly on it', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: '2026-08-02'})

    expect(bounds.max).toBe('2026-08-03')
  })

  it('takes the successor week when it falls one day past the horizon', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: '2026-08-03'})

    expect(bounds.max).toBe('2026-08-04')
  })

  it('uses the local day of a mid-evening now', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4, 22, 45), activePlanEndDate: null})

    expect(bounds.min).toBe('2026-07-04')
  })

  it('rolls the default and the horizon across a year boundary', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 11, 31), activePlanEndDate: null})

    expect(bounds).toEqual({min: '2026-12-31', default: '2027-01-01', max: '2027-01-30'})
  })

  it('normalizes a timestamp plan end date', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: '2026-08-20T00:00:00.000Z'})

    expect(bounds.max).toBe('2026-08-21')
  })

  it('always offers a default exactly one day after the minimum', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 1, 28), activePlanEndDate: null})

    expect(addDaysToDayKey(bounds.min, 1)).toBe(bounds.default)
  })

  it('always keeps the default inside the selectable range', () => {
    const bounds = planStartDateBounds({now: new Date(2026, 6, 4), activePlanEndDate: '2026-08-20'})

    expect(isDayKeyWithin(bounds.default, bounds.min, bounds.max)).toBe(true)
  })

  it('leaves the minimum and the default unaffected by the active plan', () => {
    const now = new Date(2026, 6, 4)
    const laterPlan = planStartDateBounds({now, activePlanEndDate: '2026-08-20'})
    const tiedPlan = planStartDateBounds({now, activePlanEndDate: '2026-08-02'})
    const earlierPlan = planStartDateBounds({now, activePlanEndDate: PLAN_END})

    expect(laterPlan.min).toBe('2026-07-04')
    expect(laterPlan.default).toBe('2026-07-05')
    expect(tiedPlan.min).toBe('2026-07-04')
    expect(tiedPlan.default).toBe('2026-07-05')
    expect(earlierPlan.min).toBe('2026-07-04')
    expect(earlierPlan.default).toBe('2026-07-05')
  })
})

describe('injected now', () => {
  it('is never mutated by the helpers that read it', () => {
    const now = new Date(2026, 6, 8, 13, 0)
    const before = now.getTime()

    defaultSelectedPlanDate(PLAN_START, PLAN_END, now)
    planStartDateBounds({now, activePlanEndDate: PLAN_END})

    expect(now.getTime()).toBe(before)
    expect(defaultSelectedPlanDate(PLAN_START, PLAN_END, now)).toBe('2026-07-08')
    expect(planStartDateBounds({now, activePlanEndDate: null}).min).toBe('2026-07-08')
  })
})
