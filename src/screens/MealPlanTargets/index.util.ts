import type {MealPlanPreferences, MealTimeEntry, WeightUnitPref} from '@data/models/MealPlanPreferences'
import type {
  NutritionTargetEstimate,
  NutritionTargets,
  SaveEstimatedNutritionTargetsPayload
} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'
import {
  addDaysToDayKey,
  clampDayKeyToPlan,
  formatPlanDayLabel,
  formatPlanRange,
  formatSlotTime,
  PlanStartDateBounds,
  planStartDateBounds
} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'
import {buildSaveEstimatedNutritionTargetsPayload, isPlannerConfirmedTargets} from '@utility/NutritionTargetsUtility'
import {kilogramsToPounds} from '@utility/UnitConversionUtility'

import {
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_ANSWER_DIET_LABEL,
  MEAL_PLAN_ANSWER_MEALS_LABEL,
  MEAL_PLAN_BUDGET_VALUE_TEMPLATE,
  MEAL_PLAN_CHOSEN_TARGETS_OVERLINE,
  MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE,
  MEAL_PLAN_DAILY_TARGETS_OVERLINE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
  MEAL_PLAN_EDIT_LINK_TEXT,
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
  MEAL_PLAN_PACE_RATE_TEMPLATE,
  MEAL_PLAN_RECALCULATE_LINK_TEXT,
  MEAL_PLAN_START_DATE_TODAY_LABEL,
  MEAL_PLAN_START_DATE_TOMORROW_LABEL,
  MEAL_PLAN_TARGETS_CAPTION,
  MEAL_PLAN_VALUE_NONE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL,
  MEAL_PLAN_WEIGHT_VALUE_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

export type DisplayedMacroKey = 'protein' | 'carbs' | 'fat'

export type DisplayedTargetKey = 'calories' | DisplayedMacroKey

// 'confirmed' and 'current' both carry the user's own saved figures; they differ in what generation will do with
// them. 'current' is a set the planner refuses (legacy or incomplete, 0.5.2) and the review card still shows,
// because hiding the numbers the user is being asked to review is worse than showing ones they must revisit.
export type DisplayedTargetsSource = 'confirmed' | 'current' | 'estimate' | 'unavailable'

// Why a Generate press cannot generate. 'estimate_unavailable' is the state with no figures to work from;
// 'targets_need_review' is saved figures generation would refuse (legacy, incomplete, or an unreadable source),
// which the user must confirm or replace themselves — the press must never resolve it by saving the estimate.
export type GenerateBlockedReason = 'estimate_unavailable' | 'targets_need_review'

export type AnswerRowEditStep = 'goal' | 'diet' | 'dislikes' | 'schedule' | 'cooking'

// What the live Generate press does. 'manual_targets' is the recovery the estimate-unavailable state offers
// (09b manual entry, 0.2.5); 'review_targets' opens the same editor on the saved figures so the user confirms
// or replaces them explicitly; the card copy for the figureless state belongs to resolveDisplayedTargets'
// 'unavailable'.
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
  freshEstimateCalories: string | null
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
}

export interface GenerateCtaState {
  label: string
  isEnabled: boolean
  action: GenerateCtaAction
}

// The four target fields are independently nullable on the wire (0.5.2), so a figure set carries each of them
// as it found it and names the ones it has no value for rather than implying a gap is a zero.
type PartialMacroFigures = {[K in DisplayedMacroKey]: number | null}

interface DisplayFigures {
  calories: number | null
  macros: DisplayedMacro[]
  missing: DisplayedTargetKey[]
}

// What the card leads with: the user's own saved figures ('current'), the calculated estimate ('estimate'), or
// nothing at all ('none' — no saved value and no estimate to fall back on).
type PrimaryFigures =
  | {kind: 'current'; figures: DisplayFigures}
  | {kind: 'estimate'; figures: DisplayFigures}
  | {kind: 'none'}

// The revision a user with no preferences row carries, which is what the first target save must expect. Defined
// with the save payloads it governs and re-exported here for the screens and rows that read it from this module.
export {NO_TARGETS_REVISION}

const MACRO_KEYS: DisplayedMacroKey[] = ['protein', 'carbs', 'fat']

// One recovery per blocked reason, so a reason can never reach the CTA without one.
const CTA_ACTION_BY_BLOCKED_REASON: Record<GenerateBlockedReason, GenerateCtaAction> = {
  estimate_unavailable: 'manual_targets',
  targets_need_review: 'review_targets'
}

const ALL_TARGET_KEYS: DisplayedTargetKey[] = ['calories', ...MACRO_KEYS]

// The slots in the order the wire carries them. The day view orders meals by time, but a review row lists the
// schedule the user set, and a snack at 15:30 belongs after dinner in that list rather than between lunch and
// dinner — so the row is built from this order and never from the clock.
const WIRE_SLOT_ORDER: MealTimeEntry['slot'][] = ['breakfast', 'lunch', 'dinner', 'snack']

const PLAN_LAST_DAY_OFFSET = 6

