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
  readOnlyField: 'read_only_field',
  recipeIneligible: 'recipe_ineligible',
  invalidRequest: 'invalid_request',
  invalidPayload: 'invalid_payload',
  catalogFoodNotFound: 'catalog_food_not_found',
  invalidServing: 'invalid_serving',
  planGenerationFailed: 'plan_generation_failed',
  swapFailed: 'swap_failed',
  estimationFailed: 'estimation_failed',
  brandedSearchFailed: 'branded_search_failed'
} as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES]

export type ApiOutcome = 'confirmed' | 'unknown'

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

// 'confirmed' means the server described the outcome of this attempt in a decodable body — a 4xx carrying
// `{error: string}`, or a 5xx carrying a recognised failure code. It never asserts that nothing was written:
// a repeated revisioned save answers `stale_revision`/`stale_targets` precisely because the first attempt
// committed, and a same-key retry carrying a changed body answers `idempotency_conflict`. Reconciliation is
// therefore per code, and only a confirmed failure of the current attempt may draw the 10b/13e "unchanged"
// assurances. Anything else is 'unknown' — the request may have committed before the response was lost, so
// callers must not promise nothing changed, and keyed mutations retry with the same idempotency key.
export function classifyOutcome(error: unknown): ApiOutcome {
  const status = (error as {response?: {status?: unknown}} | null)?.response?.status
  const code = getApiErrorCode(error)

  if (typeof status !== 'number') {
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

// The answer a READ may be redirected on: the server has either contradicted the plan the screen is holding or
// reported the capability off, and both have an authoritative next move (0.2.5) — the stale-plan toast with a
// plan refetch, or the unavailable card the entitlement router draws from this very signal.
//
// Confirmed-ness is load-bearing and deliberately not dropped. A 5xx that merely carried the string 'stale_plan'
// is an *unknown* outcome under the classification above, and an outcome nothing described is a retry rather
// than a redirection: sending the user somewhere else on a gateway body that happens to echo a code would
// abandon a screen that a second attempt would have loaded.
export function isPlanOrCapabilityRefusal(error: unknown): boolean {
  return classifyOutcome(error) === 'confirmed' && (isPlanStateError(error) || isFeatureDisabledError(error))
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
