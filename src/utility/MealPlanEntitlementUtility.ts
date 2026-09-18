import {getApiErrorCode, isConfirmedFeatureDisabledError, isFeatureDisabledError} from '@utility/ApiErrorUtility'

const NOT_FOUND_STATUS = 404

/**
 * The one place the meal-planning entitlement policy is decided.
 *
 * It lives in `src/utility/` rather than beside the hook that reads it because three trees depend on it and
 * none of them owns it: `@service/remoteConfig/initRemoteConfig` reads the flag inputs, the
 * `@hooks/mealPlanning/useMealPlanEntitlement` pair turns them plus the read errors into the entitlement, and
 * the Macros plan-body resolver reads the availability signals. A helper shared across trees belongs here with
 * its tests, and a low-level service importing a hook-private util would reverse the dependency direction.
 * `@hooks/mealPlanning/useMealPlanEntitlement.util` re-exports every binding below unchanged — it adds the
 * hook's own query and session wiring beside them but reimplements no rule — so consumers reading either path
 * get one policy rather than two that can drift.
 */

/**
 * The `meal_planning_enabled` value shipped in `setDefaults`. It is `false` so an install that has never
 * activated a console value hides the feature instead of showing it unseeded.
 */
export const PACKAGED_MEAL_PLANNING_ENABLED = false

export type MealPlanAvailability = 'enabled' | 'disabled' | 'unavailable'

/** Mirrors `remoteConfig().lastFetchStatus`. */
export type RemoteConfigFetchStatus = 'success' | 'failure' | 'no_fetch_yet' | 'throttled'

/** Mirrors `remoteConfig().getValue(key).getSource()`: `'remote'` only once a console value was activated. */
export type RemoteConfigValueSource = 'static' | 'default' | 'remote'

export interface MealPlanningFlagInputs {
  lastFetchStatus: RemoteConfigFetchStatus
  valueSource: RemoteConfigValueSource
  value: boolean
}

export interface MealPlanEntitlementInputs {
  /**
   * Must come from `resolveMealPlanningFlagEnabled`: a bare `getValue(…).asBoolean()` read cannot separate a
   * never-activated default from an activated console value, so it cannot fail closed.
   */
  isFlagEnabled: boolean
  preferencesError: unknown
  currentPlanError: unknown
  targetsError: unknown
  hasPlan: boolean
  /**
   * The capability signals already seen in this session, if the caller retains any. Optional because a caller
   * with nothing to retain — a one-shot resolve in a test or a screen with no store — is answered from the live
   * errors alone; the latch only ever adds signals, never removes them.
   */
  capabilityLatch?: MealPlanCapabilityLatch
}

export interface MealPlanEntitlement {
  availability: MealPlanAvailability
  isSegmentedControlVisible: boolean
  isCatalogVisible: boolean
  isGatedRequestAllowed: boolean
  hasPlan: boolean
}

/**
 * Fail-closed across the four Remote Config states a single boolean cannot separate. Only a value the SDK has
 * activated from the console (`valueSource === 'remote'`) may enable the feature, so a never-fetched or
 * offline install stays at the packaged `false`. `lastFetchStatus` names which state this is and deliberately
 * does not change the outcome — that invariance is the retention rule: the SDK caches an activated value
 * across launches, so a failed or throttled fetch keeps returning the last activated value, including `true`.
 */
export const resolveMealPlanningFlagEnabled = (flag: MealPlanningFlagInputs): boolean =>
  flag.valueSource === 'remote' ? flag.value : PACKAGED_MEAL_PLANNING_ENABLED

export const httpStatusOf = (error: unknown): number | null => {
  const status = (error as {response?: {status?: unknown}} | null)?.response?.status

  return typeof status === 'number' ? status : null
}

/**
 * The marker `isRoutesMissingError` actually tests for, rather than `instanceof`. The error is thrown inside a
 * request function, travels out through TanStack Query's error channel and is read by a pure predicate, and
 * `instanceof` across that path depends on how the class was downlevelled — so the check is a structural own
 * property, which no transform can take away. The class below remains the typed carrier and its prototype
 * chain is repaired, so `instanceof` also works for anyone who prefers it.
 */
