import {Meal} from '@data/models/Meal'
import {MealSlot} from '@data/models/Recipe'
import type {LogPlannedMealPayload} from '@queries/api/mealPlanning/logPlannedMeal'
import {
  buildPendingIntent,
  IntentsHydration,
  MealPlanStore,
  PendingIntent,
  resolveReplayableIntent,
  resolveSlotOwnership
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, getApiErrorCode, getApiErrorStatus, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {formatIsoDayMonthDay} from '@utility/DateUtility'
import {
  KeyedLaunchDecision,
  LogRequestSnapshot,
  MountReplayDecision,
  resolveKeyedLaunch,
  resolveMountReplay
} from '@utility/IdempotencyUtility'
import {
  addDaysToDayKey,
  clampDayKeyToPlan,
  formatDayKey,
  formatPlanDayLabel,
  isDayKeyWithin
} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'
import {
  formatServingsDisplay,
  isFractionSelected,
  MIN_SERVINGS,
  PerServingMacros,
  scaleMacros,
  SERVING_FRACTIONS,
  ServingFraction,
  stepServings
} from '@utility/ServingsUtility'

import type {MetricGridItem} from '@components/MetricGrid4'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  LOG_WEIGHT_TODAY_LABEL,
  MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SERVING_FRACTION_NAMES,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_SLOT_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

export const MAX_PLANNED_SERVINGS = 10

const MAX_SERVINGS_DECIMALS = 2

const PLAIN_DECIMAL = /^\d+(\.\d*)?$|^\.\d+$/

// The diary bucket a planned log lands in is matched by the very name the app displays for the slot, so the
// two come from one map. Record<string, string> indexes as string, so the map is read through a widened alias
// that keeps the absent-entry branch reachable instead of handing `undefined` to the matcher.
const SLOT_LABELS: Record<string, string | undefined> = MEAL_SLOT_LABELS

export interface FractionChipState {
  fraction: ServingFraction
  isSelected: boolean
  accessibilityLabel: string
}

export interface ServingsFieldDraft {
  text: string
  baseValue: number
}

export interface DiaryBucketOption {
  mealId: string
  label: string
  sortOrder: number
}

export interface DiaryBucketResolution {
  option: DiaryBucketOption | null
  isFallback: boolean
}

// What a cold start restores a planned log from: the route's plan, meal, revision and date, plus the servings
// the user set and the diary bucket they chose.
export interface PlannedLogInputs {
  planId: string
  mealId: string
  servings: number
  date: string
  diaryMealId: string
  planRevision: number
}

const bucketName = (slot: MealSlot): string => (SLOT_LABELS[slot] ?? slot).trim().toLowerCase()

const matchesBucketName = (meal: Meal, name: string): boolean => meal.name.trim().toLowerCase() === name

const toBucketOption = (meal: Meal): DiaryBucketOption => ({
  mealId: meal.id,
  label: meal.name,
  sortOrder: meal.sortOrder
})

const bySortOrder = (meals: Meal[]): Meal[] => [...meals].sort((first, second) => first.sortOrder - second.sortOrder)

const optionsBySortOrder = (options: DiaryBucketOption[]): DiaryBucketOption[] =>
  [...options].sort((first, second) => first.sortOrder - second.sortOrder)

// Screen-reader pronunciation of ¼ ⅓ ½ ⅔ ¾ is platform-dependent, so the chip carries the fraction spelled out.
const fractionChipAccessibilityLabel = (fraction: ServingFraction): string =>
  stringWithNamedParameters(MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE, {
    fraction: MEAL_PLAN_SERVING_FRACTION_NAMES[fraction.glyph] ?? fraction.glyph
  })

// The diary stores one rounded per-serving snapshot and renders value * servings, so the planned portion has to
// be rounded to that snapshot before it is scaled. Scaling the raw planned floats instead would leave the card
// disagreeing with the entry the server writes by up to a whole unit per macro.
export function plannedPortionSnapshot(planned: PerServingMacros): PerServingMacros {
  return {
    calories: Math.round(planned.calories),
    protein: Math.round(planned.protein),
    carbs: Math.round(planned.carbs),
    fat: Math.round(planned.fat)
  }
}

export function thisAddsTotals(planned: PerServingMacros, servings: number): PerServingMacros {
  return scaleMacros(plannedPortionSnapshot(planned), servings)
}

export function buildThisAddsItems(
  totals: PerServingMacros
): readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] {
  return [
    {caption: CAL_LABEL, value: formatCalories(totals.calories)},
    {caption: PROTEIN_LABEL, value: formatMacroGrams(totals.protein)},
    {caption: CARBS_LABEL, value: formatMacroGrams(totals.carbs)},
    {caption: FAT_LABEL, value: formatMacroGrams(totals.fat)}
  ]
}

export function nextPlannedServings(servings: number, direction: 1 | -1): number {
  const stepped = stepServings(servings, direction)

  return Math.min(Math.max(stepped, MIN_SERVINGS), MAX_PLANNED_SERVINGS)
}

