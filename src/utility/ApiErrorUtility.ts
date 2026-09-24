// Machine-readable codes the API returns in the `error` field of a 4xx or 5xx response body.
// `noMatchingMeals` and `planGenerationFailed` are also the discriminants of PlanGenerationResult's outcome
// union (data/models/PlanGenerationResult.ts reads them through `typeof`), so renaming either entry or
// changing its string is a wire-contract change, not a local rename.
export const API_ERROR_CODES = {
  featureDisabled: 'feature_disabled',
  quotaExceeded: 'quota_exceeded',
  noMatchingMeals: 'no_matching_meals',
  stalePlan: 'stale_plan',
  planNotActive: 'plan_not_active',
  previewStale: 'preview_stale',
  idempotencyConflict: 'idempotency_conflict',
  staleRevision: 'stale_revision',
  staleTargets: 'stale_targets',
  targetsMissing: 'targets_missing',
  targetsUnconfirmed: 'targets_unconfirmed',
  estimateUnavailable: 'estimate_unavailable',
  estimateStale: 'estimate_stale',
  planOverlap: 'plan_overlap',
  upcomingExists: 'upcoming_exists',
  preferencesIncomplete: 'preferences_incomplete',
  recipeIneligible: 'recipe_ineligible',
  invalidRequest: 'invalid_request',
  invalidPayload: 'invalid_payload',
  catalogFoodNotFound: 'catalog_food_not_found',
  invalidServing: 'invalid_serving',
  userNotFound: 'user_not_found',
  planGenerationFailed: 'plan_generation_failed',
  swapFailed: 'swap_failed',
  estimationFailed: 'estimation_failed',
  brandedSearchFailed: 'branded_search_failed'
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

// The SECOND vocabulary, and a different one: these appear only as a `details[]` entry's `code`, never as the
// body's top-level `error`. A refusal that names fields answers `{error: 'invalid_request', details: [{field,
// code}]}` — `invalid_request` above is what `getApiErrorCode` sees, and one of the codes below is what says
// what is wrong with which field.
//
// THEY ARE SEPARATE BECAUSE MIXING THEM DECLARES A LIE. `read_only_field` sat in the map above, so every
// `getApiErrorCode(error) === API_ERROR_CODES.readOnlyField` a screen could write was dead on arrival: the
// server has never put that string in `error`, and three mutation fixtures had encoded the impossible shape
// (a 409 whose top-level code is `read_only_field`) as the thing under test. A code the client can compare
// against but the server cannot send is worse than a missing one, because it reads as covered.
//
// One client vocabulary for six server ones. `preferences.logic.ts`, `targets.logic.ts`,
// `plannedMealLog.logic.ts`, `mealPlan.logic.ts`, `swap.logic.ts` and `grocery.logic.ts` each declare their
// own field-code map, deliberately overlapping so that — in that code's own words — "the client maps one
// vocabulary and not four". This is that one vocabulary; the union is what keeps it true.
export const API_ERROR_DETAIL_CODES = {
  required: 'required',
  invalidType: 'invalid_type',
  invalidId: 'invalid_id',
  invalidDate: 'invalid_date',
  invalidTime: 'invalid_time',
  invalidTimeZone: 'invalid_time_zone',
  invalidServings: 'invalid_servings',
  invalidCharacters: 'invalid_characters',
  notAnInteger: 'not_an_integer',
  belowMinimum: 'below_minimum',
  aboveMaximum: 'above_maximum',
  outOfRange: 'out_of_range',
  outsidePlanWeek: 'outside_plan_week',
  unknownValue: 'unknown_value',
  unknownStep: 'unknown_step',
  unknownField: 'unknown_field',
  readOnlyField: 'read_only_field',
  notAllowed: 'not_allowed',
  tooMany: 'too_many',
  mutuallyExclusive: 'mutually_exclusive',
  unsupportedCurrency: 'unsupported_currency',
  slotMismatch: 'slot_mismatch',
  notBelowCurrentWeight: 'not_below_current_weight',
  notAboveCurrentWeight: 'not_above_current_weight',
  conflictingFoodReference: 'conflicting_food_reference',
  unrecognizedPayload: 'unrecognized_payload'
} as const

export type ApiErrorDetailCode = (typeof API_ERROR_DETAIL_CODES)[keyof typeof API_ERROR_DETAIL_CODES]

// One entry of a refusal's `details[]`: which field, and what is wrong with it. `field` is sometimes the
// client's own object key (an unrecognised key is reported under the name the request used), so it is never
// shown to a user as-is and never used to index anything.
export interface ApiErrorDetail {
  field: string
  code: string
}

export type ApiOutcome = 'confirmed' | 'unknown'

// Declared here rather than imported from the entitlement utility, which reads its own copy: that module
// depends on this one for `getApiErrorCode`, so the import could only run the other way.
const NOT_FOUND_STATUS = 404

const RECOGNIZED_SERVER_FAILURE_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.planGenerationFailed,
  API_ERROR_CODES.swapFailed,
  API_ERROR_CODES.featureDisabled,
  API_ERROR_CODES.estimationFailed,
  API_ERROR_CODES.brandedSearchFailed
])

