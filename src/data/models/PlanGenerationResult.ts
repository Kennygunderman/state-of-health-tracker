import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {MealPlan} from './MealPlan'
import {SetupStep} from './MealPlanPreferences'

export type LimitingConstraintKey =
  | 'cooking_time'
  | 'dislikes'
  | 'diet'
  | 'nutrition_tolerance'
  | 'portion_limits'
  | 'slot_coverage'
  | 'catalog_coverage'

export type LimitingConstraintUnit = 'minutes' | 'foods' | 'percent' | 'recipes'

export interface LimitingConstraint {
  constraintKey: LimitingConstraintKey
  value: number | null
  unit: LimitingConstraintUnit | null
  slots: string[]
  editStep: SetupStep
}

export interface NoMatchingMeals {
  limitingConstraints: LimitingConstraint[]
  // The literal rather than boolean: the analysis relaxes cooking time, dislikes and diet one at a time and
  // never allergies, so a false value must not be representable.
  allergiesKept: true
}

// 'generated' and 'unconfirmed' are client-only labels — the API never sends them, so they stay plain
// literals; the two failure statuses below are machine codes the API does send and are therefore read from
// API_ERROR_CODES, the single registry, rather than restated here.
export interface PlanGeneratedOutcome {
  status: 'generated'
  plan: MealPlan
}

export interface NoMatchingMealsOutcome extends NoMatchingMeals {
  status: typeof API_ERROR_CODES.noMatchingMeals
}

export interface PlanGenerationFailedOutcome {
  status: typeof API_ERROR_CODES.planGenerationFailed
}

export interface PlanGenerationUnconfirmedOutcome {
  status: 'unconfirmed'
}

export type PlanGenerationResult =
  | PlanGeneratedOutcome
  | NoMatchingMealsOutcome
  | PlanGenerationFailedOutcome
  | PlanGenerationUnconfirmedOutcome

export interface GeneratePlanPayload {
  startDate: string
  idempotencyKey: string
  expectedPreferencesRevision: number
  expectedTargetsRevision: number
}

export interface RegeneratePlanPayload {
  idempotencyKey: string
  expectedPlanRevision: number
  expectedPreferencesRevision: number
  expectedTargetsRevision: number
}
