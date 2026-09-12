import {
  MealPlanPreferences,
  MealPlanPreferencesUpdate,
  MealSchedule,
  MealTimeEntry,
  SetupStep,
  TargetRoute
} from '@data/models/MealPlanPreferences'
import {MealSlot} from '@data/models/Recipe'

type EditablePreferences = Required<MealPlanPreferencesUpdate>

type NonNullDraftKey = 'allergens' | 'dislikedFoodIds' | 'dislikedFoodGroups' | 'mealTimes' | 'noBudgetPreference'

type NullableDraftFields = {
  [Key in Exclude<keyof EditablePreferences, NonNullDraftKey>]: EditablePreferences[Key] | null
}

export interface MealPlanSetupDraft extends NullableDraftFields, Pick<EditablePreferences, NonNullDraftKey> {}

export type MealPlanSetupStep = Exclude<SetupStep, 'review' | 'targets_manual'>

export type MealPlanSetupDirty = Record<MealPlanSetupStep, boolean>

export interface MealPlanSetupDraftState {
  draft: MealPlanSetupDraft
  dirty: MealPlanSetupDirty
}

export const ALLERGEN_NONE = 'none'

// Wire values, not display strings: a meal time is stored as 24-hour HH:mm and the screens
// render '08:00' as '8:00 AM'.
export const DEFAULT_MEAL_TIMES: Record<MealSlot, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:30',
  snack: '15:30'
}

export const SETUP_STEPS_ESTIMATED: MealPlanSetupStep[] = [
  'goal',
  'body',
  'activity',
  'diet',
  'dislikes',
  'schedule',
  'cooking'
]

// Activity only feeds the calorie estimate, so the manual-target route never asks for it.
export const SETUP_STEPS_MANUAL: MealPlanSetupStep[] = SETUP_STEPS_ESTIMATED.filter(step => step !== 'activity')

const SCHEDULE_SLOTS: Record<MealSchedule, MealSlot[]> = {
  three: ['breakfast', 'lunch', 'dinner'],
  three_plus_snack: ['breakfast', 'lunch', 'dinner', 'snack']
}

const WIRE_SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

const BUDGET_CURRENCY = 'USD'

const createCleanDirty = (): MealPlanSetupDirty => ({
  goal: false,
  body: false,
  activity: false,
  diet: false,
  dislikes: false,
  schedule: false,
  cooking: false
})

const dedupe = (values: string[]): string[] => Array.from(new Set(values))

const copyMealTimes = (mealTimes: MealTimeEntry[]): MealTimeEntry[] =>
  mealTimes.map(entry => ({slot: entry.slot, time: entry.time}))

const sortByWireOrder = (mealTimes: MealTimeEntry[]): MealTimeEntry[] =>
  [...mealTimes].sort((left, right) => WIRE_SLOT_ORDER.indexOf(left.slot) - WIRE_SLOT_ORDER.indexOf(right.slot))

export const createEmptyDraft = (): MealPlanSetupDraftState => ({
  draft: {
    goal: null,
    goalWeightKg: null,
    paceLbPerWeek: null,
    age: null,
    heightCm: null,
    weightKg: null,
    sexForEstimate: null,
    heightUnitPref: null,
    weightUnitPref: null,
    activityLevel: null,
    diet: null,
    allergens: [],
    dislikedFoodIds: [],
    dislikedFoodGroups: [],
    mealSchedule: null,
    mealTimes: [],
    cookingTimeLimitMin: null,
    budget: null,
    noBudgetPreference: false,
    timeZone: null
  },
  dirty: createCleanDirty()
})

export const seedDraftFromPreferences = (
  preferences: MealPlanPreferences | null | undefined
): MealPlanSetupDraftState => {
  if (!preferences) {
    return createEmptyDraft()
  }

  return {
    draft: {
      goal: preferences.goal,
      goalWeightKg: preferences.goalWeightKg,
      paceLbPerWeek: preferences.paceLbPerWeek,
      age: preferences.age,
      heightCm: preferences.heightCm,
      weightKg: preferences.weightKg,
      sexForEstimate: preferences.sexForEstimate,
      heightUnitPref: preferences.heightUnitPref,
      weightUnitPref: preferences.weightUnitPref,
      activityLevel: preferences.activityLevel,
      diet: preferences.diet,
      allergens: [...preferences.allergens],
      dislikedFoodIds: preferences.dislikedFoods.map(food => food.id),
      dislikedFoodGroups: [...preferences.dislikedFoodGroups],
      mealSchedule: preferences.mealSchedule,
      mealTimes: copyMealTimes(preferences.mealTimes),
      cookingTimeLimitMin: preferences.cookingTimeLimitMin,
      budget: preferences.budget ? {...preferences.budget} : null,
      noBudgetPreference: preferences.noBudgetPreference,
      timeZone: preferences.timeZone
    },
    dirty: createCleanDirty()
  }
}

