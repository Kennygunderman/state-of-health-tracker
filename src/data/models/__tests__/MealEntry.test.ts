import {entryCalories, entryServingText, InputMethodEnum, MealEntry} from '../MealEntry'

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
