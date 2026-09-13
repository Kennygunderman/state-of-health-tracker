import type {MealPlanPreferences, MealTimeEntry, WeightUnitPref} from '@data/models/MealPlanPreferences'
import type {NutritionTargetEstimate, NutritionTargets} from '@data/models/NutritionTargets'
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

export type GenerateBlockedReason = 'estimate_unavailable'

export type AnswerRowEditStep = 'goal' | 'diet' | 'dislikes' | 'schedule' | 'cooking'

// What the live Generate press does. 'manual_targets' is the recovery the estimate-unavailable state offers
// (09b manual entry, 0.2.5); the card copy for that state belongs to resolveDisplayedTargets' 'unavailable'.
export type GenerateCtaAction = 'generate' | 'manual_targets'

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

// The revision a user with no preferences row carries, which is what the first target save must expect.
export const NO_TARGETS_REVISION: number = 0

const MACRO_KEYS: DisplayedMacroKey[] = ['protein', 'carbs', 'fat']

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

// What generation will accept: the planner's own gate (`complete && source !== 'legacy'`, else 422
// targets_missing / 409 targets_unconfirmed). Deliberately not what the card displays — see currentFigures.
const isPlanningConfirmed = (targets: NutritionTargets | null): targets is NutritionTargets =>
  targets !== null && targets.complete && targets.source !== 'legacy'

const isConfirmedAndFresh = (targets: NutritionTargets | null): boolean =>
  isPlanningConfirmed(targets) && !targets.stale

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

const displayedSource = (
  hasCurrentFigures: boolean,
  isAcceptedByPlanner: boolean,
  hasAnyFigures: boolean
): DisplayedTargetsSource => {
  if (!hasAnyFigures) {
    return 'unavailable'
  }

  if (!hasCurrentFigures) {
    return 'estimate'
  }

  return isAcceptedByPlanner ? 'confirmed' : 'current'
}

// Staleness is not part of this: a confirmed estimate stays the value generation uses until the user reconfirms
// (0.7.3), so a stale set is still 'confirmed' and merely earns the Recalculate link and the fresh figure beside.
const needsTargetReview = (targets: NutritionTargets | null): boolean =>
  targets !== null && (targets.stale || !isPlanningConfirmed(targets))

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
  const requiresTargetConfirmation = !isConfirmedAndFresh(targets)

  return {
    requiresTargetConfirmation,
    requiresStartDateSave: startDate !== preferences.reviewStartDate,
    estimateRevision: estimate === null ? null : estimate.estimateRevision,
    expectedTargetsRevision: targets === null ? NO_TARGETS_REVISION : targets.revision,
    expectedPreferencesRevision: preferences.revision,
    blockedReason: requiresTargetConfirmation && estimate === null ? 'estimate_unavailable' : null
  }
}

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
  const current = currentFigures(targets)
  const figures = current ?? (estimate === null ? null : estimateDisplayFigures(estimate))
  const needsRecalculate = current !== null && needsTargetReview(targets)
  const isManualRoute = targets?.source === 'manual' || preferences.targetRoute === 'manual'

  return {
    source: displayedSource(current !== null, isPlanningConfirmed(targets), figures !== null),
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
 * loads (0.7.4). A settled `estimate_unavailable` is not one of them: there is nothing left to wait for, so the
 * CTA stays live and carries the user to manual entry (0.2.5) instead of standing dead on the screen.
 */
export const resolveGenerateCtaState = ({plan, isEstimateLoading, isPending}: GenerateCtaInputs): GenerateCtaState => ({
  label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
  isEnabled: !isPending && !(plan.requiresTargetConfirmation && isEstimateLoading),
  action: plan.blockedReason === 'estimate_unavailable' ? 'manual_targets' : 'generate'
})