// The log endpoint takes servings in [0.25, 10] with at most two decimals (0.5.2), so a third decimal is
// invalid input rather than input to round: rounding it would log a portion the user never chose ('0.249'
// as a quarter, '10.004' as ten) and the endpoint would accept that different value without complaint.
export function parsePlannedServingsInput(text: string): number | null {
  const normalized = text.replace(',', '.').trim()

  if (!PLAIN_DECIMAL.test(normalized)) return null

  const separatorIndex = normalized.indexOf('.')

  if (separatorIndex !== -1 && normalized.length - separatorIndex - 1 > MAX_SERVINGS_DECIMALS) return null

  const parsed = parseFloat(normalized)

  if (!Number.isFinite(parsed)) return null

  if (parsed < MIN_SERVINGS || parsed > MAX_PLANNED_SERVINGS) return null

  return parsed
}

// The servings field has to keep raw keystrokes ('', '0.', '1,') while they are being typed, yet follow the
// authoritative value whenever something other than this field moves it — a stepper press, a fraction chip, a parent
// reset or a refetch. baseValue records the value the text was typed against: the screen adopts a parseable keystroke
// and ignores anything else, so a draft whose baseValue no longer equals the value was overtaken from outside and is
// rebased, while an echo of the user's own keystroke is not.
export function beginServingsDraft(value: number): ServingsFieldDraft {
  return {text: formatServingsDisplay(value), baseValue: value}
}

export function nextServingsDraft(text: string, value: number): ServingsFieldDraft {
  return {text, baseValue: parsePlannedServingsInput(text) ?? value}
}

export function isServingsDraftStale(draft: ServingsFieldDraft | null, value: number): boolean {
  return draft !== null && draft.baseValue !== value
}

// A locked field discards its draft as well as a stale one. The lock arrives while the field may be focused —
// the persisted intent slice comes back mid-edit, or another attempt takes the slot — and a draft held past
// that moment would keep displaying a portion that no attempt from this screen can send, while the replay
// carries the stored one. Dropping it rebases the field onto the confirmed value in the same render pass
// (servingsFieldText), so what is on screen is always what would be sent.
export function shouldDiscardServingsDraft(
  draft: ServingsFieldDraft | null,
  value: number,
  isDisabled: boolean
): boolean {
  return draft !== null && (isDisabled || isServingsDraftStale(draft, value))
}

export function servingsFieldText(value: number, draft: ServingsFieldDraft | null): string {
  return draft === null || isServingsDraftStale(draft, value) ? formatServingsDisplay(value) : draft.text
}

export function buildFractionChipStates(servings: number): readonly FractionChipState[] {
  return SERVING_FRACTIONS.map(fraction => ({
    fraction,
    isSelected: isFractionSelected(servings, fraction.value),
    accessibilityLabel: fractionChipAccessibilityLabel(fraction)
  }))
}

export function resolveDiaryBucket(meals: Meal[], slot: MealSlot): DiaryBucketResolution {
  const canonical = bucketName(slot)
  const sorted = bySortOrder(meals)
  const matched = sorted.find(meal => matchesBucketName(meal, canonical))

  if (matched) return {option: toBucketOption(matched), isFallback: false}

  const [lowestSortOrder] = sorted

  return {option: lowestSortOrder === undefined ? null : toBucketOption(lowestSortOrder), isFallback: true}
}

// A partially renamed diary day (Brunch, Lunch, Dinner against breakfast/lunch/dinner slots) resolves the unmatched
// slot to a fallback bucket, so the canonical matches alone would omit the very bucket the picker preselects. The
// option list is therefore the union of the matches and every bucket resolveDiaryBucket can land on for this plan.
export function buildDiaryBucketOptions(meals: Meal[], planSlots: readonly MealSlot[]): readonly DiaryBucketOption[] {
  const plannedNames = planSlots.map(bucketName)
  const planBuckets = meals.filter(meal => plannedNames.some(name => matchesBucketName(meal, name)))

  if (planBuckets.length === 0) return bySortOrder(meals).map(toBucketOption)

  const resolved = planSlots
    .map(slot => resolveDiaryBucket(meals, slot).option)
    .filter((option): option is DiaryBucketOption => option !== null)

  const byMealId = new Map<string, DiaryBucketOption>()

  planBuckets.map(toBucketOption).forEach(option => byMealId.set(option.mealId, option))
  resolved.forEach(option => byMealId.set(option.mealId, option))

  return optionsBySortOrder([...byMealId.values()])
}

export function canStepLogDate(dayKey: string, direction: 1 | -1, planStartDate: string, planEndDate: string): boolean {
  return isDayKeyWithin(addDaysToDayKey(dayKey, direction), planStartDate, planEndDate)
}

