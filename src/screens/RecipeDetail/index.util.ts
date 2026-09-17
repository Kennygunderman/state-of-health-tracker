import {MacroTotals} from '@data/models/Macros'
import {MealSlot, RecipeBadge, RecipeIngredient} from '@data/models/Recipe'
import {RecipeDetailContext} from '@navigation/types'
import {
  API_ERROR_CODES,
  classifyOutcome,
  getApiErrorCode,
  getApiErrorStatus,
  isPlanStateError
} from '@utility/ApiErrorUtility'
import {dayStripLabel, formatPlanDayLabel, formatSlotTime} from '@utility/MealPlanDateUtility'
import {
  isWriteAllowedByVerdict,
  isWriteRefusedByVerdict,
  isWriteVerdictUnknown
} from '@utility/MealPlanLifecycleUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'
import {
  DisplayedIngredient,
  plannedPortionFactor,
  scaleIngredientsForDisplay,
  WHOLE_RECIPE_FACTOR
} from '@utility/ServingsUtility'

import {MetricGridItem} from '@components/MetricGrid4'

import {
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

export type IngredientDisplayMode = 'portion' | 'full'

export type RecipeDetailErrorBranch = 'not_found' | 'inline'

/**
 * Which read failed. Kept on the outcome because the three are answered differently: only `/recipes/:id` can
 * say the recipe itself is gone, while the day and preview routes speak about the PLAN the screen is reading
 * that recipe inside.
 */
export type RecipeDetailReadSource = 'recipe' | 'day' | 'preview'

/**
 * What the user is offered for a failed read.
 *
 * - `recipeUnavailable` — the recipe resource answered 404. Nothing here can succeed on a retry, so the screen
 *   says so and leaves (AAP 0.2.5 for `useRecipeDetailQuery`).
 * - `previewIneligible` — the preview route answered a confirmed `recipe_ineligible`: the candidate no longer
 *   fits the plan, which a retry cannot change either. Its own toast, and back to the alternatives
 *   (AAP 0.2.5 for `useSwapPreviewQuery`, whose error rule is stated once per query and therefore holds
 *   wherever that query is observed).
 * - `planRecovery` — a PLAN route contradicted the plan this screen is holding. The recipe may be perfectly
 *   readable, so the screen stays: the stale-plan toast explains it and `mealPlanCurrent` is refetched
 *   (AAP 0.2.5's stale-plan rule).
 * - `retry` — every other failure, including one that never reached a response. The inline card with a
 *   Try-again press and a way back.
 */
export type RecipeDetailReadRecovery = 'recipeUnavailable' | 'previewIneligible' | 'planRecovery' | 'retry'

export interface RecipeDetailReadFailure {
  source: RecipeDetailReadSource
  recovery: RecipeDetailReadRecovery
}

/** What stands in for the recipe while there is none renderable. */
export type RecipeDetailPlaceholder = 'loading' | 'error' | 'none'

export interface RecipeDetailReadState {
  // The error of each read, or null/undefined where it has not failed. `previewError` is always absent outside
  // the preview context, where no preview request is issued at all.
  recipeError: unknown
  dayError: unknown
  previewError?: unknown
  // Whether any ENABLED read is unresolved — pending or fetching — which is what separates "nothing yet" from
  // "nothing, and nothing more is coming". A disabled read is never in flight, so the plan context must not
  // count the preview's permanently pending status here.
  isReadInFlight: boolean
  // Whether the screen holds everything frame 12 needs: the recipe, the planned meal and the portion values.
  hasContent: boolean
}

export interface RecipeDetailReadOutcome {
  // What stands in for the recipe body, or 'none' where the body itself renders.
  placeholder: RecipeDetailPlaceholder
  // The failure a read is still reporting, whether or not content is renderable. NEVER gated on missing data:
  // that is what let a failed refetch hide behind a seeded plan day.
  failure: RecipeDetailReadFailure | null
  // Content is being shown over a read that failed, so it is the last answer this screen received rather than
  // a confirmed one. The banner says so.
  isSavedCopy: boolean
  // No write-bearing action may be offered: either a read failed, or the screen does not yet hold the recipe
  // and planned meal those actions would act on. Strictly wider than `isSavedCopy`, which is about what the
  // user is looking at — a writable day answered beside a recipe still in flight is not a plan the user may
  // log from, and reading only the day's verdict is what offered Log and Swap over a skeleton.
  isWriteUnconfirmed: boolean
}

/** The positional arguments `useSwapPreviewQuery` is called with, and whether it may issue its request. */
export type PreviewQueryScope = readonly [
  planId: string,
  mealId: string,
  recipeVersionId: string,
  planRevision: number,
  isEnabled: boolean
]

export type RecipeDetailRow =
  | {kind: 'ingredient'; key: string; name: string; quantityText: string}
  | {kind: 'instruction'; key: string; step: number; text: string}

export interface RecipeDetailSection {
  key: 'ingredients' | 'instructions'
  data: RecipeDetailRow[]
}

export type PlannedNutritionSource = {planned: MacroTotals} | {perServing: MacroTotals; portionMultiplier: number}

// Declared by @utility/ServingsUtility, which owns the scaling and formatting this screen shares with the swap
// preview, and re-exported so this screen's own surface is unchanged
export type {DisplayedIngredient}

export interface MetricGridCaptions {
  calories: string
  protein: string
  carbs: string
  fat: string
}

export interface ActionBarState {
  isVisible: boolean
  // A press performs the write-bearing navigation. True only for an answered, writable verdict.
  isEnabled: boolean
  // No verdict has arrived, so the bar takes the app's disabled treatment and ignores presses. Distinct from
  // `!isEnabled`, which also covers a plan the server has REFUSED writes on — and that one is explained
  // rather than silently inert.
  isPending: boolean
}

// The factor that rounds a nutrition figure without scaling it. Deliberately not ServingsUtility's
// WHOLE_RECIPE_FACTOR, which is the same number about a different thing: already-planned totals need no
// portion applied, whereas 'Full recipe' means the recipe's own amounts.
const UNSCALED_FACTOR = 1
const NOT_FOUND_STATUS = 404

const FIRST_STEP_NUMBER = 1

// The plan context issues no preview request, so these stand in for the two members only the preview context
// carries. They are deliberately unusable rather than plausible: the query is disabled, and a key built from a
// real plan revision would look like an entry some other screen could read.
const NO_RECIPE_VERSION_ID = ''
const NO_PLAN_REVISION = 0

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

const hasFailed = (error: unknown): boolean => error !== null && error !== undefined

// The two recoveries that leave the screen rather than offering it again. Neither draws a placeholder or a
// saved-copy banner: the screen is already going, and a retry offered on the way out cannot succeed.
const isDeparture = (recovery: RecipeDetailReadRecovery): boolean =>
  recovery === 'recipeUnavailable' || recovery === 'previewIneligible'

/**
 * Stored ingredient quantities are whole-recipe amounts, so 'Your portion' divides the recipe by its yield
 * before applying the planned multiplier while 'Full recipe' leaves the stored amount alone. A yield that
 * cannot divide (zero, negative or non-finite) falls back to the unscaled amount rather than to Infinity.
 *
 * The portion arithmetic itself is @utility/ServingsUtility's, because the swap preview scales the same
 * whole-recipe amounts by the same two numbers — a second copy here is how the two screens came to disagree.
 * The display MODE stays this screen's: only frame 12 has a 'Full recipe' segment.
 */
const displayFactor = (mode: IngredientDisplayMode, portionMultiplier: number, yieldServings: number): number =>
  mode === 'full' ? WHOLE_RECIPE_FACTOR : plannedPortionFactor(portionMultiplier, yieldServings)

// One Math.round per value, applied once to the scaled figure: rounding an already-rounded value or summing
// rounded parts would drift from the totals the server planned the day against
const roundMacroTotals = (totals: MacroTotals, factor: number): MacroTotals => ({
  calories: Math.round(totals.calories * factor),
  protein: Math.round(totals.protein * factor),
  carbs: Math.round(totals.carbs * factor),
  fat: Math.round(totals.fat * factor)
})

export function resolveDisplayedIngredients(
  ingredients: readonly RecipeIngredient[],
  mode: IngredientDisplayMode,
  portionMultiplier: number,
  yieldServings: number
): DisplayedIngredient[] {
  return scaleIngredientsForDisplay(ingredients, displayFactor(mode, portionMultiplier, yieldServings))
}

/**
 * Frame 12's two lists as the sections of one list, so every row is laid out by the virtualizer rather than
 * mapped eagerly into a scroll view (AAP 0.7.4: rows size to content at large dynamic type and stay
 * scroll-reachable above the pinned action bar).
 *
 * Keys are stable across a portion-toggle press. An ingredient's key carries its POSITION as well as its name —
 * a recipe may legitimately list one food twice, and a key that collided would make the virtualizer reuse one
 * cell for two rows — while its quantity is deliberately absent, because that is the one thing the toggle
 * changes and a key that moved with it would discard and rebuild every cell on each press.
 */
export function buildRecipeDetailSections(
  ingredients: readonly DisplayedIngredient[],
  instructions: readonly string[]
): RecipeDetailSection[] {
  return [
    {
      key: 'ingredients',
      data: ingredients.map(
        (ingredient, position): RecipeDetailRow => ({
          kind: 'ingredient',
          key: `ingredient:${position}:${ingredient.name}`,
          name: ingredient.name,
          quantityText: ingredient.quantityText
        })
      )
    },
    {
      key: 'instructions',
      data: instructions.map(
        (text, position): RecipeDetailRow => ({
          kind: 'instruction',
          key: `instruction:${position}`,
          step: position + FIRST_STEP_NUMBER,
          text
        })
      )
    }
  ]
}

/**
 * Whether two projected rows describe the same row, field by field.
 *
 * THE MEMOIZED ROW'S COMPARATOR, and the reason it is not `React.memo`'s default. Every recompute of
 * {@link buildRecipeDetailSections} builds fresh row objects for BOTH sections, so a portion-toggle press —
 * which changes only the ingredient quantities — hands every mounted instruction row a new object with
 * identical contents. A shallow reference comparison fails there and rerenders rows nothing changed about,
 * which is exactly the work the memo boundary exists to avoid. Comparing the discriminated fields instead
 * makes the boundary hold for a row whose content is unchanged, whatever rebuilt it.
 *
 * The key is compared first because it carries the row's position: two rows of the same ingredient at
 * different positions are different rows, however identical their name and amount.
 */
export function isSameRecipeRow(a: RecipeDetailRow, b: RecipeDetailRow): boolean {
  if (a.key !== b.key) {
    return false
  }

  if (a.kind === 'ingredient') {
    return b.kind === 'ingredient' && a.name === b.name && a.quantityText === b.quantityText
  }

  return b.kind === 'instruction' && a.step === b.step && a.text === b.text
}

export function resolvePlannedNutrition(source: PlannedNutritionSource): MacroTotals {
  if ('planned' in source) {
    return roundMacroTotals(source.planned, UNSCALED_FACTOR)
  }

  return roundMacroTotals(source.perServing, source.portionMultiplier)
}

export function buildMetricGridItems(
  nutrition: MacroTotals,
  captions: MetricGridCaptions
): readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] {
  return [
    {caption: captions.calories, value: formatCalories(nutrition.calories)},
    {caption: captions.protein, value: formatMacroGrams(nutrition.protein)},
    {caption: captions.carbs, value: formatMacroGrams(nutrition.carbs)},
    {caption: captions.fat, value: formatMacroGrams(nutrition.fat)}
  ]
}

