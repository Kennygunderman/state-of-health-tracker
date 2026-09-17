import {
  ALLERGEN_NONE,
  BudgetPreference,
  DislikedFoodLabelIndex,
  DislikedFoodSummary,
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

// A food-search visit (06b) as the screen renders it: what would be selected if the user pressed Done, and
// the names to show for it.
export interface DislikeStaging {
  selection: string[]
  labels: DislikedFoodLabelIndex
}

// The same visit as it is stored — a difference from the step's answer rather than a copy of it. The screen
// can be opened while the preferences query is still in flight, so the answer underneath the visit can
// change while it is being made; holding the difference means a response that lands mid-visit changes what
// Done will commit instead of being silently overwritten by a selection taken before it arrived. Only
// `commitDislikeStaging` applies it, which is what makes every other way of leaving that screen — including
// an iOS swipe and Android system back — discard the visit rather than commit it.
export interface DislikeStagingDelta {
  added: string[]
  removed: string[]
  // Only the names learned during the visit; the rest come from the state's own index.
  labels: DislikedFoodLabelIndex
}

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
  // The saved answers as last read from the server — the empty draft until the first seed. It is the point
  // `discardStepEdits` returns a step to, which is what makes the header back button on a step opened in
  // edit mode a Cancel: the step's fields go back to what is stored, and no other step is touched. A
  // per-mount snapshot cannot serve that, because a step screen mounts BEFORE the preferences query it
  // seeds from resolves, so the values at mount are frequently the empty draft rather than the saved row.
  baseline: MealPlanSetupDraft
  // `bodyAnswered`'s counterpart on the baseline: the body step's answer is not an editable field, so a
  // rollback of that step has to restore this separately.
  baselineBodyAnswered: boolean
  // The name each selected food was chosen under. The draft cannot hold it — it mirrors the editable
  // payload exactly, and a name reaching a save earns 400 `read_only_field` — so the names live here beside
  // the draft while the payload keeps carrying ids alone.
  dislikeLabels: DislikedFoodLabelIndex
  dislikeStaging: DislikeStagingDelta | null
}

// Which draft fields each step owns. The partition is what lets a late-resolving preferences query seed the
// steps the user has not touched without overwriting the ones they have, and its completeness is asserted by
// this folder's util test against the empty draft's own keys: a field owned by no step would be silently
// overwritten by every reseed. `timeZone` is deliberately owned by no step — every step payload carries it
// and the server's value is always the one to adopt.
export const DRAFT_FIELDS_BY_STEP: Readonly<Record<MealPlanSetupStep, readonly (keyof MealPlanSetupDraft)[]>> =
  Object.freeze({
    goal: Object.freeze(['goal', 'goalWeightKg', 'paceLbPerWeek'] as const),
    body: Object.freeze(['age', 'heightCm', 'weightKg', 'sexForEstimate', 'heightUnitPref', 'weightUnitPref'] as const),
    activity: Object.freeze(['activityLevel'] as const),
    diet: Object.freeze(['diet', 'allergens'] as const),
    dislikes: Object.freeze(['dislikedFoodIds', 'dislikedFoodGroups'] as const),
    schedule: Object.freeze(['mealSchedule', 'mealTimes'] as const),
    cooking: Object.freeze(['cookingTimeLimitMin', 'budget', 'noBudgetPreference'] as const)
  })

export const STEP_INDEPENDENT_DRAFT_KEYS: readonly (keyof MealPlanSetupDraft)[] = Object.freeze(['timeZone'] as const)

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

// A fresh object each call, because the draft and the baseline it is compared against must never be the
// same object: rolling one back would otherwise rewrite the point it was rolling back to.
const createEmptyDraftFields = (): MealPlanSetupDraft => ({
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
})