export function getApiErrorCode(error: unknown): string | null {
  const code = (error as {response?: {data?: {error?: unknown}}} | null)?.response?.data?.error

  return typeof code === 'string' ? code : null
}

// The transport's own answer, read here beside the body's code so that no screen reaches into an axios shape of
// its own to branch on a status. `null` means the attempt produced no numeric status at all — a timeout, a
// network error, or a rejection that never reached a response — which is precisely the case a caller must not
// read as a server verdict.
export function getApiErrorStatus(error: unknown): number | null {
  const status = (error as {response?: {status?: unknown}} | null)?.response?.status

  return typeof status === 'number' ? status : null
}

// The per-field half of a refusal, read the same way its code is: an empty array when the body carries none,
// so a caller can iterate unconditionally and never reach into an axios shape of its own.
//
// It exists because the server had been sending `details[]` that nothing on this side ever opened. Every
// refusal that names fields — `PUT /meal-planning/preferences` with a server-owned key, a malformed path id
// on the diary routes, a log date outside the plan week — carries the field and the reason, and the client
// was reducing all of them to one generic toast, discarding the only part of the answer that says what to
// fix. Reading them cannot be optional-but-available and still be true, so this is the accessor a caller
// uses; `getApiErrorCode` alone can never distinguish two `invalid_request`s.
//
// Defensive per entry rather than per array: a body is untrusted input (a proxy's error page, a truncated
// payload, a future server field), so a non-array `details`, a non-object entry, or an entry missing either
// string is dropped and the rest still read. A partially-decodable refusal is more useful than none.
export function getApiErrorDetails(error: unknown): ApiErrorDetail[] {
  const details = (error as {response?: {data?: {details?: unknown}}} | null)?.response?.data?.details

  if (!Array.isArray(details)) {
    return []
  }

  return details.reduce<ApiErrorDetail[]>((accumulated, entry) => {
    const candidate = entry as {field?: unknown; code?: unknown} | null

    if (typeof candidate?.field === 'string' && typeof candidate.code === 'string') {
      accumulated.push({field: candidate.field, code: candidate.code})
    }

    return accumulated
  }, [])
}

// Did the refusal report this field-level reason at all? The detail-code equivalent of comparing
// `getApiErrorCode`, and the test a caller wants for a code whose presence is the whole signal — a
// `read_only_field` entry means the body carried a key the client should never have sent, whichever field
// it was.
export function hasApiErrorDetailCode(error: unknown, code: string): boolean {
  return getApiErrorDetails(error).some(detail => detail.code === code)
}

// The fields one reason was reported against, in the order the server listed them. Separate from the
// predicate above because a refusal can name several fields under one code, and a caller that means to act
// on them needs all of them rather than the first.
export function apiErrorDetailFields(error: unknown, code: string): string[] {
  return getApiErrorDetails(error)
    .filter(detail => detail.code === code)
    .map(detail => detail.field)
}