export function buildContextPillText(
  slot: MealSlot,
  dayKey: string,
  slotTime: string,
  slotLabels: Record<string, string | undefined>
): string {
  const {weekday} = dayStripLabel(dayKey)
  const segments = [
    slotLabels[slot],
    stringWithNamedParameters(MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE, {weekday, date: formatPlanDayLabel(dayKey)}),
    formatSlotTime(slotTime)
  ]

  return segments.filter(isPresent).join(MEAL_PLAN_VALUE_SEPARATOR)
}

// A code the converter could not map to copy is dropped rather than rendered raw, so a badge the server
// adds after this release simply does not appear
export function resolveBadgeLabels(
  badges: readonly RecipeBadge[],
  labels: Record<string, string | undefined>
): string[] {
  return badges.map(badge => labels[badge]).filter(isPresent)
}

export function shouldShowBadgeCaption(labels: readonly string[]): boolean {
  return labels.length > 0
}

/**
 * Whether the action bar is drawn, and whether its two controls do anything.
 *
 * `isPlanWritable` is the day envelope's own verdict (`MealPlanDayEnvelope.isWritable`), not the plan's stored
 * status: a week whose last day has passed stays 'active' in storage so its rows remain readable, and both
 * writes against it are refused `409 plan_not_active {reason: 'ended'}`. Reading the status here offered Log
 * and Swap on a finished week.
 *
 * THE VERDICT HAS THREE STATES AND THE BAR TREATS THEM DIFFERENTLY. An answered `true` enables the controls.
 * An answered `false` leaves them pressable and explains on press, which is how AAP 0.2.5 wants a refusal
 * surfaced — where the user asked for it, not as two controls that quietly do nothing. No answer at all
 * (`null` on the display-only seeded envelope, `undefined` before any envelope) is neither: the verdict is
 * computed in the user's saved zone and nothing local may stand in for it, so the bar takes the app's
 * ordinary disabled treatment until the day route replies. Reporting that state as a refusal would tell a
 * user whose plan is perfectly live that it is no longer active, because their own request is still in
 * flight.
 *
 * `isReadUnconfirmed` is the fourth way the controls can be withheld, and it is about the READ rather than the
 * plan: content shown over a failed read is the last answer this screen received, so the revision both
 * destinations would pin their write to is unconfirmed. That is treated exactly like an unanswered verdict —
 * the disabled treatment, with the saved-copy banner carrying the explanation — because a plan whose state
 * could not be re-read is not a plan whose state was refused. It defaults to false, so a caller that has no
 * failed read passes two arguments.
 */
