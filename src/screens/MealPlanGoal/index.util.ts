import {Goal, PaceLbPerWeek, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {isSupportedBodyWeightInUnit, poundsToKilograms} from '@utility/UnitConversionUtility'

import {
  MEAL_PLAN_GOAL_TITLE,
  MEAL_PLAN_PACE_DEFICIT_SUBCOPY,
  MEAL_PLAN_PACE_HEADER,
  MEAL_PLAN_PACE_RATE_TEMPLATE,
  MEAL_PLAN_PACE_RECOMMENDED_SUFFIX,
  MEAL_PLAN_PACE_SURPLUS_SUBCOPY
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

export interface MealPlanGoalHeadings {
  /** The question the screen asks, which has to be one every control still on screen can answer. */
  headline: string
  /** Whether the pace section draws its own label under that headline. */
  isPaceLabelVisible: boolean
}

interface GoalDirection {
  paceSubcopy: Readonly<Record<PaceLbPerWeek, string>>
  goalWeightBelowCurrent: boolean
}

interface GoalWeightResult {
  error: MealPlanGoalErrorCode | null
  kilograms: number | null
}

// Maintain answers no direction question: it hides both the goal-weight field and the pace section (Figma
// note 46:252) and has neither a deficit nor a surplus to describe. Holding that direction in one Record
// over Goal keeps visibility, the pace sub-copy and the goal-side comparison from drifting apart, and makes
// a fourth goal member a compile error here. The Record's index type is no runtime guarantee, though — an
// out-of-type code reads back `undefined`, which every `!== null` consumer would take for a direction — so
// `isGoalMember` tests membership and the lookup falls back to no direction.
const GOAL_DIRECTIONS: Record<Goal, GoalDirection | null> = {
  lose: {paceSubcopy: MEAL_PLAN_PACE_DEFICIT_SUBCOPY, goalWeightBelowCurrent: true},
  maintain: null,
  gain: {paceSubcopy: MEAL_PLAN_PACE_SURPLUS_SUBCOPY, goalWeightBelowCurrent: false}
}

const PACE_VALUES: readonly PaceLbPerWeek[] = [0.5, 1, 1.5]

const RECOMMENDED_PACE: PaceLbPerWeek = 1

const PACE_PLACEHOLDER = '{pace}'
const GOAL_WEIGHT_PATTERN = /^\d+(\.\d*)?$|^\.\d+$/
const GOAL_WEIGHT_ROUNDING_FACTOR = 10

// `Object.prototype.hasOwnProperty.call` rather than `in`: an inherited member name indexes the table to a
// function, or to Object.prototype itself, and neither is nullish.
const isGoalMember = (goal: Goal | null): goal is Goal =>
  goal !== null && Object.prototype.hasOwnProperty.call(GOAL_DIRECTIONS, goal)

const goalDirection = (goal: Goal | null): GoalDirection | null =>
  isGoalMember(goal) ? (GOAL_DIRECTIONS[goal] ?? null) : null

const formatPaceLabel = (pace: PaceLbPerWeek): string =>
  MEAL_PLAN_PACE_RATE_TEMPLATE.replace(PACE_PLACEHOLDER, String(pace))

// The daily calorie figure a pace implies belongs to the server's pace policy, which the estimate endpoint
// applies; this screen reads the sentence that policy approved rather than recomputing it, so onboarding
// copy cannot disagree with the targets the same user is shown next. Only the recommended marker is added
// here, which is presentation rather than policy.
const formatPaceSubcopy = (pace: PaceLbPerWeek, paceSubcopy: Readonly<Record<PaceLbPerWeek, string>>): string => {
  const sentence = paceSubcopy[pace]

  return pace === RECOMMENDED_PACE ? `${sentence}${MEAL_PLAN_PACE_RECOMMENDED_SUFFIX}` : sentence
}

/**
 * The screen's headline and the pace section's label, decided together.
 *
 * The "Activity and pace" settings row reopens this screen with `scope: 'pace'` (AAP 0.7.4), which suppresses
 * the goal option cards and the goal-weight control: the stored goal is re-sent untouched and the pace is the
 * only answer being edited. "What's your goal?" is then a question with no answer control on screen, so the
 * pace question becomes the headline, in the wording this feature already approved for it —
 * `MEAL_PLAN_PACE_HEADER`, which the section label below the headline carries in the setup flow.
 *
 * The two travel in one derivation because promoting that constant makes the section label a second copy of
 * the headline, two lines apart. Only the pace-scope route drops the label; the setup flow keeps asking the
 * goal question and keeps labelling its pace section exactly as Figma 02 draws it (`46:205`).
 */
export const resolveMealPlanGoalHeadings = (isPaceScope: boolean): MealPlanGoalHeadings =>
  isPaceScope
    ? {headline: MEAL_PLAN_PACE_HEADER, isPaceLabelVisible: false}
    : {headline: MEAL_PLAN_GOAL_TITLE, isPaceLabelVisible: true}

export const isPaceVisible = (goal: Goal | null): boolean => goalDirection(goal) !== null

// Only an answered Maintain hides the goal weight (Figma note 46:252); an unanswered goal is not that
// answer, so the optional field opens present and empty, as AAP 0.7.4's first-entry state for 02 requires
// ("no goal, no pace; goal weight empty") — pace is the conditional section here, not the goal weight.
// Reading the exclusion out of GOAL_DIRECTIONS rather than comparing against the 'maintain' literal keeps
// the record's promise that a fourth Goal member becomes a compile error rather than a hidden control.
export const isGoalWeightVisible = (goal: Goal | null): boolean => goal === null || goalDirection(goal) !== null

/**
 * The goal weight as a number in the unit on screen, to a tenth, and null where the entry is not one.
 *
 * Two different failures share that null: an entry the numeric pattern rejects, and one that reads as a
 * number at or below zero. The pair is deliberate — the field takes a decimal in either unit, so a refused
 * entry has no single wrong character to point at, and both are answered by typing a positive number — and
 * `MEAL_PLAN_GOAL_WEIGHT_INVALID_ERROR_TEXT` is worded to be true of both. It used to name only the
 * magnitude, which told a user who had typed '17o' to raise a number they had never entered.
 */
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
    subcopy: formatPaceSubcopy(value, direction.paceSubcopy)
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
    goal: isGoalMember(fields.goal) ? null : 'goal_required',
    goalWeight: goalWeight.error,
    pace: isPaceVisible(fields.goal) && fields.paceLbPerWeek === null ? 'pace_required' : null
  }

  return {
    errors,
    isValid: Object.values(errors).every(error => error === null),
    goalWeightKg: goalWeight.kilograms
  }
}
