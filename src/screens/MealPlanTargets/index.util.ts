import type {MealPlanPreferences, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {MEAL_SLOTS_IN_WIRE_ORDER} from '@data/models/MealPlanPreferences'
import type {
  NutritionTargetEstimate,
  NutritionTargets,
  SaveEstimatedNutritionTargetsPayload
} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'
import {
  addDaysToDayKey,
  clampDayKeyToPlan,
  formatPlanDayLabel,
  formatPlanRange,
  formatSlotTime,
  PlanStartDateBounds,
  planStartDateBounds
} from '@utility/MealPlanDateUtility'
import {
  confirmedTargetValues,
  formatCalories,
  formatMacroGrams,
  hasAnyTargetValue
} from '@utility/NutritionFormatUtility'
import {buildSaveEstimatedNutritionTargetsPayload} from '@utility/RevisionConflictUtility'
import {lookupLabel} from '@utility/TextUtility'
import {formatMeasurementValue, kilogramsToPounds} from '@utility/UnitConversionUtility'

import {
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_ANSWER_DIET_LABEL,
  MEAL_PLAN_ANSWER_MEALS_LABEL,
  MEAL_PLAN_BUDGET_VALUE_TEMPLATE,
  MEAL_PLAN_CHOSEN_TARGETS_CAPTION,
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

export type DisplayedTargetKey = 'calories' | DisplayedMacroKey

// What the review card leads with, which is also what a Generate press acts on. 'confirmed' is the user's own
// saved set in the one state generation takes as it stands — complete, a source other than 'legacy', and not
// stale (0.7.4). Every other target state reviews the calculated set instead ('estimate'): an account that has
// confirmed nothing, one whose confirmed estimate has been overtaken by a change of goal, body, activity or
// pace, and a legacy or partly filled record the planner would refuse. 'unavailable' is the state with no
// figures at all, where the screen shows the estimate-unavailable card in place of the targets card (0.2.5).
export type DisplayedTargetsSource = 'confirmed' | 'estimate' | 'unavailable'

// Why a Generate press cannot generate. One reason only: there is nothing to work from — no set generation
// accepts and no estimate to confirm — and its recovery is manual entry (0.2.5). Saved figures generation
// would refuse are deliberately not a blocked state: the card reviews the estimate and the press confirms it,
// which is the flow the AAP prescribes for every unconfirmed state (0.7.4).
export type GenerateBlockedReason = 'estimate_unavailable'

export type AnswerRowEditStep = 'goal' | 'diet' | 'dislikes' | 'schedule' | 'cooking'

// What the live Generate press does. 'manual_targets' is the recovery the estimate-unavailable state offers
// (09b manual entry, 0.2.5), and it is offered only once that state has settled — while the estimate is still
// loading the press keeps its drawn meaning and is simply unavailable. The card copy for the figureless state
// belongs to resolveDisplayedTargets' 'unavailable'.
export type GenerateCtaAction = 'generate' | 'manual_targets'

export interface GenerateSequenceInputs {
  targets: NutritionTargets | null
  estimate: NutritionTargetEstimate | null
  preferences: MealPlanPreferences
  startDate: string
}

export interface GenerateSequencePlan {
  requiresTargetConfirmation: boolean
  requiresStartDateSave: boolean
  // Whether the press cannot be decided without a settled estimate: true unless the card leads with a set
  // generation already accepts. It is what lets the CTA wait for the estimate query instead of reading its
  // absence as a failure (0.7.4).
  dependsOnEstimate: boolean
  startDate: string
  estimateRevision: number | null
  expectedTargetsRevision: number
  expectedPreferencesRevision: number
  blockedReason: GenerateBlockedReason | null
}

// The three things a Generate press does, in the order the AAP fixes them (0.7.4): confirm the displayed
// estimate, save a changed review date, then open Generating. Each step carries exactly what its request needs,
// so the caller executes them in order and has nothing left to decide — the identity of the generation (the
// freshly minted idempotency key) and the route context are the caller's to add at the navigation step.
export interface ConfirmTargetsStep {
  kind: 'confirm_targets'
  payload: SaveEstimatedNutritionTargetsPayload
}

export interface SaveReviewDateStep {
  kind: 'save_review_date'
  startDate: string
  expectedRevision: number
}

export interface NavigateToGeneratingStep {
  kind: 'navigate'
  startDate: string
  expectedTargetsRevision: number
  expectedPreferencesRevision: number
}

export type GenerateSequenceStep = ConfirmTargetsStep | SaveReviewDateStep | NavigateToGeneratingStep

export type GenerateSequenceStepKind = GenerateSequenceStep['kind']

// What a save that already succeeded returned. A press that fails partway leaves the steps it completed
// recorded here, so the retry re-runs only what is still unsaved and generation is pinned to the revision the
// completed save produced rather than the one the screen read before it (0.7.4).
export type GenerateStepOutcome =
  | {kind: 'confirm_targets'; targetsRevision: number}
  | {kind: 'save_review_date'; preferencesRevision: number}

export interface GenerateSequenceProgress {
  // The targets revision the confirmation returned, or null while the displayed estimate is unconfirmed.
  confirmedTargetsRevision: number | null
  // The preferences revision the review-date save returned, or null while that date is unsaved.
  savedReviewDateRevision: number | null
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
  missingTargetKeys: DisplayedTargetKey[]
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
  action: GenerateCtaAction
}

// The four target fields are independently nullable on the wire (0.5.2), so a macro row is built only from a
// value the server actually holds. A figure set that reaches the card is whole by construction — a confirmed
// set carries all four values and an estimate is always complete — so a gap is never rendered as a zero.
type PartialMacroFigures = {[K in DisplayedMacroKey]: number | null}

interface DisplayFigures {
  calories: number
  macros: DisplayedMacro[]
}

// What the card leads with: the user's own confirmed figures, the calculated estimate, or nothing at all
// ('none' — no set generation accepts and no estimate to review in its place).
type PrimaryFigures =
  | {kind: 'confirmed'; figures: DisplayFigures}
  | {kind: 'estimate'; figures: DisplayFigures}
  | {kind: 'none'}

// The revision a user with no preferences row carries, which is what the first target save must expect. Declared
// on @data/models/NutritionTargets and re-exported here for the screens and rows that read it from this module.
export {NO_TARGETS_REVISION}

const MACRO_KEYS: DisplayedMacroKey[] = ['protein', 'carbs', 'fat']

// One recovery per blocked reason, so a reason can never reach the CTA without one.
const CTA_ACTION_BY_BLOCKED_REASON: Record<GenerateBlockedReason, GenerateCtaAction> = {
  estimate_unavailable: 'manual_targets'
}

const ALL_TARGET_KEYS: DisplayedTargetKey[] = ['calories', ...MACRO_KEYS]

const PLAN_LAST_DAY_OFFSET = 6

const NO_FIGURE_TEXT = ''

const labelFrom = (labels: Record<string, string>, code: string): string | undefined => lookupLabel(labels, code)

// One row per macro that has a value, in MACRO_KEYS order; a macro with no value contributes no row rather than
// a zero. Only whole figure sets reach this function — a confirmed set carries all four values and an estimate
// is always complete — so in practice it renders three rows, and the nullable branch is what keeps an
// inconsistent payload from inventing a target of 0 g.
// MACRO_KEYS is a closed local union the label map covers in full, so it is indexed directly; labelFrom exists
// for the preference codes below, which arrive from the server and may name something this build cannot label.
const macroRows = (figures: PartialMacroFigures): DisplayedMacro[] =>
  MACRO_KEYS.flatMap(key => {
    const value = figures[key]

    return value === null ? [] : [{key, label: MEAL_PLAN_MACRO_LABELS[key], valueText: formatMacroGrams(value)}]
  })

// The user's own figures in the one state Review treats as settled: generation accepts them as they stand
// (all four values present, a source other than 'legacy' — `confirmedTargetValues`) and the inputs behind them
// have not moved since they were confirmed (`stale`, 0.5.2). Staleness is checked here rather than in the
// shared planner predicate because it is a rule about this screen: generation itself keeps using a confirmed
// estimate until the user reconfirms (0.7.3), and Review is the surface where that reconfirmation happens.
//
// A response that claims `complete` while holding a null value resolves to null here, so an inconsistent
// payload sends the user to the estimate to confirm rather than to a plan built on figures the planner refuses.
const reviewConfirmedFigures = (targets: NutritionTargets | null): DisplayFigures | null => {
  if (targets === null || targets.stale) {
    return null
  }

  const values = confirmedTargetValues(targets)

  return values === null ? null : {calories: values.calories, macros: macroRows(values)}
}

const estimateDisplayFigures = (estimate: NutritionTargetEstimate): DisplayFigures => ({
  calories: estimate.calories,
  macros: macroRows(estimate)
})

// The one rule for what the targets card leads with, read by the display and by the Generate sequence alike.
// Two rules here is how the screen came to show one set of figures and save another: the card led with the
// user's saved numbers while the press confirmed the estimate beside them, replacing what was on screen with
// figures the user had not agreed to. Both answers come from this function, so they cannot disagree.
//
// A confirmed set leads; every other target state — nothing confirmed yet, a stale confirmed set, a legacy or
// partly filled record — reviews the calculated estimate, which is the set the press then confirms (0.7.4).
// The saved figures of a superseded set are not shown beside it: what the card states is what generation will
// use, and the Recalculate link is how the user reaches the editor to change or replace it.
const resolvePrimaryFigures = (
  targets: NutritionTargets | null,
  estimate: NutritionTargetEstimate | null
): PrimaryFigures => {
  const confirmed = reviewConfirmedFigures(targets)

  if (confirmed !== null) {
    return {kind: 'confirmed', figures: confirmed}
  }

  return estimate === null ? {kind: 'none'} : {kind: 'estimate', figures: estimateDisplayFigures(estimate)}
}

const joinFragments = (fragments: string[]): string =>
  fragments.length === 0 ? MEAL_PLAN_VALUE_NONE : fragments.join(MEAL_PLAN_VALUE_SEPARATOR)

// A goal weight is entered to a tenth on the goal step, so it reads back to a tenth: the shared measurement
// formatter is the same rule the step's own fields use, which is what stops a 170.5 lb answer being reviewed as
// 171 lb — and, because the value is stored in kilograms, what stops the pound reading of a whole answer
// arriving as 169.99999999999997. 'kg' is the only metric answer; an unanswered preference falls to pounds,
// which is the app's own default weight unit.
const goalWeightText = (goalWeightKg: number, unitPref: WeightUnitPref | null): string => {
  const isMetric = unitPref === 'kg'
  const value = isMetric ? goalWeightKg : kilogramsToPounds(goalWeightKg)

  return stringWithNamedParameters(MEAL_PLAN_WEIGHT_VALUE_TEMPLATE, {
    value: formatMeasurementValue(value),
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
  // The day view orders meals by time, but a review row lists the schedule the user set, and a snack at 15:30
  // belongs after dinner in that list rather than between lunch and dinner — so the row is built from the wire
  // order @data/models/MealPlanPreferences owns and never from the clock.
  const ordered = MEAL_SLOTS_IN_WIRE_ORDER.flatMap(slot => mealTimes.filter(entry => entry.slot === slot))

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

const DISPLAYED_SOURCE_BY_PRIMARY_KIND: Record<PrimaryFigures['kind'], DisplayedTargetsSource> = {
  confirmed: 'confirmed',
  estimate: 'estimate',
  none: 'unavailable'
}

// The edit link reads as a recalculation exactly when the card is showing the calculated set in place of saved
// figures it supersedes — a stale confirmed set, a legacy record, a partly filled one. That is 0.5.2's "review
// your targets" affordance: the link opens the full editor (09b) on the figures the press would otherwise
// confirm, so the user can change or replace them rather than accept them. With nothing saved, or with a
// confirmed set on screen, the link is the drawn 'Edit'.
const supersedesSavedFigures = (primary: PrimaryFigures, targets: NutritionTargets | null): boolean =>
  primary.kind === 'estimate' && hasAnyTargetValue(targets)

const resolveBlockedReason = (primaryKind: PrimaryFigures['kind']): GenerateBlockedReason | null =>
  primaryKind === 'none' ? 'estimate_unavailable' : null

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
 * What a Generate press does, decided from the same primary figures the card renders.
 *
 * `requiresTargetConfirmation` is true exactly when the card leads with the estimate, because confirming the
 * estimate saves it, and a save the user did not ask for may only happen to the numbers they were looking at.
 * Per 0.7.4 that covers every state except a set generation already accepts:
 *
 *  - a confirmed, fresh set (all four values, source not 'legacy', not stale): generate against it and save
 *    nothing. This is the only state that skips confirmation, and a manual set reaching it skips too.
 *  - a stale confirmed set: the inputs behind it have changed, so the card reviews the recalculated estimate
 *    and the press confirms it — which is what makes the reviewed figures the ones generation uses, and what
 *    returns the new targets revision the generation request has to carry.
 *  - a legacy or partly filled record: generation would answer 422 targets_missing / 409 targets_unconfirmed
 *    (0.5.2), so the same confirmation replaces it with the calculated set the user reviewed. The user who
 *    wants different numbers takes the Recalculate link to the editor instead of pressing Generate.
 *  - no figures at all: blocked as `estimate_unavailable`, whose press goes to manual entry (0.2.5).
 *
 * Both revisions are the values as this screen currently reads them, and each save the sequence performs
 * returns a new one; `nextGenerateStep` derives each later step from the revisions already returned, so the
 * generation request can only ever carry the ones its own saves produced.
 */
export const planGenerateSequence = ({
  targets,
  estimate,
  preferences,
  startDate
}: GenerateSequenceInputs): GenerateSequencePlan => {
  const primary = resolvePrimaryFigures(targets, estimate)

  return {
    requiresTargetConfirmation: primary.kind === 'estimate',
    requiresStartDateSave: startDate !== preferences.reviewStartDate,
    dependsOnEstimate: primary.kind !== 'confirmed',
    startDate,
    estimateRevision: estimate === null ? null : estimate.estimateRevision,
    expectedTargetsRevision: targets === null ? NO_TARGETS_REVISION : targets.revision,
    expectedPreferencesRevision: preferences.revision,
    blockedReason: resolveBlockedReason(primary.kind)
  }
}

/**
 * The estimated-confirmation body the sequence sends before generating, and null when the press confirms
 * nothing — which is the state where the card leads with a confirmed set, so this is also the proof that a
 * Generate press cannot rewrite a saved target the user was never shown.
 */
export const buildTargetConfirmationPayload = (
  plan: GenerateSequencePlan
): SaveEstimatedNutritionTargetsPayload | null =>
  plan.requiresTargetConfirmation && plan.estimateRevision !== null
    ? buildSaveEstimatedNutritionTargetsPayload({
        estimateRevision: plan.estimateRevision,
        targetsRevision: plan.expectedTargetsRevision
      })
    : null

/**
 * A press that has completed no step yet. Every attempt starts here, and a failed attempt leaves behind the
 * progress it did reach so the retry resumes from it.
 */
export const NO_GENERATE_PROGRESS: GenerateSequenceProgress = {
  confirmedTargetsRevision: null,
  savedReviewDateRevision: null
}

/**
 * The one thing a Generate press can do next, given what it has already completed. The press is a short state
 * machine rather than a list, and that is deliberate: the AAP requires generation to carry "the revisions
 * returned by (1)/(2)" (0.7.4), and a revision a save has not performed yet does not exist. Handing the caller
 * a `navigate` step while a confirmation or a date save is still outstanding would hand it the revisions from
 * before those writes, which generation then rejects — so the navigation is not constructed until every save
 * ahead of it has returned and been recorded through `advanceGenerateProgress`.
 *
 * The order is the one 0.7.4 fixes — confirm the displayed estimate, save a changed review date, open
 * Generating — and the caller drives it:
 *
 *     let progress = NO_GENERATE_PROGRESS
 *     for (;;) {
 *       const step = nextGenerateStep(plan, progress)
 *       if (step === null) return                       // nothing this press can do; the CTA action recovers
 *       if (step.kind === 'confirm_targets') {
 *         const saved = await saveTargets(step.payload)  // a failure here leaves `progress` as it was
 *         progress = advanceGenerateProgress(progress, {kind: step.kind, targetsRevision: saved.revision})
 *         continue
 *       }
 *       if (step.kind === 'save_review_date') {
 *         const saved = await saveReviewDate(step)
 *         progress = advanceGenerateProgress(progress, {kind: step.kind, preferencesRevision: saved.revision})
 *         continue
 *       }
 *       navigateToGenerating(step)                      // both revisions are the ones the saves returned
 *       return
 *     }
 *
 * Because a step is derived from the progress recorded so far, the partial-retry rule falls out of the same
 * function: a press that failed at the date save re-derives the date save and never the confirmation, does not
 * bump the target revision a second time, and pins generation to the revision the confirmation returned. The
 * plan is recomputed from fresh inputs on each attempt too, so a refetch that already reports the confirmed
 * targets drops the confirmation the same way — both mechanisms ask only whether the save still has to happen.
 *
 * `null` means this press has nothing it can do, never "finished": a blocked press has no figures to generate
 * from, and a required confirmation with no estimate revision to pin cannot be stated, so generating would
 * build a plan on targets the user never confirmed. The caller stops at the navigation step, which is the
 * sequence's only terminal step.
 *
 * The navigation step carries the two revisions and the start date; the idempotency key and the generation
 * context belong to the caller, which mints a fresh key per intent (0.7.2) and knows which route it is on.
 */
export const nextGenerateStep = (
  plan: GenerateSequencePlan,
  progress: GenerateSequenceProgress = NO_GENERATE_PROGRESS
): GenerateSequenceStep | null => {
  if (plan.blockedReason !== null) {
    return null
  }

  if (plan.requiresTargetConfirmation && progress.confirmedTargetsRevision === null) {
    const payload = buildTargetConfirmationPayload(plan)

    return payload === null ? null : {kind: 'confirm_targets', payload}
  }

  if (plan.requiresStartDateSave && progress.savedReviewDateRevision === null) {
    return {
      kind: 'save_review_date',
      startDate: plan.startDate,
      expectedRevision: plan.expectedPreferencesRevision
    }
  }

  return {
    kind: 'navigate',
    startDate: plan.startDate,
    expectedTargetsRevision: progress.confirmedTargetsRevision ?? plan.expectedTargetsRevision,
    expectedPreferencesRevision: progress.savedReviewDateRevision ?? plan.expectedPreferencesRevision
  }
}

/**
 * The progress a completed save leaves behind, recorded from the revision it returned. Called once per
 * successful step, so that a failure later in the sequence — or a user who leaves and presses Generate again —
 * resumes without repeating a write that already landed.
 */
export const advanceGenerateProgress = (
  progress: GenerateSequenceProgress,
  outcome: GenerateStepOutcome
): GenerateSequenceProgress =>
  outcome.kind === 'confirm_targets'
    ? {...progress, confirmedTargetsRevision: outcome.targetsRevision}
    : {...progress, savedReviewDateRevision: outcome.preferencesRevision}

/**
 * The figures the card states, which are always the figures the Generate press acts on: the user's confirmed
 * set when generation accepts it as it stands, and otherwise the calculated estimate that the press confirms —
 * for an account that has confirmed nothing, for a confirmed set its inputs have moved past, and for a legacy
 * or partly filled record the planner would refuse (0.7.4). The card never mixes the two, so the user is never
 * shown one set of numbers and given a plan built on another.
 *
 * `editLabel` reads as a recalculation exactly in the states where the estimate stands in for saved figures,
 * which is 0.5.2's "review your targets" affordance; it opens the same editor either way. `missingTargetKeys`
 * names every field with no figure, which is all four in the 'unavailable' state — there the screen shows the
 * estimate-unavailable card in place of the targets card (0.2.5), so the numeric fields read empty, not nil.
 *
 * The caption follows the same answer as the card label: a card headed "Your chosen targets" — a saved manual
 * set, or the manual route the user was sent down — cannot also call its figures starting estimates, so it
 * carries the neutral adjustable copy instead.
 */
export const resolveDisplayedTargets = ({targets, estimate, preferences}: DisplayedTargetsInputs): DisplayedTargets => {
  const primary = resolvePrimaryFigures(targets, estimate)
  const figures = primary.kind === 'none' ? null : primary.figures
  const isManualDisplay = targets?.source === 'manual' || preferences.targetRoute === 'manual'

  return {
    source: DISPLAYED_SOURCE_BY_PRIMARY_KIND[primary.kind],
    cardLabel: isManualDisplay ? MEAL_PLAN_CHOSEN_TARGETS_OVERLINE : MEAL_PLAN_DAILY_TARGETS_OVERLINE,
    calories: figures === null ? NO_FIGURE_TEXT : formatCalories(figures.calories),
    unitLabel: MEAL_PLAN_KCAL_UNIT,
    macros: figures === null ? [] : figures.macros,
    caption: isManualDisplay ? MEAL_PLAN_CHOSEN_TARGETS_CAPTION : MEAL_PLAN_TARGETS_CAPTION,
    editLabel: supersedesSavedFigures(primary, targets) ? MEAL_PLAN_RECALCULATE_LINK_TEXT : MEAL_PLAN_EDIT_LINK_TEXT,
    missingTargetKeys: figures === null ? ALL_TARGET_KEYS : []
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

/**
 * The only disabled Generate states are a pending press and an estimate decision that has not settled (0.7.4).
 *
 * The second one is any press whose outcome the estimate still decides — `dependsOnEstimate` — while the
 * estimate query is loading. A first visit is exactly that case and was the one this missed: with no saved
 * targets and no estimate yet, the plan reads as `estimate_unavailable` because the query has not answered,
 * not because it answered that no estimate can be calculated. Leaving the CTA live there offered manual entry
 * over a figure that was about to arrive; waiting costs the user the moment the query takes and then shows
 * them the estimate they came to review.
 *
 * Once the decision settles the CTA keeps the drawn label and stays live: a settled block has nothing left to
 * wait for, so the press carries the user to manual entry, which is the recovery for an estimate that genuinely
 * cannot be calculated (0.2.5). A press whose targets are confirmed never waits for the estimate at all.
 */
export const resolveGenerateCtaState = ({plan, isEstimateLoading, isPending}: GenerateCtaInputs): GenerateCtaState => {
  const awaitsEstimateDecision = plan.dependsOnEstimate && isEstimateLoading
  const settledBlockedReason = awaitsEstimateDecision ? null : plan.blockedReason

  return {
    label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
    isEnabled: !isPending && !awaitsEstimateDecision,
    action: settledBlockedReason === null ? 'generate' : CTA_ACTION_BY_BLOCKED_REASON[settledBlockedReason]
  }
}
