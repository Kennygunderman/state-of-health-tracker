import {zustandAsyncStorage} from '@store/zustandAsyncStorage'
import {ONE_DAY_MS} from '@utility/DateUtility'
import {
  fingerprintSnapshot,
  isMealPlanActionType,
  matchesFingerprint,
  MealPlanActionType,
  MealPlanRequestSnapshot,
  parseRequestSnapshot
} from '@utility/IdempotencyUtility'
import {create} from 'zustand'
import {persist} from 'zustand/middleware'

export type MacrosSegment = 'diary' | 'mealPlan'

export type PostLogViewTarget = 'diary' | 'history'

export type PostLogResult = {
  entryId: string
  dateIso: string
  slotLabel: string
  recipeName: string
  viewTarget: PostLogViewTarget
}

export type PendingIntentAction = MealPlanActionType

/**
 * One unresolved keyed write. `request` is what makes the record replayable: a fingerprint is a one-way
 * comparison token, so a cold start holding only the key and the fingerprint could not rebuild the body and
 * would have to mint a second key — turning one intent into two plans, two swaps or two diary entries. With
 * the snapshot stored, the next launch reconstructs the byte-identical request the key was minted for
 * (0.7.2).
 *
 * `fingerprint`, `planId` and `planRevision` are all derived from `request` by `buildPendingIntent`, which is
 * the only way to build this shape: supplied independently they could describe a different request than the
 * one stored beside them, and nothing downstream could tell.
 */
export type PendingIntent = {
  userId: string
  key: string
  fingerprint: string
  planId: string | null
  planRevision: number | null
  createdAt: number
  request: MealPlanRequestSnapshot
}

/**
 * Which key the next attempt of a keyed write must carry, and the request it must send. `isReplay` is the
 * caller's cue that a server answer may be a stored response rather than a fresh commit.
 */
export type KeyedRequestPlan = {
  idempotencyKey: string
  isReplay: boolean
  request: MealPlanRequestSnapshot
}

export type MealPlanStore = {
  macrosSegment: MacrosSegment
  selectedPlanDate: string | null
  selectedPlanId: string | null
  dismissedSuccessBannerFor: string | null
  postLogResult: PostLogResult | null
  /**
   * The only field that outlives the process. A keyed write (generate, regenerate, swap, log) whose
   * response was lost may only be retried under the key it was already sent with, so the intent has
   * to survive an app kill; everything else here describes what the user is looking at right now
   * and is deliberately rebuilt from the server on the next launch.
   */
  pendingIntents: Partial<Record<PendingIntentAction, PendingIntent>>
  setMacrosSegment: (segment: MacrosSegment) => void
  setSelectedPlanDate: (dayKey: string | null) => void
  setSelectedPlanId: (planId: string | null) => void
  dismissSuccessBanner: (entryId: string) => void
  setPostLogResult: (result: PostLogResult) => void
  clearPostLogResult: () => void
  recordPendingIntent: (intent: PendingIntent) => void
  clearPendingIntent: (action: PendingIntentAction) => void
  prunePendingIntents: (now: number, userId: string | null) => void
  reset: () => void
}

export type MealPlanPersistedState = Pick<MealPlanStore, 'pendingIntents'>

/**
 * The persistence whitelist, kept as a named export so the contract is unit-testable rather than
 * observable only through storage. `pendingIntents` is the sole member: rehydrating a segment, a
 * selected plan or a post-log banner would restore a view the server may have moved past, whereas
 * an unresolved intent is precisely what a cold start needs in order to replay the same key.
 */
export const selectPersistedState = (state: MealPlanStore): MealPlanPersistedState => ({
  pendingIntents: state.pendingIntents
})

const defaultState: Pick<
  MealPlanStore,
  | 'macrosSegment'
  | 'selectedPlanDate'
  | 'selectedPlanId'
  | 'dismissedSuccessBannerFor'
  | 'postLogResult'
  | 'pendingIntents'
