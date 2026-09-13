import {
  CookingTimeLimitMin,
  Diet,
  Goal,
  MealSchedule,
  TargetRoute,
  WeightUnitPref
} from '@data/models/MealPlanPreferences'
import {kilogramsToPounds} from '@utility/UnitConversionUtility'

import {SummaryRow} from '@components/SummaryRows'

import {
  MEAL_PLAN_COOKING_TIME_CHIP_TEMPLATE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DIET_ROW_LABEL,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_GOAL_ROW_LABEL,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_MEALS_ROW_LABEL,
  MEAL_PLAN_SCHEDULE_LABELS,
  MEAL_PLAN_SUMMARY_GOAL_WITH_WEIGHT_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

export interface CookingTimeOption {
  readonly value: CookingTimeLimitMin
  readonly label: string
}

// Each limit is prep plus cooking time for one meal, never cooking alone: the planner compares this
// number with a recipe's total_minutes identically in eligibility, swap alternatives and flags, and
// this screen sends the number by itself. The table and its entries are frozen because they are
// module-global and handed straight to the chip row: rewriting or reordering one in place would
// change which limits this screen offers for the rest of the session.
const COOKING_TIME_LIMITS: readonly CookingTimeLimitMin[] = Object.freeze([15, 30, 45, 60] as const)

export const COOKING_TIME_OPTIONS: readonly CookingTimeOption[] = Object.freeze(
  COOKING_TIME_LIMITS.map(value =>
    Object.freeze({value, label: stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_CHIP_TEMPLATE, {minutes: value})})
  )
)

export const MIN_WEEKLY_BUDGET_USD: number = 1

export const MAX_WEEKLY_BUDGET_USD: number = 10000

const NON_DIGIT_PATTERN = /[^0-9]/g

const REDUNDANT_LEADING_ZERO_PATTERN = /^0+(?=\d)/

const WHOLE_DOLLARS_PATTERN = /^\d+$/

export const sanitizeBudgetInput = (text: string): string =>
  text.replace(NON_DIGIT_PATTERN, '').replace(REDUNDANT_LEADING_ZERO_PATTERN, '')

export const parseWeeklyBudget = (amountText: string): number | null => {
  const trimmed = amountText.trim()

  if (!WHOLE_DOLLARS_PATTERN.test(trimmed)) return null

  const amount = Number(trimmed)

  if (!Number.isInteger(amount) || amount < MIN_WEEKLY_BUDGET_USD || amount > MAX_WEEKLY_BUDGET_USD) return null

  return amount
}

export type CookingBudgetErrorCode = 'option_required' | 'budget_range'

export interface CookingBudgetValidation {
  cookingTimeError: CookingBudgetErrorCode | null
  budgetError: CookingBudgetErrorCode | null
  isValid: boolean
}

export const validateCookingTime = (cookingTimeLimitMin: CookingTimeLimitMin | null): CookingBudgetErrorCode | null =>
  cookingTimeLimitMin === null ? 'option_required' : null

// 'No budget preference' is the explicit "no amount" answer, so it settles the field and an unchecked
// box with an empty field is unanswered rather than optional — Figma 08 draws the checked box and the
// dimmed input as the state after that choice, not before it. Amounts are whole dollars: the server
// takes an integer 1-10,000, so a cent typed here would be rejected there.
export const validateWeeklyBudget = (
  noBudgetPreference: boolean,
  amountText: string
): CookingBudgetErrorCode | null => {
  if (noBudgetPreference) return null

  if (amountText.trim() === '') return 'option_required'

  return parseWeeklyBudget(amountText) === null ? 'budget_range' : null
}

export const validateCookingBudgetStep = (
  cookingTimeLimitMin: CookingTimeLimitMin | null,
  noBudgetPreference: boolean,
  amountText: string
): CookingBudgetValidation => {
  const cookingTimeError = validateCookingTime(cookingTimeLimitMin)
  const budgetError = validateWeeklyBudget(noBudgetPreference, amountText)

  return {cookingTimeError, budgetError, isValid: cookingTimeError === null && budgetError === null}
}

export type BudgetFieldState = 'default' | 'error' | 'disabled'

export const budgetFieldState = (
  noBudgetPreference: boolean,
  validation: CookingBudgetValidation | null
): BudgetFieldState => {
  if (noBudgetPreference) return 'disabled'

  return validation?.budgetError === 'budget_range' ? 'error' : 'default'
}

export interface PlanSummarySource {
  goal: Goal | null
  goalWeightKg: number | null
  diet: Diet | null
  mealSchedule: MealSchedule | null
  weightUnitPref: WeightUnitPref | null
}

// The setup steps that own the summary's values, as the provider's dirty map keys them.
export type PlanSummaryStep = 'goal' | 'body' | 'diet' | 'schedule'

