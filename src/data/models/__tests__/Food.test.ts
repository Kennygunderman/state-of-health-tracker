import {formatCatalogPortionText} from '@utility/NutritionFormatUtility'

import {CatalogSourcedFood, FoodSourceEnum, formatServingText, PersonalFood, PersonalFoodSource} from '../Food'

const PERSONAL_SOURCES: PersonalFoodSource[] = [
  FoodSourceEnum.MANUAL,
  FoodSourceEnum.LABEL_SCAN,
  FoodSourceEnum.BRANDED,
  FoodSourceEnum.SEED
]

const makePersonalFood = (overrides: Partial<PersonalFood> = {}): PersonalFood => ({
  id: 'food-2',
  name: 'Overnight oats',
  servingAmount: 1,
  servingUnit: 'bowl',
  calories: 320,
  protein: 12,
  carbs: 48,
  fat: 9,
  brand: null,
  source: FoodSourceEnum.MANUAL,
  ...overrides
})

const makeCatalogFood = (overrides: Partial<CatalogSourcedFood> = {}): CatalogSourcedFood => ({
  id: 'catalog-food-1',
  name: 'Brown rice, cooked',
  servingAmount: 1,
  servingUnit: 'cup',
  calories: 240,
  protein: 5,
  carbs: 51,
  fat: 2,
  brand: null,
  source: FoodSourceEnum.CATALOG,
  catalogFoodId: 'catalog-food-1',
  nutritionProvenance: 'source_backed',
  ...overrides
})

describe('formatServingText', () => {
  // The regression oracle for the shipped library rows: a personal food's serving amount and unit were TYPED
  // by their owner, so both come out exactly as they were stored. Every string here predates the catalog and
  // must keep reading the same, byte for byte.
  describe('a personal food, printed as its owner typed it', () => {
    it.each([
      [1, 'bowl', '1 bowl'],
      [0.5, 'cup', '0.5 cup'],
      [2, 'tablespoon', '2 tablespoon'],
      [3, 'each', '3 each'],
      [1, null, '1 serving'],
      [2, null, '2 servings'],
      [0.5, null, '0.5 servings'],
      [1, '', '1 serving']
    ])('renders %p %p as %p', (servingAmount, servingUnit, expected) => {
      expect(formatServingText(makePersonalFood({servingAmount, servingUnit}))).toBe(expected)
    })

    it('applies none of the catalog rules to a user-typed serving', () => {
      expect(formatServingText(makePersonalFood({servingAmount: 0.25, servingUnit: 'cup'}))).toBe('0.25 cup')
      expect(formatServingText(makePersonalFood({servingAmount: 10, servingUnit: 'each'}))).toBe('10 each')
      expect(formatServingText(makePersonalFood({servingAmount: 2, servingUnit: 'tablespoon'}))).toBe('2 tablespoon')
    })

    it.each(PERSONAL_SOURCES)('prints a %s food verbatim', source => {
      expect(formatServingText(makePersonalFood({source, servingAmount: 0.5, servingUnit: 'cup'}))).toBe('0.5 cup')
    })

    // Branded results ride their whole serving text in as the unit ('1 container'), so the pair must stay
    // untouched: inflecting it would read '1 containers' on the amount the mapper always sets.
    it('leaves a branded serving text carried as the unit alone', () => {
      const branded = makePersonalFood({
        source: FoodSourceEnum.BRANDED,
        servingAmount: 1,
        servingUnit: '1 container'
      })

      expect(formatServingText(branded)).toBe('1 1 container')
    })
  })

  describe('a food with no unit is counted in servings', () => {
    it('counts one serving in the singular', () => {
      expect(formatServingText(makePersonalFood({servingAmount: 1, servingUnit: null}))).toBe('1 serving')
      expect(formatServingText(makeCatalogFood({servingAmount: 1, servingUnit: null}))).toBe('1 serving')
    })

    it('counts anything but one in the plural, fractions included', () => {
      expect(formatServingText(makePersonalFood({servingAmount: 2, servingUnit: null}))).toBe('2 servings')
      expect(formatServingText(makePersonalFood({servingAmount: 0.5, servingUnit: null}))).toBe('0.5 servings')
      expect(formatServingText(makeCatalogFood({servingAmount: 2, servingUnit: null}))).toBe('2 servings')
    })

    it('reads a blank unit as no unit, so a serving never renders with a trailing space', () => {
      expect(formatServingText(makePersonalFood({servingAmount: 1, servingUnit: ''}))).toBe('1 serving')
      expect(formatServingText(makeCatalogFood({servingAmount: 1, servingUnit: ''}))).toBe('1 serving')
    })
  })

  // A catalog food's serving is a generated catalog_food_portions row, so the display rules are applied to
  // it: fraction glyphs, no generic count word, and a unit word that agrees with the amount.
  describe('a catalog portion, formatted by the catalog rules', () => {
    it.each([
      [0.25, 'cup', '¼ cup'],
      [0.33, 'cup', '⅓ cup'],
      [0.5, 'cup', '½ cup'],
      [0.75, 'cup', '¾ cup'],
      [1, 'cup', '1 cup'],
      [0.33, 'each', '⅓'],
      [10, 'each', '10'],
      [2, 'each', '2'],
      [1, 'whole', '1'],
      [2, 'pieces', '2'],
      [2, 'tablespoon', '2 tablespoons'],
      [60, 'milliliter', '60 milliliters'],
      [1, 'slice', '1 slice'],
      [10, 'slices', '10 slices'],
      [3, 'oz', '3 oz'],
      [100, 'g', '100 g'],
      [240, 'ml', '240 ml'],
      [0.5, 'lb', '½ lb'],
      [1.33, 'tbsp', '1⅓ tbsp']
    ])('renders the %p %s portion as %p', (servingAmount, servingUnit, expected) => {
      expect(formatServingText(makeCatalogFood({servingAmount, servingUnit}))).toBe(expected)
    })

    // The seven rows the catalog section rendered wrongly before the formatter existed.
    it('no longer renders a raw amount-and-unit pair for the rows that reported it', () => {
      const reported = [
        {servingAmount: 0.25, servingUnit: 'cup'},
        {servingAmount: 0.5, servingUnit: 'cup'},
        {servingAmount: 0.33, servingUnit: 'each'},
        {servingAmount: 10, servingUnit: 'each'},
        {servingAmount: 2, servingUnit: 'each'},
        {servingAmount: 2, servingUnit: 'tablespoon'},
        {servingAmount: 3, servingUnit: 'oz'}
      ]

      expect(reported.map(portion => formatServingText(makeCatalogFood(portion)))).toEqual([
        '¼ cup',
        '½ cup',
        '⅓',
        '10',
        '2',
        '2 tablespoons',
        '3 oz'
      ])
    })

    it('is the catalog portion formatter itself, not a second implementation of it', () => {
      const portions: [number, string][] = [
        [0.25, 'cup'],
        [0.33, 'each'],
        [2, 'tablespoon'],
        [1.33, 'tbsp'],
        [56, 'grams']
      ]

      portions.forEach(([servingAmount, servingUnit]) => {
        expect(formatServingText(makeCatalogFood({servingAmount, servingUnit}))).toBe(
          formatCatalogPortionText(servingAmount, servingUnit)
        )
      })
    })

    // The stored description is what a log request names; this text is only what the row shows, so the two
    // differing is correct rather than a mismatch to reconcile.
    it('formats the serving pair without touching the stored portion description', () => {
      const food = makeCatalogFood({
        servingAmount: 0.5,
        servingUnit: 'cup',
        catalogServingDescription: '1 cup, halves'
      })

      expect(formatServingText(food)).toBe('½ cup')
      expect(food.catalogServingDescription).toBe('1 cup, halves')
    })

    it('states no serving at all rather than a NaN one', () => {
      expect(formatServingText(makeCatalogFood({servingAmount: Number.NaN, servingUnit: 'cup'}))).toBe('')
    })
  })

  describe('the two paths are told apart by the food, not by its numbers', () => {
    it('renders the same amount-and-unit pair differently for a catalog food and a personal one', () => {
      const pair = {servingAmount: 0.25, servingUnit: 'cup'}

      expect(formatServingText(makeCatalogFood(pair))).toBe('¼ cup')
      expect(formatServingText(makePersonalFood(pair))).toBe('0.25 cup')
    })
  })
})
