import {SetupStatus, SetupStep} from '@data/models/MealPlanPreferences'
import {RootStackParamList} from '@navigation/types'

import Screens from '@constants/screens'

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

/**
 * Resuming setup opens the saved step itself, so a returning user never meets the introduction again. A step
 * a newer server introduced resolves to the first step rather than to a screen this build cannot render.
 *
 * The status outranks the step when it is given, because the two can disagree: `ready_for_review` means every
 * step of the chosen route is answered and Review is what remains, and the server records that status with a
 * `setupStep` this client may read as `null`. Resolving on the step alone would then send a user whose setup
 * is complete back to the first question. Where no status is passed, the caller has already established that
 * the step is the authority — the tab's no-plan state routes `ready_for_review` to Review itself.
 *
 * It lives in `@utility` rather than in the Meal Plan tab's own util because two trees resume setup — the
 * tab's no-plan state and the introduction's returning-user CTA — and a screen may not import another
 * component's `index.util.ts`. One resolver is what keeps the label a screen shows and the step it opens from
 * describing different progress.
 */
export function resolveSetupResumeTarget(step: SetupStep | null, status?: SetupStatus): SetupResumeTarget {
  if (status === 'ready_for_review') {
    return SETUP_RESUME_TARGETS.review()
  }

  const target = step === null ? undefined : SETUP_RESUME_TARGETS[step]

  return (target ?? SETUP_RESUME_TARGETS.goal)()
}
