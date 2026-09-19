import {MacroTotals} from '@data/models/Macros'
import {RecipeBadge, RecipeIngredient} from '@data/models/Recipe'
import {RecipeDetailContext} from '@navigation/types'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {DisplayedIngredient} from '@utility/ServingsUtility'

import RecipeRow from '../components/RecipeRow'
import {placeholderWidth} from '../index.styled'
import {
  buildContextPillText,
  buildMetricGridItems,
  buildRecipeDetailSections,
  isSameRecipeRow,
  PlannedNutritionSource,
  previewQueryScope,
  RecipeDetailReadState,
  RecipeDetailRow,
  RecipeDetailSection,
  resolveActionBarState,
  resolveBadgeLabels,
  resolveDisplayedIngredients,
  resolvePlannedNutrition,
  resolveRecipeDetailErrorBranch,
  resolveRecipeDetailRead,
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

      expect(displayed[0].quantityText).toBe('1½ cups')
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
      // Each row here is a bare count, so it carries no published text naming a unit; a row whose
      // stored columns and published text disagree would have the text's phrasing carried forward.
      const counted = {unit: '', displayText: ''}
      const quarter = resolveDisplayedIngredients([ingredient({quantity: 1, ...counted})], 'portion', 1, 4)
      const third = resolveDisplayedIngredients([ingredient({quantity: 1, ...counted})], 'portion', 1, 3)
      const half = resolveDisplayedIngredients([ingredient({quantity: 1, ...counted})], 'portion', 1, 2)
      const twoThirds = resolveDisplayedIngredients([ingredient({quantity: 1.32, ...counted})], 'portion', 1, 2)
      const threeQuarters = resolveDisplayedIngredients([ingredient({quantity: 1.5, ...counted})], 'portion', 1, 2)

      expect([quarter, third, half, twoThirds, threeQuarters].map(([item]) => item.quantityText)).toEqual([
        '¼',
        '⅓',
        '½',
        '⅔',
        '¾'
      ])
    })

    it('renders a whole amount without a fraction glyph', () => {
      // Scaled rather than whole-recipe, so the amount is re-derived instead of read from the
      // recipe's own published text.
      expect(resolveDisplayedIngredients([ingredient({quantity: 4})], 'portion', 1, 2)[0].quantityText).toBe('2 cups')
    })

    it('combines the whole part with the fraction glyph', () => {
      expect(resolveDisplayedIngredients([ingredient({quantity: 1.5})], 'full', 1, 1)[0].quantityText).toBe('1½ cup')
    })

    it('snaps an amount off the fraction ladder to the nearest stop rather than printing a decimal', () => {
      const stored = resolveDisplayedIngredients([ingredient({quantity: 1.2, displayText: ''})], 'full', 1, 1)
      const scaled = resolveDisplayedIngredients([ingredient({quantity: 2})], 'portion', 1, 3)

      expect(stored[0].quantityText).toBe('1¼ cups')
      expect(scaled[0].quantityText).toBe('⅔ cup')
    })

    it('appends the unit and leaves a unit-less count bare', () => {
      const measured = resolveDisplayedIngredients([ingredient({quantity: 1.5})], 'portion', 1, 2)
      const counted = resolveDisplayedIngredients([ingredient({quantity: 1, unit: ''})], 'portion', 1, 4)

      expect(measured[0].quantityText).toBe('¾ cup')
      expect(counted[0].quantityText).toBe('¼')
    })

    it('treats a blank unit as unit-less', () => {
      const displayed = resolveDisplayedIngredients(
        [ingredient({quantity: 2, unit: '  ', displayText: ''})],
        'portion',
        1,
        2
      )

      expect(displayed[0].quantityText).toBe('1')
    })

    it('renders a zero amount as 0', () => {
      const measured = resolveDisplayedIngredients([ingredient({quantity: 0, displayText: ''})], 'full', 1, 1)
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

// The input is the day envelope's writeability verdict, which is what distinguishes a week that still accepts
// writes from one that merely remains stored 'active' after its last day.
describe('resolveActionBarState', () => {
  describe('preview context', () => {
    it('hides the action bar for a writable plan', () => {
      expect(resolveActionBarState('preview', true)).toEqual({isVisible: false, isEnabled: true, isPending: false})
    })

    it('hides the action bar when the day envelope has not loaded', () => {
      expect(resolveActionBarState('preview', null)).toEqual({isVisible: false, isEnabled: false, isPending: true})
      expect(resolveActionBarState('preview', undefined)).toEqual({
        isVisible: false,
        isEnabled: false,
        isPending: true
      })
    })

    it('hides the action bar for a plan that no longer accepts writes', () => {
      expect(resolveActionBarState('preview', false)).toEqual({isVisible: false, isEnabled: false, isPending: false})
    })
  })

  describe('plan context', () => {
    it('shows and enables the action bar for a writable plan', () => {
      expect(resolveActionBarState('plan', true)).toEqual({isVisible: true, isEnabled: true, isPending: false})
    })

    // Both ways a plan stops accepting writes arrive as the same verdict: a regeneration replaced it, or its
    // week has finished — which storage still records as 'active', so nothing else on the envelope says it.
    // A refusal is answered, so the controls stay pressable and explain themselves rather than going inert.
    it('shows the action bar pressable but not enabled for a plan that no longer accepts writes', () => {
      expect(resolveActionBarState('plan', false)).toEqual({isVisible: true, isEnabled: false, isPending: false})
    })

    // The display-only seeded envelope carries null, and no local value may stand in for a verdict computed
    // in the user's saved zone — so the bar waits rather than claiming the plan is either live or gone.
    it('shows the action bar pending when the verdict is null', () => {
      expect(resolveActionBarState('plan', null)).toEqual({isVisible: true, isEnabled: false, isPending: true})
    })

    it('shows the action bar pending when there is no envelope at all', () => {
      expect(resolveActionBarState('plan', undefined)).toEqual({isVisible: true, isEnabled: false, isPending: true})
    })

    it('never reports a verdict as both refused and pending', () => {
      const states = [true, false, null, undefined].map(verdict => resolveActionBarState('plan', verdict))

      states.forEach(state => expect(state.isEnabled && state.isPending).toBe(false))
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

const apiError = (status: number, code: string | null = null): unknown => ({
  response: {status, data: code === null ? {} : {error: code}}
})

const lostResponse = (): unknown => new Error('Network Error')

// A rejection whose body decoded to a machine code but which never reached a status — a transport failure that
// still carried a payload. AAP 0.2.5 classifies that as an UNKNOWN outcome whatever code it echoed, so nothing
// may be latched or abandoned on it.
const codeWithoutStatus = (code: string): unknown => ({response: {data: {error: code}}})

const readState = (overrides: Partial<RecipeDetailReadState> = {}): RecipeDetailReadState => ({
  recipeError: null,
  dayError: null,
  previewError: null,
  isReadInFlight: false,
  hasContent: true,
  ...overrides
})

describe('resolveRecipeDetailRead', () => {
  describe('per-route classification', () => {
    // The defect this covers: one collapsed `recipeQuery.error ?? dayQuery.error` made every 404 read as
    // "this recipe isn't available", so a plan day that was gone popped a screen whose recipe had loaded.
    it('reports a recipe 404 as the recipe being unavailable', () => {
      const outcome = resolveRecipeDetailRead(readState({recipeError: apiError(404), hasContent: false}))

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'recipeUnavailable'})
    })

    it('reports a day 404 as plan recovery, never as the recipe being unavailable', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: apiError(404)}))

      expect(outcome.failure).toEqual({source: 'day', recovery: 'planRecovery'})
      expect(outcome.failure?.recovery).not.toBe('recipeUnavailable')
    })

    it('reports a preview 404 as plan recovery against the preview read', () => {
      const outcome = resolveRecipeDetailRead(readState({previewError: apiError(404)}))

      expect(outcome.failure).toEqual({source: 'preview', recovery: 'planRecovery'})
    })

    it('reports both confirmed plan-state codes as plan recovery', () => {
      const stale = resolveRecipeDetailRead(readState({dayError: apiError(409, API_ERROR_CODES.stalePlan)}))
      const notActive = resolveRecipeDetailRead(readState({dayError: apiError(409, API_ERROR_CODES.planNotActive)}))

      expect(stale.failure).toEqual({source: 'day', recovery: 'planRecovery'})
      expect(notActive.failure).toEqual({source: 'day', recovery: 'planRecovery'})
    })

    // A 5xx echoing a plan-state code is an UNKNOWN outcome: nothing described this attempt, so a second one
    // may well load the screen the user is on. Sending them through plan recovery on that would abandon it.
    it('keeps an unconfirmed plan-state echo on the retry branch', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: apiError(502, API_ERROR_CODES.stalePlan)}))

      expect(outcome.failure).toEqual({source: 'day', recovery: 'retry'})
    })

    // The defect this covers: a confirmed `503 feature_disabled` was classified as a generic retry, so the
    // screen drew a Try-again card whose press can never succeed — the app-wide retry policy refuses to retry a
    // confirmed error, and the same gated route answers a repeat request identically. Every one of the three
    // routes is gated (AAP 0.3.1), so every one of them can say it, and the answer is the departure for the tab
    // whose entitlement router states the refusal (AAP 0.2.5).
    it('leaves for the plan tab on a confirmed disabled-feature answer from the recipe read', () => {
      const outcome = resolveRecipeDetailRead(
        readState({recipeError: apiError(503, API_ERROR_CODES.featureDisabled), hasContent: false})
      )

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'exitToPlanTab'})
    })

    it('leaves for the plan tab on a confirmed disabled-feature answer from the day read', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: apiError(503, API_ERROR_CODES.featureDisabled)}))

      expect(outcome.failure).toEqual({source: 'day', recovery: 'exitToPlanTab'})
    })

    it('leaves for the plan tab on a confirmed disabled-feature answer from the preview read', () => {
      const outcome = resolveRecipeDetailRead(readState({previewError: apiError(503, API_ERROR_CODES.featureDisabled)}))

      expect(outcome.failure).toEqual({source: 'preview', recovery: 'exitToPlanTab'})
    })

    // The status is part of what makes it the capability's answer, and on THIS route that matters: AAP 0.5.2
    // makes a 404 from `/recipes/:id` the not-found/not-yours answer and never an unavailability signal, so a
    // 404 carrying the code is still this recipe's own terminal answer — the screen leaves, but as a recipe it
    // cannot show rather than as a feature that is off, and the session is not latched behind it.
    it('reads a 404 carrying the disabled-feature code as this recipe’s own terminal answer', () => {
      const outcome = resolveRecipeDetailRead(readState({recipeError: apiError(404, API_ERROR_CODES.featureDisabled)}))

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'recipeUnavailable'})
    })

    // Any other 4xx carrying the code is some other refusal of this request, and a gateway 5xx echoing it
    // describes nothing about the attempt — both stay on the retry card a second attempt can clear.
    it('keeps a disabled-feature code on a non-503 status on the retry branch', () => {
      expect(
        resolveRecipeDetailRead(readState({recipeError: apiError(403, API_ERROR_CODES.featureDisabled)})).failure
      ).toEqual({source: 'recipe', recovery: 'retry'})
      expect(
        resolveRecipeDetailRead(readState({dayError: apiError(502, API_ERROR_CODES.featureDisabled)})).failure
      ).toEqual({source: 'day', recovery: 'retry'})
    })

    // No status means nothing described this attempt, so the code it echoed describes nothing either: a second
    // attempt may well load the screen, and abandoning it on an unknown outcome would strand a user whose
    // capability is perfectly live.
    it('keeps a disabled-feature code that reached no status on the retry branch', () => {
      const codeOnly = codeWithoutStatus(API_ERROR_CODES.featureDisabled)

      expect(resolveRecipeDetailRead(readState({recipeError: codeOnly})).failure).toEqual({
        source: 'recipe',
        recovery: 'retry'
      })
      expect(resolveRecipeDetailRead(readState({dayError: codeOnly})).failure).toEqual({
        source: 'day',
        recovery: 'retry'
      })
      expect(resolveRecipeDetailRead(readState({previewError: codeOnly})).failure).toEqual({
        source: 'preview',
        recovery: 'retry'
      })
    })

    // A 5xx is confirmed only for a recognised machine code, and an unrelated one is not the capability's.
    it('keeps a server failure carrying an unrelated code on the retry branch', () => {
      const outcome = resolveRecipeDetailRead(readState({recipeError: apiError(500, API_ERROR_CODES.invalidRequest)}))

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'retry'})
    })

    it('puts a lost or unreadable response on the retry branch for every read', () => {
      expect(resolveRecipeDetailRead(readState({recipeError: lostResponse()})).failure).toEqual({
        source: 'recipe',
        recovery: 'retry'
      })
      expect(resolveRecipeDetailRead(readState({dayError: lostResponse()})).failure).toEqual({
        source: 'day',
        recovery: 'retry'
      })
      expect(resolveRecipeDetailRead(readState({previewError: lostResponse()})).failure).toEqual({
        source: 'preview',
        recovery: 'retry'
      })
    })

    it('reports no failure when no read has failed', () => {
      expect(resolveRecipeDetailRead(readState()).failure).toBeNull()
    })

    it('ignores the preview read in the plan context, where the field is absent', () => {
      const outcome = resolveRecipeDetailRead({
        recipeError: null,
        dayError: null,
        isReadInFlight: false,
        hasContent: true
      })

      expect(outcome.failure).toBeNull()
      expect(outcome.isSavedCopy).toBe(false)
    })
  })

  describe('precedence between reads', () => {
    it('leaves the screen on a recipe 404 even when a plan route also refused', () => {
      const outcome = resolveRecipeDetailRead(
        readState({recipeError: apiError(404), dayError: apiError(409, API_ERROR_CODES.stalePlan)})
      )

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'recipeUnavailable'})
    })

    it('prefers a plan refusal over a merely retryable failure of another read', () => {
      const outcome = resolveRecipeDetailRead(
        readState({recipeError: apiError(500), dayError: apiError(409, API_ERROR_CODES.planNotActive)})
      )

      expect(outcome.failure).toEqual({source: 'day', recovery: 'planRecovery'})
    })

    it('names the recipe read first when every failure is retryable', () => {
      const outcome = resolveRecipeDetailRead(readState({recipeError: apiError(500), dayError: apiError(500)}))

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'retry'})
    })

    // The capability is about the feature rather than about this recipe or this plan, so it governs every other
    // answer beside it: a plan refetch behind a route that answers 503 is the one recovery that cannot succeed,
    // and a recipe the server never spoke about must not be reported as missing (AAP 0.2.5).
    it('leaves for the plan tab rather than reporting the recipe missing when both answered', () => {
      const outcome = resolveRecipeDetailRead(
        readState({
          recipeError: apiError(404),
          dayError: apiError(503, API_ERROR_CODES.featureDisabled),
          hasContent: false
        })
      )

      expect(outcome.failure).toEqual({source: 'day', recovery: 'exitToPlanTab'})
    })

    it('leaves for the plan tab rather than recovering a plan the day read said moved on', () => {
      const outcome = resolveRecipeDetailRead(
        readState({
          recipeError: apiError(503, API_ERROR_CODES.featureDisabled),
          dayError: apiError(409, API_ERROR_CODES.stalePlan)
        })
      )

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'exitToPlanTab'})
    })

    it('leaves for the plan tab rather than retiring a candidate the preview read refused', () => {
      const outcome = resolveRecipeDetailRead(
        readState({
          recipeError: apiError(503, API_ERROR_CODES.featureDisabled),
          previewError: apiError(422, API_ERROR_CODES.recipeIneligible)
        })
      )

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'exitToPlanTab'})
    })
  })

  describe('failures over cached content', () => {
    // The defect this covers: the error branch used to live inside the missing-data guard, so a failed read
    // behind a seeded plan day rendered as ordinary, authoritative-looking content.
    it('discloses content shown over a failed read as a saved copy', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: lostResponse(), hasContent: true}))

      expect(outcome).toEqual({
        placeholder: 'none',
        failure: {source: 'day', recovery: 'retry'},
        isSavedCopy: true,
        isWriteUnconfirmed: true
      })
    })

    it('discloses a saved copy for a plan refusal too, and keeps the recovery', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: apiError(404), hasContent: true}))

      expect(outcome.isSavedCopy).toBe(true)
      expect(outcome.failure?.recovery).toBe('planRecovery')
    })

    it('never calls content a saved copy when nothing failed', () => {
      expect(resolveRecipeDetailRead(readState()).isSavedCopy).toBe(false)
      expect(resolveRecipeDetailRead(readState({isReadInFlight: true})).isSavedCopy).toBe(false)
    })

    // The screen is already popping, so there is nothing to disclose and nothing to retry.
    it('never calls content a saved copy when the recipe itself is gone', () => {
      const outcome = resolveRecipeDetailRead(readState({recipeError: apiError(404), hasContent: true}))

      expect(outcome.isSavedCopy).toBe(false)
      expect(outcome.placeholder).toBe('none')
    })

    // The screen is leaving for the tab that states the refusal, so neither the retry card nor the saved-copy
    // banner is drawn over the cached recipe — but the write stays withheld, because the plan revision it would
    // be pinned to is exactly what could not be confirmed.
    it('draws no card and no banner over cached content for a capability refusal, and still offers no write', () => {
      const outcome = resolveRecipeDetailRead(
        readState({dayError: apiError(503, API_ERROR_CODES.featureDisabled), hasContent: true})
      )

      expect(outcome).toEqual({
        placeholder: 'none',
        failure: {source: 'day', recovery: 'exitToPlanTab'},
        isSavedCopy: false,
        isWriteUnconfirmed: true
      })
    })
  })

  describe('the placeholder that stands in for absent content', () => {
    it('shows the loading strip while a read is still in flight', () => {
      expect(resolveRecipeDetailRead(readState({hasContent: false, isReadInFlight: true})).placeholder).toBe('loading')
    })

    // Every read has answered and the meal this route names is still not among them — swapped, regenerated or
    // logged away under the screen. A skeleton waiting for a read that already returned never resolves.
    it('shows the retry card when the reads settled with nothing to render and nothing to report', () => {
      expect(resolveRecipeDetailRead(readState({hasContent: false, isReadInFlight: false})).placeholder).toBe('error')
    })

    it('shows the retry card once a read has failed with nothing to render', () => {
      expect(resolveRecipeDetailRead(readState({hasContent: false, dayError: lostResponse()})).placeholder).toBe(
        'error'
      )
    })

    // Kept through the refetch a Try-again press starts, so the card does not flash back to a skeleton.
    it('keeps the retry card while the retry is in flight', () => {
      const outcome = resolveRecipeDetailRead(
        readState({hasContent: false, dayError: lostResponse(), isReadInFlight: true})
      )

      expect(outcome.placeholder).toBe('error')
    })

    it('shows no placeholder at all for a recipe 404', () => {
      expect(resolveRecipeDetailRead(readState({hasContent: false, recipeError: apiError(404)})).placeholder).toBe(
        'none'
      )
    })

    it('shows no placeholder once there is content', () => {
      expect(resolveRecipeDetailRead(readState()).placeholder).toBe('none')
      expect(resolveRecipeDetailRead(readState({dayError: lostResponse()})).placeholder).toBe('none')
    })
  })

  describe("the preview read's own recovery", () => {
    // The defect this covers: every non-404, non-plan-state preview failure was classified as a generic retry,
    // so a candidate the server had confirmed no longer fits the plan was offered again instead of retired.
    // AAP 0.2.5 states one error rule per query, and this is `useSwapPreviewQuery`'s own.
    it('retires the candidate on a confirmed recipe_ineligible from the preview read', () => {
      const outcome = resolveRecipeDetailRead(
        readState({previewError: apiError(422, API_ERROR_CODES.recipeIneligible)})
      )

      expect(outcome.failure).toEqual({source: 'preview', recovery: 'previewIneligible'})
    })

    // A 5xx that merely echoed the code described nothing about this attempt, so retiring a candidate on it
    // would discard one the server never refused.
    it('keeps an unconfirmed recipe_ineligible echo on the retry branch', () => {
      const outcome = resolveRecipeDetailRead(
        readState({previewError: apiError(502, API_ERROR_CODES.recipeIneligible)})
      )

      expect(outcome.failure).toEqual({source: 'preview', recovery: 'retry'})
    })

    // Only the preview route has a candidate to refuse; the day route never speaks about one.
    it('never retires a candidate on a recipe_ineligible from the day read', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: apiError(422, API_ERROR_CODES.recipeIneligible)}))

      expect(outcome.failure).toEqual({source: 'day', recovery: 'retry'})
    })

    it('offers the read again when the preview attempt reached no response', () => {
      const outcome = resolveRecipeDetailRead(readState({previewError: lostResponse(), hasContent: false}))

      expect(outcome.failure).toEqual({source: 'preview', recovery: 'retry'})
    })

    it('keeps the plan-state answers it shares with the day read on plan recovery', () => {
      const stale = resolveRecipeDetailRead(readState({previewError: apiError(409, API_ERROR_CODES.stalePlan)}))
      const notActive = resolveRecipeDetailRead(readState({previewError: apiError(409, API_ERROR_CODES.planNotActive)}))

      expect(stale.failure).toEqual({source: 'preview', recovery: 'planRecovery'})
      expect(notActive.failure).toEqual({source: 'preview', recovery: 'planRecovery'})
    })

    // A retired candidate leaves the screen, so there is nothing to disclose as a saved copy and nothing to
    // offer again on the way out.
    it('leaves the screen on a retired candidate rather than disclosing a saved copy', () => {
      const outcome = resolveRecipeDetailRead(
        readState({previewError: apiError(422, API_ERROR_CODES.recipeIneligible), hasContent: true})
      )

      expect(outcome.isSavedCopy).toBe(false)
      expect(outcome.placeholder).toBe('none')
    })

    it('draws no retry card for a retired candidate with nothing cached', () => {
      const outcome = resolveRecipeDetailRead(
        readState({previewError: apiError(422, API_ERROR_CODES.recipeIneligible), hasContent: false})
      )

      expect(outcome.placeholder).toBe('none')
    })

    // With no cached preview the hero above is a bare skeleton, so this card is the only control on screen and
    // is what has to carry both the retry and the way back to the alternatives.
    it('draws the retry card when a retryable preview failure left nothing cached', () => {
      const outcome = resolveRecipeDetailRead(readState({previewError: apiError(500), hasContent: false}))

      expect(outcome).toEqual({
        placeholder: 'error',
        failure: {source: 'preview', recovery: 'retry'},
        isSavedCopy: false,
        isWriteUnconfirmed: true
      })
    })

    it('retires the candidate ahead of a plan refusal the day read reported', () => {
      const outcome = resolveRecipeDetailRead(
        readState({
          dayError: apiError(409, API_ERROR_CODES.stalePlan),
          previewError: apiError(422, API_ERROR_CODES.recipeIneligible)
        })
      )

      expect(outcome.failure).toEqual({source: 'preview', recovery: 'previewIneligible'})
    })

    it('leaves on the missing recipe rather than the retired candidate when both answered', () => {
      const outcome = resolveRecipeDetailRead(
        readState({recipeError: apiError(404), previewError: apiError(422, API_ERROR_CODES.recipeIneligible)})
      )

      expect(outcome.failure).toEqual({source: 'recipe', recovery: 'recipeUnavailable'})
    })
  })

  describe('whether a write may be offered', () => {
    // The defect this covers: the action bar read the day's verdict alone, and the day route answers
    // independently of the recipe read. A day that had already answered `isWritable: true` beside a recipe
    // still in flight enabled Log and Swap over a skeleton.
    it('withholds the write while a required read is still in flight', () => {
      const outcome = resolveRecipeDetailRead(readState({hasContent: false, isReadInFlight: true}))

      expect(outcome.isWriteUnconfirmed).toBe(true)
      expect(resolveActionBarState('plan', true, outcome.isWriteUnconfirmed)).toEqual({
        isVisible: true,
        isEnabled: false,
        isPending: true
      })
    })

    it('withholds the write when a required read failed with nothing cached', () => {
      const outcome = resolveRecipeDetailRead(readState({hasContent: false, recipeError: lostResponse()}))

      expect(outcome.isWriteUnconfirmed).toBe(true)
      expect(resolveActionBarState('plan', true, outcome.isWriteUnconfirmed).isEnabled).toBe(false)
    })

    // Every read answered and the meal this route names is still not in the day that came back — swapped,
    // regenerated or logged away under the screen. There is no planned portion to log.
    it('withholds the write when the reads settled without the routed meal', () => {
      const outcome = resolveRecipeDetailRead(readState({hasContent: false, isReadInFlight: false}))

      expect(outcome.isWriteUnconfirmed).toBe(true)
      expect(resolveActionBarState('plan', true, outcome.isWriteUnconfirmed).isEnabled).toBe(false)
    })

    it('withholds the write over a saved copy', () => {
      const outcome = resolveRecipeDetailRead(readState({dayError: lostResponse()}))

      expect(outcome).toMatchObject({isSavedCopy: true, isWriteUnconfirmed: true})
    })

    it('offers the write once the reads answered with everything frame 12 needs', () => {
      const outcome = resolveRecipeDetailRead(readState())

      expect(outcome.isWriteUnconfirmed).toBe(false)
      expect(resolveActionBarState('plan', true, outcome.isWriteUnconfirmed)).toEqual({
        isVisible: true,
        isEnabled: true,
        isPending: false
      })
    })

    it('is never false while anything required is missing or failed', () => {
      const states = [
        readState({hasContent: false}),
        readState({hasContent: false, isReadInFlight: true}),
        readState({hasContent: false, recipeError: lostResponse()}),
        readState({hasContent: false, dayError: apiError(404)}),
        readState({previewError: apiError(500)}),
        readState({dayError: apiError(409, API_ERROR_CODES.planNotActive)})
      ]

      states.forEach(state => expect(resolveRecipeDetailRead(state).isWriteUnconfirmed).toBe(true))
    })

    // Strictly the wider of the two flags: the saved copy is about what the user is looking at, this is about
    // whether anything may be written from it.
    it('never discloses a saved copy without also withholding the write', () => {
      const outcomes = [null, lostResponse(), apiError(404), apiError(409, API_ERROR_CODES.stalePlan)].flatMap(
        dayError =>
          [true, false].flatMap(hasContent =>
            [true, false].map(isReadInFlight =>
              resolveRecipeDetailRead(readState({dayError, hasContent, isReadInFlight}))
            )
          )
      )

      expect(outcomes.filter(outcome => outcome.isSavedCopy && !outcome.isWriteUnconfirmed)).toEqual([])
    })

    // An answered refusal stays a refusal, so the press keeps explaining itself rather than reporting a plan
    // the server has spoken about as one this screen could not re-read.
    it('reports a refusal as a refusal rather than as an unconfirmed read', () => {
      const {isWriteUnconfirmed} = resolveRecipeDetailRead(readState({hasContent: false, isReadInFlight: true}))

      expect(resolveActionBarState('plan', false, isWriteUnconfirmed).isPending).toBe(false)
      expect(resolveActionBarState('plan', undefined, isWriteUnconfirmed).isPending).toBe(true)
    })
  })
})

