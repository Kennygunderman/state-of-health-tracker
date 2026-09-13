import {zustandAsyncStorage} from '@store/zustandAsyncStorage'
import {ONE_DAY_MS} from '@utility/DateUtility'
import {MealPlanActionType} from '@utility/IdempotencyUtility'
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

export type PendingIntent = {
  userId: string
  key: string
  fingerprint: string
  planId: string | null
  planRevision: number | null
  createdAt: number
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
  recordPendingIntent: (action: PendingIntentAction, intent: PendingIntent) => void
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
       */
      recordPendingIntent: (action, intent) =>
        set(state => ({
          pendingIntents: {
            ...selectPrunedPendingIntents(state.pendingIntents, intent.createdAt, intent.userId),
            [action]: intent
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
 * Drops every intent that has aged out and, when `userId` is given, every intent minted by another
 * account — the record carries that account's id, so hiding it at lookup time is not enough while
 * it is still being written to disk. `userId` is `null` where ownership is not knowable at the call
 * site (cold-start rehydration), which prunes by age only. The input is never mutated, and the very
 * same object is returned when nothing is stale so callers can skip the state write and its persist
 * round trip.
 */
export const selectPrunedPendingIntents = (
  pendingIntents: Partial<Record<PendingIntentAction, PendingIntent>>,
  now: number,
  userId: string | null
): Partial<Record<PendingIntentAction, PendingIntent>> => {
  const entries = Object.entries(pendingIntents) as [PendingIntentAction, PendingIntent | undefined][]
  const live = entries.filter(
    ([, intent]) => !!intent && !isPendingIntentExpired(intent, now) && (userId === null || intent.userId === userId)
  )

  if (live.length === entries.length) {
    return pendingIntents
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

export const resolvePendingIntent = (
  state: Pick<MealPlanStore, 'pendingIntents'>,
  action: PendingIntentAction,
  userId: string,
  now: number
): PendingIntent | null => {
  const intent = state.pendingIntents[action]

  if (!intent || intent.userId !== userId || isPendingIntentExpired(intent, now)) {
    return null
  }

  return intent
}

export default useMealPlanStore