export function stepLogDate(dayKey: string, direction: 1 | -1, planStartDate: string, planEndDate: string): string {
  return clampDayKeyToPlan(addDaysToDayKey(dayKey, direction), planStartDate, planEndDate)
}

export function dateOverlineText(dayKey: string): string {
  return formatIsoDayMonthDay(dayKey)
}

/**
 * The request a planned log sends, as the snapshot stored beside its idempotency key. A diary entry is the
 * one keyed write whose duplicate the user sees directly, so the request has to be rebuildable rather than
 * re-derived: a launch after a lost response replays the stored key with this identical body and receives the
 * entry that was already written, instead of logging the meal a second time (0.7.2). Pair it with
 * `resolveKeyedRequest`, which compares this snapshot's fingerprint with the stored intent's.
 */
export function buildPlannedLogRequest(inputs: PlannedLogInputs): LogRequestSnapshot {
  return {
    action: 'log',
    planId: inputs.planId,
    mealId: inputs.mealId,
    servings: inputs.servings,
    date: inputs.date,
    diaryMealId: inputs.diaryMealId,
    expectedPlanRevision: inputs.planRevision
  }
}

export function logDateStepperLabel(dayKey: string, now: Date): string {
  return dayKey === formatDayKey(now) ? LOG_WEIGHT_TODAY_LABEL : formatPlanDayLabel(dayKey)
}

/**
 * The decisions frame 15 makes between a query answer and a keyed write, as pure functions over their inputs.
 *
 * They live here rather than in the screen because no renderer is installed in this app (0.9.2), so the only
 * way to hold the caller's behaviour under test — which day a commit is scoped to, which key it carries,
 * whether an outcome retires the intent, whether a refetch may fire — is to make each decision a value a unit
 * test can compute. `index.tsx` reads them and performs the effects; nothing here touches a hook, the store,
 * navigation or the network.
 *
 * They compose the derivations above — servings parsing, "This adds" figures, date labels — which is why they
 * sit beside them in this same file.
 */

const NO_BUCKET_OPTIONS: readonly DiaryBucketOption[] = Object.freeze([])

// The two codes that say the plan this screen was opened against is no longer the plan the server will accept
// a write for. They are read the same way on a query answer and on a write refusal (0.2.5).
const PLAN_STATE_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.stalePlan,
  API_ERROR_CODES.planNotActive
])

// The status the log route answers when the diary meal named in the body is not the caller's, or its date is
// not the date the body carries (0.5.2). It is read as a status rather than a code because the route answers
// it for ownership, where a body is never disclosed.
const NOT_FOUND_STATUS = 404

export interface LogPlanDateRange {
  startDate: string
  endDate: string
}

/**
 * Which day each of the screen's cache entries belongs to. The meal is a fact about the planned day the route
 * names, while the diary entry is written to the day the user selected — and the log mutation invalidates
 * `dailyMacros(date)` for the date its own payload carries (0.7.2), so the two are told apart here and the
 * selected day reaches both the diary read and the payload.
 */
export interface LogCacheScope {
  planId: string
  plannedDate: string
  diaryDate: string
}

export interface LogCacheScopeInputs {
  planId: string
  plannedDate: string
  selectedDate: string
}

export function resolveLogCacheScope(inputs: LogCacheScopeInputs): LogCacheScope {
  return {planId: inputs.planId, plannedDate: inputs.plannedDate, diaryDate: inputs.selectedDate}
}

/**
 * The arguments the plan-day query is read with: the meal is a fact about the planned day, so this read never
 * follows the stepper.
 */
export function planDayQueryScope(scope: LogCacheScope): readonly [string, string] {
  return [scope.planId, scope.plannedDate]
}

export interface LogDateStepInputs {
  selectedDate: string
  direction: 1 | -1
  planRange: LogPlanDateRange | null
}

export interface LogDateChangeInputs extends LogDateStepInputs {
  isCommitPending: boolean
  isIntentUnresolved: boolean
}

/**
 * The day one press of the stepper lands on, clamped to the plan's own week. With no plan range in hand yet
 * the date cannot move: the bound is the plan's, so a step taken before it is known could leave the week.
 */
export function nextLogDate(inputs: LogDateStepInputs): string {
  const {selectedDate, direction, planRange} = inputs

  return planRange === null
    ? selectedDate
    : stepLogDate(selectedDate, direction, planRange.startDate, planRange.endDate)
}

/**
 * Whether the stepper may move at all. Being inside the plan's week is only the first of three: the selected
 * date is also the write's cache scope, so changing it while a commit is in flight would leave the request
 * writing one day and its invalidation dropping another — and while a key is unresolved the date is the
 * stored snapshot's, which the next attempt has to re-send unchanged, so a step would only offer a day the
 * screen cannot act on (0.7.2).
 */
