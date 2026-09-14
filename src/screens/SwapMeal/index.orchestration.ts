import {SwapMealPayload} from '@data/models/SwapAlternative'
import {
  buildPendingIntent,
  MealPlanStore,
  PendingIntent,
  resolveKeyedRequest,
  resolvePendingIntent
} from '@store/mealPlan/useMealPlanStore'
import {SwapRequestSnapshot} from '@utility/IdempotencyUtility'

import {buildSwapRequest, isPlanRevisionStale, SwapView} from './index.util'

/**
 * The effect decisions `SwapMeal` makes, as pure functions the screen applies rather than logic buried in its
 * effects. No renderer is installed in this project, so a decision that stays inside `useEffect` cannot be
 * asserted at all; extracted here it is pinned by `__tests__/index.orchestration.test.ts` and the screen keeps
 * only the wiring — reading refs and queries, and calling what these functions name.
 *
 * The store's replay API is reached through its pure exports (`resolvePendingIntent`, `resolveKeyedRequest`,
 * `buildPendingIntent`), each of which takes the state slice as an argument; nothing here reads the store, the
 * clock or a key generator on its own, so every answer is a function of its inputs.
 */

export interface UnconfirmedRefetchInput {
  viewKind: SwapView['kind']
  hasRefetchedUnconfirmed: boolean
}

export interface UnconfirmedRefetchDecision {
  refetchesPlanDay: boolean
  /**
   * Always false, and typed as the literal so no caller can read it any other way: the refetch an unconfirmed
   * outcome triggers is display-only (0.2.5). It may reveal a commit that landed, but only a server answer to
   * the same idempotency key may resolve the attempt, so a stale-plan answer arriving from the day query must
   * neither retire the intent nor replace the copy that promises nothing about what changed.
   */
  resolvesPendingIntent: false
  hasRefetchedUnconfirmed: boolean
}

export interface SwapAttemptGuards {
  recoveredTerminalCode: string | null
  hasRefetchedUnconfirmed: boolean
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

export interface SwapRetryInput {
  state: Pick<MealPlanStore, 'pendingIntents'>
  snapshot: SwapRequestSnapshot
  userId: string
  attemptedAt: number
  freshKey: string
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
 * Whether the unconfirmed outcome on screen still owes its display-only refetch, and the guard value the
 * screen must hold afterwards. The guard is what keeps it to one refetch per outcome: the effect re-runs
 * whenever a query object's identity changes, and without it a single unconfirmed answer would refetch on
 * every one of those renders.
 */
export function resolveUnconfirmedRefetch(input: UnconfirmedRefetchInput): UnconfirmedRefetchDecision {
  const isUnconfirmed = input.viewKind === 'unconfirmed'

  return {
    refetchesPlanDay: isUnconfirmed && !input.hasRefetchedUnconfirmed,
    resolvesPendingIntent: false,
    hasRefetchedUnconfirmed: input.hasRefetchedUnconfirmed || isUnconfirmed
  }
}

/**
 * The guards a freshly fired attempt starts from. Both are per-attempt: the next outcome is this attempt's own,
 * so it earns its own display-only refetch and its own terminal recovery rather than being skipped because the
 * previous attempt already applied one.
 */
export function guardsForNewAttempt(): SwapAttemptGuards {
  return {recoveredTerminalCode: null, hasRefetchedUnconfirmed: false}
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
 * The stored request of an unresolved commit this screen may replay, or null when there is nothing replayable.
 * The record has to be for this user, this plan and this meal: an intent for another meal describes a different
 * request, and replaying its key would commit that swap instead of the one the banner is offering to retry.
 */
export function resolveReplayableSwap(input: ReplayableSwapInput): SwapRequestSnapshot | null {
  if (input.userId === null) {
    return null
  }

  const intent = resolvePendingIntent(input.state, 'swap', input.userId, input.now)

  if (intent === null || intent.request.action !== 'swap') {
    return null
  }

  const request = intent.request

  return request.planId === input.planId && request.mealId === input.mealId ? request : null
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
