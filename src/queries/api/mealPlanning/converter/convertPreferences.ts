import {
  ActivityLevel,
  CookingTimeLimitMin,
  Diet,
  Goal,
  HeightUnitPref,
  MealPlanPreferences,
  MealSchedule,
  PaceLbPerWeek,
  SetupStatus,
  SetupStep,
  SexForEstimate,
  TargetRoute,
  WeightUnitPref
} from '@data/models/MealPlanPreferences'
import {MealSlot} from '@data/models/Recipe'
import {PreferencesResponse, PreferencesSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_SETUP_STATUSES: SetupStatus[] = ['not_started', 'in_progress', 'ready_for_review', 'completed']
const KNOWN_SETUP_STEPS: SetupStep[] = [
  'goal',
  'body',
  'activity',
  'diet',
  'dislikes',
  'schedule',
  'cooking',
  'review',
  'targets_manual'
]
const KNOWN_TARGET_ROUTES: TargetRoute[] = ['estimated', 'manual']
const KNOWN_GOALS: Goal[] = ['lose', 'maintain', 'gain']
const KNOWN_SEXES_FOR_ESTIMATE: SexForEstimate[] = ['female', 'male', 'prefer_not_to_say']
const KNOWN_HEIGHT_UNIT_PREFS: HeightUnitPref[] = ['ft_in', 'cm']
const KNOWN_WEIGHT_UNIT_PREFS: WeightUnitPref[] = ['lb', 'kg']
const KNOWN_ACTIVITY_LEVELS: ActivityLevel[] = ['not_very_active', 'lightly_active', 'active', 'very_active']
const KNOWN_DIETS: Diet[] = ['none', 'vegetarian', 'vegan', 'pescatarian']
const KNOWN_MEAL_SCHEDULES: MealSchedule[] = ['three', 'three_plus_snack']
const KNOWN_MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const KNOWN_PACES_LB_PER_WEEK: PaceLbPerWeek[] = [0.5, 1, 1.5]
const KNOWN_COOKING_TIME_LIMITS: CookingTimeLimitMin[] = [15, 30, 45, 60]
const KNOWN_BUDGET_TIERS: NonNullable<MealPlanPreferences['budgetTier']>[] = [1, 2, 3]

function resolveStringCode<T extends string>(known: T[], value: string | null): T | null {
  return value !== null && (known as string[]).includes(value) ? (value as T) : null
}

function resolveNumberCode<T extends number>(known: T[], value: number | null): T | null {
  return value !== null && (known as number[]).includes(value) ? (value as T) : null
}

export interface PreferencesSaveResult {
  preferences: MealPlanPreferences
  affectedMealCount: number
}

export function convertPreferences(data: io.TypeOf<typeof PreferencesResponse>): MealPlanPreferences {
  // An unanswered preference stays null: the server owns no defaults for these, so an unrecognized code
  // resolves to null rather than silently turning "unanswered" into an answer the user never gave.
  return {
    // 'not_started' is the value a user with no preferences row receives, and the Meal Plan body checks
    // for an existing plan before it reads setupStatus, so this fallback cannot strand a user who has one.
    setupStatus: resolveStringCode(KNOWN_SETUP_STATUSES, data.setupStatus) ?? 'not_started',
    setupStep: resolveStringCode(KNOWN_SETUP_STEPS, data.setupStep),
    reviewStartDate: data.reviewStartDate ?? null,
    timeZone: data.timeZone ?? null,
    targetRoute: resolveStringCode(KNOWN_TARGET_ROUTES, data.targetRoute),
    revision: data.revision,
    goal: resolveStringCode(KNOWN_GOALS, data.goal),
    goalWeightKg: data.goalWeightKg ?? null,
    paceLbPerWeek: resolveNumberCode(KNOWN_PACES_LB_PER_WEEK, data.paceLbPerWeek),
    age: data.age ?? null,
    heightCm: data.heightCm ?? null,
    weightKg: data.weightKg ?? null,
    sexForEstimate: resolveStringCode(KNOWN_SEXES_FOR_ESTIMATE, data.sexForEstimate),
    heightUnitPref: resolveStringCode(KNOWN_HEIGHT_UNIT_PREFS, data.heightUnitPref),
    weightUnitPref: resolveStringCode(KNOWN_WEIGHT_UNIT_PREFS, data.weightUnitPref),
    activityLevel: resolveStringCode(KNOWN_ACTIVITY_LEVELS, data.activityLevel),
    diet: resolveStringCode(KNOWN_DIETS, data.diet),
    allergens: data.allergens,
    dislikedFoods: data.dislikedFoods.map(food => ({id: food.id, name: food.name, foodGroup: food.foodGroup})),
    dislikedFoodGroups: data.dislikedFoodGroups,
    mealSchedule: resolveStringCode(KNOWN_MEAL_SCHEDULES, data.mealSchedule),
    // An entry whose slot is unrecognized is dropped rather than coerced, because coercing it would put
    // two times on one slot and break the one-time-per-slot invariant. Wire order is kept as sent.
    mealTimes: data.mealTimes
      .filter(entry => (KNOWN_MEAL_SLOTS as string[]).includes(entry.slot))
      .map(entry => ({slot: entry.slot as MealSlot, time: entry.time})),
    cookingTimeLimitMin: resolveNumberCode(KNOWN_COOKING_TIME_LIMITS, data.cookingTimeLimitMin),
    budget: data.budget !== null ? {amount: data.budget.amount, currency: data.budget.currency} : null,
    noBudgetPreference: data.noBudgetPreference,
    budgetTier: resolveNumberCode(KNOWN_BUDGET_TIERS, data.budgetTier),
    hasActivePlan: data.hasActivePlan
  }
}

export function convertPreferencesSaveResult(data: io.TypeOf<typeof PreferencesSaveResponse>): PreferencesSaveResult {
  return {
    preferences: convertPreferences(data.preferences),
    affectedMealCount: data.affectedMealCount
  }
}
