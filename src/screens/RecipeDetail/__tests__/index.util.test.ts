import {MacroTotals} from '@data/models/Macros'
import {RecipeBadge, RecipeIngredient} from '@data/models/Recipe'

import {
  buildContextPillText,
  buildMetricGridItems,
  PlannedNutritionSource,
  resolveActionBarState,
  resolveBadgeLabels,
  resolveDisplayedIngredients,
  resolvePlannedNutrition,
  resolveRecipeDetailErrorBranch,
  shouldShowBadgeCaption
} from '../index.util'

const ingredient = (overrides: Partial<RecipeIngredient> = {}): RecipeIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Brown rice, cooked',
  quantity: 1.5,
  unit: 'cup',
  gramWeight: 195,
  displayText: '1½ cup',
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

const perServing = (overrides: Partial<MacroTotals> = {}): MacroTotals => ({
  calories: 231,
  protein: 1,
  carbs: 50,
  fat: 3,
  ...overrides
})

const asBadge = (code: string): RecipeBadge => code as RecipeBadge

const captions = {
  calories: 'CAL_CAPTION',
  protein: 'PROTEIN_CAPTION',
  carbs: 'CARBS_CAPTION',
  fat: 'FAT_CAPTION'
}

const slotLabels = {
  breakfast: 'Morning plate',
  lunch: 'Midday plate',
  dinner: 'Evening plate',
  snack: 'Small bite'
}

const badgeLabels = {
  high_protein: 'Protein rich',
  gluten_free: 'No gluten',
  dairy_free: 'No dairy',
  vegan: 'Plant based',
  quick: 'Under 15'
}

const PORTION_MULTIPLIERS = [0.5, 1, 1.5, 2]

const YIELD_SERVINGS = [1, 2, 4]

const parityIngredients: RecipeIngredient[] = [
  ingredient({name: 'Chicken breast', quantity: 4, unit: 'cup', displayText: '4 cup'}),
  ingredient({name: 'Avocado', quantity: 2, unit: '', displayText: '2'}),
  ingredient({name: 'Olive oil', quantity: 1.5, unit: 'tbsp', displayText: '1½ tbsp', isOptional: true})
]

