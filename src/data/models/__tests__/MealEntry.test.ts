import {convertMealEntry} from '@queries/api/macros/converter/convertDailyMacros'

import {
  entryCalories,
  entryProvenanceLabel,
  entryServingText,
  InputMethodEnum,
  isFromMealPlan,
  LogMealEntryPayload,
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

type MealEntryWire = Parameters<typeof convertMealEntry>[0]

// The two meal-planning members carry explicit nulls so the payload stays valid
// whether the codec declares them nullable-required or an optional fragment.
const makeEntryResponse = (overrides: Partial<MealEntryWire> = {}): MealEntryWire => ({
  id: 'entry-1',
  foodId: 'food-1',
  name: 'Chicken Breast',
  servingText: '4 oz',
  servings: 1,
  calories: 187,
  protein: 35,
  carbs: 0,
  fat: 4,
  inputMethod: 'library',
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
      expect(labelFor(InputMethodEnum.MEAL_PLAN, null)).toBe('From meal plan')
    })

    it('keeps the origin caption for a planned entry, so the origin outranks every provenance branch', () => {
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'ai_estimated')).toBe('From meal plan')
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'source_backed')).toBe('From meal plan')
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'ingredient_derived')).toBe('From meal plan')
      expect(labelFor(InputMethodEnum.MEAL_PLAN, 'user_entered')).toBe('From meal plan')
    })
  })

  describe('stored provenance', () => {
    it('captions a source-backed entry', () => {
      expect(labelFor(InputMethodEnum.SEARCH, 'source_backed')).toBe('Source-backed')
    })

    it('captions an ingredient-derived entry', () => {
      expect(labelFor(InputMethodEnum.SEARCH, 'ingredient_derived')).toBe('Estimated from ingredients')
    })

    it('captions an ai-estimated entry with the short diary estimate caption', () => {
      expect(labelFor(InputMethodEnum.SEARCH, 'ai_estimated')).toBe('Estimated')
    })

    it('captions an AI-logged entry stored as user-entered as an estimate', () => {
      expect(labelFor(InputMethodEnum.AI_TEXT, 'user_entered')).toBe('Estimated')
    })

    it('leaves a user-entered entry uncaptioned because client numbers carry no source claim', () => {
      expect(labelFor(InputMethodEnum.LIBRARY, 'user_entered')).toBeNull()
    })
  })

  describe('legacy rows written before the provenance column', () => {
    it('still captions an AI-photo entry as an estimate', () => {
      expect(labelFor(InputMethodEnum.AI_PHOTO, null)).toBe('Estimated')
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

      expect(captions).toEqual(['From meal plan', 'Source-backed', 'Estimated from ingredients', 'Estimated'])
      expect(captions.every(caption => caption !== null && caption.length > 0)).toBe(true)
      expect(new Set(captions).size).toBe(captions.length)
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

  it('decodes an unknown wire input method to LIBRARY, leaving the row neither planned nor captioned', () => {
    const decodedUnknown = convertMealEntry(makeEntryResponse({inputMethod: 'barcode_scan'}))

    expect(decodedUnknown.inputMethod).toBe(InputMethodEnum.LIBRARY)
    expect(isFromMealPlan(decodedUnknown)).toBe(false)
    expect(entryProvenanceLabel(decodedUnknown)).toBeNull()
  })

  describe('the subset a request body may ask for', () => {
    const LEGACY_BODY = {
      name: 'Chicken Breast',
      servingText: '4 oz',
      servings: 1,
      calories: 187,
      protein: 35,
      carbs: 0,
      fat: 4
    }

    // The value-level twin of ClientInputMethod, derived the same way, because a type cannot be
    // asserted on at runtime.
    const clientInputMethods = Object.values(InputMethodEnum).filter(method => method !== InputMethodEnum.MEAL_PLAN)

    it('narrows the stored vocabulary rather than replacing it, keeping all five members requestable-or-not', () => {
      expect(Object.values(InputMethodEnum)).toHaveLength(5)
      expect(clientInputMethods).toHaveLength(4)
      expect(Object.values(InputMethodEnum)).toEqual(expect.arrayContaining(clientInputMethods))
    })

    it('leaves the planned origin out of the client-selectable set, because only the server writes it', () => {
      expect(clientInputMethods).not.toContain(InputMethodEnum.MEAL_PLAN)
      expect(clientInputMethods).not.toContain('meal_plan')
    })

    it('is exactly library, search, ai_text and ai_photo', () => {
      expect(clientInputMethods).toEqual(['library', 'search', 'ai_text', 'ai_photo'])
    })

    it('types a legacy body for every client-selectable method', () => {
      const clientBodies: LogMealEntryPayload[] = [
        {...LEGACY_BODY, inputMethod: InputMethodEnum.LIBRARY},
        {...LEGACY_BODY, inputMethod: InputMethodEnum.SEARCH},
        {...LEGACY_BODY, inputMethod: InputMethodEnum.AI_TEXT},
        {...LEGACY_BODY, inputMethod: InputMethodEnum.AI_PHOTO}
      ]

      expect(clientBodies.map(body => body.inputMethod)).toEqual(clientInputMethods)
    })

    it('refuses a legacy body that claims the planned origin, and the refusal is the compiler', () => {
      const plannedClaim: LogMealEntryPayload = {
        ...LEGACY_BODY,
        // @ts-expect-error the planned origin is server-written, so this assignment must stay a
        // compile error — this directive fails the build the day it stops being one, which is the
        // regression it guards
        inputMethod: InputMethodEnum.MEAL_PLAN
      }

      expect(clientInputMethods).not.toContain(plannedClaim.inputMethod)
    })

    it('still admits the planned origin on a response entry, where the value belongs', () => {
      const plannedEntry: MealEntry = makeEntry({inputMethod: InputMethodEnum.MEAL_PLAN})

      expect(plannedEntry.inputMethod).toBe(InputMethodEnum.MEAL_PLAN)
      expect(isFromMealPlan(plannedEntry)).toBe(true)
    })
  })
})

describe('convertMealEntry', () => {
  const inputMethodFor = (inputMethod: string) => convertMealEntry(makeEntryResponse({inputMethod})).inputMethod

  it('carries every known wire input method through unchanged', () => {
    expect(inputMethodFor('library')).toBe(InputMethodEnum.LIBRARY)
    expect(inputMethodFor('search')).toBe(InputMethodEnum.SEARCH)
    expect(inputMethodFor('ai_text')).toBe(InputMethodEnum.AI_TEXT)
    expect(inputMethodFor('ai_photo')).toBe(InputMethodEnum.AI_PHOTO)
  })

  it('maps the meal_plan wire value to the planned-meal input method', () => {
    const entry = convertMealEntry(makeEntryResponse({inputMethod: 'meal_plan', mealPlanMealId: 'plan-meal-1'}))

    expect(entry.inputMethod).toBe(InputMethodEnum.MEAL_PLAN)
    expect(entry.mealPlanMealId).toBe('plan-meal-1')
    expect(isFromMealPlan(entry)).toBe(true)
  })

  it('carries the stored provenance onto the entry the diary captions from', () => {
    const entry = convertMealEntry(makeEntryResponse({inputMethod: 'search', nutritionProvenance: 'source_backed'}))

    expect(entry.nutritionProvenance).toBe('source_backed')
    expect(entryProvenanceLabel(entry)).toBe('Source-backed')
  })

  it('falls back to the library input method for an unknown wire value', () => {
    expect(inputMethodFor('barcode_scan')).toBe(InputMethodEnum.LIBRARY)
  })

  it('converts an unknown wire input method into a row that is neither planned nor captioned', () => {
    const entry = convertMealEntry(makeEntryResponse({inputMethod: 'barcode_scan'}))

    expect(isFromMealPlan(entry)).toBe(false)
    expect(entryProvenanceLabel(entry)).toBeNull()
  })
})