export function resolveActionBarState(
  contextKind: RecipeDetailContext['kind'],
  isPlanWritable: boolean | null | undefined,
  isReadUnconfirmed = false
): ActionBarState {
  const isRefused = isWriteRefusedByVerdict(isPlanWritable)

  return {
    isVisible: contextKind !== 'preview',
    isEnabled: !isReadUnconfirmed && isWriteAllowedByVerdict(isPlanWritable),
    isPending: isReadUnconfirmed ? !isRefused : isWriteVerdictUnknown(isPlanWritable)
  }
}

/**
 * The branch a failure of THE RECIPE READ takes — `GET /recipes/:recipeVersionId` and nothing else.
 *
 * The decoded error code is accepted so the call site can hand over its whole error shape, but it never moves
 * the branch: on a resource route a 404 is the combined not-found/ownership answer whatever the body carried,
 * and every other outcome — no response, an undecodable body, a 5xx — is the inline retry card.
 *
 * SCOPE IS THE POINT. A 404 means "this recipe is not available to you", which is only ever true of the recipe
 * resource. Handing this function a plan-route error made a missing plan DAY report itself as a missing recipe
 * and pop a screen whose recipe had loaded perfectly; `resolveRecipeDetailRead` is what classifies each read
 * against its own route.
 */
