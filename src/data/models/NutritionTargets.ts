import {MacroTargets} from './Macros'

export type NutritionTargetSource = 'estimated' | 'manual' | 'legacy'

export type NutritionTargetClampReason = 'floor' | 'below_bmr' | 'ceiling'

export type NutritionTargetFeasibilityWarning = 'macro_energy_mismatch' | 'below_catalog_min' | 'above_catalog_max'

export type Goal = 'lose' | 'maintain' | 'gain'

export type SexForEstimate = 'female' | 'male' | 'prefer_not_to_say'

export type ActivityLevel = 'not_very_active' | 'lightly_active' | 'active' | 'very_active'

export type PaceLbPerWeek = 0.5 | 1 | 1.5

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
