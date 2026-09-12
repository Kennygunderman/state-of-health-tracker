import {AffectedMeal, MealPlanSummary} from '@data/models/MealPlan'
import {
  DislikedFoodSummary,
  HeightUnitPref,
  MealPlanPreferences,
  MealTimeEntry,
  SetupStep,
  WeightUnitPref
} from '@data/models/MealPlanPreferences'
import {NutritionTargets} from '@data/models/NutritionTargets'
import type {RootStackParamList, StepMode, TargetsReturn} from '@navigation/types'
import {Theme} from '@styles/theme'
import {formatPlanDayLabel, formatSlotTime, parseDayKey} from '@utility/MealPlanDateUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'
import {centimetersToFeetInches, formatHeightImperial, kilogramsToPounds} from '@utility/UnitConversionUtility'
import {format} from 'date-fns'

import type {SummaryRow} from '@components/SummaryRows'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ACTIVITY_LEVEL_LABELS,
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_BUDGET_VALUE_TEMPLATE,
  MEAL_PLAN_CM_UNIT,
  MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL,
  MEAL_PLAN_PACE_LABELS,
  MEAL_PLAN_SCHEDULE_LABELS,
  MEAL_SLOT_SENTENCE_LABELS,
  PLAN_REGENERATE_DIALOG_BODY_TEMPLATE,
  PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE,
  PLAN_REGENERATE_ENTRIES_KEPT_TEMPLATE,
  PLAN_REGENERATE_GROCERY_EMPTY_TEXT,
  PLAN_REGENERATE_GROCERY_LIST_LABEL,
  PLAN_REGENERATE_GROCERY_REBUILT_TEXT,
  PLAN_REGENERATE_LOGGED_FOOD_LABEL,
  PLAN_REGENERATE_MEALS_REPLACED_TEMPLATE,
  PLAN_REGENERATE_NOTHING_LOGGED_TEXT,
  PLAN_REGENERATE_ONE_ENTRY_KEPT_TEXT,
  PLAN_REGENERATE_PLANNED_MEALS_LABEL,
  PLAN_SETTINGS_ACTIVITY_AND_PACE_LABEL,
  PLAN_SETTINGS_COOKING_AND_BUDGET_LABEL,
  PLAN_SETTINGS_DIET_AND_ALLERGIES_LABEL,
  PLAN_SETTINGS_FLAGGED_BANNER_BODY_SINGULAR_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_BANNER_BODY_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON,
  PLAN_SETTINGS_FLAGGED_BANNER_TITLE_SINGULAR_LABELS,
  PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_MEALS_CONJUNCTION,
  PLAN_SETTINGS_FLAGGED_MEAL_TEMPLATE,
  PLAN_SETTINGS_GOAL_AND_BODY_LABEL,
  PLAN_SETTINGS_MACRO_TRIPLE_TEMPLATE,
  PLAN_SETTINGS_MEAL_SCHEDULE_LABEL,
  PLAN_SETTINGS_NOT_SET_VALUE,
  PLAN_SETTINGS_NUTRITION_TARGETS_LABEL,
  PLAN_SETTINGS_REVIEW_AFFECTED_BUTTON_TEXT,
  stringWithNamedParameters
} from '@constants/strings'

export type PlanSettingsRowKey =
  | 'goalAndBody'
  | 'activityAndPace'
  | 'nutritionTargets'
  | 'dietAndAllergies'
  | 'dislikedIngredients'
  | 'mealSchedule'
  | 'cookingAndBudget'

export interface PlanSettingsTargetsParams {
  mode: 'edit'
  returnTo: TargetsReturn
}

export type PlanSettingsRouteParams = StepMode | PlanSettingsTargetsParams | undefined

// Where a row leads, not a way of going there: navigating is index.tsx's job, so this carries route params and
// never a navigation object or a callback.
export interface PlanSettingsNavigationTarget {
  route: keyof RootStackParamList
  params: PlanSettingsRouteParams
}

export interface PlanSettingsRow {
  key: PlanSettingsRowKey
  label: string
  value: string
  // The ':step' token the destination saves under, and null for Nutrition targets, which writes through the
  // targets route instead of a preference step.
  editStep: SetupStep | null
  target: PlanSettingsNavigationTarget
}

