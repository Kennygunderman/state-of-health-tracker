import {
  CatalogSourcedFood,
  Food,
  FoodSourceEnum,
  formatServingText,
  isCatalogFood,
  parseRouteFood,
  PersonalFood,
  PersonalFoodSource
} from '@data/models/Food'

const PERSONAL_SOURCES: PersonalFoodSource[] = [
  FoodSourceEnum.MANUAL,
  FoodSourceEnum.LABEL_SCAN,
  FoodSourceEnum.BRANDED,
  FoodSourceEnum.SEED
]

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

const makePersonalFood = (overrides: Partial<PersonalFood> = {}): PersonalFood => ({
  id: 'food-1',
  name: 'Greek Yogurt',
  servingAmount: 1,
  servingUnit: '1 container',
  calories: 140,
  protein: 14,
  carbs: 16,
  fat: 3,
  brand: 'Chobani',
  source: FoodSourceEnum.BRANDED,
  ...overrides
})

describe('isCatalogFood', () => {
  it('accepts a catalog-sourced food and narrows it to the catalog variant', () => {
    const food: Food = makeCatalogFood()

    expect(isCatalogFood(food)).toBe(true)

    if (isCatalogFood(food)) {
      expect(food.catalogFoodId).toBe('catalog-food-1')
      expect(food.nutritionProvenance).toBe('source_backed')
    }
  })

  it.each(PERSONAL_SOURCES)('rejects a %s food', source => {
    expect(isCatalogFood(makePersonalFood({source}))).toBe(false)
  })
})

describe('formatServingText', () => {
  it('renders the amount and unit when a unit is present', () => {
    expect(formatServingText(makeCatalogFood())).toBe('1 cup')
  })

  it('renders a fractional amount unrounded', () => {
    expect(formatServingText(makeCatalogFood({servingAmount: 0.5}))).toBe('0.5 cup')
  })

  it('falls back to the singular serving wording for a single unitless serving', () => {
    expect(formatServingText(makePersonalFood({servingAmount: 1, servingUnit: null}))).toBe('1 serving')
  })

  it('pluralises unitless servings above one', () => {
    expect(formatServingText(makePersonalFood({servingAmount: 2, servingUnit: null}))).toBe('2 servings')
  })

  it('pluralises a fractional unitless serving, as it always has', () => {
    expect(formatServingText(makePersonalFood({servingAmount: 0.5, servingUnit: null}))).toBe('0.5 servings')
  })
})

