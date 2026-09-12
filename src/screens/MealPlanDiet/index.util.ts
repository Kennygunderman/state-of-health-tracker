import {Diet, TargetRoute} from '@data/models/MealPlanPreferences'

import {MEAL_PLAN_ALLERGEN_LABELS, MEAL_PLAN_DIET_LABELS} from '@constants/strings'

export type AllergenCode =
  | 'none'
  | 'milk'
  | 'eggs'
  | 'peanuts'
  | 'tree_nuts'
  | 'soy'
  | 'wheat'
  | 'fish'
  | 'shellfish'
  | 'sesame'

// Must stay identical to MealPlanSetupProvider's ALLERGEN_NONE, which owns the two-way
// exclusivity rule: a saved step carries either exactly ['none'] or named allergens, so
// the two sentinels diverging would silently corrupt the payload.
export const ALLERGEN_NONE_CODE = 'none'

const ALLERGEN_CODES: AllergenCode[] = [
  ALLERGEN_NONE_CODE,
  'milk',
  'eggs',
  'peanuts',
  'tree_nuts',
  'soy',
  'wheat',
  'fish',
  'shellfish',
  'sesame'
]

const isAllergenCode = (value: string): value is AllergenCode => ALLERGEN_CODES.some(code => code === value)

// A value outside the ten codes is dropped rather than rendered, so an allergen from a
// newer server release can neither add a chip nor pass as a selection.
const recognizedAllergens = (allergens: string[]): AllergenCode[] => allergens.filter(isAllergenCode)

export interface AllergenChip {
  code: AllergenCode
  label: string
  selected: boolean
  removable: boolean
}

export const buildAllergenChips = (selected: string[]): AllergenChip[] => {
  const selectedCodes = new Set(recognizedAllergens(selected))

  return ALLERGEN_CODES.map(code => ({
    code,
    label: MEAL_PLAN_ALLERGEN_LABELS[code],
    selected: selectedCodes.has(code),
    removable: selectedCodes.has(code)
  }))
}

export interface DietOption {
  value: Diet
  label: string
}

export const DIET_OPTIONS: DietOption[] = [
  {value: 'none', label: MEAL_PLAN_DIET_LABELS.none},
  {value: 'vegetarian', label: MEAL_PLAN_DIET_LABELS.vegetarian},
  {value: 'vegan', label: MEAL_PLAN_DIET_LABELS.vegan},
  {value: 'pescatarian', label: MEAL_PLAN_DIET_LABELS.pescatarian}
]

export type DietStepErrorCode = 'diet_required' | 'allergens_required'

export const validateDietStep = (diet: Diet | null, allergens: string[]): DietStepErrorCode[] => {
  const errors: DietStepErrorCode[] = []

  if (diet === null) {
    errors.push('diet_required')
  }

  if (recognizedAllergens(allergens).length === 0) {
    errors.push('allergens_required')
  }

  return errors
}

export interface WizardProgress {
  step: number
  totalSteps: number
}

// The manual-target route skips the calculation-only Activity step, so Diet is the third of six there
export const dietWizardProgress = (targetRoute: TargetRoute | null): WizardProgress =>
  targetRoute === 'manual' ? {step: 3, totalSteps: 6} : {step: 4, totalSteps: 7}