describe('resolveActionBarState with an unconfirmed read', () => {
  // The plan revision both destinations would pin their write to is exactly what a failed read could not
  // confirm, so the controls take the app's disabled treatment and the saved-copy banner carries the reason.
  it('withholds the controls when content is a saved copy, whatever the verdict said', () => {
    expect(resolveActionBarState('plan', true, true)).toEqual({isVisible: true, isEnabled: false, isPending: true})
    expect(resolveActionBarState('plan', null, true)).toEqual({isVisible: true, isEnabled: false, isPending: true})
    expect(resolveActionBarState('plan', undefined, true)).toEqual({isVisible: true, isEnabled: false, isPending: true})
  })

  // An answered refusal is more informative than "we could not re-read it", so it keeps its own state and the
  // press still explains itself.
  it('keeps an answered refusal reported as a refusal rather than as pending', () => {
    expect(resolveActionBarState('plan', false, true)).toEqual({isVisible: true, isEnabled: false, isPending: false})
  })

  it('never draws the bar in the preview context, confirmed read or not', () => {
    expect(resolveActionBarState('preview', true, true).isVisible).toBe(false)
    expect(resolveActionBarState('preview', true, false).isVisible).toBe(false)
  })

  it('behaves exactly as before when the read is confirmed', () => {
    expect(resolveActionBarState('plan', true, false)).toEqual(resolveActionBarState('plan', true))
    expect(resolveActionBarState('plan', false, false)).toEqual(resolveActionBarState('plan', false))
    expect(resolveActionBarState('plan', null, false)).toEqual(resolveActionBarState('plan', null))
  })

  it('never reports a state as both enabled and pending', () => {
    const verdicts = [true, false, null, undefined]
    const states = verdicts.flatMap(verdict => [
      resolveActionBarState('plan', verdict, true),
      resolveActionBarState('plan', verdict, false)
    ])

    states.forEach(state => expect(state.isEnabled && state.isPending).toBe(false))
  })
})

