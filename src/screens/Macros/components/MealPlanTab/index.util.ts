import {CurrentMealPlans, MealPlan, MealPlanFlag, MealPlanMeal} from '@data/models/MealPlan'
import {MealPlanPreferences, SetupStatus, SetupStep} from '@data/models/MealPlanPreferences'
import {httpStatusOf, isRoutesMissingError, MealPlanAvailability} from '@hooks/mealPlanning/useMealPlanEntitlement.util'
import {RootStackParamList} from '@navigation/types'
import type {PostLogViewTarget} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {clampDayKeyToPlan, defaultSelectedPlanDate, isLastPlanDay} from '@utility/MealPlanDateUtility'

import Screens from '@constants/screens'
import {PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON} from '@constants/strings'

const NOT_FOUND_STATUS = 404

const STALE_PLAN_CODES: readonly string[] = [API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive]

const SETUP_STEP_ROUTES: Record<SetupStep, keyof RootStackParamList> = {
  goal: Screens.MEAL_PLAN_GOAL,
  body: Screens.MEAL_PLAN_ABOUT_YOU,
  activity: Screens.MEAL_PLAN_ACTIVITY,
  diet: Screens.MEAL_PLAN_DIET,
  dislikes: Screens.MEAL_PLAN_FOOD_PREFERENCES,
  schedule: Screens.MEAL_PLAN_SCHEDULE,
  cooking: Screens.MEAL_PLAN_COOKING_BUDGET,
  review: Screens.MEAL_PLAN_TARGETS,
  targets_manual: Screens.MEAL_PLAN_EDIT_TARGETS
}

const EMPTY_PLAN_CTAS: Record<SetupStatus, EmptyPlanCta> = {
  not_started: 'create',
  in_progress: 'continueSetupStep',
  ready_for_review: 'continueSetupReview',
  completed: 'planNextWeek'
}

export type EmptyPlanCta = 'create' | 'continueSetupStep' | 'continueSetupReview' | 'planNextWeek'

export type MealPlanBodyOutcome =
  | {kind: 'unavailable'}
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'plan'; plan: MealPlan}
  | {kind: 'empty'; cta: EmptyPlanCta}

export interface MealPlanBodyInputs {
  availability: MealPlanAvailability
  preferences: MealPlanPreferences | undefined
  preferencesError: unknown
  plans: CurrentMealPlans | undefined
  currentPlanError: unknown
  isLoading: boolean
  selectedPlanId: string | null
}

export type PlanSwitchLink = 'next' | 'this'

export type LastDayAction = 'planAnotherWeek' | 'viewNextWeek'

export type LoggedEntryRef = MealPlanMeal['loggedEntries'][number]

export type MealLoggedState =
  | {kind: 'unlogged'}
  | {kind: 'logged'; entry: LoggedEntryRef}
  | {kind: 'loggedThenSwapped'; entry: LoggedEntryRef}

const hasError = (error: unknown): boolean => error !== null && error !== undefined

// A 404 carrying a decodable code is the server's combined not-found/not-yours answer for a resource route; a
// 404 without one is the routes-missing signal that the entitlement verdict already owns.
const isResourceNotFoundError = (error: unknown): boolean =>
  httpStatusOf(error) === NOT_FOUND_STATUS && !isRoutesMissingError(error)

const isStalePlanError = (error: unknown): boolean => {
  const code = getApiErrorCode(error)

  return code !== null && STALE_PLAN_CODES.includes(code)
}

const isResourceOrStalePlanError = (error: unknown): boolean =>
  isStalePlanError(error) || isResourceNotFoundError(error)

const resolveEmptyPlanCta = (preferences: MealPlanPreferences | undefined): EmptyPlanCta =>
  preferences ? EMPTY_PLAN_CTAS[preferences.setupStatus] : 'create'

// Same-format ISO-8601 timestamps compare lexicographically, so the later entry is found without parsing a
// Date; the reduce also leaves the caller's array untouched, which Array.prototype.sort would not.
const isLaterEntry = (candidate: LoggedEntryRef, incumbent: LoggedEntryRef): boolean =>
  candidate.loggedAt === incumbent.loggedAt
    ? candidate.entryId > incumbent.entryId
    : candidate.loggedAt > incumbent.loggedAt

/**
 * Branch order is load-bearing. Unavailability is the entitlement verdict rather than a re-reading of the
 * responses; a decoded stale-plan or resource-route failure outranks an in-flight refetch so it cannot be
 * hidden behind a spinner; and no error path may fall through to `empty`, which would claim the user has no
 * plan when the request merely failed.
 */
