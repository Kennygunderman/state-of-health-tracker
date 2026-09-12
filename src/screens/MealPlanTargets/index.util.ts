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

export type DisplayedTargetsSource = 'confirmed' | 'estimate' | 'unavailable'

export type GenerateBlockedReason = 'estimate_unavailable'

export type AnswerRowEditStep = 'goal' | 'diet' | 'dislikes' | 'schedule' | 'cooking'

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
}

interface TargetFigures {
  calories: number
  protein: number
  carbs: number
  fat: number
}

// The revision a user with no preferences row carries, which is what the first target save must expect.
export const NO_TARGETS_REVISION: number = 0

const MACRO_KEYS: DisplayedMacroKey[] = ['protein', 'carbs', 'fat']

// The slots in the order the wire carries them. The day view orders meals by time, but a review row lists the
// schedule the user set, and a snack at 15:30 belongs after dinner in that list rather than between lunch and
// dinner — so the row is built from this order and never from the clock.
const WIRE_SLOT_ORDER: MealTimeEntry['slot'][] = ['breakfast', 'lunch', 'dinner', 'snack']

const PLAN_LAST_DAY_OFFSET = 6

const NO_FIGURE_TEXT = ''

const labelFrom = (labels: Record<string, string>, code: string): string | undefined => labels[code]

const isConfirmedSource = (targets: NutritionTargets | null): targets is NutritionTargets =>
  targets !== null && targets.complete && targets.source !== 'legacy'

const isConfirmedAndFresh = (targets: NutritionTargets | null): boolean => isConfirmedSource(targets) && !targets.stale

// `complete` is the server's promise that all four columns are set; the quartet is still read field by field so
// a response that contradicts it falls back to the estimate instead of publishing a fabricated zero.
const confirmedFigures = (targets: NutritionTargets | null): TargetFigures | null => {
  if (!isConfirmedSource(targets) || targets.targets === null) {
    return null
  }

  const {calories, protein, carbs, fat} = targets.targets

  if (calories === null || protein === null || carbs === null || fat === null) {
    return null
  }

  return {calories, protein, carbs, fat}
}

const estimateFigures = (estimate: NutritionTargetEstimate): TargetFigures => ({
  calories: estimate.calories,
  protein: estimate.protein,
  carbs: estimate.carbs,
  fat: estimate.fat
})

// MACRO_KEYS is a closed local union the label map covers in full, so it is indexed directly; labelFrom exists
// for the preference codes below, which arrive from the server and may name something this build cannot label.
const macroRows = (figures: TargetFigures): DisplayedMacro[] =>
  MACRO_KEYS.map(key => ({key, label: MEAL_PLAN_MACRO_LABELS[key], valueText: formatMacroGrams(figures[key])}))

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

const displayedSource = (hasConfirmedFigures: boolean, hasAnyFigures: boolean): DisplayedTargetsSource => {
  if (!hasAnyFigures) {
    return 'unavailable'
  }

  return hasConfirmedFigures ? 'confirmed' : 'estimate'
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
 * `freshEstimateCalories` is inferred: no frame draws it. It carries the recalculated figure that sits beside a
 * confirmed target the inputs have since moved past, which is the only state where the edit link offers a
 * recalculation rather than an edit. An 'unavailable' source has no figures at all — the screen shows the
 * estimate-unavailable card in place of the targets card — so the numeric fields read empty rather than nil.
 */
export const resolveDisplayedTargets = ({targets, estimate, preferences}: DisplayedTargetsInputs): DisplayedTargets => {
  const confirmed = confirmedFigures(targets)
  const figures = confirmed ?? (estimate === null ? null : estimateFigures(estimate))
  const needsRecalculate = targets !== null && (targets.stale || targets.source === 'legacy')
  const isManualRoute = targets?.source === 'manual' || preferences.targetRoute === 'manual'

  return {
    source: displayedSource(confirmed !== null, figures !== null),
    cardLabel: isManualRoute ? MEAL_PLAN_CHOSEN_TARGETS_OVERLINE : MEAL_PLAN_DAILY_TARGETS_OVERLINE,
    calories: figures === null ? NO_FIGURE_TEXT : formatCalories(figures.calories),
    unitLabel: MEAL_PLAN_KCAL_UNIT,
    macros: figures === null ? [] : macroRows(figures),
    caption: MEAL_PLAN_TARGETS_CAPTION,
    editLabel: needsRecalculate ? MEAL_PLAN_RECALCULATE_LINK_TEXT : MEAL_PLAN_EDIT_LINK_TEXT,
    freshEstimateCalories: needsRecalculate && estimate !== null ? formatCalories(estimate.calories) : null
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

export const resolveGenerateCtaState = ({plan, isEstimateLoading, isPending}: GenerateCtaInputs): GenerateCtaState => {
  const isEstimateBlocking = isEstimateLoading || plan.blockedReason === 'estimate_unavailable'

  return {
    label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
    isEnabled: !isPending && !(plan.requiresTargetConfirmation && isEstimateBlocking)
  }
}
