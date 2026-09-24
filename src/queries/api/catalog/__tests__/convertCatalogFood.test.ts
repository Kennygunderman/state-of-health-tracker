import {convertCatalogFood} from '@queries/api/catalog/converter/convertCatalogFood'
import {CatalogFoodResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import * as io from 'io-ts'

type CatalogFoodPayload = io.TypeOf<typeof CatalogFoodResponse>

const makeFoodResponse = (overrides: Partial<CatalogFoodPayload> = {}): CatalogFoodPayload => ({
  id: 'catalog-food-1',
  name: 'Chicken breast, boneless, skinless, raw',
  category: 'protein_poultry',
  foodState: 'raw',
  identitySource: 'usda',
  nutritionProvenance: 'source_backed',
  nutritionBasis: 'per_100g',
  basisAmount: 100,
  calories: 120,
  protein: 22.5,
  carbs: 0,
  fat: 2.6,
  fiber: 0,
  defaultPortion: {description: '4 oz', amount: 4, unit: 'oz', gramWeight: 113.4},
  allergenTags: [],
  allergenStatus: 'known',
  foodGroup: 'poultry',
  ...overrides
})

describe('convertCatalogFood', () => {
  describe('a fully populated row', () => {
    it('maps every member of the wire row onto the catalog food model', () => {
      expect(convertCatalogFood(makeFoodResponse())).toEqual({
        id: 'catalog-food-1',
        name: 'Chicken breast, boneless, skinless, raw',
        category: 'protein_poultry',
        foodState: 'raw',
        identitySource: 'usda',
        nutritionProvenance: 'source_backed',
        nutritionBasis: 'per_100g',
        basisAmount: 100,
        calories: 120,
        protein: 22.5,
        carbs: 0,
        fat: 2.6,
        fiber: 0,
        defaultPortion: {description: '4 oz', amount: 4, unit: 'oz', gramWeight: 113.4},
        allergenTags: [],
        allergenStatus: 'known',
        foodGroup: 'poultry'
      })
    })
  })

  describe('nutritionProvenance', () => {
    it('carries source_backed through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionProvenance: 'source_backed'}))

      expect(result.nutritionProvenance).toBe('source_backed')
    })

    it('carries ingredient_derived through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionProvenance: 'ingredient_derived'}))

      expect(result.nutritionProvenance).toBe('ingredient_derived')
    })

    it('carries ai_estimated through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionProvenance: 'ai_estimated'}))

      expect(result.nutritionProvenance).toBe('ai_estimated')
    })

    it('falls back to ai_estimated for an unrecognised provenance rather than claiming a source', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionProvenance: 'peer_reviewed'}))

      expect(result.nutritionProvenance).toBe('ai_estimated')
    })

    it('falls back to ai_estimated for an empty provenance', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionProvenance: ''}))

      expect(result.nutritionProvenance).toBe('ai_estimated')
    })

    it('falls back to ai_estimated for user_entered, which is outside the catalog set', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionProvenance: 'user_entered'}))

      expect(result.nutritionProvenance).toBe('ai_estimated')
    })
  })

  describe('identitySource', () => {
    it('carries usda through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({identitySource: 'usda'}))

      expect(result.identitySource).toBe('usda')
    })

    it('carries ai_generated through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({identitySource: 'ai_generated'}))

      expect(result.identitySource).toBe('ai_generated')
    })

    it('falls back to ai_generated for an unrecognised source rather than claiming usda provenance', () => {
      const result = convertCatalogFood(makeFoodResponse({identitySource: 'crowdsourced'}))

      expect(result.identitySource).toBe('ai_generated')
    })

    it('falls back to ai_generated for an empty source', () => {
      const result = convertCatalogFood(makeFoodResponse({identitySource: ''}))

      expect(result.identitySource).toBe('ai_generated')
    })
  })

  describe('allergenStatus', () => {
    it('carries known through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({allergenStatus: 'known'}))

      expect(result.allergenStatus).toBe('known')
    })

    it('carries unknown through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({allergenStatus: 'unknown'}))

      expect(result.allergenStatus).toBe('unknown')
    })

    it('falls back to unknown for an unrecognised status rather than claiming allergens are known', () => {
      const result = convertCatalogFood(makeFoodResponse({allergenStatus: 'partial'}))

      expect(result.allergenStatus).toBe('unknown')
    })

    it('falls back to unknown for an empty status', () => {
      const result = convertCatalogFood(makeFoodResponse({allergenStatus: ''}))

      expect(result.allergenStatus).toBe('unknown')
    })
  })

  describe('foodState', () => {
    it('carries every recognised state through unchanged', () => {
      expect(convertCatalogFood(makeFoodResponse({foodState: 'raw'})).foodState).toBe('raw')
      expect(convertCatalogFood(makeFoodResponse({foodState: 'cooked'})).foodState).toBe('cooked')
      expect(convertCatalogFood(makeFoodResponse({foodState: 'prepared'})).foodState).toBe('prepared')
      expect(convertCatalogFood(makeFoodResponse({foodState: 'dry'})).foodState).toBe('dry')
      expect(convertCatalogFood(makeFoodResponse({foodState: 'as_purchased'})).foodState).toBe('as_purchased')
    })

    it('falls back to as_purchased for an unrecognised state rather than claiming a preparation', () => {
      const result = convertCatalogFood(makeFoodResponse({foodState: 'freeze_dried'}))

      expect(result.foodState).toBe('as_purchased')
    })

    it('falls back to as_purchased for an empty state', () => {
      const result = convertCatalogFood(makeFoodResponse({foodState: ''}))

      expect(result.foodState).toBe('as_purchased')
    })
  })

  describe('nutritionBasis', () => {
    it('carries every recognised basis through unchanged', () => {
      expect(convertCatalogFood(makeFoodResponse({nutritionBasis: 'per_100g'})).nutritionBasis).toBe('per_100g')
      expect(convertCatalogFood(makeFoodResponse({nutritionBasis: 'per_100ml'})).nutritionBasis).toBe('per_100ml')
      expect(convertCatalogFood(makeFoodResponse({nutritionBasis: 'per_serving'})).nutritionBasis).toBe('per_serving')
    })

    it('falls back to per_100g for an unrecognised basis rather than restating it as one serving', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionBasis: 'per_portion'}))

      expect(result.nutritionBasis).toBe('per_100g')
    })

    it('falls back to per_100g for an empty basis', () => {
      const result = convertCatalogFood(makeFoodResponse({nutritionBasis: ''}))

      expect(result.nutritionBasis).toBe('per_100g')
    })
  })

  describe('fields with no fallback', () => {
    it('carries an unrecognised category through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({category: 'lab_grown'}))

      expect(result.category).toBe('lab_grown')
    })

    it('carries an unrecognised food group through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({foodGroup: 'cultured_protein'}))

      expect(result.foodGroup).toBe('cultured_protein')
    })

    it('carries the identifier and name through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({id: 'catalog-food-42', name: 'Brown rice, cooked'}))

      expect(result.id).toBe('catalog-food-42')
      expect(result.name).toBe('Brown rice, cooked')
    })

    it('carries punctuation and non-ascii characters in the name through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({name: 'Jalapeño peppers, raw — sliced (½ cup)'}))

      expect(result.name).toBe('Jalapeño peppers, raw — sliced (½ cup)')
    })
  })

  describe('fiber', () => {
    it('carries a numeric fiber value through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({fiber: 3}))

      expect(result.fiber).toBe(3)
    })

    it('keeps a zero fiber value as zero rather than reporting it as unknown', () => {
      const result = convertCatalogFood(makeFoodResponse({fiber: 0}))

      expect(result.fiber).toBe(0)
    })

    it('keeps an unknown fiber value as null', () => {
      const result = convertCatalogFood(makeFoodResponse({fiber: null}))

      expect(result.fiber).toBeNull()
    })

    it('preserves a fractional fiber value without rounding', () => {
      const result = convertCatalogFood(makeFoodResponse({fiber: 2.4}))

      expect(result.fiber).toBe(2.4)
    })
  })

  describe('defaultPortion', () => {
    it('carries every member of the portion through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse())

      expect(result.defaultPortion).toEqual({description: '4 oz', amount: 4, unit: 'oz', gramWeight: 113.4})
    })

    it('preserves a fractional amount and gram weight without rounding', () => {
      const portion = {description: '1/2 breast', amount: 0.5, unit: 'breast', gramWeight: 113.4}
      const result = convertCatalogFood(makeFoodResponse({defaultPortion: portion}))

      expect(result.defaultPortion).toEqual({description: '1/2 breast', amount: 0.5, unit: 'breast', gramWeight: 113.4})
    })

    it('carries a different portion vocabulary through unchanged', () => {
      const portion = {description: '1 cup, chopped', amount: 1, unit: 'cup', gramWeight: 149}
      const result = convertCatalogFood(makeFoodResponse({defaultPortion: portion}))

      expect(result.defaultPortion).toEqual({description: '1 cup, chopped', amount: 1, unit: 'cup', gramWeight: 149})
    })
  })

  // The converter once mapped a defaultPortionNutrition member that frozen AAP 0.5.2 does not define. A payload
  // carrying exactly the contract's field set must convert, and the model must carry nothing beyond it.
  describe('the AAP 0.5.2 field set', () => {
    const CONTRACT_KEYS = [
      'allergenStatus',
      'allergenTags',
      'basisAmount',
      'calories',
      'carbs',
      'category',
      'defaultPortion',
      'fat',
      'fiber',
      'foodGroup',
      'foodState',
      'id',
      'identitySource',
      'name',
      'nutritionBasis',
      'nutritionProvenance',
      'protein'
    ]

    it('converts a payload carrying exactly the members the contract defines', () => {
      const payload = makeFoodResponse()

      expect(Object.keys(payload).sort()).toEqual(CONTRACT_KEYS)
      expect(Object.keys(convertCatalogFood(payload)).sort()).toEqual(CONTRACT_KEYS)
    })

    it('carries no server-computed portion projection onto the model', () => {
      expect(convertCatalogFood(makeFoodResponse())).not.toHaveProperty('defaultPortionNutrition')
    })
  })

  describe('boundary numerics', () => {
    it('keeps every macro at zero rather than dropping it', () => {
      const result = convertCatalogFood(makeFoodResponse({calories: 0, protein: 0, carbs: 0, fat: 0}))

      expect(result.calories).toBe(0)
      expect(result.protein).toBe(0)
      expect(result.carbs).toBe(0)
      expect(result.fat).toBe(0)
    })

    it('keeps a zero basis amount as zero', () => {
      const result = convertCatalogFood(makeFoodResponse({basisAmount: 0}))

      expect(result.basisAmount).toBe(0)
    })

    it('preserves fractional macros without rounding', () => {
      const result = convertCatalogFood(makeFoodResponse({calories: 120.5, protein: 22.5, carbs: 0.4, fat: 2.6}))

      expect(result.calories).toBe(120.5)
      expect(result.protein).toBe(22.5)
      expect(result.carbs).toBe(0.4)
      expect(result.fat).toBe(2.6)
    })

    it('carries a large calorie value through unchanged', () => {
      const result = convertCatalogFood(makeFoodResponse({calories: 900}))

      expect(result.calories).toBe(900)
    })
  })

  describe('allergenTags', () => {
    it('carries an empty tag list through as an empty list', () => {
      const result = convertCatalogFood(makeFoodResponse({allergenTags: []}))

      expect(result.allergenTags).toEqual([])
    })

    it('carries several tags through in the order the server sent them', () => {
      const result = convertCatalogFood(makeFoodResponse({allergenTags: ['milk', 'sesame']}))

      expect(result.allergenTags).toEqual(['milk', 'sesame'])
    })
  })

  describe('input immutability', () => {
    it('leaves the decoded payload untouched', () => {
      const payload = makeFoodResponse({fiber: 1.2, allergenTags: ['milk'], nutritionProvenance: 'user_entered'})
      const snapshot = JSON.parse(JSON.stringify(payload))

      convertCatalogFood(payload)

      expect(payload).toEqual(snapshot)
    })
  })
})
