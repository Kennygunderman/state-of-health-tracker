import {composeAccessibleName} from '@utility/AccessibilityUtility'

import {MEAL_PLAN_ANNOUNCEMENT_SEPARATOR, PLAN_SETTINGS_NOT_SET_VALUE} from '@constants/strings'

import {summaryRowDisplayValue} from '../index.util'

// Every caller of SummaryRows composes its values from data that may still be null — a targets read in
// flight, a preference the user has not answered — and the component draws whatever string it is handed. What
// it must never draw is a label over an empty line, so this is the derivation that stands between an absent
// answer and a collapsed row, and it is tested here rather than through the style objects because it decides
// the text, not the geometry.
describe('a summary row whose answer has not arrived', () => {
  it('states that it is not set rather than drawing a blank value line', () => {
    expect(summaryRowDisplayValue('')).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
  })

  it('treats a whitespace-only value as absent too', () => {
    expect(summaryRowDisplayValue('   ')).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
    expect(summaryRowDisplayValue('\n\t')).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
  })

  it('reuses the answer Plan Settings already gives for the same condition, adding no copy of its own', () => {
    expect(PLAN_SETTINGS_NOT_SET_VALUE).toBe('Not set')
  })

  it('always resolves to a drawn line, so the row keeps its 62 px height', () => {
    ;['', ' ', '   ', '\n\t'].forEach(absent => {
      expect(summaryRowDisplayValue(absent).length).toBeGreaterThan(0)
    })
  })

  it('speaks the placeholder in the row name, so the missing answer is not left unsaid', () => {
    expect(composeAccessibleName(['Diet', summaryRowDisplayValue('')])).toBe(
      `Diet${MEAL_PLAN_ANNOUNCEMENT_SEPARATOR}${PLAN_SETTINGS_NOT_SET_VALUE}`
    )
  })
})

describe('a summary row whose answer has arrived', () => {
  it('passes a real answer through untouched', () => {
    expect(summaryRowDisplayValue('Vegan')).toBe('Vegan')
    expect(summaryRowDisplayValue('Lose weight · 170.0 lb · Gradual')).toBe('Lose weight · 170.0 lb · Gradual')
  })

  it('passes a zero through, which is an answer and not an absence', () => {
    expect(summaryRowDisplayValue('0')).toBe('0')
    expect(summaryRowDisplayValue('0 g')).toBe('0 g')
  })
})
