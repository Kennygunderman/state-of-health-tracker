import {zustandAsyncStorage} from '@store/zustandAsyncStorage'
import {ONE_DAY_MS} from '@utility/DateUtility'
import {
  fingerprintSnapshot,
  isMealPlanActionType,
  matchesFingerprint,
  MealPlanActionType,
  MealPlanRequestSnapshot,
  parseRequestSnapshot,
  RequestScope,
  snapshotMatchesScope
} from '@utility/IdempotencyUtility'
import {create} from 'zustand'
import {persist, PersistStorage, StorageValue} from 'zustand/middleware'

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
 * The persisted slice's storage key, named once so the persist option and `clearPersistedPendingIntents`
 * cannot drift apart: a removal aimed at a different key would leave the record it was meant to erase on the
 * device.
 */
const MEAL_PLAN_STORE_NAME = 'meal-plan-store'

/**
 * What `recordPendingIntent` can promise its caller about the device.
 *
 * 'durable' means the device has CONFIRMED a slice holding this intent, so the keyed request may be sent: a
 * kill between sending it and its response is reconcilable under the same key on the next launch.
 * 'unavailable' means the memory record exists but nothing on disk backs it: `storage_failed` when the write
 * was refused or rejected, and
 * `hydration_unknown` while the slice has not come back (a read still out would overwrite the record, and a
 * read that REJECTED makes the adapter refuse every write). The reservation only reports durability —
 * whether to send without it is the caller's decision, because only the caller knows whether its request is
 * safe to duplicate (0.7.2).
 */
export type PendingIntentReservation =
  | {kind: 'durable'}
  | {kind: 'unavailable'; reason: 'hydration_unknown' | 'storage_failed'}

/**
 * What `clearPersistedPendingIntents` can promise about the device after an account boundary.
 *
 * 'erased' means no intent of the outgoing session is at rest any more — the item was deleted, or an empty
 * slice was written over it. 'failed' means one is still there: every erasure path was refused or rejected.
 * The distinction is reported rather than swallowed so the caller can act on it, and so the sign-in discard
 * below is a stated part of the boundary rather than a hope (0.7.2).
 */
export type PendingIntentErasure = {kind: 'erased'} | {kind: 'failed'}

/**
 * How the persisted intent slice came back, kept as three states rather than two because the third one is the
 * dangerous one: a read that REJECTED leaves the contents unknown, which is not the same as empty.
 */
export type IntentsHydration = 'pending' | 'succeeded' | 'failed'

/** The two settled outcomes `markIntentsHydrated` may publish. */
export type IntentsHydrationOutcome = Exclude<IntentsHydration, 'pending'>

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
  /**
   * Whether the persisted slice has come back from AsyncStorage yet — the difference between "no intent is
   * pending" and "the answer has not arrived". A screen that owns a keyed write must wait for this before
   * concluding there is nothing to replay, or its first frame would decide the slice was empty and its next
   * press would mint a second key for a request the server may already hold (0.7.2).
   *
   * Ephemeral and deliberately absent from both `defaultState` and `reset()`: hydration is a fact about this
   * process, not about the signed-in account, so a sign-out must not put every owning screen back to waiting
   * for a read that has already happened.
   */
  hasHydratedIntents: boolean
  /**
   * The same fact with its third case kept: `'pending'` while the read is out, `'succeeded'` once the slice is
   * in hand, `'failed'` when the read rejected and what is on disk is therefore unknown.
   *
   * `hasHydratedIntents` is `'succeeded'` alone, which is what makes every gate built on it fail closed — a
   * failed read must never read as permission to mint a key, because the unread slice may hold one already.
   * Screens that need to SAY so, and to offer `retryIntentsHydration`, read this instead of the boolean.
   */
  intentsHydration: IntentsHydration
  setMacrosSegment: (segment: MacrosSegment) => void
  setSelectedPlanDate: (dayKey: string | null) => void
  setSelectedPlanId: (planId: string | null) => void
  dismissSuccessBanner: (entryId: string) => void
  setPostLogResult: (result: PostLogResult) => void
  clearPostLogResult: () => void
  recordPendingIntent: (intent: PendingIntent) => Promise<PendingIntentReservation>
  clearPendingIntent: (action: PendingIntentAction) => void
  prunePendingIntents: (now: number, userId: string | null) => void
  discardPendingIntents: () => void
  markIntentsHydrated: (outcome: IntentsHydrationOutcome) => void
  retryIntentsHydration: () => void
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

