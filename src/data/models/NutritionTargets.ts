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

// The four values a manual save states, which is also the shape a confirmed set reads back as once every
// member is present. Separate from MacroTargets, whose members are independently nullable because the server
// may hold only some of them.
export interface ManualNutritionTargetValues {
  calories: number
  protein: number
  carbs: number
  fat: number
}

// Why the target editor was opened, and therefore what a save from it means. The source a save claims follows
// the route the user took to reach the editor: comparing the entered numbers with the current estimate cannot
// tell a hand-entered set that happens to equal the estimate from a confirmation of it, nor a preserved older
// estimate from numbers typed by hand — and the claim is not a label, because `source: 'estimated'` makes the
// server store its own recomputed figures rather than the ones on screen.
export type NutritionTargetsEditIntent = 'confirm_estimate' | 'edit_saved' | 'manual_entry'

// The targets revision a user carries before any target save. The server reports 0 both for a user with no
// preferences row and for a row that has never confirmed a target, and its save parser reads an omitted
// `expectedTargetsRevision` as exactly that expectation — so this is the one revision a save omits the pin for.
// The rule that applies it, and the predicates over the shapes below, live in @utility/NutritionTargetsUtility,
// because two screens share them.
export const NO_TARGETS_REVISION: number = 0

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
//
// expectedTargetsRevision is optional because the server's parser distinguishes an omitted pin from any value:
// omitting it states "there is no prior revision to replace" and is accepted only while the stored revision is
// still NO_TARGETS_REVISION, so a first save omits it and every later save carries it. Build both payloads with
// the factories in @utility/NutritionTargetsUtility rather than assembling the member by hand, so that one rule
// decides when it is sent.
export interface SaveEstimatedNutritionTargetsPayload {
  source: 'estimated'
  estimateRevision: number
  expectedTargetsRevision?: number
}

export interface SaveManualNutritionTargetsPayload {
  source: 'manual'
  calories: number
  protein: number
  carbs: number
  fat: number
  expectedTargetsRevision?: number
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
