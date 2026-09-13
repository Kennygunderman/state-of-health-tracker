import {Food, FoodSourceEnum, formatServingText} from '@data/models/Food'
import {InputMethodEnum} from '@data/models/MealEntry'

import {
  buildCatalogLogPayload,
  buildDonutSegments,
  buildMacroBreakdown,
  catalogProvenanceLabel,
  dominantMacroKey,
  formatDetailSubtitle,
  formatMacroSummary
} from '../index.util'

describe('buildMacroBreakdown', () => {
  it('computes calorie shares with 4/4/9 weighting', () => {
    const [protein, carbs, fat] = buildMacroBreakdown(1, 50, 3)

    expect(protein.percent).toBe(2)
    expect(carbs.percent).toBe(87)
    expect(fat.percent).toBe(12)
    expect(protein.grams).toBe(1)
    expect(protein.calorieShare + carbs.calorieShare + fat.calorieShare).toBeCloseTo(1)
  })

  it('returns zero shares when all macros are zero', () => {
    const slices = buildMacroBreakdown(0, 0, 0)

    expect(slices.every(slice => slice.calorieShare === 0 && slice.percent === 0)).toBe(true)
  })
})

describe('dominantMacroKey', () => {
  it('picks the macro contributing the most calories', () => {
    expect(dominantMacroKey(buildMacroBreakdown(1, 50, 3))).toBe('carbs')
    expect(dominantMacroKey(buildMacroBreakdown(35, 0, 4))).toBe('protein')
    expect(dominantMacroKey(buildMacroBreakdown(0, 0, 10))).toBe('fat')
  })
})

describe('buildDonutSegments', () => {
  it('drops zero slices and fills the ring minus gaps', () => {
    const segments = buildDonutSegments(buildMacroBreakdown(10, 0, 10), 0.02)

    expect(segments.map(s => s.key)).toEqual(['protein', 'fat'])

    const totalLength = segments.reduce((sum, s) => sum + s.lengthFraction, 0)

    expect(totalLength).toBeCloseTo(1 - 0.02 * 2)
  })

  it('offsets each segment past the previous one plus a gap', () => {
    const [first, second] = buildDonutSegments(buildMacroBreakdown(10, 10, 0), 0.02)

    expect(first.startFraction).toBe(0)
    expect(second.startFraction).toBeCloseTo(first.lengthFraction + 0.02)
  })

  it('uses no gap for a single visible slice', () => {
    const segments = buildDonutSegments(buildMacroBreakdown(0, 25, 0), 0.02)

    expect(segments).toHaveLength(1)
    expect(segments[0].lengthFraction).toBeCloseTo(1)
  })

  it('returns nothing when every macro is zero', () => {
    expect(buildDonutSegments(buildMacroBreakdown(0, 0, 0))).toEqual([])
  })
})

describe('formatMacroSummary', () => {
  it('formats rounded gram amounts', () => {
    expect(formatMacroSummary(1.5, 74.6, 4.5)).toBe('2g P · 75g C · 5g F')
    expect(formatMacroSummary(0, 24, 0)).toBe('0g P · 24g C · 0g F')
  })
})

describe('formatDetailSubtitle', () => {
  it('joins serving text and calories', () => {
    expect(formatDetailSubtitle(null, '1 cup', 231, 'cal per serving')).toBe('1 cup · 231 cal per serving')
  })

  it('leads with the brand when present', () => {
    expect(formatDetailSubtitle('Chobani', '1 cup', 231, 'cal per serving')).toBe(
      'Chobani · 1 cup · 231 cal per serving'
    )
  })

  it('omits the brand and serving text when missing', () => {
    expect(formatDetailSubtitle(null, null, 231, 'cal per serving')).toBe('231 cal per serving')
  })
})

describe('catalogProvenanceLabel', () => {
  it('captions each sourced provenance with its catalog badge label', () => {
    expect(catalogProvenanceLabel('source_backed')).toBe('Source-backed')
    expect(catalogProvenanceLabel('ingredient_derived')).toBe('Estimated from ingredients')
    expect(catalogProvenanceLabel('ai_estimated')).toBe('AI estimate')
  })

  it('keeps the three badge labels non-empty and distinct, so an estimate never reads as source-backed', () => {
    const labels = [
      catalogProvenanceLabel('source_backed'),
      catalogProvenanceLabel('ingredient_derived'),
      catalogProvenanceLabel('ai_estimated')
    ]

    expect(labels).toEqual(['Source-backed', 'Estimated from ingredients', 'AI estimate'])
    expect(labels.every(label => label !== null && label.length > 0)).toBe(true)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('never captions user-entered nutrition, so client-supplied values are not shown as verified', () => {
    expect(catalogProvenanceLabel('user_entered')).toBeNull()
  })

  it('returns no caption when provenance is missing', () => {
    expect(catalogProvenanceLabel(undefined)).toBeNull()
    expect(catalogProvenanceLabel(null)).toBeNull()
  })
})

describe('buildCatalogLogPayload', () => {
  it('sends the catalog id, the eaten servings and the search input method', () => {
    expect(buildCatalogLogPayload('catalog-food-1', 2)).toEqual({
      catalogFoodId: 'catalog-food-1',
      servings: 2,
      inputMethod: InputMethodEnum.SEARCH
    })
    expect(InputMethodEnum.SEARCH).toBe('search')
  })

  it('omits servingText, so the server derives the canonical portion description and the macros it labels', () => {
    const payload = buildCatalogLogPayload('catalog-food-1', 1)

    expect('servingText' in payload).toBe(false)
    expect(Object.keys(payload).sort()).toEqual(['catalogFoodId', 'inputMethod', 'servings'])
  })

  // A stored description is rarely '<amount> <unit>': the release data has 'lemon' for 1 each and
  // '1 cup, halves' for 152 g. Reconstructing the text client-side would be rejected as
  // invalid_serving, so neither the reconstruction nor a guessed canonical value may be sent.
  it('sends no portion text even when the stored description and the amount-unit pair disagree', () => {
    const food: Food = {
      id: 'catalog-food-1',
      name: 'Strawberries, raw',
      // What the catalog food carries through AddFood's mapper: the portion's amount and unit,
      // never its description ('½ cup'), which reconstructs as '0.5 cup'.
      servingAmount: 0.5,
      servingUnit: 'cup',
      calories: 24,
      protein: 0,
      carbs: 6,
      fat: 0,
      brand: null,
      source: FoodSourceEnum.CATALOG,
      catalogFoodId: 'catalog-food-1',
      nutritionProvenance: 'source_backed'
    }

    const payload = buildCatalogLogPayload(food.catalogFoodId as string, 1)

    expect(formatServingText(food)).toBe('0.5 cup')
    expect(payload).not.toHaveProperty('servingText')
    expect(Object.values(payload)).not.toContain('0.5 cup')
    expect(Object.values(payload)).not.toContain('½ cup')
  })

  it('carries no library identity the catalog route would reject — no foodId, name or macros', () => {
    const payload = buildCatalogLogPayload('catalog-food-1', 1.5)

    expect(payload).not.toHaveProperty('foodId')
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('calories')
    expect(payload).not.toHaveProperty('protein')
    expect(payload).not.toHaveProperty('carbs')
    expect(payload).not.toHaveProperty('fat')
  })

  it('passes fractional servings through unrounded', () => {
    expect(buildCatalogLogPayload('catalog-food-1', 0.33).servings).toBe(0.33)
    expect(buildCatalogLogPayload('catalog-food-1', 2.5).servings).toBe(2.5)
  })
})