// 'confirmed' means the server described the outcome of this attempt in a decodable body — a 4xx carrying
// `{error: string}`, or a 5xx carrying a recognised failure code. It never asserts that nothing was written:
// a repeated revisioned save answers `stale_revision`/`stale_targets` precisely because the first attempt
// committed, and a same-key retry carrying a changed body answers `idempotency_conflict`. Reconciliation is
// therefore per code, and only a confirmed failure of the current attempt may draw the 10b/13e "unchanged"
// assurances. Anything else is 'unknown' — the request may have committed before the response was lost, so
// callers must not promise nothing changed, and keyed mutations retry with the same idempotency key.
export function classifyOutcome(error: unknown): ApiOutcome {
  const status = getApiErrorStatus(error)
  const code = getApiErrorCode(error)

  if (status === null) {
    return 'unknown'
  }

  if (status >= 500 && status < 600) {
    return code !== null && RECOGNIZED_SERVER_FAILURE_CODES.has(code) ? 'confirmed' : 'unknown'
  }

  return status >= 400 && status < 500 && code !== null ? 'confirmed' : 'unknown'
}

export function isUnknownOutcome(error: unknown): boolean {
  return classifyOutcome(error) === 'unknown'
}

// The capability signal: the code a mounted backend returns from a gated route while MEAL_PLANNING_ENABLED is
// off. Defined here, with the rest of the classification, because it is read both by the Macros entitlement
// (which turns it into the unavailable card) and by the keyed writes (for which it is terminal) — two
// hand-rolled comparisons would be free to drift.
export function isFeatureDisabledError(error: unknown): boolean {
  return getApiErrorCode(error) === API_ERROR_CODES.featureDisabled
}

// The one status the capability signal is defined on. AAP 0.2.5 and 0.7.5 both name it exactly — "503
// feature_disabled — the explicit capability code a mounted backend returns from any gated route" — and the
// backend maps its `MealPlanningDisabledError` to that status alone.
const FEATURE_DISABLED_STATUS = 503

// The capability signal as an *answer* rather than as a string: the server described this attempt's outcome and
// what it described is a mounted backend with server-side planning off — signal (a) of AAP 0.2.5.
//
// THE STATUS IS PART OF THE SIGNAL, not decoration on it. The code alone is not enough, because the same string
// carried by a different status means something else entirely:
//
// - a resource route's `404` is the not-found/not-yours answer of AAP 0.5.2 — which "never distinguishes missing
//   from not-yours" and is emphatically NOT an unavailability signal — yet a 4xx with any decodable body is
//   `confirmed`, so a `404 {error: 'feature_disabled'}` shaped by a proxy, a rewritten route or a future handler
//   would otherwise latch the whole session off one plan day or one recipe the caller simply cannot see;
// - a gateway `502` whose body happens to echo the code describes nothing about this attempt — it is a
//   recognised failure code, so `classifyOutcome` calls it confirmed for the generic purposes that exist for
//   (a keyed write must not promise "nothing changed") — but stopping every gated request in the session over a
//   failure a second attempt would have resolved is the opposite of what the latch is for.
//
// So this predicate is narrower than `classifyOutcome` on purpose, and deliberately does not consult it: at 503
// with a decodable code the outcome is confirmed by construction (a 5xx carrying a recognised failure code), so
// adding that call would assert nothing while implying the status test were optional.
//
// One definition, because two readers depend on it and they must never disagree about when the capability is
// off: the meal-planning entitlement, which turns this into the session's unavailable verdict, and the gated
// screens, whose own recovery for it is to leave for the tab that states it.
export function isConfirmedFeatureDisabledError(error: unknown): boolean {
  return getApiErrorStatus(error) === FEATURE_DISABLED_STATUS && isFeatureDisabledError(error)
}

// The two codes that say the plan an attempt named is not the plan the server holds. Declared beside the rest
// of the classification for the same reason `isFeatureDisabledError` is: the swap screen, the generating screen
// and the Macros entitlement all read this exact pair, and three hand-rolled comparisons would be free to drift
// the moment the wire contract gains a third plan-state code.
const PLAN_STATE_CODES: ReadonlySet<string> = new Set<string>([
  API_ERROR_CODES.stalePlan,
  API_ERROR_CODES.planNotActive
])

