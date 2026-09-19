import {MEAL_PLAN_ANNOUNCEMENT_SEPARATOR} from '@constants/strings'

import {composeAccessibleName} from '../AccessibilityUtility'

describe('composeAccessibleName', () => {
  it('speaks a label and its value as one sentence in the order given', () => {
    expect(composeAccessibleName(['Protein', '116 / 128g'])).toBe(
      `Protein${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}116 / 128g`
    )
  })

  it('joins more than two parts with the same separator', () => {
    expect(composeAccessibleName(['Saturday', 'Target 1,940', '3 meals'])).toBe(
      `Saturday${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}Target 1,940${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}3 meals`
    )
  })

  it('returns a single surviving part with no separator around it', () => {
    expect(composeAccessibleName(['Allergies', ''])).toBe('Allergies')
  })

  it('leaves no trace of an absent part, whichever position it holds', () => {
    const expected = `Goal${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}Lose weight`

    expect(composeAccessibleName(['Goal', '', 'Lose weight'])).toBe(expected)
    expect(composeAccessibleName(['', 'Goal', 'Lose weight'])).toBe(expected)
    expect(composeAccessibleName(['Goal', 'Lose weight', ''])).toBe(expected)
  })

  it('treats null and undefined parts as absent', () => {
    expect(composeAccessibleName(['Diet', null, undefined, 'Vegan'])).toBe(
      `Diet${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}Vegan`
    )
  })

  it('treats a whitespace-only part as absent and trims the parts it keeps', () => {
    expect(composeAccessibleName(['  Carbs  ', '   ', ' 188 / 194g '])).toBe(
      `Carbs${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}188 / 194g`
    )
  })

  it('returns undefined when no part survives, so a caller never sets an empty name', () => {
    expect(composeAccessibleName([])).toBeUndefined()
    expect(composeAccessibleName(['', '   '])).toBeUndefined()
    expect(composeAccessibleName([null, undefined])).toBeUndefined()
  })

  it('does not mutate the parts it was given', () => {
    const parts = ['Fat', '', '61 / 65g']

    composeAccessibleName(parts)

    expect(parts).toEqual(['Fat', '', '61 / 65g'])
  })
})
