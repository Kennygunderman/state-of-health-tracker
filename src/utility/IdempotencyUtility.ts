export type MealPlanActionType = 'generate' | 'regenerate' | 'swap' | 'log'

/**
 * The request material of one keyed write, stored beside its idempotency key so a process that died before
 * the response arrived can send the byte-identical request again under the same key. A fingerprint alone
 * cannot do this: it is a one-way comparison token, so a cold start holding only a fingerprint has nothing
 * to rebuild a body from and would have to mint a second key — which is how one intent becomes two plans,
 * two swaps or two diary entries (0.7.2).
 *
 * One variant per `meal_plan_actions.action_type`, each carrying exactly the members of its endpoint's body
 * and path (0.5.2) and nothing else: the snapshot is the single source the key, the fingerprint, the path
 * ids and the body are all derived from, so they cannot drift apart.
 */
export type GenerateRequestSnapshot = {
  action: 'generate'
  startDate: string
  expectedPreferencesRevision: number
  expectedTargetsRevision: number
}

export type RegenerateRequestSnapshot = {
  action: 'regenerate'
  planId: string
  expectedPlanRevision: number
  expectedPreferencesRevision: number
  expectedTargetsRevision: number
}

export type SwapRequestSnapshot = {
  action: 'swap'
  planId: string
  mealId: string
  recipeVersionId: string
  portionMultiplier: number
  expectedPlanRevision: number
}

export type LogRequestSnapshot = {
  action: 'log'
  planId: string
  mealId: string
  servings: number
  date: string
  diaryMealId: string
  expectedPlanRevision: number
}

export type MealPlanRequestSnapshot =
  | GenerateRequestSnapshot
  | RegenerateRequestSnapshot
  | SwapRequestSnapshot
  | LogRequestSnapshot

/** Every keyed meal-planning write is a POST (0.5.2), so the method is a constant rather than an argument. */
export const MEAL_PLAN_REQUEST_METHOD = 'POST'

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
    // Indexed rather than `map`, which skips a sparse hole and would fingerprint a one-hole array
    // as `[]`: JSON sends that slot as `null`, so every slot up to `length` is emitted.
    const slots: string[] = []

    for (let index = 0; index < value.length; index++) {
      slots.push(canonicalJson(value[index]))
    }

    return `[${slots.join(',')}]`
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

// PostgreSQL `Int`, which is what every `revision` column is. A value above it, a fractional value or one
// beyond the safe-integer range could never have come from a server response, so a persisted record carrying
// one is corrupt rather than merely old — and replaying it would earn a 500 rather than the stored result.
const MAX_REVISION = 2_147_483_647

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

const EMPTY_IDS: readonly string[] = Object.freeze([])

// The fingerprint of a snapshot is computed from the body it reconstructs, and `fingerprint` drops
// `idempotencyKey` at every depth, so the value passed here cannot reach the output. It is named rather than
// inlined so that a future change making the key significant fails the test that pins this independence
// instead of silently tying every stored fingerprint to one placeholder.
const FINGERPRINT_KEY_PLACEHOLDER = ''

const SNAPSHOT_MEMBERS: Record<MealPlanActionType, readonly string[]> = {
  generate: ['action', 'startDate', 'expectedPreferencesRevision', 'expectedTargetsRevision'],
  regenerate: ['action', 'planId', 'expectedPlanRevision', 'expectedPreferencesRevision', 'expectedTargetsRevision'],
  swap: ['action', 'planId', 'mealId', 'recipeVersionId', 'portionMultiplier', 'expectedPlanRevision'],
  log: ['action', 'planId', 'mealId', 'servings', 'date', 'diaryMealId', 'expectedPlanRevision']
}

/**
 * Whether a value names one of the four keyed writes this release knows. The check is an own-property lookup
 * against the member table rather than a comparison list, so the two cannot drift: an action is known exactly
 * when its members are. Own-property matters — `'constructor'` and `'toString'` reach entries on
 * `Object.prototype`, and a plain `in` or truthiness test would accept them as actions.
 *
 * Exported because action names also arrive from device storage as persisted slot keys, where their
 * TypeScript type is a claim about what this release wrote rather than about what is on disk: a record
 * written by a newer release, or a hand-edited file, can carry any string at all.
 */
