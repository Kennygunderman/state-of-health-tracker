import {formatCalories, formatMacroGrams, formatMacroPair, formatSignedCalories} from '../NutritionFormatUtility'

const CAL_SUFFIX = 'cal'
const MINUS_SIGN = '\u2212'
const PARITY_VALUES = [0, 1, 999, 1000, 1940, 12345, 1905.5]

describe('formatCalories', () => {
  describe('Figma figures', () => {
    it('renders the review target as 1,940', () => {
      expect(formatCalories(1940)).toBe('1,940')
    })

    it('renders the planned day total as 1,905', () => {
      expect(formatCalories(1905.4)).toBe('1,905')
    })

    it('renders the swap preview total as 1,835', () => {
      expect(formatCalories(1835)).toBe('1,835')
    })

    it('renders a meal figure under a thousand ungrouped', () => {
      expect(formatCalories(610)).toBe('610')
    })
  })

  describe('grouping boundary', () => {
    it('leaves three digits ungrouped', () => {
      expect(formatCalories(999)).toBe('999')
    })

    it('groups at four digits', () => {
      expect(formatCalories(1000)).toBe('1,000')
    })

    it('groups a five digit figure', () => {
      expect(formatCalories(12345)).toBe('12,345')
    })
  })

  describe('rounding', () => {
    it('rounds zero to 0', () => {
      expect(formatCalories(0)).toBe('0')
    })

    it('rounds down below the half boundary', () => {
      expect(formatCalories(1904.4)).toBe('1,904')
    })

    it('rounds up at the half boundary', () => {
      expect(formatCalories(1904.5)).toBe('1,905')
    })

    it('rounds half up across the grouping separator', () => {
      expect(formatCalories(1905.5)).toBe('1,906')
    })
  })

  describe('inputs the diary never produces', () => {
    it('renders a negative with an ASCII hyphen, since only formatSignedCalories uses the typographic minus', () => {
      expect(formatCalories(-70)).toBe('-70')
    })

    it('keeps the shipped negative-zero output for a value that rounds to -0', () => {
      expect(formatCalories(-0.4)).toBe('-0')
    })

    it('renders NaN as the string NaN, matching the shipped diary formatter', () => {
      expect(formatCalories(NaN)).toBe('NaN')
    })
  })
})

describe('formatMacroGrams', () => {
  it('suffixes grams without a space', () => {
    expect(formatMacroGrams(146)).toBe('146g')
  })

  it('renders the fat target as 65g', () => {
    expect(formatMacroGrams(65)).toBe('65g')
  })

  it('renders zero grams', () => {
    expect(formatMacroGrams(0)).toBe('0g')
  })

  it('rounds down below the half boundary', () => {
    expect(formatMacroGrams(64.4)).toBe('64g')
  })

  it('rounds up at the half boundary', () => {
    expect(formatMacroGrams(64.5)).toBe('65g')
  })

  it('rounds a fractional gram figure up, like the shipped MacroGramRow', () => {
    expect(formatMacroGrams(64.6)).toBe('65g')
  })

  it('does not group thousands, matching the shipped MacroGramRow', () => {
    expect(formatMacroGrams(1200)).toBe('1200g')
  })

  it('keeps NaN visible rather than guarding it', () => {
    expect(formatMacroGrams(NaN)).toBe('NaNg')
  })
})

describe('formatMacroPair', () => {
  describe('Figma legend rows', () => {
    it('renders the planned protein pair', () => {
      expect(formatMacroPair(142, 146)).toBe('142 / 146g')
    })

    it('renders the planned carbs pair', () => {
      expect(formatMacroPair(188, 194)).toBe('188 / 194g')
    })

    it('renders the planned fat pair', () => {
      expect(formatMacroPair(61, 65)).toBe('61 / 65g')
    })

    it('renders the swap preview protein pair', () => {
      expect(formatMacroPair(135, 146)).toBe('135 / 146g')
    })

    it('renders the swap preview carbs pair', () => {
      expect(formatMacroPair(179, 194)).toBe('179 / 194g')
    })

    it('renders the swap preview fat pair', () => {
      expect(formatMacroPair(59, 65)).toBe('59 / 65g')
    })
  })

  it('puts the gram suffix on the target only', () => {
    expect(formatMacroPair(142, 146)).not.toContain('142g')
  })

  it('separates the values with a space, slash, space', () => {
    expect(formatMacroPair(142, 146)).toContain(' / ')
  })

  it('rounds both sides independently', () => {
    expect(formatMacroPair(141.6, 146.4)).toBe('142 / 146g')
  })

  it('rounds the planned carbs pair down to whole grams', () => {
    expect(formatMacroPair(188.4, 194)).toBe('188 / 194g')
  })

  it('renders nothing consumed as 0', () => {
    expect(formatMacroPair(0, 146)).toBe('0 / 146g')
  })

  it('renders a zero actual against a zero target', () => {
    expect(formatMacroPair(0, 0)).toBe('0 / 0g')
  })

  it('does not clamp an actual above the target', () => {
    expect(formatMacroPair(200, 146)).toBe('200 / 146g')
  })

  it('leaves both sides ungrouped, matching the shipped gram format', () => {
    expect(formatMacroPair(1200, 1500)).toBe('1200 / 1500g')
  })
})

