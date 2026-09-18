import {RecipeIngredient} from '@data/models/Recipe'
import {SwapMealPayload, SwapPreview, SwapPreviewAlternative} from '@data/models/SwapAlternative'
import {
  buildPendingIntent,
  MealPlanStore,
  PendingIntent,
  PendingIntentReservation,
  resolveKeyedRequest,
  resolveSlotOwnership
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, getApiErrorCode, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {KeyedLaunchDecision, resolveKeyedLaunch, SlotOwnership, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {dayStripLabel, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {
  isWriteAllowedByVerdict,
  isWriteRefusedByVerdict,
  isWriteVerdictUnknown
} from '@utility/MealPlanLifecycleUtility'
import {formatCalories, formatMacroGrams, formatMacroPair, formatSignedCalories} from '@utility/NutritionFormatUtility'
import {DisplayedIngredient, plannedPortionFactor, scaleIngredientsForDisplay} from '@utility/ServingsUtility'

import type {MetricGridItem} from '@components/MetricGrid4'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE,
  MEAL_SLOT_SENTENCE_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters,
  SWAP_PREVIEW_REPLACING_TEMPLATE,
  SWAP_PREVIEW_SUBTITLE_SEPARATOR,
  SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

export interface SwapCalorieDelta {
  text: string
  tone: 'negative' | 'positive'
}

/**
 * Which assurance a failed commit is allowed to make. A server that answered `swap_failed` has told us nothing
 * was written, so the drawn copy naming the meal unchanged is truthful; an outcome nothing described may have
 * committed before its response was lost, so that variant states only that it could not be confirmed.
 */
export type CommitFailure = 'confirmed' | 'unconfirmed'

export interface SwapCommitDisposition {
  /**
   * The failure to draw in place, or null when the code carries its own recovery — a toast and a way out of
   * this screen — and there is nothing here for the user to retry.
   */
  failure: CommitFailure | null
  retainsPendingIntent: boolean
}

/**
 * Everything that has to be true before this screen may commit a swap — ONE input and ONE answer, because the
 * commit is the only irreversible thing frame 13b does and separate inline conditions are how one of them goes
 * missing. Two families of condition meet here: whether the PLAN still accepts this write (0.5.2) and whether
 * the single keyed slot is free for it (0.7.2).
 *
 * Four of these members mean less than their names suggest. `isHydrated` is true only for a read that
 * SUCCEEDED — a pending and a refused read are both false, because neither knows what the slot holds.
 * `isCommitInFlight` is counted across the app rather than on this hook instance, since any swap on the wire is
 * an answer this one slot is awaiting. `isPlanWritable` is the day envelope's own verdict and the sole
 * authority on whether the plan still accepts writes (0.5.2). And both revision members stay null or undefined
 * until an envelope — respectively a preview — has answered, so an absent revision is "not yet", never a
 * mismatch.
 */
export interface SwapCommitGateInput {
  ownership: SlotOwnership
  isHydrated: boolean
  isCommitInFlight: boolean
  isPlanWritable: boolean | null | undefined
  dayPlanRevision: number | null | undefined
  previewPlanRevision: number | null | undefined
  isPreviewFetching: boolean
}

/**
 * The one answer the commit gate gives, in the terms frame 13b has to draw.
 *
 * `showsForeignHoldNotice` exists so the CTA is never left disabled with nothing on screen explaining it, for
 * as long as another meal's swap key stays unanswered. `isWriteRefused` and `isAwaitingWriteVerdict` are kept
 * apart because an answered `false` verdict is not the same state as no verdict at all: only the former may be
 * explained to the user as a stale-plan refusal.
 */
export interface SwapCommitGateDecision {
  isCommitDisabled: boolean
  isCommitPending: boolean
  showsForeignHoldNotice: boolean
  isWriteRefused: boolean
  isAwaitingWriteVerdict: boolean
}

export interface SwapMacroLegendItem {
  key: 'protein' | 'carbs' | 'fat'
  valueText: string
}

export interface SwapSlotOwnershipInput {
  state: Pick<MealPlanStore, 'pendingIntents'>
  userId: string | null
  planId: string
  mealId: string
  now: number
}

export type SwapCommitBlockedReason = Extract<KeyedLaunchDecision, {kind: 'blocked'}>['reason']

export interface SwapCommitLaunchInput {
  state: Pick<MealPlanStore, 'pendingIntents'>
  request: SwapRequestSnapshot
  userId: string | null
  isHydrated: boolean
  isCommitInFlight: boolean
  attemptedAt: number
  freshKey: string
}

export type SwapCommitLaunch =
  /**
   * Record `intent` — when there is an account to scope it to — and send `payload`, which is the stored
   * request's body under the stored key on a replay and the fresh request's under the minted key otherwise.
   */
  | {kind: 'send'; isReplay: boolean; payload: SwapMealPayload; intent: PendingIntent | null}
  | {kind: 'blocked'; reason: SwapCommitBlockedReason}

/**
 * What the press does once `recordPendingIntent` has answered: send the commit, or refuse it and say so.
 *
 * `retainsPendingIntent` is the half that is easy to get wrong, and it turns on whether the refused key has
 * ever been on the wire. A REPLAYED key has: it was sent before and its write may have committed, so the
 * record is the only thing that could ever reconcile it and it is kept exactly as the store leaves it. A
 * FRESHLY MINTED key has not — this press is the only thing that has ever named it — so keeping it would hold
 * the single `swap` slot (and with it this meal's alternatives, which `SwapMeal` withholds while a key is
 * unresolved) behind an attempt that never happened, and would leave that never-sent key to be replayed
 * silently by the screens that own a cold start. Retiring it is not a rollback of a sent request: nothing
 * carried it, so the next press is free to mint again (0.7.2).
 */
export type SwapCommitDispatch = {kind: 'send'} | {kind: 'refused'; retainsPendingIntent: boolean; toast: string}

/**
 * Whether the reservation the device answered with permits this commit to leave (AAP 0.7.2).
 *
 * A null reservation is the signed-out attempt: `pendingIntents` is user-scoped, so there was no record to
 * write and nothing about durability to learn — the commit leaves under its minted key exactly as it did
 * before, which is the same case `SwapCommitLaunch.intent === null` names.
 *
 * Both 'unavailable' reasons refuse identically, because they differ only in which storage call failed: the
 * slice is unread (a read still out would overwrite the record, a read that rejected makes the adapter refuse
 * every write) or the write itself was not confirmed. Either way the key this request would travel under
 * exists only in this process, so a kill between sending it and its answer would leave nothing to replay and
 * the user's next attempt would mint a SECOND key — a second swap of the same meal.
 */
export function resolveSwapCommitDispatch(
  reservation: PendingIntentReservation | null,
  isReplay: boolean
): SwapCommitDispatch {
  if (reservation === null || reservation.kind === 'durable') {
    return {kind: 'send'}
  }

  return {kind: 'refused', retainsPendingIntent: isReplay, toast: TOAST_GENERIC_ERROR}
}

// Declared by @utility/ServingsUtility, which owns the scaling and formatting this screen shares with recipe
// detail, and re-exported so the screen takes its row shape from its own util
export type {DisplayedIngredient}

export interface SwapPreviewIngredient extends DisplayedIngredient {
  /**
   * This row's React key. See {@link resolvePreviewIngredients} for how it is derived and why the display
   * name it replaces was never an identity.
   */
  key: string
}

// The key separator: a character no catalog id contains, so 'a' at position 11 and 'a1' at position 1 cannot
// collide into one key.
const INGREDIENT_KEY_SEPARATOR = '#'

const previewIngredientKey = (ingredient: RecipeIngredient | undefined, position: number): string =>
  `${ingredient?.catalogFoodId ?? ''}${INGREDIENT_KEY_SEPARATOR}${position}`

type PreviewNutrition = SwapPreviewAlternative['nutrition']

type PreviewDayTotals = SwapPreview['dayTotalsIfSwapped']

type PreviewTargets = SwapPreview['targets']

// A Map rather than an index into MEAL_SLOT_SENTENCE_LABELS: that object literal inherits Object.prototype, so
// indexing it with a slot code a future server release adds would resolve 'constructor' or 'hasOwnProperty' to an
// inherited function. A Map carries only its own string entries, so every code the app does not know reads as absent
const SLOT_SENTENCE_LABELS = new Map<string, string>(Object.entries(MEAL_SLOT_SENTENCE_LABELS))

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

const isUsableTarget = (target: number | null | undefined): target is number =>
  typeof target === 'number' && Number.isFinite(target)

// A target the server left unset has nothing to pair the actual against, so the row degrades to the actual
// alone rather than pairing it with an invented zero
const macroValueText = (actual: number, target: number | null | undefined): string =>
  isUsableTarget(target) ? formatMacroPair(actual, target) : formatMacroGrams(actual)

/**
 * What a failed commit does to the key it was sent under, and what the screen draws instead (AAP 0.7.2).
 *
 * Only an unknown outcome retains the intent. Nothing described that request's fate — it may have committed
 * before its response was lost — so its key is the one way to ask again without risking a second swap, and it
 * stays on record for this screen's retry and for the silent replay the swap screen owes it on next open.
 *
 * Every CONFIRMED answer retires it, `swap_failed` included. A confirmed `502 swap_failed` is a server
 * resolution of that action: the transaction persisted nothing (0.5.2), so the key has answered, and holding
 * it would leave an intent no read can clear while the screen already knows the meal is unchanged. The retry
 * this screen still offers therefore goes out under a freshly minted key — which is exactly what the server
 * requires for the confirmed refusals whose fix changes the payload (`preview_stale`, `stale_plan`,
 * `idempotency_conflict`), since reusing a spent key under a different body earns `409 idempotency_conflict`
 * (0.5.1). The confirmed-failure copy survives in the screen's own state, not in the persisted record.
 */
export function resolveCommitFailureDisposition(error: unknown): SwapCommitDisposition {
  if (isUnknownOutcome(error)) {
    return {failure: 'unconfirmed', retainsPendingIntent: true}
  }

  return {
    failure: getApiErrorCode(error) === API_ERROR_CODES.swapFailed ? 'confirmed' : null,
    retainsPendingIntent: false
  }
}

/**
 * Who holds the single `swap` intent slot, seen from the plan and meal this preview commits against.
 *
 * The three cases are not interchangeable and this screen is where that matters most: it is the one screen
 * that RECORDS a swap intent, so it is the last place a second key can be minted over an unresolved one.
 * 'free' may be minted into, 'mine' is this very request's own unresolved key and is replayed, and 'foreign'
 * is another plan or meal's unresolved key — which is handed back to its own owner, never overwritten,
 * because `pendingIntents.swap` holds exactly one record (0.7.2).
 */
export function resolveSwapSlotOwnership(input: SwapSlotOwnershipInput): SlotOwnership {
  return resolveSlotOwnership(input.state, 'swap', input.userId, input.now, {
    planId: input.planId,
    mealId: input.mealId
  }).kind
}

/**
 * What the commit CTA may do right now, before any press: whether it is offered, whether it reads as pending,
 * and whether the screen owes the user the reason it is closed.
 *
 * THE WRITEABILITY VERDICT HAS THREE STATES AND ONLY ONE OF THEM PERMITS A WRITE. `isWritable` is the day
 * envelope's own answer and the sole authority on it (AAP 0.5.2): the stored `planStatus` still reads 'active'
 * for a week that finished last month, and endedness is judged against the calendar day of the user's saved
 * IANA zone, which this app does not hold. So permission is `=== true` and nothing else. An answered `false`
 * is a refusal, which earns the stale-plan explanation; `null` (the display-only envelope seeded from the
 * cached week) and `undefined` (no envelope at all) are neither, and take the app's ordinary disabled
 * treatment, because telling a user their plan is gone while the read is still in flight would be the worse
 * lie.
 *
 * THE TWO REVISIONS MUST BE KNOWN AND EQUAL. The preview bound its portion, its day totals and its
 * `expectedPlanRevision` to the revision it answered for, and the commit sends that revision back — so a day
 * that has moved on leaves the figures on screen describing a plan the server no longer holds, and the commit
 * would earn `409 preview_stale` at best. A mismatch starts a refetch that re-binds the preview, and the
 * commit stays barred for that whole window rather than being offered against the stale portion. A preview
 * read in flight is therefore also a bar.
 *
 * AND THE ONE KEYED SLOT MUST BE FREE FOR IT. Every verdict `resolveKeyedLaunch` blocks on closes the button,
 * so the same precedence decides the drawn state and the send. Two of its three reasons are self-explaining
 * and need no copy — 'hydrating' is a moment before the persisted slice is known, and 'inFlight' is an attempt
 * already on the wire, both of which the pending CTA states — while 'otherResource' can last until another
 * meal's key is answered, so it is said in words rather than left as a button that does nothing.
 */
export function resolveSwapCommitGate(input: SwapCommitGateInput): SwapCommitGateDecision {
  const launch = resolveKeyedLaunch({
    ownership: input.ownership,
    isHydrated: input.isHydrated,
    isRequestInFlight: input.isCommitInFlight
  })

  // Strict equality over two numbers answers both halves at once: nothing equals `null` or `undefined` under
  // `===`, and a revision that arrived as NaN does not equal itself, so an unknown revision on either side
  // reads as "not bound" rather than as a match.
  const areRevisionsBound =
    typeof input.dayPlanRevision === 'number' &&
    typeof input.previewPlanRevision === 'number' &&
    input.dayPlanRevision === input.previewPlanRevision

  return {
    isCommitDisabled:
      launch.kind === 'blocked' ||
      !isWriteAllowedByVerdict(input.isPlanWritable) ||
      !areRevisionsBound ||
      input.isPreviewFetching,
    isCommitPending: input.isCommitInFlight || !input.isHydrated,
    showsForeignHoldNotice: launch.kind === 'blocked' && launch.reason === 'otherResource',
    isWriteRefused: isWriteRefusedByVerdict(input.isPlanWritable),
    isAwaitingWriteVerdict: isWriteVerdictUnknown(input.isPlanWritable)
  }
}

/**
 * What the press may send, and what it must record before it does (AAP 0.7.2).
 *
 * This is the whole keyed launch in one answer, so the screen cannot reach `mutateAsync` without it. Ownership
 * of the single slot is read from the persisted slice — never from this screen's own scope alone, which is
 * what let a preview on meal B record a fresh key over meal A's unresolved one — and `resolveKeyedLaunch`
 * applies the precedence: nothing leaves while the slice is unread, while an attempt is on the wire, or while
 * another plan or meal holds the slot. A BLOCKED verdict records nothing and sends nothing; there is no branch
 * here that mints beside an unresolved key.
 *
 * A 'replay' sends the STORED snapshot under the STORED key, which `resolveKeyedRequest` hands back whenever
 * the request still fingerprints to the record — the byte-identical replay a lost response requires, answered
 * with the stored result rather than a second commit. Any difference in the payload or the expected revision
 * spends the key, so the freshly minted one is used instead (0.5.1).
 *
 * `intent` is null only when no account is signed in: `pendingIntents` is keyed by user, so there is nothing to
 * scope a record to, and the attempt still goes out under a fresh key exactly as it did before.
 */
export function resolveSwapCommitLaunch(input: SwapCommitLaunchInput): SwapCommitLaunch {
  const ownership = resolveSwapSlotOwnership({
    state: input.state,
    userId: input.userId,
    planId: input.request.planId,
    mealId: input.request.mealId,
    now: input.attemptedAt
  })

  const launch = resolveKeyedLaunch({
    ownership,
    isHydrated: input.isHydrated,
    isRequestInFlight: input.isCommitInFlight
  })

  if (launch.kind === 'blocked') {
    return {kind: 'blocked', reason: launch.reason}
  }

  const plan =
    input.userId === null
      ? {idempotencyKey: input.freshKey, isReplay: false, request: input.request}
      : resolveKeyedRequest(input.state, input.request, input.userId, input.attemptedAt, input.freshKey)

  // `resolveKeyedRequest` consults the record filed under the request's own action, so a swap request can only
  // come back with a swap snapshot; the check narrows the union rather than guarding a reachable case.
  const sent = plan.request.action === 'swap' ? plan.request : input.request

  return {
    kind: 'send',
    isReplay: plan.isReplay,
    payload: {
      recipeVersionId: sent.recipeVersionId,
      portionMultiplier: sent.portionMultiplier,
      expectedPlanRevision: sent.expectedPlanRevision,
      idempotencyKey: plan.idempotencyKey
    },
    intent:
      input.userId === null ? null : buildPendingIntent(sent, plan.idempotencyKey, input.userId, input.attemptedAt)
  }
}

// The confirmed commit refusals this screen fires but does not own. `swap_failed` is the drawn 13e retry, and
// the other two each contradict the plan revision the alternatives behind this screen were computed for — so
// the rows over there have to go, and stay gone until that list has answered again (0.2.5). Every code absent
// from this set still has a next move of its own here: the two plan-state codes and the capability code leave
// the flow entirely, and `idempotency_conflict` retires the key it rejected so the retry mints a fresh one.
const SWAP_MEAL_OWNED_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.swapFailed,
  API_ERROR_CODES.previewStale,
  API_ERROR_CODES.recipeIneligible
])

/**
 * Whether a failed commit's outcome belongs to `SwapMeal` — the screen that draws the swap failure states and
 * holds the alternatives a refusal contradicts — rather than to this one.
 *
 * An outcome nothing described is always its own: the commit may have landed before the response was lost, so
 * nothing here may promise the meal is unchanged and the key stays the only safe way to ask again (0.7.2).
 * Confirmed-ness is therefore not re-checked against the code set: a 5xx that merely echoed one of those
 * strings is an unknown outcome under the one classification, and it is handed back for that reason instead.
 *
 * NULL AND UNDEFINED ARE NOT OUTCOMES, even though the classification reads a missing status as unknown. A
 * rejection carrying no value at all gives `SwapMeal` nothing to attribute — an absent error is no error to
 * its view resolver — so handing one back would land the user on interactive rows with nothing said. It is
 * reported by the caller instead.
 */
export function isOutcomeOwnedBySwapMeal(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false
  }

  if (isUnknownOutcome(error)) {
    return true
  }

  const code = getApiErrorCode(error)

  return code !== null && SWAP_MEAL_OWNED_CODES.has(code)
}