describe('resolveDisplayedIngredients', () => {
  describe('display mode parity', () => {
    it('lists the same ingredients, in the same order, in both modes for every portion and yield', () => {
      PORTION_MULTIPLIERS.forEach(portionMultiplier => {
        YIELD_SERVINGS.forEach(yieldServings => {
          const portion = resolveDisplayedIngredients(parityIngredients, 'portion', portionMultiplier, yieldServings)
          const full = resolveDisplayedIngredients(parityIngredients, 'full', portionMultiplier, yieldServings)

          expect(portion).toHaveLength(parityIngredients.length)
          expect(full).toHaveLength(parityIngredients.length)
          expect(portion.map(item => item.name)).toEqual(['Chicken breast', 'Avocado', 'Olive oil'])
          expect(full.map(item => item.name)).toEqual(portion.map(item => item.name))
        })
      })
    })

    it('keeps the optional flags identical in both modes for every portion and yield', () => {
      PORTION_MULTIPLIERS.forEach(portionMultiplier => {
        YIELD_SERVINGS.forEach(yieldServings => {
          const portion = resolveDisplayedIngredients(parityIngredients, 'portion', portionMultiplier, yieldServings)
          const full = resolveDisplayedIngredients(parityIngredients, 'full', portionMultiplier, yieldServings)

          expect(portion.map(item => item.isOptional)).toEqual([false, false, true])
          expect(full.map(item => item.isOptional)).toEqual(portion.map(item => item.isOptional))
        })
      })
    })

    it('changes the quantity text and nothing else, and only when the portion factor is not 1', () => {
      PORTION_MULTIPLIERS.forEach(portionMultiplier => {
        YIELD_SERVINGS.forEach(yieldServings => {
          const portion = resolveDisplayedIngredients(parityIngredients, 'portion', portionMultiplier, yieldServings)
          const full = resolveDisplayedIngredients(parityIngredients, 'full', portionMultiplier, yieldServings)
          const portionQuantities = portion.map(item => item.quantityText)
          const fullQuantities = full.map(item => item.quantityText)

          if (portionMultiplier === yieldServings) {
            expect(portionQuantities).toEqual(fullQuantities)
            expect(portion).toEqual(full)
          } else {
            expect(portionQuantities).not.toEqual(fullQuantities)
          }
        })
      })
    })

    it('produces an identical array in both modes for a single-serving recipe at a full portion', () => {
      const portion = resolveDisplayedIngredients(parityIngredients, 'portion', 1, 1)

      expect(portion).toEqual(resolveDisplayedIngredients(parityIngredients, 'full', 1, 1))
    })

    it('carries an optional ingredient through unchanged in both modes', () => {
      const ingredients = [ingredient({isOptional: true}), ingredient({name: 'Lime', isOptional: false})]
      const portion = resolveDisplayedIngredients(ingredients, 'portion', 1, 2)
      const full = resolveDisplayedIngredients(ingredients, 'full', 1, 2)

      expect(portion).toEqual([
        {name: 'Brown rice, cooked', quantityText: '¾ cup', isOptional: true},
        {name: 'Lime', quantityText: '¾ cup', isOptional: false}
      ])
      expect(full).toEqual([
        {name: 'Brown rice, cooked', quantityText: '1½ cup', isOptional: true},
        {name: 'Lime', quantityText: '1½ cup', isOptional: false}
      ])
    })
  })

  describe('scaling factor', () => {
    it('renders the stored whole-recipe amount in full mode', () => {
      expect(resolveDisplayedIngredients([ingredient()], 'full', 1, 2)).toEqual([
        {name: 'Brown rice, cooked', quantityText: '1½ cup', isOptional: false}
      ])
    })

    it('divides the stored amount by the yield in portion mode', () => {
      expect(resolveDisplayedIngredients([ingredient()], 'portion', 1, 2)).toEqual([
        {name: 'Brown rice, cooked', quantityText: '¾ cup', isOptional: false}
      ])
    })

    it('multiplies the per-serving share by the planned portion multiplier', () => {
      const displayed = resolveDisplayedIngredients([ingredient({quantity: 3})], 'portion', 2, 4)

      expect(displayed[0].quantityText).toBe('1½ cup')
    })

    it('leaves the full-recipe amount alone whatever the portion multiplier and yield are', () => {
      const quantities = PORTION_MULTIPLIERS.map(
        portionMultiplier => resolveDisplayedIngredients([ingredient()], 'full', portionMultiplier, 4)[0].quantityText
      )

      expect(quantities).toEqual(['1½ cup', '1½ cup', '1½ cup', '1½ cup'])
    })
  })

  describe('quantity formatting', () => {
    it('renders each fraction stop as its glyph', () => {
      const quarter = resolveDisplayedIngredients([ingredient({quantity: 1, unit: ''})], 'portion', 1, 4)
      const third = resolveDisplayedIngredients([ingredient({quantity: 1, unit: ''})], 'portion', 1, 3)
      const half = resolveDisplayedIngredients([ingredient({quantity: 1, unit: ''})], 'portion', 1, 2)
      const twoThirds = resolveDisplayedIngredients([ingredient({quantity: 1.32, unit: ''})], 'portion', 1, 2)
      const threeQuarters = resolveDisplayedIngredients([ingredient({quantity: 1.5, unit: ''})], 'portion', 1, 2)

      expect([quarter, third, half, twoThirds, threeQuarters].map(([item]) => item.quantityText)).toEqual([
        '¼',
        '⅓',
        '½',
        '⅔',
        '¾'
      ])
    })

    it('renders a whole amount without a fraction glyph', () => {
      expect(resolveDisplayedIngredients([ingredient({quantity: 2})], 'full', 1, 1)[0].quantityText).toBe('2 cup')
    })

    it('combines the whole part with the fraction glyph', () => {
      expect(resolveDisplayedIngredients([ingredient({quantity: 1.5})], 'full', 1, 1)[0].quantityText).toBe('1½ cup')
    })

    it('falls back to a decimal for an amount off the fraction ladder', () => {
      const stored = resolveDisplayedIngredients([ingredient({quantity: 1.2})], 'full', 1, 1)
      const scaled = resolveDisplayedIngredients([ingredient({quantity: 2})], 'portion', 1, 3)

      expect(stored[0].quantityText).toBe('1.2 cup')
      expect(scaled[0].quantityText).toBe('0.67 cup')
    })

    it('appends the unit and leaves a unit-less count bare', () => {
      const measured = resolveDisplayedIngredients([ingredient({quantity: 1.5})], 'portion', 1, 2)
      const counted = resolveDisplayedIngredients([ingredient({quantity: 1, unit: ''})], 'portion', 1, 4)

      expect(measured[0].quantityText).toBe('¾ cup')
      expect(counted[0].quantityText).toBe('¼')
    })

    it('treats a blank unit as unit-less', () => {
      const displayed = resolveDisplayedIngredients([ingredient({quantity: 1, unit: '  '})], 'full', 1, 1)

      expect(displayed[0].quantityText).toBe('1')
    })

    it('renders a zero amount as 0', () => {
      const measured = resolveDisplayedIngredients([ingredient({quantity: 0})], 'full', 1, 1)
      const counted = resolveDisplayedIngredients([ingredient({quantity: 0, unit: ''})], 'portion', 1, 2)

      expect(measured[0].quantityText).toBe('0 cup')
      expect(counted[0].quantityText).toBe('0')
    })
  })

  describe('edge cases', () => {
    it('returns an empty array for an empty ingredient list in either mode', () => {
      expect(resolveDisplayedIngredients([], 'portion', 1, 4)).toEqual([])
      expect(resolveDisplayedIngredients([], 'full', 1, 4)).toEqual([])
    })

    it('leaves the amount unscaled for a zero or negative yield', () => {
      const zeroYield = resolveDisplayedIngredients([ingredient()], 'portion', 1, 0)
      const negativeYield = resolveDisplayedIngredients([ingredient()], 'portion', 1, -2)

      expect(zeroYield[0].quantityText).toBe('1½ cup')
      expect(negativeYield[0].quantityText).toBe('1½ cup')
    })

    it('leaves the amount unscaled for a non-finite yield without rendering NaN or Infinity', () => {
      const notANumber = resolveDisplayedIngredients([ingredient()], 'portion', 1, Number.NaN)
      const infinite = resolveDisplayedIngredients([ingredient()], 'portion', 1, Number.POSITIVE_INFINITY)

      expect(notANumber[0].quantityText).toBe('1½ cup')
      expect(notANumber[0].quantityText).not.toContain('NaN')
      expect(infinite[0].quantityText).toBe('1½ cup')
      expect(infinite[0].quantityText).not.toContain('Infinity')
    })

    it('leaves the amount unscaled for a non-finite portion multiplier without rendering NaN or Infinity', () => {
      const notANumber = resolveDisplayedIngredients([ingredient()], 'portion', Number.NaN, 2)
      const infinite = resolveDisplayedIngredients([ingredient()], 'portion', Number.POSITIVE_INFINITY, 2)

      expect(notANumber[0].quantityText).toBe('1½ cup')
      expect(notANumber[0].quantityText).not.toContain('NaN')
      expect(infinite[0].quantityText).toBe('1½ cup')
      expect(infinite[0].quantityText).not.toContain('Infinity')
    })

    it('falls back to the stored display text for a non-finite quantity', () => {
      const unmeasured = ingredient({quantity: Number.NaN, unit: 'tsp', displayText: 'a pinch'})
      const portion = resolveDisplayedIngredients([unmeasured], 'portion', 1, 2)
      const full = resolveDisplayedIngredients([unmeasured], 'full', 1, 2)

      expect(portion[0].quantityText).toBe('a pinch')
      expect(full[0].quantityText).toBe('a pinch')
    })
  })
})

