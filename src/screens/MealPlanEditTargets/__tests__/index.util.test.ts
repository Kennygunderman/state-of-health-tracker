import type {NutritionTargetEstimate} from '@data/models/NutritionTargets'

import {MEAL_PLAN_TARGET_WARNING_LABELS} from '@constants/strings'

import {
  CALORIES_MAX,
  CALORIES_MIN,
  EditTargetsFields,
  feasibilityBannerBody,
  MACRO_MAX,
  MACRO_MIN,
  resolveTargetsSaveSource,
  sanitizeIntegerInput,
  validateEditTargets
} from '../index.util'

const makeFields = (overrides: Partial<EditTargetsFields> = {}): EditTargetsFields => ({
  calories: '1940',
  protein: '146',
  carbs: '194',
  fat: '65',
  ...overrides
})

const makeEstimate = (overrides: Partial<NutritionTargetEstimate> = {}): NutritionTargetEstimate => ({
  source: 'estimated',
  estimateRevision: 4,
  inputs: {
    age: 34,
    heightCm: 177.8,
    weightKg: 82.6,
    sexForEstimate: 'female',
    activityLevel: 'lightly_active',
    goal: 'lose',
    paceLbPerWeek: 1
  },
  bmr: 1606,
  tdee: 2209,
  adjustment: -500,
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  clamped: false,
  clampReason: null,
  ...overrides
})

describe('target bounds', () => {
  it('pins the manual-target policy bounds the server validates', () => {
    expect(CALORIES_MIN).toBe(800)
    expect(CALORIES_MAX).toBe(6000)
    expect(MACRO_MIN).toBe(1)
    expect(MACRO_MAX).toBe(1000)
  })
})

describe('sanitizeIntegerInput', () => {
  it('keeps digits only', () => {
    expect(sanitizeIntegerInput('1940')).toBe('1940')
    expect(sanitizeIntegerInput('19a40')).toBe('1940')
    expect(sanitizeIntegerInput('abc')).toBe('')
    expect(sanitizeIntegerInput('')).toBe('')
  })

  it('strips a typed thousands separator, decimal point and minus sign', () => {
    expect(sanitizeIntegerInput('1,940')).toBe('1940')
    expect(sanitizeIntegerInput('19.40')).toBe('1940')
    expect(sanitizeIntegerInput('-500')).toBe('500')
  })

  it('never re-formats, so a partially typed value can still be extended', () => {
    expect(sanitizeIntegerInput('1')).toBe('1')
    expect(sanitizeIntegerInput('19')).toBe('19')
    expect(sanitizeIntegerInput('1940')).not.toBe('1,940')
  })
})

describe('validateEditTargets', () => {
  it('accepts four in-range whole numbers', () => {
    expect(validateEditTargets(makeFields())).toEqual({errors: {}, isValid: true})
  })

  it('reports an empty field as required and a whitespace-only field the same way', () => {
    expect(validateEditTargets(makeFields({calories: ''})).errors).toEqual({calories: 'required'})
    expect(validateEditTargets(makeFields({protein: '   '})).errors).toEqual({protein: 'required'})
  })

  it('distinguishes a non-numeric value from an empty one', () => {
    expect(validateEditTargets(makeFields({calories: 'abc'})).errors).toEqual({calories: 'not_a_number'})
    expect(validateEditTargets(makeFields({carbs: '1.5'})).errors).toEqual({carbs: 'not_a_number'})
    expect(validateEditTargets(makeFields({fat: '-5'})).errors).toEqual({fat: 'not_a_number'})
  })

  it('pins the calorie boundaries', () => {
    expect(validateEditTargets(makeFields({calories: '799'})).errors).toEqual({calories: 'below_min'})
    expect(validateEditTargets(makeFields({calories: '800'})).isValid).toBe(true)
    expect(validateEditTargets(makeFields({calories: '6000'})).isValid).toBe(true)
    expect(validateEditTargets(makeFields({calories: '6001'})).errors).toEqual({calories: 'above_max'})
  })

  it('rejects a zero macro and accepts one gram', () => {
    expect(validateEditTargets(makeFields({carbs: '0'})).errors).toEqual({carbs: 'below_min'})
    expect(validateEditTargets(makeFields({carbs: '1'})).isValid).toBe(true)
  })

  it('pins the macro maximum for protein, carbs and fat', () => {
    expect(validateEditTargets(makeFields({protein: '1000'})).isValid).toBe(true)
    expect(validateEditTargets(makeFields({protein: '1001'})).errors).toEqual({protein: 'above_max'})
    expect(validateEditTargets(makeFields({carbs: '1001'})).errors).toEqual({carbs: 'above_max'})
    expect(validateEditTargets(makeFields({fat: '1001'})).errors).toEqual({fat: 'above_max'})
  })

  it('reports every offending field in one pass', () => {
    const validation = validateEditTargets({calories: '', protein: 'abc', carbs: '0', fat: '1001'})

    expect(validation.errors).toEqual({
      calories: 'required',
      protein: 'not_a_number',
      carbs: 'below_min',
      fat: 'above_max'
    })
    expect(Object.keys(validation.errors)).toHaveLength(4)
    expect(validation.isValid).toBe(false)
  })

  it('tolerates surrounding whitespace on an otherwise valid value', () => {
    expect(validateEditTargets(makeFields({fat: ' 65 '})).isValid).toBe(true)
  })

  it('does not mutate the fields it is given', () => {
    const fields = makeFields({calories: ''})

    validateEditTargets(fields)

    expect(fields).toEqual(makeFields({calories: ''}))
  })
})