export interface PlanSettingsBanner {
  title: string
  body: string
  actionLabel: string
}

export interface PlanSettingsFooterInput {
  hasIncompatibilities: boolean
  targetsStale: boolean
}

type PlanTargetValues = NutritionTargets['targets']

const VALUE_SEPARATOR = ' \u00b7 '

const LIST_SEPARATOR = ', '

const UNIT_SEPARATOR = ' '

const WEEKDAY_FORMAT = 'EEEE'

const WEIGHT_PRECISION_FACTOR = 10

const SINGLE_ITEM = 1

const ALLERGEN_NONE = 'none'

const withUnit = (value: string, unit: string): string => `${value}${UNIT_SEPARATOR}${unit}`

const toOneDecimal = (value: number): string =>
  String(Math.round(value * WEIGHT_PRECISION_FACTOR) / WEIGHT_PRECISION_FACTOR)

// A row states the parts it has and reads 'Not set' only when it has none, so a half-answered profile still
// renders seven readable rows rather than seven empty ones.
const joinValueParts = (parts: (string | null)[]): string => {
  const present = parts.filter((part): part is string => part !== null && part.length > 0)

  return present.length > 0 ? present.join(VALUE_SEPARATOR) : PLAN_SETTINGS_NOT_SET_VALUE
}

// A code outside the mapped set resolves to null rather than to itself, so a value from a newer server release
// can never surface as a raw token in a settings row.
const labelFor = (labels: Record<string, string>, code: string | null): string | null => {
  if (code === null) {
    return null
  }

  const label: string | undefined = labels[code]

  return label ?? null
}

const formatWeight = (weightKg: number | null, unit: WeightUnitPref | null): string | null => {
  if (weightKg === null || !Number.isFinite(weightKg)) {
    return null
  }

  return unit === 'lb'
    ? withUnit(toOneDecimal(kilogramsToPounds(weightKg)), MEAL_PLAN_LB_UNIT)
    : withUnit(toOneDecimal(weightKg), MEAL_PLAN_KG_UNIT)
}

const formatHeight = (heightCm: number | null, unit: HeightUnitPref | null): string | null => {
  if (heightCm === null || !Number.isFinite(heightCm)) {
    return null
  }

  if (unit === 'ft_in') {
    const {feet, inches} = centimetersToFeetInches(heightCm)

    return formatHeightImperial(feet, inches)
  }

  return withUnit(String(Math.round(heightCm)), MEAL_PLAN_CM_UNIT)
}

const formatTargetCalories = (targets: PlanTargetValues): string | null => {
  const calories = targets?.calories ?? null

  return calories === null ? null : withUnit(formatCalories(calories), MEAL_PLAN_KCAL_UNIT)
}

// The triple is all or nothing: a calories-only legacy account states its calories and stops there rather than
// naming two macros and a gap.
const formatTargetMacros = (targets: PlanTargetValues): string | null => {
  if (targets === null || targets.protein === null || targets.carbs === null || targets.fat === null) {
    return null
  }

  return stringWithNamedParameters(PLAN_SETTINGS_MACRO_TRIPLE_TEMPLATE, {
    protein: Math.round(targets.protein),
    carbs: Math.round(targets.carbs),
    fat: Math.round(targets.fat)
  })
}

// 'None' is the explicit no-allergies answer and reads as its own label; an empty list is the unanswered case
// and leaves the part out. The sentinel is dropped when named allergens sit beside it, which the two-way
// exclusivity rule should already have prevented.
const formatAllergens = (allergens: string[]): string | null => {
  const named = allergens.filter(allergen => allergen !== ALLERGEN_NONE)
  const labels = (named.length > 0 ? named : allergens)
    .map(allergen => labelFor(MEAL_PLAN_ALLERGEN_LABELS, allergen))
    .filter((label): label is string => label !== null)

  return labels.length > 0 ? labels.join(LIST_SEPARATOR) : null
}