/**
 * The persisted slice as it was last handed to storage, per store name, so an identical write can be skipped.
 * Module scope rather than closure state because the adapter below is created once and lives as long as the
 * store does; `removeItem` clears the entry so a later write of the same value is not mistaken for a duplicate
 * of one that is no longer on disk.
 */
/**
 * The value the fallback erasure writes: the persisted slice with no intents in it, at this release's persist
 * version. Built from `defaultState` rather than written out again so the erasure cannot drift from what the
 * store considers an empty slice, and declared once so the write and the confirmation compare the same bytes.
 * `version` is the persist middleware's default, which these options do not override.
 */
const EMPTY_PERSISTED_SLICE: StorageValue<MealPlanPersistedState> = {
  state: {pendingIntents: defaultState.pendingIntents},
  version: 0
}

const lastWrittenByName = new Map<string, string>()

/**
 * The serialised slice of the write currently on its way to storage, per store name — the newest one when
 * several are queued. It keeps a duplicate of an unresolved write from being issued twice without letting an
 * unresolved write count as persisted, which is the distinction `lastWrittenByName` alone cannot make.
 */
const inFlightWriteByName = new Map<string, string>()

/**
 * Store names whose last read FAILED, and whose contents are therefore unknown.
 *
 * A rejected read is not an empty store. The slice may still hold the idempotency key of an action the server
 * has already committed, so writing over it would destroy the only record that can reconcile that action
 * (0.7.2). The guard lives in the adapter rather than in the one action that noticed the failure, because
 * every write path has to fail closed, not just that one — including the persist middleware's own write after
 * any unrelated `set`. Cleared by a read that succeeds, and by `removeItem`, which makes the contents known
 * again.
 */
const failedReadByName = new Set<string>()

/**
 * The promise of the device write currently on its way out, per store name — the newest one when several are
 * queued. `inFlightWriteByName` says WHAT is on its way; this says when it has landed, which is the only
 * thing a caller that must not send before its key is on disk can wait for. Registered only for a write that
 * actually reaches the device, so a skipped duplicate can never stand in for an unresolved one.
 */
const inFlightWritePromiseByName = new Map<string, Promise<void>>()

/**
 * The two codes a persistence failure is reported as, and the whole of what is logged. An AsyncStorage
 * rejection carries native paths, module internals and, through its message, fragments of the value being
 * written — here that value is an idempotency key and a request body, so logging the error itself would copy
 * user request data into device and crash logs (CWE-532). The code names the path that failed, which is all
 * any reader of these logs can act on.
 */
const PERSIST_WRITE_FAILURE_CODE = 'meal_plan_intent_persist_write_failed'

const PERSIST_REMOVE_FAILURE_CODE = 'meal_plan_intent_persist_remove_failed'

/**
 * Resolves once every device write already on its way out for `name` has settled.
 *
 * A write queued while an earlier one was being awaited is a write this caller still has to wait for, so the
 * loop re-reads the map rather than sampling it once. Termination comes from the identities already awaited,
 * not from a cap: each pass either finds a promise it has never seen — real progress, one more write on its
 * way to the device — or finds the one it just awaited and stops.
 */