describe('previewQueryScope', () => {
  const planContext: RecipeDetailContext = {kind: 'plan', planId: 'plan-1', mealId: 'meal-1', date: '2026-07-05'}
  const previewContext: RecipeDetailContext = {
    kind: 'preview',
    planId: 'plan-1',
    mealId: 'meal-1',
    date: '2026-07-05',
    candidateRecipeVersionId: 'version-9',
    planRevision: 4
  }

  it('enables the read with the candidate and revision in the preview context', () => {
    expect(previewQueryScope(previewContext)).toEqual(['plan-1', 'meal-1', 'version-9', 4, true])
  })

  it('issues no preview request in the plan context, which has no candidate', () => {
    expect(previewQueryScope(planContext)).toEqual(['plan-1', 'meal-1', '', 0, false])
  })

  // The arguments are also the cache key, so the disabled scope must not name an entry the swap flow could
  // mistake for a real preview of this screen's own recipe.
  it('names no real recipe version or revision while disabled', () => {
    const [, , recipeVersionId, planRevision, isEnabled] = previewQueryScope(planContext)

    expect(isEnabled).toBe(false)
    expect(recipeVersionId).toBe('')
    expect(planRevision).toBe(0)
  })
})

describe('buildRecipeDetailSections', () => {
  const displayed = (name: string, quantityText: string): DisplayedIngredient => ({
    name,
    quantityText,
    isOptional: false
  })

  it('projects the two lists as sections, ingredients first', () => {
    const sections = buildRecipeDetailSections([displayed('Spinach', '1 cup')], ['Wilt the spinach.'])

    expect(sections.map(section => section.key)).toEqual(['ingredients', 'instructions'])
  })

  it('carries each ingredient name and its formatted quantity onto its row', () => {
    const [ingredients] = buildRecipeDetailSections(
      [displayed('Spinach', '1 cup'), displayed('Feta', '4 oz')],
      ['Wilt the spinach.']
    )

    expect(ingredients.data).toEqual([
      {kind: 'ingredient', key: 'ingredient:0:Spinach', name: 'Spinach', quantityText: '1 cup'},
      {kind: 'ingredient', key: 'ingredient:1:Feta', name: 'Feta', quantityText: '4 oz'}
    ])
  })

  it('numbers instruction rows from one', () => {
    const [, instructions] = buildRecipeDetailSections([], ['Season the chicken.', 'Sear it, then rest it.'])

    expect(instructions.data).toEqual([
      {kind: 'instruction', key: 'instruction:0', step: 1, text: 'Season the chicken.'},
      {kind: 'instruction', key: 'instruction:1', step: 2, text: 'Sear it, then rest it.'}
    ])
  })

  // A recipe may legitimately list one food twice — raw and cooked, or in two steps — and a collided key would
  // have the virtualizer reuse one cell for two rows.
  it('keys two rows of the same ingredient distinctly', () => {
    const [ingredients] = buildRecipeDetailSections([displayed('Rice', '1 cup'), displayed('Rice', '2 cup')], [])
    const keys = ingredients.data.map(row => row.key)

    expect(new Set(keys).size).toBe(keys.length)
  })

  // The portion toggle changes exactly the quantity text, so keys that moved with it would discard and rebuild
  // every mounted cell on each press.
  it('keeps every key stable when only the displayed quantity changes', () => {
    const portion = buildRecipeDetailSections([displayed('Rice', '¾ cup')], ['Cook the rice.'])
    const full = buildRecipeDetailSections([displayed('Rice', '1½ cup')], ['Cook the rice.'])

    expect(full.map(section => section.data.map(row => row.key))).toEqual(
      portion.map(section => section.data.map(row => row.key))
    )
  })

  it('keys every row of a whole recipe uniquely', () => {
    const sections = buildRecipeDetailSections(
      [displayed('Rice', '1 cup'), displayed('Beans', '⅓ cup')],
      ['Rinse.', 'Simmer.', 'Rinse.']
    )
    const keys = sections.flatMap(section => section.data.map(row => row.key))

    expect(new Set(keys).size).toBe(keys.length)
  })

  it('returns two empty sections for a recipe with nothing to show', () => {
    expect(buildRecipeDetailSections([], [])).toEqual([
      {key: 'ingredients', data: []},
      {key: 'instructions', data: []}
    ])
  })
})