export function resolveMealPlanBody(inputs: MealPlanBodyInputs): MealPlanBodyOutcome {
  const {availability, preferences, preferencesError, plans, currentPlanError, isLoading, selectedPlanId} = inputs

  if (availability !== 'enabled') {
    return {kind: 'unavailable'}
  }

  if (isResourceOrStalePlanError(preferencesError) || isResourceOrStalePlanError(currentPlanError)) {
    return {kind: 'error'}
  }

  const plan = resolveSelectedPlan(plans, selectedPlanId)

  if (isLoading && plan === null) {
    return {kind: 'loading'}
  }

  if (hasError(preferencesError) || hasError(currentPlanError)) {
    return {kind: 'error'}
  }

  if (plan !== null) {
    return {kind: 'plan', plan}
  }

  return {kind: 'empty', cta: resolveEmptyPlanCta(preferences)}
}

// Resuming setup opens the saved step itself, so a returning user never meets the introduction again.
export function resolveSetupStepRoute(step: SetupStep | null): keyof RootStackParamList {
  const route = step === null ? undefined : SETUP_STEP_ROUTES[step]

  return route ?? Screens.MEAL_PLAN_GOAL
}

export function resolveSelectedPlan(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): MealPlan | null {
  const current = plans?.current ?? null
  const upcoming = plans?.upcoming ?? null
  const fallback = current ?? upcoming

  if (selectedPlanId === null) {
    return fallback
  }

  if (current !== null && current.id === selectedPlanId) {
    return current
  }

  if (upcoming !== null && upcoming.id === selectedPlanId) {
    return upcoming
  }

  return fallback
}

// `null` is the value the caller stores back: a selection naming a plan the server no longer returns has to
// be cleared, or it would keep shadowing the plan actually on screen.
export function resolveStalePlanSelection(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): string | null {
  if (selectedPlanId === null) {
    return null
  }

  const matchesReturnedPlan = plans?.current?.id === selectedPlanId || plans?.upcoming?.id === selectedPlanId

  return matchesReturnedPlan ? selectedPlanId : null
}

export function resolvePlanSwitchLink(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): PlanSwitchLink | null {
  const current = plans?.current ?? null
  const upcoming = plans?.upcoming ?? null

  if (current === null || upcoming === null) {
    return null
  }

  const selected = resolveSelectedPlan(plans, selectedPlanId)

  return selected !== null && selected.id === upcoming.id ? 'this' : 'next'
}

// An existing upcoming plan turns the offer into a way to reach it, because a second one cannot be created.
export function resolveLastDayAction(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null,
  selectedDayKey: string
): LastDayAction | null {
  const plan = resolveSelectedPlan(plans, selectedPlanId)

  if (plan === null || !isLastPlanDay(selectedDayKey, plan.endDate)) {
    return null
  }

  return (plans?.upcoming ?? null) !== null ? 'viewNextWeek' : 'planAnotherWeek'
}

export function resolveSelectedPlanDate(plan: MealPlan, storedDate: string | null, now: Date): string {
  return storedDate === null
    ? defaultSelectedPlanDate(plan.startDate, plan.endDate, now)
    : clampDayKeyToPlan(storedDate, plan.startDate, plan.endDate)
}

export function latestLoggedEntry(entries: LoggedEntryRef[]): LoggedEntryRef | null {
  return entries.reduce<LoggedEntryRef | null>(
    (latest, entry) => (latest === null || isLaterEntry(entry, latest) ? entry : latest),
    null
  )
}

/**
 * Read from the logged entries alone. `previousRecipe` records only the most recent swap, so consulting it
 * would lose the meal the user actually ate once a slot has been swapped more than once.
 */
export function resolveMealLoggedState(meal: MealPlanMeal): MealLoggedState {
  const entry = latestLoggedEntry(meal.loggedEntries)

  if (entry === null) {
    return {kind: 'unlogged'}
  }

  const isCurrentRecipeLogged = meal.loggedEntries.some(logged => logged.recipeVersionId === meal.recipe.versionId)

  return isCurrentRecipeLogged ? {kind: 'logged', entry} : {kind: 'loggedThenSwapped', entry}
}

/**
 * The single reason a flagged meal's card states, keyed into the flag copy. Flags that all carry one code name
 * that code's reason; a set whose codes differ can only be stated generically, which is what the fallback reason
 * is for — borrowing one of the specific reasons would tell the user, for instance, that a disliked ingredient
 * is an allergen.
 */
export function resolveMealFlagReason(flags: MealPlanFlag[]): string | null {
  const [firstFlag] = flags

  if (firstFlag === undefined) {
    return null
  }

  return flags.every(flag => flag.code === firstFlag.code)
    ? firstFlag.code
    : PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON
}

export function resolveViewTarget(entryDayKey: string, nowDayKey: string): PostLogViewTarget {
  return entryDayKey === nowDayKey ? 'diary' : 'history'
}

// The width one of `itemCount` equally flexed siblings takes inside `availableWidth`, once the gaps between
// them are removed.
export function flexItemWidth(availableWidth: number, gap: number, itemCount: number): number {
  if (availableWidth <= 0 || itemCount <= 0) {
    return 0
  }

  return (availableWidth - gap * (itemCount - 1)) / itemCount
}