const ROUTES_MISSING_MARKER = 'meal_planning_routes_missing'

/**
 * The typed answer of a resource-less meal-planning GET whose route is not mounted: a bare 404, meaning the
 * backend was rolled back to a build without the feature.
 *
 * It exists because that answer has two jobs at once and one of them cannot survive being turned into data.
 * The reads it comes from degrade their own surface to a local value — the targets read is the example: a
 * rolled-back backend must leave Account, Progress and the Diary editor showing the local target rather than
 * an error (AAP 0.7.5) — while the same answer is the entitlement's capability signal, which the Meal Plan
 * segment turns into its unavailable card. A request function that resolved the 404 to `null` would satisfy
 * the first job and erase the second, because "the server holds no targets" is already a successful response
 * (`TargetsResponse.targets === null`) and the two would then be indistinguishable. Throwing this instead keeps
 * both: the entitlement reads the error, and target consumers select the local fallback from the absence of
 * data (`@queries/mealPlanning/useNutritionTargetsQuery.util`).
 */
export class RoutesMissingError extends Error {
  /** The structural discriminant `isRoutesMissingError` reads. */
  readonly routesMissing: typeof ROUTES_MISSING_MARKER = ROUTES_MISSING_MARKER

  /** The 404 this stands for, so a reader of the error object alone still sees the status it came from. */
  readonly status: number = NOT_FOUND_STATUS

  constructor(readonly path: string) {
    super(`Meal-planning route is not mounted: ${path}`)

    this.name = 'RoutesMissingError'
    // Restores the prototype chain a downlevelled `extends Error` loses, so `instanceof RoutesMissingError`
    // holds for callers that use it even though the predicate does not depend on it.
    Object.setPrototypeOf(this, RoutesMissingError.prototype)
  }
}

// Re-exported rather than re-implemented: the predicate belongs with the rest of the error classification in
// @utility/ApiErrorUtility, where the keyed writes read it too, and this module's consumers keep reading it
// from the entitlement surface they already depend on.
export {isFeatureDisabledError}

/**
 * Meaningful only for the resource-less GETs — `/meal-planning/preferences`, `/meal-planning/plans/current`
 * and `/meal-planning/targets` — which a feature-bearing backend answers with 200 and null members, so a
 * bare 404 there can only mean the routes are not mounted. A 404 from a resource route
 * (`/plans/:planId/…`, `/recipes/:id`, `/macros/entry/:id`) is the server's combined not-found/not-yours
 * answer and must never be read as unavailability.
 *
 * Both forms of the same answer are accepted: the axios-shaped rejection a request function re-throws
 * untouched, and the `RoutesMissingError` a request function throws when it has already classified the 404
 * itself in order to degrade its own surface.
 */
export const isRoutesMissingError = (error: unknown): boolean => {
  if ((error as {routesMissing?: unknown} | null)?.routesMissing === ROUTES_MISSING_MARKER) {
    return true
  }

  return httpStatusOf(error) === NOT_FOUND_STATUS && getApiErrorCode(error) === null
}

/**
 * The two unavailability signals of AAP 0.2.5, separated because they do not have the same consequences: (a) a
 * gated route answering `503 feature_disabled` means a mounted backend with server-side planning off, while (b)
 * a bare 404 from one of the resource-less GETs means a backend that no longer has the routes at all.
 */
export interface MealPlanCapabilitySignals {
  isFeatureDisabled: boolean
  areRoutesMissing: boolean
}

/**
 * The signals retained for the session. Same shape as the live ones, and deliberately a separate name: a latch
 * is the accumulation of everything seen so far, which is why it can report a signal no current error carries.
 *
 * Retention is what stops a known-unavailable route being re-probed on every mount, focus and reconnect. It is
 * session/process-scoped rather than persisted, so a cold start always probes once — the forward-recovery path
 * an operator re-enable needs.
 */
