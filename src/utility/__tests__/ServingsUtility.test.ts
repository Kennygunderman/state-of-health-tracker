import type {RecipeIngredient} from '@data/models/Recipe'

import {
  applyFractionPart,
  DisplayedIngredient,
  formatIngredientQuantity,
  formatServingsDisplay,
  getFractionalPart,
  IngredientAmount,
  isFractionSelected,
  MIN_SERVINGS,
  plannedPortionFactor,
  scaleIngredientsForDisplay,
  scaleMacros,
  SERVING_FRACTIONS,
  stepServings,
  WHOLE_RECIPE_FACTOR
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

/**
 * The one rule two screens share for turning a stored recipe ingredient amount into the amount on screen.
 *
 * What the three suites below pin, and why each is a decision someone could reverse:
 *
 *  - **The factor is `portionMultiplier / yieldServings`, and nothing else.** Stored amounts are whole-recipe
 *    amounts for `yieldServings` servings, and the server scaled the portion's NUTRITION by exactly these two
 *    numbers, so any other factor renders ingredients that contradict the calories printed beside them.
 *  - **A degenerate divisor degrades to the whole-recipe amount, never to `NaN` or `Infinity`.** A zero,
 *    negative or non-finite yield and a non-finite multiplier all fall back to 1. A visible stored amount is
 *    something a user can act on; 'NaN cup' is not. None of these is reachable for a published recipe, which
 *    is why they degrade rather than throw.
 *  - **The server's pre-formatted `displayText` is the LAST resort, not the first.** It describes the whole
 *    recipe, so preferring it is the defect these helpers were extracted to remove; it is used only when the
 *    quantity cannot be scaled at all ('a pinch').
 *  - **Amounts read like servings.** `formatServingsDisplay` is reused so an ingredient renders '¾ cup' and
 *    '1½ tbsp' with the same glyphs as the servings stepper, and a quantity with no matching fraction falls
 *    back to two decimals rather than to a long float.
 *  - **Floating-point dust never reaches the screen.** 1/3 of a cup is '0.33 cup', not '0.3333333333333333'.
 *  - **A counted ingredient carries no unit.** '2' avocados, never '2 '.
 *  - **The list mapping preserves order, names and the optional flag** — the instructions reference ingredients
 *    by position, so a reordering here would renumber what the user reads.
 */

const ingredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Brown rice, cooked',
  quantity: 3,
  unit: 'cup',
  gramWeight: 585,
  displayText: '3 cup',
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

const amount = (overrides: Partial<IngredientAmount> = {}): IngredientAmount => ({
  quantity: 2,
  unit: 'cup',
  displayText: '2 cup',
  ...overrides
})

const NON_FINITE = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]

describe('plannedPortionFactor', () => {
  describe('a recipe that can be divided', () => {
    it('divides one serving of a two-serving recipe in half', () => {
      expect(plannedPortionFactor(1, 2)).toBe(0.5)
    })

    it('applies the multiplier and the yield together', () => {
      expect(plannedPortionFactor(1.5, 4)).toBe(0.375)
      expect(plannedPortionFactor(2, 2)).toBe(1)
      expect(plannedPortionFactor(0.5, 1)).toBe(0.5)
    })

    it('leaves a single-serving recipe at one serving unscaled', () => {
      expect(plannedPortionFactor(1, 1)).toBe(WHOLE_RECIPE_FACTOR)
    })
  })

  describe('a yield that cannot divide', () => {
    it('falls back to the whole-recipe amount for zero and for a negative yield', () => {
      expect(plannedPortionFactor(1, 0)).toBe(WHOLE_RECIPE_FACTOR)
      expect(plannedPortionFactor(1, -2)).toBe(WHOLE_RECIPE_FACTOR)
    })

    it.each(NON_FINITE)('falls back to the whole-recipe amount for a yield of %p', notDivisible => {
      expect(plannedPortionFactor(1, notDivisible)).toBe(WHOLE_RECIPE_FACTOR)
    })
  })

  describe('a multiplier that is not a number', () => {
    it.each(NON_FINITE)('falls back to the whole-recipe amount for a multiplier of %p', unusable => {
      expect(plannedPortionFactor(unusable, 2)).toBe(WHOLE_RECIPE_FACTOR)
    })
  })

  describe('determinism', () => {
    it('returns the same factor for the same inputs', () => {
      expect(plannedPortionFactor(1.25, 3)).toBe(plannedPortionFactor(1.25, 3))
    })
  })
})