export function canChangeLogDate(inputs: LogDateChangeInputs): boolean {
  const {selectedDate, direction, planRange, isCommitPending, isIntentUnresolved} = inputs

  if (planRange === null || isCommitPending || isIntentUnresolved) {
    return false
  }

  return canStepLogDate(selectedDate, direction, planRange.startDate, planRange.endDate)
}

/**
 * The diary day and bucket one commit targets. `isInferredBucket` is the caption's condition rather than the
 * resolution's: a bucket the user picked is their choice even when the slot name matched nothing, so only an
 * unconfirmed fallback is announced (0.7.4).
 */
export interface LogCommitTarget {
  diaryDate: string
  diaryMealId: string
  bucketLabel: string
  isInferredBucket: boolean
}

export interface LogDiaryDestination {
  options: readonly DiaryBucketOption[]
  target: LogCommitTarget | null
}

export interface LogDiaryDestinationInputs {
  selectedDate: string
  slot: MealSlot | null
  planSlots: readonly MealSlot[]
  diaryMeals: Meal[] | undefined
  chosenBucketId: string | null
}

export function resolveLogDiaryDestination(inputs: LogDiaryDestinationInputs): LogDiaryDestination {
  const {selectedDate, slot, planSlots, diaryMeals, chosenBucketId} = inputs

  if (slot === null || diaryMeals === undefined) {
    return {options: NO_BUCKET_OPTIONS, target: null}
  }

  const options = buildDiaryBucketOptions(diaryMeals, planSlots)
  const resolution = resolveDiaryBucket(diaryMeals, slot)
  const diaryMealId = chosenBucketId ?? resolution.option?.mealId ?? null

  if (diaryMealId === null) {
    return {options, target: null}
  }

  // The label comes from the option list the picker renders, so a chosen id the selected day does not contain
  // leaves nothing to log rather than a row labelled with another day's bucket.
  const bucketLabel = options.find(option => option.mealId === diaryMealId)?.label ?? null

  if (bucketLabel === null) {
    return {options, target: null}
  }

  return {
    options,
    target: {
      diaryDate: selectedDate,
      diaryMealId,
      bucketLabel,
      isInferredBucket: resolution.isFallback && chosenBucketId === null
    }
  }
}

/**
 * One attempt of the keyed write: the body to send, the key it carries, and the intent to record before it
 * leaves. `isReplay` is the caller's cue that a server answer may be a stored response rather than a fresh
 * commit.
 *
 * `intent` is the record to file, and it is null for the two cases where there is nothing new to file: a
 * replay, whose record is already on disk and whose 7-day life is measured from the press the user actually
 * made rather than from each later launch that re-sent it; and an attempt made while nobody is signed in,
 * because `pendingIntents` is scoped by user and an unattributable record could never be resolved (0.7.2).
 */
export interface LogAttempt {
  mealId: string
  payload: LogPlannedMealPayload
  isReplay: boolean
  intent: PendingIntent | null
}

export interface LogAttemptInputs {
  planId: string
  mealId: string
  servings: number
  diaryDate: string
  diaryMealId: string
  planRevision: number
  userId: string | null
  /** What this screen may do about the single log slot right now, from `resolveLogLaunch`. */
  launch: LogLaunchDecision
  attemptedAt: number
  /**
   * The source of a freshly minted key. Taken as a source rather than a value — the way `mintKey` itself takes
   * its UUID generator — so that only the `mint` branch can reach it: a key minted on a replay or on a blocked
   * press is a key that exists beside an unresolved one, which is the state this decision exists to prevent.
   */
  mintFreshKey: () => string
}

const logPayload = (snapshot: LogRequestSnapshot, idempotencyKey: string): LogPlannedMealPayload => ({
  servings: snapshot.servings,
  date: snapshot.date,
  diaryMealId: snapshot.diaryMealId,
  expectedPlanRevision: snapshot.expectedPlanRevision,
  idempotencyKey
})

/**
 * The launch verdict decides this, not the current form values: while this screen's own key is unresolved the
 * attempt is its stored snapshot under its stored key, and the caller's portion, day, bucket and revision are
 * not consulted at all. While anything else holds the slot — another meal's unresolved key, an attempt already
 * on the wire, or a persisted slice that has not been read successfully — no attempt is planned and no key is
 * minted.
 *
 * That order is the whole point. Building the body first and only then asking whether it matched the stored
 * fingerprint meant a commit whose response was lost — after which the refetched plan revision has moved on —
 * produced a *different* body, hence a freshly minted key, hence a server that had never seen it and wrote a
 * second diary entry for a meal the user logged once. Asking only about THIS meal was the same mistake one
 * level up: `pendingIntents.log` holds exactly one record, so another meal's unresolved key read as an empty
 * slot, and the fresh key filed over it abandoned the only request that could have been reconciled. A key is
 * only ever replayable under the body it was minted for (a changed body earns `409 idempotency_conflict`), so
 * the stored body is the only thing the stored key may carry, and a new key may only be minted when the slot
 * is genuinely free (0.7.2).
 */
