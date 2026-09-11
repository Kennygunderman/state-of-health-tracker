import {entryProvenanceLabel, InputMethodEnum, isFromMealPlan} from '@data/models/MealEntry'

import {convertMealEntry} from '../converter/convertDailyMacros'

type MealEntryWire = Parameters<typeof convertMealEntry>[0]

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
    expect(isFromMealPlan(entry)).toBe(true)
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
