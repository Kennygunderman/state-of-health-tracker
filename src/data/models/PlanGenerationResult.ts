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

export interface PlanGeneratedOutcome {
  status: 'generated'
  plan: MealPlan
}

export interface NoMatchingMealsOutcome extends NoMatchingMeals {
  status: 'no_matching_meals'
}

export interface PlanGenerationFailedOutcome {
  status: 'plan_generation_failed'
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
