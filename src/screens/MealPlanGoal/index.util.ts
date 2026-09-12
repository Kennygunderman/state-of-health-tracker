import {Goal, PaceLbPerWeek, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {isSupportedBodyWeightInUnit, poundsToKilograms} from '@utility/UnitConversionUtility'

import {
  MEAL_PLAN_PACE_DEFICIT_TEMPLATE,
  MEAL_PLAN_PACE_RATE_TEMPLATE,
  MEAL_PLAN_PACE_RECOMMENDED_SUFFIX,
  MEAL_PLAN_PACE_SURPLUS_TEMPLATE
} from '@constants/strings'

export type MealPlanGoalErrorCode =
  | 'goal_required'
  | 'pace_required'
  | 'goal_weight_invalid'
  | 'goal_weight_out_of_range'
  | 'goal_weight_wrong_side'

export interface MealPlanGoalFields {
  goal: Goal | null
  goalWeightText: string
  paceLbPerWeek: PaceLbPerWeek | null
}

export interface MealPlanGoalErrors {
  goal: MealPlanGoalErrorCode | null
  goalWeight: MealPlanGoalErrorCode | null
  pace: MealPlanGoalErrorCode | null
}

export interface MealPlanGoalValidation {
  errors: MealPlanGoalErrors
  isValid: boolean
  goalWeightKg: number | null
}

export interface PaceOption {
  value: PaceLbPerWeek
  label: string
  subcopy: string
}

export interface MealPlanGoalContext {
  currentWeightKg: number | null
  unit: WeightUnitPref
}

interface GoalDirection {
  paceSubcopyTemplate: string
  goalWeightBelowCurrent: boolean
}

interface GoalWeightResult {
  error: MealPlanGoalErrorCode | null
  kilograms: number | null
}

// Maintain answers no direction question: it hides both the goal-weight field and the pace section (Figma
// note 46:252) and has neither a deficit nor a surplus to describe. Holding that direction in one Record
// over Goal keeps visibility, the pace sub-copy and the goal-side comparison from drifting apart, and makes
// a fourth goal member a compile error here rather than a silently hidden control.
const GOAL_DIRECTIONS: Record<Goal, GoalDirection | null> = {
  lose: {paceSubcopyTemplate: MEAL_PLAN_PACE_DEFICIT_TEMPLATE, goalWeightBelowCurrent: true},
  maintain: null,
  gain: {paceSubcopyTemplate: MEAL_PLAN_PACE_SURPLUS_TEMPLATE, goalWeightBelowCurrent: false}
}

const PACE_VALUES: readonly PaceLbPerWeek[] = [0.5, 1, 1.5]

const RECOMMENDED_PACE: PaceLbPerWeek = 1

// 3,500 kcal per pound of body fat spread over seven days, so a pound a week is a 500 kcal daily
// adjustment — the figures the sub-copy quotes and the server's own estimate applies.
const DAILY_KCAL_PER_LB_PER_WEEK = 500

const PACE_PLACEHOLDER = '{pace}'
const CALORIES_PLACEHOLDER = '{calories}'
const GOAL_WEIGHT_PATTERN = /^\d+(\.\d*)?$|^\.\d+$/
const GOAL_WEIGHT_ROUNDING_FACTOR = 10

const goalDirection = (goal: Goal | null): GoalDirection | null => (goal === null ? null : GOAL_DIRECTIONS[goal])

const formatPaceLabel = (pace: PaceLbPerWeek): string =>
  MEAL_PLAN_PACE_RATE_TEMPLATE.replace(PACE_PLACEHOLDER, String(pace))

const formatPaceSubcopy = (pace: PaceLbPerWeek, template: string): string => {
  const sentence = template.replace(CALORIES_PLACEHOLDER, String(pace * DAILY_KCAL_PER_LB_PER_WEEK))

  return pace === RECOMMENDED_PACE ? `${sentence}${MEAL_PLAN_PACE_RECOMMENDED_SUFFIX}` : sentence
}

export const isPaceVisible = (goal: Goal | null): boolean => goalDirection(goal) !== null

export const isGoalWeightVisible = (goal: Goal | null): boolean => isPaceVisible(goal)

export const parseGoalWeightInput = (text: string): number | null => {
  const normalized = text.replace(',', '.').trim()

  if (!GOAL_WEIGHT_PATTERN.test(normalized)) {
    return null
  }

  const parsed = parseFloat(normalized)

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return Math.round(parsed * GOAL_WEIGHT_ROUNDING_FACTOR) / GOAL_WEIGHT_ROUNDING_FACTOR
}

export const goalWeightToKilograms = (value: number, unit: WeightUnitPref): number =>
  unit === 'lb' ? poundsToKilograms(value) : value

/**
 * A missing currentWeightKg is not a failure: the body step (03) is answered after this screen, so on a
 * first pass there is nothing to compare against and the side check must not block the user.
 */
export const isGoalWeightOnGoalSide = (
  goalWeightKg: number,
  currentWeightKg: number | null,
  goal: Goal | null
): boolean => {
  const direction = goalDirection(goal)

  if (direction === null || currentWeightKg === null) {
    return true
  }

  return direction.goalWeightBelowCurrent ? goalWeightKg < currentWeightKg : goalWeightKg > currentWeightKg
}

export const paceOptionsForGoal = (goal: Goal | null): PaceOption[] => {
  const direction = goalDirection(goal)

  if (direction === null) {
    return []
  }

  return PACE_VALUES.map(value => ({
    value,
    label: formatPaceLabel(value),
    subcopy: formatPaceSubcopy(value, direction.paceSubcopyTemplate)
  }))
}

// A hidden control and an untouched optional field answer alike — no error, no value — so a goal weight
// typed before switching to Maintain is discarded rather than validated or sent.
const resolveGoalWeight = (fields: MealPlanGoalFields, context: MealPlanGoalContext): GoalWeightResult => {
  if (!isGoalWeightVisible(fields.goal) || fields.goalWeightText.trim() === '') {
    return {error: null, kilograms: null}
  }

  const parsed = parseGoalWeightInput(fields.goalWeightText)

  if (parsed === null) {
    return {error: 'goal_weight_invalid', kilograms: null}
  }

  if (!isSupportedBodyWeightInUnit(parsed, context.unit)) {
    return {error: 'goal_weight_out_of_range', kilograms: null}
  }

  const kilograms = goalWeightToKilograms(parsed, context.unit)

  if (!isGoalWeightOnGoalSide(kilograms, context.currentWeightKg, fields.goal)) {
    return {error: 'goal_weight_wrong_side', kilograms: null}
  }

  return {error: null, kilograms}
}

export const validateMealPlanGoal = (
  fields: MealPlanGoalFields,
  context: MealPlanGoalContext
): MealPlanGoalValidation => {
  const goalWeight = resolveGoalWeight(fields, context)
  const errors: MealPlanGoalErrors = {
    goal: fields.goal === null ? 'goal_required' : null,
    goalWeight: goalWeight.error,
    pace: isPaceVisible(fields.goal) && fields.paceLbPerWeek === null ? 'pace_required' : null
  }

  return {
    errors,
    isValid: Object.values(errors).every(error => error === null),
    goalWeightKg: goalWeight.kilograms
  }
}