describe('formatSignedCalories', () => {
  it('renders the Figma negative delta with a true minus sign', () => {
    expect(formatSignedCalories(-70, 'cal')).toBe('\u221270 cal')
  })

  it('uses U+2212 and not an ASCII hyphen for a negative delta', () => {
    const rendered = formatSignedCalories(-70, CAL_SUFFIX)

    expect(rendered.codePointAt(0)).toBe(0x2212)
    expect(rendered).not.toContain('-')
  })

  it('renders a positive delta with a leading plus', () => {
    expect(formatSignedCalories(70, CAL_SUFFIX)).toBe(`+70 ${CAL_SUFFIX}`)
  })

  it('renders an exact zero delta without a sign', () => {
    expect(formatSignedCalories(0, CAL_SUFFIX)).toBe(`0 ${CAL_SUFFIX}`)
  })

  // Math.round(-0.4) is -0 and (-0).toLocaleString('en-US') is '-0', so formatting before taking the
  // magnitude would render '-0 cal' here — a delta that rounds to zero carries no sign
  it('drops the sign for a negative delta that rounds to zero', () => {
    expect(formatSignedCalories(-0.4, CAL_SUFFIX)).toBe(`0 ${CAL_SUFFIX}`)
  })

  it('renders a positive delta that rounds to zero without a sign', () => {
    expect(formatSignedCalories(0.4, CAL_SUFFIX)).toBe(`0 ${CAL_SUFFIX}`)
  })

  // The magnitude is rounded before the sign is applied, so the half boundary rounds away from zero
  it('rounds the negative half boundary away from zero rather than up to an unsigned zero', () => {
    expect(formatSignedCalories(-0.5, CAL_SUFFIX)).toBe(`${MINUS_SIGN}1 ${CAL_SUFFIX}`)
  })

  it('rounds the positive half boundary up before signing', () => {
    expect(formatSignedCalories(0.5, CAL_SUFFIX)).toBe(`+1 ${CAL_SUFFIX}`)
  })

  it('rounds a negative half boundary on its magnitude, not toward positive infinity', () => {
    expect(formatSignedCalories(-69.5, CAL_SUFFIX)).toBe(`${MINUS_SIGN}70 ${CAL_SUFFIX}`)
  })

  it('rounds a small negative half boundary away from zero', () => {
    expect(formatSignedCalories(-2.5, CAL_SUFFIX)).toBe(`${MINUS_SIGN}3 ${CAL_SUFFIX}`)
  })

  it('gives a negative and a positive half boundary the same magnitude', () => {
    const negative = formatSignedCalories(-69.5, CAL_SUFFIX)
    const positive = formatSignedCalories(69.5, CAL_SUFFIX)

    expect(negative.slice(1)).toBe(positive.slice(1))
    expect(negative).toBe(`${MINUS_SIGN}70 ${CAL_SUFFIX}`)
    expect(positive).toBe(`+70 ${CAL_SUFFIX}`)
  })

  it('groups the magnitude of a four digit delta', () => {
    expect(formatSignedCalories(-1200, CAL_SUFFIX)).toBe(`${MINUS_SIGN}1,200 ${CAL_SUFFIX}`)
  })

  it('does not emit an ASCII hyphen for a grouped negative delta', () => {
    expect(formatSignedCalories(-1200, CAL_SUFFIX)).not.toContain('-')
  })

  it('renders the minus sign and the thousands separator together', () => {
    expect(formatSignedCalories(-1234, 'cal')).toBe('\u22121,234 cal')
  })

  it('renders a unit suffix of grams with the same spacing', () => {
    expect(formatSignedCalories(-15, 'g')).toBe('\u221215 g')
  })

  it('renders the injected unit suffix rather than a hardcoded one', () => {
    expect(formatSignedCalories(-70, 'kcal')).toBe(`${MINUS_SIGN}70 kcal`)
  })

  it('keeps NaN visible rather than guarding it', () => {
    expect(formatSignedCalories(NaN, CAL_SUFFIX)).toBe(`+NaN ${CAL_SUFFIX}`)
  })
})

// Detects the planner and diary formatters drifting apart: comparing against the shipped expression
// catches a locale, fraction-digit or abbreviation option added to one of them but not the other
describe('drift from the shipped diary calorie formatter', () => {
  it.each(PARITY_VALUES)('renders %p exactly as the shipped formatter does', value => {
    expect(formatCalories(value)).toBe(Math.round(value).toLocaleString('en-US'))
  })

  it('renders the figures a drifting implementation would break, as literals', () => {
    expect(formatCalories(1940)).toBe('1,940')
    expect(formatCalories(12345)).toBe('12,345')
    expect(formatCalories(610)).toBe('610')
  })
})
