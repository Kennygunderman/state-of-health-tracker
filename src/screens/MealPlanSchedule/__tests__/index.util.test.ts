import {MealTimeEntry} from '@data/models/MealPlanPreferences'
import {formatSlotTime} from '@utility/MealPlanDateUtility'

import {MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT} from '@constants/strings'

import {
  buildMealTimePickerItems,
  buildMealTimesPayload,
  mealSlotIconKey,
  mealSlotsForSchedule,
  PICKER_MINUTE_STEP,
  validateMealScheduleStep
} from '../index.util'

const makeMealTimes = (): MealTimeEntry[] => [
  {slot: 'breakfast', time: '08:00'},
  {slot: 'lunch', time: '12:30'},
  {slot: 'snack', time: '15:30'},
  {slot: 'dinner', time: '18:30'}
]

const makeMealTimesWithoutSnack = (): MealTimeEntry[] => [
  {slot: 'breakfast', time: '08:00'},
  {slot: 'lunch', time: '12:30'},
  {slot: 'dinner', time: '18:30'}
]

describe('mealSlotsForSchedule', () => {
  it('derives the three main slots in wire order', () => {
    expect(mealSlotsForSchedule('three')).toEqual(['breakfast', 'lunch', 'dinner'])
  })

  it('appends the snack after dinner rather than at its time of day', () => {
    expect(mealSlotsForSchedule('three_plus_snack')).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('derives no slots until the user has picked a schedule', () => {
    expect(mealSlotsForSchedule(null)).toEqual([])
  })
})

describe('buildMealTimesPayload', () => {
  it('emits exactly one entry per slot of the schedule, in wire order', () => {
    expect(buildMealTimesPayload('three_plus_snack', makeMealTimes())).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'},
      {slot: 'snack', time: '15:30'}
    ])
  })

  it('accepts a snack scheduled before dinner and sends the times exactly as given', () => {
    const payload = buildMealTimesPayload('three_plus_snack', makeMealTimes())

    expect(payload.map(entry => entry.time)).toEqual(['08:00', '12:30', '18:30', '15:30'])
  })

  it('never sorts by time, so times running backwards across the slots survive untouched', () => {
    const backwards: MealTimeEntry[] = [
      {slot: 'breakfast', time: '21:00'},
      {slot: 'lunch', time: '14:00'},
      {slot: 'dinner', time: '06:00'}
    ]

    expect(buildMealTimesPayload('three', backwards)).toEqual(backwards)
  })

  it('does not mutate the meal times it is given', () => {
    const mealTimes = makeMealTimes()

    buildMealTimesPayload('three', mealTimes)

    expect(mealTimes).toEqual(makeMealTimes())
  })

  describe('when the chosen schedule changes', () => {
    it('adds a snack entry as soon as the schedule has one, leaving its time unset', () => {
      expect(buildMealTimesPayload('three_plus_snack', makeMealTimesWithoutSnack())).toEqual([
        {slot: 'breakfast', time: '08:00'},
        {slot: 'lunch', time: '12:30'},
        {slot: 'dinner', time: '18:30'},
        {slot: 'snack', time: ''}
      ])
    })

    it('drops the snack entry when the schedule loses it and leaves the other three intact', () => {
      expect(buildMealTimesPayload('three', makeMealTimes())).toEqual(makeMealTimesWithoutSnack())
    })
  })
})

describe('buildMealTimePickerItems', () => {
  it('offers one option per step across the whole day', () => {
    expect(buildMealTimePickerItems()).toHaveLength((24 * 60) / PICKER_MINUTE_STEP)
  })

  it('starts at midnight and ends at the last step before it', () => {
    const items = buildMealTimePickerItems()

    expect(items[0].value).toBe('00:00')
    expect(items[1].value).toBe('00:15')
    expect(items[items.length - 1].value).toBe('23:45')
  })

  it('offers every option as a zero-padded value the server accepts', () => {
    const items = buildMealTimePickerItems()

    expect(items.filter(item => !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.value))).toEqual([])
  })

  it('labels every option through the shared slot-time formatter, so the option and the pill it fills agree', () => {
    const items = buildMealTimePickerItems()

    expect(items.filter(item => item.label !== formatSlotTime(item.value))).toEqual([])
  })

  // The picker is where a user reads a time before choosing it, so its own labels are pinned here rather
  // than left to the shared formatter's suite alone
  it('reads midnight and noon as twelve and drops the hour of the leading zero', () => {
    const labelFor = (value: string): string | undefined =>
      buildMealTimePickerItems().find(item => item.value === value)?.label

    expect(labelFor('00:00')).toBe('12:00 AM')
    expect(labelFor('08:00')).toBe('8:00 AM')
    expect(labelFor('12:00')).toBe('12:00 PM')
    expect(labelFor('15:30')).toBe('3:30 PM')
    expect(labelFor('18:30')).toBe('6:30 PM')
    expect(labelFor('23:45')).toBe('11:45 PM')
  })
})

describe('mealSlotIconKey', () => {
  it('gives each slot its own glyph so a schedule row never shows another slot mark', () => {
    expect(mealSlotIconKey('breakfast')).toBe('crosshair')
    expect(mealSlotIconKey('lunch')).toBe('bowl')
    expect(mealSlotIconKey('dinner')).toBe('fork_knife')
    expect(mealSlotIconKey('snack')).toBe('bowl_dash')
  })
})

describe('validateMealScheduleStep', () => {
  it('asks for a choice when no schedule is selected', () => {
    expect(validateMealScheduleStep(null)).toBe(MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT)
  })

  it('reports no error once either schedule is selected', () => {
    expect(validateMealScheduleStep('three')).toBeNull()
    expect(validateMealScheduleStep('three_plus_snack')).toBeNull()
  })
})
