import {
  CatalogFoodResponse,
  CatalogSearchResponse,
  CatalogSuggestionsResponse
} from '@queries/api/catalog/decoder/CatalogDecoder'
import {Either, isLeft, isRight} from 'fp-ts/lib/Either'

const makePortionPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  description: '4 oz',
  amount: 4,
  unit: 'oz',
  gramWeight: 113.4,
  ...overrides
})

const makeFoodPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
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
  defaultPortion: makePortionPayload(),
  allergenTags: [],
  allergenStatus: 'known',
  foodGroup: 'poultry',
  ...overrides
})

const makeSuggestionPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'catalog-food-9',
  name: 'Mushrooms, white',
  foodGroup: 'mushroom',
  ...overrides
})

const makePaginationPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  page: 1,
  limit: 25,
  total: 3,
  totalPages: 1,
  ...overrides
})

const makeSearchPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  items: [makeFoodPayload()],
  pagination: makePaginationPayload(),
  ...overrides
})

const makeSuggestionsPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  items: [makeSuggestionPayload()],
  ...overrides
})

const omitKey = (payload: Record<string, unknown>, key: string): Record<string, unknown> => {
  const next = {...payload}

  delete next[key]

  return next
}

const expectRight = <A>(decoded: Either<unknown, A>): A => {
  if (isLeft(decoded)) {
    throw new Error(`expected a Right, received: ${JSON.stringify(decoded.left)}`)
  }

  return decoded.right
}

describe('CatalogSearchResponse', () => {
  it('decodes a full search envelope, including every nested food row', () => {
    const decoded = CatalogSearchResponse.decode(makeSearchPayload())
    const search = expectRight(decoded)

    expect(isRight(decoded)).toBe(true)
    expect(search.items).toHaveLength(1)
    expect(search.items[0].name).toBe('Chicken breast, boneless, skinless, raw')
    expect(search.items[0].defaultPortion.gramWeight).toBe(113.4)
  })

  it('carries every pagination member the catalog search pages on', () => {
    const search = expectRight(CatalogSearchResponse.decode(makeSearchPayload()))

    expect(search.pagination).toEqual({page: 1, limit: 25, total: 3, totalPages: 1})
  })

  it('decodes an envelope that carries no results', () => {
    const pagination = makePaginationPayload({total: 0, totalPages: 0})
    const decoded = CatalogSearchResponse.decode(makeSearchPayload({items: [], pagination}))

    expect(isRight(decoded)).toBe(true)
    expect(expectRight(decoded).items).toHaveLength(0)
  })

  it('decodes an envelope carrying several food rows', () => {
    const items = [
      makeFoodPayload(),
      makeFoodPayload({id: 'catalog-food-2', name: 'Brown rice, cooked'}),
      makeFoodPayload({id: 'catalog-food-3', name: 'Black beans, cooked'})
    ]
    const decoded = CatalogSearchResponse.decode(makeSearchPayload({items}))

    expect(isRight(decoded)).toBe(true)
    expect(expectRight(decoded).items).toHaveLength(3)
  })

  it('rejects an envelope with no items member', () => {
    expect(isLeft(CatalogSearchResponse.decode(omitKey(makeSearchPayload(), 'items')))).toBe(true)
  })

  it('rejects an envelope with no pagination block', () => {
    expect(isLeft(CatalogSearchResponse.decode(omitKey(makeSearchPayload(), 'pagination')))).toBe(true)
  })

  it('rejects a pagination block that is missing totalPages', () => {
    const pagination = omitKey(makePaginationPayload(), 'totalPages')

    expect(isLeft(CatalogSearchResponse.decode(makeSearchPayload({pagination})))).toBe(true)
  })

  it('rejects a pagination member supplied as a numeric string', () => {
    const pagination = makePaginationPayload({total: '3'})

    expect(isLeft(CatalogSearchResponse.decode(makeSearchPayload({pagination})))).toBe(true)
  })

  it('rejects an envelope whose items array holds one invalid food row', () => {
    const items = [makeFoodPayload(), omitKey(makeFoodPayload(), 'defaultPortion')]

    expect(isLeft(CatalogSearchResponse.decode(makeSearchPayload({items})))).toBe(true)
  })
})

describe('CatalogSuggestionsResponse', () => {
  it('decodes a suggestions envelope and carries each row through unchanged', () => {
    const decoded = CatalogSuggestionsResponse.decode(makeSuggestionsPayload())
    const suggestions = expectRight(decoded)

    expect(isRight(decoded)).toBe(true)
    expect(suggestions.items).toHaveLength(1)
    expect(suggestions.items[0]).toEqual({id: 'catalog-food-9', name: 'Mushrooms, white', foodGroup: 'mushroom'})
  })

  it('decodes an envelope that carries no suggestions', () => {
    const decoded = CatalogSuggestionsResponse.decode(makeSuggestionsPayload({items: []}))

    expect(isRight(decoded)).toBe(true)
    expect(expectRight(decoded).items).toHaveLength(0)
  })

  it('rejects a suggestion row that is missing foodGroup', () => {
    const items = [omitKey(makeSuggestionPayload(), 'foodGroup')]

    expect(isLeft(CatalogSuggestionsResponse.decode(makeSuggestionsPayload({items})))).toBe(true)
  })

  it('rejects a suggestion row whose id is null', () => {
    const items = [makeSuggestionPayload({id: null})]

    expect(isLeft(CatalogSuggestionsResponse.decode(makeSuggestionsPayload({items})))).toBe(true)
  })
})

