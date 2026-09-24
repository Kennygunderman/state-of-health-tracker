import {MealTimeEntry} from '@data/models/MealPlanPreferences'
import {MealSlot} from '@data/models/Recipe'
import {ClockTimeString} from '@queries/api/macros/decoder/MacrosDecoder'
import {formatSlotTime} from '@utility/MealPlanDateUtility'

import {
  MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT,
  MEAL_PLAN_SLOT_TIME_REQUIRED_ERROR_TEMPLATE,
  MEAL_PLAN_TIME_PICKER_PLACEHOLDER,
  MEAL_SLOT_SENTENCE_LABELS,
  stringWithNamedParameters
} from '@constants/strings'

import {
  buildMealTimePickerItems,
  buildMealTimesPayload,
  mealSlotIconKey,
  mealSlotsForSchedule,
  mealSlotsForScheduleCard,
  mealTimePillLabel,
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

describe('mealSlotsForScheduleCard', () => {
  it('shows the three-meal day once that schedule is chosen', () => {
    expect(mealSlotsForScheduleCard('three')).toEqual(['breakfast', 'lunch', 'dinner'])
  })

  it('adds the snack row when the snack schedule is chosen', () => {
    expect(mealSlotsForScheduleCard('three_plus_snack')).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  // Frame 47:471 draws the "Usual times" card and the dashed snack placeholder on a screen with nothing
  // selected, and AAP 0.7.4 opens the step that way, so the card has rows from first entry — otherwise the
  // affordance that explains what the snack option adds only appears after the option has been picked.
  it('shows the three main rows before any schedule is chosen, so the card is never empty', () => {
    expect(mealSlotsForScheduleCard(null)).toEqual(['breakfast', 'lunch', 'dinner'])
  })

  it('leaves the snack out until it is chosen, which is what keeps the dashed placeholder on screen', () => {
    expect(mealSlotsForScheduleCard(null)).not.toContain('snack')
    expect(mealSlotsForScheduleCard('three')).not.toContain('snack')
  })

  // The unchosen state borrows the three-meal day's rows rather than naming its own list, so the two can
  // never disagree about the main slots or their order.
  it('renders the unchosen card exactly as the three-meal day', () => {
    expect(mealSlotsForScheduleCard(null)).toEqual(mealSlotsForSchedule('three'))
  })
})

describe('mealTimePillLabel', () => {
  it('labels a seeded slot with the time, formatted as every other surface formats it', () => {
    expect(mealTimePillLabel('08:00')).toBe(formatSlotTime('08:00'))
    expect(mealTimePillLabel('18:30')).toBe(formatSlotTime('18:30'))
  })

  // An unseeded pill states the action it offers. Times are seeded only when a schedule is chosen, and AAP
  // 0.1.2 forbids showing the mockup's times as answers the user already gave, so neither an empty pill nor
  // a borrowed default is acceptable here.
  it('labels a slot with no time yet with the picker placeholder', () => {
    expect(mealTimePillLabel('')).toBe(MEAL_PLAN_TIME_PICKER_PLACEHOLDER)
  })

  it('treats a whitespace-only time as no time at all', () => {
    expect(mealTimePillLabel('   ')).toBe(MEAL_PLAN_TIME_PICKER_PLACEHOLDER)
  })

  it('never renders an empty pill', () => {
    expect(mealTimePillLabel('').trim().length).toBeGreaterThan(0)
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
  const slotMessage = (slot: MealSlot): string =>
    stringWithNamedParameters(MEAL_PLAN_SLOT_TIME_REQUIRED_ERROR_TEMPLATE, {slot: MEAL_SLOT_SENTENCE_LABELS[slot]})

  it('asks for a choice when no schedule is selected', () => {
    const validation = validateMealScheduleStep(null, [])

    expect(validation.scheduleError).toBe(MEAL_PLAN_OPTION_REQUIRED_ERROR_TEXT)
    expect(validation.isValid).toBe(false)
  })

  // There is no schedule whose slots could be named, so naming them would ask the user for times before the
  // question that decides how many times there are has been answered.
  it('names no slot while no schedule is selected, even with times already stored', () => {
    expect(validateMealScheduleStep(null, makeMealTimes()).slotTimeErrors).toEqual([])
  })

  it('accepts a three-meal day with all three times', () => {
    expect(validateMealScheduleStep('three', makeMealTimesWithoutSnack())).toEqual({
      scheduleError: null,
      slotTimeErrors: [],
      isValid: true
    })
  })

  it('accepts the snack schedule once all four slots have times', () => {
    expect(validateMealScheduleStep('three_plus_snack', makeMealTimes())).toEqual({
      scheduleError: null,
      slotTimeErrors: [],
      isValid: true
    })
  })

  // The saved row F09 reports: mealSchedule 'three_plus_snack' with only the three main times, which seeding
  // adopts as-is. The old predicate passed it, so buildMealTimesPayload sent {slot: 'snack', time: ''} and the
  // server's 400 reached the user as the generic error toast instead of the one missing answer.
  it('blocks the snack schedule whose snack time was never stored, naming that slot alone', () => {
    const validation = validateMealScheduleStep('three_plus_snack', makeMealTimesWithoutSnack())

    expect(validation.scheduleError).toBeNull()
    expect(validation.slotTimeErrors).toEqual([{slot: 'snack', message: 'Choose a snack time to continue'}])
    expect(validation.isValid).toBe(false)
  })

  it('assembles each message from the template and the sentence-case slot label', () => {
    expect(validateMealScheduleStep('three_plus_snack', makeMealTimesWithoutSnack()).slotTimeErrors).toEqual([
      {slot: 'snack', message: slotMessage('snack')}
    ])
  })

  // AAP 0.5.2 puts no ordering constraint on the times, and Figma 07 draws the snack at 3:30 PM — between
  // lunch and dinner — so a snack before lunch is an answer, not an error.
  it('accepts a snack time earlier than lunch', () => {
    const snackBeforeLunch: MealTimeEntry[] = [
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'},
      {slot: 'snack', time: '10:00'}
    ]

    expect(validateMealScheduleStep('three_plus_snack', snackBeforeLunch).isValid).toBe(true)
  })

  it('rejects a blank time and a whitespace-only time', () => {
    const blank: MealTimeEntry[] = [
      {slot: 'breakfast', time: ''},
      {slot: 'lunch', time: '   '},
      {slot: 'dinner', time: '18:30'}
    ]

    expect(validateMealScheduleStep('three', blank).slotTimeErrors).toEqual([
      {slot: 'breakfast', message: slotMessage('breakfast')},
      {slot: 'lunch', message: slotMessage('lunch')}
    ])
  })

  // The payload sends the stored value verbatim, so a value the server cannot read is caught here rather than
  // rejected there: '8:00' is unpadded, '24:00' names no hour of the day, and a padded value is not 'HH:mm'.
  it('rejects a time that is not a zero-padded 24-hour HH:mm', () => {
    const malformed: MealTimeEntry[] = [
      {slot: 'breakfast', time: '8:00'},
      {slot: 'lunch', time: '24:00'},
      {slot: 'dinner', time: ' 18:30 '}
    ]

    expect(validateMealScheduleStep('three', malformed).slotTimeErrors.map(error => error.slot)).toEqual([
      'breakfast',
      'lunch',
      'dinner'
    ])
  })

  // The same form the decoder reads a stored time back in, pinned against its codec so the two can never
  // drift: a time this step is willing to send is exactly a time ClockTimeString accepts.
  it('accepts exactly the times the wire codec accepts', () => {
    const candidates: readonly string[] = ['00:00', '08:00', '12:30', '18:30', '23:59', '8:00', '24:00', '12:60', '']

    candidates.forEach(time => {
      const isAccepted = validateMealScheduleStep('three', [
        {slot: 'breakfast', time},
        {slot: 'lunch', time: '12:30'},
        {slot: 'dinner', time: '18:30'}
      ]).isValid

      expect(isAccepted).toBe(ClockTimeString.is(time))
    })
  })

  // An extra entry for a slot this schedule does not plan is not an error — buildMealTimesPayload drops it,
  // so nothing unsendable reaches the server and the user is asked for nothing.
  it('ignores a stored snack time on a schedule with no snack slot', () => {
    expect(validateMealScheduleStep('three', makeMealTimes()).isValid).toBe(true)
  })

  it('reports every offending slot at once, in wire order', () => {
    const missingTwo: MealTimeEntry[] = [
      {slot: 'lunch', time: '12:30'},
      {slot: 'snack', time: '15:30'}
    ]

    expect(validateMealScheduleStep('three_plus_snack', missingTwo).slotTimeErrors).toEqual([
      {slot: 'breakfast', message: slotMessage('breakfast')},
      {slot: 'dinner', message: slotMessage('dinner')}
    ])
  })

  it('names one slot per offending row and never repeats a slot', () => {
    const slots = validateMealScheduleStep('three_plus_snack', []).slotTimeErrors.map(error => error.slot)

    expect(slots).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
    expect(new Set(slots).size).toBe(slots.length)
  })
})