const formatDislikedFoods = (foods: DislikedFoodSummary[]): string | null => {
  const names = foods.map(food => food.name).filter(name => name.length > 0)

  return names.length > 0 ? names.join(LIST_SEPARATOR) : null
}

// Times follow the saved slot order (breakfast, lunch, dinner, then snack) rather than the clock, so the row
// reads in the same sequence as the schedule screen even when a snack sits between two meals.
const formatMealTimes = (mealTimes: MealTimeEntry[]): string | null => {
  const times = mealTimes.map(entry => formatSlotTime(entry.time)).filter(time => time.length > 0)

  return times.length > 0 ? times.join(LIST_SEPARATOR) : null
}

const formatCookingTime = (minutes: number | null): string | null =>
  minutes === null ? null : stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE, {minutes})

const formatBudget = (budget: MealPlanPreferences['budget'], noBudgetPreference: boolean): string | null => {
  if (noBudgetPreference) {
    return MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL
  }

  return budget === null ? null : stringWithNamedParameters(MEAL_PLAN_BUDGET_VALUE_TEMPLATE, {amount: budget.amount})
}

// A fresh params object per row: one shared literal would hand every row the same reference to mutate.
const stepEditTarget = (route: keyof RootStackParamList): PlanSettingsNavigationTarget => ({
  route,
  params: {mode: 'edit', returnTo: 'settings', origin: 'row'}
})

/**
 * The seven settings rows in the order 38:402 draws them. Each row opens one step, and a row that spans two
 * screens (goal with body, activity with pace) opens only the first: the second screen is pushed by that
 * screen's own "Save changes", because each step is one request and the pair commits independently.
 */
export const buildPlanSettingsRows = (
  preferences: MealPlanPreferences,
  targets: NutritionTargets | null
): PlanSettingsRow[] => {
  const targetValues = targets?.targets ?? null

  return [
    {
      key: 'goalAndBody',
      label: PLAN_SETTINGS_GOAL_AND_BODY_LABEL,
      value: joinValueParts([
        labelFor(MEAL_PLAN_GOAL_LABELS, preferences.goal),
        formatWeight(preferences.weightKg, preferences.weightUnitPref),
        formatHeight(preferences.heightCm, preferences.heightUnitPref)
      ]),
      editStep: 'goal',
      target: stepEditTarget(Screens.MEAL_PLAN_GOAL)
    },
    {
      key: 'activityAndPace',
      label: PLAN_SETTINGS_ACTIVITY_AND_PACE_LABEL,
      value: joinValueParts([
        labelFor(MEAL_PLAN_ACTIVITY_LEVEL_LABELS, preferences.activityLevel),
        labelFor(MEAL_PLAN_PACE_LABELS, preferences.paceLbPerWeek === null ? null : String(preferences.paceLbPerWeek))
      ]),
      editStep: 'activity',
      target: stepEditTarget(Screens.MEAL_PLAN_ACTIVITY)
    },
    {
      key: 'nutritionTargets',
      label: PLAN_SETTINGS_NUTRITION_TARGETS_LABEL,
      value: joinValueParts([formatTargetCalories(targetValues), formatTargetMacros(targetValues)]),
      editStep: null,
      target: {
        route: Screens.MEAL_PLAN_EDIT_TARGETS,
        params: {mode: 'edit', returnTo: {kind: 'stack', route: 'settings'}}
      }
    },
    {
      key: 'dietAndAllergies',
      label: PLAN_SETTINGS_DIET_AND_ALLERGIES_LABEL,
      value: joinValueParts([
        labelFor(MEAL_PLAN_DIET_LABELS, preferences.diet),
        formatAllergens(preferences.allergens)
      ]),
      editStep: 'diet',
      target: stepEditTarget(Screens.MEAL_PLAN_DIET)
    },
    {
      key: 'dislikedIngredients',
      label: MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
      value: joinValueParts([formatDislikedFoods(preferences.dislikedFoods)]),
      editStep: 'dislikes',
      target: stepEditTarget(Screens.MEAL_PLAN_FOOD_PREFERENCES)
    },
    {
      key: 'mealSchedule',
      label: PLAN_SETTINGS_MEAL_SCHEDULE_LABEL,
      value: joinValueParts([
        labelFor(MEAL_PLAN_SCHEDULE_LABELS, preferences.mealSchedule),
        formatMealTimes(preferences.mealTimes)
      ]),
      editStep: 'schedule',
      target: stepEditTarget(Screens.MEAL_PLAN_SCHEDULE)
    },
    {
      key: 'cookingAndBudget',
      label: PLAN_SETTINGS_COOKING_AND_BUDGET_LABEL,
      value: joinValueParts([
        formatCookingTime(preferences.cookingTimeLimitMin),
        formatBudget(preferences.budget, preferences.noBudgetPreference)
      ]),
      editStep: 'cooking',
      target: stepEditTarget(Screens.MEAL_PLAN_COOKING_BUDGET)
    }
  ]
}

