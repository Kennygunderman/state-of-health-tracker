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

// The answer that states no allergies, and the one value that is mutually exclusive with every named allergen:
// a saved diet step carries either exactly ['none'] or named codes, never both. It lives here with the rest of
// the preference vocabulary because the setup draft, the allergy chips, the review row, the generating summary
// and plan settings must all test for the same string — each holding its own copy is how they came to diverge.
export const ALLERGEN_NONE = 'none'

// The slots in the order the server validates a mealTimes payload in: breakfast, lunch, dinner, then the snack.
// A day view orders meals by the clock instead, so this is the wire's order and never a display order. Frozen
// because it is module-global input handed straight to callers, and rewriting it in place would change both the
// payload the schedule step builds and the answers every later step derives.
export const MEAL_SLOTS_IN_WIRE_ORDER: readonly MealSlot[] = Object.freeze([
  'breakfast',
  'lunch',
  'dinner',
  'snack'
] as const)

// Which slots each schedule plans. Both entries are sliced out of the wire order rather than restated as their
// own lists, so the two facts cannot drift apart: a three-meal day is that order without the snack, and the
// snack schedule is that order entire.
export const MEAL_SLOTS_BY_SCHEDULE: Readonly<Record<MealSchedule, readonly MealSlot[]>> = Object.freeze({
  three: Object.freeze(MEAL_SLOTS_IN_WIRE_ORDER.filter(slot => slot !== 'snack')),
  three_plus_snack: MEAL_SLOTS_IN_WIRE_ORDER
})

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

// Disliked foods by the id the payload carries, which is how the setup flow keeps a name for a selection the
// saved row cannot name yet: `dislikedFoodIds` is the whole of what a dislikes save sends, so a food chosen
// from catalog search has no server-side name until that save has landed and been refetched. The screen that
// stages it and the screen that reviews it are different routes, so the index is shared state rather than
// either screen's own — and it is keyed by id for the same reason the payload is: the id is the identity.
export type DislikedFoodLabelIndex = Readonly<Record<string, DislikedFoodSummary>>

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

// The eight steps that are writable `:step` path segments of PUT /meal-planning/preferences/steps/:step.
// Named after the server's own `PayloadBearingSetupStep` (backend/src/services/preferences.logic.ts) so the
// two repositories read as one contract. `SetupStep` above keeps all nine members because it is the stored
// resume marker the read side reports: 'targets_manual' records that the user took the manual-target route,
// which saves through PUT /meal-planning/targets, so it carries no step payload and is never a path segment.
export type PayloadBearingSetupStep = Exclude<SetupStep, 'targets_manual'>

// The payload each writable step accepts, mirroring the server's `StepPayloadByStep` and the eight typed step
// bodies AAP 0.5.2 enumerates. Deliberately not built on `Record<PayloadBearingSetupStep, …>`: a base record
// would answer for a step this map has never heard of, whereas these eight keys alone make `SetupStepRequest`
// below fail to compile until a step added to `SetupStep` is paired with its payload here.
export interface SetupStepPayloadByStep {
  goal: GoalStepPayload
  // Both variants, because the step accepts either the measured answer or Skip.
  body: BodyStepPayload
  activity: ActivityStepPayload
  diet: DietStepPayload
  dislikes: DislikesStepPayload
  schedule: ScheduleStepPayload
  cooking: CookingStepPayload
  review: ReviewStepPayload
}

// One request to one writable step, as a discriminated union over the step itself: the only payload that
// type-checks beside a step is that step's own, and 'targets_manual' cannot be expressed at all. Distributed
// over the union rather than written out so an impossible pair is a compile error here, not a 400 at runtime.
export type SetupStepRequest = {
  [S in PayloadBearingSetupStep]: {step: S; payload: SetupStepPayloadByStep[S]}
}[PayloadBearingSetupStep]

export interface MealPlanPreferencesSaveResult {
  preferences: MealPlanPreferences
  affectedMealCount: number
}