export function resolveRecipeDetailErrorBranch(
  status: number | null | undefined,
  _code: string | null | undefined
): RecipeDetailErrorBranch {
  return status === NOT_FOUND_STATUS ? 'not_found' : 'inline'
}

// The recipe resource's own answer: a 404 is terminal for this screen, everything else is retryable.
const recipeRecovery = (error: unknown): RecipeDetailReadRecovery =>
  resolveRecipeDetailErrorBranch(getApiErrorStatus(error), getApiErrorCode(error)) === 'not_found'
    ? 'recipeUnavailable'
    : 'retry'

/**
 * A PLAN route's answer — the day read, and the preview read that hangs off the same meal.
 *
 * Two outcomes carry the plan's own next move. A CONFIRMED `stale_plan`/`plan_not_active` is the server saying
 * the plan this screen names is not the plan it holds, and a 404 from a plan route is the same thing said by
 * absence: the plan, the meal or the date is no longer the caller's (AAP 0.5.2 never distinguishes missing from
 * not-yours). Both are answered by the stale-plan toast and a `mealPlanCurrent` refetch.
 *
 * Confirmed-ness is load-bearing and deliberately not dropped: a 5xx that merely echoed the string `stale_plan`
 * is an unknown outcome, and sending a user through plan recovery on a gateway body would abandon a screen a
 * second attempt would have loaded. `feature_disabled` is deliberately NOT plan recovery either — the
 * capability state belongs to the Macros entitlement router (AAP 0.2.5), and this screen has no plan of its own
 * to recover, so it offers the inline retry and says nothing it cannot support.
 */
const planRouteRecovery = (error: unknown): RecipeDetailReadRecovery =>
  getApiErrorStatus(error) === NOT_FOUND_STATUS || (classifyOutcome(error) === 'confirmed' && isPlanStateError(error))
    ? 'planRecovery'
    : 'retry'

/**
 * The preview route's answer, which is a plan route with one extra outcome of its own.
 *
 * A CONFIRMED `422 recipe_ineligible` says the candidate no longer fits the plan — the diet, the cooking time
 * or the day's tolerances moved under it. A retry cannot change that, and neither can refetching the current
 * plan, so it is neither the inline card nor plan recovery: it carries its own copy and returns to the
 * alternatives (AAP 0.2.5 states one error rule per query, so this is the same rule the swap preview follows).
 * Confirmed-ness is required here too — a 5xx echoing the code describes nothing, and retiring a candidate on
 * it would discard one the server never refused.
 */