const NO_FIGURE_TEXT = ''

const labelFrom = (labels: Record<string, string>, code: string): string | undefined => labels[code]

// One row per macro that has a value, in MACRO_KEYS order; a macro the server holds no value for contributes no
// row and is named in `missing` instead, so a saved protein target survives a missing carb target.
// MACRO_KEYS is a closed local union the label map covers in full, so it is indexed directly; labelFrom exists
// for the preference codes below, which arrive from the server and may name something this build cannot label.
const macroRows = (figures: PartialMacroFigures): DisplayedMacro[] =>
  MACRO_KEYS.flatMap(key => {
    const value = figures[key]

    return value === null ? [] : [{key, label: MEAL_PLAN_MACRO_LABELS[key], valueText: formatMacroGrams(value)}]
  })

const missingMacroKeys = (figures: PartialMacroFigures): DisplayedTargetKey[] =>
  MACRO_KEYS.filter(key => figures[key] === null)

// The user's saved figures as the review card shows them, field by field: per 0.5.2 the four values are
// independently nullable, and `complete` and `source` decide what the planner accepts rather than what the user
// is shown. So any saved value at all makes this the set being reviewed — a legacy set, a calories-only account,
// a calorie target beside one macro — and the estimate never stands in for the part the server does not hold.
// The card omits a row it has no figure for and names the key in `missing`; the review row on Plan settings
// drops its whole macro fragment instead, because a single text fragment cannot state two of three macros.
const currentFigures = (targets: NutritionTargets | null): DisplayFigures | null => {
  if (targets === null || targets.targets === null) {
    return null
  }

  const {calories, protein, carbs, fat} = targets.targets
  const macroFigures: PartialMacroFigures = {protein, carbs, fat}
  const macros = macroRows(macroFigures)

  if (calories === null && macros.length === 0) {
    return null
  }

  return {
    calories,
    macros,
    missing: calories === null ? ['calories', ...missingMacroKeys(macroFigures)] : missingMacroKeys(macroFigures)
  }
}

const estimateDisplayFigures = (estimate: NutritionTargetEstimate): DisplayFigures => ({
  calories: estimate.calories,
  macros: macroRows(estimate),
  missing: []
})

// The one rule for what the targets card leads with, read by the display and by the Generate sequence alike.
// Two rules here is how the screen came to show one set of figures and save another: the card led with the
// user's saved numbers while the press confirmed the estimate beside them, replacing what was on screen with
// figures the user had not agreed to. Both answers now come from this function, so they cannot disagree.
const resolvePrimaryFigures = (
  targets: NutritionTargets | null,
  estimate: NutritionTargetEstimate | null
): PrimaryFigures => {
  const current = currentFigures(targets)

  if (current !== null) {
    return {kind: 'current', figures: current}
  }

  return estimate === null ? {kind: 'none'} : {kind: 'estimate', figures: estimateDisplayFigures(estimate)}
}

const joinFragments = (fragments: string[]): string =>
  fragments.length === 0 ? MEAL_PLAN_VALUE_NONE : fragments.join(MEAL_PLAN_VALUE_SEPARATOR)