export const isMealPlanActionType = (value: unknown): value is MealPlanActionType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(SNAPSHOT_MEMBERS, value)

/**
 * The members of one action's snapshot, or `null` when the action is not one this release knows. Indexing the
 * table directly is what makes an unknown action throw instead of failing closed, so every read of it goes
 * through here.
 */
const snapshotMembersFor = (action: MealPlanActionType): readonly string[] | null =>
  isMealPlanActionType(action) ? SNAPSHOT_MEMBERS[action] : null

const isIdentifier = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const isDayKey = (value: unknown): value is string => typeof value === 'string' && DAY_KEY.test(value)

const isRevision = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_REVISION

const isPositiveAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

/**
 * Membership is exact in both directions. A missing member cannot be reconstructed, and an extra one means
 * the record was written against a different contract — a newer release, or a hand-edited storage file —
 * whose body this release would rebuild without it. Replaying a different body under an old key is precisely
 * what the server answers with `409 idempotency_conflict` (0.5.1), so the fail-closed answer is to refuse the
 * record and let the caller mint a new key.
 */
const hasExactMembers = (value: Record<string, unknown>, members: readonly string[]): boolean =>
  Object.keys(value).length === members.length &&
  members.every(member => Object.prototype.hasOwnProperty.call(value, member))

const parseGenerate = (value: Record<string, unknown>): GenerateRequestSnapshot | null =>
  isDayKey(value.startDate) &&
  isRevision(value.expectedPreferencesRevision) &&
  isRevision(value.expectedTargetsRevision)
    ? {
        action: 'generate',
        startDate: value.startDate,
        expectedPreferencesRevision: value.expectedPreferencesRevision,
        expectedTargetsRevision: value.expectedTargetsRevision
      }
    : null

const parseRegenerate = (value: Record<string, unknown>): RegenerateRequestSnapshot | null =>
  isIdentifier(value.planId) &&
  isRevision(value.expectedPlanRevision) &&
  isRevision(value.expectedPreferencesRevision) &&
  isRevision(value.expectedTargetsRevision)
    ? {
        action: 'regenerate',
        planId: value.planId,
        expectedPlanRevision: value.expectedPlanRevision,
        expectedPreferencesRevision: value.expectedPreferencesRevision,
        expectedTargetsRevision: value.expectedTargetsRevision
      }
    : null

const parseSwap = (value: Record<string, unknown>): SwapRequestSnapshot | null =>
  isIdentifier(value.planId) &&
  isIdentifier(value.mealId) &&
  isIdentifier(value.recipeVersionId) &&
  isPositiveAmount(value.portionMultiplier) &&
  isRevision(value.expectedPlanRevision)
    ? {
        action: 'swap',
        planId: value.planId,
        mealId: value.mealId,
        recipeVersionId: value.recipeVersionId,
        portionMultiplier: value.portionMultiplier,
        expectedPlanRevision: value.expectedPlanRevision
      }
    : null

const parseLog = (value: Record<string, unknown>): LogRequestSnapshot | null =>
  isIdentifier(value.planId) &&
  isIdentifier(value.mealId) &&
  isPositiveAmount(value.servings) &&
  isDayKey(value.date) &&
  isIdentifier(value.diaryMealId) &&
  isRevision(value.expectedPlanRevision)
    ? {
        action: 'log',
        planId: value.planId,
        mealId: value.mealId,
        servings: value.servings,
        date: value.date,
        diaryMealId: value.diaryMealId,
        expectedPlanRevision: value.expectedPlanRevision
      }
    : null

