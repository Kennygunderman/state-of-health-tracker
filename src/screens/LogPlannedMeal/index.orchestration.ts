import {Meal} from '@data/models/Meal'
import {MealSlot} from '@data/models/Recipe'
import type {LogPlannedMealPayload} from '@queries/api/mealPlanning/logPlannedMeal'
import {
  buildPendingIntent,
  MealPlanStore,
  PendingIntent,
  resolveKeyedRequest,
  resolvePendingIntent
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES, getApiErrorCode, getApiErrorStatus, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {LogRequestSnapshot} from '@utility/IdempotencyUtility'

import {MEAL_PLAN_STALE_PLAN_TOAST, TOAST_GENERIC_ERROR} from '@constants/strings'

import {
  buildDiaryBucketOptions,
  buildPlannedLogRequest,
  canStepLogDate,
  DiaryBucketOption,
  resolveDiaryBucket,
  stepLogDate
} from './index.util'

/**
 * The decisions frame 15 makes between a query answer and a keyed write, as pure functions over their inputs.
 *
 * They live here rather than in the screen because no renderer is installed in this app (0.9.2), so the only
 * way to hold the caller's behaviour under test — which day a commit is scoped to, which key it carries,
 * whether an outcome retires the intent, whether a refetch may fire — is to make each decision a value a unit
 * test can compute. `index.tsx` reads them and performs the effects; nothing here touches a hook, the store,
 * navigation or the network.
 *
 * Derivations that are the screen's alone (servings parsing, "This adds" figures, date labels) stay in
 * `index.util.ts`; this module composes them.
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
 * Whether the stepper may move at all. Being inside the plan's week is only half of it: the selected date is
 * also the write's cache scope, so changing it while a commit is in flight would leave the request writing one
 * day and its invalidation dropping another.
 */
export function canChangeLogDate(inputs: LogDateChangeInputs): boolean {
  const {selectedDate, direction, planRange, isCommitPending} = inputs

  if (planRange === null || isCommitPending) {
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
 * commit; `intent` is null only when nobody is signed in, because `pendingIntents` is scoped by user and an
 * unattributable record could never be resolved (0.7.2).
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
  pendingIntents: MealPlanStore['pendingIntents']
  attemptedAt: number
  freshKey: string
}

export function planLogAttempt(inputs: LogAttemptInputs): LogAttempt {
  const request = buildPlannedLogRequest({
    planId: inputs.planId,
    mealId: inputs.mealId,
    servings: inputs.servings,
    date: inputs.diaryDate,
    diaryMealId: inputs.diaryMealId,
    planRevision: inputs.planRevision
  })

  // The fresh key is minted by the caller at the press (randomness never enters here), and is used only when
  // no unresolved intent describes this very request — a reused key with a changed body earns
  // `409 idempotency_conflict` (0.7.2).
  const plan =
    inputs.userId === null
      ? {idempotencyKey: inputs.freshKey, isReplay: false, request}
      : resolveKeyedRequest(
          {pendingIntents: inputs.pendingIntents},
          request,
          inputs.userId,
          inputs.attemptedAt,
          inputs.freshKey
        )

  // A replay returns the intent filed under this request's own action, so the snapshot can only be a log
  // snapshot; narrowing it here is what lets the body be rebuilt from the stored request without a cast.
  const snapshot: LogRequestSnapshot = plan.request.action === 'log' ? plan.request : request

  return {
    mealId: snapshot.mealId,
    payload: {
      servings: snapshot.servings,
      date: snapshot.date,
      diaryMealId: snapshot.diaryMealId,
      expectedPlanRevision: snapshot.expectedPlanRevision,
      idempotencyKey: plan.idempotencyKey
    },
    isReplay: plan.isReplay,
    intent:
      inputs.userId === null
        ? null
        : buildPendingIntent(snapshot, plan.idempotencyKey, inputs.userId, inputs.attemptedAt)
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
  mealId: string
  now: number
}

/**
 * Whether a log intent this screen can still answer was left unresolved by an earlier mount. An attempt whose
 * response was lost keeps its intent, and only a server answer to that same key resolves it (0.7.2) — so a
 * screen that opens on one states the outcome it cannot vouch for and offers the stored key again, rather than
 * presenting a fresh write as if nothing had been sent.
 *
 * The intent is matched on its own snapshot: one filed for another meal belongs to another screen's replay,
 * and `resolvePendingIntent` has already discarded one belonging to another user or past its 7-day life.
 */
export function hasUnresolvedLogIntent(inputs: LogUnresolvedIntentInputs): boolean {
  if (inputs.userId === null) {
    return false
  }

  const intent = resolvePendingIntent({pendingIntents: inputs.pendingIntents}, 'log', inputs.userId, inputs.now)

  return intent !== null && intent.request.action === 'log' && intent.request.mealId === inputs.mealId
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