export function deriveCalorieDelta(calorieDelta: number): SwapCalorieDelta | null {
  if (!Number.isFinite(calorieDelta)) {
    return null
  }

  // Rounded exactly as formatSignedCalories rounds it, so a sub-calorie delta resolves to no pill at all: the
  // design has no unchanged state, and the unsigned '0 cal' that formatter returns at zero is not one
  const rounded = Math.round(Math.abs(calorieDelta))

  if (rounded === 0) {
    return null
  }

  return {text: formatSignedCalories(calorieDelta, CAL_LABEL), tone: calorieDelta < 0 ? 'negative' : 'positive'}
}

/** Fraction of the target the day would reach, clamped to 0–1 so the bar's fill can neither overflow nor invert. */
export function calorieProgressRatio(total: number, target: number | null | undefined): number {
  if (!isUsableTarget(target) || target <= 0) {
    return 0
  }

  if (!Number.isFinite(total)) {
    return 0
  }

  return Math.max(0, Math.min(total / target, 1))
}

export function buildSwapMacroLegend(
  dayTotalsIfSwapped: PreviewDayTotals,
  targets: PreviewTargets
): SwapMacroLegendItem[] {
  return [
    {key: 'protein', valueText: macroValueText(dayTotalsIfSwapped.protein, targets.protein)},
    {key: 'carbs', valueText: macroValueText(dayTotalsIfSwapped.carbs, targets.carbs)},
    {key: 'fat', valueText: macroValueText(dayTotalsIfSwapped.fat, targets.fat)}
  ]
}

