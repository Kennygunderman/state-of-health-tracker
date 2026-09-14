import {
  ALLERGEN_NONE,
  BudgetPreference,
  MEAL_SLOTS_BY_SCHEDULE,
  MEAL_SLOTS_IN_WIRE_ORDER,
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
  // True once the draft carries the saved preferences. It is what tells a consumer that a null is
  // the answer the user cleared rather than a question nobody has asked yet, so a screen that
  // composes the draft with the fetched preferences must stop falling back to a saved optional
  // once this is set.
  seeded: boolean
  // True once the body step has an answer on record — measured, 'Prefer not to say', or Skip.
  //
  // It is here rather than in the draft because the body step is the one step whose answer can
  // legitimately leave every field of it empty: Skip sends `{skipped: true}` and the server stores
  // no measurements for it at all, so measurement nullity cannot tell a skipped step from an
  // unasked one and completeness cannot be read off the draft alone. The server records that
  // answer in `target_route` — the column a body-step save is the only writer of — and proves the
  // step answered by it being non-null, which is the proof `seedDraftFromPreferences` reads.
  //
  // The draft itself must never carry `targetRoute`: it mirrors the editable payload exactly, and
  // a server-owned key reaching a save earns 400 `read_only_field`. So the fact lives beside
  // `seeded` on the state, and every completeness rule takes the state.
  bodyAnswered: boolean
}

// The moments the draft stops describing an answer the user is still giving. The provider is
// mounted around the whole Macros navigator, so the draft outlives any single wizard screen and
// every one of them is explicit. 'flow_exited' is the navigation boundary MacrosStack reports when
// the Macros root comes back into focus, which is how both in-app cases actually clear today: a
// generated plan and 'Not now' alike leave no wizard route on the stack. 'setup_completed' and
// 'setup_dismissed' name those two cases for a screen that wants to clear at its own handler
// rather than on the way out. 'signed_out' is the session end. A Continue is deliberately not one
// of them — it persists its own step and the later steps still derive from the earlier answers,
// which is why resuming a half-finished setup reads the server's setup_step.
export type MealPlanSetupLifecycleEvent =
  | 'setup_completed'
  | 'setup_dismissed'
  | 'signed_out'
  | 'flow_exited'
  | 'step_saved'

// Declared by @data/models/MealPlanPreferences, which owns the preference vocabulary the wizard and the
// screens reading it back must agree on, and re-exported so this module's own surface is unchanged.
export {ALLERGEN_NONE}

// Wire values, not display strings: a meal time is stored as 24-hour HH:mm and the screens
// render '08:00' as '8:00 AM'. Every table below is frozen because it is module-global reducer
// input handed straight to callers: rewriting one in place would change the answers every later
// step of the wizard derives.
export const DEFAULT_MEAL_TIMES: Readonly<Record<MealSlot, string>> = Object.freeze({
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:30',
  snack: '15:30'
})

export const SETUP_STEPS_ESTIMATED: readonly MealPlanSetupStep[] = Object.freeze([
  'goal',
  'body',
  'activity',
  'diet',
  'dislikes',
  'schedule',
  'cooking'
] as const)

// Activity only feeds the calorie estimate, so the manual-target route never asks for it.
export const SETUP_STEPS_MANUAL: readonly MealPlanSetupStep[] = Object.freeze(
  SETUP_STEPS_ESTIMATED.filter(step => step !== 'activity')
)

// This release accepts exactly one currency (AAP 0.5.2) and the '$' sign is part of the copy the
// budget field renders, so the draft stamps it on every amount instead of carrying a currency
// through from anywhere else — a draft holding another currency would build a payload the server
// rejects.
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
  [...mealTimes].sort(
    (left, right) => MEAL_SLOTS_IN_WIRE_ORDER.indexOf(left.slot) - MEAL_SLOTS_IN_WIRE_ORDER.indexOf(right.slot)
  )

const toBudgetPreference = (amount: number): BudgetPreference => ({amount, currency: BUDGET_CURRENCY})

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
  dirty: createCleanDirty(),
  seeded: false,
  bodyAnswered: false
})

const DRAFT_CLEARING_EVENTS: Readonly<Record<MealPlanSetupLifecycleEvent, boolean>> = Object.freeze({
  setup_completed: true,
  setup_dismissed: true,
  signed_out: true,
  flow_exited: true,
  step_saved: false
})

export const clearsSetupDraft = (event: MealPlanSetupLifecycleEvent): boolean => DRAFT_CLEARING_EVENTS[event]

// A draft nobody has seeded or edited already is the empty draft, so clearing it would only hand
// the provider a new object to re-render for. 'flow_exited' arrives every time the Macros root
// regains focus — which is most of the time, with no setup in flight — so the no-op matters.
// `bodyAnswered` is part of what a reset clears, so a state carrying it is not pristine either —
// every setter that raises it also seeds or dirties, but the predicate says what it means rather
// than relying on that.
const isPristineDraft = (state: MealPlanSetupDraftState): boolean =>
  !state.seeded && !state.bodyAnswered && !Object.values(state.dirty).some(Boolean)