export function isPlanStateError(error: unknown): boolean {
  const code = getApiErrorCode(error)

  return code !== null && PLAN_STATE_CODES.has(code)
}

// The plan-state pair as an *answer* rather than as a string: the server described this attempt's outcome and
// what it described is a plan the client may no longer read or write. Confirmed-ness is the whole difference
// between a refusal and a retry — a 502 whose body happens to carry 'stale_plan' is an unknown outcome, and
// redirecting a screen on it would abandon a week a second attempt would have loaded.
export function isConfirmedPlanStateError(error: unknown): boolean {
  return classifyOutcome(error) === 'confirmed' && isPlanStateError(error)
}

// A resource route's combined not-found/not-yours answer (0.5.2): the 404 it returns rather than distinguishing
// "no such plan" from "not your plan", which would confirm the existence of another user's data.
//
// The decodable code is what separates it from the routes-missing 404 of the resource-less GETs, which means
// the backend was rolled back to a build without the feature and belongs to the entitlement verdict. A
// feature-bearing backend answers those with 200 and null members, so their 404 never carries a code; a
// resource route always names its refusal — `GET /plans/:planId/days/:date` answers `{error: 'Plan not found'}`
// for a plan that is absent or foreign AND for a date outside the plan's week. The status is read from the
// response rather than from a marker property, so a `RoutesMissingError` (which carries no response) is
// excluded by the status test before the code test is reached.
export function isResourceNotFoundError(error: unknown): boolean {
  return getApiErrorStatus(error) === NOT_FOUND_STATUS && getApiErrorCode(error) !== null
}

// The plan a read named is gone, whichever way the server said so: it replaced or ended the plan (the
// plan-state codes), or the resource itself is no longer the caller's to read (the 404 above). Both mean the
// plan the screen is holding is the wrong plan, so both earn the one recovery — the stale-plan toast and a
// current-plan refetch — and neither is worth retrying, because re-requesting a resource the server has
// already disowned returns the same answer forever.
export function isPlanReadInvalidatedError(error: unknown): boolean {
  return isConfirmedPlanStateError(error) || isResourceNotFoundError(error)
}

// The answer a READ may be redirected on: the server has either contradicted the plan the screen is holding or
// reported the capability off, and both have an authoritative next move (0.2.5) — the stale-plan toast with a
// plan refetch, or the unavailable card the entitlement router draws from this very signal.
//
// Composed from the two confirmed predicates rather than repeating either test, so the narrower ones the plan
// screens and the entitlement use and the wider one a read is redirected on cannot disagree about what
// "confirmed" means.
export function isPlanOrCapabilityRefusal(error: unknown): boolean {
  return isConfirmedPlanStateError(error) || isConfirmedFeatureDisabledError(error)
}

// The code of a confirmed refusal that a same-key retry can never resolve, or null when there is nothing to
// retire. Retryability is stated positively — `retryableCodes` is the caller's closed set of confirmed codes
// whose own state still offers a same-key retry or an in-place edit — so a code this release has never heard
// of is terminal by default rather than retryable by default. That direction matters: a key replayed against a
// refusal the server will repeat forever is one this client would never stop sending, and the AAP's drawn
// retry states are reserved for the specific outcomes they describe (0.2.5).
//
// Null for an unknown outcome as well: the request may have committed before the response was lost, so its
// key is still the only safe way to ask again and must not be retired (0.7.2).
export function terminalErrorCode(error: unknown, retryableCodes: ReadonlySet<string>): string | null {
  if (error === null || error === undefined || isUnknownOutcome(error)) {
    return null
  }

  const code = getApiErrorCode(error)

  // A confirmed outcome always carries a readable code — that is what `classifyOutcome` means by confirmed —
  // so the null branch is unreachable; it resolves to "not terminal" because retiring a key on an outcome
  // nothing could describe would be the one irreversible choice here.
  return code === null || retryableCodes.has(code) ? null : code
}