export function buildThisMealMetrics(
  nutrition: PreviewNutrition
): readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] {
  return [
    {caption: CAL_LABEL, value: formatCalories(nutrition.calories)},
    {caption: PROTEIN_LABEL, value: formatMacroGrams(nutrition.protein)},
    {caption: CARBS_LABEL, value: formatMacroGrams(nutrition.carbs)},
    {caption: FAT_LABEL, value: formatMacroGrams(nutrition.fat)}
  ]
}

/** Natural case ('Replacing lunch · Sat Jul 5'); RecipeHero's context pill applies the uppercase itself. */
export function formatReplacingContext(slot: string, dateKey: string): string {
  const {weekday} = dayStripLabel(dateKey)
  const date = stringWithNamedParameters(MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE, {
    weekday,
    date: formatPlanDayLabel(dateKey)
  })
  const label = SLOT_SENTENCE_LABELS.get(slot)

  if (!isPresent(label)) {
    return date
  }

  return stringWithNamedParameters(SWAP_PREVIEW_REPLACING_TEMPLATE, {slot: label, date})
}

export function formatPreviewSubtitle(portionText: string, totalMinutes: number): string {
  const minutesText =
    Number.isFinite(totalMinutes) && totalMinutes > 0
      ? stringWithNamedParameters(SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE, {minutes: Math.round(totalMinutes)})
      : undefined

  return [portionText.trim(), minutesText].filter(isPresent).join(SWAP_PREVIEW_SUBTITLE_SEPARATOR)
}

