export type MealPlanActionType = 'generate' | 'regenerate' | 'swap' | 'log'

const IDEMPOTENCY_KEY_MEMBER = 'idempotencyKey'

/**
 * Mints the key for one user intent. The UUID source is a parameter — rather than the direct `uuid`
 * import used elsewhere in the app — so this module stays pure and the randomness enters at the
 * press handler that decides to mint.
 */
export const mintKey = (generateUuid: () => string): string => generateUuid()

const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isIdempotencyKeyMember = (key: string): boolean => key === IDEMPOTENCY_KEY_MEMBER

const isAbsentInJson = (value: unknown): boolean =>
  value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint'

/**
 * Canonical stand-in for `JSON.stringify`: object members are emitted in ascending key order at
 * every depth, so a body assembled by hand and the same body decoded from AsyncStorage produce an
 * identical string. `JSON.stringify` preserves insertion order, which would make a persisted intent
 * mismatch its freshly computed fingerprint after a cold start and needlessly mint a second key.
 *
 * Values JSON cannot represent are treated the way `JSON.stringify` treats them: dropped as an
 * object member, `null` in a structural slot.
 */
const canonicalJson = (value: unknown): string => {
  if (isAbsentInJson(value)) {
    return 'null'
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => canonicalJson(item)).join(',')}]`
  }

  if (isJsonObject(value)) {
    const members = Object.keys(value)
      .filter(key => !isIdempotencyKeyMember(key) && !isAbsentInJson(value[key]))
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)

    return `{${members.join(',')}}`
  }

  return JSON.stringify(value)
}

/**
 * Deterministic comparison token for a pending meal-planning intent: the fingerprint stored beside
 * an idempotency key is compared with a freshly computed one to decide whether that key may be
 * replayed. Any difference means the payload changed, so the caller must mint a new key rather than
 * reuse one the server would answer with `409 idempotency_conflict`.
 *
 * `ids` are the request's path ids in path order — `[]` to generate, `[planId]` to regenerate,
 * `[planId, mealId]` to swap or log — and are never sorted, because a different order is a
 * different request.
 *
 * The request's own `idempotencyKey` is excluded at every depth of `body`: including it would make
 * every comparison trivially equal and defeat the change detection this token exists for.
 *
 * Deliberately unhashed. The server keeps its own SHA-256 `request_fingerprint`; this value is a
 * local comparison token that never crosses the wire, and no hash dependency may be added to this
 * app — so determinism, not digest compatibility, is the requirement.
 */
export const fingerprint = (
  method: string,
  action: MealPlanActionType,
  ids: readonly string[],
  body: unknown
): string => `${method.toUpperCase()}|${action}|${ids.join(',')}|${canonicalJson(body)}`