export function planLogAttempt(inputs: LogAttemptInputs): LogAttemptPlan {
  const {launch} = inputs

  if (launch.kind === 'blocked') {
    return {kind: 'blocked', reason: launch.reason}
  }

  if (launch.kind === 'replay') {
    return {
      kind: 'send',
      attempt: {
        mealId: launch.intent.request.mealId,
        payload: logPayload(launch.intent.request, launch.intent.key),
        isReplay: true,
        intent: null
      }
    }
  }

  const freshKey = inputs.mintFreshKey()
  const request = buildPlannedLogRequest({
    planId: inputs.planId,
    mealId: inputs.mealId,
    servings: inputs.servings,
    date: inputs.diaryDate,
    diaryMealId: inputs.diaryMealId,
    planRevision: inputs.planRevision
  })

  return {
    kind: 'send',
    attempt: {
      mealId: request.mealId,
      payload: logPayload(request, freshKey),
      isReplay: false,
      intent: inputs.userId === null ? null : buildPendingIntent(request, freshKey, inputs.userId, inputs.attemptedAt)
    }
  }
}

/**
 * What one failed attempt does to the stored intent, and what the user is told.
 *
 * `keep` belongs to an unknown outcome alone: the request may have committed before the response was lost, so
 * its key stays the only safe way to ask again and the screen states the outcome in place instead of toasting
 * it. A confirmed refusal is final for the key that earned it, so the intent is retired and a later press
 * mints a fresh one (0.2.5, 0.7.2).
 */
export type LogIntentDisposition = 'retire' | 'keep'

export interface LogFailureDecision {
  disposition: LogIntentDisposition
  toast: string | null
  isUnconfirmed: boolean
  refetchCurrentPlan: boolean
  refetchDiary: boolean
}

export function classifyLogFailure(error: unknown): LogFailureDecision {
  if (isUnknownOutcome(error)) {
    return {disposition: 'keep', toast: null, isUnconfirmed: true, refetchCurrentPlan: false, refetchDiary: false}
  }

  const code = getApiErrorCode(error)
  const isPlanStateRefusal = code !== null && PLAN_STATE_CODES.has(code)

  return {
    disposition: 'retire',
    toast: isPlanStateRefusal ? MEAL_PLAN_STALE_PLAN_TOAST : TOAST_GENERIC_ERROR,
    isUnconfirmed: false,
    // A refused write says something the screen was holding is out of date, and the two refusals say different
    // things: the plan moved on, so the tab's own plan is re-read; or the diary bucket the body named is not
    // this user's or not this day's, so the day's macros are re-read and the picker is rebuilt from the answer.
    refetchCurrentPlan: isPlanStateRefusal,
    refetchDiary: getApiErrorStatus(error) === NOT_FOUND_STATUS
  }
}

export interface LogUnresolvedIntentInputs {
  pendingIntents: MealPlanStore['pendingIntents']
  userId: string | null
  planId: string
  mealId: string
  now: number
}

/**
 * The refetch that accompanies the unconfirmed-outcome banner. It is display only: it lets the plan day and
 * the diary show an entry this attempt may already have written, and it never resolves the outcome or clears
 * the intent — only a server answer to the same key does (0.2.5). Hence the two members that are always
 * false: they are the property the caller must not break, stated where a test can read it.
 */
export interface LogUnconfirmedRefetch {
  refetchPlanDay: boolean
  refetchDiary: boolean
  retiresIntent: boolean
  resolvesOutcome: boolean
}

export interface LogUnconfirmedRefetchInputs {
  isUnconfirmed: boolean
  hasRefetched: boolean
}

export function planUnconfirmedRefetch(inputs: LogUnconfirmedRefetchInputs): LogUnconfirmedRefetch {
  const shouldRefetch = inputs.isUnconfirmed && !inputs.hasRefetched

  return {
    refetchPlanDay: shouldRefetch,
    refetchDiary: shouldRefetch,
    retiresIntent: false,
    resolvesOutcome: false
  }
}

/**
 * Whether a failed read of the plan day says the plan itself has moved on. A retry of the same plan id cannot
 * resolve that, which is why it is asked separately from the generic failure: the inline card's "Try again"
 * belongs to a network or undecodable failure, and this one gets the code's own copy instead (0.2.5).
 */
export function isPlanStateReadFailure(error: unknown): boolean {
  if (error === null || error === undefined || isUnknownOutcome(error)) {
    return false
  }

  const code = getApiErrorCode(error)

  return code !== null && PLAN_STATE_CODES.has(code)
}

/**
 * The recovery a plan-day read failure earns. `hasAnnounced` is the screen's own record that this failure was
 * already reported: the query's identity changes with every date step, so an unguarded classification would
 * raise the same toast again for a failure the user has already been told about.
 */
export interface LogDayQueryRecovery {
  toast: string | null
  refetchCurrentPlan: boolean
  isPlanStateFailure: boolean
}