export type MealPlanCapabilityLatch = MealPlanCapabilitySignals

/** The starting latch: nothing seen yet, so the live errors alone decide. */
export const NO_MEAL_PLAN_CAPABILITY_LATCH: MealPlanCapabilityLatch = {
  isFeatureDisabled: false,
  areRoutesMissing: false
}

export interface MealPlanCapabilityErrors {
  preferencesError: unknown
  currentPlanError: unknown
  targetsError: unknown
}

/**
 * Where one request sits in the gating policy, which is the whole of what decides whether its failure can
 * produce a capability signal. Neither member is a property of the error — the same error means different
 * things on different routes — so it has to travel with the request.
 *
 * `isGated`: the server gates this route behind `MEAL_PLANNING_ENABLED` — `/meal-planning/*` except
 * `/meal-planning/targets*`, plus `/recipes/*` (AAP 0.3.1, 0.5.1) — so a confirmed `feature_disabled` from it
 * is signal (a) of AAP 0.2.5.
 *
 * `isRoutesProbe`: this is one of the three resource-less GETs (`/meal-planning/preferences`,
 * `/meal-planning/plans/current`, `/meal-planning/targets`), which a feature-bearing backend answers with 200
 * and null members, so a bare 404 from it is signal (b).
 *
 * The two are independent. The targets read probes for route absence while never being gated, and a gated
 * resource route (a plan day, a recipe) can answer signal (a) while its own bare 404 is the not-found/not-yours
 * answer of AAP 0.5.2 and must never be read as unavailability.
 */
export interface MealPlanRequestScope {
  isGated: boolean
  isRoutesProbe: boolean
}

/** One settled request as the capability policy reads it: where it sits in the policy, and how it failed. */
export interface ObservedMealPlanRequest extends MealPlanRequestScope {
  error: unknown
}

/** The answer for any request outside the gating policy — `/catalog/*`, targets, everything non-planning. */
export const NO_MEAL_PLAN_REQUEST_SCOPE: MealPlanRequestScope = {isGated: false, isRoutesProbe: false}

// Preferences and current plan are both: gated by the server flag, and resource-less GETs whose bare 404 means
// a rolled-back backend. Targets is a probe only — never gated (AAP 0.3.1) — which is what keeps Account,
// Progress and the Diary editor reading it while planning is off.
const GATED_ROUTES_PROBE_SCOPE: MealPlanRequestScope = {isGated: true, isRoutesProbe: true}

const UNGATED_ROUTES_PROBE_SCOPE: MealPlanRequestScope = {isGated: false, isRoutesProbe: true}

/**
 * The one producer of AAP 0.2.5's two signals: every gated request that has failed, and every resource-less
 * probe that has, read together. Nothing else in the app may derive a signal, which is what makes a setup save,
 * a nested plan read or a keyed write as much a source of the capability verdict as the entitlement's own reads.
 *
 * `isFeatureDisabled` requires a *confirmed* `feature_disabled` (`isConfirmedFeatureDisabledError`): a gateway
 * 502 whose body happens to echo the code describes nothing about the attempt, and latching the session on it
 * would stop every gated request over a failure a second attempt would have resolved.
 */
export const deriveMealPlanCapabilitySignalsFromRequests = (
  requests: Iterable<ObservedMealPlanRequest>
): MealPlanCapabilitySignals => {
  let isFeatureDisabled = false
  let areRoutesMissing = false

  for (const {isGated, isRoutesProbe, error} of requests) {
    isFeatureDisabled = isFeatureDisabled || (isGated && isConfirmedFeatureDisabledError(error))
    areRoutesMissing = areRoutesMissing || (isRoutesProbe && isRoutesMissingError(error))
  }

  return {isFeatureDisabled, areRoutesMissing}
}

/**
 * Classifies the three entitlement reads' current errors into the two signals, expressed through the rule above
 * rather than beside it: the three reads are simply three requests whose scopes are known, so there is one
 * classification for them and for every other gated request in the app instead of two that can drift.
 */