describe('resolvePlannedNutrition', () => {
  describe('rounding contract', () => {
    it('rounds each macro once and independently, taking a half upwards', () => {
      expect(resolvePlannedNutrition({perServing: perServing(), portionMultiplier: 1.5})).toEqual({
        calories: 347,
        protein: 2,
        carbs: 75,
        fat: 5
      })
    })

    it('sums the independently rounded macros rather than rounding their sum', () => {
      const source = {perServing: perServing(), portionMultiplier: 1.5}
      const planned = resolvePlannedNutrition(source)
      const macroGrams = source.perServing.protein + source.perServing.carbs + source.perServing.fat
      const roundedSumOfUnroundedMacros = Math.round(macroGrams * source.portionMultiplier)

      expect(planned.protein + planned.carbs + planned.fat).toBe(82)
      expect(roundedSumOfUnroundedMacros).toBe(81)
    })

    it('rounds every half of an odd per-serving value upwards', () => {
      const halves = perServing({calories: 611, protein: 45, carbs: 59, fat: 21})

      expect(resolvePlannedNutrition({perServing: halves, portionMultiplier: 0.5})).toEqual({
        calories: 306,
        protein: 23,
        carbs: 30,
        fat: 11
      })
    })

    it('returns already-integral per-serving values unchanged at a full portion', () => {
      const totals = perServing({calories: 610, protein: 45, carbs: 58, fat: 21})

      expect(resolvePlannedNutrition({perServing: totals, portionMultiplier: 1})).toEqual({
        calories: 610,
        protein: 45,
        carbs: 58,
        fat: 21
      })
    })
  })

  describe('source precedence', () => {
    it('returns the server planned totals and ignores per-serving scaling supplied alongside them', () => {
      const source: PlannedNutritionSource = {
        planned: {calories: 610, protein: 45, carbs: 58, fat: 21},
        perServing: perServing(),
        portionMultiplier: 2
      }

      expect(resolvePlannedNutrition(source)).toEqual({calories: 610, protein: 45, carbs: 58, fat: 21})
    })

    it('rounds server planned totals that arrive fractional', () => {
      const planned = {calories: 609.5, protein: 45.4, carbs: 57.6, fat: 20.5}

      expect(resolvePlannedNutrition({planned})).toEqual({calories: 610, protein: 45, carbs: 58, fat: 21})
    })

    it('computes from the per-serving values when no planned totals are supplied', () => {
      const fallback = resolvePlannedNutrition({perServing: perServing(), portionMultiplier: 2})

      expect(fallback).toEqual({calories: 462, protein: 2, carbs: 100, fat: 6})
    })
  })
})