export interface LogDayQueryRecoveryInputs {
  error: unknown
  hasAnnounced: boolean
}

export function planDayQueryRecovery(inputs: LogDayQueryRecoveryInputs): LogDayQueryRecovery {
  const isPlanStateFailure = isPlanStateReadFailure(inputs.error)

  if (!isPlanStateFailure || inputs.hasAnnounced) {
    return {toast: null, refetchCurrentPlan: false, isPlanStateFailure}
  }

  return {toast: MEAL_PLAN_STALE_PLAN_TOAST, refetchCurrentPlan: true, isPlanStateFailure}
}

// The Diary-versus-History rule is shared with the plan tab's logged cards, so it lives in
// @utility/MealPlanDateUtility and this screen only re-exports it under the name its callers use.
export {resolvePostLogViewTarget as resolveViewTarget} from '@utility/MealPlanDateUtility'

/**
 * Either the one attempt that may leave right now, or the reason nothing may leave at all.
 *
 * A blocked verdict is a first-class outcome rather than a silently dropped press: it carries no payload and
 * no intent to file, so the caller cannot mint a key, cannot write the slot and has something to tell the user
 * (0.7.2).
 */
export type LogAttemptPlan = {kind: 'send'; attempt: LogAttempt} | {kind: 'blocked'; reason: LogLaunchBlockReason}

/**
 * An unresolved log intent this screen is the owner of: the key an earlier attempt was sent under, and the
 * request body it was sent with. Both members are needed and neither is derivable from the other — the key
 * without the body cannot be replayed byte-identically, and the body without the key would have to be sent
 * under a new one, which is how one intent becomes two diary entries (0.7.2).
 */
export interface UnresolvedLogIntent {
  key: string
  request: LogRequestSnapshot
}

/**
 * The log intent this screen can still answer, or null when there is nothing to replay. An attempt whose
 * response was lost keeps its intent, and only a server answer to that same key resolves it (0.7.2) — so a
 * screen that opens on one replays the stored request under the stored key rather than presenting a fresh
 * write as if nothing had been sent.
 *
 * The record is returned rather than a boolean because the snapshot *is* the request the next attempt must
 * send: reporting only its existence is what left the screen rebuilding the body from current form state and
 * a refetched plan revision, minting a second key over an unresolved one.
 *
 * `resolveReplayableIntent` applies ownership, the 7-day life, snapshot validation and the plan/meal scope, so
 * an intent filed for another account, another plan or another meal is already gone by the time it answers —
 * replaying one of those would commit a diary entry this screen is not showing.
 */
export function resolveUnresolvedLogIntent(inputs: LogUnresolvedIntentInputs): UnresolvedLogIntent | null {
  const intent = resolveReplayableIntent({pendingIntents: inputs.pendingIntents}, 'log', inputs.userId, inputs.now, {
    planId: inputs.planId,
    mealId: inputs.mealId
  })

  return intent === null ? null : asUnresolvedLogIntent(intent)
}

// Filed under the `log` slot, so the snapshot can only be a log snapshot; narrowing it here is what hands the
// caller a body it can re-send without a cast, and answers null rather than throwing for the record a future
// release could file differently.
const asUnresolvedLogIntent = (intent: PendingIntent): UnresolvedLogIntent | null =>
  intent.request.action === 'log' ? {key: intent.key, request: intent.request} : null

/** Why no log may be sent right now, as the three cases `resolveKeyedLaunch` distinguishes. */
export type LogLaunchBlockReason = Extract<KeyedLaunchDecision, {kind: 'blocked'}>['reason']

/**
 * What this screen may do about the planned-log action: mint a key for a new log, replay its own unresolved
 * one, or nothing at all.
 */
export type LogLaunchDecision =
  | {kind: 'mint'}
  | {kind: 'replay'; intent: UnresolvedLogIntent}
  | {kind: 'blocked'; reason: LogLaunchBlockReason}

export interface LogLaunchInputs {
  pendingIntents: MealPlanStore['pendingIntents']
  userId: string | null
  planId: string
  mealId: string
  now: number
  /** `'succeeded'` alone — a refused read leaves the slot's contents unknown and must block, not mint. */
  hasHydratedIntents: boolean
  /**
   * Whether a log request is already on the wire, counted across the whole app rather than on this screen's
   * own mutation instance: the Meal Plan tab is the AAP's cold-start owner for this action and sends the same
   * mutation key, so an instance-local pending flag would let the two send one key at once (0.7.2).
   */
  isRequestInFlight: boolean
}