// Confirmed targets are fixed once confirmed, so an input change or a write from outside the planner is
// surfaced as an invitation to recalculate rather than silently rewritten.
export const shouldRecalculateTargets = (targets: NutritionTargets | null): boolean =>
  targets !== null && targets.targets !== null && (targets.stale || targets.source === 'legacy')

export const shouldShowUseForNextPlan = (input: PlanSettingsFooterInput): boolean =>
  input.hasIncompatibilities || input.targetsStale

/**
 * Where "Use for next plan" goes, and the whole of what it does. Every edit was already persisted by its own
 * "Save changes" and the server reads the latest preferences and confirmed targets when it next generates, so
 * the control commits no state: it acknowledges and returns to the plan. Hence a route and params, and
 * deliberately nothing resembling a payload, a request or a mutation.
 */
export const nextPlanAcknowledgementTarget = (): PlanSettingsNavigationTarget => ({
  route: Screens.MACROS,
  params: undefined
})

// The four title/body records are authored as one block keyed by reason. A reason is accepted only when all
// four carry copy for it, so a code one record gained and another did not can never render as 'undefined'.
const BANNER_COPY_RECORDS: readonly Record<string, string>[] = [
  PLAN_SETTINGS_FLAGGED_BANNER_TITLE_SINGULAR_LABELS,
  PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_BANNER_BODY_SINGULAR_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_BANNER_BODY_TEMPLATES
]

const hasBannerCopy = (reason: string): boolean =>
  BANNER_COPY_RECORDS.every(record => {
    const copy: string | undefined = record[reason]

    return copy !== undefined
  })

// MealPlanTab states the same rule for one card: flags that all carry one code name that code, and a set whose
// codes differ can only be stated generically. Borrowing a specific reason would tell the user that, for
// instance, an ingredient they skip is an allergen.
const resolveBannerReason = (meals: AffectedMeal[]): string => {
  const codes = meals.flatMap(meal => meal.flags.map(flag => flag.code))
  const [firstCode] = codes

  if (firstCode === undefined || !codes.every(code => code === firstCode)) {
    return PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON
  }

  return hasBannerCopy(firstCode) ? firstCode : PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON
}

const resolveBannerDetail = (meals: AffectedMeal[]): string | null => {
  const details = meals.flatMap(meal => meal.flags.flatMap(flag => flag.detail)).filter(detail => detail.length > 0)
  const distinct = Array.from(new Set(details))

  return distinct.length > 0 ? distinct.join(MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR) : null
}

const flaggedMealDescription = (meal: AffectedMeal): string => {
  const weekday = format(parseDayKey(meal.date), WEEKDAY_FORMAT)
  const slot: string | undefined = MEAL_SLOT_SENTENCE_LABELS[meal.slot]

  return slot === undefined ? weekday : stringWithNamedParameters(PLAN_SETTINGS_FLAGGED_MEAL_TEMPLATE, {weekday, slot})
}

// 'Tuesday dinner and Thursday lunch' — the conjunction joins the last two so the body reads as the sentence
// 38:385 draws rather than as a comma-separated list.
const joinFlaggedMeals = (descriptions: string[]): string => {
  const leading = descriptions.slice(0, -1)
  const last = descriptions[descriptions.length - 1]

  return leading.length > 0 ? `${leading.join(LIST_SEPARATOR)}${PLAN_SETTINGS_FLAGGED_MEALS_CONJUNCTION}${last}` : last
}