export const setStepFields = (
  state: MealPlanSetupDraftState,
  step: MealPlanSetupStep,
  fields: Partial<MealPlanSetupDraft>
): MealPlanSetupDraftState => ({
  draft: {...state.draft, ...fields},
  dirty: {...state.dirty, [step]: true}
})

export const applyAllergenSelection = (state: MealPlanSetupDraftState, allergen: string): MealPlanSetupDraftState => {
  const current = state.draft.allergens

  if (current.includes(allergen)) {
    return setStepFields(state, 'diet', {allergens: current.filter(value => value !== allergen)})
  }

  // 'None' is exclusive in both directions: choosing it clears every named allergy, and
  // choosing a named allergy drops it.
  if (allergen === ALLERGEN_NONE) {
    return setStepFields(state, 'diet', {allergens: [ALLERGEN_NONE]})
  }

  return setStepFields(state, 'diet', {allergens: [...current.filter(value => value !== ALLERGEN_NONE), allergen]})
}

export const toggleDislikedFoodId = (state: MealPlanSetupDraftState, foodId: string): MealPlanSetupDraftState => {
  const current = state.draft.dislikedFoodIds
  const dislikedFoodIds = current.includes(foodId) ? current.filter(value => value !== foodId) : [...current, foodId]

  return setStepFields(state, 'dislikes', {dislikedFoodIds})
}

export const setDislikedFoodIds = (state: MealPlanSetupDraftState, foodIds: string[]): MealPlanSetupDraftState =>
  setStepFields(state, 'dislikes', {dislikedFoodIds: dedupe(foodIds)})

export const applyMealSchedule = (state: MealPlanSetupDraftState, schedule: MealSchedule): MealPlanSetupDraftState => {
  const mealTimes = SCHEDULE_SLOTS[schedule].map(slot => ({
    slot,
    time: state.draft.mealTimes.find(entry => entry.slot === slot)?.time ?? DEFAULT_MEAL_TIMES[slot]
  }))

  return setStepFields(state, 'schedule', {mealSchedule: schedule, mealTimes})
}

export const setMealTime = (state: MealPlanSetupDraftState, slot: MealSlot, time: string): MealPlanSetupDraftState => {
  const current = state.draft.mealTimes
  const mealTimes = current.some(entry => entry.slot === slot)
    ? current.map(entry => (entry.slot === slot ? {slot, time} : entry))
    : sortByWireOrder([...current, {slot, time}])

  return setStepFields(state, 'schedule', {mealTimes})
}

export const applyBudgetAmount = (state: MealPlanSetupDraftState, amount: number | null): MealPlanSetupDraftState =>
  setStepFields(state, 'cooking', {
    budget: amount === null ? null : {amount, currency: state.draft.budget?.currency ?? BUDGET_CURRENCY},
    noBudgetPreference: false
  })

export const applyNoBudgetPreference = (
  state: MealPlanSetupDraftState,
  noBudgetPreference: boolean
): MealPlanSetupDraftState =>
  setStepFields(state, 'cooking', {noBudgetPreference, budget: noBudgetPreference ? null : state.draft.budget})

export const stepsForRoute = (route: TargetRoute): MealPlanSetupStep[] =>
  route === 'manual' ? [...SETUP_STEPS_MANUAL] : [...SETUP_STEPS_ESTIMATED]

const hasCompleteSchedule = (draft: MealPlanSetupDraft): boolean => {
  if (draft.mealSchedule === null) {
    return false
  }

  return SCHEDULE_SLOTS[draft.mealSchedule].every(slot =>
    draft.mealTimes.some(entry => entry.slot === slot && entry.time.trim().length > 0)
  )
}

const STEP_COMPLETENESS: Record<MealPlanSetupStep, (draft: MealPlanSetupDraft) => boolean> = {
  goal: draft => draft.goal !== null && (draft.goal === 'maintain' || draft.paceLbPerWeek !== null),
  body: draft =>
    draft.age !== null && draft.heightCm !== null && draft.weightKg !== null && draft.sexForEstimate !== null,
  activity: draft => draft.activityLevel !== null,
  diet: draft => draft.diet !== null && draft.allergens.length > 0,
  dislikes: () => true,
  schedule: hasCompleteSchedule,
  cooking: draft => draft.cookingTimeLimitMin !== null && (draft.budget !== null || draft.noBudgetPreference)
}

export const isStepComplete = (draft: MealPlanSetupDraft, step: MealPlanSetupStep): boolean =>
  STEP_COMPLETENESS[step](draft)

export const completedSteps = (draft: MealPlanSetupDraft, route: TargetRoute): MealPlanSetupStep[] =>
  stepsForRoute(route).filter(step => isStepComplete(draft, step))