describe('isSameRecipeRow', () => {
  const displayed = (name: string, quantityText: string): DisplayedIngredient => ({
    name,
    quantityText,
    isOptional: false
  })

  const INSTRUCTIONS = ['Season the chicken.', 'Sear it, then rest it.']

  const project = (riceQuantity: string, instructions: readonly string[] = INSTRUCTIONS): RecipeDetailSection[] =>
    buildRecipeDetailSections([displayed('Rice', riceQuantity), displayed('Beans', '⅓ cup')], instructions)

  // The comparison the memo boundary exists for. A portion-toggle press changes the ingredient amounts and
  // nothing else, yet the projection rebuilds BOTH sections as fresh objects — so a reference comparison would
  // re-render every instruction row for no change at all.
  it('reports every instruction row unchanged across a portion toggle', () => {
    const [, portionSteps] = project('¾ cup')
    const [, fullSteps] = project('1½ cup')

    expect(portionSteps.data).toHaveLength(INSTRUCTIONS.length)
    portionSteps.data.forEach((row, position) => {
      expect(row).not.toBe(fullSteps.data[position])
      expect(isSameRecipeRow(row, fullSteps.data[position])).toBe(true)
    })
  })

  // The rows the toggle did change must compare unequal, or the boundary would hold a stale amount on screen.
  it('reports the ingredient row whose amount changed as changed', () => {
    const [portionIngredients] = project('¾ cup')
    const [fullIngredients] = project('1½ cup')

    expect(isSameRecipeRow(portionIngredients.data[0], fullIngredients.data[0])).toBe(false)
  })

  it('reports an ingredient row the rebuild left alone as unchanged', () => {
    const [portionIngredients] = project('¾ cup')
    const [fullIngredients] = project('1½ cup')

    expect(isSameRecipeRow(portionIngredients.data[1], fullIngredients.data[1])).toBe(true)
  })

  // The unrelated-refetch case: a background answer rebuilds the whole projection with identical values, and
  // every row has to compare equal or the entire list re-renders for nothing.
  it('reports every row unchanged when a rebuild reproduced identical values', () => {
    const before = project('¾ cup')
    const after = project('¾ cup')

    before.forEach((section, index) =>
      section.data.forEach((row, position) => {
        expect(row).not.toBe(after[index].data[position])
        expect(isSameRecipeRow(row, after[index].data[position])).toBe(true)
      })
    )
  })

  it('reports a changed instruction as changed and leaves its neighbour unchanged', () => {
    const [, before] = project('¾ cup')
    const [, after] = project('¾ cup', ['Season the chicken.', 'Sear it for eight minutes.'])

    expect(isSameRecipeRow(before.data[0], after.data[0])).toBe(true)
    expect(isSameRecipeRow(before.data[1], after.data[1])).toBe(false)
  })

  it('reports rows at different positions as different rows', () => {
    const [ingredients] = project('¾ cup')

    expect(isSameRecipeRow(ingredients.data[0], ingredients.data[1])).toBe(false)
  })

  it('reports rows from the two sections as different rows', () => {
    const [ingredients, steps] = project('¾ cup')

    expect(isSameRecipeRow(ingredients.data[0], steps.data[0])).toBe(false)
  })

  it('reports a row as the same as itself', () => {
    const [ingredients, steps] = project('¾ cup')

    expect(isSameRecipeRow(ingredients.data[0], ingredients.data[0])).toBe(true)
    expect(isSameRecipeRow(steps.data[0], steps.data[0])).toBe(true)
  })

  // The discriminant is what separates them, so a shared key is not enough to call two rows the same.
  it('never reports rows of different kinds as the same, even on a shared key', () => {
    const asIngredient: RecipeDetailRow = {kind: 'ingredient', key: 'shared', name: 'Rice', quantityText: '1 cup'}
    const asInstruction: RecipeDetailRow = {kind: 'instruction', key: 'shared', step: 1, text: 'Rice'}

    expect(isSameRecipeRow(asIngredient, asInstruction)).toBe(false)
    expect(isSameRecipeRow(asInstruction, asIngredient)).toBe(false)
  })
})

