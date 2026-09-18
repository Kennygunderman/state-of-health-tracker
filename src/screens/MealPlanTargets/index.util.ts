import type {MacroTargets} from '@data/models/Macros'
import type {
  MealPlanPreferences,
  MealPlanPreferencesSaveResult,
  SetupStepRequest,
  WeightUnitPref
} from '@data/models/MealPlanPreferences'
import {MEAL_SLOTS_IN_WIRE_ORDER} from '@data/models/MealPlanPreferences'
import type {
  NutritionTargetEstimate,
  NutritionTargets,
  SaveEstimatedNutritionTargetsPayload,
  SaveNutritionTargetsPayload,
  SaveNutritionTargetsResult
} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'
import type {GenerationContext, RootStackParamList} from '@navigation/types'
import {API_ERROR_CODES, classifyOutcome, getApiErrorCode} from '@utility/ApiErrorUtility'
import {
  addDaysToDayKey,
  clampDayKeyToPlan,
  formatPlanDayLabel,
  formatPlanRange,
  formatSlotTime,
  PlanStartDateBounds,
  planStartDateBounds
} from '@utility/MealPlanDateUtility'
import {isRoutesMissingError} from '@utility/MealPlanEntitlementUtility'
import {
  classifyMealPlanRead,
  MealPlanReadState,
  MealPlanReadStatus,
  worstMealPlanReadState
} from '@utility/MealPlanReadStateUtility'
import {
  confirmedTargetValues,
  formatCalories,
  formatMacroGrams,
  hasAnyTargetValue
} from '@utility/NutritionFormatUtility'
import {buildSaveEstimatedNutritionTargetsPayload, resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {lookupLabel} from '@utility/TextUtility'
import {formatMeasurementValue, kilogramsToPounds} from '@utility/UnitConversionUtility'

import {
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_ANSWER_DIET_LABEL,
  MEAL_PLAN_ANSWER_MEALS_LABEL,
  MEAL_PLAN_BUDGET_VALUE_TEMPLATE,
  MEAL_PLAN_CHOSEN_TARGETS_CAPTION,
  MEAL_PLAN_CHOSEN_TARGETS_OVERLINE,
  MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE,
  MEAL_PLAN_DAILY_TARGETS_OVERLINE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
  MEAL_PLAN_EDIT_LINK_TEXT,
  MEAL_PLAN_FRESH_ESTIMATE_TEMPLATE,
  MEAL_PLAN_GENERATE_BUTTON_TEXT,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_GOAL_ROW_LABEL,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_LIST_SEPARATOR,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MAX_COOKING_TIME_ROW_LABEL,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL,
  MEAL_PLAN_NO_TARGET_FIGURE_ACCESSIBILITY_TEXT,
  MEAL_PLAN_NO_TARGET_FIGURE_TEXT,
  MEAL_PLAN_PACE_RATE_TEMPLATE,
  MEAL_PLAN_RECALCULATE_LINK_TEXT,
  MEAL_PLAN_START_DATE_TODAY_LABEL,
  MEAL_PLAN_START_DATE_TOMORROW_LABEL,
  MEAL_PLAN_TARGETS_CAPTION,
  MEAL_PLAN_TARGETS_SUMMARY_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_TARGETS_SUMMARY_ESTIMATE_TEMPLATE,
  MEAL_PLAN_TARGETS_SUMMARY_MACRO_TEMPLATE,
  MEAL_PLAN_TARGETS_SUMMARY_MACROS_TEMPLATE,
  MEAL_PLAN_VALUE_NONE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL,
  MEAL_PLAN_WEIGHT_VALUE_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

export type DisplayedMacroKey = 'protein' | 'carbs' | 'fat'

export type DisplayedTargetKey = 'calories' | DisplayedMacroKey

// Whose figures the review card is leading with. 'confirmed' is the user's own saved set, in every state where
// the server holds one — settled, superseded by a change of goal, body, activity or pace, or in a legacy or
// partly filled record generation would refuse — because those figures are the only ones the user chose, and
// what differs between those states is the label and the recalculated figure shown beside them, not which set
// leads. 'estimate' is the calculated set, which leads only where nothing is saved to lead with, and is
// therefore the one set a Generate press may confirm. 'unavailable' is the state with no figures at all, where
// the screen shows the estimate-unavailable card in place of the targets card (0.2.5).
export type DisplayedTargetsSource = 'confirmed' | 'estimate' | 'unavailable'

// Why a Generate press cannot generate.
//
//  - 'estimate_unavailable' — nothing to work from at all: no set generation accepts and no estimate to
//    confirm. Its recovery is manual entry (0.2.5).
//  - 'targets_unconfirmed'  — the user's own saved figures lead the card but generation refuses them (legacy,
//    or partly filled: 422 targets_missing / 409 targets_unconfirmed, 0.5.2). The press cannot answer this on
//    the user's behalf, because the only way past it is to decide between the saved figures and the
//    recalculated ones — so it opens the editor, where both are shown and either can be saved.
export type GenerateBlockedReason = 'estimate_unavailable' | 'targets_unconfirmed'

export type AnswerRowEditStep = 'goal' | 'diet' | 'dislikes' | 'schedule' | 'cooking'

// What the live Generate press does. 'manual_targets' is the recovery the estimate-unavailable state offers
// (09b manual entry, 0.2.5), and it is offered only once that state has settled — while the estimate is still
// loading the press keeps its drawn meaning and is simply unavailable. 'review_targets' opens the same editor
// on the saved figures generation refuses, where the recalculated set sits beside them. The card copy for the
// figureless state belongs to resolveDisplayedTargets' 'unavailable'.
export type GenerateCtaAction = 'generate' | 'manual_targets' | 'review_targets'

export interface GenerateSequenceInputs {
  targets: NutritionTargets | null
  estimate: NutritionTargetEstimate | null
  preferences: MealPlanPreferences
  startDate: string
}

export interface GenerateSequencePlan {
  requiresTargetConfirmation: boolean
  requiresStartDateSave: boolean
  // Whether the press cannot be decided without a settled estimate: true unless the card leads with a set
  // generation already accepts. It is what lets the CTA wait for the estimate query instead of reading its
  // absence as a failure (0.7.4).
  dependsOnEstimate: boolean
  startDate: string
  estimateRevision: number | null
  expectedTargetsRevision: number
  expectedPreferencesRevision: number
  blockedReason: GenerateBlockedReason | null
}

export interface DisplayedTargetsInputs {
  targets: NutritionTargets | null
  estimate: NutritionTargetEstimate | null
  preferences: MealPlanPreferences
}

export interface DisplayedMacro {
  key: DisplayedMacroKey
  label: string
  valueText: string
}

export interface DisplayedTargets {
  source: DisplayedTargetsSource
  cardLabel: string
  calories: string
  unitLabel: string
  macros: DisplayedMacro[]
  caption: string
  editLabel: string
  // The recalculated figure, labelled, shown beside the saved set it would replace — and null wherever there is
  // nothing to compare: a settled set, no estimate, or an estimate that is already the figure on the card.
  freshEstimateText: string | null
  // The whole card as one announcement. The calorie figure, its unit and the three macro rows are separate text
  // nodes on screen and read individually they arrive as four unrelated numbers.
  summaryAccessibilityLabel: string
  missingTargetKeys: DisplayedTargetKey[]
}

export interface AnswerRow {
  key: string
  label: string
  value: string
  editStep: AnswerRowEditStep
}

export interface InitialStartDateInputs {
  reviewStartDate: string | null
  paramStartDate: string | null
  now: Date
  activePlanEndDate: string | null
}

export interface StartDateStepInputs {
  startDate: string
  now: Date
  activePlanEndDate: string | null
}

export interface StartDateStepState {
  bounds: PlanStartDateBounds
  canStepBack: boolean
  canStepForward: boolean
  dayLabel: string
  rangeText: string
}

export interface GenerateCtaInputs {
  plan: GenerateSequencePlan
  isEstimateLoading: boolean
  isPending: boolean
  // Whether a read this screen is built on genuinely failed. The revisions in the plan come from those reads,
  // so a press made without them would argue with the server about a conflict the user never had.
  hasReadFailure: boolean
}

export interface GenerateCtaState {
  label: string
  isEnabled: boolean
  action: GenerateCtaAction
}

// The four target fields are independently nullable on the wire (0.5.2), so a macro row is built only from a
// value the server actually holds. A figure set that reaches the card is whole by construction — a confirmed
// set carries all four values and an estimate is always complete — so a gap is never rendered as a zero.
type PartialMacroFigures = {[K in DisplayedMacroKey]: number | null}

// `calories` is nullable for the same reason the wire fields are: a saved record may hold macro targets and no
// calorie target, and that record is still the user's own set. It leads the card with its figure slot marked
// unset rather than being replaced by a calculated figure the user never chose.
interface DisplayFigures {
  calories: number | null
  macros: DisplayedMacro[]
}

// What the card leads with. The user's own figures lead in every state where the server holds any, because
// discarding them for a calculated set shows the user numbers they never chose and hides the ones they did
// (0.5.2: show the calorie value whenever it is set, and treat 'legacy' or stale as a set to review):
//
//  - 'confirmed'         — complete, non-legacy, fresh: generation takes it as it stands.
//  - 'superseded'        — the same set with its inputs since changed. Generation still uses it until the user
//                          reconfirms (0.7.3), so it still leads, with the recalculated figure beside it.
//  - 'unconfirmed_saved' — the user's figures in a state generation refuses (legacy, or partly filled). They
//                          lead, with the estimate beside them, and the press routes to the editor to settle
//                          which set applies rather than silently confirming one.
//  - 'estimate'          — nothing saved to lead with, so the calculated set does and the press confirms it.
//  - 'none'              — no figures at all; the estimate-unavailable card replaces the targets card (0.2.5).
type PrimaryFigures =
  | {kind: 'confirmed'; figures: DisplayFigures}
  | {kind: 'superseded'; figures: DisplayFigures}
  | {kind: 'unconfirmed_saved'; figures: DisplayFigures}
  | {kind: 'estimate'; figures: DisplayFigures}
  | {kind: 'none'}

// The revision a user with no preferences row carries, which is what the first target save must expect. Declared
// on @data/models/NutritionTargets and re-exported here for the screens and rows that read it from this module.
export {NO_TARGETS_REVISION}

const MACRO_KEYS: DisplayedMacroKey[] = ['protein', 'carbs', 'fat']

// One recovery per blocked reason, so a reason can never reach the CTA without one.
const CTA_ACTION_BY_BLOCKED_REASON: Record<GenerateBlockedReason, GenerateCtaAction> = {
  estimate_unavailable: 'manual_targets',
  targets_unconfirmed: 'review_targets'
}

const ALL_TARGET_KEYS: DisplayedTargetKey[] = ['calories', ...MACRO_KEYS]

const PLAN_LAST_DAY_OFFSET = 6

const NO_FIGURE_TEXT = ''

const labelFrom = (labels: Record<string, string>, code: string): string | undefined => lookupLabel(labels, code)

// One row per macro that has a value, in MACRO_KEYS order; a macro with no value contributes no row rather than
// a zero. Only whole figure sets reach this function — a confirmed set carries all four values and an estimate
// is always complete — so in practice it renders three rows, and the nullable branch is what keeps an
// inconsistent payload from inventing a target of 0 g.
// MACRO_KEYS is a closed local union the label map covers in full, so it is indexed directly; labelFrom exists
// for the preference codes below, which arrive from the server and may name something this build cannot label.
const macroRows = (figures: PartialMacroFigures): DisplayedMacro[] =>
  MACRO_KEYS.flatMap(key => {
    const value = figures[key]

    return value === null ? [] : [{key, label: MEAL_PLAN_MACRO_LABELS[key], valueText: formatMacroGrams(value)}]
  })

// The user's own figures in the state generation accepts as they stand: all four values present and a source
// other than 'legacy' (`confirmedTargetValues`). Staleness is deliberately not part of this — generation keeps
// using a confirmed set until the user reconfirms it (0.7.3), so a stale set is still the one a plan would be
// built from and still the one the card must lead with. What staleness changes is the label and the figure
// shown beside it, not which figures lead.
//
// A response that claims `complete` while holding a null value resolves to null here, so an inconsistent
// payload is treated as the partly filled record it is rather than as a set a plan can be built from.
const savedDisplayFigures = (targets: NutritionTargets | null): DisplayFigures | null => {
  const values = confirmedTargetValues(targets)

  return values === null ? null : {calories: values.calories, macros: macroRows(values)}
}

// The user's own figures when generation refuses them but they are still theirs to review (0.5.2): a legacy
// record, or a partly filled one. Any saved value at all qualifies, including a record holding macros and no
// calorie target — `hasAnyTargetValue` is the same test that makes a single saved macro the user's own figure
// everywhere else in the app.
//
// A calorie heading is deliberately not required. Requiring one would send exactly that record to the estimate
// instead, which both hides the macro the user saved and, because the card would then be led by the calculated
// set, would let a Generate press confirm figures they never selected and overwrite the saved one.
const unconfirmedSavedFigures = (targets: NutritionTargets | null): DisplayFigures | null => {
  const values = targets?.targets ?? null

  if (values === null || !hasAnyTargetValue(targets)) {
    return null
  }

  return {calories: values.calories, macros: macroRows(values)}
}

const estimateDisplayFigures = (estimate: NutritionTargetEstimate): DisplayFigures => ({
  calories: estimate.calories,
  macros: macroRows(estimate)
})

// The one rule for what the targets card leads with, read by the display and by the Generate sequence alike.
// Two rules here is how a screen comes to show one set of figures and save another, so both answers are taken
// from this function and cannot disagree.
//
// The user's own figures lead wherever the server holds any. Replacing them with the calculated set would
// discard the only numbers the user actually chose and, worse, would let a press confirm figures they never
// selected: the estimate is a recalculation of inputs that have since changed, and adopting it is a decision
// only the user can make. So a saved set leads, the recalculated figure is shown beside it for comparison, and
// the link beside them is how it gets adopted (0.5.2, 0.7.3). The calculated set leads only where there is
// nothing saved to lead with — and there, and only there, the press confirms it (0.7.4).
const resolvePrimaryFigures = (
  targets: NutritionTargets | null,
  estimate: NutritionTargetEstimate | null
): PrimaryFigures => {
  const saved = savedDisplayFigures(targets)

  if (saved !== null) {
    return targets?.stale === true ? {kind: 'superseded', figures: saved} : {kind: 'confirmed', figures: saved}
  }

  const unconfirmed = unconfirmedSavedFigures(targets)

  if (unconfirmed !== null) {
    return {kind: 'unconfirmed_saved', figures: unconfirmed}
  }

  return estimate === null ? {kind: 'none'} : {kind: 'estimate', figures: estimateDisplayFigures(estimate)}
}

const joinFragments = (fragments: string[]): string =>
  fragments.length === 0 ? MEAL_PLAN_VALUE_NONE : fragments.join(MEAL_PLAN_VALUE_SEPARATOR)

// A goal weight is entered to a tenth on the goal step, so it reads back to a tenth: the shared measurement
// formatter is the same rule the step's own fields use, which is what stops a 170.5 lb answer being reviewed as
// 171 lb — and, because the value is stored in kilograms, what stops the pound reading of a whole answer
// arriving as 169.99999999999997. 'kg' is the only metric answer; an unanswered preference falls to pounds,
// which is the app's own default weight unit.
const goalWeightText = (goalWeightKg: number, unitPref: WeightUnitPref | null): string => {
  const isMetric = unitPref === 'kg'
  const value = isMetric ? goalWeightKg : kilogramsToPounds(goalWeightKg)

  return stringWithNamedParameters(MEAL_PLAN_WEIGHT_VALUE_TEMPLATE, {
    value: formatMeasurementValue(value),
    unit: isMetric ? MEAL_PLAN_KG_UNIT : MEAL_PLAN_LB_UNIT
  })
}

const goalValue = ({goal, goalWeightKg, paceLbPerWeek, weightUnitPref}: MealPlanPreferences): string => {
  const goalLabel = goal === null ? undefined : labelFrom(MEAL_PLAN_GOAL_LABELS, goal)

  if (goalLabel === undefined) {
    return MEAL_PLAN_VALUE_NONE
  }

  if (goal === 'maintain') {
    return goalLabel
  }

  const fragments = [goalLabel]

  if (goalWeightKg !== null) {
    fragments.push(goalWeightText(goalWeightKg, weightUnitPref))
  }

  if (paceLbPerWeek !== null) {
    fragments.push(stringWithNamedParameters(MEAL_PLAN_PACE_RATE_TEMPLATE, {pace: paceLbPerWeek}))
  }

  return joinFragments(fragments)
}

const dietValue = ({diet, allergens}: MealPlanPreferences): string => {
  const dietLabel = diet === null ? undefined : labelFrom(MEAL_PLAN_DIET_LABELS, diet)

  const allergenLabels = allergens
    .map(code => labelFrom(MEAL_PLAN_ALLERGEN_LABELS, code))
    .filter((label): label is string => label !== undefined)

  const fragments = dietLabel === undefined ? [] : [dietLabel]

  if (allergenLabels.length > 0) {
    fragments.push(allergenLabels.join(MEAL_PLAN_LIST_SEPARATOR))
  }

  return joinFragments(fragments)
}

const dislikesValue = ({dislikedFoods}: MealPlanPreferences): string =>
  dislikedFoods.length === 0
    ? MEAL_PLAN_VALUE_NONE
    : dislikedFoods.map(food => food.name).join(MEAL_PLAN_LIST_SEPARATOR)

const mealsValue = ({mealTimes}: MealPlanPreferences): string => {
  // The day view orders meals by time, but a review row lists the schedule the user set, and a snack at 15:30
  // belongs after dinner in that list rather than between lunch and dinner — so the row is built from the wire
  // order @data/models/MealPlanPreferences owns and never from the clock.
  const ordered = MEAL_SLOTS_IN_WIRE_ORDER.flatMap(slot => mealTimes.filter(entry => entry.slot === slot))

  return ordered.length === 0
    ? MEAL_PLAN_VALUE_NONE
    : ordered.map(entry => formatSlotTime(entry.time)).join(MEAL_PLAN_VALUE_SEPARATOR)
}

const cookingTimeValue = ({cookingTimeLimitMin}: MealPlanPreferences): string =>
  cookingTimeLimitMin === null
    ? MEAL_PLAN_VALUE_NONE
    : stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE, {minutes: cookingTimeLimitMin})

const budgetValue = ({budget, noBudgetPreference}: MealPlanPreferences): string => {
  if (noBudgetPreference) {
    return MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL
  }

  if (budget === null) {
    return MEAL_PLAN_VALUE_NONE
  }

  return stringWithNamedParameters(MEAL_PLAN_BUDGET_VALUE_TEMPLATE, {amount: Math.round(budget.amount)})
}

// Whose figures the card is showing. The three kinds that lead with the user's own set all report 'confirmed',
// because that is what this answers for the screen: whether the figures on the card are the user's or a
// calculation standing in for them. Whether generation accepts them is a separate question, answered by
// `blockedReason`, and whether they need reviewing is answered by the edit label.
const DISPLAYED_SOURCE_BY_PRIMARY_KIND: Record<PrimaryFigures['kind'], DisplayedTargetsSource> = {
  confirmed: 'confirmed',
  superseded: 'confirmed',
  unconfirmed_saved: 'confirmed',
  estimate: 'estimate',
  none: 'unavailable'
}

// The set of kinds whose figures the user should look over before a plan is built from them.
const REVIEWABLE_KINDS: PrimaryFigures['kind'][] = ['superseded', 'unconfirmed_saved']

// The edit link reads as a recalculation exactly where 0.5.2 calls the saved set one to review: its inputs
// have moved on since it was confirmed, it was written outside the planner, or it is only partly filled. That
// is the "review your targets" affordance — the link opens the full editor (09b) on those figures with the
// recalculated set beside them, so the user can adopt, change or replace them. With nothing saved, or with a
// settled set on screen, the link is the drawn 'Edit'.
//
// The two reviewable kinds are the whole of it: any saved value at all resolves to one of the three saved
// kinds, so the estimate leads the card only for an account that has saved nothing to review.
const needsTargetReview = (primary: PrimaryFigures): boolean => REVIEWABLE_KINDS.includes(primary.kind)

// One reason per kind that cannot generate, so a state can never reach the CTA as generable when it is not.
const BLOCKED_REASON_BY_PRIMARY_KIND: Partial<Record<PrimaryFigures['kind'], GenerateBlockedReason>> = {
  none: 'estimate_unavailable',
  unconfirmed_saved: 'targets_unconfirmed'
}

const resolveBlockedReason = (primaryKind: PrimaryFigures['kind']): GenerateBlockedReason | null =>
  BLOCKED_REASON_BY_PRIMARY_KIND[primaryKind] ?? null

const startDateDayLabel = (startDate: string, bounds: PlanStartDateBounds): string => {
  if (startDate === bounds.min) {
    return MEAL_PLAN_START_DATE_TODAY_LABEL
  }

  if (startDate === bounds.default) {
    return MEAL_PLAN_START_DATE_TOMORROW_LABEL
  }

  return formatPlanDayLabel(startDate)
}

/**
 * What a Generate press does, decided from the same primary figures the card renders.
 *
 * `requiresTargetConfirmation` is true exactly when the card leads with the estimate, because confirming the
 * estimate saves it, and a save the user did not ask for may only happen to the numbers they were looking at.
 * A press therefore confirms the calculated set only where that set is what the user was reviewing:
 *
 *  - a confirmed, fresh set: generate against it and save nothing. A manual set reaching this state skips too.
 *  - a superseded set (stale): generation keeps using it until the user reconfirms (0.7.3), so the press
 *    generates against it and saves nothing. The recalculated figure beside it and the Recalculate link are how
 *    the user adopts the new numbers, and adopting them is what records the new targets revision.
 *  - a legacy or partly filled record: generation would answer 422 targets_missing / 409 targets_unconfirmed
 *    (0.5.2), and neither the saved figures nor the estimate can be chosen on the user's behalf — so the press
 *    is blocked as `targets_unconfirmed` and opens the editor, where both sets are shown.
 *  - no figures at all: blocked as `estimate_unavailable`, whose press goes to manual entry (0.2.5).
 *
 * `dependsOnEstimate` marks the two states the estimate alone decides — it leads the card, or there is nothing
 * at all — so the CTA waits for the query there and nowhere else. A press acting on the user's own figures is
 * decided already, and holding it back for an estimate it will not send would make a slow query look like a
 * broken screen.
 *
 * Both revisions are the values as this screen currently reads them, and each save the sequence performs
 * returns a new one; the caller threads the returned revisions into the steps that follow, so the generation
 * request can only ever carry the ones its own saves produced.
 */
export const planGenerateSequence = ({
  targets,
  estimate,
  preferences,
  startDate
}: GenerateSequenceInputs): GenerateSequencePlan => {
  const primary = resolvePrimaryFigures(targets, estimate)

  return {
    requiresTargetConfirmation: primary.kind === 'estimate',
    requiresStartDateSave: startDate !== preferences.reviewStartDate,
    dependsOnEstimate: primary.kind === 'estimate' || primary.kind === 'none',
    startDate,
    estimateRevision: estimate === null ? null : estimate.estimateRevision,
    expectedTargetsRevision: targets === null ? NO_TARGETS_REVISION : targets.revision,
    expectedPreferencesRevision: preferences.revision,
    blockedReason: resolveBlockedReason(primary.kind)
  }
}

/**
 * The estimated-confirmation body the sequence sends before generating, and null when the press confirms
 * nothing — which is the state where the card leads with a confirmed set, so this is also the proof that a
 * Generate press cannot rewrite a saved target the user was never shown.
 */
export const buildTargetConfirmationPayload = (
  plan: GenerateSequencePlan
): SaveEstimatedNutritionTargetsPayload | null =>
  plan.requiresTargetConfirmation && plan.estimateRevision !== null
    ? buildSaveEstimatedNutritionTargetsPayload({
        estimateRevision: plan.estimateRevision,
        targetsRevision: plan.expectedTargetsRevision
      })
    : null

// Every field the card has no figure for: all four where there are none at all, and otherwise each field the
// leading set left unset — a calories-only record names three macros, a macros-only record names the calorie
// target. This is what the editor opens on, so a field absent from the card has to be named here.
const missingFigureKeys = (figures: DisplayFigures | null): DisplayedTargetKey[] => {
  if (figures === null) {
    return ALL_TARGET_KEYS
  }

  const present = figures.macros.map(macro => macro.key)
  const missingMacros = MACRO_KEYS.filter(key => !present.includes(key))

  return figures.calories === null ? ['calories', ...missingMacros] : missingMacros
}

// The card as one sentence, in the order it is drawn, with the recalculated figure appended only when the card
// is showing one. Composed here rather than in the card because it is copy, and every string this module emits
// comes from @constants/strings.
const summaryAccessibilityLabel = (
  cardLabel: string,
  // Spoken rather than drawn: the drawn figure is a dash where no calorie target is saved, which a screen
  // reader reads as punctuation or skips, so the announcement carries the word instead.
  spokenCalories: string,
  macros: DisplayedMacro[],
  freshEstimateText: string | null
): string => {
  const macroList = macros
    .map(macro =>
      stringWithNamedParameters(MEAL_PLAN_TARGETS_SUMMARY_MACRO_TEMPLATE, {
        label: macro.label,
        value: macro.valueText
      })
    )
    .join(MEAL_PLAN_LIST_SEPARATOR)

  return stringWithNamedParameters(MEAL_PLAN_TARGETS_SUMMARY_ACCESSIBILITY_TEMPLATE, {
    label: cardLabel,
    calories: spokenCalories,
    unit: MEAL_PLAN_KCAL_UNIT,
    // Each fragment carries its own sentence break, so a record with no macro rows announces its calorie
    // target and the recalculated figure as two sentences rather than leaving a gap between two full stops.
    macros:
      macroList === NO_FIGURE_TEXT
        ? NO_FIGURE_TEXT
        : stringWithNamedParameters(MEAL_PLAN_TARGETS_SUMMARY_MACROS_TEMPLATE, {macros: macroList}),
    estimate:
      freshEstimateText === null
        ? NO_FIGURE_TEXT
        : stringWithNamedParameters(MEAL_PLAN_TARGETS_SUMMARY_ESTIMATE_TEMPLATE, {estimate: freshEstimateText})
  })
}

/**
 * The figures the card states: the user's own set wherever the server holds one, and the calculated estimate
 * only where it holds none. What the Generate press does with them is `planGenerateSequence`, reading the same
 * primary figures — the press confirms a set only where that set is the calculated one, so the card can never
 * show one set of numbers and hand the user a plan built on another, and can never quietly replace figures the
 * user chose with figures they did not.
 *
 * `freshEstimateText` is the comparison that makes the Recalculate link meaningful: a saved set the server
 * calls stale, legacy or incomplete is shown with the recalculated figure beside it (0.7.3), so the user can
 * see what adopting it would change before the link takes them to the editor. It is null where there is
 * nothing to compare — a settled set, no estimate at all, or a card already headed by the estimate.
 *
 * `editLabel` reads as a recalculation in exactly those states, which is 0.5.2's "review your targets"
 * affordance; it opens the same editor either way. `missingTargetKeys` names every field with no figure, which
 * is all four in the 'unavailable' state — there the screen shows the estimate-unavailable card in place of
 * the targets card (0.2.5), so the numeric fields read empty, not nil.
 *
 * The caption follows the same answer as the card label: a card headed "Your chosen targets" — a saved manual
 * set, or the manual route the user was sent down — cannot also call its figures starting estimates, so it
 * carries the neutral adjustable copy instead.
 */
export const resolveDisplayedTargets = ({targets, estimate, preferences}: DisplayedTargetsInputs): DisplayedTargets => {
  const primary = resolvePrimaryFigures(targets, estimate)
  const figures = primary.kind === 'none' ? null : primary.figures
  const isManualDisplay = targets?.source === 'manual' || preferences.targetRoute === 'manual'
  const isUnderReview = needsTargetReview(primary)

  const cardLabel = isManualDisplay ? MEAL_PLAN_CHOSEN_TARGETS_OVERLINE : MEAL_PLAN_DAILY_TARGETS_OVERLINE
  const savedCalories = figures?.calories ?? null

  // Three cases, and the middle one is the record that holds macros and no calorie target: its figure slot is
  // marked unset rather than filled with the calculated figure, which would read as a target the user chose.
  const calories =
    figures === null
      ? NO_FIGURE_TEXT
      : savedCalories === null
        ? MEAL_PLAN_NO_TARGET_FIGURE_TEXT
        : formatCalories(savedCalories)
  const spokenCalories =
    savedCalories === null ? MEAL_PLAN_NO_TARGET_FIGURE_ACCESSIBILITY_TEXT : formatCalories(savedCalories)
  const macros = figures === null ? [] : figures.macros

  const freshEstimateText =
    isUnderReview && estimate !== null && primary.kind !== 'estimate'
      ? stringWithNamedParameters(MEAL_PLAN_FRESH_ESTIMATE_TEMPLATE, {calories: formatCalories(estimate.calories)})
      : null

  return {
    source: DISPLAYED_SOURCE_BY_PRIMARY_KIND[primary.kind],
    cardLabel,
    calories,
    unitLabel: MEAL_PLAN_KCAL_UNIT,
    macros,
    caption: isManualDisplay ? MEAL_PLAN_CHOSEN_TARGETS_CAPTION : MEAL_PLAN_TARGETS_CAPTION,
    editLabel: isUnderReview ? MEAL_PLAN_RECALCULATE_LINK_TEXT : MEAL_PLAN_EDIT_LINK_TEXT,
    freshEstimateText,
    summaryAccessibilityLabel: summaryAccessibilityLabel(cardLabel, spokenCalories, macros, freshEstimateText),
    missingTargetKeys: missingFigureKeys(figures)
  }
}

export const buildAnswerRows = (preferences: MealPlanPreferences): AnswerRow[] => [
  {key: 'goal', label: MEAL_PLAN_GOAL_ROW_LABEL, value: goalValue(preferences), editStep: 'goal'},
  {key: 'diet', label: MEAL_PLAN_ANSWER_DIET_LABEL, value: dietValue(preferences), editStep: 'diet'},
  {
    key: 'dislikes',
    label: MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
    value: dislikesValue(preferences),
    editStep: 'dislikes'
  },
  {key: 'meals', label: MEAL_PLAN_ANSWER_MEALS_LABEL, value: mealsValue(preferences), editStep: 'schedule'},
  {
    key: 'cookingTime',
    label: MEAL_PLAN_MAX_COOKING_TIME_ROW_LABEL,
    value: cookingTimeValue(preferences),
    editStep: 'cooking'
  },
  {key: 'budget', label: MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL, value: budgetValue(preferences), editStep: 'cooking'}
]

export const resolveInitialStartDate = ({
  reviewStartDate,
  paramStartDate,
  now,
  activePlanEndDate
}: InitialStartDateInputs): string => {
  const bounds = planStartDateBounds({now, activePlanEndDate})
  const candidate = paramStartDate ?? reviewStartDate ?? bounds.default

  return clampDayKeyToPlan(candidate, bounds.min, bounds.max)
}

export const resolveStartDateStepState = ({
  startDate,
  now,
  activePlanEndDate
}: StartDateStepInputs): StartDateStepState => {
  const bounds = planStartDateBounds({now, activePlanEndDate})
  const dayLabel = startDateDayLabel(startDate, bounds)
  const rangeLabel = formatPlanRange(startDate, addDaysToDayKey(startDate, PLAN_LAST_DAY_OFFSET))

  return {
    bounds,
    canStepBack: startDate > bounds.min,
    canStepForward: startDate < bounds.max,
    dayLabel,
    rangeText: [dayLabel, rangeLabel].join(MEAL_PLAN_VALUE_SEPARATOR)
  }
}

/**
 * The disabled Generate states are a pending press, an estimate decision that has not settled (0.7.4), and a
 * read that failed.
 *
 * The last one is what a retry card is for: this press sends `expectedTargetsRevision` and
 * `expectedPreferencesRevision`, both read from the two queries, and a failed read supplies neither. Leaving
 * the CTA live there offers the user a plan built on revisions nothing reported — which the server refuses as a
 * conflict the user never caused, after the wizard has already been left behind.
 *
 * The second one is any press whose outcome the estimate still decides — `dependsOnEstimate` — while the
 * estimate query is loading. A first visit is exactly that case and was the one this missed: with no saved
 * targets and no estimate yet, the plan reads as `estimate_unavailable` because the query has not answered,
 * not because it answered that no estimate can be calculated. Leaving the CTA live there offered manual entry
 * over a figure that was about to arrive; waiting costs the user the moment the query takes and then shows
 * them the estimate they came to review.
 *
 * Once the decision settles the CTA keeps the drawn label and stays live: a settled block has nothing left to
 * wait for, so the press carries the user to manual entry, which is the recovery for an estimate that genuinely
 * cannot be calculated (0.2.5). A press whose targets are confirmed never waits for the estimate at all.
 */
export const resolveGenerateCtaState = ({
  plan,
  isEstimateLoading,
  isPending,
  hasReadFailure
}: GenerateCtaInputs): GenerateCtaState => {
  const awaitsEstimateDecision = plan.dependsOnEstimate && isEstimateLoading
  const settledBlockedReason = awaitsEstimateDecision ? null : plan.blockedReason

  return {
    label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
    isEnabled: !isPending && !awaitsEstimateDecision && !hasReadFailure,
    action: settledBlockedReason === null ? 'generate' : CTA_ACTION_BY_BLOCKED_REASON[settledBlockedReason]
  }
}

/**
 * Whether the estimate read answered that no estimate can be calculated for these inputs, rather than failing
 * to answer at all.
 *
 * Confirmedness is the whole of the distinction, which is why this is not the bare code test: `409
 * estimate_unavailable` is the server's verdict on the user's own inputs and its drawn recovery is manual
 * entry (0.2.5), while a 502 whose body happens to carry the same code is an unknown outcome a second attempt
 * may resolve — sending that user to type targets by hand asks them to replace figures the server never said
 * it could not calculate.
 */
export const isConfirmedEstimateUnavailableError = (error: unknown): boolean =>
  classifyOutcome(error) === 'confirmed' && getApiErrorCode(error) === API_ERROR_CODES.estimateUnavailable

/** The estimate query result, as much of it as deciding whether to trust its data requires. */
export interface EstimateRead {
  isSuccess: boolean
  data?: NutritionTargetEstimate | undefined
}

/**
 * The estimate the card and the press may use: the read's data only while the read itself succeeded.
 *
 * The same rule as `authoritativeRefetch` in `@utility/RevisionConflictUtility`, applied to a query result
 * rather than a refetch, and it matters most in the one estimate error this screen treats as an *answer*.
 * TanStack keeps the last successful `data` on a result that has since errored, so a confirmed `409
 * estimate_unavailable` arriving after a good estimate leaves that estimate in the cache. Reading it would
 * make `resolvePrimaryFigures` report `kind: 'estimate'`, and from there the card renders the stale figures
 * (its `source !== 'unavailable'` branch is tested before `isEstimateUnavailable`) with a Generate path that
 * would confirm them — figures the server has just said it cannot calculate, whose drawn recovery is manual
 * entry (AAP 0.2.5). Returning null instead yields `kind: 'none'`, which keeps `dependsOnEstimate` true so a
 * generic failure still composes into the read state, leaves `requiresTargetConfirmation` false so no
 * confirmation payload can be built from a withheld estimate, and lets the unavailable card render.
 */
export const authoritativeEstimate = (read: EstimateRead): NutritionTargetEstimate | null =>
  read.isSuccess ? (read.data ?? null) : null

export interface ReviewReadStateInputs {
  preferences: MealPlanReadStatus
  targets: MealPlanReadStatus
  estimate: MealPlanReadStatus
  // `GenerateSequencePlan.dependsOnEstimate`: whether the press's outcome still rests on the estimate. False
  // whenever there is no plan to ask — the plan is derived from the preferences row, and preferences that have
  // not answered have already decided this screen on their own.
  dependsOnEstimate: boolean
}

export interface ReviewReadState {
  status: MealPlanReadState
  // Which reads a "Try again" must refetch. Keyed on each read's own state and never on its data, so a retry
  // offered for a read that has stopped working actually re-requests it, and one that failed nowhere asks for
  // nothing.
  retryPreferences: boolean
  retryTargets: boolean
  retryEstimate: boolean
}

/**
 * What the review screen's three reads have jointly said, and which of them a retry would re-request.
 *
 * It replaces a data-nullity test that could not state this. `preferencesQuery.data` survives a refetch that
 * failed — TanStack keeps the last successful row deliberately — so a read that has *stopped working* still
 * reported a row, the retry card was skipped, the review rendered as settled state, and the Generate press
 * went on pinning `expectedPreferencesRevision` from a row the read no longer stands behind. Every state here
 * is therefore keyed on the read's status, which is the only thing that says what the server answered about
 * this attempt.
 *
 * Each read is classified with the errors it answers for itself, because "the read failed" means something
 * different for each of the three:
 *
 *  - **preferences** — no answered error. `/meal-planning/preferences` is one of the gated, resource-less GETs,
 *    so its bare 404 and its confirmed `503 feature_disabled` are the capability signals of 0.2.5 and surface
 *    as `unavailable`: a route that is not mounted, or a capability switched off, answers a repeat probe
 *    identically forever, so that state states itself and offers no retry.
 *  - **targets** — `isRoutesMissingError` is an answer, not a failure. A rolled-back targets route means the
 *    local target stands and the card still renders exactly as it does for a user who never opted in
 *    (AAP 0.7.5), which is the treatment `selectNutritionTargets` already applies to the same error. This
 *    reproduces `isNutritionTargetsReadFailure` exactly: everything it calls a failure lands on `failed` or
 *    `unavailable`, and the routes-missing answer lands on `ready`.
 *  - **estimate** — a confirmed `409 estimate_unavailable` is an answer with its own drawn card and its own
 *    recovery into manual entry (0.2.5), so it is `ready` here and the card renders it. Any other estimate
 *    error is a read that never answered, and it composes in only while `dependsOnEstimate` holds: a review
 *    leading with the user's confirmed figures must not be blocked by an estimate it never shows.
 *
 * The estimate's own `loading` is deliberately dropped from the composition rather than escalated. 0.2.5 gives
 * that read a card-level skeleton, not a screen-level one — the targets card draws it while the rest of the
 * review stays on screen — and the press already waits for it through `resolveGenerateCtaState`'s
 * `isEstimateLoading`. Escalating it would replace an otherwise complete review with a full-screen skeleton
 * every first visit.
 */
export const resolveReviewReadState = ({
  preferences,
  targets,
  estimate,
  dependsOnEstimate
}: ReviewReadStateInputs): ReviewReadState => {
  const preferencesState = classifyMealPlanRead(preferences)
  const targetsState = classifyMealPlanRead(targets, isRoutesMissingError)
  const estimateState = classifyMealPlanRead(estimate, isConfirmedEstimateUnavailableError)
  const composedEstimateState = dependsOnEstimate && estimateState !== 'loading' ? estimateState : 'ready'

  return {
    status: worstMealPlanReadState([preferencesState, targetsState, composedEstimateState]),
    retryPreferences: preferencesState === 'failed',
    retryTargets: targetsState === 'failed',
    retryEstimate: composedEstimateState === 'failed'
  }
}

// The Generate press the derivations above decide, run over the collaborators the screen injects. It lives
// beside them rather than in the component so its ordering, selective retry and conflict recovery are decided
// in one place and exercised without a renderer: every server call it makes arrives as a collaborator, so the
// screen supplies those and turns the outcome into copy.

export type GeneratingRouteParams = RootStackParamList['Meal Plan Generating']

/**
 * What a press has already written and the revision the server answered with. A commitment lets the next
 * press resume the sequence rather than restart it (AAP 0.7.4), and it is only ever honoured while the live
 * revision still equals the one recorded here — see `runGenerateSequence`.
 */
export interface GenerateSequenceCommitments {
  confirmedTargetsRevision: number | null
  savedStartDate: {date: string; revision: number} | null
}

export const NO_GENERATE_COMMITMENTS: GenerateSequenceCommitments = Object.freeze({
  confirmedTargetsRevision: null,
  savedStartDate: null
})

/**
 * A refused write whose refetched values genuinely differ from the ones the press asserted, carrying
 * everything either answer needs: `payload` re-confirms the same estimate against the revision the refetch
 * reported, and `theirStartDate` is the value "Use theirs" adopts.
 */
export interface TargetsRevisionConflict {
  step: 'targets'
  payload: SaveEstimatedNutritionTargetsPayload
}

export interface StartDateRevisionConflict {
  step: 'startDate'
  startDate: string
  expectedRevision: number
  theirStartDate: string | null
}

export type GenerateRevisionConflict = TargetsRevisionConflict | StartDateRevisionConflict

/**
 * How far the sequence got. The screen turns this into copy: 'estimate_stale' and 'failed' report themselves
 * with a toast, 'conflict' raises the persistent prompt (0.7.2), and 'generating' has already navigated.
 * `commitments` is what the caller must hold for the next press, whichever branch was taken.
 */
export type GenerateSequenceOutcome =
  | {status: 'generating'; commitments: GenerateSequenceCommitments}
  | {status: 'estimate_stale'; commitments: GenerateSequenceCommitments}
  | {status: 'failed'; commitments: GenerateSequenceCommitments}
  | {status: 'conflict'; commitments: GenerateSequenceCommitments; conflict: GenerateRevisionConflict}

/**
 * What an authoritative refetch answered. Recovery from a refused write compares the user's values with the
 * server's, so it needs the server's values — and a refetch that failed has none of them.
 *
 * The distinction has to be carried explicitly because the cache hides it: a failed refetch leaves the
 * previous data in place, so a collaborator that returned data alone could not tell "the server holds this"
 * from "the request never arrived and this is what we already had". Read as the former, the pre-save cache
 * matches the figures the press asserted and a rejected save is reported as one that already landed — the
 * blind retry 0.7.2 forbids, wearing the shape of a resolution.
 */
export type RefetchResult<T> = {status: 'ok'; data: T} | {status: 'failed'}

export interface GenerateSequenceCollaborators {
  saveTargets: (payload: SaveNutritionTargetsPayload) => Promise<SaveNutritionTargetsResult>
  saveSetupStep: (variables: SetupStepRequest) => Promise<MealPlanPreferencesSaveResult>
  refetchTargets: () => Promise<RefetchResult<NutritionTargets | null>>
  refetchPreferences: () => Promise<RefetchResult<MealPlanPreferences | null>>
  // The estimate's figures are read off the re-rendered card rather than from here, but whether the refresh
  // happened decides what the press reports: 'estimate_stale' tells the user to read recalculated numbers.
  refetchEstimate: () => Promise<RefetchResult<NutritionTargetEstimate | null>>
  mintIdempotencyKey: () => string
  navigateToGenerating: (params: GeneratingRouteParams) => void
}

export interface GenerateSequenceRun {
  targets: NutritionTargets | null
  estimate: NutritionTargetEstimate | null
  preferences: MealPlanPreferences
  startDate: string
  // The nextWeek route param, which is what tells a successor week from a first-time setup; null in setup mode.
  planStartDate: string | null
  timeZone: string
  commitments: GenerateSequenceCommitments
  // The conflict the user answered with "Keep mine". It forces the refused write to be re-sent against the
  // revision the refetch reported, which a re-derived plan could not do: the refetched row now leads the card,
  // so deciding afresh would silently adopt the server's values instead.
  keepMineConflict: GenerateRevisionConflict | null
  collaborators: GenerateSequenceCollaborators
}

type TargetsStepResult =
  | {status: 'committed'; revision: number}
  | {status: 'estimate_stale'}
  | {status: 'failed'}
  | {status: 'conflict'; conflict: TargetsRevisionConflict}

type StartDateStepResult =
  | {status: 'committed'; revision: number}
  | {status: 'failed'}
  | {status: 'conflict'; conflict: StartDateRevisionConflict}

// A rejected targets revision is compared on the figures alone: everything else TargetsResponse carries is the
// server's own derivation from them, so comparing it would report bookkeeping as the user's change.
const TARGETS_CONFLICT_FIELDS: readonly (keyof NutritionTargets & string)[] = Object.freeze(['targets'])

// The one answer the review step writes to preferences, so a diet or a meal time edited elsewhere is never
// reported as a conflict with the plan's start date.
const REVIEW_CONFLICT_FIELDS: readonly (keyof MealPlanPreferences & string)[] = Object.freeze(['reviewStartDate'])

// The literal type, not `SetupStep`: the wider annotation would not narrow against `SetupStepRequest` at the
// call site below, which is the pairing this step's save has to satisfy.
const REVIEW_STEP = 'review' as const

/**
 * Whether a recorded confirmation is still the revision the server holds. A commitment records "this press
 * wrote revision N", which only means "N is current" while nothing has written since — and Review stays
 * mounted while the target editor is pushed and popped, so an edit between two presses moves the live
 * revision past N. Reading the two as the same fact is what would carry a superseded revision into
 * generation, so anything other than equality makes the commitment obsolete.
 */
const isConfirmationCurrent = (commitments: GenerateSequenceCommitments, targets: NutritionTargets | null): boolean =>
  commitments.confirmedTargetsRevision !== null &&
  targets !== null &&
  targets.revision === commitments.confirmedTargetsRevision

/**
 * Whether a recorded start-date save is still the row the server holds: the same date, saved at the revision
 * preferences currently reports. The date alone is not enough — an answer edited on another step bumps the
 * revision without touching the start date, and the pin the next save sends has to be that newer one.
 */
const isStartDateSaveCurrent = (
  commitments: GenerateSequenceCommitments,
  startDate: string,
  preferences: MealPlanPreferences
): boolean =>
  commitments.savedStartDate !== null &&
  commitments.savedStartDate.date === startDate &&
  commitments.savedStartDate.revision === preferences.revision

/**
 * The figures a confirmation asserted. The payload sends a revision rather than numbers, so what it claimed is
 * the estimate's — the set the card was showing when the press happened.
 */
const assertedEstimateFigures = (estimate: NutritionTargetEstimate | null): MacroTargets | null =>
  estimate === null
    ? null
    : {calories: estimate.calories, protein: estimate.protein, carbs: estimate.carbs, fat: estimate.fat}

/**
 * Step one: confirm the displayed estimate.
 *
 * A rejected targets revision is never retried blindly (0.7.2). The authoritative figures are refetched and
 * compared with the ones this press asserted, so a confirmation whose response was lost, or the same
 * confirmation made from another device, is recognised as already written and the sequence continues instead
 * of writing twice. Figures that genuinely differ are the user's to settle, so they raise a conflict carrying
 * the payload a "Keep mine" answer re-sends against the revision just refetched.
 */
const confirmTargets = async (
  payload: SaveEstimatedNutritionTargetsPayload,
  estimate: NutritionTargetEstimate | null,
  collaborators: GenerateSequenceCollaborators
): Promise<TargetsStepResult> => {
  try {
    const saved = await collaborators.saveTargets(payload)

    return {status: 'committed', revision: saved.targets.revision}
  } catch (error) {
    const code = getApiErrorCode(error)

    // An estimate computed from inputs that have since moved is refused rather than saved: refetch the figures
    // and leave the user on Review to read them, which is the one recovery that cannot generate a plan against
    // numbers they were never shown. A refresh that itself failed leaves the old figures on the card, so
    // saying "read the recalculated numbers" would name numbers that are not there — that is an ordinary
    // failure the user can retry.
    if (code === API_ERROR_CODES.estimateStale) {
      const refreshed = await collaborators.refetchEstimate()

      return refreshed.status === 'ok' ? {status: 'estimate_stale'} : {status: 'failed'}
    }

    if (code !== API_ERROR_CODES.staleTargets) {
      return {status: 'failed'}
    }

    const refetched = await collaborators.refetchTargets()

    // No authoritative answer, so nothing to compare against: the save stands rejected and the press fails.
    // Treating a failed refetch as an answer is what would let the retained pre-save figures match the ones
    // this press asserted and report a rejected confirmation as already written.
    if (refetched.status !== 'ok' || refetched.data === null) {
      return {status: 'failed'}
    }

    const fresh = refetched.data
    const asserted = assertedEstimateFigures(estimate)
    const isAlreadyWritten =
      asserted !== null &&
      resolveStaleRevision<NutritionTargets>({targets: asserted}, fresh, TARGETS_CONFLICT_FIELDS).status === 'resolved'

    if (isAlreadyWritten) {
      return {status: 'committed', revision: fresh.revision}
    }

    // Absent figures to compare are treated as a difference rather than a match: with no estimate in hand the
    // press cannot be shown to have landed, and a prompt the user can answer is safer than assuming it did.
    return {
      status: 'conflict',
      conflict: {
        step: 'targets',
        payload: buildSaveEstimatedNutritionTargetsPayload({
          estimateRevision: payload.estimateRevision,
          targetsRevision: fresh.revision
        })
      }
    }
  }
}

/**
 * Step two: persist the reviewed start date, and only once step one has settled — a plan generated against an
 * unconfirmed target is the outcome the ordering exists to prevent.
 *
 * The same recovery applies: a refused revision whose refetched row already carries this date means the lost
 * write landed, so its revision is carried forward rather than the date being sent again.
 */
const saveStartDate = async (
  input: {startDate: string; timeZone: string; expectedRevision: number},
  collaborators: GenerateSequenceCollaborators
): Promise<StartDateStepResult> => {
  try {
    const saved = await collaborators.saveSetupStep({
      step: REVIEW_STEP,
      payload: {startDate: input.startDate, timeZone: input.timeZone, expectedRevision: input.expectedRevision}
    })

    return {status: 'committed', revision: saved.preferences.revision}
  } catch (error) {
    if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
      return {status: 'failed'}
    }

    const refetched = await collaborators.refetchPreferences()

    // The same rule as the targets step: without a fresh row there is nothing the refused date can be
    // compared with, and the retained row is the one that made the pin stale in the first place.
    if (refetched.status !== 'ok' || refetched.data === null) {
      return {status: 'failed'}
    }

    const fresh = refetched.data

    if (
      resolveStaleRevision<MealPlanPreferences>({reviewStartDate: input.startDate}, fresh, REVIEW_CONFLICT_FIELDS)
        .status === 'resolved'
    ) {
      return {status: 'committed', revision: fresh.revision}
    }

    return {
      status: 'conflict',
      conflict: {
        step: 'startDate',
        startDate: input.startDate,
        expectedRevision: fresh.revision,
        theirStartDate: fresh.reviewStartDate
      }
    }
  }
}