> = {
  macrosSegment: 'diary',
  selectedPlanDate: null,
  selectedPlanId: null,
  dismissedSuccessBannerFor: null,
  postLogResult: null,
  pendingIntents: {}
}

const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setMacrosSegment: segment => set({macrosSegment: segment}),

      setSelectedPlanDate: dayKey => set({selectedPlanDate: dayKey}),

      setSelectedPlanId: planId =>
        set(state => (state.selectedPlanId === planId ? state : {selectedPlanId: planId, selectedPlanDate: null})),

      /**
       * The payload only ever feeds the banner it was written for, so it dies with it — a log the
       * user has already acknowledged must not stay re-announceable. The entry id outlives it so a
       * replay of that very same log cannot raise the banner again (see `setPostLogResult`).
       */
      dismissSuccessBanner: entryId => set({postLogResult: null, dismissedSuccessBannerFor: entryId}),

      /**
       * A keyed log replayed after an unknown outcome answers with the original response, so it
       * carries the entry id the user has already dismissed; honouring it would resurrect a banner
       * they closed. An intentional second serving is a distinct entry row, so its different id
       * still raises the banner and retires the dismissal marker.
       */
      setPostLogResult: result =>
        set(state =>
          state.dismissedSuccessBannerFor === result.entryId
            ? state
            : {postLogResult: result, dismissedSuccessBannerFor: null}
        ),

      clearPostLogResult: () => set({postLogResult: null, dismissedSuccessBannerFor: null}),

      /**
       * Recording an intent is also the sweep that keeps the persisted slice from accumulating
       * records nobody can act on: the incoming intent's own `userId` and `createdAt` stand in for
       * the clock and the session, so a sibling entry left by the previous account or by a week-old
       * unresolved request goes out with this write instead of surviving until something reads it.
       * The incoming intent is always kept exactly as minted.
       *
       * The slot is read from the intent's own `request.action` rather than passed alongside it, so a record
       * can never be filed under an action it would not reconstruct.
       */
      recordPendingIntent: intent =>
        set(state => ({
          pendingIntents: {
            ...selectPrunedPendingIntents(state.pendingIntents, intent.createdAt, intent.userId),
            [intent.request.action]: intent
          }
        })),

      clearPendingIntent: action =>
        set(state => {
          const pendingIntents = {...state.pendingIntents}

          delete pendingIntents[action]

          return {pendingIntents}
        }),

      /**
       * The guard sits ahead of `set` rather than inside a `state => state` updater because the
       * persist middleware writes storage after every `set` call, no-op or not: a launch with a
       * clean slice would otherwise cost a pointless serialise-and-write round trip.
       */
      prunePendingIntents: (now, userId) => {
        const current = get().pendingIntents
        const pruned = selectPrunedPendingIntents(current, now, userId)

        if (pruned !== current) {
          set({pendingIntents: pruned})
        }
      },

      reset: () => {
        set(defaultState)
      }
    }),
    {
      name: 'meal-plan-store',
      storage: zustandAsyncStorage,
      partialize: selectPersistedState,
      /**
       * Hydration is the one moment an intent can come back already stale, and the only one with no
       * caller to inject a clock — hence the module's single wall-clock read here, while every
       * helper below keeps `now` as an argument so the age policy stays testable. Hydration itself
       * writes state without touching storage, so the stale record is only actually removed by this
       * action, whose write goes back through the persisting setter. Ownership cannot be judged yet
       * (the signed-in id would have to come from `useAuthStore`, which imports this store), so
       * pruning here is by age alone; a foreign record is swept by the next `recordPendingIntent`
       * or by an explicit `prunePendingIntents` call that knows the user.
       */
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          return
        }

        state.prunePendingIntents(Date.now(), null)
      }
    }
  )
)

/**
 * An intent nobody resolved must not stay replayable forever: after a week the plan it was minted
 * against has almost certainly been superseded, and a silent replay would surprise the user instead
 * of finishing their request. Age is measured against a caller-supplied `now`, and an intent exactly
 * one week old is already expired.
 */
export const PENDING_INTENT_TTL_MS = ONE_DAY_MS * 7

