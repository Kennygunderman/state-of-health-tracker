import type {NutritionTargetEstimate, NutritionTargetFeasibilityWarning} from '@data/models/NutritionTargets'

import {MEAL_PLAN_TARGET_WARNING_LABELS} from '@constants/strings'

export interface EditTargetsFields {
  calories: string
  protein: string
  carbs: string
  fat: string
}

export type EditTargetsFieldKey = keyof EditTargetsFields

export type TargetFieldErrorCode = 'required' | 'not_a_number' | 'below_min' | 'above_max'

export type EditTargetsErrors = Partial<Record<EditTargetsFieldKey, TargetFieldErrorCode>>

export interface EditTargetsValidation {
  errors: EditTargetsErrors
  isValid: boolean
}

export type TargetsSaveSource = 'estimated' | 'manual'

export const CALORIES_MIN = 800

export const CALORIES_MAX = 6000

export const MACRO_MIN = 1

export const MACRO_MAX = 1000

interface TargetFieldBounds {
  min: number
  max: number
}

// A macro floor of 1 g is what makes the drawn carbs error ("Enter a carb target above 0 g") truthful:
// manual macros are stored exactly as entered and are never rebalanced against the calorie target, so a
// 0 g macro has to be rejected here rather than filled in for the user
const TARGET_FIELD_BOUNDS: Record<EditTargetsFieldKey, TargetFieldBounds> = {
  calories: {min: CALORIES_MIN, max: CALORIES_MAX},
  protein: {min: MACRO_MIN, max: MACRO_MAX},
  carbs: {min: MACRO_MIN, max: MACRO_MAX},
  fat: {min: MACRO_MIN, max: MACRO_MAX}
}

const TARGET_FIELD_KEYS: EditTargetsFieldKey[] = ['calories', 'protein', 'carbs', 'fat']

// The banner reads the same on every render because the presentation order is this list, not the order the
// server happened to return its warnings in
const FEASIBILITY_WARNING_ORDER: NutritionTargetFeasibilityWarning[] = [
  'macro_energy_mismatch',
  'below_catalog_min',
  'above_catalog_max'
]

const WARNING_SENTENCE_SEPARATOR = ' '

const WHOLE_NUMBER_PATTERN = /^\d+$/

const parseTargetValue = (text: string): number | null => {
  const trimmed = text.trim()

  if (!WHOLE_NUMBER_PATTERN.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

export const sanitizeIntegerInput = (text: string): string => text.replace(/[^0-9]/g, '')

const validateTargetField = (value: string, bounds: TargetFieldBounds): TargetFieldErrorCode | null => {
  if (value.trim() === '') {
    return 'required'
  }

  const parsed = parseTargetValue(value)

  if (parsed === null) {
    return 'not_a_number'
  }

  if (parsed < bounds.min) {
    return 'below_min'
  }

  return parsed > bounds.max ? 'above_max' : null
}

export const validateEditTargets = (fields: EditTargetsFields): EditTargetsValidation => {
  const errors = TARGET_FIELD_KEYS.reduce<EditTargetsErrors>((accumulated, key) => {
    const error = validateTargetField(fields[key], TARGET_FIELD_BOUNDS[key])

    return error === null ? accumulated : {...accumulated, [key]: error}
  }, {})

  return {errors, isValid: Object.keys(errors).length === 0}
}

// Only the server may declare a saved target estimated — it recomputes the estimate from stored preferences
// and refuses a stale one — so 'estimated' is reserved for the case where every field still holds the
// estimate's own figure as this screen renders it (whole numbers). One edited digit, a missing estimate or an
// unparseable field all save as manual.
export const resolveTargetsSaveSource = (
  fields: EditTargetsFields,
  estimate: NutritionTargetEstimate | null
): TargetsSaveSource => {
  if (!estimate) {
    return 'manual'
  }

  const isUntouched = TARGET_FIELD_KEYS.every(key => parseTargetValue(fields[key]) === Math.round(estimate[key]))

  return isUntouched ? 'estimated' : 'manual'
}

export const feasibilityBannerBody = (warnings: NutritionTargetFeasibilityWarning[]): string | null => {
  const sentences = FEASIBILITY_WARNING_ORDER.filter(code => warnings.includes(code)).map(
    code => MEAL_PLAN_TARGET_WARNING_LABELS[code]
  )

  return sentences.length === 0 ? null : sentences.join(WARNING_SENTENCE_SEPARATOR)
}
