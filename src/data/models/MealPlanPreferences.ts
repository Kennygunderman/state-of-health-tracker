import {MealSlot} from './Recipe'

export type SetupStatus = 'not_started' | 'in_progress' | 'ready_for_review' | 'completed'

export type SetupStep =
  | 'goal'
  | 'body'
  | 'activity'
  | 'diet'
  | 'dislikes'
  | 'schedule'
  | 'cooking'
  | 'review'
  | 'targets_manual'

export type TargetRoute = 'estimated' | 'manual'

export type Goal = 'lose' | 'maintain' | 'gain'

export type PaceLbPerWeek = 0.5 | 1 | 1.5

export type SexForEstimate = 'female' | 'male' | 'prefer_not_to_say'

export type ActivityLevel = 'not_very_active' | 'lightly_active' | 'active' | 'very_active'

export type Diet = 'none' | 'vegetarian' | 'vegan' | 'pescatarian'

export type MealSchedule = 'three' | 'three_plus_snack'

export type CookingTimeLimitMin = 15 | 30 | 45 | 60

export type HeightUnitPref = 'ft_in' | 'cm'

// Deliberately not WeightUnit from './WeightUnit' ('lbs' | 'kg' | 'st'): the meal-plan
// toggle offers lb and kg only, so a stone user reads and writes kg here while keeping
// 'st' everywhere else in the app.
export type WeightUnitPref = 'lb' | 'kg'

export interface MealTimeEntry {
  slot: MealSlot
  time: string
}

export interface DislikedFoodSummary {
  id: string
  name: string
  foodGroup: string
}

export interface BudgetPreference {
  amount: number
  currency: string
}

export interface MealPlanPreferences {
  setupStatus: SetupStatus
  setupStep: SetupStep | null
  reviewStartDate: string | null
  timeZone: string | null
  targetRoute: TargetRoute | null
  revision: number
  goal: Goal | null
  goalWeightKg: number | null
  paceLbPerWeek: PaceLbPerWeek | null
  age: number | null
  heightCm: number | null
  weightKg: number | null
  sexForEstimate: SexForEstimate | null
  heightUnitPref: HeightUnitPref | null
  weightUnitPref: WeightUnitPref | null
  activityLevel: ActivityLevel | null
  diet: Diet | null
  allergens: string[]
  dislikedFoods: DislikedFoodSummary[]
  dislikedFoodGroups: string[]
  mealSchedule: MealSchedule | null
  mealTimes: MealTimeEntry[]
  cookingTimeLimitMin: CookingTimeLimitMin | null
  budget: BudgetPreference | null
  noBudgetPreference: boolean
  budgetTier: 1 | 2 | 3 | null
  hasActivePlan: boolean
}

export interface MealPlanPreferencesUpdate {
  goal?: Goal
  goalWeightKg?: number | null
  paceLbPerWeek?: PaceLbPerWeek | null
  age?: number
  heightCm?: number
  weightKg?: number
  sexForEstimate?: SexForEstimate
  heightUnitPref?: HeightUnitPref
  weightUnitPref?: WeightUnitPref
  activityLevel?: ActivityLevel
  diet?: Diet
  allergens?: string[]
  dislikedFoodIds?: string[]
  dislikedFoodGroups?: string[]
  mealSchedule?: MealSchedule
  mealTimes?: MealTimeEntry[]
  cookingTimeLimitMin?: CookingTimeLimitMin
  budget?: BudgetPreference | null
  noBudgetPreference?: boolean
  timeZone?: string
}

export interface SaveMealPlanPreferencesPayload extends MealPlanPreferencesUpdate {
  expectedRevision: number
}

export interface SetupStepEnvelope {
  timeZone: string
  expectedRevision?: number
}

export interface GoalStepPayload extends SetupStepEnvelope {
  goal: Goal
  goalWeightKg?: number | null
  paceLbPerWeek?: PaceLbPerWeek | null
}

export interface BodyMeasuredStepPayload extends SetupStepEnvelope {
  skipped?: false
  age: number
  heightCm: number
  weightKg: number
  sexForEstimate: SexForEstimate
  heightUnitPref: HeightUnitPref
  weightUnitPref: WeightUnitPref
}

export interface BodySkippedStepPayload extends SetupStepEnvelope {
  skipped: true
}

export type BodyStepPayload = BodyMeasuredStepPayload | BodySkippedStepPayload

export interface ActivityStepPayload extends SetupStepEnvelope {
  activityLevel: ActivityLevel
}

export interface DietStepPayload extends SetupStepEnvelope {
  diet: Diet
  allergens: string[]
}

export interface DislikesStepPayload extends SetupStepEnvelope {
  dislikedFoodIds: string[]
}

export interface ScheduleStepPayload extends SetupStepEnvelope {
  mealSchedule: MealSchedule
  mealTimes: MealTimeEntry[]
}

export interface CookingStepPayload extends SetupStepEnvelope {
  cookingTimeLimitMin: CookingTimeLimitMin
  budget: BudgetPreference | null
  noBudgetPreference: boolean
}

export interface ReviewStepPayload extends SetupStepEnvelope {
  startDate: string
}

export type SetupStepPayload =
  | GoalStepPayload
  | BodyStepPayload
  | ActivityStepPayload
  | DietStepPayload
  | DislikesStepPayload
  | ScheduleStepPayload
  | CookingStepPayload
  | ReviewStepPayload

export interface MealPlanPreferencesSaveResult {
  preferences: MealPlanPreferences
  affectedMealCount: number
}