// The draft plus the provenance that says whether its nulls are answers. Structural on purpose:
// this screen may not import the provider's util, and the provider's dirty record satisfies
// editedSteps as it stands.
export interface PlanSummaryDraft {
  draft: PlanSummarySource
  seeded: boolean
  editedSteps?: Partial<Record<PlanSummaryStep, boolean>>
}

const DEFAULT_WEIGHT_UNIT_PREF: WeightUnitPref = 'lb'

const WEIGHT_UNIT_LABELS: Readonly<Record<WeightUnitPref, string>> = Object.freeze({
  lb: MEAL_PLAN_LB_UNIT,
  kg: MEAL_PLAN_KG_UNIT
})

const SUMMARY_VALUE_STEPS: Readonly<Record<keyof PlanSummarySource, PlanSummaryStep>> = Object.freeze({
  goal: 'goal',
  goalWeightKg: 'goal',
  diet: 'diet',
  mealSchedule: 'schedule',
  weightUnitPref: 'body'
})

const WEIGHT_PRECISION_FACTOR = 10

const formatGoalWeight = (goalWeightKg: number, unit: WeightUnitPref): string => {
  const value = unit === 'lb' ? kilogramsToPounds(goalWeightKg) : goalWeightKg

  return String(Math.round(value * WEIGHT_PRECISION_FACTOR) / WEIGHT_PRECISION_FACTOR)
}

const showsGoalWeight = (goal: Goal, goalWeightKg: number | null): goalWeightKg is number =>
  goal !== 'maintain' && goalWeightKg !== null && Number.isFinite(goalWeightKg)

const goalRowValue = (goal: Goal, goalWeightKg: number | null, weightUnitPref: WeightUnitPref | null): string => {
  const goalLabel = MEAL_PLAN_GOAL_LABELS[goal]

  if (!showsGoalWeight(goal, goalWeightKg)) return goalLabel

  const unit = weightUnitPref ?? DEFAULT_WEIGHT_UNIT_PREF

  return stringWithNamedParameters(MEAL_PLAN_SUMMARY_GOAL_WITH_WEIGHT_TEMPLATE, {
    goal: goalLabel,
    weight: formatGoalWeight(goalWeightKg, unit),
    unit: WEIGHT_UNIT_LABELS[unit]
  })
}

// A step is answered once the draft was seeded from the saved preferences or the user edited that
// step in this session. Either way the draft now holds that step's answer, so a null in it is a
// value the user cleared — an optional goal weight removed on frame 02 — and must not be filled
// back in from the saved preferences the draft has already replaced.
const isStepAnswered = (state: PlanSummaryDraft, step: PlanSummaryStep): boolean =>
  state.seeded || state.editedSteps?.[step] === true

const answeredValue = <Value>(answered: boolean, draftValue: Value | null, savedValue?: Value | null): Value | null =>
  answered ? draftValue : (draftValue ?? savedValue ?? null)

const resolveSummarySource = (state: PlanSummaryDraft, preferences?: PlanSummarySource | null): PlanSummarySource => {
  const {draft} = state
  const goalAnswered = isStepAnswered(state, SUMMARY_VALUE_STEPS.goal)

  return {
    goal: answeredValue(goalAnswered, draft.goal, preferences?.goal),
    goalWeightKg: answeredValue(goalAnswered, draft.goalWeightKg, preferences?.goalWeightKg),
    diet: answeredValue(isStepAnswered(state, SUMMARY_VALUE_STEPS.diet), draft.diet, preferences?.diet),
    mealSchedule: answeredValue(
      isStepAnswered(state, SUMMARY_VALUE_STEPS.mealSchedule),
      draft.mealSchedule,
      preferences?.mealSchedule
    ),
    weightUnitPref: answeredValue(
      isStepAnswered(state, SUMMARY_VALUE_STEPS.weightUnitPref),
      draft.weightUnitPref,
      preferences?.weightUnitPref
    )
  }
}

export const buildPlanSummaryRows = (state: PlanSummaryDraft, preferences?: PlanSummarySource | null): SummaryRow[] => {
  const {goal, goalWeightKg, diet, mealSchedule, weightUnitPref} = resolveSummarySource(state, preferences)
  const rows: SummaryRow[] = []

  if (goal !== null) {
    rows.push({label: MEAL_PLAN_GOAL_ROW_LABEL, value: goalRowValue(goal, goalWeightKg, weightUnitPref)})
  }

  if (diet !== null) {
    rows.push({label: MEAL_PLAN_DIET_ROW_LABEL, value: MEAL_PLAN_DIET_LABELS[diet]})
  }

  if (mealSchedule !== null) {
    rows.push({label: MEAL_PLAN_MEALS_ROW_LABEL, value: MEAL_PLAN_SCHEDULE_LABELS[mealSchedule]})
  }

  return rows
}

export interface WizardProgress {
  step: number
  totalSteps: number
}

export const cookingBudgetWizardProgress = (targetRoute: TargetRoute | null): WizardProgress =>
  targetRoute === 'manual' ? {step: 6, totalSteps: 6} : {step: 7, totalSteps: 7}
