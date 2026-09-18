import {classifyOutcome, isFeatureDisabledError} from '@utility/ApiErrorUtility'
import {isRoutesMissingError} from '@utility/MealPlanEntitlementUtility'

/**
 * What a meal-planning read has actually said, for the screens that compose several of them into one body.
 *
 * It exists because the obvious test is the wrong one. TanStack keeps the last successful `data` on a result
 * whose refetch failed — deliberately, so a transient failure does not blank a screen — so `data === null` is
 * not "the read failed" and `data !== null` is not "the read answered". A screen that keys its state on data
 * nullity therefore hides its own retry affordance exactly when a read has stopped working, and goes on
 * offering writes that pin revisions nothing reported. Every state below is keyed on the read's status
 * instead, which is the only thing that states what the server said about *this* attempt.
 *
 * The four states are the four different next moves, which is why a capability answer is not folded into
 * `failed`: a route that is not mounted, or a capability the server has switched off, answers a repeat probe
 * identically, so drawing "Try again" for it would be a dead control (AAP 0.2.5).
 */
export type MealPlanReadState =
  // Nothing has answered yet: a first load in flight, or a query held disabled by its gate.
  | 'loading'
  // The read answered, and the screen may render and act on it.
  | 'ready'
  // The capability is absent — a gated route answered `503 feature_disabled`, or a resource-less GET answered
  // a bare 404 because the backend was rolled back past the feature (AAP 0.2.5 signals (a) and (b)). No retry.
  | 'unavailable'
  // The read genuinely failed and a retry is the way out: a 5xx, a lost connection, an undecodable body.
  | 'failed'

/**
 * A read as a consumer receives it. `isSuccess`, `isError` and `error` are all required: they are the
 * classification, and a caller that could omit one would be back to deciding from `data`.
 *
 * A `useQuery` result and the `QueryObserverResult` a `refetch()` resolves with both satisfy this without a
 * cast.
 */
export interface MealPlanReadStatus {
  isSuccess: boolean
  isError: boolean
  error: unknown
}

/**
 * Whether an error is one this particular read answers for itself rather than surfacing as a failure.
 *
 * Two reads need it, for the same reason and with different errors. The targets read degrades a routes-missing
 * answer to the local target and keeps rendering (AAP 0.7.5), so that error is an answer, not a failure. The
 * estimate read answers `409 estimate_unavailable` when it cannot calculate one, which has its own drawn card
 * and its own recovery into manual entry (AAP 0.2.5) — also an answer. Passing the predicate in keeps this
 * module free of per-route policy while still refusing to guess.
 */
export type AnsweredErrorPredicate = (error: unknown) => boolean

/**
 * The capability signals of AAP 0.2.5, as one test over a single read's error.
 *
 * Composed from the three existing predicates rather than re-deriving any of them, so this cannot drift from
 * the entitlement verdict the Macros body draws from the same errors. `feature_disabled` must be a *confirmed*
 * outcome: a 502 whose body happens to carry that code is an unknown outcome, and treating it as the capability
 * being off would strand a screen on an unavailable card a second attempt would have loaded.
 */
const isCapabilityRefusal = (error: unknown): boolean =>
  isRoutesMissingError(error) || (classifyOutcome(error) === 'confirmed' && isFeatureDisabledError(error))

/**
 * Classifies one read, from its status alone.
 *
 * The order is the policy: an error the read answers for itself comes first (it is an answer, so the screen
 * renders), then the capability refusal (no retry to offer), then any other error (retryable), then success.
 * Anything left is a read that has not answered — pending, whether fetching or held disabled by its gate —
 * which is `loading` rather than `ready`, because a disabled query has `isLoading === false` and reporting it
 * ready would let a screen act on a read that was never issued.
 */
export const classifyMealPlanRead = (
  read: MealPlanReadStatus,
  isAnsweredError?: AnsweredErrorPredicate
): MealPlanReadState => {
  if (read.isError) {
    if (isAnsweredError?.(read.error) === true) {
      return 'ready'
    }

    return isCapabilityRefusal(read.error) ? 'unavailable' : 'failed'
  }

  return read.isSuccess ? 'ready' : 'loading'
}

// Ascending severity, so composing several reads is a maximum. `unavailable` outranks `failed` because it is
// the one state no retry and no waiting can change; both outrank `loading`, because a read that has already
// answered badly is not made better by another that has not answered at all — and a screen that showed the
// skeleton until every read settled would replace an actionable card with a spinner.
const READ_STATE_SEVERITY: Record<MealPlanReadState, number> = {
  ready: 0,
  loading: 1,
  failed: 2,
  unavailable: 3
}

/**
 * The state of a screen built on several reads: the worst of them.
 *
 * An empty list is `ready`, which is the honest answer — a screen depending on no read has nothing to wait for.
 */
export const worstMealPlanReadState = (states: readonly MealPlanReadState[]): MealPlanReadState =>
  states.reduce<MealPlanReadState>(
    (worst, state) => (READ_STATE_SEVERITY[state] > READ_STATE_SEVERITY[worst] ? state : worst),
    'ready'
  )