// Restored navigation params are arbitrary JSON, so every case below is a shape the app can genuinely be handed.
describe('parseRouteFood', () => {
  describe('valid input', () => {
    it('returns a catalog food carrying the whole catalog triple', () => {
      expect(parseRouteFood({...makeCatalogFood()})).toEqual(makeCatalogFood())
    })

    it('returns a personal food carrying neither catalog member', () => {
      expect(parseRouteFood({...makePersonalFood()})).toEqual(makePersonalFood())
    })

    it.each(['source_backed', 'ingredient_derived', 'ai_estimated'])('accepts the %s provenance', provenance => {
      const parsed = parseRouteFood({...makeCatalogFood(), nutritionProvenance: provenance})

      expect(parsed && isCatalogFood(parsed) && parsed.nutritionProvenance).toBe(provenance)
    })

    it.each(PERSONAL_SOURCES)('accepts the %s personal source', source => {
      expect(parseRouteFood({...makePersonalFood({source})})?.source).toBe(source)
    })

    it('keeps a null serving unit and a null brand', () => {
      const parsed = parseRouteFood({...makePersonalFood({servingUnit: null, brand: null})})

      expect(parsed?.servingUnit).toBeNull()
      expect(parsed?.brand).toBeNull()
    })

    it('keeps zero macros, which are a real value rather than a missing one', () => {
      const parsed = parseRouteFood({...makePersonalFood({calories: 0, protein: 0, carbs: 0, fat: 0})})

      expect(parsed).not.toBeNull()
      expect(parsed?.calories).toBe(0)
    })

    it('drops members it does not know about instead of carrying them into the domain', () => {
      const parsed = parseRouteFood({...makeCatalogFood(), fiber: 1.6})

      expect(parsed).toEqual(makeCatalogFood())
      expect(parsed).not.toHaveProperty('fiber')
    })
  })

  describe('the catalog triple', () => {
    it('rejects a catalog-labelled food with no catalog id', () => {
      const {catalogFoodId, ...withoutId} = makeCatalogFood()

      expect(catalogFoodId).toBe('catalog-food-1')
      expect(parseRouteFood(withoutId)).toBeNull()
    })

    it('rejects a catalog-labelled food whose catalog id is empty', () => {
      expect(parseRouteFood({...makeCatalogFood(), catalogFoodId: ''})).toBeNull()
    })

    it('rejects a catalog-labelled food whose catalog id is not a string', () => {
      expect(parseRouteFood({...makeCatalogFood(), catalogFoodId: 7})).toBeNull()
    })

    it('rejects a catalog-labelled food with no provenance', () => {
      const {nutritionProvenance, ...withoutProvenance} = makeCatalogFood()

      expect(nutritionProvenance).toBe('source_backed')
      expect(parseRouteFood(withoutProvenance)).toBeNull()
    })

    it('rejects a catalog-labelled food whose provenance is outside the sourced union', () => {
      expect(parseRouteFood({...makeCatalogFood(), nutritionProvenance: 'peer_reviewed'})).toBeNull()
    })

    // 'user_entered' is a real provenance, but never a catalog one: the server owns every catalog value.
    it('rejects a catalog-labelled food claiming a user-entered provenance', () => {
      expect(parseRouteFood({...makeCatalogFood(), nutritionProvenance: 'user_entered'})).toBeNull()
    })

    it('rejects a catalog-labelled food whose provenance is null', () => {
      expect(parseRouteFood({...makeCatalogFood(), nutritionProvenance: null})).toBeNull()
    })

    it('rejects a personal food carrying a sourced provenance', () => {
      expect(parseRouteFood({...makePersonalFood(), nutritionProvenance: 'source_backed'})).toBeNull()
    })

    it('rejects a personal food carrying a catalog id', () => {
      expect(parseRouteFood({...makePersonalFood(), catalogFoodId: 'catalog-food-1'})).toBeNull()
    })
  })

  describe('source', () => {
    it('rejects a source string outside the enum', () => {
      expect(parseRouteFood({...makePersonalFood(), source: 'imported'})).toBeNull()
    })

    it('rejects a missing source', () => {
      const {source, ...withoutSource} = makePersonalFood()

      expect(source).toBe(FoodSourceEnum.BRANDED)
      expect(parseRouteFood(withoutSource)).toBeNull()
    })

    it('rejects a null source', () => {
      expect(parseRouteFood({...makePersonalFood(), source: null})).toBeNull()
    })

    it('rejects a source supplied as a number', () => {
      expect(parseRouteFood({...makePersonalFood(), source: 1})).toBeNull()
    })
  })

  describe('the shared scalars', () => {
    it.each(['id', 'name', 'servingAmount', 'servingUnit', 'calories', 'protein', 'carbs', 'fat', 'brand'])(
      'rejects a food with no %s',
      member => {
        const candidate: Record<string, unknown> = {...makeCatalogFood()}

        delete candidate[member]

        expect(parseRouteFood(candidate)).toBeNull()
      }
    )

    it('rejects an empty id, which names no food', () => {
      expect(parseRouteFood({...makeCatalogFood(), id: ''})).toBeNull()
    })

    it('rejects a numeric id', () => {
      expect(parseRouteFood({...makeCatalogFood(), id: 1})).toBeNull()
    })

    it('rejects a null name', () => {
      expect(parseRouteFood({...makeCatalogFood(), name: null})).toBeNull()
    })

    it('rejects a serving amount supplied as a numeric string', () => {
      expect(parseRouteFood({...makeCatalogFood(), servingAmount: '1'})).toBeNull()
    })

    it('rejects a non-finite serving amount', () => {
      expect(parseRouteFood({...makeCatalogFood(), servingAmount: Number.NaN})).toBeNull()
    })

    it('rejects a serving unit supplied as a number', () => {
      expect(parseRouteFood({...makeCatalogFood(), servingUnit: 4})).toBeNull()
    })

    it.each(['calories', 'protein', 'carbs', 'fat'])('rejects a %s value supplied as a string', member => {
      expect(parseRouteFood({...makeCatalogFood(), [member]: '10'})).toBeNull()
    })

    it.each(['calories', 'protein', 'carbs', 'fat'])('rejects a null %s value', member => {
      expect(parseRouteFood({...makeCatalogFood(), [member]: null})).toBeNull()
    })

    it('rejects an infinite macro value', () => {
      expect(parseRouteFood({...makeCatalogFood(), calories: Number.POSITIVE_INFINITY})).toBeNull()
    })

    it('rejects a brand supplied as a number', () => {
      expect(parseRouteFood({...makeCatalogFood(), brand: 7})).toBeNull()
    })
  })

  describe('non-object input', () => {
    it('rejects null', () => {
      expect(parseRouteFood(null)).toBeNull()
    })

    it('rejects undefined', () => {
      expect(parseRouteFood(undefined)).toBeNull()
    })

    it('rejects a string', () => {
      expect(parseRouteFood('catalog-food-1')).toBeNull()
    })

    it('rejects a number', () => {
      expect(parseRouteFood(1)).toBeNull()
    })

    it('rejects an array', () => {
      expect(parseRouteFood([makeCatalogFood()])).toBeNull()
    })

    it('rejects an empty object', () => {
      expect(parseRouteFood({})).toBeNull()
    })
  })
})
