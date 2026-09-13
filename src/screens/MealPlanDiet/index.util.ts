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

// Frozen because the table is module-global and drives both the chip cloud and the validation:
// reordering or extending it in place would change which allergens this screen can show as
// selected, and the nine named codes plus the sentinel are a wire contract, not a display list.
const ALLERGEN_CODES: readonly AllergenCode[] = Object.freeze([
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
] as const)

const isAllergenCode = (value: string): value is AllergenCode => ALLERGEN_CODES.some(code => code === value)

// A value outside the ten codes is dropped rather than rendered, so an allergen from a
// newer server release can neither add a chip nor pass as a selection.
const recognizedAllergens = (allergens: string[]): AllergenCode[] => allergens.filter(isAllergenCode)

export interface AllergenChip {
  readonly code: AllergenCode
  readonly label: string
  readonly selected: boolean
  readonly removable: boolean
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
  readonly value: Diet
  readonly label: string
}

const DIET_CODES: readonly Diet[] = Object.freeze(['none', 'vegetarian', 'vegan', 'pescatarian'] as const)

// Frozen entries as well as a frozen table: the option cards read this array on every render, so a
// consumer relabelling one entry in place would change the copy the screen shows from then on.
export const DIET_OPTIONS: readonly DietOption[] = Object.freeze(
  DIET_CODES.map(value => Object.freeze({value, label: MEAL_PLAN_DIET_LABELS[value]}))
)

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
