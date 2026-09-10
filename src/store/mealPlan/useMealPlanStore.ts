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
    set => ({
      ...defaultState,

      setMacrosSegment: segment => set({macrosSegment: segment}),

      setSelectedPlanDate: dayKey => set({selectedPlanDate: dayKey}),

      setSelectedPlanId: planId =>
        set(state => (state.selectedPlanId === planId ? state : {selectedPlanId: planId, selectedPlanDate: null})),

      dismissSuccessBanner: entryId => set({dismissedSuccessBannerFor: entryId}),

      setPostLogResult: result => set({postLogResult: result, dismissedSuccessBannerFor: null}),

      clearPostLogResult: () => set({postLogResult: null, dismissedSuccessBannerFor: null}),

      recordPendingIntent: (action, intent) =>
        set(state => ({pendingIntents: {...state.pendingIntents, [action]: intent}})),

      clearPendingIntent: action =>
        set(state => {
          const pendingIntents = {...state.pendingIntents}

          delete pendingIntents[action]

          return {pendingIntents}
        }),

      reset: () => {
        set(defaultState)
      }
    }),
    {
      name: 'meal-plan-store',
      storage: zustandAsyncStorage,
      partialize: selectPersistedState
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