const awaitOutstandingPersistWrites = async (name: string): Promise<void> => {
  const awaited = new Set<Promise<void>>()
  let outstanding = inFlightWritePromiseByName.get(name)

  while (outstanding !== undefined && !awaited.has(outstanding)) {
    awaited.add(outstanding)

    await outstanding

    outstanding = inFlightWritePromiseByName.get(name)
  }
}

/**
 * Whether the slice the device has CONFIRMED holds this very intent, decided from the adapter's memo of the
 * last confirmed serialized value rather than from a fresh `getItem`.
 *
 * Re-reading the device would be the obvious check and is the wrong one twice over: it answers about a moment
 * later than the write it is verifying, and the memo already holds exactly the value storage acknowledged.
 * The stored record is put through `parsePendingIntent` — the same validation a cold start applies — so a
 * value that survived serialisation but could never be replayed does not count as durable, and the key and
 * fingerprint are compared so a confirmed slice describing a DIFFERENT request cannot pass for this one.
 */
const confirmedSliceHoldsIntent = (name: string, intent: PendingIntent): boolean => {
  const confirmed = lastWrittenByName.get(name)

  if (confirmed === undefined) {
    return false
  }

  let state: unknown

  try {
    state = JSON.parse(confirmed)
  } catch {
    // The memo is written from `JSON.stringify`, so this cannot happen through the adapter — but a value that
    // will not parse is not a slice this intent can be read out of, and reporting durability from it would be
    // the one lie this function exists to prevent.
    return false
  }

  if (state === null || typeof state !== 'object') {
    return false
  }

  const slice: unknown = (state as {pendingIntents?: unknown}).pendingIntents

  if (slice === null || typeof slice !== 'object' || Array.isArray(slice)) {
    return false
  }

  const action = intent.request.action
  const stored = parsePendingIntent((slice as Record<string, unknown>)[action], action)

  return stored !== null && stored.key === intent.key && stored.fingerprint === intent.fingerprint
}

/**
 * The device half of one non-duplicate write, and the memo bookkeeping that decides what the next comparison
 * sees. Separate from `setItem` only so the promise of the write itself can be registered before it is
 * awaited; the order of the steps inside is unchanged and load-bearing.
 */
const persistSliceToDevice = async (
  name: string,
  value: StorageValue<MealPlanPersistedState>,
  serialized: string,
  confirmed: string | undefined
): Promise<void> => {
  try {
    await zustandAsyncStorage.setItem(name, value)
  } catch {
    // The last CONFIRMED value is left in place rather than being replaced by the one that failed, so an
    // identical later write is still a write and gets its own attempt at the device. This is the whole
    // durability guarantee: the slice holds idempotency keys, and a key that silently never reached storage
    // is a key the next launch mints again — committing the same action twice (0.7.2).
    if (inFlightWriteByName.get(name) === serialized) {
      inFlightWriteByName.delete(name)

      if (confirmed === undefined) {
        lastWrittenByName.delete(name)
      } else {
        lastWrittenByName.set(name, confirmed)
      }
    }

    // Reported rather than rethrown, following the convention the other persisted stores already use for a
    // storage failure. The persist middleware calls `setItem` without handling its rejection, so rethrowing
    // surfaces as an unhandled rejection rather than reaching anything that could act on it — while the memo
    // above has already been restored, which is what actually makes the next attempt retry. The rejection
    // itself is deliberately not logged: see `PERSIST_WRITE_FAILURE_CODE`.
    console.error(PERSIST_WRITE_FAILURE_CODE)

    return
  }

  // Only the newest write may claim the memo. Two `set` calls in one tick queue two writes here, and the
  // first may resolve last; letting it record its own value would tell the next comparison that the older
  // state is what sits on disk, and the newer state would then be skipped forever.
  if (inFlightWriteByName.get(name) === serialized) {
    inFlightWriteByName.delete(name)
    lastWrittenByName.set(name, serialized)
  }
}

