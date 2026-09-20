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
  MEAL_PLAN_SCHEDULE_SUMMARY_LABELS,
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

const REDUNDANT_LEADING_ZERO_PATTERN = /^0+(?=\d)/

const WHOLE_DOLLARS_PATTERN = /^\d+$/

// '1,250' and '10,000' are group separators inside a whole-dollar amount; '1,25' and '12,3456' are not an
// amount at all, so the separator is only presentation where the grouping itself is well formed.
const GROUPED_DOLLARS_PATTERN = /^\d{1,3}(,\d{3})+$/

const CURRENCY_PREFIX_PATTERN = /^\$\s*/

const GROUP_SEPARATOR_PATTERN = /,/g

/**
 * The amount as the field stores it: whole dollars, no currency sign, no separators.
 *
 * Only presentation is removed — the '$' the screen draws, surrounding space and well-formed group
 * separators. An entry carrying anything else (a decimal point, a sign, prose, a malformed group) is
 * refused and `previous` is returned unchanged, because deleting those characters would leave a
 * perfectly valid amount the user never typed: '12.50' would be saved as 1250 and '-120' as 120, and
 * neither the range check here nor the server's integer 1-10,000 could tell that had happened.
 * Callers pass the field's current value as `previous` so a refused keystroke or paste keeps it.
 */
export const sanitizeBudgetInput = (text: string, previous: string = ''): string => {
  const entry = text.trim().replace(CURRENCY_PREFIX_PATTERN, '').trim()

  if (entry === '') return ''

  if (!WHOLE_DOLLARS_PATTERN.test(entry) && !GROUPED_DOLLARS_PATTERN.test(entry)) return previous

  return entry.replace(GROUP_SEPARATOR_PATTERN, '').replace(REDUNDANT_LEADING_ZERO_PATTERN, '')
}

// The whole-dollar amount an entry denotes, before any bound is applied, and null where the entry is not an
// amount at all. Split out because `parseWeeklyBudget` answers "is this a usable amount" with one null and
// the field's messages need to know which side of the range was broken: the same null covers '0' and '10001',
// whose remedies are opposite.
const weeklyBudgetAmount = (trimmed: string): number | null => {
  if (!WHOLE_DOLLARS_PATTERN.test(trimmed)) return null

  const amount = Number(trimmed)

  return Number.isInteger(amount) ? amount : null
}

export const parseWeeklyBudget = (amountText: string): number | null => {
  const amount = weeklyBudgetAmount(amountText.trim())

  if (amount === null || amount < MIN_WEEKLY_BUDGET_USD || amount > MAX_WEEKLY_BUDGET_USD) return null

  return amount
}

// One code per remedy, which is the whole reason there are four rather than two. 'option_required' belongs to
// the chip group, where choosing an option is the remedy; the three budget codes belong to the amount field,
// where it is not — an empty field needs an amount or the preference box, an amount at the bottom of the
// range needs a larger number, and one over the top of it needs a smaller one.
export type CookingBudgetErrorCode = 'option_required' | 'budget_required' | 'budget_range' | 'budget_above_max'

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
//
// The unanswered field reports its own code rather than the shared option-group one. Both rows on this
// screen render from the same copy table, so borrowing that code printed 'Choose an option to continue'
// twice on frame 08 — under the chips, where it is the remedy, and under a number field, where there is no
// option to choose. The two range codes are likewise distinct: an entry over the maximum is not fixed by
// raising it, which is what the single range message told the user to do.
//
// An entry that is not a whole-dollar amount at all reports 'budget_range' with it, because there is no
// ceiling to name for something that is not a number. `sanitizeBudgetInput` already refuses those
// characters at the keystroke, so the field can only hold digits and that arm is reachable only by calling
// this validator directly.
export const validateWeeklyBudget = (
  noBudgetPreference: boolean,
  amountText: string
): CookingBudgetErrorCode | null => {
  if (noBudgetPreference) return null

  const trimmed = amountText.trim()

  if (trimmed === '') return 'budget_required'

  const amount = weeklyBudgetAmount(trimmed)

  if (amount === null || amount < MIN_WEEKLY_BUDGET_USD) return 'budget_range'

  return amount > MAX_WEEKLY_BUDGET_USD ? 'budget_above_max' : null
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

// The codes that draw the field itself as refused. Both ends of the range qualify: the value in the box is
// the thing that is wrong, so the box says so. An unanswered field does not — nothing in it was refused, and
// 'budget_required' only asks for an answer — so it keeps the default treatment and states its message in
// the row beneath, which is the behaviour this screen already had for the empty field.
const REFUSED_BUDGET_FIELD_CODES: readonly CookingBudgetErrorCode[] = Object.freeze([
  'budget_range',
  'budget_above_max'
])

export const budgetFieldState = (
  noBudgetPreference: boolean,
  validation: CookingBudgetValidation | null
): BudgetFieldState => {
  if (noBudgetPreference) return 'disabled'

  const code = validation?.budgetError ?? null

  return code !== null && REFUSED_BUDGET_FIELD_CODES.includes(code) ? 'error' : 'default'
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
//
// fallbackWeightUnitPref is required because a goal weight is stored in kilograms and can only be shown
// in the unit it was answered in. The manual route reaches this card with a goal weight but no body step,
// so neither the draft nor the saved row carries a unit, and guessing one here would relabel the number.
export interface PlanSummaryDraft {
  draft: PlanSummarySource
  seeded: boolean
  editedSteps?: Partial<Record<PlanSummaryStep, boolean>>
  fallbackWeightUnitPref: WeightUnitPref
}

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

const goalRowValue = (goal: Goal, goalWeightKg: number | null, unit: WeightUnitPref): string => {
  const goalLabel = MEAL_PLAN_GOAL_LABELS[goal]

  if (!showsGoalWeight(goal, goalWeightKg)) return goalLabel

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
    rows.push({
      label: MEAL_PLAN_GOAL_ROW_LABEL,
      value: goalRowValue(goal, goalWeightKg, weightUnitPref ?? state.fallbackWeightUnitPref)
    })
  }

  if (diet !== null) {
    rows.push({label: MEAL_PLAN_DIET_ROW_LABEL, value: MEAL_PLAN_DIET_LABELS[diet]})
  }

  // The card reads the schedule as a count per day ('3 per day'), not as the option label it was chosen
  // with ('3 meals'), so it takes the summary copy rather than the option copy.
  if (mealSchedule !== null) {
    rows.push({label: MEAL_PLAN_MEALS_ROW_LABEL, value: MEAL_PLAN_SCHEDULE_SUMMARY_LABELS[mealSchedule]})
  }

  return rows
}

export interface WizardProgress {
  step: number
  totalSteps: number
}

export const cookingBudgetWizardProgress = (targetRoute: TargetRoute | null): WizardProgress =>
  targetRoute === 'manual' ? {step: 6, totalSteps: 6} : {step: 7, totalSteps: 7}
