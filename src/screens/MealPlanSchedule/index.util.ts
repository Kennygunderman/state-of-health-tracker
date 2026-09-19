import {MEAL_SLOTS_BY_SCHEDULE, MealSchedule, MealTimeEntry} from '@data/models/MealPlanPreferences'
import {MealSlot, RecipeIconKey} from '@data/models/Recipe'
import {Sizes, Stroke} from '@styles/sizes'
import {formatSlotTime} from '@utility/MealPlanDateUtility'

import {PickerItem} from '@components/Picker'

import {MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT, MEAL_PLAN_TIME_PICKER_PLACEHOLDER} from '@constants/strings'

export const PICKER_MINUTE_STEP = 15

// Figma strokes the 18 px slot glyphs (47:526, 47:538, 47:549) at 1.35 px, heavier than the 1.2 px the
// same marks carry elsewhere, so the schedule rows must override the icons' default. The glyphs declare
// their paths in a 24-unit viewBox that MealIconTile renders into 18 px, and strokeWidth is in viewBox
// units, so the token is pre-scaled to the viewBox exactly as HeroPotIcon's POT_CARD_STROKE is. Passing
// Stroke.MEAL_GLYPH_TILE raw would render 1.0125 px.
export const SLOT_ICON_STROKE_WIDTH: number = (Stroke.MEAL_GLYPH_TILE * Sizes.ICON_XL) / Sizes.ICON

const HOURS_PER_DAY = 24
const MINUTES_PER_HOUR = 60
const TIME_PART_DIGITS = 2
const TIME_PART_PAD = '0'
const UNSET_TIME_VALUE = ''

const PICKER_OPTION_COUNT = (HOURS_PER_DAY * MINUTES_PER_HOUR) / PICKER_MINUTE_STEP

const NO_SLOTS: readonly MealSlot[] = Object.freeze([] as const)

// Which schedule's rows the card borrows while none is chosen: the three-meal day, so the snack row is the
// one thing choosing 'three_plus_snack' adds and the dashed placeholder explains it until then.
const UNCHOSEN_SCHEDULE_CARD_SHAPE: MealSchedule = 'three'

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

// The slots of a schedule in wire order — breakfast, lunch, dinner, then the snack when the schedule has one —
// read from the table @data/models/MealPlanPreferences owns, so the payload this screen builds and the draft the
// setup provider holds can never disagree about which slots a schedule plans.
export const mealSlotsForSchedule = (schedule: MealSchedule | null): readonly MealSlot[] =>
  schedule ? MEAL_SLOTS_BY_SCHEDULE[schedule] : NO_SLOTS

// The rows the "Usual times" card shows, which is not the same question as which slots a schedule plans.
// Frame 47:471 draws the card and the dashed snack placeholder on a screen with no schedule chosen, and
// AAP 0.7.4 opens this step with nothing selected, so the card is on screen from first entry: it is the
// affordance that shows what the day looks like and, through the placeholder, what the snack option would
// add — both of which have to be legible before the option is picked. A chosen schedule therefore only
// adds or removes the snack row, and the unchosen state borrows the three-meal day's rows rather than
// naming its own list, so this can never disagree with MEAL_SLOTS_BY_SCHEDULE about the main slots.
export const mealSlotsForScheduleCard = (schedule: MealSchedule | null): readonly MealSlot[] =>
  mealSlotsForSchedule(schedule ?? UNCHOSEN_SCHEDULE_CARD_SHAPE)

// What a time pill reads before its slot has a time. Times are seeded only when a schedule is chosen
// (0.7.4), and AAP 0.1.2 forbids showing the mockup's times as answers the user already gave, so an
// unseeded pill states the action it offers instead of rendering an empty pill or a borrowed time. It is
// the same sentence the picker this pill opens uses as its own placeholder, so the two cannot diverge.
export const mealTimePillLabel = (time: string): string =>
  time.trim() === UNSET_TIME_VALUE ? MEAL_PLAN_TIME_PICKER_PLACEHOLDER : formatSlotTime(time)

export const mealSlotIconKey = (slot: MealSlot): RecipeIconKey => SLOT_ICON_KEYS[slot]

// Labelled through the shared formatter the time pills, the review row and the plan settings row already use,
// so a picker option and the pill it fills can never render the same stored time differently.
export const buildMealTimePickerItems = (): PickerItem[] =>
  Array.from({length: PICKER_OPTION_COUNT}, (_unused, index) => {
    const value = timeValueFromMinutes(index * PICKER_MINUTE_STEP)

    return {label: formatSlotTime(value), value}
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