/**
 * `zustandAsyncStorage`, minus the writes that would change nothing on disk.
 *
 * The persist middleware writes after every `set`, and it partializes only at write time — so a segment tap, a
 * day selection or a banner dismissal, none of which are persisted, each serialised and wrote an unchanged
 * `pendingIntents` to AsyncStorage. Those are hot UI updates, and the slice they rewrote is the one record the
 * app cannot afford to churn. Comparing the serialised persisted slice against the last one written keeps the
 * device write for the state changes that actually reach disk.
 *
 * The comparison is on `value.state` alone: `version` is a constant of this release, and including it would
 * only widen the string every comparison walks. Wrapping the shared adapter rather than changing it is
 * deliberate — other domains persist different shapes through it and must keep their own write behaviour.
 */
const dedupedPersistStorage: PersistStorage<MealPlanPersistedState> = {
  getItem: async name => {
    let stored: StorageValue<MealPlanPersistedState> | null

    try {
      stored = (await zustandAsyncStorage.getItem(name)) as StorageValue<MealPlanPersistedState> | null
    } catch (error) {
      // Whatever is on disk is now unknown, so every later write is refused until a read succeeds. Rethrown
      // so the middleware reports the failure to `onRehydrateStorage`, which is what puts the store into its
      // 'failed' hydration state instead of letting screens treat an unread slice as an empty one.
      failedReadByName.add(name)
      lastWrittenByName.delete(name)
      inFlightWriteByName.delete(name)

      throw error
    }

    failedReadByName.delete(name)

    // Seeded from the read so the first write after hydration is skipped when it would restate what is
    // already on disk — which is exactly what the rehydration prune does when nothing was stale.
    if (stored === null) {
      lastWrittenByName.delete(name)
    } else {
      lastWrittenByName.set(name, JSON.stringify(stored.state))
    }

    return stored
  },
  setItem: async (name, value) => {
    // The contents are unknown, so there is nothing this write could safely replace.
    if (failedReadByName.has(name)) {
      return
    }

    const serialized = JSON.stringify(value.state)

    const confirmed = lastWrittenByName.get(name)
    const queued = inFlightWriteByName.get(name)

    // Compared against where the device is HEADED, which is the newest queued write when one is out and the
    // last confirmed value otherwise. Comparing against the confirmed value alone is wrong in both directions:
    //
    // - it would skip a write that restates the confirmed value while an older queued write is still on its
    //   way, and that queued write would then land last and leave disk disagreeing with memory;
    // - and recording a value as written before awaiting it — the order this adapter used to take — makes a
    //   REJECTED write permanent, because every later attempt at the same value matches the memo and returns
    //   without touching the device. For a slice whose whole purpose is to survive the process, that loses the
    //   idempotency key of an action the server may already have committed, and the next launch mints a new
    //   key and commits the same action twice (0.7.2).
    if ((queued ?? confirmed) === serialized) {
      return
    }

    inFlightWriteByName.set(name, serialized)

    // Held as a value so it can be registered before it is awaited: a caller that must not send its keyed
    // request until the key is on disk has to be able to find this promise, and the persist middleware
    // discards the one it gets from `setItem`.
    const write = persistSliceToDevice(name, value, serialized, confirmed)

    inFlightWritePromiseByName.set(name, write)

    await write

    if (inFlightWritePromiseByName.get(name) === write) {
      inFlightWritePromiseByName.delete(name)
    }
  },
  removeItem: async name => {
    // Nothing is published until the device has confirmed the deletion, and a rejection therefore leaves
    // every memo and the quarantine exactly as they were. Clearing them first — the order this adapter used
    // to take — announced a slice as known-empty on the strength of a call that then failed: after a read
    // that had rejected, that is the one state in which the next write is allowed to overwrite contents
    // nobody has ever seen, which is precisely what `failedReadByName` exists to prevent. Leaving the state
    // intact is also what lets `clearPersistedPendingIntents` tell a completed erasure from a failed one.
    await zustandAsyncStorage.removeItem(name)

    lastWrittenByName.delete(name)
    inFlightWriteByName.delete(name)
    // Deliberate removal makes the contents known again — empty — so writes may resume.
    failedReadByName.delete(name)
    // `inFlightWritePromiseByName` is deliberately left alone: a write already on its way to the device is
    // still on its way after this, and dropping the handle would let the next reservation stop waiting for it.
  }
}

