import {MealSchedule, MealTimeEntry} from '@data/models/MealPlanPreferences'
import {MealSlot, RecipeIconKey} from '@data/models/Recipe'
import {Sizes, Stroke} from '@styles/sizes'

import {PickerItem} from '@components/Picker'

import {
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_TIME_AM_SUFFIX,
  MEAL_PLAN_TIME_PM_SUFFIX
} from '@constants/strings'

export const PICKER_MINUTE_STEP = 15

// Figma strokes the 18 px slot glyphs (47:526, 47:538, 47:549) at 1.35 px, heavier than the 1.2 px the
// same marks carry elsewhere, so the schedule rows must override the icons' default. The glyphs declare
// their paths in a 24-unit viewBox that MealIconTile renders into 18 px, and strokeWidth is in viewBox
// units, so the token is pre-scaled to the viewBox exactly as HeroPotIcon's POT_CARD_STROKE is. Passing
// Stroke.MEAL_GLYPH_TILE raw would render 1.0125 px.
export const SLOT_ICON_STROKE_WIDTH: number = (Stroke.MEAL_GLYPH_TILE * Sizes.ICON_XL) / Sizes.ICON

const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const HOURS_PER_MERIDIEM = 12
const TIME_PART_DIGITS = 2
const TIME_PART_PAD = '0'
const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const UNKNOWN_TIME_LABEL = ''
const UNSET_TIME_VALUE = ''

const PICKER_OPTION_COUNT = (HOURS_PER_DAY * MINUTES_PER_HOUR) / PICKER_MINUTE_STEP

// Wire order, which the server validates: breakfast, lunch, dinner, then the snack when the schedule
// has one. The arrays are frozen because they are handed straight to callers.
const SCHEDULE_SLOTS: Record<MealSchedule, readonly MealSlot[]> = {
  three: Object.freeze(['breakfast', 'lunch', 'dinner'] as const),
  three_plus_snack: Object.freeze(['breakfast', 'lunch', 'dinner', 'snack'] as const)
}

const NO_SLOTS: readonly MealSlot[] = Object.freeze([] as const)

const SLOT_ICON_KEYS: Record<MealSlot, RecipeIconKey> = {
  breakfast: 'crosshair',
  lunch: 'bowl',
  dinner: 'fork_knife',
  snack: 'bowl_dash'
}

const padTimePart = (value: number): string => String(value).padStart(TIME_PART_DIGITS, TIME_PART_PAD)

const timeValueFromMinutes = (minutesFromMidnight: number): string => {
  const hours = Math.floor(minutesFromMidnight / MINUTES_PER_HOUR)
  const minutes = minutesFromMidnight % MINUTES_PER_HOUR

  return `${padTimePart(hours)}:${padTimePart(minutes)}`
}

export const mealSlotsForSchedule = (schedule: MealSchedule | null): readonly MealSlot[] =>
  schedule ? SCHEDULE_SLOTS[schedule] : NO_SLOTS

export const mealSlotIconKey = (slot: MealSlot): RecipeIconKey => SLOT_ICON_KEYS[slot]

export const formatMealTimeLabel = (time: string): string => {
  const parts = TIME_VALUE_PATTERN.exec(time)

  if (!parts) return UNKNOWN_TIME_LABEL

  const hourOfDay = Number(parts[1])
  const minutes = parts[2]
  const hourOfMeridiem = hourOfDay % HOURS_PER_MERIDIEM
  const hour = hourOfMeridiem === 0 ? HOURS_PER_MERIDIEM : hourOfMeridiem
  const meridiem = hourOfDay < HOURS_PER_MERIDIEM ? MEAL_PLAN_TIME_AM_SUFFIX : MEAL_PLAN_TIME_PM_SUFFIX

  return `${hour}:${minutes} ${meridiem}`
}

export const buildMealTimePickerItems = (): PickerItem[] =>
  Array.from({length: PICKER_OPTION_COUNT}, (_unused, index) => {
    const value = timeValueFromMinutes(index * PICKER_MINUTE_STEP)

    return {label: formatMealTimeLabel(value), value}
  })

// One entry per slot of the chosen schedule and nothing else: dropping a slot the draft has no time for
// would silently plan a meal with no time, so an unseeded slot carries an empty time the server rejects.
export const buildMealTimesPayload = (schedule: MealSchedule, mealTimes: readonly MealTimeEntry[]): MealTimeEntry[] =>
  mealSlotsForSchedule(schedule).map(slot => ({
    slot,
    time: mealTimes.find(entry => entry.slot === slot)?.time ?? UNSET_TIME_VALUE
  }))

export const validateMealScheduleStep = (schedule: MealSchedule | null): string | null =>
  schedule ? null : MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT
