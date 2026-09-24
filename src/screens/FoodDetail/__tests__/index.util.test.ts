import {CatalogSourcedFood, FoodSourceEnum, formatServingText, isCatalogFood, PersonalFood} from '@data/models/Food'
import {InputMethodEnum, MealEntry} from '@data/models/MealEntry'
import {FoodDetailParams} from '@navigation/types'

import {
  buildCatalogLogPayload,
  buildDonutSegments,
  buildMacroBreakdown,
  catalogProvenanceLabel,
  dominantMacroKey,
  formatDetailSubtitle,
  formatMacroSummary,
  resolveFoodDetailSource
} from '../index.util'

const makeCatalogFood = (overrides: Partial<CatalogSourcedFood> = {}): CatalogSourcedFood => ({
  id: 'catalog-food-1',
  name: 'Chicken breast, boneless, skinless, raw',
  servingAmount: 4,
  servingUnit: 'oz',
  calories: 136,
  protein: 26,
  carbs: 0,
  fat: 3,
  brand: null,
  source: FoodSourceEnum.CATALOG,
  catalogFoodId: 'catalog-food-1',
  nutritionProvenance: 'source_backed',
  ...overrides
})

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
  it('sends the catalog id, the eaten servings, the stored serving description and the search input method', () => {
    const food = makeCatalogFood({catalogServingDescription: '4 oz'})

    expect(buildCatalogLogPayload(food, 2)).toEqual({
      catalogFoodId: 'catalog-food-1',
      servings: 2,
      servingText: '4 oz',
      inputMethod: InputMethodEnum.SEARCH
    })
    expect(Object.keys(buildCatalogLogPayload(food, 2)).sort()).toEqual([
      'catalogFoodId',
      'inputMethod',
      'servingText',
      'servings'
    ])
    expect(InputMethodEnum.SEARCH).toBe('search')
  })

  // The server matches servingText against the food's stored catalog_food_portions.description values
  // exactly, and most of those descriptions are not '<amount> <unit>' — the release data holds 'RACC',
  // 'lemon' and '1 cup, halves'. Carrying the stored text verbatim is the only form it accepts.
  it('carries a stored description verbatim, including one that is not an amount-unit pair', () => {
    const descriptions = ['RACC', 'lemon', '1 cup, halves', 'Banana']

    const sent = descriptions.map(
      description => buildCatalogLogPayload(makeCatalogFood({catalogServingDescription: description}), 1).servingText
    )

    expect(sent).toEqual(descriptions)
  })

  it('reads the catalog id from the food, not the row id it happens to share', () => {
    const food = makeCatalogFood({id: 'route-copy-1', catalogFoodId: 'catalog-food-7'})

    expect(buildCatalogLogPayload(food, 1).catalogFoodId).toBe('catalog-food-7')
  })

  it('omits servingText entirely when the food carries no description, so the server derives the default portion', () => {
    const payload = buildCatalogLogPayload(makeCatalogFood(), 1)

    expect('servingText' in payload).toBe(false)
    expect(Object.keys(payload).sort()).toEqual(['catalogFoodId', 'inputMethod', 'servings'])
  })

  it('builds the portion text from the stored description, never from the amount-unit pair', () => {
    const food = makeCatalogFood({
      name: 'Strawberries, raw',
      // The portion's amount and unit render as '½ cup', which is not what the catalog stores for this
      // portion — sending the rendered text would be rejected as invalid_serving.
      servingAmount: 0.5,
      servingUnit: 'cup',
      catalogServingDescription: '1 cup, halves',
      calories: 24,
      protein: 0,
      carbs: 6,
      fat: 0
    })

    const payload = buildCatalogLogPayload(food, 1)

    expect(formatServingText(food)).toBe('½ cup')
    expect(payload.servingText).toBe('1 cup, halves')
    expect(Object.values(payload)).not.toContain('½ cup')
    expect(Object.values(payload)).not.toContain('0.5 cup')
  })

  it('carries no library identity the catalog route would reject — no foodId, name or macros', () => {
    const payload = buildCatalogLogPayload(makeCatalogFood(), 1.5)

    expect(payload).not.toHaveProperty('foodId')
    expect(payload).not.toHaveProperty('name')
    expect(payload).not.toHaveProperty('calories')
    expect(payload).not.toHaveProperty('protein')
    expect(payload).not.toHaveProperty('carbs')
    expect(payload).not.toHaveProperty('fat')
  })

  it('passes fractional servings through unrounded, with or without a stored description', () => {
    const described = makeCatalogFood({catalogServingDescription: '1 cup, halves'})

    expect(buildCatalogLogPayload(makeCatalogFood(), 0.33).servings).toBe(0.33)
    expect(buildCatalogLogPayload(makeCatalogFood(), 2.5).servings).toBe(2.5)
    expect(buildCatalogLogPayload(described, 0.33).servings).toBe(0.33)
    expect(buildCatalogLogPayload(described, 2.5).servings).toBe(2.5)
  })
})

// `isCatalogFood` is asserted here because this screen branches its whole add path on it (a catalog food is
// logged by id, a personal one by its macros) and index.tsx is a component with no suite of its own. The
// model's own suite is `src/data/models/__tests__/Food.test.ts`, which is where `formatServingText` — read by
// Add Food's rows as well as this screen's subtitle — is covered.
const makeManualFood = (overrides: Partial<PersonalFood> = {}): PersonalFood => ({
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

describe('isCatalogFood', () => {
  const nonCatalogSources: PersonalFood['source'][] = [
    FoodSourceEnum.MANUAL,
    FoodSourceEnum.LABEL_SCAN,
    FoodSourceEnum.BRANDED,
    FoodSourceEnum.SEED
  ]

  it('narrows a catalog-sourced food', () => {
    expect(isCatalogFood(makeCatalogFood())).toBe(true)
  })

  it('refuses every source this app writes itself, so a personal food never logs as catalog-backed', () => {
    nonCatalogSources.forEach(source => {
      expect(isCatalogFood(makeManualFood({source}))).toBe(false)
    })
  })

  it('checks the whole enum minus catalog, so a new source member cannot silently start narrowing', () => {
    const declaredNonCatalogSources = Object.values(FoodSourceEnum).filter(source => source !== FoodSourceEnum.CATALOG)

    expect(nonCatalogSources).toEqual(declaredNonCatalogSources)
  })

  it('refuses a food whose source is absent rather than narrowing an unsourced row', () => {
    const {source, ...withoutSource} = makeCatalogFood()

    expect(source).toBe(FoodSourceEnum.CATALOG)
    expect(isCatalogFood(withoutSource as CatalogSourcedFood)).toBe(false)
  })
})

describe('resolveFoodDetailSource', () => {
  const makePersonalFood = (overrides: Partial<PersonalFood> = {}): PersonalFood => ({
    id: 'food-1',
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

  const makeEntry = (): MealEntry => ({
    id: 'entry-1',
    foodId: 'food-1',
    name: 'Overnight oats',
    servingText: '1 bowl',
    servings: 1.5,
    calories: 320,
    protein: 12,
    carbs: 48,
    fat: 9,
    inputMethod: InputMethodEnum.LIBRARY,
    loggedAt: '2026-07-05T08:00:00.000Z',
    mealPlanMealId: null,
    nutritionProvenance: null
  })

  const addParams = (food: unknown): FoodDetailParams =>
    ({path: 'add', mealId: 'meal-1', mealName: 'Breakfast', food}) as FoodDetailParams

  it('returns the entry unchanged on the update path, which carries no food param to validate', () => {
    const entry = makeEntry()

    expect(resolveFoodDetailSource({path: 'update', mealId: 'meal-1', mealName: 'Breakfast', entry})).toEqual({
      path: 'update',
      entry
    })
  })

  it('accepts a catalog food, keeping the id and provenance the log route needs', () => {
    const food = makeCatalogFood()
    const source = resolveFoodDetailSource(addParams(food))

    expect(source).toEqual({path: 'add', food})
    expect(source?.path === 'add' && source.food.source).toBe(FoodSourceEnum.CATALOG)
  })

  it('keeps the stored serving description a catalog food carries, so the log body can name that portion', () => {
    const food = makeCatalogFood({catalogServingDescription: '1 cup, halves'})
    const source = resolveFoodDetailSource(addParams(food))

    expect(source?.path === 'add' && source.food.catalogServingDescription).toBe('1 cup, halves')
    expect(
      source?.path === 'add' && isCatalogFood(source.food) && buildCatalogLogPayload(source.food, 1).servingText
    ).toBe('1 cup, halves')
  })

  it('accepts a personal food', () => {
    const food = makePersonalFood()

    expect(resolveFoodDetailSource(addParams(food))).toEqual({path: 'add', food})
  })

  // The restored-param cases: React Navigation rehydrates persisted state from arbitrary JSON, so
  // each of these is reachable without the pushing screen ever building such an object.
  it('refuses a catalog-labelled food with no catalog id, rather than logging one by its row id', () => {
    const {catalogFoodId, ...withoutId} = makeCatalogFood()

    expect(catalogFoodId).toBe('catalog-food-1')
    expect(resolveFoodDetailSource(addParams(withoutId))).toBeNull()
  })

  it('refuses a catalog-labelled food whose provenance is absent or unsourced', () => {
    const {nutritionProvenance, ...withoutProvenance} = makeCatalogFood()

    expect(nutritionProvenance).toBe('source_backed')
    expect(resolveFoodDetailSource(addParams(withoutProvenance))).toBeNull()
    expect(resolveFoodDetailSource(addParams({...makeCatalogFood(), nutritionProvenance: 'user_entered'}))).toBeNull()
  })

  it('refuses a personal food carrying a source claim its own source cannot support', () => {
    expect(resolveFoodDetailSource(addParams({...makePersonalFood(), nutritionProvenance: 'source_backed'}))).toBeNull()
    expect(resolveFoodDetailSource(addParams({...makePersonalFood(), catalogFoodId: 'catalog-food-9'}))).toBeNull()
  })

  it('refuses a food whose source is not a source this app writes', () => {
    expect(resolveFoodDetailSource(addParams({...makePersonalFood(), source: 'partner_import'}))).toBeNull()
  })

  it('refuses a food whose numbers are missing or not numbers', () => {
    expect(resolveFoodDetailSource(addParams({...makePersonalFood(), calories: '320'}))).toBeNull()
    expect(resolveFoodDetailSource(addParams({...makePersonalFood(), protein: null}))).toBeNull()
  })

  it('refuses a param that is not an object at all', () => {
    expect(resolveFoodDetailSource(addParams(null))).toBeNull()
    expect(resolveFoodDetailSource(addParams(undefined))).toBeNull()
    expect(resolveFoodDetailSource(addParams('food-1'))).toBeNull()
    expect(resolveFoodDetailSource(addParams([makePersonalFood()]))).toBeNull()
  })

  // brand and servingUnit are display-only and declared `string | null`, so a param that omits one states
  // nothing rather than claiming something: the screen renders it as absent instead of refusing the food.
  describe('unstated brand and serving unit', () => {
    it('accepts a food that omits the brand, reading the unstated field as null', () => {
      const {brand, ...withoutBrand} = makePersonalFood({brand: 'Chobani'})

      expect(brand).toBe('Chobani')
      expect('brand' in withoutBrand).toBe(false)
      expect(resolveFoodDetailSource(addParams(withoutBrand))).toEqual({
        path: 'add',
        food: {...withoutBrand, brand: null}
      })
    })

    it('accepts a food that omits the serving unit, so its servings still count as plain servings', () => {
      const {servingUnit, ...withoutUnit} = makePersonalFood({servingAmount: 2, servingUnit: 'bowl'})
      const source = resolveFoodDetailSource(addParams(withoutUnit))

      expect(servingUnit).toBe('bowl')
      expect(source).toEqual({path: 'add', food: {...withoutUnit, servingUnit: null}})
      expect(source?.path === 'add' && formatServingText(source.food)).toBe('2 servings')
    })

    it('accepts a food that omits both display fields', () => {
      const {brand, servingUnit, ...withoutEither} = makePersonalFood({brand: 'Chobani', servingUnit: 'bowl'})
      const source = resolveFoodDetailSource(addParams(withoutEither))

      expect([brand, servingUnit]).toEqual(['Chobani', 'bowl'])
      expect(source).toEqual({path: 'add', food: {...withoutEither, brand: null, servingUnit: null}})
      expect(source?.path === 'add' && formatDetailSubtitle(source.food.brand, null, 320, 'cal per serving')).toBe(
        '320 cal per serving'
      )
    })

    it('keeps a catalog food’s id, provenance and stored serving description when its brand is absent', () => {
      const {brand, ...withoutBrand} = makeCatalogFood({
        brand: 'Chobani',
        catalogServingDescription: '1 cup, halves'
      })
      const source = resolveFoodDetailSource(addParams(withoutBrand))

      expect(brand).toBe('Chobani')
      expect(source).toEqual({path: 'add', food: {...withoutBrand, brand: null}})
      expect(source?.path === 'add' && source.food.source).toBe(FoodSourceEnum.CATALOG)
      expect(source?.path === 'add' && source.food.catalogFoodId).toBe('catalog-food-1')
      expect(source?.path === 'add' && source.food.nutritionProvenance).toBe('source_backed')
      expect(source?.path === 'add' && source.food.catalogServingDescription).toBe('1 cup, halves')
    })

    it('treats an explicitly undefined display field exactly as an absent one', () => {
      const source = resolveFoodDetailSource(addParams({...makePersonalFood(), brand: undefined}))

      expect(source?.path === 'add' && source.food.brand).toBeNull()
      expect(resolveFoodDetailSource(addParams({...makePersonalFood(), servingUnit: undefined}))).toEqual(
        resolveFoodDetailSource(addParams({...makePersonalFood(), servingUnit: null}))
      )
    })

    it('still refuses a display field that is present and not a string, which is a param this client cannot read', () => {
      expect(resolveFoodDetailSource(addParams({...makePersonalFood(), brand: 42}))).toBeNull()
      expect(resolveFoodDetailSource(addParams({...makePersonalFood(), servingUnit: 42}))).toBeNull()
      expect(resolveFoodDetailSource(addParams({...makeCatalogFood(), brand: 42}))).toBeNull()
    })

    it('still refuses a personal food that omits the brand and carries a catalog member', () => {
      const {brand, ...withoutBrand} = makePersonalFood()

      expect(brand).toBeNull()
      expect(resolveFoodDetailSource(addParams({...withoutBrand, catalogFoodId: 'catalog-food-9'}))).toBeNull()
      expect(resolveFoodDetailSource(addParams({...withoutBrand, nutritionProvenance: 'source_backed'}))).toBeNull()
      expect(resolveFoodDetailSource(addParams({...withoutBrand, catalogServingDescription: '4 oz'}))).toBeNull()
    })

    it('leaves the update path untouched, which carries an entry rather than a food to default', () => {
      const entry = makeEntry()
      const source = resolveFoodDetailSource({path: 'update', mealId: 'meal-1', mealName: 'Breakfast', entry})

      expect(source).toEqual({path: 'update', entry})
      expect(source?.path === 'update' && source.entry).toBe(entry)
    })
  })
})