/**
 * The ordered sequence AAP 0.7.4 specifies: confirm the displayed estimate, persist a changed start date, then
 * navigate to generation with the revisions those steps returned. Nothing runs after a failure and nothing
 * navigates unless both steps have settled, so a plan is never generated against a value the server refused.
 *
 * The idempotency key is minted at the navigation itself, never earlier: a key survives only a byte-identical
 * replay, so a press that follows an edited answer or a re-saved target needs its own (0.7.2).
 */
export const runGenerateSequence = async (run: GenerateSequenceRun): Promise<GenerateSequenceOutcome> => {
  const {targets, estimate, preferences, startDate, keepMineConflict, collaborators} = run
  const plan = planGenerateSequence({targets, estimate, preferences, startDate})

  const isTargetsStepDone = isConfirmationCurrent(run.commitments, targets)
  const isStartDateStepDone = isStartDateSaveCurrent(run.commitments, startDate, preferences)

  let commitments: GenerateSequenceCommitments = {
    confirmedTargetsRevision: isTargetsStepDone ? run.commitments.confirmedTargetsRevision : null,
    savedStartDate: isStartDateStepDone ? run.commitments.savedStartDate : null
  }

  // The revisions the press carries are always the ones the queries currently report. A commitment decides
  // only whether its step may be skipped, and it can only be honoured while it equals the live value, so the
  // two can never disagree about what is being pinned.
  let targetsRevision = plan.expectedTargetsRevision
  let preferencesRevision = plan.expectedPreferencesRevision

  const keepMineTargets = keepMineConflict?.step === 'targets' ? keepMineConflict.payload : null
  const confirmation = keepMineTargets ?? (isTargetsStepDone ? null : buildTargetConfirmationPayload(plan))

  if (confirmation !== null) {
    const step = await confirmTargets(confirmation, estimate, collaborators)

    if (step.status === 'estimate_stale') {
      return {status: 'estimate_stale', commitments}
    }

    if (step.status === 'failed') {
      return {status: 'failed', commitments}
    }

    if (step.status === 'conflict') {
      return {status: 'conflict', commitments, conflict: step.conflict}
    }

    targetsRevision = step.revision
    commitments = {...commitments, confirmedTargetsRevision: step.revision}
  }

  const keepMineStartDate = keepMineConflict?.step === 'startDate' ? keepMineConflict : null
  const needsStartDateSave = keepMineStartDate !== null || (plan.requiresStartDateSave && !isStartDateStepDone)

  if (needsStartDateSave) {
    const step = await saveStartDate(
      {
        startDate,
        timeZone: run.timeZone,
        expectedRevision: keepMineStartDate?.expectedRevision ?? preferencesRevision
      },
      collaborators
    )

    if (step.status === 'failed') {
      return {status: 'failed', commitments}
    }

    if (step.status === 'conflict') {
      return {status: 'conflict', commitments, conflict: step.conflict}
    }

    preferencesRevision = step.revision
    commitments = {...commitments, savedStartDate: {date: startDate, revision: step.revision}}
  }

  const context: GenerationContext = run.planStartDate === null ? {kind: 'setup'} : {kind: 'nextWeek', startDate}

  collaborators.navigateToGenerating({
    context,
    idempotencyKey: collaborators.mintIdempotencyKey(),
    expectedPreferencesRevision: preferencesRevision,
    expectedTargetsRevision: targetsRevision,
    startDate
  })

  return {status: 'generating', commitments}
}