/**
 * The flagged-meals banner, or null when there is nothing to say. A failed affected-meals query returns null
 * for the same reason an empty one does: the banner is omitted and the settings rows still render — a failure
 * never replaces them with an error or a blank card. A flag set carrying no detail resolves to the generic
 * reason, whose copy makes no claim the details would have had to support.
 */
export const derivePlanSettingsBanner = (
  meals: AffectedMeal[] | undefined,
  isError: boolean
): PlanSettingsBanner | null => {
  if (isError) {
    return null
  }

  const flagged = (meals ?? []).filter(meal => meal.flags.length > 0)

  if (flagged.length === 0) {
    return null
  }

  const detail = resolveBannerDetail(flagged)
  const reason = detail === null ? PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON : resolveBannerReason(flagged)
  const descriptions = flagged.map(flaggedMealDescription)
  const isSingle = flagged.length === SINGLE_ITEM

  const title = isSingle
    ? PLAN_SETTINGS_FLAGGED_BANNER_TITLE_SINGULAR_LABELS[reason]
    : stringWithNamedParameters(PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES[reason], {n: flagged.length})

  const bodyTemplate = isSingle
    ? PLAN_SETTINGS_FLAGGED_BANNER_BODY_SINGULAR_TEMPLATES[reason]
    : PLAN_SETTINGS_FLAGGED_BANNER_BODY_TEMPLATES[reason]

  const body = stringWithNamedParameters(bodyTemplate, {
    meal: descriptions[0],
    meals: joinFlaggedMeals(descriptions),
    detail: detail ?? ''
  })

  return {title, body, actionLabel: PLAN_SETTINGS_REVIEW_AFFECTED_BUTTON_TEXT}
}

// 'yyyy-MM-dd' is fixed-width and zero-padded, so lexicographic order is calendar order: the earliest key falls
// out of a plain sort with no Date built and no clock read. map() copies, so the argument is never sorted.
export const earliestFlaggedDate = (meals: AffectedMeal[]): string | null => {
  const [earliest] = meals.map(meal => meal.date).sort()

  return earliest ?? null
}

const loggedFoodValue = (loggedEntryCount: number): string => {
  if (loggedEntryCount <= 0) {
    return PLAN_REGENERATE_NOTHING_LOGGED_TEXT
  }

  if (loggedEntryCount === SINGLE_ITEM) {
    return PLAN_REGENERATE_ONE_ENTRY_KEPT_TEXT
  }

  return stringWithNamedParameters(PLAN_REGENERATE_ENTRIES_KEPT_TEMPLATE, {n: loggedEntryCount})
}

// The three rows of the regenerate dialog (38:531), every value bound: the drawn '21 replaced' and 'Kept' are
// sample content.
export const buildRegenerateSummaryRows = (summary: MealPlanSummary): SummaryRow[] => [
  {
    label: PLAN_REGENERATE_PLANNED_MEALS_LABEL,
    value: stringWithNamedParameters(PLAN_REGENERATE_MEALS_REPLACED_TEMPLATE, {n: summary.plannedMeals})
  },
  {
    label: PLAN_REGENERATE_GROCERY_LIST_LABEL,
    value: summary.groceryItemCount > 0 ? PLAN_REGENERATE_GROCERY_REBUILT_TEXT : PLAN_REGENERATE_GROCERY_EMPTY_TEXT
  },
  {
    label: PLAN_REGENERATE_LOGGED_FOOD_LABEL,
    value: loggedFoodValue(summary.loggedEntryCount),
    // The one accented value on the dialog: what survives a regeneration is the reassurance. A colour token
    // read as row data, never a style — SummaryRows applies it through its own valueTextColor helper.
    valueColor: Theme.colors.accentGreen
  }
]

export const buildRegenerateDialogBody = (startDate: string, endDate: string): string =>
  stringWithNamedParameters(PLAN_REGENERATE_DIALOG_BODY_TEMPLATE, {
    range: stringWithNamedParameters(PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE, {
      start: formatPlanDayLabel(startDate),
      end: formatPlanDayLabel(endDate)
    })
  })