export const createEmptyDraft = (): MealPlanSetupDraftState => ({
  draft: createEmptyDraftFields(),
  dirty: createCleanDirty(),
  seeded: false,
  bodyAnswered: false,
  baseline: createEmptyDraftFields(),
  baselineBodyAnswered: false,
  dislikeLabels: {},
  dislikeStaging: null
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
// `bodyAnswered`, a staged search visit and a learned name are each part of what a reset clears, so a
// state carrying any of them is not pristine either — every setter that raises one also seeds or
// dirties, but the predicate says what it means rather than relying on that.
const isPristineDraft = (state: MealPlanSetupDraftState): boolean =>
  !state.seeded &&
  !state.bodyAnswered &&
  state.dislikeStaging === null &&
  Object.keys(state.dislikeLabels).length === 0 &&
  !Object.values(state.dirty).some(Boolean)

// The one reset transition, so the boundaries that end a setup session cannot each invent their
// own clearing rule and a Continue cannot discard the draft by reporting the step it saved.
export const applyLifecycleEvent = (
  state: MealPlanSetupDraftState,
  event: MealPlanSetupLifecycleEvent
): MealPlanSetupDraftState => (clearsSetupDraft(event) && !isPristineDraft(state) ? createEmptyDraft() : state)

const toDislikeLabels = (foods: readonly DislikedFoodSummary[]): DislikedFoodLabelIndex =>
  Object.fromEntries(foods.map(food => [food.id, {id: food.id, name: food.name, foodGroup: food.foodGroup}]))

// A write of one field, generic in the field, because the draft's values have different types per key: the
// assignment is checked once here rather than at each of the twenty keys a merge walks.
const copyDraftField = <Key extends keyof MealPlanSetupDraft>(
  target: MealPlanSetupDraft,
  source: MealPlanSetupDraft,
  field: Key
): void => {
  target[field] = source[field]
}

// The estimated route asks for every step, so it is also the enumeration of them.
const editedSteps = (dirty: MealPlanSetupDirty): MealPlanSetupStep[] =>
  SETUP_STEPS_ESTIMATED.filter(step => dirty[step])

// The answers the user has already given win over the answers just read from the server. A step screen stays
// interactive while its preferences query is in flight, so a slow response resolves AFTER the user has
// chosen a goal, an activity level or a diet, typed a budget or picked meal times — and a seed that took the
// saved row wholesale would erase exactly those. A dirty step therefore keeps both its fields and its dirty
// flag, and every untouched step adopts what is stored.
const withEditedStepsPreserved = (
  seeded: MealPlanSetupDraft,
  previous: MealPlanSetupDraftState
): MealPlanSetupDraft => {
  const merged = {...seeded}

  editedSteps(previous.dirty).forEach(step =>
    DRAFT_FIELDS_BY_STEP[step].forEach(field => copyDraftField(merged, previous.draft, field))
  )

  return merged
}

export const seedDraftFromPreferences = (
  preferences: MealPlanPreferences | null | undefined,
  previous?: MealPlanSetupDraftState
): MealPlanSetupDraftState => {
  if (!preferences) {
    return createEmptyDraft()
  }

  const seeded: MealPlanSetupDraft = {
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
  }
  // The saved body answer, read from the one column that records it. `targetRoute` is
  // server-owned and a body-step save is its only writer — Skip and 'Prefer not to say' resolve
  // it to 'manual', a measured answer to 'estimated' — so non-null means the step was answered
  // whichever branch it took, and that is exactly how the server's own resume logic proves it.
  // Reading the measurements instead would call a saved Skip unanswered and re-ask a step the
  // user already completed. An unrecognized route decodes to null, which re-asks the step rather
  // than counting an answer nobody can read, so the marker fails closed.
  const bodyAnswered = preferences.targetRoute !== null
  const savedLabels = toDislikeLabels(preferences.dislikedFoods)

  if (previous === undefined) {
    return {
      draft: seeded,
      dirty: createCleanDirty(),
      seeded: true,
      bodyAnswered,
      baseline: {...seeded},
      baselineBodyAnswered: bodyAnswered,
      dislikeLabels: savedLabels,
      dislikeStaging: null
    }
  }

  return {
    draft: withEditedStepsPreserved(seeded, previous),
    dirty: {...previous.dirty},
    seeded: true,
    // Answered here or answered on the server: a reseed cannot un-answer the body step.
    bodyAnswered: previous.bodyAnswered || bodyAnswered,
    // The baseline is always what is stored, whatever the draft kept: it is where 'discard my edits' leads.
    baseline: {...seeded},
    baselineBodyAnswered: bodyAnswered,
    // A name the user staged outlives a reseed, because the saved row cannot name a selection it has not
    // been told about yet — and a name is not an answer, so a reseed never rolls one back. Where both can
    // name a food the saved row wins: it is the catalog's own name for it.
    dislikeLabels: {...previous.dislikeLabels, ...savedLabels},
    // A food-search visit in flight is not ended by a background refetch.
    dislikeStaging: previous.dislikeStaging
  }
}

// The parts of the state each reader actually needs, so the provider can publish them separately and a
// change to one does not notify consumers of the other. The whole state satisfies every one of them, which
// is why the functions below can still be called with it.
export type MealPlanSetupCompleteness = Pick<MealPlanSetupDraftState, 'draft' | 'bodyAnswered'>

export type DislikeStagingView = Pick<MealPlanSetupDraftState, 'draft' | 'dislikeLabels' | 'dislikeStaging'>

export type MealPlanSetupDraftSlice = Pick<
  MealPlanSetupDraftState,
  'draft' | 'dirty' | 'seeded' | 'bodyAnswered' | 'dislikeLabels'
>

export const setStepFields = (
  state: MealPlanSetupDraftState,
  step: MealPlanSetupStep,
  fields: Partial<MealPlanSetupDraft>
): MealPlanSetupDraftState => ({
  ...state,
  draft: {...state.draft, ...fields},
  dirty: {...state.dirty, [step]: true}
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
  ...state,
  dirty: {...state.dirty, body: true},
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

const withDislikeLabels = (
  state: MealPlanSetupDraftState,
  foods: readonly DislikedFoodSummary[]
): MealPlanSetupDraftState => ({...state, dislikeLabels: {...state.dislikeLabels, ...toDislikeLabels(foods)}})

// The selection and the name it was made with, together. Every caller has the whole summary in hand — a
// suggestion chip, a catalog search result and an already-selected chip all carry one — and recording the
// name at the moment of choosing is what keeps a food selected from search reviewable on the previous
// screen: nothing else can name it, because the saved row does not hold it yet and it may match no
// suggestion. Removing a food keeps its name, so re-adding it costs no lookup.
export const toggleDislikedFood = (
  state: MealPlanSetupDraftState,
  food: DislikedFoodSummary
): MealPlanSetupDraftState => withDislikeLabels(toggleDislikedFoodId(state, food.id), [food])

// What the food-search screen shows: the step's answer with the visit's difference applied, or the answer
// itself before a visit has been opened — which is what lets that screen render on its first frame.
export const stagedDislikes = (state: DislikeStagingView): DislikeStaging => {
  const delta = state.dislikeStaging

  if (delta === null) {
    return {selection: [...state.draft.dislikedFoodIds], labels: state.dislikeLabels}
  }

  const kept = state.draft.dislikedFoodIds.filter(id => !delta.removed.includes(id))

  return {
    selection: [...kept, ...delta.added.filter(id => !kept.includes(id))],
    labels: {...state.dislikeLabels, ...delta.labels}
  }
}

export const beginDislikeStaging = (state: MealPlanSetupDraftState): MealPlanSetupDraftState =>
  state.dislikeStaging === null ? {...state, dislikeStaging: {added: [], removed: [], labels: {}}} : state

// Every staging change is expressed as the difference between what the user now wants and what the step
// currently answers, so the stored visit stays meaningful if that answer changes underneath it.
const stageSelection = (
  state: MealPlanSetupDraftState,
  desired: readonly string[],
  labels: DislikedFoodLabelIndex
): MealPlanSetupDraftState => {
  const base = state.draft.dislikedFoodIds

  return {
    ...state,
    dislikeStaging: {
      added: desired.filter(id => !base.includes(id)),
      removed: base.filter(id => !desired.includes(id)),
      labels
    }
  }
}

const visitLabels = (state: MealPlanSetupDraftState): DislikedFoodLabelIndex => state.dislikeStaging?.labels ?? {}

export const toggleStagedDislike = (
  state: MealPlanSetupDraftState,
  food: DislikedFoodSummary
): MealPlanSetupDraftState => {
  const {selection} = stagedDislikes(state)
  const desired = selection.includes(food.id) ? selection.filter(id => id !== food.id) : [...selection, food.id]

  return stageSelection(state, desired, {...visitLabels(state), ...toDislikeLabels([food])})
}

// Removal is by id, because the ✕ on a staged chip carries no more than that — and it needs no more: the
// name of a food being taken out of the selection is already known, and is kept.
export const removeStagedDislike = (state: MealPlanSetupDraftState, foodId: string): MealPlanSetupDraftState =>
  stageSelection(
    state,
    stagedDislikes(state).selection.filter(id => id !== foodId),
    visitLabels(state)
  )

// Clear all empties the staged selection and nothing else: the query, the results and the names already
// learned all stay, so a food cleared by mistake is one tap from coming back (Figma 47:463).
export const clearStagedDislikes = (state: MealPlanSetupDraftState): MealPlanSetupDraftState =>
  stageSelection(state, [], visitLabels(state))

// Done, and the only transition that writes a visit into the step's answer. Every other way out of the
// search screen discards it, so the step is marked edited here and nowhere else — and not even here when
// the visit ends on the selection it started from, because an unchanged answer is not an edit.
export const commitDislikeStaging = (state: MealPlanSetupDraftState): MealPlanSetupDraftState => {
  if (state.dislikeStaging === null) {
    return state
  }

  const {selection, labels} = stagedDislikes(state)
  const committed = {...state, dislikeLabels: labels, dislikeStaging: null}
  const answered = state.draft.dislikedFoodIds
  const unchanged = selection.length === answered.length && selection.every(id => answered.includes(id))

  return unchanged ? committed : setStepFields(committed, 'dislikes', {dislikedFoodIds: dedupe(selection)})
}

export const discardDislikeStaging = (state: MealPlanSetupDraftState): MealPlanSetupDraftState =>
  state.dislikeStaging === null ? state : {...state, dislikeStaging: null}

const copyStepFields = (
  target: MealPlanSetupDraft,
  source: MealPlanSetupDraft,
  step: MealPlanSetupStep
): MealPlanSetupDraft => {
  const copied = {...target}

  DRAFT_FIELDS_BY_STEP[step].forEach(field => copyDraftField(copied, source, field))

  return copied
}

// The step was persisted, so its draft values ARE the stored answer from now on: the baseline moves up to
// them and the step is no longer edited. A screen calls this before it navigates away, which is what stops
// the discard on its way out from rolling a successful save back to the row it read on the way in.
export const markStepSaved = (state: MealPlanSetupDraftState, step: MealPlanSetupStep): MealPlanSetupDraftState => ({
  ...state,
  dirty: {...state.dirty, [step]: false},
  baseline: copyStepFields(state.baseline, state.draft, step),
  baselineBodyAnswered: step === 'body' ? state.bodyAnswered : state.baselineBodyAnswered
})

// Cancel on a step opened in edit mode: that step goes back to the stored answer and no other step is
// touched, so leaving without saving cannot leak an abandoned edit into Review, Plan settings, the next
// full save or the same screen reopened. In setup mode nothing calls this — the wizard's in-flight answers
// are the point of the draft, and the later steps derive from the earlier ones.
export const discardStepEdits = (state: MealPlanSetupDraftState, step: MealPlanSetupStep): MealPlanSetupDraftState => ({
  ...state,
  draft: copyStepFields(state.draft, state.baseline, step),
  dirty: {...state.dirty, [step]: false},
  bodyAnswered: step === 'body' ? state.baselineBodyAnswered : state.bodyAnswered,
  // A visit to the search screen is part of the dislikes edit being abandoned.
  dislikeStaging: step === 'dislikes' ? null : state.dislikeStaging
})

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
const STEP_COMPLETENESS: Readonly<Record<MealPlanSetupStep, (state: MealPlanSetupCompleteness) => boolean>> =
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

export const isStepComplete = (state: MealPlanSetupCompleteness, step: MealPlanSetupStep): boolean =>
  STEP_COMPLETENESS[step](state)

export const completedSteps = (state: MealPlanSetupCompleteness, route: TargetRoute): MealPlanSetupStep[] =>
  stepsForRoute(route).filter(step => isStepComplete(state, step))