export const deriveMealPlanCapabilitySignals = ({
  preferencesError,
  currentPlanError,
  targetsError
}: MealPlanCapabilityErrors): MealPlanCapabilitySignals =>
  deriveMealPlanCapabilitySignalsFromRequests([
    {...GATED_ROUTES_PROBE_SCOPE, error: preferencesError},
    {...GATED_ROUTES_PROBE_SCOPE, error: currentPlanError},
    {...UNGATED_ROUTES_PROBE_SCOPE, error: targetsError}
  ])

/**
 * Adds the signals just seen to the latch, which is a bitwise OR: a signal is never unlatched by a later read
 * that did not carry it, because a disabled or absent route answers a repeat probe the same way and the point of
 * the latch is not to issue that probe.
 *
 * Returns the latch it was given, by reference, when nothing changed. That identity is load-bearing: whatever
 * holds the latch publishes it through `useSyncExternalStore`, which compares snapshots by identity and would
 * re-render every consumer on every settled read if a merge always allocated.
 */
export const mergeMealPlanCapabilityLatch = (
  latch: MealPlanCapabilityLatch,
  signals: MealPlanCapabilitySignals
): MealPlanCapabilityLatch => {
  const isFeatureDisabled = latch.isFeatureDisabled || signals.isFeatureDisabled
  const areRoutesMissing = latch.areRoutesMissing || signals.areRoutesMissing

  if (isFeatureDisabled === latch.isFeatureDisabled && areRoutesMissing === latch.areRoutesMissing) {
    return latch
  }

  return {isFeatureDisabled, areRoutesMissing}
}

/**
 * The retained verdict as a value: the latch, and the Remote Config activation it was reached under.
 *
 * The epoch is what turns the release of AAP 0.7.5 into data. A `503 feature_disabled` can be met before the
 * launch activation settles — the SDK serves a cached activated value straight away, so the gated requests run
 * and fail first — so the activation that confirms the feature is on must release the verdict it may have
 * raced. Storing the epoch beside the latch is what makes that release happen exactly once per activation
 * however many observers see the broadcast, with no module-level `let` to hold it.
 */
export interface MealPlanCapabilityRecord {
  activationEpoch: number
  latch: MealPlanCapabilityLatch
}

/** The latch a record holds, or the empty one when no verdict has been recorded this session. */
export const latchFromCapabilityRecord = (record: MealPlanCapabilityRecord | undefined): MealPlanCapabilityLatch =>
  record?.latch ?? NO_MEAL_PLAN_CAPABILITY_LATCH

const holdsCapabilitySignal = ({isFeatureDisabled, areRoutesMissing}: MealPlanCapabilitySignals): boolean =>
  isFeatureDisabled || areRoutesMissing

/**
 * The record a reading of the current signals produces, given the record already held and the activation those
 * signals were read under. The whole retention rule, as one pure reducer:
 *
 * - nothing held and nothing seen → `undefined`, so no record is created for a session with no verdict at all;
 * - nothing held and a signal seen → a record at this activation holding it;
 * - the activation already recorded → the signals are merged in, because a latch only ever accumulates (AAP
 *   0.2.5: a disabled or absent route answers a repeat probe identically, and not issuing that probe is the
 *   point);
 * - a *later* activation → it released the verdict, so the merge restarts from `NO_MEAL_PLAN_CAPABILITY_LATCH`
 *   with the signals in hand — which re-latches immediately when the terminal error is still the answer, and
 *   clears when it is not — and the new epoch is stored so the release happens once;
 * - an *earlier* activation → the reading is stale and may only add signals, never release. Epochs increase
 *   monotonically, so a reading taken under an older one comes from an observer that has not yet seen the
 *   activation, and letting it release would let two observers release each other's verdict in turn — an
 *   unbounded exchange of writes, since each write notifies the other.
 *
 * Returns the record it was given, by reference, when nothing changed. That identity is load-bearing twice
 * over: the holder publishes through `useSyncExternalStore`, which compares snapshots by reference, and its
 * writer writes only when the reference changes — and since the write itself notifies the writer's own
 * subscription, an allocating "unchanged" result would be an infinite write loop, not just a re-render storm.
 */
