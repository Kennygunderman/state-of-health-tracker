import {MealPlanMeal, MealPlanStatus} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {SwapAlternative} from '@data/models/SwapAlternative'
import {API_ERROR_CODES, getApiErrorCode, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {dayStripLabel, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'

import {
  MEAL_PLAN_COOKING_TIME_CHIP_TEMPLATE,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_MEAL_CALORIES_TEMPLATE,
  MEAL_PLAN_MEAL_PROTEIN_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKDAY_DATE_TEMPLATE,
  MEAL_SLOT_SENTENCE_LABELS,
  stringWithNamedParameters,
  SWAP_ALTERNATIVES_ERROR_TEXT,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_CURRENT_MEAL_LABEL,
  SWAP_CURRENT_MEAL_UNCHANGED_LABEL,
  SWAP_FAILED_BODY_TEMPLATE,
  SWAP_FAILED_TITLE,
  SWAP_NO_ALTERNATIVES_BODY_TEMPLATE,
  SWAP_RECIPE_INELIGIBLE_TOAST,
  SWAP_STILL_YOURS_TEMPLATE,
  SWAP_TITLE_TEMPLATE
} from '@constants/strings'

export type CurrentMealCardVariant = 'default' | 'unchanged' | 'stillYours'

export interface SwapBannerContent {
  tone: 'error'
  glyph: 'alert'
  title?: string
  body: string
  actionLabel: string
  secondaryActionLabel?: string
}

// The screen reads two independent queries, and its one "Try again" has to name the one that failed: retrying
// the alternatives after the day request died would leave the header and current-meal card empty forever.
export type SwapRetryTarget = 'day' | 'alternatives'

// What the call site must do to become able to act again. 'refetchPlan' re-reads the authoritative plan (the
// answer is about the plan the screen is holding); 'reselectAlternative' sends the user back to the list so the
// next attempt is built from a fresh preview.
export type SwapTerminalRecovery = 'refetchPlan' | 'reselectAlternative'

// Which request the refusal answered, and the reason the two can never be collapsed: a keyed swap is resolved
// only by an answer to that key, so only 'swap' may retire the pending intent. 'day' is a read — it can move the
// display and trigger a refetch, but a plan that moved on says nothing about whether the swap committed.
export type SwapTerminalSource = 'swap' | 'day'

export interface SwapTerminalOutcome {
  code: string
  source: SwapTerminalSource
  toastText: string | null
  recovery: SwapTerminalRecovery
}

export type SwapView =
  | {kind: 'loading'; currentMealVariant: 'default'}
  | {kind: 'list'; currentMealVariant: 'default'; alternatives: readonly SwapAlternative[]}
  | {kind: 'empty'; currentMealVariant: 'unchanged'}
  | {kind: 'error'; currentMealVariant: 'default'; banner: SwapBannerContent; retry: SwapRetryTarget}
  | {
      kind: 'failed'
      currentMealVariant: 'stillYours'
      banner: SwapBannerContent
      alternatives: readonly SwapAlternative[]
    }
  | {kind: 'unconfirmed'; currentMealVariant: 'default'; banner: SwapBannerContent}
  | {
      kind: 'terminal'
      currentMealVariant: 'default'
      terminal: SwapTerminalOutcome
      alternatives: readonly SwapAlternative[]
    }

export type SwapViewWithAlternatives = Extract<SwapView, {alternatives: readonly SwapAlternative[]}>

export interface SwapViewInput {
  currentMeal: MealPlanMeal | null
  alternatives: readonly SwapAlternative[] | undefined
  isAlternativesPending: boolean
  alternativesError: unknown
  swapError: unknown
  isDayPending: boolean
  dayError: unknown
}

export interface MealMetaInput {
  calories: number | null | undefined
  protein: number | null | undefined
  totalMinutes: number | null | undefined
}

const NO_ALTERNATIVES: readonly SwapAlternative[] = Object.freeze([])

// None of these refusals can be resolved by replaying the same idempotency key (0.7.2): each one means the
// request the key fingerprints is no longer the request to send, so the caller has to retire the pending intent
// and fix the input first. Codes about the plan the screen holds are re-read from the server; codes about the
// chosen alternative send the user back to the list, where the next attempt builds a fresh preview.
const TERMINAL_RECOVERIES: Partial<Record<string, SwapTerminalRecovery>> = Object.freeze({
  [API_ERROR_CODES.stalePlan]: 'refetchPlan',
  [API_ERROR_CODES.planNotActive]: 'refetchPlan',
  [API_ERROR_CODES.previewStale]: 'reselectAlternative',
  [API_ERROR_CODES.recipeIneligible]: 'reselectAlternative',
  [API_ERROR_CODES.idempotencyConflict]: 'reselectAlternative'
})

// A code absent from this map resolves to `toastText: null` deliberately: this release ships no copy specific to
// it, and a module that owns no copy must not invent user-visible text. The screen then reports the failure with
// its own generic error toast rather than naming a cause it cannot describe.
const TERMINAL_TOASTS: Partial<Record<string, string>> = Object.freeze({
  [API_ERROR_CODES.stalePlan]: MEAL_PLAN_STALE_PLAN_TOAST,
  [API_ERROR_CODES.planNotActive]: MEAL_PLAN_STALE_PLAN_TOAST,
  [API_ERROR_CODES.previewStale]: MEAL_PLAN_STALE_PLAN_TOAST,
  [API_ERROR_CODES.recipeIneligible]: SWAP_RECIPE_INELIGIBLE_TOAST
})

const hasError = (error: unknown): boolean => error !== null && error !== undefined

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

const isMeasurable = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && Number.isFinite(value)

const slotWord = (slot: MealSlot): string => MEAL_SLOT_SENTENCE_LABELS[slot]

// The drawn assurance names the meal it left alone, so it can only be stated once that meal is known: without
// it the banner reports the failure and promises nothing about the plan or the grocery list.
const swapFailedBanner = (slot: MealSlot | null): SwapBannerContent => {
  const assurance = slot === null ? null : stringWithNamedParameters(SWAP_FAILED_BODY_TEMPLATE, {slot: slotWord(slot)})

  return {
    tone: 'error',
    glyph: 'alert',
    title: assurance === null ? undefined : SWAP_FAILED_TITLE,
    body: assurance ?? SWAP_FAILED_TITLE,
    actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
    secondaryActionLabel: SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT
  }
}

const unconfirmedOutcomeBanner = (): SwapBannerContent => ({
  tone: 'error',
  glyph: 'alert',
  title: MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  body: MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  secondaryActionLabel: SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT
})

const alternativesErrorBanner = (): SwapBannerContent => ({
  tone: 'error',
  glyph: 'alert',
  body: SWAP_ALTERNATIVES_ERROR_TEXT,
  actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
})

// Without the meal being replaced there is no slot to name and nothing to compare against, so the day failure
// speaks about the screen rather than about the alternatives it never got to request.
const dayErrorBanner = (): SwapBannerContent => ({
  tone: 'error',
  glyph: 'alert',
  body: MEAL_PLAN_LOAD_ERROR_TITLE,
  actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
})

// A confirmed answer carrying any code other than `swap_failed` is terminal for the key that produced it: the
// 13e failure is the one refusal a same-key retry can still resolve, so it keeps its own state. An unknown
// outcome is never terminal — it may have committed, and its retry must replay the same key (0.7.2).
const terminalCode = (error: unknown): string | null => {
  if (!hasError(error) || isUnknownOutcome(error)) {
    return null
  }

  const code = getApiErrorCode(error)

  return code === null || code === API_ERROR_CODES.swapFailed ? null : code
}

// The list travels with the terminal state so a refusal never strands the user on a blank screen: after the
// recovery step they are back on the alternatives they were already reading.
const terminalView = (
  code: string,
  source: SwapTerminalSource,
  alternatives: readonly SwapAlternative[] | undefined
): SwapView => ({
  kind: 'terminal',
  currentMealVariant: 'default',
  terminal: {
    code,
    source,
    toastText: TERMINAL_TOASTS[code] ?? null,
    recovery: TERMINAL_RECOVERIES[code] ?? 'refetchPlan'
  },
  alternatives: alternatives ?? NO_ALTERNATIVES
})

/**
 * Branch order is load-bearing.
 *
 * The commit the user just asked for is classified first, and only a confirmed `swap_failed` may draw the
 * assurance that nothing changed — an unknown outcome may have committed, so it takes the neutral variant and no
 * alternatives list. Every other confirmed code is `terminal`: the refusal is final for that idempotency key, so
 * the caller retires the intent and runs the named recovery instead of being handed a list that looks like
 * success (0.7.2).
 *
 * A terminal day answer comes next, outranking both already-decoded data and any in-flight request, because
 * acting on a plan the server has superseded is unsafe — the same precedence `resolveMealPlanBody` gives a
 * decoded stale-plan answer over a refetch.
 *
 * Only then is a missing meal classified, and the day query's own state decides which way: in flight is the
 * skeleton, while a failed request and a settled request that did not carry this meal (deleted, or swapped from
 * another device) are both the day retry card. Reading either of those as "loading" is what would skeleton
 * forever. A non-terminal day failure with the meal already decoded never reaches here, so a failed background
 * refetch cannot blank what the user is reading — the rule `resolveGroceryView` follows.
 *
 * Below that, a decoded empty array is the no-alternatives state and a failed request is the retry card: absent
 * data is never read as "nothing matches this slot".
 */
export function resolveSwapView(input: SwapViewInput): SwapView {
  const {currentMeal, alternatives, isAlternativesPending, alternativesError, swapError, isDayPending, dayError} = input

  if (hasError(swapError)) {
    if (isUnknownOutcome(swapError)) {
      return {kind: 'unconfirmed', currentMealVariant: 'default', banner: unconfirmedOutcomeBanner()}
    }

    if (getApiErrorCode(swapError) === API_ERROR_CODES.swapFailed) {
      return {
        kind: 'failed',
        currentMealVariant: 'stillYours',
        banner: swapFailedBanner(currentMeal?.slot ?? null),
        alternatives: alternatives ?? NO_ALTERNATIVES
      }
    }

    // A confirmed answer always carries a decodable code, so the check below narrows the value for the outcome
    // rather than guarding a case the classification can produce.
    const swapTerminalCode = terminalCode(swapError)

    if (swapTerminalCode !== null) {
      return terminalView(swapTerminalCode, 'swap', alternatives)
    }
  }

  const dayTerminalCode = terminalCode(dayError)

  if (dayTerminalCode !== null) {
    return terminalView(dayTerminalCode, 'day', alternatives)
  }

  if (currentMeal === null) {
    if (isDayPending && !hasError(dayError)) {
      return {kind: 'loading', currentMealVariant: 'default'}
    }

    return {kind: 'error', currentMealVariant: 'default', banner: dayErrorBanner(), retry: 'day'}
  }

  if (isAlternativesPending) {
    return {kind: 'loading', currentMealVariant: 'default'}
  }

  if (hasError(alternativesError)) {
    return {kind: 'error', currentMealVariant: 'default', banner: alternativesErrorBanner(), retry: 'alternatives'}
  }

  if (alternatives === undefined) {
    return {kind: 'loading', currentMealVariant: 'default'}
  }

  if (alternatives.length === 0) {
    return {kind: 'empty', currentMealVariant: 'unchanged'}
  }

  return {kind: 'list', currentMealVariant: 'default', alternatives}
}

export function rendersAlternatives(view: SwapView): view is SwapViewWithAlternatives {
  return 'alternatives' in view
}

/**
 * The key lifecycle in one predicate (0.7.2). A terminal refusal OF THE KEYED SWAP retires the pending intent so
 * the next attempt mints a new key — replaying that key could only earn the same refusal, or
 * `idempotency_conflict` once the payload has to change. Everything else keeps it:
 *
 * - a confirmed `swap_failed` and an unknown outcome, because their "Try again" must replay the same key;
 * - a terminal answer from the DAY query, because that is a read. Only an answer to the key itself may resolve
 *   the attempt (0.2.5): the plan having moved on does not reveal whether the swap committed, and a cold-start
 *   replay runs before any `swapError` exists — retiring the key on a day error there would abandon a commit
 *   that may already be durable. Such a view still drives its display recovery and refetch; it just may not
 *   retire the intent.
 */
export function retiresPendingIntent(view: SwapView): boolean {
  return view.kind === 'terminal' && view.terminal.source === 'swap'
}

// A status the day query has not answered yet is not an inactive plan: the flow stays available until the server
// says the plan was superseded, rather than being disabled by its own loading state.
export function isPlanInactive(planStatus: MealPlanStatus | null | undefined): boolean {
  return planStatus !== null && planStatus !== undefined && planStatus !== 'active'
}

export function isPlanRevisionStale(dayPlanRevision: number | null | undefined, openedPlanRevision: number): boolean {
  return dayPlanRevision !== null && dayPlanRevision !== undefined && dayPlanRevision !== openedPlanRevision
}

export function buildSwapTitle(slot: MealSlot): string {
  return stringWithNamedParameters(SWAP_TITLE_TEMPLATE, {slot: slotWord(slot)})
}

export function currentMealEyebrow(variant: CurrentMealCardVariant, slot: MealSlot): string {
  if (variant === 'unchanged') {
    return SWAP_CURRENT_MEAL_UNCHANGED_LABEL
  }

  if (variant === 'stillYours') {
    return stringWithNamedParameters(SWAP_STILL_YOURS_TEMPLATE, {slot: slotWord(slot)})
  }

  return SWAP_CURRENT_MEAL_LABEL
}

export function buildNoAlternativesBody(slot: MealSlot): string {
  return stringWithNamedParameters(SWAP_NO_ALTERNATIVES_BODY_TEMPLATE, {slot: slotWord(slot)})
}

export function buildSwapDateLabel(dayKey: string): string {
  const {weekday} = dayStripLabel(dayKey)

  return stringWithNamedParameters(MEAL_PLAN_WEEKDAY_DATE_TEMPLATE, {weekday, date: formatPlanDayLabel(dayKey)})
}

// One composer for the alternative rows and the current-meal card, so a figure the user compares across the two
// can never be formatted two ways. A value the response left out drops its whole segment, separator included.
export function buildMealMetaText(meta: MealMetaInput): string {
  const segments = [
    isMeasurable(meta.calories)
      ? stringWithNamedParameters(MEAL_PLAN_MEAL_CALORIES_TEMPLATE, {calories: formatCalories(meta.calories)})
      : undefined,
    isMeasurable(meta.protein)
      ? stringWithNamedParameters(MEAL_PLAN_MEAL_PROTEIN_TEMPLATE, {protein: formatMacroGrams(meta.protein)})
      : undefined,
    isMeasurable(meta.totalMinutes)
      ? stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_CHIP_TEMPLATE, {minutes: Math.round(meta.totalMinutes)})
      : undefined
  ]

  return segments.filter(isPresent).join(MEAL_PLAN_VALUE_SEPARATOR)
}

export interface SkeletonAlternativeRow {
  readonly primary: number
  readonly secondary: number
}

// Frame 13c sizes each placeholder bar as a fraction of its row's fill-width text column, so the card matches
// the design on every device rather than only at the 393px reference: Figma's 193.68/129.12, 156.02/107.59 and
// 177.54/139.88 over a 269px column (321px card interior less the 40px tile and the 12px gap), which is 251px
// on a 375px device. They live here rather than in index.styled.ts because they are layout ratios rather than
// design tokens, and a stylesheet may carry no numeric literal. Every row is frozen as well as the array: a
// module-level literal is one shared object per app run, so without this a single render that wrote to a row
// would resize the skeleton for every screen that draws it until the next reload.
export const SKELETON_ALTERNATIVE_ROWS: ReadonlyArray<SkeletonAlternativeRow> = Object.freeze([
  Object.freeze({primary: 0.72, secondary: 0.48}),
  Object.freeze({primary: 0.58, secondary: 0.4}),
  Object.freeze({primary: 0.66, secondary: 0.52})
])

export function skeletonBarWidth(textColumnWidth: number, widthProportion: number): number {
  return textColumnWidth > 0 ? Math.round(textColumnWidth * widthProportion) : 0
}
