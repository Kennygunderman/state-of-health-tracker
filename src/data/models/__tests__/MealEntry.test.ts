import {
  MEAL_ENTRY_ESTIMATED_LABEL,
  MEAL_ENTRY_FROM_MEAL_PLAN_LABEL,
  MEAL_ENTRY_INGREDIENT_DERIVED_LABEL,
  MEAL_ENTRY_SOURCE_BACKED_LABEL
} from '@constants/strings'

import {
  entryCalories,
  entryProvenanceLabel,
  entryServingText,
  InputMethodEnum,
  isFromMealPlan,
  MealEntry
} from '../MealEntry'

const makeEntry = (overrides: Partial<MealEntry> = {}): MealEntry => ({
  id: 'entry-1',
  foodId: 'food-1',
  name: 'Chicken Breast',
  servingText: '4 oz',
  servings: 1,
  calories: 187,
  protein: 35,
  carbs: 0,
  fat: 4,
  inputMethod: InputMethodEnum.LIBRARY,
  loggedAt: '2026-07-03T12:00:00.000Z',
  mealPlanMealId: null,
  nutritionProvenance: null,
  ...overrides
})

describe('entryCalories', () => {
  it('multiplies per-serving calories by servings', () => {
    expect(entryCalories(makeEntry({calories: 525, servings: 2}))).toBe(1050)
  })
})

describe('entryServingText', () => {
  it('returns null when the entry has no serving text', () => {
    expect(entryServingText(makeEntry({servingText: null}))).toBeNull()
  })

  it('returns the snapshot unchanged for a single serving', () => {
    expect(entryServingText(makeEntry({servingText: '4 oz', servings: 1}))).toBe('4 oz')
  })

  it('scales the leading number by servings', () => {
    expect(entryServingText(makeEntry({servingText: '4 oz', servings: 2}))).toBe('8 oz')
    expect(entryServingText(makeEntry({servingText: '2 tbsp', servings: 0.5}))).toBe('1 tbsp')
    expect(entryServingText(makeEntry({servingText: '1', servings: 2}))).toBe('2')
    expect(entryServingText(makeEntry({servingText: '1', servings: 1.5}))).toBe('1.5')
  })

  it('pluralizes serving counts', () => {
    expect(entryServingText(makeEntry({servingText: '1 serving', servings: 2}))).toBe('2 servings')
    expect(entryServingText(makeEntry({servingText: '2 servings', servings: 0.5}))).toBe('1 serving')
  })

  it('appends a multiplier when the text has no leading number', () => {
    expect(entryServingText(makeEntry({servingText: 'large bowl', servings: 2}))).toBe('large bowl × 2')
  })
})

describe('isFromMealPlan', () => {
  it('treats the meal-plan input method as a planned-meal origin', () => {
    expect(isFromMealPlan(makeEntry({inputMethod: InputMethodEnum.MEAL_PLAN}))).toBe(true)
  })

  it('treats every other input method as a self-logged entry', () => {
    expect(isFromMealPlan(makeEntry({inputMethod: InputMethodEnum.LIBRARY}))).toBe(false)
    expect(isFromMealPlan(makeEntry({inputMethod: InputMethodEnum.SEARCH}))).toBe(false)
    expect(isFromMealPlan(makeEntry({inputMethod: InputMethodEnum.AI_TEXT}))).toBe(false)
    expect(isFromMealPlan(makeEntry({inputMethod: InputMethodEnum.AI_PHOTO}))).toBe(false)
  })
})

describe('entryProvenanceLabel', () => {
  const labelFor = (inputMethod: InputMethodEnum, nutritionProvenance: MealEntry['nutritionProvenance']) =>
    entryProvenanceLabel(makeEntry({inputMethod, nutritionProvenance}))

  describe('meal-plan origin', () => {
    it('captions a planned entry that carries no provenance', () => {
      expect(labelFor(InputMethodEnum.MEAL_PLAN, null)).toBe(MEAL_ENTRY_FROM_MEAL_PLAN_LABEL)
    })

    it('keeps the origin caption for a planned entry, so the origin outranks every provenance branch', () => {
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'ai_estimated')).toBe(MEAL_ENTRY_FROM_MEAL_PLAN_LABEL)
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'source_backed')).toBe(MEAL_ENTRY_FROM_MEAL_PLAN_LABEL)
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'ingredient_derived')).toBe(MEAL_ENTRY_FROM_MEAL_PLAN_LABEL)
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'user_entered')).toBe(MEAL_ENTRY_FROM_MEAL_PLAN_LABEL)
    })
  })

  describe('stored provenance', () => {
    it('captions a source-backed entry', () => {
      expect(labelFor(InputMethodEnum.SEARCH, 'source_backed')).toBe(MEAL_ENTRY_SOURCE_BACKED_LABEL)
    })

    it('captions an ingredient-derived entry', () => {
      expect(labelFor(InputMethodEnum.SEARCH, 'ingredient_derived')).toBe(MEAL_ENTRY_INGREDIENT_DERIVED_LABEL)
    })

    it('captions an ai-estimated entry with the short diary estimate caption', () => {
      expect(labelFor(InputMethodEnum.SEARCH, 'ai_estimated')).toBe(MEAL_ENTRY_ESTIMATED_LABEL)
    })

    it('captions an AI-logged entry stored as user-entered as an estimate', () => {
      expect(labelFor(InputMethodEnum.AI_TEXT, 'user_entered')).toBe(MEAL_ENTRY_ESTIMATED_LABEL)
    })

    it('leaves a user-entered entry uncaptioned because client numbers carry no source claim', () => {
      expect(labelFor(InputMethodEnum.LIBRARY, 'user_entered')).toBeNull()
    })
  })

  describe('legacy rows written before the provenance column', () => {
    it('still captions an AI-photo entry as an estimate', () => {
      expect(labelFor(InputMethodEnum.AI_PHOTO, null)).toBe(MEAL_ENTRY_ESTIMATED_LABEL)
    })

    it('renders no caption for library and search rows', () => {
      expect(labelFor(InputMethodEnum.LIBRARY, null)).toBeNull()
      expect(labelFor(InputMethodEnum.SEARCH, null)).toBeNull()
    })
  })

  describe('the caption set the diary may render', () => {
    it('renders a distinct non-empty caption per labelled class, so no class can read as another', () => {
      const captions = [
        labelFor(InputMethodEnum.MEAL_PLAN, null),
        labelFor(InputMethodEnum.SEARCH, 'source_backed'),
        labelFor(InputMethodEnum.SEARCH, 'ingredient_derived'),
        labelFor(InputMethodEnum.SEARCH, 'ai_estimated')
      ]

      expect(new Set(captions.filter(caption => caption !== null && caption.length > 0)).size).toBe(4)
    })
  })
})

describe('InputMethodEnum', () => {
  it('pins the closed set of wire values a response may carry', () => {
    expect(Object.values(InputMethodEnum)).toEqual(['library', 'search', 'ai_text', 'ai_photo', 'meal_plan'])
  })

  it('does not recognise an unknown wire input method, which a response decodes to LIBRARY instead', () => {
    expect(Object.values(InputMethodEnum)).not.toContain('barcode_scan')
  })

  it('renders a row whose unknown wire method decoded to LIBRARY as neither planned nor captioned', () => {
    const decodedUnknown = makeEntry({inputMethod: InputMethodEnum.LIBRARY, nutritionProvenance: null})

    expect(isFromMealPlan(decodedUnknown)).toBe(false)
    expect(entryProvenanceLabel(decodedUnknown)).toBeNull()
  })
})