const useMealPlanStore = create<MealPlanStore>()(
  persist(
    (set, get) => ({
      ...defaultState,
      hasHydratedIntents: false,
      intentsHydration: 'pending',

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
       *
       * Awaitable because the memory record alone is worth nothing to the operation this key protects: the
       * persist middleware writes after `set` without awaiting, so a caller that sent its request as soon as
       * `set` returned raced its own storage write, and a kill in that window lost the only key that could
       * reconcile an action the server may already have committed — the next launch minted a second key and
       * committed it twice (0.7.2). The returned reservation says whether the device has confirmed the
       * record; the in-memory record is never rolled back when it has not, because a caller that has already
       * pressed must keep the key it is about to send under — dropping it would make the next press mint a
       * SECOND key for a request that may have committed under the first.
       */
      recordPendingIntent: async intent => {
        set(state => ({
          pendingIntents: {
            ...selectPrunedPendingIntents(state.pendingIntents, intent.createdAt, intent.userId),
            [intent.request.action]: intent
          }
        }))

        // Durability cannot be claimed while what is on disk is unknown, and neither unsettled state is a
        // write worth waiting for: a read still in flight will overwrite this record when it lands, and a
        // read that rejected makes the adapter refuse the write outright.
        if (get().intentsHydration !== 'succeeded') {
          return {kind: 'unavailable', reason: 'hydration_unknown'}
        }

        await awaitOutstandingPersistWrites(MEAL_PLAN_STORE_NAME)

        return confirmedSliceHoldsIntent(MEAL_PLAN_STORE_NAME, intent)
          ? {kind: 'durable'}
          : {kind: 'unavailable', reason: 'storage_failed'}
      },

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
      /**
       * Drops every record, owner and age irrelevant, and only writes when there was something to drop so a
       * sign-in with a clean slice costs no storage round trip. Separate from `reset()` because it is not a
       * session teardown: the ephemeral view state of the session being STARTED must not be thrown away with
       * the records of the one that ended.
       */
      discardPendingIntents: () => {
        if (Object.keys(get().pendingIntents).length > 0) {
          set({pendingIntents: {}})
        }
      },

      prunePendingIntents: (now, userId) => {
        const current = get().pendingIntents
        const pruned = selectPrunedPendingIntents(current, now, userId)

        if (pruned !== current) {
          set({pendingIntents: pruned})
        }
      },

      /**
       * Announced through the store rather than read from `persist.hasHydrated()` so that the screens waiting
       * on it actually re-render: a first launch restores nothing, so hydration finishes without a state
       * change, and a component subscribed to `pendingIntents` alone would never hear that the answer had
       * arrived.
       *
       * `hasHydratedIntents` follows 'succeeded' ONLY. A rejected read leaves it false, so every gate built on
       * it keeps refusing to mint — the unread slice may already hold a key for an action the server
       * committed, and minting a second one is the duplicate write this whole contract exists to prevent
       * (0.7.2). The 'failed' state is what a screen offers a retry from; it is not a licence to proceed.
       *
       * The `set` is safe on failure even though the middleware writes after it: the adapter refuses every
       * write for a store whose read rejected, so nothing can overwrite the unread slice.
       */
      markIntentsHydrated: outcome => {
        const hasHydratedIntents = outcome === 'succeeded'
        const current = get()

        // Guarded on BOTH fields the outcome derives, not on the outcome alone: they are one fact in two
        // shapes, and a guard that consults only one of them would leave the other stale.
        if (current.intentsHydration !== outcome || current.hasHydratedIntents !== hasHydratedIntents) {
          set({intentsHydration: outcome, hasHydratedIntents})
        }
      },

      /**
       * Asks storage for the slice again after a failed read, which is the only way out of 'failed': until a
       * read succeeds the app cannot mint a key and the adapter will not write, so a user whose device
       * momentarily refused the read would otherwise be stuck for the process. Returning to 'pending' is what
       * puts the waiting screens back into their loading state while the retry is out.
       */
      retryIntentsHydration: () => {
        if (get().intentsHydration !== 'failed') {
          return
        }

        set({intentsHydration: 'pending', hasHydratedIntents: false})

        // Not awaited, and its promise carries nothing this caller needs: the outcome arrives through
        // `onRehydrateStorage`, which publishes 'succeeded' or 'failed' again, and a second failure simply
        // leaves the retry available.
        useMealPlanStore.persist.rehydrate()
      },

      reset: () => {
        set(defaultState)
      }
    }),
    {
      name: MEAL_PLAN_STORE_NAME,
      storage: dedupedPersistStorage,
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
        const failed = error !== undefined || state === undefined

        // Nothing was read, so there is nothing to prune — and pruning a slice whose contents are unknown
        // would be deciding the fate of records nobody has seen.
        if (!failed && state !== undefined) {
          state.prunePendingIntents(Date.now(), null)
        }

        // The middleware reports a rejected read as `(undefined, error)` and leaves its own `hasHydrated()`
        // false forever, so the answer has to be published here or the screens waiting on it never decide
        // anything. It is published as what it is: 'failed' is NOT 'empty', and only 'succeeded' permits a
        // fresh key.
        //
        // Reached through the store rather than the handed-in `state` because on failure there is no state to
        // reach. Safe: the persisted adapter is AsyncStorage-backed, so this callback always runs in a later
        // microtask than the `create` call that defines the binding — the same assumption
        // `prunePendingIntentsForUser` already makes.
        useMealPlanStore.getState().markIntentsHydrated(failed ? 'failed' : 'succeeded')
      }
    }
  )
)

