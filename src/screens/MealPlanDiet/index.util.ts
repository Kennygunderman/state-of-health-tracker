import {ALLERGEN_NONE, Diet, TargetRoute} from '@data/models/MealPlanPreferences'

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

// The sentinel @data/models/MealPlanPreferences owns, under this screen's own name: it is one value, not a
// copy, because a saved step carries either exactly ['none'] or named allergens and two sentinels diverging
// would silently corrupt the payload.
export const ALLERGEN_NONE_CODE = ALLERGEN_NONE

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

const namedAllergens = (recognized: AllergenCode[]): AllergenCode[] =>
  recognized.filter(code => code !== ALLERGEN_NONE_CODE)

export interface AllergenChip {
  readonly code: AllergenCode
  readonly label: string
  readonly selected: boolean
  readonly removable: boolean
}

// None is exclusive both ways, so an answer holding it beside a named allergen is one the cloud must never
// show as chosen. Tapping a chip cannot produce that state — MealPlanSetupProvider settles it, and this
// screen never computes the next selection — but a stored answer can still arrive holding both, from an
// older client or an edited row, and the saved step accepts exactly ['none'] or named allergens. Such an
// answer is shown as its named allergens alone: dropping the sentinel keeps every declared allergy on
// screen, while dropping an allergy would quietly relax a restriction the user asked for and allergies are
// never removed automatically. validateDietStep refuses the mix, so it is corrected rather than saved.
const chosenAllergenCodes = (selected: string[]): Set<AllergenCode> => {
  const recognized = recognizedAllergens(selected)
  const named = namedAllergens(recognized)

  return new Set(named.length > 0 ? named : recognized)
}

export const buildAllergenChips = (selected: string[]): AllergenChip[] => {
  const selectedCodes = chosenAllergenCodes(selected)

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

export type DietStepErrorCode = 'diet_required' | 'allergens_required' | 'allergens_exclusive'

export const validateDietStep = (diet: Diet | null, allergens: string[]): DietStepErrorCode[] => {
  const errors: DietStepErrorCode[] = []

  if (diet === null) {
    errors.push('diet_required')
  }

  const recognized = recognizedAllergens(allergens)
  const named = namedAllergens(recognized)

  // One error per control: an answer is either missing, self-contradictory, or usable. A mix of None and a
  // named allergen is the contradiction the saved step cannot carry, so it is reported instead of being
  // silently resolved for the user — the chips already show which allergens were kept.
  if (recognized.length === 0) {
    errors.push('allergens_required')
  } else if (named.length > 0 && named.length < recognized.length) {
    errors.push('allergens_exclusive')
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
