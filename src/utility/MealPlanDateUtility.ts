import {addDays, format} from 'date-fns'

import {compareIsoDateStrings} from './DateUtility'

const DAY_KEY_FORMAT = 'yyyy-MM-dd'
const DAY_STRIP_WEEKDAY_FORMAT = 'EEE'
const DAY_STRIP_NUMBER_FORMAT = 'd'
const PLAN_DAY_FORMAT = 'MMM d'
const PLAN_RANGE_SEPARATOR = '\u2013'
const PLAN_DAY_COUNT = 7
const PLAN_START_MAX_DAYS_AHEAD = 30
const SLOT_TIME_FORMAT = 'h:mm a'
const SLOT_TIME_PATTERN = /^(\d{1,2}):([0-5]\d)$/
const SLOT_TIME_MAX_HOUR = 23
const SLOT_TIME_ANCHOR_YEAR = 2000

export interface DayStripLabel {
  weekday: string
  dayNumber: string
}

export interface PlanStartDateBounds {
  min: string
  default: string
  max: string
}

interface PlanStartDateBoundsParams {
  now: Date
  activePlanEndDate: string | null
}

// Builds the date from its parts so 'yyyy-MM-dd' isn't parsed as UTC midnight,
// which would yield the previous calendar day in UTC+ timezones
export const parseDayKey = (dayKey: string): Date => {
  const [year, month, day] = dayKey.split('T')[0].split('-').map(Number)

  return new Date(year, month - 1, day)
}

export const formatDayKey = (date: Date): string => format(date, DAY_KEY_FORMAT)

export const addDaysToDayKey = (dayKey: string, days: number): string =>
  formatDayKey(addDays(parseDayKey(dayKey), days))

/**
 * Inclusive range check. 'yyyy-MM-dd' is fixed-width and zero-padded, so lexicographic order is calendar order:
 * comparing the keys as strings keeps every range check timezone-proof without constructing a Date.
 *
 * A day stepper's affordances compose from it — forward is `isDayKeyWithin(addDaysToDayKey(current, 1), min, max)`
 * and back is `isDayKeyWithin(addDaysToDayKey(current, -1), min, max)`.
 */
export const isDayKeyWithin = (dayKey: string, minDayKey: string, maxDayKey: string): boolean =>
  dayKey >= minDayKey && dayKey <= maxDayKey

export const planDates = (startDate: string): string[] =>
  Array.from({length: PLAN_DAY_COUNT}, (_, index) => addDaysToDayKey(startDate, index))

export const dayStripLabel = (dayKey: string): DayStripLabel => {
  const date = parseDayKey(dayKey)

  return {weekday: format(date, DAY_STRIP_WEEKDAY_FORMAT), dayNumber: format(date, DAY_STRIP_NUMBER_FORMAT)}
}

export const formatPlanDayLabel = (dayKey: string): string => format(parseDayKey(dayKey), PLAN_DAY_FORMAT)

export const formatPlanRange = (startDate: string, endDate: string): string =>
  `${formatPlanDayLabel(startDate)} ${PLAN_RANGE_SEPARATOR} ${formatPlanDayLabel(endDate)}`

/**
 * A stored meal time ('08:00', '12:30') as the plan surfaces render it ('8:00 AM', '12:30 PM').
 * A value that is not a 24-hour clock time is returned unchanged, so a malformed one reads as
 * itself rather than as an empty label or 'Invalid Date'.
 */
export const formatSlotTime = (time: string): string => {
  const match = SLOT_TIME_PATTERN.exec(time.trim())

  if (match === null) {
    return time
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours > SLOT_TIME_MAX_HOUR) {
    return time
  }

  // A meal time carries no calendar day, so the clock parts are read onto a January anchor: no zone
  // shifts its clock then, whereas on a spring-forward day a missing local 02:30 normalises to 03:30
  return format(new Date(SLOT_TIME_ANCHOR_YEAR, 0, 1, hours, minutes), SLOT_TIME_FORMAT)
}

export const defaultSelectedPlanDate = (startDate: string, endDate: string, now: Date): string => {
  const todayKey = formatDayKey(now)

  return isDayKeyWithin(todayKey, startDate, endDate) ? todayKey : startDate
}

export const clampDayKeyToPlan = (dayKey: string, startDate: string, endDate: string): string => {
  if (dayKey < startDate) return startDate

  if (dayKey > endDate) return endDate

  return dayKey
}

export const isLastPlanDay = (dayKey: string, endDate: string): boolean => compareIsoDateStrings(dayKey, endDate)

export const planStartDateBounds = ({now, activePlanEndDate}: PlanStartDateBoundsParams): PlanStartDateBounds => {
  const todayKey = formatDayKey(now)
  const horizonKey = addDaysToDayKey(todayKey, PLAN_START_MAX_DAYS_AHEAD)
  const successorWeekKey = activePlanEndDate === null ? null : addDaysToDayKey(activePlanEndDate, 1)

  return {
    min: todayKey,
    default: addDaysToDayKey(todayKey, 1),
    max: successorWeekKey !== null && successorWeekKey > horizonKey ? successorWeekKey : horizonKey
  }
}