/**
 * The ingredient rows of frame 13b — the amounts of the PORTION this preview describes.
 *
 * `SwapPreviewResponse` is asymmetric by design: `alternative.nutrition` is the candidate already scaled to
 * `portionMultiplier`, while `alternative.recipe` is the plain `RecipeVersionResponse`, whose `quantity`,
 * `gramWeight` and pre-formatted `displayText` are WHOLE-RECIPE amounts for `recipe.yieldServings` servings —
 * that DTO carries no planned-meal context, so it cannot know the portion. Rendering the stored `displayText`
 * here therefore put whole-recipe ingredients beside portion-scaled nutrition: '10 oz chicken' against a
 * 305 cal half of a 2-serving recipe.
 *
 * So the same two numbers the server scaled the nutrition by scale the amounts, through the same helper recipe
 * detail's 'Your portion' column uses. No second, pre-scaled ingredient collection is requested from the
 * server: both factors are already in this envelope, and a scaled copy would give one number two sources of
 * truth and put a display-rounding rule in a second place.
 *
 * EACH ROW CARRIES A KEY, because the display name is not an identity contract: names come from the frozen
 * `recipe_ingredients` snapshot and a recipe may legitimately list the same food twice — a marinade and a
 * sauce — which under a name key produces duplicate keys and a reconciliation React cannot resolve. The key
 * is the source row's own `catalogFoodId` plus its position, and both halves are load-bearing: the id alone
 * repeats for exactly that legitimate case, and the position alone would re-key every row below an insertion.
 * `DisplayedIngredient` carries no id of its own — @utility/ServingsUtility answers for the display amounts
 * of two screens and neither of those is a list identity — so the identity is resolved here, beside the
 * ingredients it is read from.
 */
export function resolvePreviewIngredients(
  ingredients: readonly RecipeIngredient[],
  portionMultiplier: number,
  yieldServings: number
): SwapPreviewIngredient[] {
  const rows = scaleIngredientsForDisplay(ingredients, plannedPortionFactor(portionMultiplier, yieldServings))

  // Zipped by index rather than looked up by name, which is the very identity this row is being given a key
  // to stop relying on: `scaleIngredientsForDisplay` maps one row per ingredient in order, so position is the
  // correspondence between the two lists.
  return rows.map((row, position) => ({...row, key: previewIngredientKey(ingredients[position], position)}))
}
