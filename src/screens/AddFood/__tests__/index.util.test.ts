import {BrandedFood} from '@data/models/BrandedFood'
import {CatalogFood} from '@data/models/CatalogFood'
import {FoodSourceEnum, formatServingText} from '@data/models/Food'

import {CATALOG_PROVENANCE_BADGE_LABELS} from '@constants/strings'

import {catalogProvenanceBadge, formatMacroSummary, mapBrandedFoodToFood, mapCatalogFoodToFood} from '../index.util'

const makeBrandedFood = (overrides: Partial<BrandedFood> = {}): BrandedFood => ({
  id: 'branded-1',
  name: 'Greek Yogurt',
  brand: 'Chobani',
  servingText: '1 container',
  calories: 140,
  protein: 14,
  carbs: 16,
  fat: 3,
  ...overrides
})

const makeCatalogFood = (overrides: Partial<CatalogFood> = {}): CatalogFood => ({
  id: 'catalog-1',
  name: 'Brown rice, cooked',
  category: 'grain',
  foodState: 'cooked',
  identitySource: 'usda',
  nutritionProvenance: 'source_backed',
  nutritionBasis: 'per_100g',
  basisAmount: 100,
  calories: 123,
  protein: 2.7,
  carbs: 26,
  fat: 1,
  fiber: 1.6,
  defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 195},
  // The server's projection of the per-100 g macros onto the 195 g cup, rounded once: 123 x 1.95 = 239.85,
  // 2.7 x 1.95 = 5.265, 26 x 1.95 = 50.7, 1 x 1.95 = 1.95.
  defaultPortionNutrition: {calories: 240, protein: 5, carbs: 51, fat: 2},
  allergenTags: [],
  allergenStatus: 'known',
  foodGroup: 'rice',
  ...overrides
})

describe('formatMacroSummary', () => {
  it('formats gram amounts with dividers', () => {
    expect(formatMacroSummary(1, 50, 3)).toBe('1g P · 50g C · 3g F')
  })

  it('rounds fractional grams', () => {
    expect(formatMacroSummary(1.4, 49.6, 3.5)).toBe('1g P · 50g C · 4g F')
  })
})

describe('mapBrandedFoodToFood', () => {
  it('maps a branded result to a single-serving branded food', () => {
    expect(mapBrandedFoodToFood(makeBrandedFood())).toEqual({
      id: 'branded-1',
      name: 'Greek Yogurt',
      servingAmount: 1,
      servingUnit: '1 container',
      calories: 140,
      protein: 14,
      carbs: 16,
      fat: 3,
      brand: 'Chobani',
      source: FoodSourceEnum.BRANDED
    })
  })

  it('keeps null brand and serving text as-is', () => {
    const food = mapBrandedFoodToFood(makeBrandedFood({brand: null, servingText: null}))

    expect(food.brand).toBeNull()
    expect(food.servingUnit).toBeNull()
  })
})

describe('mapCatalogFoodToFood', () => {
  it('maps a catalog food onto its default portion', () => {
    expect(mapCatalogFoodToFood(makeCatalogFood())).toEqual({
      id: 'catalog-1',
      name: 'Brown rice, cooked',
      servingAmount: 1,
      servingUnit: 'cup',
      calories: 240,
      protein: 5,
      carbs: 51,
      fat: 2,
      brand: null,
      source: FoodSourceEnum.CATALOG,
      catalogFoodId: 'catalog-1',
      nutritionProvenance: 'source_backed'
    })
  })

  // The serving pair is one cup (195 g) while the per-basis macros are per 100 g, so reading them here would
  // show 123 cal against a 195 g serving — and for a per_100ml food no client-side correction exists, because
  // density is on no response. Only the server's projection describes the portion the row displays.
  it('takes the macros from the default-portion projection, never from the per-basis figures', () => {
    const food = mapCatalogFoodToFood(makeCatalogFood())

    expect(food.calories).not.toBe(123)
    expect(food.protein).not.toBe(2.7)
    expect(food.carbs).not.toBe(26)
    expect(food.fat).not.toBe(1)
  })

  it('shows a per_100ml food at its projected portion, which no client-side conversion could produce', () => {
    const oliveOil = makeCatalogFood({
      id: 'catalog-2',
      name: 'Olive oil',
      nutritionBasis: 'per_100ml',
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      fiber: 0,
      defaultPortion: {description: '1 tbsp', amount: 1, unit: 'tbsp', gramWeight: 13.5},
      defaultPortionNutrition: {calories: 130, protein: 0, carbs: 0, fat: 15}
    })
    const food = mapCatalogFoodToFood(oliveOil)

    expect(food.calories).toBe(130)
    expect(food.fat).toBe(15)
    expect(formatServingText(food)).toBe('1 tbsp')
  })

  it('leaves fiber off the food when it is unknown', () => {
    expect(mapCatalogFoodToFood(makeCatalogFood({fiber: null}))).toEqual({
      id: 'catalog-1',
      name: 'Brown rice, cooked',
      servingAmount: 1,
      servingUnit: 'cup',
      calories: 240,
      protein: 5,
      carbs: 51,
      fat: 2,
      brand: null,
      source: FoodSourceEnum.CATALOG,
      catalogFoodId: 'catalog-1',
      nutritionProvenance: 'source_backed'
    })
  })

  it('keeps a fractional portion amount unrounded', () => {
    const halfCup = {description: '½ cup', amount: 0.5, unit: 'cup', gramWeight: 98}
    const food = mapCatalogFoodToFood(makeCatalogFood({defaultPortion: halfCup}))

    expect(food.servingAmount).toBe(0.5)
    expect(food.servingUnit).toBe('cup')
  })

  it('renders the default portion as the serving text shown on the row', () => {
    expect(formatServingText(mapCatalogFoodToFood(makeCatalogFood()))).toBe('1 cup')
  })
})

// 'user_entered' is outside the parameter's SourcedNutritionProvenance union, so it has no badge case
describe('catalogProvenanceBadge', () => {
  it('labels source-backed nutrition without a warning tone', () => {
    expect(catalogProvenanceBadge('source_backed')).toEqual({
      label: CATALOG_PROVENANCE_BADGE_LABELS.source_backed,
      tone: 'neutral'
    })
  })

  it('warns that ingredient-derived nutrition is an estimate', () => {
    expect(catalogProvenanceBadge('ingredient_derived')).toEqual({
      label: CATALOG_PROVENANCE_BADGE_LABELS.ingredient_derived,
      tone: 'warning'
    })
  })

  it('warns that AI-estimated nutrition is an estimate', () => {
    expect(catalogProvenanceBadge('ai_estimated')).toEqual({
      label: CATALOG_PROVENANCE_BADGE_LABELS.ai_estimated,
      tone: 'warning'
    })
  })
})