export const nextMealPlanCapabilityRecord = (
  record: MealPlanCapabilityRecord | undefined,
  activationEpoch: number,
  signals: MealPlanCapabilitySignals
): MealPlanCapabilityRecord | undefined => {
  if (record === undefined) {
    return holdsCapabilitySignal(signals)
      ? {activationEpoch, latch: mergeMealPlanCapabilityLatch(NO_MEAL_PLAN_CAPABILITY_LATCH, signals)}
      : undefined
  }

  if (activationEpoch > record.activationEpoch) {
    return {activationEpoch, latch: mergeMealPlanCapabilityLatch(NO_MEAL_PLAN_CAPABILITY_LATCH, signals)}
  }

  const latch = mergeMealPlanCapabilityLatch(record.latch, signals)

  return latch === record.latch ? record : {activationEpoch: record.activationEpoch, latch}
}

export const resolveMealPlanEntitlement = ({
  isFlagEnabled,
  preferencesError,
  currentPlanError,
  targetsError,
  hasPlan,
  capabilityLatch = NO_MEAL_PLAN_CAPABILITY_LATCH
}: MealPlanEntitlementInputs): MealPlanEntitlement => {
  if (!isFlagEnabled) {
    return {
      availability: 'disabled',
      isSegmentedControlVisible: false,
      isCatalogVisible: false,
      isGatedRequestAllowed: false,
      hasPlan
    }
  }

  // Live OR latched, so a signal already seen in this session still governs after the read that carried it has
  // been discarded — which is the whole of the retention rule: the verdict outlives the error object.
  const {isFeatureDisabled: isGatedRouteDisabled, areRoutesMissing} = mergeMealPlanCapabilityLatch(
    capabilityLatch,
    deriveMealPlanCapabilitySignals({preferencesError, currentPlanError, targetsError})
  )
  const isUnavailable = isGatedRouteDisabled || areRoutesMissing

  return {
    // Either unavailability signal of AAP 0.2.5 — (a) a gated route answering `503 feature_disabled`, (b) a
    // bare 404 from one of the resource-less GETs — puts the Meal Plan segment on its neutral unavailable
    // card, while the segmented control itself stays.
    availability: isUnavailable ? 'unavailable' : 'enabled',
    isSegmentedControlVisible: true,
    // Add Food's Catalog section follows route absence alone, not the segment's verdict, because the two
    // signals mean different things for `/catalog/*`. Under signal (a) the backend is mounted and
    // `/catalog/*` is never gated by `MEAL_PLANNING_ENABLED` (AAP 0.3.1, 0.5.1), so catalog search still
    // answers and the section must stay — the operator scenario in AAP 0.9.4 states exactly that outcome
    // ("the Meal Plan body shows the unavailable card, Add Food keeps the Catalog section"). Under signal (b)
    // the backend has no `/catalog/*` either, so the section goes with the rest of the feature. Hiding it for
    // signal (a) as well would read AAP 0.2.5's shared-effect sentence over the operator scenario that
    // demonstrates the opposite, and would take away a working surface.
    isCatalogVisible: !areRoutesMissing,
    // False as soon as either signal has been seen, and it stays false because the latch keeps the signal: a
    // route that answered `503 feature_disabled` or a bare 404 answers the next probe identically, so a remount,
    // a focus or a reconnect must not issue one (AAP 0.2.5's "no gated request", 0.7.5's rollback path). The
    // ungated `/meal-planning/targets*` read is not governed by this flag and keeps running in every state,
    // which is what leaves Account, Progress and the Diary editor on their local target fallback.
    isGatedRequestAllowed: !isUnavailable,
    hasPlan
  }
}