export const isPendingIntentExpired = (intent: PendingIntent, now: number): boolean =>
  now - intent.createdAt >= PENDING_INTENT_TTL_MS

/**
 * The only way to build a `PendingIntent`. The fingerprint, the plan id and the plan revision are derived
 * from the request rather than accepted as arguments, so the stored record is internally consistent by
 * construction: a later launch that recomputes the fingerprint from `request` must get `fingerprint` back,
 * which is the check that decides whether the key may be replayed (0.7.2). A `generate` intent precedes any
 * plan, hence the two null members.
 */
export const buildPendingIntent = (
  request: MealPlanRequestSnapshot,
  key: string,
  userId: string,
  createdAt: number
): PendingIntent => ({
  userId,
  key,
  fingerprint: fingerprintSnapshot(request),
  planId: request.action === 'generate' ? null : request.planId,
  planRevision: request.action === 'generate' ? null : request.expectedPlanRevision,
  createdAt,
  request
})

/**
 * Validates a record restored from device storage, where it is whatever JSON survived rather than the type it
 * was written as. Everything is checked, including the record's agreement with itself: a snapshot that does
 * not parse under the slot it was filed against, or whose recomputed fingerprint differs from the stored one,
 * or whose derived plan id and revision differ from the stored pair, describes a request this release cannot
 * reproduce. Such a record is refused rather than repaired — replaying a key under a changed body is what the
 * server answers with `409 idempotency_conflict` (0.5.1), so minting a new key is the only safe outcome. A
 * record written by an earlier release, which carries no snapshot at all, fails here for the same reason.
 */
export const parsePendingIntent = (value: unknown, action: PendingIntentAction): PendingIntent | null => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const {userId, key, fingerprint, planId, planRevision, createdAt, request} = value as Partial<PendingIntent>

  if (typeof userId !== 'string' || userId.length === 0 || typeof key !== 'string' || key.length === 0) {
    return null
  }

  if (typeof fingerprint !== 'string' || fingerprint.length === 0) {
    return null
  }

  if (typeof createdAt !== 'number' || !Number.isFinite(createdAt)) {
    return null
  }

  const snapshot = parseRequestSnapshot(request, action)

  if (snapshot === null || !matchesFingerprint(snapshot, fingerprint)) {
    return null
  }

  const intent = buildPendingIntent(snapshot, key, userId, createdAt)

  return planId === intent.planId && planRevision === intent.planRevision ? intent : null
}

const EMPTY_PENDING_INTENTS: Partial<Record<PendingIntentAction, PendingIntent>> = Object.freeze({})

/**
 * Whether a restored value can be read as the slice at all. Its TypeScript type describes what this release
 * writes, not what came back from storage: a truncated file, a hand edit or a newer release's shape can leave
 * anything there, and `Object.entries` throws on `null` and enumerates the characters of a string. So the
 * boundary is checked rather than trusted, and anything that is not a plain object is treated as an empty
 * slice — nothing replayable can be read out of it, and replacing it is what repairs storage.
 */
const isPendingIntentSlice = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Drops every intent that has aged out and, when `userId` is given, every intent minted by another
 * account — the record carries that account's id, so hiding it at lookup time is not enough while
 * it is still being written to disk. `userId` is `null` where ownership is not knowable at the call
 * site (cold-start rehydration), which prunes by age only. A record that is not a valid intent for the slot
 * it occupies goes out regardless of age or owner: it can never be replayed (`parsePendingIntent`), so
 * leaving it on disk would only keep a dead key alive. The input is never mutated, and the very
 * same object is returned when nothing is stale so callers can skip the state write and its persist
 * round trip.
 *
 * Total over whatever storage returns, because this runs on the rehydration path where the value is still
 * unverified JSON. A slot naming an action this release does not have — a newer release's keyed write, or a
 * name that resolves on `Object.prototype` — is dropped like any other unreplayable record: throwing here
 * would abort hydration itself, leaving the store unhydrated, the deferred ownership sweep waiting forever
 * and every keyed action unusable until the user cleared app storage.
 */
