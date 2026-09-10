// Machine-readable codes the API returns in the `error` field of a 4xx or 5xx response body.
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

// A 'confirmed' failure is one the server described: the write did not happen, so the caller may say so.
// Anything else is 'unknown' — the request may have committed before the response was lost, so callers
// must not promise nothing changed, and keyed mutations retry with the same idempotency key.
export function classifyOutcome(error: unknown): ApiOutcome {
  const status = (error as {response?: {status?: unknown}} | null)?.response?.status
  const code = getApiErrorCode(error)

  if (typeof status !== 'number') {
    return 'unknown'
  }

  if (status >= 500) {
    return code !== null && RECOGNIZED_SERVER_FAILURE_CODES.has(code) ? 'confirmed' : 'unknown'
  }

  return status >= 400 && code !== null ? 'confirmed' : 'unknown'
}

export function isUnknownOutcome(error: unknown): boolean {
  return classifyOutcome(error) === 'unknown'
}
