import {CurrentMealPlans, MealPlan, MealPlanFlag, MealPlanMeal} from '@data/models/MealPlan'
import {MealPlanPreferences, SetupStatus, SetupStep} from '@data/models/MealPlanPreferences'
import {httpStatusOf, isRoutesMissingError, MealPlanAvailability} from '@hooks/mealPlanning/useMealPlanEntitlement.util'
import {RootStackParamList} from '@navigation/types'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {clampDayKeyToPlan, defaultSelectedPlanDate, isLastPlanDay} from '@utility/MealPlanDateUtility'

import Screens from '@constants/screens'
import {PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON} from '@constants/strings'

const NOT_FOUND_STATUS = 404

const STALE_PLAN_CODES: readonly string[] = [API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive]

type SetupResumeRoute =
  | typeof Screens.MEAL_PLAN_GOAL
  | typeof Screens.MEAL_PLAN_ABOUT_YOU
  | typeof Screens.MEAL_PLAN_ACTIVITY
  | typeof Screens.MEAL_PLAN_DIET
  | typeof Screens.MEAL_PLAN_FOOD_PREFERENCES
  | typeof Screens.MEAL_PLAN_SCHEDULE
  | typeof Screens.MEAL_PLAN_COOKING_BUDGET
  | typeof Screens.MEAL_PLAN_TARGETS
  | typeof Screens.MEAL_PLAN_EDIT_TARGETS

/**
 * Route and params in one value, correlated by construction: the mapped type pairs each resume route with
 * that route's own entry in `RootStackParamList`, so a payload cannot be attached to the wrong screen and
 * the caller navigates without inventing params of its own. Every resume target requires params — the eight
 * wizard screens take a `StepMode`, and the manual-target editor takes its own mode-and-return pair.
 */
export type SetupResumeTarget = {
  [Route in SetupResumeRoute]: {route: Route; params: RootStackParamList[Route]}
}[SetupResumeRoute]

// Factories rather than stored values: each call hands the caller its own params object, so a screen that
// adjusts what it received cannot rewrite the resume target of every later session.
const SETUP_RESUME_TARGETS: Record<SetupStep, () => SetupResumeTarget> = {
  goal: () => ({route: Screens.MEAL_PLAN_GOAL, params: {mode: 'setup'}}),
  body: () => ({route: Screens.MEAL_PLAN_ABOUT_YOU, params: {mode: 'setup'}}),
  activity: () => ({route: Screens.MEAL_PLAN_ACTIVITY, params: {mode: 'setup'}}),
  diet: () => ({route: Screens.MEAL_PLAN_DIET, params: {mode: 'setup'}}),
  dislikes: () => ({route: Screens.MEAL_PLAN_FOOD_PREFERENCES, params: {mode: 'setup'}}),
  schedule: () => ({route: Screens.MEAL_PLAN_SCHEDULE, params: {mode: 'setup'}}),
  cooking: () => ({route: Screens.MEAL_PLAN_COOKING_BUDGET, params: {mode: 'setup'}}),
  review: () => ({route: Screens.MEAL_PLAN_TARGETS, params: {mode: 'setup'}}),
  // The manual-target route carries on forward through the wizard into Diet, so the editor resumes in its
  // blank manual mode and returns by navigating there rather than popping back to a screen behind it.
  targets_manual: () => ({
    route: Screens.MEAL_PLAN_EDIT_TARGETS,
    params: {mode: 'manual', returnTo: {kind: 'stack', route: 'diet'}}
  })
}

const EMPTY_PLAN_CTAS: Record<SetupStatus, EmptyPlanCta> = {
  not_started: 'create',
  in_progress: 'continueSetupStep',
  ready_for_review: 'continueSetupReview',
  completed: 'planNextWeek'
}

export type EmptyPlanCta = 'create' | 'continueSetupStep' | 'continueSetupReview' | 'planNextWeek'

/**
 * `isSavedCopy` marks the one plan state that is not live: the plan comes from the persisted
 * `mealPlanCurrent` cache while the request behind it is failing, so the tab renders it read-only under the
 * neutral "showing your last saved plan" banner. A healthy background refetch leaves it `false` — the plan
 * re-renders in place and stays writable.
 */
