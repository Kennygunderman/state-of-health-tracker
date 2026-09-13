import {RecipeIngredient} from '@data/models/Recipe'

import {
  DisplayedIngredient,
  formatIngredientQuantity,
  IngredientAmount,
  plannedPortionFactor,
  scaleIngredientsForDisplay,
  WHOLE_RECIPE_FACTOR
} from '../RecipeIngredientUtility'

/**
 * The one rule two screens share for turning a stored recipe ingredient amount into the amount on screen.
 *
 * What this suite pins, and why each is a decision someone could reverse:
 *
 *  - **The factor is `portionMultiplier / yieldServings`, and nothing else.** Stored amounts are whole-recipe
 *    amounts for `yieldServings` servings, and the server scaled the portion's NUTRITION by exactly these two
 *    numbers, so any other factor renders ingredients that contradict the calories printed beside them.
 *  - **A degenerate divisor degrades to the whole-recipe amount, never to `NaN` or `Infinity`.** A zero,
 *    negative or non-finite yield and a non-finite multiplier all fall back to 1. A visible stored amount is
 *    something a user can act on; 'NaN cup' is not. None of these is reachable for a published recipe, which
 *    is why they degrade rather than throw.
 *  - **The server's pre-formatted `displayText` is the LAST resort, not the first.** It describes the whole
 *    recipe, so preferring it is the defect this module was extracted to remove; it is used only when the
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
      // The defect this module exists to prevent: '3 cup' is the whole recipe, and the portion is one cup
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