describe("the row's memo boundary", () => {
  // Read off the boundary itself rather than assumed, because a comparison that exists but is not wired in
  // leaves the boundary defeated exactly as the defect described: React stores a custom comparator here, and
  // its absence means the default reference comparison — which the rebuilt row objects always fail.
  const boundary = RecipeRow as unknown as {
    compare: ((previous: {row: RecipeDetailRow}, next: {row: RecipeDetailRow}) => boolean) | null
  }

  const stepRow = (text: string): RecipeDetailRow => ({kind: 'instruction', key: 'instruction:0', step: 1, text})

  it('was constructed with a comparison of its own rather than the reference default', () => {
    expect(typeof boundary.compare).toBe('function')
  })

  it('skips the re-render of a row a rebuild reproduced identically', () => {
    const previous = stepRow('Season the chicken.')
    const next = stepRow('Season the chicken.')

    expect(previous).not.toBe(next)
    expect(boundary.compare?.({row: previous}, {row: next})).toBe(true)
  })

  it('re-renders a row whose content changed', () => {
    expect(boundary.compare?.({row: stepRow('Season the chicken.')}, {row: stepRow('Sear the chicken.')})).toBe(false)
  })

  it("decides exactly as the projection's own comparison does", () => {
    const ingredientRow: RecipeDetailRow = {
      kind: 'ingredient',
      key: 'ingredient:0:Rice',
      name: 'Rice',
      quantityText: '¾ cup'
    }
    const pairs: [RecipeDetailRow, RecipeDetailRow][] = [
      [stepRow('Season the chicken.'), stepRow('Season the chicken.')],
      [stepRow('Season the chicken.'), stepRow('Sear the chicken.')],
      [ingredientRow, {...ingredientRow}],
      [ingredientRow, {...ingredientRow, quantityText: '1½ cup'}],
      [ingredientRow, {...ingredientRow, key: 'ingredient:1:Rice'}],
      [ingredientRow, stepRow('Season the chicken.')]
    ]

    pairs.forEach(([previous, next]) =>
      expect(boundary.compare?.({row: previous}, {row: next})).toBe(isSameRecipeRow(previous, next))
    )
  })
})