export type MealPlanBodyOutcome =
  | {kind: 'unavailable'}
  | {kind: 'loading'}
  | {kind: 'error'}
  | {kind: 'plan'; plan: MealPlan; isSavedCopy: boolean}
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
 * Branch order is load-bearing.
 *
 * Unavailability is the entitlement verdict rather than a re-reading of the responses. A decoded stale-plan
 * or resource-route failure invalidates the plan itself, so it outranks everything below — including a plan
 * the cache still holds, which that answer has just contradicted, and an in-flight refetch, behind whose
 * spinner it would be hidden.
 *
 * Every other failure leaves the saved plan standing: `mealPlanCurrent` is persisted precisely so the week
 * survives a lost connection, so a plan in hand is rendered read-only as a saved copy rather than replaced
 * by an error card that hides a week the user can still read. The error card is for having nothing to show.
 * No error path may fall through to `empty`, which would claim the user has no plan when the request merely
 * failed.
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
  const isRefreshFailing = hasError(preferencesError) || hasError(currentPlanError)

  if (plan !== null) {
    return {kind: 'plan', plan, isSavedCopy: isRefreshFailing}
  }

  if (isLoading) {
    return {kind: 'loading'}
  }

  if (isRefreshFailing) {
    return {kind: 'error'}
  }

  return {kind: 'empty', cta: resolveEmptyPlanCta(preferences)}
}

/**
 * Resuming setup opens the saved step itself, so a returning user never meets the introduction again. A step
 * a newer server introduced resolves to the first step rather than to a screen this build cannot render.
 */
export function resolveSetupResumeTarget(step: SetupStep | null): SetupResumeTarget {
  const target = step === null ? undefined : SETUP_RESUME_TARGETS[step]

  return (target ?? SETUP_RESUME_TARGETS.goal)()
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

/**
 * The value the caller stores back. A selection naming a plan the server no longer returns has to be
 * cleared, or it would keep shadowing the plan actually on screen — but only a concrete `{current,
 * upcoming}` response can establish that. An unfetched response carries no evidence either way, so the
 * selection is preserved through it; clearing it there would drop the user back onto the default plan on
 * every cold start, one render before the upcoming week they had chosen arrived.
 */
export function resolveStalePlanSelection(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null
): string | null {
  if (selectedPlanId === null || plans === undefined) {
    return selectedPlanId
  }

  const matchesReturnedPlan = plans.current?.id === selectedPlanId || plans.upcoming?.id === selectedPlanId

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

/**
 * The offer is always about a week other than the one on screen. An existing upcoming plan turns it into a
 * way to reach that week, because a second one cannot be created.
 *
 * Viewing the upcoming plan itself therefore leaves nothing to offer: reaching it is where the user already
 * is, and a further week would be a second plan starting after today, which the server refuses. The card
 * gets no action rather than one that reopens the plan already on screen.
 */
export function resolveLastDayAction(
  plans: CurrentMealPlans | undefined,
  selectedPlanId: string | null,
  selectedDayKey: string
): LastDayAction | null {
  const plan = resolveSelectedPlan(plans, selectedPlanId)

  if (plan === null || !isLastPlanDay(selectedDayKey, plan.endDate)) {
    return null
  }

  const upcoming = plans?.upcoming ?? null

  if (upcoming === null) {
    return 'planAnotherWeek'
  }

  return plan.id === upcoming.id ? null : 'viewNextWeek'
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

// The Diary-versus-History rule is shared with the post-log banner on the logging screen, so it lives in
// @utility/MealPlanDateUtility and this tab only re-exports it under the name its callers use.
export {resolvePostLogViewTarget as resolveViewTarget} from '@utility/MealPlanDateUtility'

// The width one of `itemCount` equally flexed siblings takes inside `availableWidth`, once the gaps between
// them are removed.
export function flexItemWidth(availableWidth: number, gap: number, itemCount: number): number {
  if (availableWidth <= 0 || itemCount <= 0) {
    return 0
  }

  return (availableWidth - gap * (itemCount - 1)) / itemCount
}
