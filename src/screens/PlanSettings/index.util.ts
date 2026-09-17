import {AffectedMeal, MealPlanSummary} from '@data/models/MealPlan'
import {
  ALLERGEN_NONE,
  DislikedFoodSummary,
  HeightUnitPref,
  MealPlanPreferences,
  MealPlanPreferencesSaveResult,
  MealTimeEntry,
  SetupStep,
  WeightUnitPref
} from '@data/models/MealPlanPreferences'
import {NutritionTargets} from '@data/models/NutritionTargets'
import type {RootStackParamList, StepMode, TargetsReturn} from '@navigation/types'
import {
  buildPendingIntent,
  IntentsHydration,
  MealPlanStore,
  PendingIntent,
  resolveKeyedRequest,
  resolveReplayableIntent
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import type {RegenerateRequestSnapshot} from '@utility/IdempotencyUtility'
import {formatPlanDayLabel, formatSlotTime, parseDayKey} from '@utility/MealPlanDateUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'
import {resolveStaleRevision} from '@utility/RevisionConflictUtility'
import {lookupLabel} from '@utility/TextUtility'
import {centimetersToFeetInches, formatHeightImperial, kilogramsToPounds} from '@utility/UnitConversionUtility'
import {format} from 'date-fns'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ACTIVITY_LEVEL_LABELS,
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_ALLERGEN_SENTENCE_LABELS,
  MEAL_PLAN_BUDGET_VALUE_TEMPLATE,
  MEAL_PLAN_CM_UNIT,
  MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DIET_SENTENCE_LABELS,
  MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_KG_UNIT,
  MEAL_PLAN_LB_UNIT,
  MEAL_PLAN_LIST_SEPARATOR,
  MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL,
  MEAL_PLAN_PACE_LABELS,
  MEAL_PLAN_SCHEDULE_LABELS,
  MEAL_PLAN_UNIT_VALUE_TEMPLATE,
  MEAL_PLAN_VALUE_SEPARATOR,
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

export type PlanSummaryTone = 'default' | 'accent'

export interface PlanRegenerateSummaryRow {
  label: string
  value: string
  tone: PlanSummaryTone
}

/** The params the generating screen is pushed with, so a launch cannot describe a route it is not dispatched to. */
export type RegenerateGeneratingParams = RootStackParamList[typeof Screens.MEAL_PLAN_GENERATING]

/**
 * The plan a regeneration replaces: the revision its write pins, and the week the generating screen states
 * while it works. Declared structurally rather than taking a whole `MealPlan`, so the decision below is a
 * function of the three members it actually reads.
 */
export interface RegeneratePlanPin {
  id: string
  revision: number
  startDate: string
}

export interface RegenerateLaunchInput {
  /**
   * Whether this screen has already dispatched a launch that has not been released. Passed in rather than
   * read from a ref so the double-press rule is decided in one place and can be asserted without a renderer.
   */
  isLaunchLatched: boolean
  /**
   * Whether the persisted intent slice has come back from AsyncStorage. "No intent is pending" and "the
   * answer has not arrived" are different answers, and deciding on the second would mint a second key for a
   * regeneration the server may already hold (0.7.2).
   */
  hasHydratedIntents: boolean
  state: Pick<MealPlanStore, 'pendingIntents'>
  plan: RegeneratePlanPin | null
  expectedPreferencesRevision: number | null
  expectedTargetsRevision: number | null
  userId: string | null
  attemptedAt: number
  /**
   * The key source, not a key: minting is the one thing this decision must not do while an unresolved
   * regeneration is on record, so the caller's generator is invoked only on the branch that may mint.
   */
  mintFreshKey: () => string
}

export type RegenerateLaunchIgnoredReason = 'latched' | 'incompletePins' | 'unhydratedIntents'

/**
 * What just happened to the regeneration launch this screen guards: one confirmation dispatched a launch, or
 * one of the two moments at which a further confirmation is a new user intent rather than a repeat of the one
 * already sent — the dialog being reopened, and this screen being returned to once the generating screen it
 * pushed is gone.
 */
export type RegenerateLatchEvent = 'launchDispatched' | 'confirmReopened' | 'screenFocused'

/**
 * Why the 16b confirm action reads as it does. `ready` is the only state a press decides from; the two
 * pending reasons are the two ways a press is already accounted for — this screen has dispatched a launch, or
 * the persisted intent slice has not been read yet — and `failedIntentsRead` is the state in which nothing
 * may be minted at all, because an unread slice may already hold the key of a regeneration the server
 * committed (0.7.2).
 */
export type RegenerateConfirmReason = 'ready' | 'launchDispatched' | 'unhydratedIntents' | 'failedIntentsRead'

export interface RegenerateConfirmInput {
  /**
   * The rendering half of the launch latch. Taken from `resolveRegenerateLatch` like the ref that actually
   * refuses the second press, so the spinner cannot disagree with the guard.
   */
  isLaunchDispatched: boolean
  /**
   * The persisted slice's read, in all three of its states rather than as the boolean the press gates on:
   * 'pending' is a wait the user should see, while 'failed' is a refusal no press can leave.
   */
  intentsHydration: IntentsHydration
}

/**
 * How the confirm action renders, so a press `resolveRegenerateLaunch` declines is never drawn as an enabled
 * control that does nothing. Two flags rather than one: a launch already under way, or a read still out, is
 * work in progress and reads as busy, whereas a refused read is a state no further press can resolve — it
 * reads as disabled, and the screen offers the re-read instead.
 */
export interface RegenerateConfirmState {
  reason: RegenerateConfirmReason
  isPending: boolean
  isDisabled: boolean
}

/**
 * What a confirmed "Regenerate this week" does.
 *
 * `launch` carries the key the write must travel under and the request it must send — the stored pair when an
 * unresolved regeneration of this plan is on record, a freshly minted pair otherwise. `handOff` is the case
 * the single `pendingIntents.regenerate` slot creates: an unresolved regeneration of a *different* plan holds
 * it, and recording over it would abandon a key whose write may have committed, so the press goes to the Meal
 * Plan tab, which owns replaying a stranded generation intent. `ignored` is a press that decides nothing.
 */
export type RegenerateLaunchDecision =
  | {kind: 'ignored'; reason: RegenerateLaunchIgnoredReason}
  | {kind: 'handOff'; intent: PendingIntent}
  | {
      kind: 'launch'
      idempotencyKey: string
      /** True when the key is one the server may already have answered, so its reply can be a stored result. */
      isReplay: boolean
      request: RegenerateRequestSnapshot
      /** The record to write before the request leaves, or null when there is no account to scope it to. */
      intent: PendingIntent | null
      params: RegenerateGeneratingParams
    }

type PlanTargetValues = NutritionTargets['targets']

const WEEKDAY_FORMAT = 'EEEE'

const WEIGHT_PRECISION_FACTOR = 10

const SINGLE_ITEM = 1

const withUnit = (value: string, unit: string): string =>
  stringWithNamedParameters(MEAL_PLAN_UNIT_VALUE_TEMPLATE, {value, unit})

const toOneDecimal = (value: number): string =>
  String(Math.round(value * WEIGHT_PRECISION_FACTOR) / WEIGHT_PRECISION_FACTOR)

// A row states the parts it has and reads 'Not set' only when it has none, so a half-answered profile still
// renders seven readable rows rather than seven empty ones.
const joinValueParts = (parts: (string | null)[]): string => {
  const present = parts.filter((part): part is string => part !== null && part.length > 0)

  return present.length > 0 ? present.join(MEAL_PLAN_VALUE_SEPARATOR) : PLAN_SETTINGS_NOT_SET_VALUE
}

// A code outside the mapped set resolves to null rather than to itself, so a value from a newer server release
// can never surface as a raw token in a settings row.
const labelFor = (labels: Record<string, string>, code: string | null): string | null => {
  if (code === null) {
    return null
  }

  const label: string | undefined = lookupLabel(labels, code)

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

  return labels.length > 0 ? labels.join(MEAL_PLAN_LIST_SEPARATOR) : null
}

const formatDislikedFoods = (foods: DislikedFoodSummary[]): string | null => {
  const names = foods.map(food => food.name).filter(name => name.length > 0)

  return names.length > 0 ? names.join(MEAL_PLAN_LIST_SEPARATOR) : null
}

// Times follow the saved slot order (breakfast, lunch, dinner, then snack) rather than the clock, so the row
// reads in the same sequence as the schedule screen even when a snack sits between two meals.
const formatMealTimes = (mealTimes: MealTimeEntry[]): string | null => {
  const times = mealTimes.map(entry => formatSlotTime(entry.time)).filter(time => time.length > 0)

  return times.length > 0 ? times.join(MEAL_PLAN_LIST_SEPARATOR) : null
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
  BANNER_COPY_RECORDS.every(record => lookupLabel(record, reason) !== undefined)

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

// A detail is a server value, so a lookup keyed by one must never reach the prototype chain: 'constructor' or
// '__proto__' would otherwise resolve to a function or an object and render as one. Own properties only, and a
// string only.
const sentenceLabelFor = (labels: Record<string, string>, code: string): string | null => {
  if (!Object.prototype.hasOwnProperty.call(labels, code)) {
    return null
  }

  const label: unknown = labels[code]

  return typeof label === 'string' && label.length > 0 ? label : null
}

// All or nothing, here and in the two formatters below: the banner states one reason for every meal it lists,
// so a detail this release cannot state is not a detail to drop. Dropping it would leave the sentence claiming
// to name what the meals contain while naming only part of it — a user reading 'contains milk' would swap for
// milk and meet the detail that was discarded. Null means 'state this generically instead'.
const mapSentenceLabels = (labels: Record<string, string>, details: string[]): string[] | null => {
  const labelled = details.map(detail => sentenceLabelFor(labels, detail.trim()))

  return labelled.every((label): label is string => label !== null) ? labelled : null
}

// A duration is a count, not a label: it is stated through the minutes template rather than looked up, and the
// greatest of the set is the one stated because the plural body says 'up to'. Every detail has to be a positive
// whole number of minutes for that 'up to' to be true — one that is not leaves a flagged meal's duration
// unknown, and the greatest of the rest would understate the set.
const formatCookingTimeDetails = (details: string[]): string[] | null => {
  const minutes = details.map(detail => Number(detail.trim()))

  if (!minutes.every(value => Number.isInteger(value) && value > 0)) {
    return null
  }

  return [stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE, {minutes: Math.max(...minutes)})]
}

// An ingredient name is the one detail that arrives as display text, so it is stated as sent — but a blank one
// names nothing, and the set it belongs to is then as incomplete as an unrecognised code makes it.
const formatIngredientNames = (details: string[]): string[] | null => {
  const names = details.map(detail => detail.trim())

  return names.every(name => name.length > 0) ? names : null
}

// What the server sends as a flag's detail differs per code: allergen and diet codes, ingredient display names,
// and a minute count. Only the dislike names are already display text, so every other code is formatted here
// rather than spliced into prose as the token it arrived as. A code this app has no formatting for states
// nothing, which is what keeps a newer server's flag from reading as a raw value.
const formatFlagDetails = (code: string, details: string[]): string[] | null => {
  switch (code) {
    case 'allergen':
      return mapSentenceLabels(MEAL_PLAN_ALLERGEN_SENTENCE_LABELS, details)
    case 'diet':
      return mapSentenceLabels(MEAL_PLAN_DIET_SENTENCE_LABELS, details)
    case 'dislike':
      return formatIngredientNames(details)
    case 'cooking_time':
      return formatCookingTimeDetails(details)
    default:
      return null
  }
}

// The details of the banner's own reason, formatted for that reason and de-duplicated after formatting, so two
// meals flagged for the same allergen state it once and the first meal flagged decides the order. A flag that
// carries no detail at all is the same incompleteness as one whose detail cannot be formatted: the reason the
// banner would state for every listed meal is not established for that one, so it states the generic copy.
const resolveBannerDetail = (reason: string, meals: AffectedMeal[]): string | null => {
  const flags = meals.flatMap(meal => meal.flags.filter(flag => flag.code === reason))

  if (flags.length === 0 || flags.some(flag => flag.detail.length === 0)) {
    return null
  }

  const formatted = formatFlagDetails(
    reason,
    flags.flatMap(flag => flag.detail)
  )

  if (formatted === null) {
    return null
  }

  const distinct = Array.from(new Set(formatted))

  return distinct.length > 0 ? distinct.join(MEAL_PLAN_MEAL_FLAG_DETAIL_SEPARATOR) : null
}

const flaggedMealDescription = (meal: AffectedMeal): string => {
  const weekday = format(parseDayKey(meal.date), WEEKDAY_FORMAT)
  const slot: string | undefined = lookupLabel(MEAL_SLOT_SENTENCE_LABELS, meal.slot)

  return slot === undefined ? weekday : stringWithNamedParameters(PLAN_SETTINGS_FLAGGED_MEAL_TEMPLATE, {weekday, slot})
}

// 'Tuesday dinner and Thursday lunch' — the conjunction joins the last two so the body reads as the sentence
// 38:385 draws rather than as a comma-separated list.
const joinFlaggedMeals = (descriptions: string[]): string => {
  const leading = descriptions.slice(0, -1)
  const last = descriptions[descriptions.length - 1]

  return leading.length > 0
    ? `${leading.join(MEAL_PLAN_LIST_SEPARATOR)}${PLAN_SETTINGS_FLAGGED_MEALS_CONJUNCTION}${last}`
    : last
}

/**
 * The flagged-meals banner, or null when there is nothing to say. A failed affected-meals query returns null
 * for the same reason an empty one does: the banner is omitted and the settings rows still render — a failure
 * never replaces them with an error or a blank card. A flag set carrying no detail resolves to the generic
 * reason, whose copy makes no claim the details would have had to support, and so does one whose details
 * cannot be stated: an allergen or diet code this app does not know, an answer that excludes nothing, or a
 * duration that is not a number.
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

  // The reason comes first and the details are then formatted for it, because what a detail means — and so how
  // it reads in a sentence — is a property of the flag code that sent it. Pooling the details of several codes
  // and formatting them as one would state an ingredient as a diet, or a diet as a duration.
  const candidateReason = resolveBannerReason(flagged)
  const detail = resolveBannerDetail(candidateReason, flagged)
  const reason = detail === null ? PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON : candidateReason
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
export const buildRegenerateSummaryRows = (summary: MealPlanSummary): PlanRegenerateSummaryRow[] => [
  {
    label: PLAN_REGENERATE_PLANNED_MEALS_LABEL,
    value: stringWithNamedParameters(PLAN_REGENERATE_MEALS_REPLACED_TEMPLATE, {n: summary.plannedMeals}),
    tone: 'default'
  },
  {
    label: PLAN_REGENERATE_GROCERY_LIST_LABEL,
    value: summary.groceryItemCount > 0 ? PLAN_REGENERATE_GROCERY_REBUILT_TEXT : PLAN_REGENERATE_GROCERY_EMPTY_TEXT,
    tone: 'default'
  },
  {
    label: PLAN_REGENERATE_LOGGED_FOOD_LABEL,
    value: loggedFoodValue(summary.loggedEntryCount),
    // 'accent' marks the one emphasised value on the 16b dialog — what survives a regeneration is the
    // reassurance — and becomes a colour token in the screen's styled layer before the rows reach SummaryRows.
    tone: 'accent'
  }
]

export const buildRegenerateDialogBody = (startDate: string, endDate: string): string =>
  stringWithNamedParameters(PLAN_REGENERATE_DIALOG_BODY_TEMPLATE, {
    range: stringWithNamedParameters(PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE, {
      start: formatPlanDayLabel(startDate),
      end: formatPlanDayLabel(endDate)
    })
  })

// A closed record rather than a comparison, so an event added later cannot reach this rule without a decision
// being made for it: releasing the latch at the wrong moment is what lets one intent file two keys.
const REGENERATE_LATCH_BY_EVENT: Record<RegenerateLatchEvent, boolean> = {
  launchDispatched: true,
  confirmReopened: false,
  screenFocused: false
}

/**
 * Whether the launch latch is held after `event`. Held from the moment a confirmation dispatches a launch, so
 * the next press in the same tick decides nothing; released where a re-launch is legitimate, so the control
 * does not stay dead for the rest of the session. A release is safe on its own terms: an intent that is still
 * unresolved is replayed by `resolveRegenerateLaunch` under its own key rather than minted over.
 */
export const resolveRegenerateLatch = (event: RegenerateLatchEvent): boolean => REGENERATE_LATCH_BY_EVENT[event]

/**
 * The two refusals a confirmation has to show for, in the shape the dialog renders them: the latch a
 * duplicate press is declined by, and the persisted read no launch may mint ahead of. The third —
 * `incompletePins` — never reaches the dialog, because the control that opens it is already disabled while a
 * revision is unanswered. A refused read is answered first and is the one disabling state: it is not a wait
 * that ends on its own, so drawing it as busy would promise a launch that can never leave.
 */
export const deriveRegenerateConfirmState = (input: RegenerateConfirmInput): RegenerateConfirmState => {
  if (input.intentsHydration === 'failed') {
    return {reason: 'failedIntentsRead', isPending: false, isDisabled: true}
  }

  if (input.isLaunchDispatched) {
    return {reason: 'launchDispatched', isPending: true, isDisabled: false}
  }

  if (input.intentsHydration === 'pending') {
    return {reason: 'unhydratedIntents', isPending: true, isDisabled: false}
  }

  return {reason: 'ready', isPending: false, isDisabled: false}
}

// One launch, assembled from the request it sends so the recorded snapshot, the key and the route params
// cannot describe three different regenerations. `startDate` is the plan's own week: it is the week the
// generating screen states, and a regeneration keeps the dates of the plan it replaces.
const regenerateLaunch = (
  request: RegenerateRequestSnapshot,
  idempotencyKey: string,
  isReplay: boolean,
  intent: PendingIntent | null,
  startDate: string
): RegenerateLaunchDecision => ({
  kind: 'launch',
  idempotencyKey,
  isReplay,
  request,
  intent,
  params: {
    context: {kind: 'regenerate', planId: request.planId, planRevision: request.expectedPlanRevision},
    idempotencyKey,
    expectedPreferencesRevision: request.expectedPreferencesRevision,
    expectedTargetsRevision: request.expectedTargetsRevision,
    startDate
  }
})

/**
 * Which regeneration a confirmed 16b dialog launches, and under which key (0.7.2).
 *
 * The rule the single `pendingIntents.regenerate` slot forces: a key is minted only when no unresolved
 * regeneration is on record. An unresolved one is a request whose answer was lost, so it may have committed —
 * recording a new key over it would abandon the only key that could ever reconcile that write and would
 * launch a second regeneration of the same week. So an unresolved regeneration of *this* plan is replayed
 * instead, under its stored key and carrying its stored request, which the server answers with the stored
 * result when the write landed and re-runs under the same key when it did not; a confirmed refusal (a moved
 * plan or preferences revision) is what retires it, and only then does a further press mint. That covers the
 * equal-fingerprint case `resolveKeyedRequest` names and the moved-revision case it would mint for, which is
 * why the stored request — never the freshly built one — is what travels under a stored key.
 *
 * An unresolved regeneration of another plan cannot be replayed from here (this screen knows only the week it
 * was opened for) and cannot be written over either, so it is handed to the Meal Plan tab.
 */
export const resolveRegenerateLaunch = (input: RegenerateLaunchInput): RegenerateLaunchDecision => {
  if (input.isLaunchLatched) {
    return {kind: 'ignored', reason: 'latched'}
  }

  // Regeneration pins three revisions and the two read ones may not have answered yet; a fabricated pin earns
  // a refusal the user cannot act on, so the press decides nothing until all three are real.
  if (input.plan === null || input.expectedPreferencesRevision === null || input.expectedTargetsRevision === null) {
    return {kind: 'ignored', reason: 'incompletePins'}
  }

  const request: RegenerateRequestSnapshot = {
    action: 'regenerate',
    planId: input.plan.id,
    expectedPlanRevision: input.plan.revision,
    expectedPreferencesRevision: input.expectedPreferencesRevision,
    expectedTargetsRevision: input.expectedTargetsRevision
  }

  // Intents are scoped by account, so with no signed-in id there is nothing to replay and nothing that could
  // be overwritten: the launch carries a key it cannot record.
  if (input.userId === null) {
    return regenerateLaunch(request, input.mintFreshKey(), false, null, input.plan.startDate)
  }

  if (!input.hasHydratedIntents) {
    return {kind: 'ignored', reason: 'unhydratedIntents'}
  }

  const unresolved = resolveReplayableIntent(input.state, 'regenerate', input.userId, input.attemptedAt)

  if (unresolved !== null) {
    // The lookup reads the slot filed under this action and parses the record against it, so the snapshot is
    // a regeneration; the check narrows the union rather than guarding a reachable case, and a record that
    // somehow failed it is still a record this press may not overwrite.
    const stored = unresolved.request.action === 'regenerate' ? unresolved.request : null

    if (stored === null || stored.planId !== request.planId) {
      return {kind: 'handOff', intent: unresolved}
    }

    // Re-recorded with the intent's own `createdAt`, so the write restates the record rather than extending
    // the 7-day life of a key that was minted a week ago.
    return regenerateLaunch(
      stored,
      unresolved.key,
      true,
      buildPendingIntent(stored, unresolved.key, input.userId, unresolved.createdAt),
      input.plan.startDate
    )
  }

  // Nothing unresolved, so this press is a new intent and may mint. The key it travels under still comes from
  // the decision all four keyed writes share, rather than from a second rule living here.
  const keyed = resolveKeyedRequest(input.state, request, input.userId, input.attemptedAt, input.mintFreshKey())
  const sent = keyed.request.action === 'regenerate' ? keyed.request : request

  return regenerateLaunch(
    sent,
    keyed.idempotencyKey,
    keyed.isReplay,
    buildPendingIntent(sent, keyed.idempotencyKey, input.userId, input.attemptedAt),
    input.plan.startDate
  )
}

/**
 * The whole body a zone reconciliation sends: the device's zone and the revision it is replacing. It carries
 * no answer of the user's, which is what makes the conflict handling below legitimate.
 */
export interface TimeZoneReconciliationRequest {
  timeZone: string
  expectedRevision: number
}

export interface TimeZoneReconciliationCollaborators {
  savePreferences: (payload: TimeZoneReconciliationRequest) => Promise<MealPlanPreferencesSaveResult>
  refetchPreferences: () => Promise<MealPlanPreferences | null>
}

export interface TimeZoneReconciliationRun extends TimeZoneReconciliationCollaborators {
  storedTimeZone: string | null
  deviceTimeZone: string
  expectedRevision: number
}

/**
 * How far the reconciliation got. `failed` is the only outcome the caller may retry, and it is retried by
 * reopening the screen rather than by looping here.
 */
export type TimeZoneReconciliationOutcome = 'not_needed' | 'saved' | 'already_current' | 'resubmitted' | 'failed'

/**
 * Brings the stored IANA zone up to the device's, through the one full preferences save.
 *
 * The server resolves this user's "today" from the zone stored on their preferences, and the client is
 * required to refresh it on every step save and on every `PUT /meal-planning/preferences` (AAP 0.5.2). Each
 * settings row saves only the step it edits, so a user who has travelled without editing an answer would
 * otherwise keep reading their plan in the calendar they left.
 *
 * A refused revision is recovered, never swallowed. `409 stale_revision` refetches the authoritative
 * preferences and hands them to the shared `resolveStaleRevision` helper AAP 0.7.2 mandates for every
 * revisioned save, over the single field this draft carries:
 *
 * - `resolved` — the fresh stored zone already equals the device's, so another writer (or this client's own
 *   first attempt, whose response was lost) has already applied it. That resolves silently as success, which
 *   is exactly what the helper's contract prescribes and what stops a second write.
 * - `conflict` — the stored zone is still not the device's, so the save is re-sent once against the revision
 *   the refetch reported. This is the helper's "keep mine" answer, taken without prompting because the user
 *   never entered a zone: there is no answer of theirs on either side to arbitrate, and a "changed on another
 *   device" dialog over a field they did not edit would ask them to decide something they have no stake in.
 *   A third writer landing inside that window leaves the zone stale until the next open, which is bounded and
 *   truthful rather than a retry loop.
 *
 * Any other failure returns `failed` with the stored zone untouched. Note that only the `stale_revision` path
 * has an obsolete revision to discard, and that path refetches — so a caller retrying after `failed` never
 * re-sends a pin the server has already moved past.
 */
export const reconcilePreferencesTimeZone = async ({
  storedTimeZone,
  deviceTimeZone,
  expectedRevision,
  savePreferences,
  refetchPreferences
}: TimeZoneReconciliationRun): Promise<TimeZoneReconciliationOutcome> => {
  // A user who has never completed a step has no stored zone to correct, and one already in the device's zone
  // is the common case — neither issues a request.
  if (storedTimeZone === null || storedTimeZone === deviceTimeZone) {
    return 'not_needed'
  }

  try {
    await savePreferences({timeZone: deviceTimeZone, expectedRevision})

    return 'saved'
  } catch (error) {
    if (getApiErrorCode(error) !== API_ERROR_CODES.staleRevision) {
      return 'failed'
    }

    const fresh = await refetchPreferences().catch(() => null)

    if (fresh === null) {
      return 'failed'
    }

    if (
      resolveStaleRevision<MealPlanPreferences>({timeZone: deviceTimeZone}, fresh, ['timeZone']).status === 'resolved'
    ) {
      return 'already_current'
    }

    try {
      await savePreferences({timeZone: deviceTimeZone, expectedRevision: fresh.revision})

      return 'resubmitted'
    } catch {
      return 'failed'
    }
  }
}

export interface RegenerationReadiness {
  hasPlan: boolean
  hasPreferences: boolean
  hasTargetsRevision: boolean
  isReconcilingTimeZone: boolean
}

/**
 * Whether "Regenerate this week" may be offered. The three reads are the revision pins regeneration sends, so
 * a read that has not answered has no pin to send.
 *
 * `isReconcilingTimeZone` is the fourth term because a zone reconciliation is a full preferences save: it
 * bumps the preferences revision and, while a plan is active, recomputes that plan's flags and bumps its
 * revision too. A regeneration pressed inside that window would pin the revisions this screen read before the
 * save and earn a `409` the user cannot act on, so the control waits for the reconciliation and the refetches
 * it triggers to settle.
 */
export const canSubmitRegeneration = ({
  hasPlan,
  hasPreferences,
  hasTargetsRevision,
  isReconcilingTimeZone
}: RegenerationReadiness): boolean => hasPlan && hasPreferences && hasTargetsRevision && !isReconcilingTimeZone