describe('buildMetricGridItems', () => {
  it('returns four items in calorie, protein, carbs, fat order with every caption from the parameter', () => {
    const items = buildMetricGridItems({calories: 610, protein: 45, carbs: 58, fat: 21}, captions)

    expect(items).toHaveLength(4)
    expect(items).toEqual([
      {caption: 'CAL_CAPTION', value: '610'},
      {caption: 'PROTEIN_CAPTION', value: '45g'},
      {caption: 'CARBS_CAPTION', value: '58g'},
      {caption: 'FAT_CAPTION', value: '21g'}
    ])
  })

  it('separates thousands in the calorie value', () => {
    const items = buildMetricGridItems({calories: 1940, protein: 146, carbs: 194, fat: 65}, captions)

    expect(items[0].value).toBe('1,940')
  })

  it('rounds fractional values before formatting them', () => {
    const items = buildMetricGridItems({calories: 609.6, protein: 45.4, carbs: 57.5, fat: 20.4}, captions)

    expect(items.map(item => item.value)).toEqual(['610', '45g', '58g', '20g'])
  })

  it('renders zero macros as 0g rather than omitting them', () => {
    const items = buildMetricGridItems({calories: 0, protein: 0, carbs: 0, fat: 0}, captions)

    expect(items.map(item => item.value)).toEqual(['0', '0g', '0g', '0g'])
  })
})