export const selectPrunedPendingIntents = (
  pendingIntents: unknown,
  now: number,
  userId: string | null
): Partial<Record<PendingIntentAction, PendingIntent>> => {
  if (!isPendingIntentSlice(pendingIntents)) {
    return EMPTY_PENDING_INTENTS
  }

  const entries = Object.entries(pendingIntents)
  const live = entries.filter(([action, stored]) => {
    if (!isMealPlanActionType(action)) {
      return false
    }

    const intent = parsePendingIntent(stored, action)

    return intent !== null && !isPendingIntentExpired(intent, now) && (userId === null || intent.userId === userId)
  })

  if (live.length === entries.length) {
    return pendingIntents as Partial<Record<PendingIntentAction, PendingIntent>>
  }

  return Object.fromEntries(live) as Partial<Record<PendingIntentAction, PendingIntent>>
}

/**
 * The ownership sweep, scheduled rather than fired. Which account is signed in is knowable only in
 * the auth layer, and at launch the persisted slice may still be on its way out of AsyncStorage — a
 * prune that landed first would be replaced by hydration, so this waits for it. Once it runs, the
 * write goes back through the persisting setter, so a record minted by a previous account leaves
 * storage as well as memory rather than sitting there until something else happens to write. The
 * clock arrives as a source, not a value, because the deferred path reads it when hydration
 * finishes rather than when the sweep was requested.
 */
export const prunePendingIntentsForUser = (userId: string, now: () => number): void => {
  if (useMealPlanStore.persist.hasHydrated()) {
    useMealPlanStore.getState().prunePendingIntents(now(), userId)

    return
  }

  const stopWaiting = useMealPlanStore.persist.onFinishHydration(() => {
    stopWaiting()
    useMealPlanStore.getState().prunePendingIntents(now(), userId)
  })
}

/**
 * The unresolved intent for one action, or `null` when there is nothing this caller may replay. Validation
 * runs here rather than being assumed of the state, because after a cold start the slice is whatever came
 * back from storage — including, until the rehydration prune has replaced it, a value that is not an object
 * at all. The returned value is the parsed record, so a caller can only ever act on a snapshot this release
 * understands.
 */
export const resolvePendingIntent = (
  state: Pick<MealPlanStore, 'pendingIntents'>,
  action: PendingIntentAction,
  userId: string,
  now: number
): PendingIntent | null => {
  const slice: unknown = state.pendingIntents
  const stored = isPendingIntentSlice(slice) ? slice[action] : undefined
  const intent = stored === undefined ? null : parsePendingIntent(stored, action)

  if (intent === null || intent.userId !== userId || isPendingIntentExpired(intent, now)) {
    return null
  }

  return intent
}

/**
 * The replay decision, in one place so the four keyed writes cannot answer it differently (0.7.2).
 *
 * The request a screen is about to send is fingerprinted and compared with the unresolved intent's: equal
 * means this is the very request the key was minted for, so the attempt goes out under that key carrying the
 * *stored* snapshot — the byte-identical replay a lost response requires, which the server answers with the
 * stored result rather than a second commit. Any difference — an edited preference, a refreshed revision, a
 * different alternative or portion — means the key is spent, because the server refuses a reused key with a
 * changed fingerprint (`409 idempotency_conflict`), so the caller's freshly minted key is used instead. The
 * action is read from the request, so the intent consulted is always the one for the write being made.
 */
export const resolveKeyedRequest = (
  state: Pick<MealPlanStore, 'pendingIntents'>,
  request: MealPlanRequestSnapshot,
  userId: string,
  now: number,
  freshKey: string
): KeyedRequestPlan => {
  const intent = resolvePendingIntent(state, request.action, userId, now)

  if (intent !== null && matchesFingerprint(request, intent.fingerprint)) {
    return {idempotencyKey: intent.key, isReplay: true, request: intent.request}
  }

  return {idempotencyKey: freshKey, isReplay: false, request}
}

export default useMealPlanStore
