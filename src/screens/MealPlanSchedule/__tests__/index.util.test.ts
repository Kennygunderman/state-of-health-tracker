import {MealTimeEntry} from '@data/models/MealPlanPreferences'

import {MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT} from '@constants/strings'

import {
  buildMealTimePickerItems,
  buildMealTimesPayload,
  formatMealTimeLabel,
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

describe('formatMealTimeLabel', () => {
  it('reads midnight and noon as twelve rather than zero', () => {
    expect(formatMealTimeLabel('00:00')).toBe('12:00 AM')
    expect(formatMealTimeLabel('12:00')).toBe('12:00 PM')
  })

  it('drops the leading zero from the hour and switches meridiem at noon', () => {
    expect(formatMealTimeLabel('08:00')).toBe('8:00 AM')
    expect(formatMealTimeLabel('11:59')).toBe('11:59 AM')
    expect(formatMealTimeLabel('18:30')).toBe('6:30 PM')
    expect(formatMealTimeLabel('23:45')).toBe('11:45 PM')
  })

  describe('malformed input', () => {
    it('returns an empty label instead of a half-formatted time', () => {
      expect(formatMealTimeLabel('')).toBe('')
      expect(formatMealTimeLabel('8:00')).toBe('')
      expect(formatMealTimeLabel('24:00')).toBe('')
      expect(formatMealTimeLabel('12:60')).toBe('')
      expect(formatMealTimeLabel('breakfast')).toBe('')
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

  it('labels every option the way the time pill formats it, so the two can never disagree', () => {
    const items = buildMealTimePickerItems()

    expect(items.filter(item => item.label !== formatMealTimeLabel(item.value))).toEqual([])
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