describe('buildContextPillText', () => {
  it('joins the slot label, the weekday with its date, and the time with a middle dot', () => {
    expect(buildContextPillText('lunch', '2025-07-05', '12:30', slotLabels)).toBe('Midday plate · Sat Jul 5 · 12:30 PM')
  })

  it('returns natural case so the uppercase treatment stays in the stylesheet', () => {
    const text = buildContextPillText('lunch', '2025-07-05', '12:30', slotLabels)

    expect(text).toBe('Midday plate · Sat Jul 5 · 12:30 PM')
    expect(text).not.toBe(text.toUpperCase())
  })

  it('labels each slot from the parameter', () => {
    expect(buildContextPillText('breakfast', '2025-07-05', '08:00', slotLabels)).toBe(
      'Morning plate · Sat Jul 5 · 8:00 AM'
    )
    expect(buildContextPillText('lunch', '2025-07-05', '12:30', slotLabels)).toBe('Midday plate · Sat Jul 5 · 12:30 PM')
    expect(buildContextPillText('dinner', '2025-07-05', '18:30', slotLabels)).toBe(
      'Evening plate · Sat Jul 5 · 6:30 PM'
    )
    expect(buildContextPillText('snack', '2025-07-05', '15:30', slotLabels)).toBe('Small bite · Sat Jul 5 · 3:30 PM')
  })

  it('derives the weekday from the day key', () => {
    expect(buildContextPillText('lunch', '2026-07-05', '12:30', slotLabels)).toBe('Midday plate · Sun Jul 5 · 12:30 PM')
  })

  it('formats a day key in another month', () => {
    expect(buildContextPillText('breakfast', '2026-12-01', '08:00', slotLabels)).toBe(
      'Morning plate · Tue Dec 1 · 8:00 AM'
    )
  })

  it('formats morning, noon and midnight times', () => {
    const morning = buildContextPillText('breakfast', '2026-12-01', '08:00', slotLabels)
    const noon = buildContextPillText('lunch', '2026-12-01', '12:00', slotLabels)
    const midnight = buildContextPillText('snack', '2026-12-01', '00:00', slotLabels)

    expect(morning).toBe('Morning plate · Tue Dec 1 · 8:00 AM')
    expect(noon).toBe('Midday plate · Tue Dec 1 · 12:00 PM')
    expect(midnight).toBe('Small bite · Tue Dec 1 · 12:00 AM')
  })

  it('drops the slot segment when the label map has no entry for the slot', () => {
    expect(buildContextPillText('snack', '2025-07-05', '15:30', {lunch: 'Midday plate'})).toBe('Sat Jul 5 · 3:30 PM')
  })
})

describe('resolveBadgeLabels', () => {
  it('maps known codes to their labels in input order', () => {
    expect(resolveBadgeLabels(['dairy_free', 'high_protein'], badgeLabels)).toEqual(['No dairy', 'Protein rich'])
  })

  it('keeps every badge a recipe can declare', () => {
    expect(resolveBadgeLabels(['high_protein', 'gluten_free', 'dairy_free', 'vegan', 'quick'], badgeLabels)).toEqual([
      'Protein rich',
      'No gluten',
      'No dairy',
      'Plant based',
      'Under 15'
    ])
  })

  it('drops a code the label map does not know instead of rendering it raw', () => {
    expect(resolveBadgeLabels(['high_protein', asBadge('not_a_badge')], badgeLabels)).toEqual(['Protein rich'])
  })

  it('returns an empty array when every code is unknown', () => {
    expect(resolveBadgeLabels([asBadge('not_a_badge'), asBadge('also_unknown')], badgeLabels)).toEqual([])
  })

  it('returns an empty array for a recipe with no badges', () => {
    expect(resolveBadgeLabels([], badgeLabels)).toEqual([])
  })

  it('drops a code whose label is blank', () => {
    expect(resolveBadgeLabels(['quick'], {quick: ''})).toEqual([])
  })
})