describe('resolveTargetsSaveSource', () => {
  it('reports estimated only when every field still holds the estimate figure', () => {
    expect(resolveTargetsSaveSource(makeFields(), makeEstimate())).toBe('estimated')
    expect(resolveTargetsSaveSource(makeFields({calories: ' 1940 '}), makeEstimate())).toBe('estimated')
  })

  it('reports manual when a single digit was edited', () => {
    expect(resolveTargetsSaveSource(makeFields({calories: '1941'}), makeEstimate())).toBe('manual')
    expect(resolveTargetsSaveSource(makeFields({fat: '64'}), makeEstimate())).toBe('manual')
  })

  it('reports manual when no estimate is available', () => {
    expect(resolveTargetsSaveSource(makeFields(), null)).toBe('manual')
  })

  it('reports manual when a field is empty or unparseable', () => {
    expect(resolveTargetsSaveSource(makeFields({protein: ''}), makeEstimate())).toBe('manual')
    expect(resolveTargetsSaveSource(makeFields({protein: 'abc'}), makeEstimate())).toBe('manual')
  })

  it('compares against the estimate as the whole number this screen renders', () => {
    expect(resolveTargetsSaveSource(makeFields({calories: '1940'}), makeEstimate({calories: 1940.4}))).toBe('estimated')
    expect(resolveTargetsSaveSource(makeFields({calories: '1941'}), makeEstimate({calories: 1940.4}))).toBe('manual')
  })
})

describe('feasibilityBannerBody', () => {
  it('returns null when there is nothing to warn about', () => {
    expect(feasibilityBannerBody([])).toBeNull()
  })

  it('returns the sentence for a single warning', () => {
    expect(feasibilityBannerBody(['macro_energy_mismatch'])).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.macro_energy_mismatch)
    expect(feasibilityBannerBody(['below_catalog_min'])).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.below_catalog_min)
    expect(feasibilityBannerBody(['above_catalog_max'])).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.above_catalog_max)
  })

  it('joins several warnings in a fixed order whatever order they arrive in', () => {
    const expected = [
      MEAL_PLAN_TARGET_WARNING_LABELS.macro_energy_mismatch,
      MEAL_PLAN_TARGET_WARNING_LABELS.above_catalog_max
    ].join(' ')

    expect(feasibilityBannerBody(['above_catalog_max', 'macro_energy_mismatch'])).toBe(expected)
    expect(feasibilityBannerBody(['macro_energy_mismatch', 'above_catalog_max'])).toBe(expected)
  })

  it('collapses a repeated warning and stays identical across calls', () => {
    const body = feasibilityBannerBody(['below_catalog_min', 'below_catalog_min'])

    expect(body).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.below_catalog_min)
    expect(feasibilityBannerBody(['below_catalog_min'])).toBe(body)
  })
})