// A goal weight is entered as a whole number on the goal step, so it reads back as one. 'kg' is the only metric
// answer; an unanswered preference falls to pounds, which is the app's own default weight unit.
const goalWeightText = (goalWeightKg: number, unitPref: WeightUnitPref | null): string => {
  const isMetric = unitPref === 'kg'
  const value = isMetric ? goalWeightKg : kilogramsToPounds(goalWeightKg)

  return stringWithNamedParameters(MEAL_PLAN_WEIGHT_VALUE_TEMPLATE, {
    value: Math.round(value),
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
  const ordered = WIRE_SLOT_ORDER.flatMap(slot => mealTimes.filter(entry => entry.slot === slot))

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

const displayedSource = (primary: PrimaryFigures, targets: NutritionTargets | null): DisplayedTargetsSource => {
  if (primary.kind === 'none') {
    return 'unavailable'
  }

  if (primary.kind === 'estimate') {
    return 'estimate'
  }

  return isPlannerConfirmedTargets(targets) ? 'confirmed' : 'current'
}

// Staleness is not part of planner acceptance: a confirmed estimate stays the value generation uses until the
// user reconfirms (0.7.3), so a stale set is still 'confirmed' and merely earns the Recalculate link and the
// fresh figure beside it. Both states put the edit link in its recalculating form, which is the affordance that
// asks for the reconfirmation the Generate press no longer performs on the user's behalf.
const needsTargetReview = (targets: NutritionTargets | null): boolean =>
  targets !== null && (targets.stale || !isPlannerConfirmedTargets(targets))

const resolveBlockedReason = (
  primaryKind: PrimaryFigures['kind'],
  refusedByPlanner: boolean
): GenerateBlockedReason | null => {
  if (primaryKind === 'none') {
    return 'estimate_unavailable'
  }

  return refusedByPlanner ? 'targets_need_review' : null
}

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
 * That gives three outcomes rather than the two the screen had:
 *
 *  - saved figures the planner accepts (all four present, source not 'legacy'): generate against them, even
 *    when they are stale. A confirmed estimate is fixed once confirmed and generation keeps using it until the
 *    user reconfirms through the Recalculate link (0.7.3), so staleness alone neither saves nor blocks.
 *  - saved figures the planner refuses (legacy, incomplete, or a source this build cannot read): blocked as
 *    `targets_need_review`. Generation would answer 422 targets_missing / 409 targets_unconfirmed (0.5.2), so
 *    the press carries the user to the targets editor to confirm or replace those figures explicitly — it never
 *    silently saves the estimate over them.
 *  - no figures at all: blocked as `estimate_unavailable`, whose press goes to manual entry (0.2.5).
 *
 * Both revisions are the values as this screen currently reads them, and each save the sequence performs returns
 * a new one. The caller must thread the revision returned by one step into the next and into the navigation
 * params — a plan decided here cannot know them.
 */
export const planGenerateSequence = ({
  targets,
  estimate,
  preferences,
  startDate
}: GenerateSequenceInputs): GenerateSequencePlan => {
  const primary = resolvePrimaryFigures(targets, estimate)
  const showsOwnFigures = primary.kind === 'current'

  return {
    requiresTargetConfirmation: primary.kind === 'estimate',
    requiresStartDateSave: startDate !== preferences.reviewStartDate,
    estimateRevision: estimate === null ? null : estimate.estimateRevision,
    expectedTargetsRevision: targets === null ? NO_TARGETS_REVISION : targets.revision,
    expectedPreferencesRevision: preferences.revision,
    blockedReason: resolveBlockedReason(primary.kind, showsOwnFigures && !isPlannerConfirmedTargets(targets))
  }
}

/**
 * The estimated-confirmation body the sequence sends before generating, and null when the press confirms
 * nothing — which is every state where the card leads with the user's own figures, so this is also the proof
 * that a Generate press cannot rewrite a saved target the user was never shown as an estimate.
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

/**
 * The user's own saved figures whenever they exist, field by field; the estimate supplies the card only when the
 * server holds no target value at all. The two never mix in one card, so a set the planner will refuse is still
 * reviewed as the user's own numbers with the fresh estimate offered beside it as the recalculation, and a field
 * the server has no value for reads as absent — `missingTargetKeys` names it — rather than borrowing the
 * estimate's number for it.
 *
 * `freshEstimateCalories` is inferred: no frame draws it. It carries the recalculated figure that sits beside
 * saved targets the inputs or an outside write have moved past, which is the only state where the edit link
 * offers a recalculation rather than an edit — and because that state requires saved figures, the fresh figure
 * can never duplicate the headline. An 'unavailable' source has no figures at all — the screen shows the
 * estimate-unavailable card in place of the targets card — so the numeric fields read empty rather than nil.
 */
export const resolveDisplayedTargets = ({targets, estimate, preferences}: DisplayedTargetsInputs): DisplayedTargets => {
  const primary = resolvePrimaryFigures(targets, estimate)
  const figures = primary.kind === 'none' ? null : primary.figures
  const needsRecalculate = primary.kind === 'current' && needsTargetReview(targets)
  const isManualRoute = targets?.source === 'manual' || preferences.targetRoute === 'manual'

  return {
    source: displayedSource(primary, targets),
    cardLabel: isManualRoute ? MEAL_PLAN_CHOSEN_TARGETS_OVERLINE : MEAL_PLAN_DAILY_TARGETS_OVERLINE,
    calories: figures === null || figures.calories === null ? NO_FIGURE_TEXT : formatCalories(figures.calories),
    unitLabel: MEAL_PLAN_KCAL_UNIT,
    macros: figures === null ? [] : figures.macros,
    caption: MEAL_PLAN_TARGETS_CAPTION,
    editLabel: needsRecalculate ? MEAL_PLAN_RECALCULATE_LINK_TEXT : MEAL_PLAN_EDIT_LINK_TEXT,
    freshEstimateCalories: needsRecalculate && estimate !== null ? formatCalories(estimate.calories) : null,
    missingTargetKeys: figures === null ? ALL_TARGET_KEYS : figures.missing
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
 * The only disabled Generate states are a pending press and an estimate the confirmation still needs while it
 * loads (0.7.4). A settled block is not one of them: there is nothing left to wait for, so the CTA keeps the
 * drawn label and stays live, carrying the press to the recovery its reason names — manual entry for an
 * estimate that cannot be calculated (0.2.5), or the targets editor for saved figures generation would refuse —
 * instead of standing dead on the screen or quietly saving figures of its own choosing.
 */
export const resolveGenerateCtaState = ({plan, isEstimateLoading, isPending}: GenerateCtaInputs): GenerateCtaState => ({
  label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
  isEnabled: !isPending && !(plan.requiresTargetConfirmation && isEstimateLoading),
  action: plan.blockedReason === null ? 'generate' : CTA_ACTION_BY_BLOCKED_REASON[plan.blockedReason]
})