describe('shouldShowBadgeCaption', () => {
  it('shows the caption when at least one label survives', () => {
    expect(shouldShowBadgeCaption(resolveBadgeLabels(['vegan'], badgeLabels))).toBe(true)
  })

  it('hides the caption for an empty label list', () => {
    expect(shouldShowBadgeCaption([])).toBe(false)
  })

  it('hides the caption when every badge code was dropped as unknown', () => {
    expect(shouldShowBadgeCaption(resolveBadgeLabels([asBadge('not_a_badge')], badgeLabels))).toBe(false)
  })
})

describe('resolveActionBarState', () => {
  describe('preview context', () => {
    it('hides the action bar for an active plan', () => {
      expect(resolveActionBarState('preview', 'active')).toEqual({isVisible: false, isEnabled: true})
    })

    it('hides the action bar when the plan status has not loaded', () => {
      expect(resolveActionBarState('preview', null)).toEqual({isVisible: false, isEnabled: false})
      expect(resolveActionBarState('preview', undefined)).toEqual({isVisible: false, isEnabled: false})
    })

    it('hides the action bar for a superseded plan', () => {
      expect(resolveActionBarState('preview', 'superseded')).toEqual({isVisible: false, isEnabled: false})
    })
  })

  describe('plan context', () => {
    it('shows and enables the action bar for an active plan', () => {
      expect(resolveActionBarState('plan', 'active')).toEqual({isVisible: true, isEnabled: true})
    })

    it('shows but disables the action bar for a superseded plan', () => {
      expect(resolveActionBarState('plan', 'superseded')).toEqual({isVisible: true, isEnabled: false})
    })

    it('shows but disables the action bar when the plan status is null', () => {
      expect(resolveActionBarState('plan', null)).toEqual({isVisible: true, isEnabled: false})
    })

    it('shows but disables the action bar when the plan status is undefined', () => {
      expect(resolveActionBarState('plan', undefined)).toEqual({isVisible: true, isEnabled: false})
    })
  })
})

describe('resolveRecipeDetailErrorBranch', () => {
  it('sends a 404 to the not-found branch whatever code the body carried', () => {
    expect(resolveRecipeDetailErrorBranch(404, null)).toBe('not_found')
    expect(resolveRecipeDetailErrorBranch(404, undefined)).toBe('not_found')
    expect(resolveRecipeDetailErrorBranch(404, 'Recipe not found')).toBe('not_found')
    expect(resolveRecipeDetailErrorBranch(404, 'recipe_ineligible')).toBe('not_found')
  })

  it('never reads a resource-route 404 as feature unavailable, the inline card being the only other branch', () => {
    expect(resolveRecipeDetailErrorBranch(404, 'feature_disabled')).toBe('not_found')
    expect(resolveRecipeDetailErrorBranch(404, 'feature_disabled')).not.toBe('inline')
  })

  it('sends a lost or unreadable response to the inline retry branch', () => {
    expect(resolveRecipeDetailErrorBranch(null, null)).toBe('inline')
    expect(resolveRecipeDetailErrorBranch(undefined, null)).toBe('inline')
    expect(resolveRecipeDetailErrorBranch(502, null)).toBe('inline')
  })

  it('sends a server failure to the inline retry branch', () => {
    expect(resolveRecipeDetailErrorBranch(500, null)).toBe('inline')
    expect(resolveRecipeDetailErrorBranch(502, 'swap_failed')).toBe('inline')
  })

  it('sends a non-404 client error to the inline retry branch', () => {
    expect(resolveRecipeDetailErrorBranch(400, 'invalid_request')).toBe('inline')
    expect(resolveRecipeDetailErrorBranch(403, null)).toBe('inline')
    expect(resolveRecipeDetailErrorBranch(409, 'stale_plan')).toBe('inline')
  })

  it('sends a disabled-feature response to the inline branch, since this is not the capability check', () => {
    expect(resolveRecipeDetailErrorBranch(503, 'feature_disabled')).toBe('inline')
  })
})