/**
 * Validates a snapshot restored from device storage, where it arrives as whatever JSON was on disk rather
 * than as the type it was written as. `action` is the slot the record was stored under and the discriminant
 * has to equal it, so a record that would reconstruct a different request than the one the caller is asking
 * about can never be replayed. Returns a fresh, narrowed value built member by member — never the input — so
 * nothing beyond the contract survives into the request.
 *
 * Total over runtime input, including the action. The declared parameter type describes what a compiled
 * caller may pass, not what a persisted slot key can hold: a record written by a newer release carries an
 * action this release has no members for, and a hand-edited file can name one that resolves on
 * `Object.prototype`. Both answer `null` here — refusing an unreproducible request is the same outcome as
 * refusing a corrupt one — rather than throwing out of the rehydration that reads them.
 */
export const parseRequestSnapshot = (value: unknown, action: MealPlanActionType): MealPlanRequestSnapshot | null => {
  const members = snapshotMembersFor(action)

  if (members === null || !isJsonObject(value) || value.action !== action || !hasExactMembers(value, members)) {
    return null
  }

  if (action === 'generate') {
    return parseGenerate(value)
  }

  if (action === 'regenerate') {
    return parseRegenerate(value)
  }

  return action === 'swap' ? parseSwap(value) : parseLog(value)
}

/**
 * The request's path ids in path order (0.5.2): none for generate, the plan for regenerate, the plan and the
 * meal for swap and log. Never sorted — a different order is a different request.
 */
export const requestIds = (snapshot: MealPlanRequestSnapshot): readonly string[] => {
  if (snapshot.action === 'generate') {
    return EMPTY_IDS
  }

  if (snapshot.action === 'regenerate') {
    return [snapshot.planId]
  }

  return [snapshot.planId, snapshot.mealId]
}

/**
 * The wire body of 0.5.2, rebuilt from the snapshot with the key the caller decided to send — the stored key
 * on a replay, a freshly minted one otherwise. Path ids are deliberately absent: they identify the route, and
 * repeating them in the body would put a second copy of the same value on the wire.
 */
export const requestBody = (snapshot: MealPlanRequestSnapshot, idempotencyKey: string): Record<string, unknown> => {
  if (snapshot.action === 'generate') {
    return {
      startDate: snapshot.startDate,
      expectedPreferencesRevision: snapshot.expectedPreferencesRevision,
      expectedTargetsRevision: snapshot.expectedTargetsRevision,
      idempotencyKey
    }
  }

  if (snapshot.action === 'regenerate') {
    return {
      expectedPlanRevision: snapshot.expectedPlanRevision,
      expectedPreferencesRevision: snapshot.expectedPreferencesRevision,
      expectedTargetsRevision: snapshot.expectedTargetsRevision,
      idempotencyKey
    }
  }

  if (snapshot.action === 'swap') {
    return {
      recipeVersionId: snapshot.recipeVersionId,
      portionMultiplier: snapshot.portionMultiplier,
      expectedPlanRevision: snapshot.expectedPlanRevision,
      idempotencyKey
    }
  }

  return {
    servings: snapshot.servings,
    date: snapshot.date,
    diaryMealId: snapshot.diaryMealId,
    expectedPlanRevision: snapshot.expectedPlanRevision,
    idempotencyKey
  }
}

/**
 * The fingerprint of the request a snapshot reconstructs. Computing it from the snapshot rather than from a
 * body the caller assembled is what makes the stored fingerprint and the stored request one fact: a record
 * whose fingerprint does not equal this value describes a request it cannot rebuild and must not be replayed.
 */
export const fingerprintSnapshot = (snapshot: MealPlanRequestSnapshot): string =>
  fingerprint(
    MEAL_PLAN_REQUEST_METHOD,
    snapshot.action,
    requestIds(snapshot),
    requestBody(snapshot, FINGERPRINT_KEY_PLACEHOLDER)
  )

/**
 * Whether a snapshot is the request a stored fingerprint was taken of — the byte-identical-replay test of
 * 0.7.2, applied both to verify a restored record against itself and to decide whether the request a screen
 * is about to send is still the one the key was minted for.
 */
export const matchesFingerprint = (snapshot: MealPlanRequestSnapshot, storedFingerprint: string): boolean =>
  fingerprintSnapshot(snapshot) === storedFingerprint
