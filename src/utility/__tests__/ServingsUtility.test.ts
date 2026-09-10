import {
  applyFractionPart,
  formatServingsDisplay,
  getFractionalPart,
  isFractionSelected,
  MIN_SERVINGS,
  scaleMacros,
  SERVING_FRACTIONS,
  stepServings
} from '../ServingsUtility'

describe('formatServingsDisplay', () => {
  it('renders whole servings without a fraction glyph', () => {
    expect(formatServingsDisplay(1)).toBe('1')
    expect(formatServingsDisplay(3)).toBe('3')
  })

  it('renders known fractions with glyphs', () => {
    expect(formatServingsDisplay(0.25)).toBe('¼')
    expect(formatServingsDisplay(0.33)).toBe('⅓')
    expect(formatServingsDisplay(0.5)).toBe('½')
    expect(formatServingsDisplay(0.66)).toBe('⅔')
    expect(formatServingsDisplay(0.75)).toBe('¾')
  })

  it('combines whole part and fraction glyph', () => {
    expect(formatServingsDisplay(1.5)).toBe('1½')
    expect(formatServingsDisplay(2.75)).toBe('2¾')
    expect(formatServingsDisplay(1.33)).toBe('1⅓')
  })

  it('falls back to decimals for unknown fractions', () => {
    expect(formatServingsDisplay(1.2)).toBe('1.2')
  })
})

describe('stepServings', () => {
  it('walks up through the fraction chip stops', () => {
    expect(stepServings(1, 1)).toBe(1.25)
    expect(stepServings(1.25, 1)).toBe(1.33)
    expect(stepServings(1.33, 1)).toBe(1.5)
    expect(stepServings(1.5, 1)).toBe(1.66)
    expect(stepServings(1.66, 1)).toBe(1.75)
    expect(stepServings(1.75, 1)).toBe(2)
  })

  it('walks down through the fraction chip stops', () => {
    expect(stepServings(2, -1)).toBe(1.75)
    expect(stepServings(1.75, -1)).toBe(1.66)
    expect(stepServings(1.66, -1)).toBe(1.5)
    expect(stepServings(1.5, -1)).toBe(1.33)
    expect(stepServings(1.33, -1)).toBe(1.25)
    expect(stepServings(1.25, -1)).toBe(1)
    expect(stepServings(1, -1)).toBe(0.75)
  })

  it('snaps off-ladder values to the nearest stop in the pressed direction', () => {
    expect(stepServings(1.2, 1)).toBe(1.25)
    expect(stepServings(1.2, -1)).toBe(1)
  })

  it('clamps at the minimum servings', () => {
    expect(stepServings(0.25, -1)).toBe(MIN_SERVINGS)
    expect(stepServings(MIN_SERVINGS, -1)).toBe(MIN_SERVINGS)
    expect(stepServings(0.33, -1)).toBe(0.25)
  })
})

describe('applyFractionPart', () => {
  it('replaces the fractional part and keeps the whole part', () => {
    expect(applyFractionPart(1.5, 0.25)).toBe(1.25)
    expect(applyFractionPart(2, 0.33)).toBe(2.33)
  })

  it('works when there is no whole part', () => {
    expect(applyFractionPart(0.5, 0.75)).toBe(0.75)
  })
})

describe('getFractionalPart / isFractionSelected', () => {
  it('extracts the fractional part without float dust', () => {
    expect(getFractionalPart(1.25)).toBe(0.25)
    expect(getFractionalPart(2)).toBe(0)
  })

  it('matches selected fraction chips', () => {
    expect(isFractionSelected(1.25, 0.25)).toBe(true)
    expect(isFractionSelected(1.33, 0.33)).toBe(true)
    expect(isFractionSelected(1.5, 0.25)).toBe(false)
    expect(isFractionSelected(2, 0.5)).toBe(false)
  })
})

describe('scaleMacros', () => {
  it('multiplies per-serving values and rounds each', () => {
    const perServing = {calories: 231, protein: 1, carbs: 50, fat: 3}

    expect(scaleMacros(perServing, 1.5)).toEqual({calories: 347, protein: 2, carbs: 75, fat: 5})
  })

  it('is identity-ish at one serving', () => {
    const perServing = {calories: 96, protein: 0, carbs: 24, fat: 0}

    expect(scaleMacros(perServing, 1)).toEqual(perServing)
  })
})

describe('SERVING_FRACTIONS', () => {
  it('lists five fraction stops in ascending value order', () => {
    const values = SERVING_FRACTIONS.map(fraction => fraction.value)

    expect(values).toHaveLength(5)

    values.slice(1).forEach((value, index) => {
      expect(value).toBeGreaterThan(values[index])
    })
  })

  it('pins the glyph and value of every stop', () => {
    expect(SERVING_FRACTIONS).toEqual([
      {glyph: '¼', value: 0.25},
      {glyph: '⅓', value: 0.33},
      {glyph: '½', value: 0.5},
      {glyph: '⅔', value: 0.66},
      {glyph: '¾', value: 0.75}
    ])
  })

  it('keeps every value at two decimal places so a logged portion survives validation', () => {
    SERVING_FRACTIONS.forEach(fraction => {
      expect(Number.isInteger(fraction.value * 100)).toBe(true)
    })
  })

  it('starts at the smallest selectable serving', () => {
    const values = SERVING_FRACTIONS.map(fraction => fraction.value)

    expect(Math.min(...values)).toBe(MIN_SERVINGS)
  })
})

describe('MIN_SERVINGS', () => {
  it('is a quarter serving, matching the stepper clamp and the logging lower bound', () => {
    expect(MIN_SERVINGS).toBe(0.25)
  })
})

describe('stepServings across whole-number boundaries', () => {
  it('restarts the fraction ladder inside the next whole number', () => {
    expect(stepServings(2, 1)).toBe(2.25)
  })
})

describe('getFractionalPart boundaries', () => {
  it('rounds float dust away at the two-thirds stop', () => {
    expect(getFractionalPart(1.66)).toBe(0.66)
  })

  it('returns the value itself when there is no whole part', () => {
    expect(getFractionalPart(0.25)).toBe(0.25)
  })
})

describe('isFractionSelected across the fraction table', () => {
  it('selects every stop when it is the current fractional part', () => {
    SERVING_FRACTIONS.forEach(fraction => {
      expect(isFractionSelected(1 + fraction.value, fraction.value)).toBe(true)
    })
  })
})

describe('scaleMacros rounding and input safety', () => {
  it('rounds each value half-up so the logged total matches the server snapshot', () => {
    const perServing = {calories: 231, protein: 1, carbs: 3, fat: 5}

    expect(scaleMacros(perServing, 2.5)).toEqual({calories: 578, protein: 3, carbs: 8, fat: 13})
    expect(scaleMacros(perServing, 0.5)).toEqual({calories: 116, protein: 1, carbs: 2, fat: 3})
  })

  it('returns zeros for a zero-macro item', () => {
    const perServing = {calories: 0, protein: 0, carbs: 0, fat: 0}

    expect(scaleMacros(perServing, 3)).toEqual({calories: 0, protein: 0, carbs: 0, fat: 0})
  })

  it('leaves the caller per-serving object untouched', () => {
    const perServing = {calories: 231, protein: 1, carbs: 50, fat: 3}

    scaleMacros(perServing, 2)

    expect(perServing).toEqual({calories: 231, protein: 1, carbs: 50, fat: 3})
  })
})
