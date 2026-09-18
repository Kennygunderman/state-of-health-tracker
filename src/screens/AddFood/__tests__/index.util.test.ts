import {BrandedFood} from '@data/models/BrandedFood'
import {CatalogFood} from '@data/models/CatalogFood'
import {FoodSourceEnum, formatServingText} from '@data/models/Food'
import {
  CATALOG_SEARCH_MAX_QUERY_LENGTH,
  isCatalogQuerySearchable,
  resolveCatalogSearchState
} from '@utility/CatalogSearchStateUtility'

import {CATALOG_PROVENANCE_BADGE_LABELS} from '@constants/strings'

import {
  ADD_FOOD_SEARCH_MAX_QUERY_LENGTH,
  CATALOG_SKELETON_ROWS,
  catalogProvenanceBadge,
  catalogServingPresentation,
  catalogSkeletonBarWidth,
  formatMacroSummary,
  isCatalogSearchResult,
  isCatalogSectionVisible,
  mapBrandedFoodToFood,
  mapCatalogFoodToFood,
  newFoodButtonOwner
} from '../index.util'

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
  allergenTags: [],
  allergenStatus: 'known',
  foodGroup: 'rice',
  ...overrides
})

// The field drives three searches and takes the strictest of their bounds, so this is the catalog's bound
// rather than a length the screen chose for itself.
describe('ADD_FOOD_SEARCH_MAX_QUERY_LENGTH', () => {
  it('is the catalog search bound the server enforces', () => {
    expect(ADD_FOOD_SEARCH_MAX_QUERY_LENGTH).toBe(CATALOG_SEARCH_MAX_QUERY_LENGTH)
  })

  it('is sixty characters', () => {
    expect(ADD_FOOD_SEARCH_MAX_QUERY_LENGTH).toBe(60)
  })

  it('accepts what it caps the field at, so a full-length field cannot produce a refused request', () => {
    expect(isCatalogQuerySearchable('c'.repeat(ADD_FOOD_SEARCH_MAX_QUERY_LENGTH))).toBe(true)
  })
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

// The response states its macros per basisAmount of nutritionBasis (AAP 0.5.2 defines no per-portion figure),
// so the serving shown and the macros shown are derived together, by the arithmetic the server applies to the
// snapshot it stores for the same portion.
describe('catalogServingPresentation', () => {
  const perServingBar = (overrides: Partial<CatalogFood> = {}): CatalogFood =>
    makeCatalogFood({
      id: 'catalog-bar',
      name: 'Protein bar',
      nutritionBasis: 'per_serving',
      basisAmount: 1,
      calories: 210,
      protein: 20,
      carbs: 21,
      fat: 7,
      fiber: 3,
      defaultPortion: {description: '1 bar', amount: 1, unit: 'bar', gramWeight: 30},
      ...overrides
    })

  it('projects a per_100g row at basis 100 onto its default portion', () => {
    // basisGrams = 100; scale = 195 / 100. 123 x 1.95 = 239.85, 2.7 x 1.95 = 5.265, 26 x 1.95 = 50.7,
    // 1 x 1.95 = 1.95.
    expect(catalogServingPresentation(makeCatalogFood())).toEqual({
      servingAmount: 1,
      servingUnit: 'cup',
      calories: 240,
      protein: 5,
      carbs: 51,
      fat: 2
    })
  })

  it('reads a basis amount other than 100 rather than assuming it', () => {
    // The same food stated per 50 g: every value is half, and the 195 g cup comes out the same.
    const perFiftyGrams = makeCatalogFood({basisAmount: 50, calories: 61.5, protein: 1.35, carbs: 13, fat: 0.5})

    expect(catalogServingPresentation(perFiftyGrams)).toEqual(catalogServingPresentation(makeCatalogFood()))
  })

  it('rounds once, so the card equals what the server stores for this portion', () => {
    const food = makeCatalogFood()
    const scale = food.defaultPortion.gramWeight / food.basisAmount
    const serverSnapshot = {
      calories: Math.round(food.calories * scale),
      protein: Math.round(food.protein * scale),
      carbs: Math.round(food.carbs * scale),
      fat: Math.round(food.fat * scale)
    }
    const {calories, protein, carbs, fat} = catalogServingPresentation(food)

    expect({calories, protein, carbs, fat}).toEqual(serverSnapshot)
    // Rounding the nutrient first would give round(3 x 1.95) = 6 g of protein.
    expect(protein).toBe(5)
  })

  it('reads a per_serving basis against the default portion gram weight', () => {
    // basisGrams = 1 serving x 30 g = 30 g; scale = 30 / 30 = 1.
    expect(catalogServingPresentation(perServingBar())).toEqual({
      servingAmount: 1,
      servingUnit: 'bar',
      calories: 210,
      protein: 20,
      carbs: 21,
      fat: 7
    })
  })

  it('halves a two-serving label, because basis_amount counts servings', () => {
    // basisGrams = 2 x 30 g = 60 g; scale = 0.5. 21 x 0.5 = 10.5 rounds away from zero.
    expect(catalogServingPresentation(perServingBar({basisAmount: 2}))).toEqual({
      servingAmount: 1,
      servingUnit: 'bar',
      calories: 105,
      protein: 10,
      carbs: 11,
      fat: 4
    })
  })

  it('presents a per_100ml row on its stated basis, because no response carries a density', () => {
    const oliveOil = makeCatalogFood({
      nutritionBasis: 'per_100ml',
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      defaultPortion: {description: '1 tbsp', amount: 1, unit: 'tbsp', gramWeight: 13.5}
    })

    expect(catalogServingPresentation(oliveOil)).toEqual({
      servingAmount: 100,
      servingUnit: 'ml',
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 100
    })
  })

  it('never projects a volume basis through an assumed 1 g/ml, which would fabricate nutrition', () => {
    const oliveOil = makeCatalogFood({
      nutritionBasis: 'per_100ml',
      calories: 884,
      fat: 100,
      defaultPortion: {description: '1 tbsp', amount: 1, unit: 'tbsp', gramWeight: 13.5}
    })

    // 884 x 0.135 = 119 kcal is what treating millilitres as grams would show for the tablespoon.
    expect(catalogServingPresentation(oliveOil).calories).not.toBe(119)
  })

  it('falls back to the stated basis when the basis amount is unusable', () => {
    expect(catalogServingPresentation(makeCatalogFood({basisAmount: 0}))).toEqual({
      servingAmount: 0,
      servingUnit: 'g',
      calories: 123,
      protein: 3,
      carbs: 26,
      fat: 1
    })
  })

  it('falls back to the stated basis when the portion has no usable gram weight', () => {
    const noWeight = makeCatalogFood({defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 0}})

    expect(catalogServingPresentation(noWeight)).toEqual({
      servingAmount: 100,
      servingUnit: 'g',
      calories: 123,
      protein: 3,
      carbs: 26,
      fat: 1
    })
  })

  it('emits finite macros even when the scale overflows', () => {
    // A denormal basis mass under a real portion weight divides to Infinity.
    const denormalBasis = makeCatalogFood({basisAmount: Number.MIN_VALUE})
    const {calories, protein, carbs, fat} = catalogServingPresentation(denormalBasis)

    expect([calories, protein, carbs, fat].every(Number.isFinite)).toBe(true)
    expect(calories).toBe(123)
  })

  it('names servings rather than grams when a per_serving row cannot be projected', () => {
    const noWeight = perServingBar({
      defaultPortion: {description: '1 bar', amount: 1, unit: 'bar', gramWeight: Number.NaN}
    })
    const presentation = catalogServingPresentation(noWeight)

    expect(presentation.servingAmount).toBe(1)
    expect(presentation.servingUnit).toBeNull()
    expect(presentation.calories).toBe(210)
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
      nutritionProvenance: 'source_backed',
      catalogServingDescription: '1 cup'
    })
  })

  // The serving pair is one cup (195 g) while the stated macros are per 100 g, so showing them as stated would
  // put 123 cal against a 195 g serving.
  it('shows the macros of the serving, never the per-basis figures as they are stated', () => {
    const food = mapCatalogFoodToFood(makeCatalogFood())

    expect(food.calories).not.toBe(123)
    expect(food.protein).not.toBe(2.7)
    expect(food.carbs).not.toBe(26)
    expect(food.fat).not.toBe(1)
  })

  // A conformant server never sends a volume basis — it restates every food on the mass basis — and converting
  // one here would need a density no response carries, so the food is shown on the basis it stated.
  it('shows a per_100ml food on its stated basis rather than assuming a density', () => {
    const oliveOil = makeCatalogFood({
      id: 'catalog-2',
      name: 'Olive oil',
      nutritionBasis: 'per_100ml',
      calories: 884,
      protein: 0,
      carbs: 0,
      fat: 100,
      fiber: 0,
      defaultPortion: {description: '1 tbsp', amount: 1, unit: 'tbsp', gramWeight: 13.5}
    })
    const food = mapCatalogFoodToFood(oliveOil)

    expect(food.calories).toBe(884)
    expect(food.fat).toBe(100)
    expect(formatServingText(food)).toBe('100 ml')
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
      nutritionProvenance: 'source_backed',
      catalogServingDescription: '1 cup'
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

  // The stored description, not the serving pair: 'RACC' and '1 cup, halves' are descriptions the pair cannot
  // reproduce, and the log request has to name the row the server holds.
  it('carries the stored portion description verbatim', () => {
    const racc = makeCatalogFood({
      defaultPortion: {description: '1 cup, halves', amount: 1, unit: 'cup', gramWeight: 152}
    })

    expect(mapCatalogFoodToFood(racc).catalogServingDescription).toBe('1 cup, halves')
  })

  it('carries a fractional portion description without reformatting it', () => {
    const halfCup = makeCatalogFood({
      defaultPortion: {description: '½ cup', amount: 0.5, unit: 'cup', gramWeight: 98}
    })

    expect(mapCatalogFoodToFood(halfCup).catalogServingDescription).toBe('½ cup')
  })
})

describe('isCatalogSearchResult', () => {
  it('identifies a catalog result by its portion', () => {
    expect(isCatalogSearchResult(makeCatalogFood())).toBe(true)
  })

  it('rejects a branded result', () => {
    expect(isCatalogSearchResult(makeBrandedFood())).toBe(false)
  })

  it('rejects a branded result whose optional fields are null', () => {
    expect(isCatalogSearchResult(makeBrandedFood({brand: null, servingText: null}))).toBe(false)
  })
})

describe('catalogSkeletonBarWidth', () => {
  it('takes the proportion of a measured bar area', () => {
    expect(catalogSkeletonBarWidth(300, 0.68)).toBe(204)
  })

  it('rounds to whole pixels', () => {
    expect(catalogSkeletonBarWidth(301, 0.62)).toBe(187)
  })

  it('returns no width before the bar area has been measured', () => {
    expect(catalogSkeletonBarWidth(0, 0.68)).toBe(0)
  })

  it('returns no width for a negative measurement', () => {
    expect(catalogSkeletonBarWidth(-10, 0.68)).toBe(0)
  })

  it('shapes three rows with uneven name and category widths', () => {
    expect(CATALOG_SKELETON_ROWS).toHaveLength(3)

    CATALOG_SKELETON_ROWS.forEach(row => {
      expect(row.primary).toBeGreaterThan(row.secondary)
      expect(row.primary).toBeLessThanOrEqual(1)
      expect(row.secondary).toBeGreaterThan(0)
    })
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

describe('newFoodButtonOwner', () => {
  it('gives the button to the library section when all three render', () => {
    expect(newFoodButtonOwner({showLibrary: true, showCatalog: true, showBranded: true})).toBe('library')
  })

  it('gives it to the library section over the catalog', () => {
    expect(newFoodButtonOwner({showLibrary: true, showCatalog: true, showBranded: false})).toBe('library')
  })

  it('gives it to the library section over branded results', () => {
    expect(newFoodButtonOwner({showLibrary: true, showCatalog: false, showBranded: true})).toBe('library')
  })

  it('gives it to the library section when it renders alone', () => {
    expect(newFoodButtonOwner({showLibrary: true, showCatalog: false, showBranded: false})).toBe('library')
  })

  it('gives it to the catalog section when the library is hidden', () => {
    expect(newFoodButtonOwner({showLibrary: false, showCatalog: true, showBranded: true})).toBe('catalog')
  })

  it('gives it to the catalog section when it renders alone', () => {
    expect(newFoodButtonOwner({showLibrary: false, showCatalog: true, showBranded: false})).toBe('catalog')
  })

  it('gives it to the branded section only when both sections above it are hidden', () => {
    expect(newFoodButtonOwner({showLibrary: false, showCatalog: false, showBranded: true})).toBe('branded')
  })

  it('gives it to no section when the list renders none', () => {
    expect(newFoodButtonOwner({showLibrary: false, showCatalog: false, showBranded: false})).toBeNull()
  })
})

describe('isCatalogSectionVisible', () => {
  it('renders the section for answered rows', () => {
    expect(isCatalogSectionVisible('rows')).toBe(true)
  })

  it('renders the section for a first load', () => {
    expect(isCatalogSectionVisible('loading')).toBe(true)
  })

  it('renders the section for a retryable failure', () => {
    expect(isCatalogSectionVisible('error')).toBe(true)
  })

  it('renders the section for a decoded empty page', () => {
    expect(isCatalogSectionVisible('empty')).toBe(true)
  })

  it('hides the section when the catalog is not entitled', () => {
    expect(isCatalogSectionVisible('hidden')).toBe(false)
  })

  it('hides the section when there is nothing to report', () => {
    expect(isCatalogSectionVisible('idle')).toBe(false)
  })
})

// The screen's own composition: the inputs Add Food hands resolveCatalogSearchState, through to whether the
// section and its three answers render. isLoading/isError/isSuccess are TanStack statuses, so at most one of
// them is ever true.
describe('the Add Food catalog section', () => {
  const resolveSection = (
    overrides: Partial<{
      isCatalogVisible: boolean
      isSearchable: boolean
      rowCount: number
      isCatalogLoading: boolean
      hasCatalogError: boolean
      isCatalogLoaded: boolean
    }> = {}
  ) => {
    const {
      isCatalogVisible = true,
      isSearchable = true,
      rowCount = 0,
      isCatalogLoading = false,
      hasCatalogError = false,
      isCatalogLoaded = false
    } = overrides
    const state = resolveCatalogSearchState({
      isVisible: isCatalogVisible,
      isSearchable,
      rowCount,
      isLoading: isCatalogLoading,
      isError: hasCatalogError,
      isSuccess: isCatalogLoaded
    })

    return {state, isVisible: isCatalogSectionVisible(state)}
  }

  it('is hidden with the entitlement off, whatever the query hook holds', () => {
    expect(resolveSection({isCatalogVisible: false, rowCount: 8, isCatalogLoaded: true})).toEqual({
      state: 'hidden',
      isVisible: false
    })
  })

  it('is hidden below the two-character minimum, where the query hook is disabled', () => {
    expect(resolveSection({isSearchable: false})).toEqual({state: 'idle', isVisible: false})
  })

  it('renders the skeleton rows while the first page loads', () => {
    expect(resolveSection({isCatalogLoading: true})).toEqual({state: 'loading', isVisible: true})
  })

  it('renders the retry row when the search fails with no rows to show instead', () => {
    expect(resolveSection({hasCatalogError: true})).toEqual({state: 'error', isVisible: true})
  })

  it('renders the no-results caption only for a decoded empty page', () => {
    expect(resolveSection({isCatalogLoaded: true})).toEqual({state: 'empty', isVisible: true})
  })

  it('renders the rows for an answered page', () => {
    expect(resolveSection({rowCount: 25, isCatalogLoaded: true})).toEqual({state: 'rows', isVisible: true})
  })

  it('keeps the rows on screen when paging or refetching them fails', () => {
    expect(resolveSection({rowCount: 25, hasCatalogError: true})).toEqual({state: 'rows', isVisible: true})
  })

  it('is hidden while an offline-paused query has answered nothing', () => {
    expect(resolveSection()).toEqual({state: 'idle', isVisible: false})
  })
})