/**
 * Takes the outgoing account's unresolved intents off the device, and waits for the device to say so.
 *
 * `reset()` alone cannot do this. It writes the default state through the persisting setter, and that write
 * is (a) not awaited by the middleware, so a sign-out can complete before it lands, and (b) REFUSED outright
 * while the store's last read failed — precisely the state in which the slice still holds the previous
 * account's request snapshot and idempotency key. `removeItem` is the only path that erases a slice whose
 * contents are unknown, because it also clears the failed-read latch and both write memos, and awaiting it
 * is what makes the erasure a fact rather than an intention.
 *
 * Memory is cleared first because that step is synchronous and infallible: the boundary the user just asked
 * for must not depend on a filesystem call succeeding. The failure of the removal is reported as a fixed code
 * and swallowed, following the sign-out convention that a storage failure must not surface as a failed
 * sign-out — the record left behind is still unreachable by the next account, which never matches its
 * `userId` (`resolvePendingIntent`), and the ownership sweep at the next login removes it.
 */
export const clearPersistedPendingIntents = async (): Promise<PendingIntentErasure> => {
  useMealPlanStore.getState().reset()

  // A write queued before the reset carries the intents the reset just dropped, so it has to land before the
  // erasure rather than after it — otherwise it resurrects on disk the very record being taken off the device.
  await awaitOutstandingPersistWrites(MEAL_PLAN_STORE_NAME)

  try {
    await dedupedPersistStorage.removeItem(MEAL_PLAN_STORE_NAME)

    return {kind: 'erased'}
  } catch {
    console.error(PERSIST_REMOVE_FAILURE_CODE)
  }

  // A second, independent attempt at the same erasure. `removeItem` and `setItem` are different storage
  // calls, so a rejection of the first says nothing about the second, and a slice holding no intents erases
  // the record as surely as deleting the item would have.
  //
  // It goes to the shared adapter directly, bypassing the write quarantine, and this is the only write in the
  // app that may. The quarantine stops a PARTIAL slice from overwriting contents nobody has read; here the
  // value is the empty slice and the whole purpose is to destroy whatever is there, so unknown contents have
  // nothing to lose — while refusing this write is how the outgoing account's request snapshot stayed at rest
  // after a failed read (0.7.2). Every other write path still fails closed.
  try {
    await zustandAsyncStorage.setItem(MEAL_PLAN_STORE_NAME, EMPTY_PERSISTED_SLICE)
  } catch {
    console.error(PERSIST_WRITE_FAILURE_CODE)

    return {kind: 'failed'}
  }

  // Written deliberately and confirmed, so the contents are known again — empty — and the adapter's own
  // bookkeeping is brought level with the device the way a successful `removeItem` would have left it.
  lastWrittenByName.set(MEAL_PLAN_STORE_NAME, JSON.stringify(EMPTY_PERSISTED_SLICE.state))
  inFlightWriteByName.delete(MEAL_PLAN_STORE_NAME)
  failedReadByName.delete(MEAL_PLAN_STORE_NAME)

  return {kind: 'erased'}
}

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
 * Runs one sweep of the persisted slice, now if the read has already answered and otherwise as soon as it
 * does. Shared by the two sweeps the account boundary needs — the ownership prune and the sign-in discard —
 * so they cannot disagree about when the slice is knowable.
 *
 * Two things can end the wait, and only both together cover it. The middleware's own listener reports a read
 * that succeeded, including a re-read already in flight, which must overwrite nothing the sweep has done. The
 * store subscription reports the same success through `hasHydratedIntents`, which is also what a
 * `retryIntentsHydration` after a failed read eventually flips — so a sweep deferred by a refused read still
 * happens once the retry lands, rather than being abandoned for the session.
 *
 * A read that FAILED deliberately ends neither: the contents are unknown, and a sweep would decide the fate of
 * records nobody has seen. The adapter refuses writes in that state, so nothing is stranded on disk that a
 * successful retry will not then sweep.
 */