// The one reset transition, so the boundaries that end a setup session cannot each invent their
// own clearing rule and a Continue cannot discard the draft by reporting the step it saved.
export const applyLifecycleEvent = (
  state: MealPlanSetupDraftState,
  event: MealPlanSetupLifecycleEvent
): MealPlanSetupDraftState => (clearsSetupDraft(event) && !isPristineDraft(state) ? createEmptyDraft() : state)

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
      budget: preferences.budget ? toBudgetPreference(preferences.budget.amount) : null,
      noBudgetPreference: preferences.noBudgetPreference,
      timeZone: preferences.timeZone
    },
    dirty: createCleanDirty(),
    seeded: true,
    // The saved body answer, read from the one column that records it. `targetRoute` is
    // server-owned and a body-step save is its only writer — Skip and 'Prefer not to say' resolve
    // it to 'manual', a measured answer to 'estimated' — so non-null means the step was answered
    // whichever branch it took, and that is exactly how the server's own resume logic proves it.
    // Reading the measurements instead would call a saved Skip unanswered and re-ask a step the
    // user already completed. An unrecognized route decodes to null, which re-asks the step rather
    // than counting an answer nobody can read, so the marker fails closed.
    bodyAnswered: preferences.targetRoute !== null
  }
}

export const setStepFields = (
  state: MealPlanSetupDraftState,
  step: MealPlanSetupStep,
  fields: Partial<MealPlanSetupDraft>
): MealPlanSetupDraftState => ({
  draft: {...state.draft, ...fields},
  dirty: {...state.dirty, [step]: true},
  seeded: state.seeded,
  bodyAnswered: state.bodyAnswered
})

// Skip on the About-you screen, which is an ANSWER to the body step and not an absence of one: it
// routes the user to manual targets and supplies no measurements. It clears none either, exactly
// as the server does not — Skip records a route, it does not delete figures the user may have
// entered on an earlier pass — so a later measured answer still finds them in the draft.
//
// The body step is marked dirty because the user made this choice in this session; the screen
// persists it with `{skipped: true}` and the refetch that follows reseeds the draft, which is how
// every other step's dirty flag clears. Screens cannot reach this module directly, so this is the
// action the provider exposes for it.
export const answerBodySkipped = (state: MealPlanSetupDraftState): MealPlanSetupDraftState => ({
  draft: state.draft,
  dirty: {...state.dirty, body: true},
  seeded: state.seeded,
  bodyAnswered: true
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
  const mealTimes = MEAL_SLOTS_BY_SCHEDULE[schedule].map(slot => ({
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
    budget: amount === null ? null : toBudgetPreference(amount),
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

  return MEAL_SLOTS_BY_SCHEDULE[draft.mealSchedule].every(slot =>
    draft.mealTimes.some(entry => entry.slot === slot && entry.time.trim().length > 0)
  )
}

const hasBodyMeasurements = (draft: MealPlanSetupDraft): boolean =>
  draft.age !== null && draft.heightCm !== null && draft.weightKg !== null && draft.sexForEstimate !== null

// Completeness is a property of the whole setup state rather than of the draft, because one step's
// answer is not held in any editable field: a body step answered with Skip carries no measurements
// on the server and therefore none in the draft. Every other rule reads the draft only.
const STEP_COMPLETENESS: Readonly<Record<MealPlanSetupStep, (state: MealPlanSetupDraftState) => boolean>> =
  Object.freeze({
    goal: ({draft}) => draft.goal !== null && (draft.goal === 'maintain' || draft.paceLbPerWeek !== null),
    // Either branch of the step counts as answered. `bodyAnswered` is the saved answer — Skip,
    // 'Prefer not to say' or a measured one — and the measurements cover the answer the user is
    // giving right now, before anything is persisted. Requiring the measurements alone is what
    // called a saved Skip incomplete: the manual route would report six steps done as five and
    // re-open a screen the user had finished.
    body: state => state.bodyAnswered || hasBodyMeasurements(state.draft),
    activity: ({draft}) => draft.activityLevel !== null,
    diet: ({draft}) => draft.diet !== null && draft.allergens.length > 0,
    dislikes: () => true,
    schedule: ({draft}) => hasCompleteSchedule(draft),
    cooking: ({draft}) => draft.cookingTimeLimitMin !== null && (draft.budget !== null || draft.noBudgetPreference)
  })

export const isStepComplete = (state: MealPlanSetupDraftState, step: MealPlanSetupStep): boolean =>
  STEP_COMPLETENESS[step](state)

export const completedSteps = (state: MealPlanSetupDraftState, route: TargetRoute): MealPlanSetupStep[] =>
  stepsForRoute(route).filter(step => isStepComplete(state, step))