/**
 * The launch decision for the planned log, taken from the state of the ACTION's one intent slot rather than
 * from this route's own scope.
 *
 * `resolveUnresolvedLogIntent` answers the narrower question — "is there something HERE to replay" — and
 * returns null both for an empty slot and for a slot held by another plan or meal. Those two are not
 * interchangeable: `pendingIntents.log` holds exactly one record, so reading a foreign holder as an empty slot
 * is what let a fresh key be filed over an unresolved one and a second diary entry be written for a meal the
 * user logged once. `resolveSlotOwnership` keeps them apart, and `resolveKeyedLaunch` applies the shared
 * precedence — hydration, then an attempt in flight, then a foreign holder, then this screen's own replay, and
 * only then a mint — so all four keyed writes answer it the same way (0.7.2).
 */
export function resolveLogLaunch(inputs: LogLaunchInputs): LogLaunchDecision {
  const ownership = resolveSlotOwnership({pendingIntents: inputs.pendingIntents}, 'log', inputs.userId, inputs.now, {
    planId: inputs.planId,
    mealId: inputs.mealId
  })

  const decision = resolveKeyedLaunch({
    ownership: ownership.kind,
    isHydrated: inputs.hasHydratedIntents,
    isRequestInFlight: inputs.isRequestInFlight
  })

  if (decision.kind !== 'replay') {
    return decision
  }

  const intent = ownership.kind === 'mine' ? asUnresolvedLogIntent(ownership.intent) : null

  // A 'replay' verdict is only reached for a record this screen owns, and a record filed under the `log` slot
  // carries a log snapshot — so this branch is unreachable today. It stays BLOCKED rather than falling through
  // to a mint because a slot whose record this release cannot read is exactly the case where minting would
  // abandon a key the server may already have committed.
  return intent === null ? {kind: 'blocked', reason: 'otherResource'} : {kind: 'replay', intent}
}

/**
 * What the screen shows while a key is unresolved, and whether the inputs that would change it are locked.
 *
 * An unresolved key may only ever be re-sent with the body it was minted for, so the stored snapshot — not the
 * local form state, and not a revision a refetch has moved on — is what the user sees: the visible portion,
 * day and bucket are then exactly the request the next attempt carries, and the write that may already have
 * committed is the write being described. The lock holds until that key receives a server answer or a
 * confirmed terminal error, which is the only thing that clears the intent (0.7.2).
 */
export interface LogFormValues {
  servings: number
  selectedDate: string
  chosenBucketId: string | null
  isLocked: boolean
}

export interface LogFormValuesInputs {
  intent: UnresolvedLogIntent | null
  /** `isLogFormEditable`'s verdict — false locks the form even when this screen holds no intent of its own. */
  isEditable: boolean
  servings: number
  selectedDate: string
  chosenBucketId: string | null
}

/**
 * Whether the portion, the day and the bucket may be edited at all.
 *
 * Only a launch that would mint is editable, and the three other verdicts are read-only for three different
 * reasons: this screen's own unresolved key is re-sent unchanged, so an edit could only describe a request no
 * attempt may send; another meal's unresolved key means nothing may be sent from here until it is retired; an
 * attempt on the wire is the request being answered; and until the persisted slice has been read successfully
 * nothing at all is known about the slot, so an edit accepted then could be typed over a restored intent the
 * screen has not seen yet (0.7.2).
 */
export function isLogFormEditable(launch: LogLaunchDecision): boolean {
  return launch.kind === 'mint'
}

/**
 * The local draft to adopt from a stored request, or `null` when there is nothing to adopt.
 *
 * `resolveLogFormValues` shows the stored snapshot while the intent exists, but it only overrides what is
 * DERIVED: the portion, day and bucket the screen holds in its own state stay at one serving, the route's date
 * and no bucket. The moment a confirmed refusal retires that intent, the derivation stops overriding and the
 * screen falls back to those three — so the restored request the user was looking at, and was about to retry,
 * disappears and is replaced by a different one (0.2.5 keeps the user on this screen with every entered value
 * intact). Adopting the snapshot into the draft is what makes the values on screen survive the answer that
 * retires the key.
 *
 * `null` when nothing differs, which is what makes the adoption idempotent: after it has been applied the
 * three values equal the snapshot's, so this answers `null` and the caller's effect stops. There is no fight
 * with a user edit either — the form is locked for as long as an intent is on record.
 */
export interface RestoredLogDraft {
  servings: number
  selectedDate: string
  chosenBucketId: string | null
}

export interface RestoredLogDraftInputs {
  intent: UnresolvedLogIntent | null
  servings: number
  selectedDate: string
  chosenBucketId: string | null
}

export function resolveRestoredLogDraft(inputs: RestoredLogDraftInputs): RestoredLogDraft | null {
  const {intent} = inputs

  if (intent === null) {
    return null
  }

  const stored: RestoredLogDraft = {
    servings: intent.request.servings,
    // The diary date the request named, which the date stepper may have moved off the route's own day.
    selectedDate: intent.request.date,
    chosenBucketId: intent.request.diaryMealId
  }

  const isAlreadyAdopted =
    stored.servings === inputs.servings &&
    stored.selectedDate === inputs.selectedDate &&
    stored.chosenBucketId === inputs.chosenBucketId

  return isAlreadyAdopted ? null : stored
}