const afterIntentsHydrated = (sweepSlice: () => void): void => {
  if (useMealPlanStore.persist.hasHydrated()) {
    sweepSlice()

    return
  }

  let hasSwept = false

  const sweep = (): void => {
    if (hasSwept) {
      return
    }

    hasSwept = true
    stopWaiting()
    unsubscribe()
    sweepSlice()
  }

  const stopWaiting = useMealPlanStore.persist.onFinishHydration(sweep)
  const unsubscribe = useMealPlanStore.subscribe(state => {
    if (state.hasHydratedIntents) {
      sweep()
    }
  })
}

/**
 * The ownership sweep, scheduled rather than fired. Which account is signed in is knowable only in
 * the auth layer, and at launch the persisted slice may still be on its way out of AsyncStorage — a
 * prune that landed first would be replaced by hydration, so this waits for it. Once it runs, the
 * write goes back through the persisting setter, so a record minted by a previous account leaves
 * storage as well as memory rather than sitting there until something else happens to write. The
 * clock arrives as a source, not a value, because the deferred path reads it when hydration
 * finishes rather than when the sweep was requested.
 *
 * The wait is on `hasHydratedIntents`, the same signal the owning screens gate their replay on, so the two
 * cannot disagree about when the slice is knowable.
 */
export const prunePendingIntentsForUser = (userId: string, now: () => number): void => {
  afterIntentsHydrated(() => {
    useMealPlanStore.getState().prunePendingIntents(now(), userId)
  })
}

