import {MacroTargets} from './Macros'
import {ActivityLevel, Goal, PaceLbPerWeek, SexForEstimate} from './MealPlanPreferences'

export type NutritionTargetSource = 'estimated' | 'manual' | 'legacy'

export type NutritionTargetClampReason = 'floor' | 'below_bmr' | 'ceiling'

export type NutritionTargetFeasibilityWarning = 'macro_energy_mismatch' | 'below_catalog_min' | 'above_catalog_max'

export interface NutritionTargets {
  targets: MacroTargets | null
  complete: boolean
  source: NutritionTargetSource | null
  stale: boolean
  revision: number
}

export interface NutritionTargetEstimateInputs {
  age: number
  heightCm: number
  weightKg: number
  sexForEstimate: SexForEstimate
  activityLevel: ActivityLevel
  goal: Goal
  paceLbPerWeek: PaceLbPerWeek | null
}

export interface NutritionTargetEstimate {
  source: 'estimated'
  estimateRevision: number
  inputs: NutritionTargetEstimateInputs
  bmr: number
  tdee: number
  adjustment: number
  calories: number
  protein: number
  carbs: number
  fat: number
  clamped: boolean
  clampReason: NutritionTargetClampReason | null
}

// estimateRevision pins the preferences revision the estimate was computed from, so the server can refuse one
// built on inputs that have since changed (409 estimate_stale). expectedTargetsRevision pins the targets record
// being replaced (409 stale_targets). Two numbers, two conflicts — collapsing them makes one undetectable.
export interface SaveEstimatedNutritionTargetsPayload {
  source: 'estimated'
  estimateRevision: number
  expectedTargetsRevision: number
}

export interface SaveManualNutritionTargetsPayload {
  source: 'manual'
  calories: number
  protein: number
  carbs: number
  fat: number
  expectedTargetsRevision: number
}

export type SaveNutritionTargetsPayload = SaveEstimatedNutritionTargetsPayload | SaveManualNutritionTargetsPayload

export interface NutritionTargetsFeasibility {
  ok: boolean
  warnings: NutritionTargetFeasibilityWarning[]
}

export interface SaveNutritionTargetsResult {
  targets: NutritionTargets
  feasibility: NutritionTargetsFeasibility
}