describe('placeholderWidth', () => {
  it('measures the loading placeholder at the content column width on a 375 px device', () => {
    expect(placeholderWidth(375)).toBe(335)
  })

  it('measures it at 353 px at the 393 px reference width', () => {
    expect(placeholderWidth(393)).toBe(353)
  })

  it('caps it at the 600 px tablet maximum', () => {
    expect(placeholderWidth(1024)).toBe(560)
  })

  it('keeps the phone widths the frames are authored at', () => {
    expect([320, 430, 834, 2048].map(placeholderWidth)).toEqual([280, 390, 560, 560])
  })

  describe('widths the gutters exhaust', () => {
    it('collapses to zero rather than a negative width at a zero window', () => {
      expect(placeholderWidth(0)).toBe(0)
    })

    it('collapses to zero for a negative window', () => {
      expect(placeholderWidth(-1)).toBe(0)
    })

    it('collapses to zero once the gutters exceed the window', () => {
      expect(placeholderWidth(2)).toBe(0)
    })

    it('returns zero at the window the gutters exactly consume', () => {
      expect(placeholderWidth(40)).toBe(0)
    })

    it('returns the one pixel left over just past that window', () => {
      expect(placeholderWidth(41)).toBe(1)
    })

    it('collapses to zero for a width that is not a number', () => {
      expect(placeholderWidth(NaN)).toBe(0)
    })

    it('collapses to zero for a negatively infinite width', () => {
      expect(placeholderWidth(-Infinity)).toBe(0)
    })

    it('caps a positively infinite width at the tablet maximum', () => {
      expect(placeholderWidth(Infinity)).toBe(560)
    })

    it('is never negative and never non-finite across the whole range', () => {
      const widths = [-Infinity, -1000, -1, 0, 0.5, 2, 39.5, 40, 41, 320, 393, 600, 1024, 2048, Infinity, NaN]

      widths.forEach(width => {
        const placeholder = placeholderWidth(width)

        expect(Number.isFinite(placeholder)).toBe(true)
        expect(placeholder).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