describe('CatalogFoodResponse', () => {
  describe('valid payloads', () => {
    it('decodes a fully populated catalog row', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload())
      const food = expectRight(decoded)

      expect(isRight(decoded)).toBe(true)
      expect(food.nutritionBasis).toBe('per_100g')
      expect(food.basisAmount).toBe(100)
      expect(food.calories).toBe(120)
      expect(food.protein).toBe(22.5)
    })

    it('decodes a row with no allergen tags', () => {
      const food = expectRight(CatalogFoodResponse.decode(makeFoodPayload({allergenTags: []})))

      expect(food.allergenTags).toEqual([])
    })

    it('decodes a row carrying several allergen tags', () => {
      const allergenTags = ['milk', 'soy', 'wheat']
      const food = expectRight(CatalogFoodResponse.decode(makeFoodPayload({allergenTags})))

      expect(food.allergenTags).toEqual(['milk', 'soy', 'wheat'])
    })
  })

  describe('fiber', () => {
    it('decodes the explicit null the server sends when fiber is unknown', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({fiber: null}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).fiber).toBeNull()
    })

    it('keeps a zero fiber value as zero', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({fiber: 0}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).fiber).toBe(0)
    })

    it('rejects a payload that omits the fiber member entirely', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'fiber')))).toBe(true)
    })

    it('rejects an explicitly undefined fiber value', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({fiber: undefined})))).toBe(true)
    })

    it('rejects a fiber value supplied as a numeric string', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({fiber: '2'})))).toBe(true)
    })
  })

  describe('defaultPortion', () => {
    it('carries every member of a valid default portion through unchanged', () => {
      const food = expectRight(CatalogFoodResponse.decode(makeFoodPayload()))

      expect(food.defaultPortion).toEqual({description: '4 oz', amount: 4, unit: 'oz', gramWeight: 113.4})
    })

    it('rejects a payload that omits defaultPortion', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'defaultPortion')))).toBe(true)
    })

    it('rejects a null defaultPortion', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({defaultPortion: null})))).toBe(true)
    })

    it('rejects a defaultPortion with no gram weight', () => {
      const defaultPortion = omitKey(makePortionPayload(), 'gramWeight')

      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({defaultPortion})))).toBe(true)
    })

    it('rejects a defaultPortion with no description', () => {
      const defaultPortion = omitKey(makePortionPayload(), 'description')

      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({defaultPortion})))).toBe(true)
    })

    it('rejects a gram weight supplied as a numeric string', () => {
      const defaultPortion = makePortionPayload({gramWeight: '113.4'})

      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({defaultPortion})))).toBe(true)
    })
  })

  describe('lenient code fields', () => {
    it('carries a category it does not recognise through verbatim', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({category: 'lab_grown'}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).category).toBe('lab_grown')
    })

    it('carries a nutrition provenance it does not recognise through verbatim', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({nutritionProvenance: 'peer_reviewed'}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).nutritionProvenance).toBe('peer_reviewed')
    })

    it('carries an identity source it does not recognise through verbatim', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({identitySource: 'crowdsourced'}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).identitySource).toBe('crowdsourced')
    })

    it('carries an allergen status it does not recognise through verbatim', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({allergenStatus: 'partial'}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).allergenStatus).toBe('partial')
    })

    it('decodes a row on which every code member is unknown', () => {
      const unknownCodes = {
        category: 'lab_grown',
        nutritionProvenance: 'peer_reviewed',
        identitySource: 'crowdsourced',
        allergenStatus: 'partial'
      }
      const decoded = CatalogFoodResponse.decode(makeFoodPayload(unknownCodes))
      const food = expectRight(decoded)

      expect(isRight(decoded)).toBe(true)
      expect(food.category).toBe('lab_grown')
      expect(food.nutritionProvenance).toBe('peer_reviewed')
      expect(food.identitySource).toBe('crowdsourced')
      expect(food.allergenStatus).toBe('partial')
    })
  })

  describe('missing or malformed members', () => {
    it('rejects a payload with no id', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'id')))).toBe(true)
    })

    it('rejects a payload with no name', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'name')))).toBe(true)
    })

    it('rejects a payload with no basisAmount', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'basisAmount')))).toBe(true)
    })

    it('rejects a payload with no allergenTags', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'allergenTags')))).toBe(true)
    })

    it('rejects a payload with no category', () => {
      expect(isLeft(CatalogFoodResponse.decode(omitKey(makeFoodPayload(), 'category')))).toBe(true)
    })

    it('rejects allergenTags containing a number', () => {
      const allergenTags = ['milk', 2]

      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({allergenTags})))).toBe(true)
    })

    it('rejects allergenTags supplied as a string instead of an array', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({allergenTags: 'milk'})))).toBe(true)
    })

    it('rejects calories supplied as a numeric string', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({calories: '120'})))).toBe(true)
    })

    it('rejects a null name', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({name: null})))).toBe(true)
    })

    it('rejects a null protein', () => {
      expect(isLeft(CatalogFoodResponse.decode(makeFoodPayload({protein: null})))).toBe(true)
    })
  })

  describe('unknown extra members', () => {
    it('decodes a payload carrying a member this client does not know about', () => {
      const decoded = CatalogFoodResponse.decode(makeFoodPayload({costClass: 2}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).name).toBe('Chicken breast, boneless, skinless, raw')
    })
  })

  describe('non-object input', () => {
    it('rejects null', () => {
      expect(isLeft(CatalogFoodResponse.decode(null))).toBe(true)
    })

    it('rejects undefined', () => {
      expect(isLeft(CatalogFoodResponse.decode(undefined))).toBe(true)
    })

    it('rejects a string', () => {
      expect(isLeft(CatalogFoodResponse.decode('catalog'))).toBe(true)
    })

    it('rejects an array', () => {
      expect(isLeft(CatalogFoodResponse.decode([]))).toBe(true)
    })
  })
})