export function resolveLogFormValues(inputs: LogFormValuesInputs): LogFormValues {
  const {intent} = inputs

  if (intent === null) {
    return {
      servings: inputs.servings,
      selectedDate: inputs.selectedDate,
      chosenBucketId: inputs.chosenBucketId,
      isLocked: !inputs.isEditable
    }
  }

  return {
    servings: intent.request.servings,
    selectedDate: intent.request.date,
    chosenBucketId: intent.request.diaryMealId,
    isLocked: true
  }
}

/**
 * What the footer CTA and the unconfirmed banner's retry offer, given the launch verdict.
 *
 * Commit readiness alone is not enough to offer a submit: a press taken while the persisted slice is unread,
 * while another meal's key is unresolved, or while an attempt is on the wire either duplicates a write or
 * abandons a key (0.7.2). A refused read is the one blocked case the user can act on, and it gets a retry of
 * the READ rather than of the write — `retryIntentsHydration` is the only way out of that state.
 */
export interface LogSubmitAffordance {
  canSubmit: boolean
  isPending: boolean
  offersHydrationRetry: boolean
  isBlockedByOtherMeal: boolean
}

export interface LogSubmitAffordanceInputs {
  launch: LogLaunchDecision
  isCommitReady: boolean
  intentsHydration: IntentsHydration
}

export function resolveLogSubmitAffordance(inputs: LogSubmitAffordanceInputs): LogSubmitAffordance {
  const {launch} = inputs
  const isBlocked = launch.kind === 'blocked'
  const isHydrationBlock = isBlocked && launch.reason === 'hydrating'
  const isHydrationFailure = isHydrationBlock && inputs.intentsHydration === 'failed'

  return {
    canSubmit: inputs.isCommitReady && !isBlocked,
    isPending: isBlocked && (launch.reason === 'inFlight' || (isHydrationBlock && !isHydrationFailure)),
    offersHydrationRetry: isHydrationFailure,
    isBlockedByOtherMeal: isBlocked && launch.reason === 'otherResource'
  }
}

export interface LogUnconfirmedOutcomeInputs {
  intent: UnresolvedLogIntent | null
  unconfirmedKey: string | null
}

/**
 * Whether the screen states an outcome it cannot vouch for: a key that actually answered with an unknown
 * outcome, and nothing since that resolved it.
 *
 * Keyed rather than a flag, and never inferred from the mere presence of a stored intent: an intent on record
 * whose key has had no answer yet is owed its silent replay (`planStoredLogReplay`), and announcing the
 * unconfirmed variant before that replay has been tried would hand the user a manual retry for a request the
 * screen is about to finish on its own (0.7.2). It survives a retry of that same key while the request is in
 * flight, which is what keeps the banner and its pending treatment on screen instead of flickering.
 *
 * An intent for a *different* key is a later attempt, whose own answer decides what the screen says. No
 * intent at all still states the outcome: an attempt made with nobody signed in records nothing (the slice is
 * user-scoped), and a failure the user is told nothing about would be worse than one they cannot resolve.
 */
export function isLogOutcomeUnconfirmed(inputs: LogUnconfirmedOutcomeInputs): boolean {
  return inputs.unconfirmedKey !== null && (inputs.intent === null || inputs.intent.key === inputs.unconfirmedKey)
}

export interface LogStoredReplayInputs {
  launch: LogLaunchDecision
  isCommitReady: boolean
  isRequestInFlight: boolean
  replayedKey: string | null
}

/**
 * Whether the unresolved intent still owes its silent replay as the screen opens, and the latch to keep.
 *
 * The intent comes from the launch verdict, so the replay can only ever fire for a key this screen owns: the
 * persisted slice must have been read successfully (a first frame would otherwise read an empty slice and
 * conclude there was nothing to replay), the account must be known, and no other plan or meal may hold the
 * slot. The one prerequisite left is this screen's own: the day and diary reads have to have produced a
 * commit-ready state, because a success has to be describable — the post-log banner names the recipe and the
 * bucket the entry landed in, which only the loaded day carries. Until then the decision is simply "not yet",
 * never "nothing pending".
 *
 * `isRequestInFlight` is asserted here as well as inside the verdict, and it is the app-wide count rather than
 * this screen's mutation: the Meal Plan tab owns the same cold-start replay, and one key must never be on the
 * wire twice. The once-per-key rule itself is `resolveMountReplay`'s, shared with the other three keyed writes
 * so they cannot disagree about it (0.7.2).
 */
export function planStoredLogReplay(inputs: LogStoredReplayInputs): MountReplayDecision {
  return resolveMountReplay({
    intent: inputs.launch.kind === 'replay' ? inputs.launch.intent : null,
    isReady: inputs.isCommitReady,
    isRequestInFlight: inputs.isRequestInFlight,
    replayedKey: inputs.replayedKey
  })
}