const previewRecovery = (error: unknown): RecipeDetailReadRecovery =>
  classifyOutcome(error) === 'confirmed' && getApiErrorCode(error) === API_ERROR_CODES.recipeIneligible
    ? 'previewIneligible'
    : planRouteRecovery(error)

/**
 * The one failure the screen acts on, chosen from up to three independent reads.
 *
 * ORDER IS LOAD-BEARING. A recipe 404 comes first because its recovery leaves the screen, which makes every
 * other recovery moot. A plan-route refusal comes next — ahead of any merely retryable failure — because a plan
 * the server has contradicted must not be acted on from content drawn beside it, the same precedence the swap
 * screen gives a terminal day answer. Retryable failures come last, recipe first, so the inline card names the
 * read the user is most likely waiting on.
 */
const resolveReadFailure = (state: RecipeDetailReadState): RecipeDetailReadFailure | null => {
  const recipe: RecipeDetailReadFailure | null = hasFailed(state.recipeError)
    ? {source: 'recipe', recovery: recipeRecovery(state.recipeError)}
    : null
  const day: RecipeDetailReadFailure | null = hasFailed(state.dayError)
    ? {source: 'day', recovery: planRouteRecovery(state.dayError)}
    : null
  const preview: RecipeDetailReadFailure | null = hasFailed(state.previewError)
    ? {source: 'preview', recovery: previewRecovery(state.previewError)}
    : null
  const ordered = [recipe, day, preview].filter((candidate): candidate is RecipeDetailReadFailure => candidate !== null)

  return (
    ordered.find(candidate => isDeparture(candidate.recovery)) ??
    ordered.find(candidate => candidate.recovery === 'planRecovery') ??
    ordered[0] ??
    null
  )
}

/**
 * What the screen shows, and what it owes the user about how it got there.
 *
 * THE FAILURE IS RESOLVED INDEPENDENTLY OF WHETHER THERE IS ANYTHING TO SHOW. A plan day arrives seeded from
 * the cached week and a recipe survives in the query cache, so "we have something to render" and "our last read
 * succeeded" are different facts — collapsing them let a network or decode failure render as ordinary,
 * authoritative-looking content. When content and a failure coexist the content is disclosed as a saved copy,
 * which is the only honest reading: the portion, the planned nutrition and the plan revision on screen are the
 * last answer received, not a confirmed one.
 *
 * `isWriteUnconfirmed` is the wider of the two and the one the action bar reads. It covers the saved copy AND
 * the case with no content at all, because the two reads settle independently: the day route can answer
 * `isWritable: true` while the recipe is still in flight or has failed, and a bar gated on the day's verdict
 * alone then offered Log and Swap for a recipe the screen did not have.
 *
 * The placeholder is only ever what stands in for ABSENT content: the loading strip while a read is still in
 * flight, the inline retry card once one has failed, and nothing at all for the two departures — those
 * recoveries are already leaving the screen, and a retry offered on the way out cannot succeed.
 *
 * A fourth case has no error to report and nothing to render either: every read has settled, and the meal this
 * route names is still not in the day it answered with — it was swapped, regenerated or logged away under the
 * screen. That takes the retry card rather than the loading strip, because a skeleton that waits for a read
 * which has already returned never resolves.
 */
export function resolveRecipeDetailRead(state: RecipeDetailReadState): RecipeDetailReadOutcome {
  const failure = resolveReadFailure(state)
  const isLeaving = failure !== null && isDeparture(failure.recovery)
  const placeholder: RecipeDetailPlaceholder =
    state.hasContent || isLeaving ? 'none' : failure === null && state.isReadInFlight ? 'loading' : 'error'

  return {
    placeholder,
    failure,
    isSavedCopy: state.hasContent && failure !== null && !isLeaving,
    isWriteUnconfirmed: !state.hasContent || failure !== null
  }
}

/**
 * The arguments the preview read is made with, and whether it may be made at all.
 *
 * Only the preview context has a candidate to preview, so the plan context passes `false` and the query issues
 * no request — the reason this is a scope rather than a conditional hook call. The two members the plan context
 * cannot supply take deliberately unusable stand-ins, because the arguments are also the cache key and a key
 * built from real ids would name an entry the swap flow could mistake for a real preview.
 */
export function previewQueryScope(context: RecipeDetailContext): PreviewQueryScope {
  return context.kind === 'preview'
    ? [context.planId, context.mealId, context.candidateRecipeVersionId, context.planRevision, true]
    : [context.planId, context.mealId, NO_RECIPE_VERSION_ID, NO_PLAN_REVISION, false]
}
