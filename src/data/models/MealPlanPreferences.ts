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
  // A zero-padded 24-hour 'HH:mm' wall-clock time. The decoder validates it on the way in and the schedule
  // screen produces the same form on the way out, so '8:00' and '24:00' are neither read nor written.
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
  // A 'YYYY-MM-DD' day key, null until the user changes the start date away from the default; and the IANA
  // zone name the server computes "today" and every date bound in. Both validated by the decoder, so a
  // malformed day key never reaches a date comparison and an unknown zone never reaches a date format.
  reviewStartDate: string | null
  timeZone: string | null
  // Which target route the user is on, and — because a body-step save is its only writer — the
  // server's record THAT the body step was answered: 'manual' after Skip or 'Prefer not to say',
  // 'estimated' after a measured answer, null while the step is unanswered. It is the only proof
  // of a saved Skip, which stores no measurements at all, so resume logic reads this rather than
  // testing age/height/weight/sex for null. Server-owned: absent from MealPlanPreferencesUpdate
  // below, because sending it back earns 400 read_only_field.
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