/**
 * The account boundary's enforcement half: an explicit sign-in discards EVERY persisted intent.
 *
 * Signing in with credentials means the previous session ended, and an intent is only ever replayable inside
 * the session that minted it. Logout already drops the record and takes it off the device
 * (`clearPersistedPendingIntents`), but both of those can fail — a rejected write, a kill between the two —
 * and the ownership sweep deliberately KEEPS a record whose `userId` matches the user now signing in. Without
 * this, the one request a user abandoned by signing out is the one that replays when they sign back in.
 *
 * Distinguishing a sign-in from a cold-start RESTORE is what makes this safe to do. A restore continues the
 * same session, which is exactly the case AAP 0.7.2 requires a replay for ("replays it silently on next open
 * or cold start"), and it keeps the owner-and-age prune instead. A sign-in cannot be that case, because the
 * session it is starting is a new one.
 *
 * The trade-off, stated: a user whose session is revoked while a keyed write is unresolved has to sign in
 * again, and this discards that key. The write may have committed, and the client then will not replay it —
 * but the plan, swap or diary entry it produced is still what the next refetch shows, whereas keeping the key
 * would let a request the user abandoned at sign-out commit days later. The AAP's own account boundary
 * requires the record not to survive a logout; this is how that holds when storage does not cooperate.
 */
export const discardPendingIntentsForSignIn = (): void => {
  afterIntentsHydrated(() => {
    useMealPlanStore.getState().discardPendingIntents()
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
 * The unresolved intent one owning screen may replay: the record for this action, this account and — through
 * `scope` — this resource. One lookup for all four keyed writes, so the screens cannot disagree about which
 * record belongs to which of them (0.7.2).
 *
 * The scope is what makes the answer safe to act on without further checks. An intent for another meal
 * describes another request, and replaying its key would commit that swap or that diary entry instead of the
 * one the screen is showing, so a screen showing a plan and a meal passes both ids and a tab looking for any
 * unresolved generation passes none. Ownership and the 7-day life are already applied by
 * `resolvePendingIntent`, and the returned record is the parsed snapshot — never raw storage — so a caller can
 * only ever re-send a request this release can reproduce.
 */
/**
 * Who holds one action's single intent slot, from the point of view of the caller's own plan and meal.
 *
 * `resolveReplayableIntent` answers a narrower question — "is there something HERE to replay" — and returns
 * null both when the slot is empty and when it belongs to another meal. Those two are not interchangeable: an
 * empty slot may be minted into, while a slot held by another resource may not, because the single
 * `pendingIntents[action]` slot can hold exactly one record and overwriting it abandons the only key that can
 * reconcile an action the server may already have committed (0.7.2). Treating 'foreign' as 'free' is precisely
 * how a swap on one meal, or a log on one meal, used to destroy another's unresolved key.
 */
export type SlotOwnership =
  | {kind: 'free'}
  | {kind: 'mine'; intent: PendingIntent}
  | {kind: 'foreign'; intent: PendingIntent}

export const resolveSlotOwnership = (
  state: Pick<MealPlanStore, 'pendingIntents'>,
  action: PendingIntentAction,
  userId: string | null,
  now: number,
  scope: RequestScope = {}
): SlotOwnership => {
  if (userId === null) {
    return {kind: 'free'}
  }

  // Scope-independent on purpose: this is about the slot, not about the screen. An expired record, or one
  // belonging to another account, is already excluded here and really is free to mint into.
  const intent = resolvePendingIntent(state, action, userId, now)

  if (intent === null) {
    return {kind: 'free'}
  }

  return snapshotMatchesScope(intent.request, scope) ? {kind: 'mine', intent} : {kind: 'foreign', intent}
}

export const resolveReplayableIntent = (
  state: Pick<MealPlanStore, 'pendingIntents'>,
  action: PendingIntentAction,
  userId: string | null,
  now: number,
  scope: RequestScope = {}
): PendingIntent | null => {
  if (userId === null) {
    return null
  }

  const intent = resolvePendingIntent(state, action, userId, now)

  if (intent === null || !snapshotMatchesScope(intent.request, scope)) {
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