describe('formatIngredientQuantity', () => {
  describe('the scaled amount', () => {
    it('renders the stored amount at a factor of one', () => {
      expect(formatIngredientQuantity(amount({quantity: 2}), WHOLE_RECIPE_FACTOR)).toBe('2 cup')
    })

    it('renders a scaled amount rather than the stored one', () => {
      expect(formatIngredientQuantity(amount({quantity: 10, unit: 'oz'}), 0.5)).toBe('5 oz')
    })

    it('writes a fraction with the same glyphs as the servings stepper', () => {
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.25)).toBe('¼ cup')
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.5)).toBe('½ cup')
      expect(formatIngredientQuantity(amount({quantity: 3}), 0.25)).toBe('¾ cup')
      expect(formatIngredientQuantity(amount({quantity: 6}), 0.25)).toBe('1½ cup')
    })

    it('writes a third with the stepper glyph, at the precision the stepper stores it', () => {
      // 0.3333... rounds to 0.33, which is the value SERVING_FRACTIONS carries for ⅓
      expect(formatIngredientQuantity(amount({quantity: 1}), 1 / 3)).toBe('⅓ cup')
    })

    it('falls back to two decimals for an amount no fraction glyph matches', () => {
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.4)).toBe('0.4 cup')
      expect(formatIngredientQuantity(amount({quantity: 1}), 0.125)).toBe('0.13 cup')
    })

    it('keeps floating point dust off the screen', () => {
      expect(formatIngredientQuantity(amount({quantity: 0.1 + 0.2, unit: null}), WHOLE_RECIPE_FACTOR)).toBe('0.3')
      expect(formatIngredientQuantity(amount({quantity: 150.001, unit: 'g'}), WHOLE_RECIPE_FACTOR)).toBe('150 g')
    })
  })

  describe('the unit', () => {
    it('is trimmed before it is composed', () => {
      expect(formatIngredientQuantity(amount({quantity: 150, unit: '  g  '}), WHOLE_RECIPE_FACTOR)).toBe('150 g')
    })

    it('is omitted for a counted ingredient', () => {
      expect(formatIngredientQuantity(amount({quantity: 2, unit: ''}), WHOLE_RECIPE_FACTOR)).toBe('2')
      expect(formatIngredientQuantity(amount({quantity: 2, unit: '   '}), WHOLE_RECIPE_FACTOR)).toBe('2')
      expect(formatIngredientQuantity(amount({quantity: 2, unit: null}), WHOLE_RECIPE_FACTOR)).toBe('2')
      expect(formatIngredientQuantity(amount({quantity: 2, unit: undefined}), WHOLE_RECIPE_FACTOR)).toBe('2')
    })
  })

  describe('a quantity that cannot be scaled', () => {
    it.each(NON_FINITE)('falls back to the stored display text for a quantity of %p', unusable => {
      expect(formatIngredientQuantity(amount({quantity: unusable, displayText: 'a pinch'}), 0.5)).toBe('a pinch')
    })

    it('trims that fallback', () => {
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: ' a pinch '}), 0.5)).toBe('a pinch')
    })

    it('renders nothing rather than NaN when there is no text either', () => {
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: null}), 0.5)).toBe('')
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: '   '}), 0.5)).toBe('')
      expect(formatIngredientQuantity(amount({quantity: Number.NaN, displayText: undefined}), 0.5)).toBe('')
    })
  })

  describe('the stored display text for a scalable quantity', () => {
    it('never wins, because it describes the whole recipe', () => {
      // The defect these helpers exist to prevent: '3 cup' is the whole recipe, and the portion is one cup
      expect(formatIngredientQuantity(amount({quantity: 3, displayText: '3 cup'}), 1 / 3)).toBe('1 cup')
    })
  })

  describe('output never leaks a numeric artefact', () => {
    it.each([
      [Number.NaN, 2],
      [1, Number.NaN],
      [1, Number.POSITIVE_INFINITY]
    ])('renders no NaN or Infinity for a multiplier of %p and a yield of %p', (multiplier, yieldServings) => {
      const text = formatIngredientQuantity(
        amount({quantity: 2}),
        plannedPortionFactor(multiplier as number, yieldServings as number)
      )

      expect(text).not.toContain('NaN')
      expect(text).not.toContain('Infinity')
      expect(text).toBe('2 cup')
    })
  })
})

describe('scaleIngredientsForDisplay', () => {
  describe('the rows it builds', () => {
    it('carries the name, the scaled amount and the optional flag', () => {
      const rows: DisplayedIngredient[] = scaleIngredientsForDisplay(
        [ingredient({name: 'Olive oil', quantity: 3, unit: 'tbsp', isOptional: true})],
        plannedPortionFactor(1, 2)
      )

      expect(rows).toEqual([{name: 'Olive oil', quantityText: '1½ tbsp', isOptional: true}])
    })

    it('keeps the order it was given, because the instructions reference ingredients by position', () => {
      const rows = scaleIngredientsForDisplay(
        [
          ingredient({name: 'Chicken breast', quantity: 10, unit: 'oz'}),
          ingredient({name: 'Black beans', quantity: 1, unit: 'cup'}),
          ingredient({name: 'Avocado', quantity: 1, unit: ''})
        ],
        plannedPortionFactor(1, 2)
      )

      expect(rows.map(row => row.name)).toEqual(['Chicken breast', 'Black beans', 'Avocado'])
      expect(rows.map(row => row.quantityText)).toEqual(['5 oz', '½ cup', '½'])
    })

    it('returns an empty list for an empty recipe', () => {
      expect(scaleIngredientsForDisplay([], 0.5)).toEqual([])
    })
  })

  describe('purity', () => {
    it('does not mutate the ingredients it was given', () => {
      const ingredients = [ingredient()]
      const snapshot = JSON.stringify(ingredients)

      scaleIngredientsForDisplay(ingredients, 0.5)

      expect(JSON.stringify(ingredients)).toBe(snapshot)
    })

    it('returns the same rows for the same inputs', () => {
      const ingredients = [ingredient(), ingredient({name: 'Lime', quantity: 2, unit: ''})]

      expect(scaleIngredientsForDisplay(ingredients, 0.5)).toEqual(scaleIngredientsForDisplay(ingredients, 0.5))
    })
  })
})
