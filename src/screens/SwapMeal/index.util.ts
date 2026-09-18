import {MealPlanMeal} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {SwapAlternative, SwapMealPayload} from '@data/models/SwapAlternative'
import {
  buildPendingIntent,
  MealPlanStore,
  PendingIntent,
  PendingIntentReservation,
  resolveKeyedRequest,
  resolveReplayableIntent,
  resolveSlotOwnership
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, getApiErrorCode, isPlanOrCapabilityRefusal, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {resolveKeyedLaunch, resolveMountReplay, SlotOwnership, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {dayStripLabel, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {isWriteRefusedByVerdict} from '@utility/MealPlanLifecycleUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'
import {lookupLabel, lookupMember} from '@utility/TextUtility'

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
  STATUS_ANNOUNCEMENT_TEMPLATE,
  stringWithNamedParameters,
  SWAP_ALTERNATIVES_ERROR_TEXT,
  SWAP_ALTERNATIVES_RESULTS_ACCESSIBILITY_TEMPLATE,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_CURRENT_MEAL_LABEL,
  SWAP_CURRENT_MEAL_UNCHANGED_LABEL,
  SWAP_FAILED_BODY_TEMPLATE,
  SWAP_FAILED_TITLE,
  SWAP_NO_ALTERNATIVES_BODY_TEMPLATE,
  SWAP_NO_ALTERNATIVES_TITLE,
  SWAP_RECIPE_INELIGIBLE_TOAST,
  SWAP_STILL_YOURS_TEMPLATE,
  SWAP_TITLE_TEMPLATE,
  TOAST_GENERIC_ERROR
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

// The two places a banner is drawn: 13e's slot above the title, which belongs to commit outcomes, and the
// alternatives area below the current-meal card, which is where a read's failure replaces the list.
export type SwapBannerSlot = 'aboveTitle' | 'alternatives'

// What the call site must do to become able to act again. 'refetchPlan' re-reads the authoritative plan (the
// answer is about the plan the screen is holding); 'reselectAlternative' sends the user back to the list so the
// next attempt is built from a fresh preview; 'exitToPlanTab' leaves this screen for the Macros tab, because the
// capability itself is off — no next move on a swap screen exists, and the tab's entitlement router turns that
// same signal into the unavailable card (0.2.5).
export type SwapTerminalRecovery = 'refetchPlan' | 'reselectAlternative' | 'exitToPlanTab'

// Which request the refusal answered, and the reason the three can never be collapsed: a keyed swap is resolved
// only by an answer to that key, so only 'swap' may retire the pending intent. 'day' and 'alternatives' are both
// reads — either can move the display and trigger a refetch, but a plan that moved on, or a list the server
// refused to assemble, says nothing about whether the swap committed.
export type SwapTerminalSource = 'swap' | 'day' | 'alternatives'

export interface SwapTerminalOutcome {
  code: string
  source: SwapTerminalSource
  toastText: string | null
  recovery: SwapTerminalRecovery
}

// The two commit outcomes a same-key retry can be fired from, which is everything the retry-pending state needs
// in order to keep drawing the outcome it is reconciling. A read's refusal is absent deliberately: it carries no
// idempotency key, so it can never be the outcome a replay is settling.
export type SwapOutcomeMemory = 'failed' | 'unconfirmed'

// An outcome remembered against the attempt that earned it. TanStack clears a mutation's `error` the instant the
// same key is re-`mutate`d, so once a retry is in flight the outcome being retried is unrecoverable from the
// mutation cache and has to be held by the screen. The key is part of the record because the memory may only be
// read back for that key: a later commit is a new attempt and must draw its own outcome, never inherit this one.
export interface SwapOutcomeMemoryRecord {
  attemptKey: string
  outcome: SwapOutcomeMemory
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
  | {kind: 'retrying'; currentMealVariant: 'stillYours' | 'default'; banner: SwapBannerContent}
  | {kind: 'terminal'; currentMealVariant: 'default'; terminal: SwapTerminalOutcome}

export type SwapViewWithAlternatives = Extract<SwapView, {alternatives: readonly SwapAlternative[]}>

export interface SwapViewInput {
  currentMeal: MealPlanMeal | null
  alternatives: readonly SwapAlternative[] | undefined
  isAlternativesPending: boolean
  isAlternativesFetching: boolean
  /** `resolveAlternativesTrust`'s answer: whether the decoded list is still one the server has not contradicted. */
  isAlternativesTrusted: boolean
  alternativesError: unknown
  swapError: unknown
  rememberedOutcome: SwapOutcomeMemory | null
  isAttemptPending: boolean
  isDayPending: boolean
  dayError: unknown
}

export interface OutcomeMemoryInput {
  attemptKey: string | null
  viewKind: SwapView['kind']
  isAttemptPending: boolean
  memory: SwapOutcomeMemoryRecord | null
}

export interface AlternativesTrustInput {
  /** When a refusal last contradicted the list the screen was holding, or null while nothing has. */
  contradictedAt: number | null
  /** The alternatives query's `dataUpdatedAt`: 0 until the key it is running under has answered. */
  alternativesUpdatedAt: number
}

export interface MealMetaInput {
  calories: number | null | undefined
  protein: number | null | undefined
  totalMinutes: number | null | undefined
}

// The route's params plus the alternative the preview bound: what a cold start restores a commit from, rather
// than state held in memory by the screen that navigated here.
export interface SwapCommitInputs {
  planId: string
  mealId: string
  recipeVersionId: string
  portionMultiplier: number
  planRevision: number
}

const NO_ALTERNATIVES: readonly SwapAlternative[] = Object.freeze([])

// None of these refusals can be resolved by replaying the same idempotency key (0.7.2): each one means the
// request the key fingerprints is no longer the request to send, so the caller has to retire the pending intent
// and fix the input first. Codes about the plan the screen holds are re-read from the server; codes about the
// chosen alternative send the user back to the list, where the next attempt builds a fresh preview; the
// capability being off leaves the screen entirely, because re-reading a plan behind a route that answers 503 is
// the one recovery that cannot succeed (0.2.5).
const TERMINAL_RECOVERIES: Partial<Record<string, SwapTerminalRecovery>> = Object.freeze({
  [API_ERROR_CODES.stalePlan]: 'refetchPlan',
  [API_ERROR_CODES.planNotActive]: 'refetchPlan',
  [API_ERROR_CODES.previewStale]: 'reselectAlternative',
  [API_ERROR_CODES.recipeIneligible]: 'reselectAlternative',
  [API_ERROR_CODES.idempotencyConflict]: 'reselectAlternative',
  [API_ERROR_CODES.featureDisabled]: 'exitToPlanTab'
})

// The recovery union as a runtime list: the annotation on TERMINAL_RECOVERIES describes what the table was
// authored with, never what indexing it by a server-supplied code can return, so membership is re-checked.
const SWAP_TERMINAL_RECOVERIES: readonly SwapTerminalRecovery[] = Object.freeze([
  'refetchPlan',
  'reselectAlternative',
  'exitToPlanTab'
])

// A code absent from this map resolves to `toastText: null` deliberately: this release ships no copy specific to
// it, and a module that owns no copy must not invent user-visible text. The screen then reports the failure with
// its own generic error toast rather than naming a cause it cannot describe. `feature_disabled` is absent for a
// stronger reason — its recovery leaves for the card that states the unavailability, so a toast on the way out
// would say the same thing twice (the UNAVAILABLE family of `MealPlanGenerating` is silent for the same reason).
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

// The outcome being retried, redrawn while its replay is in flight. Copy, title and current-meal variant are
// the outcome's own — the green-outlined "Still your lunch" card belongs to the confirmed failure only — so a
// retry changes nothing the user can read except the spinner on the button they just pressed.
const retryingView = (outcome: SwapOutcomeMemory, slot: MealSlot | null): SwapView =>
  outcome === 'failed'
    ? {kind: 'retrying', currentMealVariant: 'stillYours', banner: swapFailedBanner(slot)}
    : {kind: 'retrying', currentMealVariant: 'default', banner: unconfirmedOutcomeBanner()}

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

// The code of an answer that redirects a READ, or null when the failure is one a retry can still resolve. A read
// has no idempotency key to retire, so terminality is not the question here: only the two plan-state codes and
// the capability code carry a next move of their own, and every other failure — including a confirmed validation
// refusal — is the inline retry. The closed sets stay in the classification authority so this screen, the
// generating screen and the Macros entitlement cannot drift apart on what those codes are.
const readRefusalCode = (error: unknown): string | null =>
  isPlanOrCapabilityRefusal(error) ? getApiErrorCode(error) : null

// A refusal carries NO rows. Every alternative is computed for one plan revision, and each of these codes says
// the revision the list was built for is not the one a commit would land against — so the rows beside the
// refusal are candidates the server has just contradicted, and leaving them tappable offers a write that can
// only be refused again. The recovery named in the outcome is what earns rows back: it re-reads the list, and
// the trust clock below keeps the screen off the contradicted array until that answer arrives.
const terminalView = (code: string, source: SwapTerminalSource): SwapView => ({
  kind: 'terminal',
  currentMealVariant: 'default',
  terminal: {
    code,
    source,
    toastText: lookupLabel(TERMINAL_TOASTS, code) ?? null,
    recovery: lookupMember(TERMINAL_RECOVERIES, code, SWAP_TERMINAL_RECOVERIES) ?? 'refetchPlan'
  }
})

/**
 * Whether the decoded alternatives may still be shown.
 *
 * Removing the rows from the refusal is only half the fix: TanStack keeps serving the last successful data, so
 * re-exposing the list the moment the error clears would put the very same contradicted array back on screen
 * (stale-while-revalidate). Trust is therefore restored by a fresh ANSWER and by nothing else — the list is
 * trusted while no refusal has contradicted it, and again once it has answered after the contradiction.
 *
 * A list that answered in the same millisecond as the contradiction is treated as the older of the two: which
 * one it is cannot be told apart, and waiting for the re-read costs a spinner while trusting it wrongly costs a
 * commit against a revision the server has already refused.
 */
export function resolveAlternativesTrust(input: AlternativesTrustInput): boolean {
  return input.contradictedAt === null || input.alternativesUpdatedAt > input.contradictedAt
}

/**
 * The identity of a terminal outcome, for the caller's "recovery already applied" guard.
 *
 * A swap refusal is identified by the attempt that earned it rather than by its code: two commits fired from
 * the preview can be refused with the same code, and the second one still owes its toast, its re-read and its
 * intent retirement — a guard on the code alone would swallow all three and leave the screen on a refusal it
 * never recovers from, with no rows of its own. A read's refusal has no attempt behind it, so its code is its
 * identity, and a read that keeps answering the same way keeps its one recovery.
 */
export function terminalRecoveryKey(terminal: SwapTerminalOutcome, attemptSubmittedAt: number | null): string {
  return terminal.source === 'swap' && attemptSubmittedAt !== null
    ? `${terminal.code}:${attemptSubmittedAt}`
    : terminal.code
}

/**
 * The outcome to remember once this render has been drawn, or null when there is nothing to remember.
 *
 * It exists because a same-key retry destroys the evidence it is retrying: `mutate` resets the entry to
 * `pending` with `error: null`, so without this the screen would fall through to its cached rows mid-flight and
 * let the user open another candidate, overwriting the only key capable of reconciling a lost response (0.7.2).
 *
 * A confirmed failure and an unknown outcome are recorded against the key that earned them; the record survives
 * only while that same key is in flight, and is dropped the moment the key changes or the view resolves to
 * anything else. The record already held is returned unchanged where it still applies, so the caller's ref
 * keeps one object per attempt rather than a fresh one per render.
 */
export function resolveOutcomeMemory(input: OutcomeMemoryInput): SwapOutcomeMemoryRecord | null {
  const {attemptKey, viewKind, isAttemptPending, memory} = input

  if (attemptKey === null) {
    return null
  }

  if (viewKind === 'failed' || viewKind === 'unconfirmed') {
    return memory !== null && memory.attemptKey === attemptKey && memory.outcome === viewKind
      ? memory
      : {attemptKey, outcome: viewKind}
  }

  return memory !== null && memory.attemptKey === attemptKey && isAttemptPending ? memory : null
}

/**
 * The remembered outcome `resolveSwapView` may act on, which is one held for the key now on record and no
 * other: an attempt that has been retired, replaced by a fresh commit, or was never this screen's earns no
 * banner from a previous attempt's failure.
 */
export function rememberedOutcomeForAttempt(
  memory: SwapOutcomeMemoryRecord | null,
  attemptKey: string | null
): SwapOutcomeMemory | null {
  if (memory === null || attemptKey === null || memory.attemptKey !== attemptKey) {
    return null
  }

  return memory.outcome
}

/**
 * Branch order is load-bearing.
 *
 * A replay of the key already on record outranks everything, including a read's refusal: only a server answer
 * to that key can settle whether the commit landed, so nothing a read says may interrupt the reconciliation or
 * hand back rows the user could commit a second swap from. The variant carries no alternatives for that reason.
 *
 * The commit the user just asked for is classified next, and only a confirmed `swap_failed` may draw the
 * assurance that nothing changed — an unknown outcome may have committed, so it takes the neutral variant and no
 * alternatives list. Every other confirmed code is `terminal`: the refusal is final for that idempotency key, so
 * the caller retires the intent and runs the named recovery instead of being handed a list that looks like
 * success (0.7.2).
 *
 * A terminal day answer comes next, outranking both already-decoded data and any in-flight request, because
 * acting on a plan the server has superseded is unsafe — the same precedence `resolveMealPlanBody` gives a
 * decoded stale-plan answer over a refetch. A refusal that is still on record outranks the trust check below it
 * for the same reason in reverse: a plan that is genuinely dead must resolve to its terminal view and its
 * recovery rather than to a spinner waiting for a list it will never be given.
 *
 * An authoritative alternatives answer sits at the same height and for the same two reasons: a plan the server
 * has contradicted may not be acted on from a list drawn beside it, and a capability the server reports off must
 * not sit behind a skeleton or behind rows the cache still holds. It is only the recognised plan-state and
 * capability codes that reach this far (0.2.5) — a network failure, an undecodable body or any other confirmed
 * code stays below the data check, which is what keeps stale-while-revalidate intact.
 *
 * Only then is a missing meal classified, and the day query's own state decides which way: in flight is the
 * skeleton, while a failed request and a settled request that did not carry this meal (deleted, or swapped from
 * another device) are both the day retry card. Reading either of those as "loading" is what would skeleton
 * forever. A non-terminal day failure with the meal already decoded never reaches here, so a failed background
 * refetch cannot blank what the user is reading — the rule `resolveGroceryView` follows.
 *
 * A list a refusal has contradicted is then held back until it has been read again (`resolveAlternativesTrust`):
 * while it is untrusted the screen is 13c's skeleton, or the alternatives retry card once the re-read has
 * settled with an error — never the 13d empty state, and never the contradicted rows the cache still holds.
 *
 * Below that the alternatives are read in the same shape: a decoded empty array is the no-alternatives state and
 * decoded rows are the list, both outranking a mere background failure, because a request that died after the
 * response landed may not blank what the user is already reading (0.2.5). The retry card is for having nothing
 * decoded at all — and absent data is never read as "nothing matches this slot".
 */
export function resolveSwapView(input: SwapViewInput): SwapView {
  const {
    currentMeal,
    alternatives,
    isAlternativesPending,
    isAlternativesFetching,
    isAlternativesTrusted,
    alternativesError,
    swapError,
    rememberedOutcome,
    isAttemptPending,
    isDayPending,
    dayError
  } = input

  if (isAttemptPending && rememberedOutcome !== null) {
    return retryingView(rememberedOutcome, currentMeal?.slot ?? null)
  }

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
      return terminalView(swapTerminalCode, 'swap')
    }
  }

  const dayTerminalCode = terminalCode(dayError)

  if (dayTerminalCode !== null) {
    return terminalView(dayTerminalCode, 'day')
  }

  const alternativesRefusalCode = readRefusalCode(alternativesError)

  if (alternativesRefusalCode !== null) {
    return terminalView(alternativesRefusalCode, 'alternatives')
  }

  if (currentMeal === null) {
    if (isDayPending && !hasError(dayError)) {
      return {kind: 'loading', currentMealVariant: 'default'}
    }

    return {kind: 'error', currentMealVariant: 'default', banner: dayErrorBanner(), retry: 'day'}
  }

  if (!isAlternativesTrusted) {
    return hasError(alternativesError) && !isAlternativesFetching
      ? {kind: 'error', currentMealVariant: 'default', banner: alternativesErrorBanner(), retry: 'alternatives'}
      : {kind: 'loading', currentMealVariant: 'default'}
  }

  if (isAlternativesPending) {
    return {kind: 'loading', currentMealVariant: 'default'}
  }

  if (alternatives !== undefined) {
    return alternatives.length === 0
      ? {kind: 'empty', currentMealVariant: 'unchanged'}
      : {kind: 'list', currentMealVariant: 'default', alternatives}
  }

  if (hasError(alternativesError)) {
    return {kind: 'error', currentMealVariant: 'default', banner: alternativesErrorBanner(), retry: 'alternatives'}
  }

  return {kind: 'loading', currentMealVariant: 'default'}
}

export function rendersAlternatives(view: SwapView): view is SwapViewWithAlternatives {
  return 'alternatives' in view
}

/**
 * Where this view's banner belongs, or null when it has none.
 *
 * The above-title slot is 13e's, and it is the outcome of a COMMIT: the error is what the screen is about, so
 * it precedes the title and the card it makes promises about. A read's failure is not — the title and the
 * current-meal card still stand, and 0.2.5's distinct alternatives error replaces the alternatives area beneath
 * them ("Couldn't find alternatives right now." + "Try again"), which is where 13c's skeleton and 13d's card
 * already draw. The day's failure takes the same slot for the opposite reason: with no meal decoded there is no
 * title and no card above it, so the body is the whole screen.
 */
export function resolveBannerSlot(view: SwapView): SwapBannerSlot | null {
  if (view.kind === 'failed' || view.kind === 'unconfirmed' || view.kind === 'retrying') {
    return 'aboveTitle'
  }

  return view.kind === 'error' ? 'alternatives' : null
}

/**
 * Whether the alternatives list carries frame 13's two explanatory pieces: the "Fits your targets" hint beside
 * the overline, and the footnote promising that opening an alternative replaces nothing.
 *
 * Frame 13e drops BOTH, structurally — its overline block is a single-child column that never holds the hint,
 * and its alternatives card is the last thing on the screen. After a confirmed failure the plan is known
 * unchanged and the banner has already said so, so the screen's job is the error rather than reassurance about
 * what a tap will do. A terminal refusal draws no list at all, so it has nothing to caption: neither the "fits
 * your targets" hint nor the footnote's promise about what opening an alternative does may sit beside a plan
 * the server has just contradicted.
 */
export function rendersAlternativesGuidance(view: SwapView): boolean {
  return view.kind === 'list'
}

/**
 * Whether a busy indicator is drawn beside the outcome banner: true for the retry-pending view and for nothing
 * else.
 *
 * The retry-pending view deliberately redraws the outcome it is reconciling unchanged — same copy, same
 * current-meal variant, same slot — so without an indicator of its own the screen is pixel-identical to the
 * settled outcome the user pressed "Try again" on, while every alternative is suppressed and nothing on screen
 * says why. The banner's own pending treatment is a lowered opacity on the button that was pressed, which is
 * not a progress report, so the indicator is the screen's: it is what distinguishes a same-key replay in flight
 * from a failure the user has to act on again (0.7.2).
 */
export function rendersOutcomeRetrySpinner(view: SwapView): boolean {
  return view.kind === 'retrying'
}

/**
 * The key lifecycle in one predicate (0.7.2). EVERY CONFIRMED ANSWER TO THE KEYED SWAP retires the pending
 * intent, so the next attempt mints a new key — replaying a key the server has already refused could only earn
 * the same refusal, or `idempotency_conflict` once the payload has to change. Two shapes of confirmed answer
 * reach here and both retire:
 *
 * - a terminal refusal of the swap (`stale_plan`, `recipe_ineligible`, `preview_stale`, …);
 * - a confirmed `502 swap_failed`, frame 13e. It persisted nothing (0.5.2), which makes it a confirmed terminal
 *   error and therefore a resolution of the action (0.7.2) — the same answer `SwapPreview`'s
 *   `resolveCommitFailureDisposition` gives the identical outcome, so the two screens that can receive it agree.
 *   The drawn assurance survives the retirement because the screen keeps the answered attempt it is drawing
 *   from; retiring the key is what makes 13e's "Try again" mint a fresh one rather than replay a refusal.
 *
 * Everything else keeps it:
 *
 * - an unknown outcome, because that request may have committed before its response was lost, which leaves its
 *   key the only way to ask again without risking a second swap;
 * - a terminal answer from the DAY or ALTERNATIVES query, because both are reads. Only an answer to the key
 *   itself may resolve the attempt (0.2.5): the plan having moved on — or the alternatives route refusing to
 *   assemble a list for it — does not reveal whether the swap committed, and a cold-start replay runs before any
 *   `swapError` exists, so retiring the key on either read's refusal would abandon a commit that may already be
 *   durable. Such a view still drives its display recovery and refetch; it just may not retire the intent.
 */
export function retiresPendingIntent(view: SwapView): boolean {
  return view.kind === 'failed' || (view.kind === 'terminal' && view.terminal.source === 'swap')
}

/**
 * The request a swap commit sends, as the snapshot stored beside its idempotency key. The swap flow owns this
 * shape — the plan and meal it opened on, the alternative and portion the preview bound — so a launch after a
 * lost response rebuilds the identical request from the same inputs and replays the stored key rather than
 * committing a second swap under a new one (0.7.2). Pair it with `resolveKeyedRequest`, which compares this
 * snapshot's fingerprint with the stored intent's.
 */
export function buildSwapRequest(inputs: SwapCommitInputs): SwapRequestSnapshot {
  return {
    action: 'swap',
    planId: inputs.planId,
    mealId: inputs.mealId,
    recipeVersionId: inputs.recipeVersionId,
    portionMultiplier: inputs.portionMultiplier,
    expectedPlanRevision: inputs.planRevision
  }
}

/**
 * Whether the plan behind this swap has stopped accepting writes.
 *
 * Read from the day envelope's `isWritable` rather than its `planStatus`: a week whose last day has passed
 * stays 'active' in storage so its rows remain readable, and a commit against it is refused
 * `409 plan_not_active {reason: 'ended'}`.
 *
 * ONLY AN ANSWERED `false` IS A REFUSAL, which is what `isWriteRefusedByVerdict` spells. A verdict the day
 * query has not answered — `null` on the display-only seed, `undefined` with no envelope — is NOT an inactive
 * plan: telling the user their plan is gone because a request is still in flight would be a worse lie than
 * letting them reach a commit the server can still refuse. Whether the commit is OFFERED is a separate
 * question, answered by the verdict being positively `true`.
 */
export function isPlanInactive(isPlanWritable: boolean | null | undefined): boolean {
  return isWriteRefusedByVerdict(isPlanWritable)
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

export interface AlternativesAnnouncementInput {
  viewKind: SwapView['kind']
  // The rows ACTUALLY drawn, not the rows the view carries: an unresolved commit holds the swap slot and
  // withholds every row, which leaves the list view's own array irrelevant to what is on screen.
  listedCount: number
  // The meal being replaced, or null while the day has not decoded it — which is also when 13d is not drawn.
  slot: MealSlot | null
}

/**
 * How the alternatives area's resolution is spoken, or null when there is nothing new to say.
 *
 * `accessibilityLiveRegion` is Android-only in RN 0.86, so the two resolutions that are NOT banners — the
 * results overline and frame 13d's empty card — are announced by the screen for VoiceOver; this resolves what
 * it announces. It covers those two and nothing else: every banner state announces itself from inside
 * `InfoBanner`, and speaking here as well would say the same failure twice.
 *
 * Driven by what is rendered rather than by `viewKind` alone. The overline is drawn only once rows are, so a
 * list view whose rows are withheld — `allowsAlternativeSelection` false while an unresolved commit owns the
 * swap slot — announces nothing: "Alternatives, 4 found" over an empty area would be a lie. 13d is drawn only
 * with the meal known, so a null slot has no headline to speak either.
 */
export function resolveAlternativesAnnouncement(input: AlternativesAnnouncementInput): string | null {
  if (input.viewKind === 'list') {
    return input.listedCount > 0
      ? stringWithNamedParameters(SWAP_ALTERNATIVES_RESULTS_ACCESSIBILITY_TEMPLATE, {count: input.listedCount})
      : null
  }

  if (input.viewKind === 'empty' && input.slot !== null) {
    // The card's own headline and body, joined as one sentence: on screen they are two text nodes, and a
    // headline announced without the body that qualifies it says nothing about why nothing matched.
    return stringWithNamedParameters(STATUS_ANNOUNCEMENT_TEMPLATE, {
      title: SWAP_NO_ALTERNATIVES_TITLE,
      body: buildNoAlternativesBody(input.slot)
    })
  }

  return null
}

export interface AnnouncementGuardDecision {
  // The message to speak on this render, or null when this render has nothing new to say.
  announces: string | null
  // What the guard holds afterwards, which the caller writes back to its ref.
  lastAnnounced: string | null
}

/**
 * Whether a resolved announcement is new, given what was last spoken.
 *
 * The guard exists because the message is recomputed every render while the resolution stays on screen, and
 * VoiceOver must not repeat it. Comparing against the last message alone is not enough: the alternatives area
 * genuinely returns to its unresolved wait — the query key changes with the authoritative plan revision and
 * nothing is retained, and an unresolved commit withholds every row — and the copy it resolves to the second
 * time is routinely identical to the first ("Alternatives, 4 found" again, or 13d's card for the same slot).
 * Leaving the last message in place across that wait silences the second resolution, so a null clears it: null
 * is precisely the signal that the resolved view is gone, and the next resolution is a new event however its
 * copy reads. Equal copy while the view never left is still a repeat, and stays silent.
 */
export function resolveAnnouncementGuard(
  message: string | null,
  lastAnnounced: string | null
): AnnouncementGuardDecision {
  if (message === null) {
    return {announces: null, lastAnnounced: null}
  }

  if (message === lastAnnounced) {
    return {announces: null, lastAnnounced}
  }

  return {announces: message, lastAnnounced: message}
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

/**
 * The effect decisions `SwapMeal` makes, as pure functions the screen applies rather than logic buried in its
 * effects. No renderer is installed in this project, so a decision that stays inside `useEffect` cannot be
 * asserted at all; extracted into the derivations below it is pinned by `__tests__/index.util.test.ts` and the
 * screen keeps only the wiring — reading refs and queries, and calling what these functions name.
 *
 * The store's replay API is reached through its pure exports (`resolvePendingIntent`, `resolveKeyedRequest`,
 * `buildPendingIntent`), each of which takes the state slice as an argument; nothing here reads the store, the
 * clock or a key generator on its own, so every answer is a function of its inputs.
 */

export interface UnconfirmedRefetchInput {
  viewKind: SwapView['kind']
  /** `unconfirmedRefetchKey`'s answer for the attempt now on screen, or null when no attempt identifies it. */
  attemptRefetchKey: string | null
  /** The `attemptRefetchKey` whose pair of reads has already been performed, or null while none has. */
  refetchedUnconfirmedKey: string | null
}

export interface UnconfirmedRefetchDecision {
  /**
   * Both reads 0.2.5 names, decided together and guarded together. The day is what shows the swapped meal, and
   * the current plan is what the tab behind this screen renders from — a commit this attempt may already have
   * made moves both, so warming only one leaves the plan the user returns to reporting the meal it replaced.
   */
  refetchesCurrentPlan: boolean
  refetchesPlanDay: boolean
  /**
   * Always false, and typed as the literal so no caller can read it any other way: the refetches an unconfirmed
   * outcome triggers are display-only (0.2.5). They may reveal a commit that landed, but only a server answer to
   * the same idempotency key may resolve the attempt, so a stale-plan answer arriving from either read must
   * neither retire the intent nor replace the copy that promises nothing about what changed.
   */
  resolvesPendingIntent: false
  /** The guard the caller must hold afterwards: the attempt whose pair has now been performed, or the one it already held. */
  refetchedUnconfirmedKey: string | null
}

export interface SwapAttemptGuards {
  /** The `terminalRecoveryKey` of the refusal whose recovery has already been applied (0.7.2). */
  recoveredTerminalKey: string | null
  /** The `unconfirmedRefetchKey` whose display-only pair has already been performed (0.2.5). */
  refetchedUnconfirmedKey: string | null
}

export interface AlternativesRevisionInput {
  dayPlanRevision: number | null | undefined
  openedPlanRevision: number
}

export interface ReplayableSwapInput {
  state: Pick<MealPlanStore, 'pendingIntents'>
  userId: string | null
  planId: string
  mealId: string
  now: number
}

export interface SwapAttempt {
  /**
   * The idempotency key the unresolved attempt was minted for. It travels with the request because it is the
   * only field that identifies the attempt in the shared mutation cache: the commit is fired by the preview
   * screen, which is gone by the time its outcome is drawn here, so this screen owns no hook instance whose
   * status it could read and must match a cache entry instead. The key is what the preview recorded beside the
   * intent immediately before calling `mutate`, and it is the same key a replay re-sends.
   */
  key: string
  request: SwapRequestSnapshot
}

export interface SwapRetryInput {
  state: Pick<MealPlanStore, 'pendingIntents'>
  snapshot: SwapRequestSnapshot
  userId: string
  attemptedAt: number
  freshKey: string
}

/**
 * What `selectSwapAttemptState` needs of a mutation-cache entry, declared structurally rather than imported so
 * the selector stays a pure function of its arguments and is testable without a query client. TanStack's
 * `MutationState` satisfies it, and the selector is generic over the entry type so the caller keeps its own
 * typed `status` and `error` instead of a widened pair.
 */
export interface KeyedMutationState {
  submittedAt: number
  variables: unknown
}

export interface SwapRetryVariables {
  mealId: string
  payload: SwapMealPayload
}

export interface SwapRetryPlan {
  idempotencyKey: string
  isReplay: boolean
  request: SwapRequestSnapshot
  variables: SwapRetryVariables
  intent: PendingIntent
}

/**
 * The identity of the unconfirmed outcome the display-only reads are owed to, or null when no attempt
 * identifies one.
 *
 * Keyed by the attempt exactly as `terminalRecoveryKey` is, and for the same reason: the commit is fired by the
 * preview screen, which resets nothing on this one, so a mount-wide "already refetched" flag would be set by
 * the first unknown outcome and silently swallow the reads every LATER commit is owed — the observability gap
 * 0.2.5's pair exists to close. The idempotency key alone is not enough either, because a replay re-sends it,
 * so the submission time is what separates one attempt's outcome from the next's.
 *
 * Both parts are required: an outcome that cannot be attributed to a submitted attempt earns no reads, because
 * a guard that cannot be written is a guard that cannot hold — the effect would re-read on every render.
 */
export function unconfirmedRefetchKey(attemptKey: string | null, attemptSubmittedAt: number | null): string | null {
  if (attemptKey === null || attemptSubmittedAt === null) {
    return null
  }

  return `${attemptKey}:${attemptSubmittedAt}`
}

/**
 * Whether the unconfirmed outcome on screen still owes its two display-only reads, and the guard value the
 * screen must hold afterwards. One guard covers both because 0.2.5 pairs them: one outcome earns one pair, on
 * ENTERING the state. It is also what keeps them to that pair — the effect re-runs whenever a query object's
 * identity changes, and without the guard a single unconfirmed answer would refetch on every one of those
 * renders.
 *
 * The guard is the attempt's own key rather than a flag, so the pair is earned per outcome and not per mount: a
 * second commit fired from the still-mounted preview screen is a different attempt, and its unknown outcome
 * owes its own pair even though nothing in between reset anything.
 *
 * The retry-pending view is deliberately not a trigger: it is the same attempt still in flight, and its answer
 * is the next outcome, which arrives under a key of its own.
 */
export function resolveUnconfirmedRefetch(input: UnconfirmedRefetchInput): UnconfirmedRefetchDecision {
  const isUnconfirmed = input.viewKind === 'unconfirmed'
  const refetches =
    isUnconfirmed && input.attemptRefetchKey !== null && input.attemptRefetchKey !== input.refetchedUnconfirmedKey

  return {
    refetchesCurrentPlan: refetches,
    refetchesPlanDay: refetches,
    resolvesPendingIntent: false,
    refetchedUnconfirmedKey: refetches ? input.attemptRefetchKey : input.refetchedUnconfirmedKey
  }
}

/**
 * The guards a freshly fired attempt starts from. Both are per-attempt: the next outcome is this attempt's own,
 * so it earns its own display-only refetch and its own terminal recovery rather than being skipped because the
 * previous attempt already applied one.
 */
export function guardsForNewAttempt(): SwapAttemptGuards {
  return {recoveredTerminalKey: null, refetchedUnconfirmedKey: null}
}

/**
 * The revision the alternatives query must run against. Alternatives are only valid for the revision they were
 * computed for, so a day response reporting a newer one moves the query to it — fetching the fresh list under
 * its own key — instead of leaving the screen reading a list the plan has already moved past.
 */
export function resolveAlternativesRevision(input: AlternativesRevisionInput): number {
  const {dayPlanRevision, openedPlanRevision} = input

  if (dayPlanRevision === null || dayPlanRevision === undefined) {
    return openedPlanRevision
  }

  return isPlanRevisionStale(dayPlanRevision, openedPlanRevision) ? dayPlanRevision : openedPlanRevision
}

/**
 * The unresolved commit this screen may replay — its stored request and the key it was minted for — or null when
 * there is nothing replayable. It answers for both replay paths: the silent one this screen fires as it opens
 * and the banner's "Try again". The scope is delegated to the store's one keyed lookup, which applies
 * ownership, the 7-day life and this plan and meal together: an intent for another meal describes a different
 * request, and replaying its key would commit that swap instead of the one on screen. Because the record is
 * scoped that tightly, its key is also a sound identity for the attempt in the shared mutation cache
 * (`selectSwapAttemptState`).
 */
export function resolveReplayableSwap(input: ReplayableSwapInput): SwapAttempt | null {
  const intent = resolveReplayableIntent(input.state, 'swap', input.userId, input.now, {
    planId: input.planId,
    mealId: input.mealId
  })

  // The store's lookup reads the record filed under the `swap` slot and parses it as a swap snapshot, so the
  // check narrows the union rather than guarding a case the lookup can answer with.
  if (intent === null || intent.request.action !== 'swap') {
    return null
  }

  return {key: intent.key, request: intent.request}
}

/**
 * The mutation-cache entry that belongs to `attemptKey`, or null when the cache holds none. This is how the
 * drawn failure states are reached at all: the commit is fired by the preview screen under a key the preview
 * records beside its pending intent, so the attempt is identified by that key and by nothing else. Matching on
 * the meal cannot work — `useSwapMealMutation(planId, mealId)` closes over both and its wire body carries
 * neither, so every entry's variables are a bare `SwapMealPayload`.
 *
 * A null key means there is no unresolved attempt on record, which is the resolved case and draws no banner. The
 * latest submission wins where a key appears twice, because a replay re-sends the same key and the newer entry
 * is the outcome now on screen.
 */
export function selectSwapAttemptState<TState extends KeyedMutationState>(
  states: readonly TState[],
  attemptKey: string | null
): TState | null {
  if (attemptKey === null) {
    return null
  }

  return states
    .filter(state => readIdempotencyKey(state.variables) === attemptKey)
    .reduce<TState | null>(
      (latest, state) => (latest === null || state.submittedAt >= latest.submittedAt ? state : latest),
      null
    )
}

/**
 * What 13e's "Try again" sends: the key the attempt was minted for while the request still fingerprints to the
 * stored intent's, and the freshly minted key otherwise — the decision `resolveKeyedRequest` owns for all four
 * keyed writes (0.7.2). The wire body is read back from the plan's own request rather than from the snapshot
 * this retry was built from, so a replay is byte-identical to the request the key was minted for instead of
 * merely equal by fingerprint. `intent` is the record to re-write before the request leaves.
 */
export function resolveSwapRetryPlan(input: SwapRetryInput): SwapRetryPlan {
  const request = buildSwapRequest({
    planId: input.snapshot.planId,
    mealId: input.snapshot.mealId,
    recipeVersionId: input.snapshot.recipeVersionId,
    portionMultiplier: input.snapshot.portionMultiplier,
    planRevision: input.snapshot.expectedPlanRevision
  })

  const plan = resolveKeyedRequest(input.state, request, input.userId, input.attemptedAt, input.freshKey)

  // `resolveKeyedRequest` consults the intent filed under the request's own action, so a swap request can only
  // come back with a swap snapshot; the check narrows the union rather than guarding a reachable case.
  const sent = plan.request.action === 'swap' ? plan.request : request

  return {
    idempotencyKey: plan.idempotencyKey,
    isReplay: plan.isReplay,
    request: sent,
    variables: {
      mealId: sent.mealId,
      payload: {
        recipeVersionId: sent.recipeVersionId,
        portionMultiplier: sent.portionMultiplier,
        expectedPlanRevision: sent.expectedPlanRevision,
        idempotencyKey: plan.idempotencyKey
      }
    },
    intent: buildPendingIntent(sent, plan.idempotencyKey, input.userId, input.attemptedAt)
  }
}

/**
 * The record that must be confirmed on the device before `key` may go on the wire from this screen (AAP
 * 0.7.2), or null when the slot holds no record answering to it.
 *
 * The mount replay carries a `SwapAttempt` — a key and a body — rather than a record, because the record it
 * was reconstructed from belongs to the store. This hands that record back so the same reservation the retry
 * makes can be made for a replay: normally it is already at rest and the reservation answers from the
 * confirmed slice without touching the device, and when it is not — a write the device refused leaves the
 * record in memory alone, since the store never rolls one back — the write is attempted again before anything
 * is sent.
 *
 * The record is returned as the store holds it, so it keeps its original `createdAt` and restating it cannot
 * extend the 7-day life of a key the user pressed once. The key is compared rather than trusted:
 * `pendingIntents.swap` holds exactly one record, and one filed for a different key is not this attempt's
 * authority to send.
 */
export function resolveSwapReservationRecord(
  state: Pick<MealPlanStore, 'pendingIntents'>,
  key: string
): PendingIntent | null {
  const stored = state.pendingIntents.swap

  return stored !== undefined && stored.key === key ? stored : null
}

/**
 * What an attempt does once `recordPendingIntent` has answered: send it, or refuse it and say so.
 *
 * Both 'unavailable' reasons refuse identically — the persisted slice is unread, or the write was not
 * confirmed — because either way the key this request would carry exists only in this process: a kill between
 * sending it and its answer would leave the next launch nothing to replay, and the user's retry would mint a
 * SECOND key and swap the meal twice.
 *
 * `retainsPendingIntent` turns on whether that key has ever been on the wire. A REPLAYED key has, so its
 * record is the only thing that could reconcile a write that may have committed and it stays exactly as the
 * store leaves it. A FRESHLY MINTED key has not — 13e's retry mints one, because the refused key it is
 * retrying was retired by the answer that refused it — so keeping it would hold the one `swap` slot, and with
 * it this meal's alternatives, behind a request that never left, and would leave a never-sent key for the
 * mount replay to send silently on the next open. Retiring it is not a rollback of a sent request: nothing
 * carried it, so the next press mints again.
 *
 * A null reservation is the attempt that had no record to write — no account to scope one to — and it sends
 * exactly as it did before.
 */
export type SwapAttemptDispatch = {kind: 'send'} | {kind: 'refused'; retainsPendingIntent: boolean; toast: string}

export function resolveSwapAttemptDispatch(
  reservation: PendingIntentReservation | null,
  isReplay: boolean
): SwapAttemptDispatch {
  if (reservation === null || reservation.kind === 'durable') {
    return {kind: 'send'}
  }

  return {kind: 'refused', retainsPendingIntent: isReplay, toast: TOAST_GENERIC_ERROR}
}

export interface SwapMountReplayInput {
  /** The unresolved commit for this user, plan and meal — `resolveReplayableSwap`'s answer. */
  attempt: SwapAttempt | null
  hasHydratedIntents: boolean
  userId: string | null
  isCommitInFlight: boolean
  /** The key this screen has already sent in this lifetime, from the mount replay or from the user's own press. */
  replayedKey: string | null
}

export interface SwapMountReplayDecision {
  replays: boolean
  replayedKey: string | null
  /**
   * The body to send, read out of the STORED snapshot rather than rebuilt from route params or query data, and
   * null whenever `replays` is false. A replay is only answered with the stored result while it is
   * byte-identical to the request the key was minted for; a rebuilt body earns `409 idempotency_conflict` or
   * commits a second swap (0.7.2).
   */
  payload: SwapMealPayload | null
}

export interface SwapInteractionInput {
  /**
   * Who holds the ONE `swap` intent slot, from this plan and meal's point of view — `resolveSwapSlotOwnership`'s
   * answer. It replaces the scoped attempt this decision used to read: that value is non-null exactly when
   * ownership is 'mine', and null for a slot held by ANOTHER meal as well as for an empty one, which is the
   * conflation that let meal B's preview mint over meal A's unresolved key (0.7.2).
   */
  ownership: SlotOwnership
  hasHydratedIntents: boolean
  viewKind: SwapView['kind']
  isCommitInFlight: boolean
  /** Whether the view already draws a commit outcome, so the screen is not silent about what it is waiting for. */
  hasBanner: boolean
}

export interface SwapInteractionDecision {
  allowsAlternativeSelection: boolean
  showsCommitBusyState: boolean
  /**
   * Whether the screen must state that a swap on another meal is still unresolved. The rows are withheld for a
   * foreign holder exactly as they are for this screen's own unresolved commit, and a withheld list with
   * nothing said about it reads as "no alternatives" — so the suppression is announced rather than silent.
   */
  showsForeignHoldNotice: boolean
}

/**
 * Who holds the single `swap` intent slot, told apart into the three cases this screen has to treat
 * differently: empty, this plan and meal's own unresolved commit, and another plan or meal's.
 *
 * `resolveReplayableSwap` cannot answer this. It returns null for a slot held by another meal just as it does
 * for an empty one, and the two are not interchangeable — an empty slot may be minted into, while a slot held
 * elsewhere may not, because `pendingIntents.swap` holds exactly one record and overwriting it abandons the
 * only key that could reconcile a swap the server may already have committed (0.7.2). A cold start on meal B
 * while meal A's commit is unresolved is precisely that case: the mutation cache is empty, so nothing else on
 * this screen knows that a key is outstanding.
 */
export function resolveSwapSlotOwnership(input: ReplayableSwapInput): SlotOwnership {
  return resolveSlotOwnership(input.state, 'swap', input.userId, input.now, {
    planId: input.planId,
    mealId: input.mealId
  }).kind
}

/**
 * The 0.5.2 swap body of an unresolved commit, taken from the stored snapshot and sent under the stored key.
 * Every member is read from `attempt.request`, never from the route or from the alternatives list, because a
 * replay is answered with the stored result only while it reproduces the request the key was minted for
 * (0.7.2) — the same four members `IdempotencyUtility.requestBody` assembles for a swap.
 */
export function resolveSwapCommitPayload(attempt: SwapAttempt): SwapMealPayload {
  return {
    recipeVersionId: attempt.request.recipeVersionId,
    portionMultiplier: attempt.request.portionMultiplier,
    expectedPlanRevision: attempt.request.expectedPlanRevision,
    idempotencyKey: attempt.key
  }
}

/**
 * Whether this screen still owes the unresolved commit its one silent same-key attempt as it opens, and the
 * body that attempt must carry (0.7.2).
 *
 * This is the owner of the swap intent on a cold start: the commit is fired from the preview screen, so after
 * a process death the mutation cache holds nothing, the persisted record is the only trace of what the user
 * asked for, and without a replay the screen would draw ordinary alternatives over a key whose write may
 * already have committed. Readiness is `hasHydratedIntents` AND a known account, because "no intent" and "not
 * yet known" are different answers and deciding early is what mints a second key; the rest of the decision —
 * one replay per key, never while a request is in flight — is `resolveMountReplay`, shared with the other
 * three keyed writes so they cannot answer it differently.
 */
export function resolveSwapMountReplay(input: SwapMountReplayInput): SwapMountReplayDecision {
  const decision = resolveMountReplay({
    intent: input.attempt,
    isReady: input.hasHydratedIntents && input.userId !== null,
    isRequestInFlight: input.isCommitInFlight,
    replayedKey: input.replayedKey
  })

  return {
    replays: decision.replays,
    replayedKey: decision.replayedKey,
    payload: decision.replays && input.attempt !== null ? resolveSwapCommitPayload(input.attempt) : null
  }
}

/**
 * Whether the alternatives may be opened, and what the screen owes the user instead when they are withheld.
 *
 * An unresolved intent must not be replaceable: the preview screen records its own intent in the single `swap`
 * slot, so opening another candidate while a key is still unanswered would overwrite the only record capable
 * of reconciling that write (0.7.2). Selection is therefore withheld until the key resolves — and also until
 * the persisted slice has arrived, since before that the screen does not yet know whether a key is pending.
 *
 * THE SLOT IS GLOBAL, so the suppression is too. `resolveKeyedLaunch` reads the ownership verdict, which
 * distinguishes an empty slot from one held by another plan or meal; anything but a mint or this screen's own
 * replay closes the rows. Judging the slot by this screen's own scope alone — which is what reading the
 * scoped attempt did — made a cold start on meal B see an empty slot while meal A's commit was still
 * unresolved, draw ordinary rows, and let its preview record a fresh key over meal A's. A foreign holder is
 * handed off to its own owner (the Meal Plan tab, or that meal's own swap screen) rather than overwritten.
 *
 * A confirmed `swap_failed` is the one unresolved-looking state that keeps its rows: the server has answered
 * that nothing was written, which is what frame 13e draws the list under, and the answer retires the record in
 * the same pass. A `terminal` answer to the swap itself retires the record too, so its suppression lifts with
 * the write that clears it, while a `terminal` answer from the day or alternatives READ leaves the commit
 * unresolved and keeps the rows away.
 *
 * `showsCommitBusyState` covers the window the view says nothing about — a replay still on the wire, or an
 * outcome the user dismissed while its key stayed unanswered — where the rows are withheld and no banner is
 * drawn. The loading and empty views state themselves, so they are left to it. `showsForeignHoldNotice` is its
 * counterpart for the slot being held elsewhere, which is not this screen's own attempt and has no outcome
 * here to draw. The two are mutually exclusive by construction: one slot cannot be both this meal's and
 * another's.
 */
export function resolveSwapInteraction(input: SwapInteractionInput): SwapInteractionDecision {
  const launch = resolveKeyedLaunch({
    ownership: input.ownership,
    isHydrated: input.hasHydratedIntents,
    isRequestInFlight: input.isCommitInFlight
  })

  const isOwnCommitUnresolved = input.ownership === 'mine' && input.viewKind !== 'failed'
  const holdsForeignIntent = launch.kind === 'blocked' && launch.reason === 'otherResource'

  return {
    allowsAlternativeSelection: launch.kind !== 'blocked' && !isOwnCommitUnresolved,
    showsCommitBusyState:
      isOwnCommitUnresolved && !input.hasBanner && input.viewKind !== 'loading' && input.viewKind !== 'empty',
    showsForeignHoldNotice: holdsForeignIntent && !input.hasBanner
  }
}

const readIdempotencyKey = (variables: unknown): string | null => {
  if (typeof variables !== 'object' || variables === null) {
    return null
  }

  const {idempotencyKey} = variables as Partial<SwapMealPayload>

  return typeof idempotencyKey === 'string' ? idempotencyKey : null
}
