import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {AccessibilityInfo, FlatList, ListRenderItemInfo, Platform, View} from 'react-native'

import type {SwapAlternative, SwapMealPayload} from '@data/models/SwapAlternative'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {useAccessibilityFocusOnChange} from '@hooks/useAccessibilityFocusOnChange'
import {Navigation, SwapMealRouteProp} from '@navigation/types'
import {mutationKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useSwapAlternativesQuery} from '@queries/mealPlanning/useSwapAlternativesQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {useIsMutating, useMutationState} from '@tanstack/react-query'
import {mintKey} from '@utility/IdempotencyUtility'
import {SafeAreaView} from 'react-native-safe-area-context'
import {v4 as uuidv4} from 'uuid'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import EmptyState from '@components/EmptyState'
import SearchMinusIcon from '@components/icons/SearchMinusIcon'
import IndeterminateSpinner from '@components/IndeterminateSpinner'
import InfoBanner from '@components/InfoBanner'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_OTHER_MEAL_PENDING_BODY,
  MEAL_PLAN_OTHER_MEAL_PENDING_TITLE,
  stringWithNamedParameters,
  SWAP_ALTERNATIVES_FOOTNOTE,
  SWAP_ALTERNATIVES_HEADER,
  SWAP_ALTERNATIVES_RESULTS_ACCESSIBILITY_TEMPLATE,
  SWAP_FINDING_ALTERNATIVES_TEXT,
  SWAP_FITS_TARGETS_LABEL,
  SWAP_KEEP_CURRENT_MEAL_BUTTON_TEXT,
  SWAP_NO_ALTERNATIVES_BANNER_BODY,
  SWAP_NO_ALTERNATIVES_TITLE,
  SWAP_SUCCESS_TOAST,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import AlternativeRow from './components/AlternativeRow'
import CurrentMealCard from './components/CurrentMealCard'
import SkeletonAlternatives from './components/SkeletonAlternatives'
import styles from './index.styled'
import {
  buildMealMetaText,
  buildNoAlternativesBody,
  buildSwapDateLabel,
  buildSwapTitle,
  currentMealEyebrow,
  guardsForNewAttempt,
  isPlanInactive,
  rememberedOutcomeForAttempt,
  rendersAlternatives,
  rendersAlternativesGuidance,
  rendersOutcomeRetrySpinner,
  resolveAlternativesAnnouncement,
  resolveAlternativesRevision,
  resolveAlternativesTrust,
  resolveAnnouncementGuard,
  resolveBannerSlot,
  resolveOutcomeMemory,
  resolveReplayableSwap,
  resolveSwapInteraction,
  resolveSwapAttemptDispatch,
  resolveSwapMountReplay,
  resolveSwapReservationRecord,
  resolveSwapRetryPlan,
  resolveSwapSlotOwnership,
  resolveSwapView,
  resolveUnconfirmedRefetch,
  retiresPendingIntent,
  selectSwapAttemptState,
  SwapAttempt,
  SwapOutcomeMemoryRecord,
  terminalRecoveryKey,
  unconfirmedRefetchKey
} from './index.util'

/**
 * The alternatives card, as the list's single item. Frame 13's alternatives card `36:58` holds all four rows, and
 * AAP 0.2.1's file-wide row rule puts a 1px `#222D26` top stroke inset by the card padding on every list row after
 * the first — so the card is what the list renders and the rows are mapped inside it, the shape the grocery list's
 * section cards already take. The key is a constant because the card's identity never changes: a fresh set of
 * alternatives refills the same card rather than replacing it.
 */
type AlternativesBlock = {
  key: string
  alternatives: readonly SwapAlternative[]
}

const ALTERNATIVES_BLOCK_KEY = 'swap-alternatives'

// One frozen empty list for every view that carries none, so "no rows" is a stable value rather than a new
// array per render.
const NO_LISTED_ALTERNATIVES: readonly SwapAlternative[] = Object.freeze([])

/**
 * Frames 13 / 13c / 13d / 13e. The commit is pressed on the preview screen, so this screen draws the outcome of
 * an attempt it never fired, and its "Try again" replays the very key that attempt was minted for — a commit
 * whose response was lost returns its stored result instead of swapping the meal twice (AAP 0.7.2).
 *
 * It also OWNS that key once the process it was minted in is gone: opening on an unresolved swap intent, this
 * screen re-sends the stored request under the stored key exactly once, silently, and withholds the
 * alternatives until the server answers it — a cold start finds the mutation cache empty, and a candidate the
 * user could open in the meantime would record a second key over the only one capable of reconciling the
 * first write (0.7.2).
 */
const SwapMealScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<SwapMealRouteProp>()

  const userId = useAuthStore(state => state.userId)
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  // Subscribed rather than read once: the persisted slice arrives from AsyncStorage after the first frame, and
  // the mount replay below has to run when the answer lands rather than on the frame that asked for it.
  const hasHydratedIntents = useMealPlanStore(state => state.hasHydratedIntents)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own reads, or the keyed commit the
  // preview fired — is terminal for a gated screen: no recovery that stays here can succeed, so the guard
  // leaves for the Meal Plan segment, which states the refusal once (AAP 0.2.5). Every other failure,
  // including a lost response or an undecodable body, is untouched and still retryable in place.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const dayQuery = useMealPlanDayQuery(params.planId, params.date)
  // Gated like every other reader of `/meal-planning/plans/current`: no gated request may be issued once the
  // capability latch has flipped, and a mounted observer would otherwise keep asking on every remount, focus
  // and reconnect (AAP 0.2.5, 0.7.5).
  const {refetch: refetchCurrentPlanRoute} = useCurrentMealPlanQuery(isGatedRequestAllowed)

  const envelope = dayQuery.data ?? null
  const currentMeal = envelope?.day.meals.find(candidate => candidate.id === params.mealId) ?? null

  const planRevision = resolveAlternativesRevision({
    dayPlanRevision: envelope?.planRevision,
    openedPlanRevision: params.planRevision
  })

  const alternativesQuery = useSwapAlternativesQuery(params.planId, params.mealId, planRevision)
  const swapMutation = useSwapMealMutation(params.planId, params.mealId)

  // The recovery re-read is itself a gated request, so `enabled` does not cover it: `refetch` fetches whatever
  // the option says, which is how an already-open screen kept probing a route that had just refused it. It is
  // skipped once the latch has flipped and everything else each recovery does is unchanged (AAP 0.2.5, 0.7.5).
  const refetchCurrentPlan = useCallback((): void => {
    if (!isGatedRequestAllowed) {
      return
    }

    refetchCurrentPlanRoute()
  }, [isGatedRequestAllowed, refetchCurrentPlanRoute])

  // TanStack keeps refetch and mutateAsync stable while replacing the observer object on every status change,
  // so the callbacks and effects below depend on these rather than on the observers they hang off.
  const {refetch: refetchDay} = dayQuery
  const {refetch: refetchAlternatives} = alternativesQuery
  const {mutateAsync: commitSwap} = swapMutation

  // One clock for this mount: the pending intent's expiry is measured in days, so re-reading it per render
  // could only make two reads of the same record disagree.
  const now = useMemo(() => Date.now(), [])

  const [dismissedAttemptAt, setDismissedAttemptAt] = useState<number | null>(null)

  // Both guards are per-attempt, and both hold the attempt's own key rather than a flag: each attempt earns its
  // own outcome, so a retry's recovery must not be skipped because the previous attempt already applied its
  // own. `onRetrySwap` resets them as the request leaves, and each is keyed — by `terminalRecoveryKey` and by
  // `unconfirmedRefetchKey` — so a commit fired from the preview, which resets nothing here, is a new outcome
  // even when the server answers it exactly as it answered the last one.
  const recoveredTerminalKey = useRef<string | null>(null)
  const refetchedUnconfirmedKey = useRef<string | null>(null)

  // When a refusal last contradicted the alternatives this screen was holding. Not a guard but a clock: the
  // rows stay hidden until the list has answered again, because the cache would otherwise hand back the very
  // array the server just refused (`resolveAlternativesTrust`).
  const contradictedAt = useRef<number | null>(null)

  // The outcome a retry is reconciling, which the mutation cache stops reporting the moment that retry is fired
  // (see `resolveOutcomeMemory`). Written after the render that drew the outcome, so every render reads the
  // outcome as it stood before this one — exactly the value a replay in flight has to keep drawing.
  const outcomeMemory = useRef<SwapOutcomeMemoryRecord | null>(null)

  // Every key this screen has sent, however it sent it — the mount replay below and "Try again" both latch here,
  // because a key the mount effect cannot see as already sent is a key it would send again.
  const replayedCommitKey = useRef<string | null>(null)

  // Whether a retry is between its decision and its answer. It closes the window the awaited storage write
  // opens: in it no request is pending, so every render value the banner draws its pending state from reads as
  // idle and a second press would record and send beside the first.
  const isRetryDispatching = useRef(false)

  // The unresolved commit for this user, plan and meal — its stored request, which a replay has to re-send, and
  // the key it was minted for, which is what finds its outcome below. The alternative and the portion the
  // preview bound live in that snapshot, not in this screen's params.
  //
  // Memoised so the record keeps one identity while it is unchanged: the mount replay effect depends on it, and
  // a fresh object per render would re-enter that effect on every render of the screen.
  const pendingSwap = useMemo(
    () =>
      resolveReplayableSwap({
        state: {pendingIntents},
        userId,
        planId: params.planId,
        mealId: params.mealId,
        now
      }),
    [now, params.mealId, params.planId, pendingIntents, userId]
  )

  // Who holds the single `swap` slot, which is a different question from "is there something here to replay":
  // a record for ANOTHER plan or meal leaves `pendingSwap` null while the slot is very much taken, and opening
  // a preview against it would mint a second key over the only one that can reconcile that write (0.7.2).
  const swapSlotOwnership = useMemo(
    () =>
      resolveSwapSlotOwnership({
        state: {pendingIntents},
        userId,
        planId: params.planId,
        mealId: params.mealId,
        now
      }),
    [now, params.mealId, params.planId, pendingIntents, userId]
  )

  /**
   * The attempt this screen is still DRAWING after its key was retired.
   *
   * A confirmed `swap_failed` resolves the action, so the intent goes (0.7.2) — but frame 13e is drawn from that
   * attempt's entry in the shared mutation cache, and the intent's key is what finds it. Holding the answered
   * attempt here keeps the assurance and its "Try again" alive across the retirement: without it the record
   * would vanish in the same commit that retires the key, the selector below would match nothing, and the
   * screen would fall back to the ordinary alternatives list as though the commit had never been refused.
   *
   * It carries the request as well as the key, because 13e's retry is built from that snapshot under a FRESH
   * key — the refused one may never be replayed.
   */
  const [answeredAttempt, setAnsweredAttempt] = useState<SwapAttempt | null>(null)

  // The unresolved intent while one is on record, and the answered attempt this screen still draws once it is
  // not. Reads and retries go through this; the interaction gate below deliberately does not, because an
  // answered attempt no longer holds the slot and must not keep the alternatives closed.
  const attempt = pendingSwap ?? answeredAttempt

  /**
   * Read from the mutation cache rather than from a hook instance this screen owns, because the attempt was
   * fired by the preview screen and that screen is gone by the time its failure is drawn here. The attempt is
   * identified by its idempotency key: `useSwapMealMutation(planId, mealId)` closes over both ids and its wire
   * body carries neither, so an entry's variables are a bare payload and the key is the only field that ties
   * one to the intent the preview recorded beside it. That intent is already scoped to this user, plan and
   * meal, so an attempt on another meal can never draw this meal's banner.
   */
  const swapStates = useMutationState({
    filters: {mutationKey: mutationKeys.swapMeal},
    select: mutation => mutation.state
  })

  // The key that identifies this attempt's entry in the shared cache: the unresolved record's while one is on
  // record, and the answered attempt's once that key has been retired and 13e is still drawn.
  const attemptKey = attempt?.key ?? null

  const swapState = selectSwapAttemptState(swapStates, attemptKey)

  // Counted across the app rather than read from this screen's own hook instance, for the same reason the
  // outcome is: the commit is fired by the preview screen, which sits ABOVE this one in the stack while its
  // request is on the wire. A per-instance `isPending` would report false there and let the replay below put a
  // second request for that key on the wire.
  const isCommitInFlight = useIsMutating({mutationKey: mutationKeys.swapMeal}) > 0

  // "Back to alternatives" dismisses the attempt it was shown for, not every future one: a later commit that
  // fails again is a new outcome and draws its own banner.
  const isDismissed = swapState !== null && swapState.submittedAt === dismissedAttemptAt

  const isAttemptPending = swapState?.status === 'pending'

  // The identity of this attempt's outcome, and so of the display-only pair it is owed (0.2.5). A string rather
  // than the state object, because it is a dependency of the effect below: two renders of one outcome must
  // compare equal, and the next commit's outcome must not.
  const attemptRefetchKey = unconfirmedRefetchKey(attemptKey, swapState?.submittedAt ?? null)

  const view = resolveSwapView({
    currentMeal,
    alternatives: alternativesQuery.data?.alternatives,
    isAlternativesPending: alternativesQuery.isPending,
    isAlternativesFetching: alternativesQuery.isFetching,
    isAlternativesTrusted: resolveAlternativesTrust({
      contradictedAt: contradictedAt.current,
      alternativesUpdatedAt: alternativesQuery.dataUpdatedAt
    }),
    alternativesError: alternativesQuery.error,
    swapError: isDismissed ? null : (swapState?.error ?? null),
    // Deliberately NOT gated on the dismissal: "Back to alternatives" pressed while the replay is still in
    // flight dismisses the outcome it was shown for, and that takes effect when the server answers — it may
    // not put candidates back on screen mid-reconciliation, because opening one would re-record the key the
    // request in flight was minted for.
    rememberedOutcome: rememberedOutcomeForAttempt(outcomeMemory.current, attemptKey),
    isAttemptPending,
    isDayPending: dayQuery.isPending,
    dayError: dayQuery.error
  })

  const banner = 'banner' in view ? view.banner : null
  const bannerSlot = resolveBannerSlot(view)

  // A read's "Try again" refetches the query that failed, so its spinner is that query's own fetch — not the
  // commit's, which the above-title banner reports and which can be in flight at the same time.
  const isRetryPending =
    view.kind === 'error' && (view.retry === 'day' ? dayQuery.isFetching : alternativesQuery.isFetching)

  // Whether the alternatives may be opened at all. An unresolved commit owns the single `swap` intent slot, so
  // while its key is unanswered a new preview would overwrite the only record that can reconcile it — whether
  // that commit is this meal's own or another meal's, since one slot serves the whole account (0.7.2).
  const {allowsAlternativeSelection, showsCommitBusyState, showsForeignHoldNotice} = resolveSwapInteraction({
    ownership: swapSlotOwnership,
    hasHydratedIntents,
    viewKind: view.kind,
    isCommitInFlight,
    hasBanner: banner !== null
  })

  // Only an ANSWERED false is a refusal: a verdict the day query has not returned — null on the cache-seeded
  // envelope, undefined with no envelope at all — is not a dead plan, and telling the user their plan is gone
  // while a read is still in flight would be a worse lie than letting them reach a commit the server can refuse.
  const isPlanWriteRefused = isPlanInactive(envelope?.isWritable)

  const onSwapCommitted = useCallback((): void => {
    // The server answered the key, so the intent is resolved whether this was a fresh commit or a stored replay.
    clearPendingIntent('swap')
    showToast('success', SWAP_SUCCESS_TOAST)
    setSelectedPlanDate(params.date)
    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [clearPendingIntent, navigation, params.date, setMacrosSegment, setSelectedPlanDate])

  /**
   * The silent same-key attempt this screen owes an unresolved commit as it opens (AAP 0.7.2).
   *
   * The body is the STORED snapshot's, handed in by `resolveSwapMountReplay`: a replay is answered with the
   * stored result only while it reproduces the request the key was minted for, so nothing here may be rebuilt
   * from the route or from the alternatives list. Awaited rather than given per-call callbacks, exactly as
   * "Try again" is — TanStack drops those when the caller unmounts, and a reply that arrived after the user
   * left would then never retire the intent the server had just answered.
   */
  const replayPendingSwap = useCallback(
    async (payload: SwapMealPayload): Promise<void> => {
      // Reserved before the replay leaves, exactly as the retry below reserves. The record this replay was
      // reconstructed from is normally already at rest — it came off the device — so the reservation answers
      // from the confirmed slice and writes nothing; the case it exists for is the record a refused write left
      // in memory alone, which must not be sent under a key nothing on disk describes (0.7.2). A refusal sends
      // nothing and says nothing: the mount replay is silent by design, and the key stays latched below, so the
      // user's own "Try again" is what asks again.
      const record = resolveSwapReservationRecord({pendingIntents}, payload.idempotencyKey)
      const dispatch = resolveSwapAttemptDispatch(record === null ? null : await recordPendingIntent(record), true)

      if (dispatch.kind === 'refused') {
        return
      }

      const guards = guardsForNewAttempt()

      recoveredTerminalKey.current = guards.recoveredTerminalKey
      refetchedUnconfirmedKey.current = guards.refetchedUnconfirmedKey

      try {
        await swapMutation.mutateAsync(payload)

        onSwapCommitted()
      } catch {
        // Nothing imperative belongs here: the attempt leaves its own entry in the mutation cache under the key
        // this screen already matches on, so `resolveSwapView` draws 13e, the unconfirmed variant or a terminal
        // refusal from it. The intent stays pending unless that answer resolves it.
      }
    },
    [onSwapCommitted, pendingIntents, recordPendingIntent, swapMutation]
  )

  // 13e's retry sits inside the error banner rather than navigating. The key and the body it sends are
  // `resolveSwapRetryPlan`'s answer: the stored key while the request still fingerprints to the intent, and the
  // freshly minted one otherwise, so the server is never asked to reuse a key under a changed body (0.7.2).
  //
  // A refused write verdict deliberately does NOT gate this. The attempt may already be durable, and only a
  // server answer to its own key can settle that — a read reporting the plan inactive cannot. Replaying returns
  // the stored result, or the confirmed refusal that finally retires the intent.
  const onRetrySwap = useCallback(async (): Promise<void> => {
    // The retry now awaits its own storage write before sending, so the press has to hold the door until it
    // has either sent or refused: nothing is pending anywhere in that window, so `isAttemptPending` and the
    // banner's own pending treatment — both render values — would let a second press mint and record beside
    // this one.
    if (isRetryDispatching.current) {
      return
    }

    if (attempt === null || userId === null) {
      // Nothing replayable is on record — the intent was retired or belongs to another user — so the only
      // honest move is back to the alternatives, where the next attempt is built from a fresh preview.
      setDismissedAttemptAt(swapState?.submittedAt ?? null)

      return
    }

    const plan = resolveSwapRetryPlan({
      state: {pendingIntents},
      snapshot: attempt.request,
      userId,
      attemptedAt: Date.now(),
      freshKey: mintKey(uuidv4)
    })

    isRetryDispatching.current = true

    try {
      // Awaited, not fired and forgotten: the record is what makes a response lost in flight replayable at
      // all, so it has to be ON THE DEVICE before the request leaves. Recording it and sending in the same
      // tick raced the storage write, and a kill in that window left the key nowhere — the next attempt minted
      // a second one and swapped the meal twice (0.7.2). The record has to describe the request that is
      // actually in flight, including for the selector above, which finds this attempt's outcome by its key.
      const dispatch = resolveSwapAttemptDispatch(await recordPendingIntent(plan.intent), plan.isReplay)

      if (dispatch.kind === 'refused') {
        // Nothing is sent: a key the device never confirmed cannot reconcile a swap the server may already
        // have committed. A freshly minted key — which is what 13e's retry carries, its refused key having
        // been retired by the answer that refused it — has been on no wire at all, so its record goes rather
        // than holding the one `swap` slot behind a request that never left; a replayed key's record stays.
        if (!dispatch.retainsPendingIntent) {
          clearPendingIntent('swap')
        }

        // Latched even though nothing was sent, so the mount effect cannot take this very key off the record
        // and send it a tick later without a confirmed write of its own.
        replayedCommitKey.current = plan.idempotencyKey

        // Said once, in place: the banner the press came from is still on screen with its "Try again", and the
        // storage write is safe to ask for again.
        showToast('error', dispatch.toast)

        return
      }

      // This attempt is the one being drawn from now on, and it is on record again, so the answered attempt
      // held across a retirement is no longer what the screen reads. Applied only once the key is durable —
      // an attempt that never left must leave the outcome it was retrying exactly as it was drawn.
      setAnsweredAttempt(null)

      // Latched here as well as in the mount effect, because the latch is about what this screen has SENT, not
      // about which path sent it: a freshly minted key recorded by this press would otherwise look to the mount
      // effect like an intent nobody had replayed, and be sent a second time.
      replayedCommitKey.current = plan.idempotencyKey

      const guards = guardsForNewAttempt()

      recoveredTerminalKey.current = guards.recoveredTerminalKey
      refetchedUnconfirmedKey.current = guards.refetchedUnconfirmedKey

      await commitSwap(plan.variables.payload)

      onSwapCommitted()
    } catch {
      // Awaited rather than given a per-call `onSuccess`, because TanStack drops those callbacks when the
      // caller unmounts: a reply that arrived after the user left would never have retired the intent the
      // server had just answered. The continuation survives, so the intent is always retired on a reply.
      //
      // Nothing imperative belongs in this catch. A failure is drawn, not announced — `resolveSwapView` reads
      // this attempt's outcome straight from the mutation cache and returns 13e or the unconfirmed variant,
      // and a terminal code is retired by the effect above. Toasting here would report the same failure twice.
    } finally {
      isRetryDispatching.current = false
    }
  }, [attempt, clearPendingIntent, commitSwap, onSwapCommitted, pendingIntents, recordPendingIntent, swapState, userId])

  const onBannerAction = useCallback(async (): Promise<void> => {
    if (view.kind === 'error') {
      if (view.retry === 'day') {
        refetchDay()

        return
      }

      refetchAlternatives()

      return
    }

    await onRetrySwap()
  }, [onRetrySwap, refetchAlternatives, refetchDay, view])

  const onDismissAttempt = useCallback((): void => {
    setDismissedAttemptAt(swapState?.submittedAt ?? null)
  }, [swapState])

  const onEditPreferences = useCallback((): void => {
    navigation.navigate(Screens.PLAN_SETTINGS, {planId: params.planId})
  }, [navigation, params.planId])

  const onOpenPreview = useCallback(
    (alternative: SwapAlternative): void => {
      if (!allowsAlternativeSelection) {
        // The rows are not drawn in this state, so this only catches a press queued before they went away. It
        // stays silent: the banner, the hold notice or the busy indicator above already says what the screen is
        // waiting for, and the one thing that must not happen is the preview recording a new key over an
        // unresolved one — this meal's own or another meal's.
        return
      }

      if (isPlanWriteRefused) {
        // The preview's whole job is to bind a commit, and nothing downstream could make one land, so the
        // refusal is repeated here rather than letting the user choose a portion against a plan already gone.
        showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)

        return
      }

      navigation.navigate(Screens.SWAP_PREVIEW, {
        planId: params.planId,
        mealId: params.mealId,
        date: params.date,
        recipeVersionId: alternative.recipeVersionId,
        planRevision
      })
    },
    [
      allowsAlternativeSelection,
      isPlanWriteRefused,
      navigation,
      params.date,
      params.mealId,
      params.planId,
      planRevision
    ]
  )

  useEffect(() => {
    outcomeMemory.current = resolveOutcomeMemory({
      attemptKey,
      viewKind: view.kind,
      isAttemptPending,
      memory: outcomeMemory.current
    })
  }, [attemptKey, isAttemptPending, view.kind])

  useEffect(() => {
    // AAP 0.7.2: the owning screen replays an unresolved intent silently on the next open or cold start, before
    // exposing its normal state — a cold start finds the mutation cache empty, so without this the screen would
    // offer ordinary alternatives over a key whose write may already have committed. The latch is written on
    // every pass, so a re-run while the first attempt is still being set up cannot double it, and nothing here
    // resolves the intent: only the server's answer to that key does.
    const replay = resolveSwapMountReplay({
      attempt: pendingSwap,
      hasHydratedIntents,
      userId,
      isCommitInFlight,
      replayedKey: replayedCommitKey.current
    })

    replayedCommitKey.current = replay.replayedKey

    if (replay.replays && replay.payload !== null) {
      // Not awaited: `replayPendingSwap` owns the whole continuation and resolves rather than rejects, so there
      // is no outcome left here to handle.
      replayPendingSwap(replay.payload)
    }
  }, [hasHydratedIntents, isCommitInFlight, pendingSwap, replayPendingSwap, userId])

  useEffect(() => {
    // Frame 13e. The server confirmed `502 swap_failed`, which persisted nothing (0.5.2), so the action is
    // resolved and its key goes — the identical answer `SwapPreview` gives the identical outcome, so a failure
    // answered on either screen leaves the same state behind (0.7.2).
    //
    // The attempt is retained in the same commit, because what the user is reading is drawn from that attempt's
    // mutation entry and this key is what finds it. Retiring without retaining would blank the assurance and
    // hand back the ordinary alternatives list; retaining without retiring is what left a refused key on record
    // until its seventh day.
    if (view.kind !== 'failed' || pendingSwap === null || !retiresPendingIntent(view)) {
      return
    }

    setAnsweredAttempt(pendingSwap)
    clearPendingIntent('swap')
  }, [clearPendingIntent, pendingSwap, view])

  useEffect(() => {
    if (view.kind !== 'terminal') {
      return
    }

    // Keyed by the attempt, not by the code: a second commit refused the same way still owes its recovery.
    const recoveryKey = terminalRecoveryKey(view.terminal, swapState?.submittedAt ?? null)

    if (recoveredTerminalKey.current === recoveryKey) {
      return
    }

    recoveredTerminalKey.current = recoveryKey

    // Whatever the recovery is, the refusal has contradicted the revision this list was computed for, so the
    // rows are withheld from here until the list has answered again.
    contradictedAt.current = Date.now()

    // Only an answer to the key itself may retire the intent, which is why the predicate — and not the code —
    // decides: a terminal answer from the day query is a read, and says nothing about whether the swap
    // committed.
    if (retiresPendingIntent(view)) {
      clearPendingIntent('swap')

      // The intent is gone, but the mutation cache keeps this attempt's error: dismissing the attempt is what
      // guarantees the refusal stops being the view, so the screen can return to data once the list is re-read
      // rather than sitting on a rowless refusal. It dismisses this attempt only — a later commit is a new
      // submission and draws its own outcome.
      setDismissedAttemptAt(swapState?.submittedAt ?? null)
    }

    if (view.terminal.recovery === 'exitToPlanTab') {
      // Meal planning itself is switched off, so there is no list to re-read and nothing here to retry. Carry
      // no toast — the Meal Plan segment's unavailable card is where that is explained, once — and leave for
      // it, re-reading the current plan on the way so the tab renders from a fresh answer.
      refetchCurrentPlan()
      setMacrosSegment('mealPlan')
      navigation.popTo(Screens.MACROS)

      return
    }

    showToast('error', view.terminal.toastText ?? TOAST_GENERIC_ERROR)

    // BOTH reads, for every recovery that stays on this screen, and unconditionally — the refusal has withheld
    // the rows (`resolveAlternativesTrust`) and only fresh answers earn them back, so a read this effect skips
    // is a state the screen cannot leave.
    //
    // The day is the authoritative envelope: it carries the plan revision the alternatives query is keyed by
    // and the writeability verdict a commit is offered against. A refusal about the chosen alternative —
    // 'reselectAlternative' — is no less a reason to re-read it, because the revision that contradicted the
    // candidate is the day's, and without that read the same list is re-asked under the very key it already
    // holds: unasked, and so never answering. The alternatives read is here for the mirror reason: a
    // plan-state refusal whose day answer comes back on the same revision leaves the list's key unchanged too.
    //
    // Which codes reach this effect is the classification's business, not this call site's, so neither read is
    // narrowed to a code or a recovery.
    refetchDay()
    refetchAlternatives()
  }, [
    clearPendingIntent,
    navigation,
    refetchAlternatives,
    refetchCurrentPlan,
    refetchDay,
    setMacrosSegment,
    swapState,
    view
  ])

  useEffect(() => {
    const decision = resolveUnconfirmedRefetch({
      viewKind: view.kind,
      attemptRefetchKey,
      refetchedUnconfirmedKey: refetchedUnconfirmedKey.current
    })

    if (!decision.refetchesCurrentPlan && !decision.refetchesPlanDay) {
      return
    }

    refetchedUnconfirmedKey.current = decision.refetchedUnconfirmedKey

    // Display-only, and both reads (0.2.5): they warm the day and the current plan a commit this attempt may
    // already have made, so the plan shows it the moment the user leaves. Neither resolves or clears the
    // pending intent — only a server answer to the same key does, which is what "Try again" asks for — and
    // neither touches the unconfirmed banner's copy, even when one answers with a terminal code of its own.
    if (decision.refetchesCurrentPlan) {
      refetchCurrentPlan()
    }

    if (decision.refetchesPlanDay) {
      refetchDay()
    }
  }, [attemptRefetchKey, refetchCurrentPlan, refetchDay, view.kind])

  useEffect(() => {
    if (!isPlanWriteRefused) {
      return
    }

    // The plan this screen opened on can no longer be written to — superseded by a regeneration, or its week
    // has ended. Say so once and re-read the current plan, so the tab behind this screen is already showing the
    // replacement when the user gets back to it.
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [isPlanWriteRefused, refetchCurrentPlan])

  // Withheld rather than drawn disabled while a commit is unresolved: every row is a route into the preview,
  // which records its own intent, so the rows and the section around them go away until the key resolves.
  const listedAlternatives =
    allowsAlternativeSelection && rendersAlternatives(view) ? view.alternatives : NO_LISTED_ALTERNATIVES

  const blocks: readonly AlternativesBlock[] =
    listedAlternatives.length > 0 ? [{key: ALTERNATIVES_BLOCK_KEY, alternatives: listedAlternatives}] : []

  const resultsAccessibilityLabel = stringWithNamedParameters(SWAP_ALTERNATIVES_RESULTS_ACCESSIBILITY_TEMPLATE, {
    count: listedAlternatives.length
  })

  // The resolution of 13c's wait, in the two cases that are not banners: the rows that arrived, or 13d's card.
  const alternativesAnnouncement = resolveAlternativesAnnouncement({
    viewKind: view.kind,
    listedCount: listedAlternatives.length,
    slot: currentMeal?.slot ?? null
  })

  // The rows the wait resolved to, as the reader's destination: 13c's "Loading" node is unmounted by the very
  // render that draws them, and with no navigation between the two states nothing repositions the cursor, so it
  // is left on a node that no longer exists. Only the loaded list qualifies — 13e draws rows too, under a banner
  // that announces itself and IS what the screen is about, and taking the cursor off it would move the reader
  // away from the outcome they just asked for. The key is the results label, so a refetch answering with the
  // same count moves nothing and a different count is a new resolution.
  const resultsRef = useRef<React.ComponentRef<typeof View>>(null)
  const focusedResults = view.kind === 'list' && blocks.length > 0 ? resultsAccessibilityLabel : null

  useAccessibilityFocusOnChange(resultsRef, focusedResults, {scope: 'voiceOver'})

  // What is left for VoiceOver to be TOLD. Focusing a node is what makes iOS read it, so the resolution that
  // now receives the cursor must not also be announced — one sentence, said twice, is what that would be. Every
  // other resolution keeps its announcement unchanged, 13d's card above all: its `EmptyState` carries no
  // accessibility props of its own, so there is nothing there to focus and being told is all it has.
  const spokenAlternatives = focusedResults === null ? alternativesAnnouncement : null

  const announcedAlternatives = useRef<string | null>(null)

  useEffect(() => {
    // What is still spoken here carries `accessibilityLiveRegion="polite"`, which RN 0.86 implements on Android
    // only, so VoiceOver is told here and only here — Android keeps its live region rather than being told
    // twice, and the resolution iOS now reads by being focused is already out of `spokenAlternatives`. What
    // counts as new is `resolveAnnouncementGuard`'s to decide: a refetch that answers with the same rows without
    // leaving the list says nothing again, while a wait the screen genuinely returns to clears the guard, so the
    // resolution after it is announced even when its copy repeats.
    const guard = resolveAnnouncementGuard(spokenAlternatives, announcedAlternatives.current)

    announcedAlternatives.current = guard.lastAnnounced

    if (guard.announces !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(guard.announces)
    }
  }, [spokenAlternatives])

  // Frame 13's two explanatory pieces travel together and frame 13e drops both (see index.util).
  const showsGuidance = rendersAlternativesGuidance(view)

  const showsOutcomeRetrySpinner = rendersOutcomeRetrySpinner(view)

  const renderAlternatives = useCallback(
    ({item: block}: ListRenderItemInfo<AlternativesBlock>): React.JSX.Element => (
      <View style={styles.alternativesCard}>
        {block.alternatives.map((alternative, index) => (
          <AlternativeRow
            key={alternative.recipeVersionId}
            alternative={alternative}
            meta={buildMealMetaText({
              calories: alternative.calories,
              protein: alternative.protein,
              totalMinutes: alternative.totalMinutes
            })}
            isFirst={index === 0}
            onPress={() => onOpenPreview(alternative)}
          />
        ))}
      </View>
    ),
    [onOpenPreview]
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <FlatList
          data={blocks}
          keyExtractor={block => block.key}
          renderItem={renderAlternatives}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <>
              <View style={styles.headerRow}>
                <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

                <Text style={styles.dateLabel}>{buildSwapDateLabel(params.date)}</Text>
              </View>

              {banner !== null && bannerSlot === 'aboveTitle' && (
                // 13e's slot: the outcome of the commit the user just asked for, which is what the screen is
                // about, so it precedes the title and the card it makes promises about. `statusRole` is what
                // announces it: the banner groups its own title and body into one alert and speaks the pair on
                // both platforms, leaving its "Try again" and "Back to alternatives" separately reachable. This
                // wrapper carries no semantics of its own — it positions the banner and the retry spinner.
                <View style={styles.errorBannerWrapper}>
                  <InfoBanner
                    tone={banner.tone}
                    glyph={banner.glyph}
                    title={banner.title}
                    body={banner.body}
                    statusRole="alert"
                    actionLabel={banner.actionLabel}
                    onAction={onBannerAction}
                    isActionPending={isAttemptPending}
                    secondaryActionLabel={banner.secondaryActionLabel}
                    onSecondaryAction={banner.secondaryActionLabel === undefined ? undefined : onDismissAttempt}
                  />

                  {showsOutcomeRetrySpinner && (
                    // The same-key replay in flight. The banner above keeps the copy of the outcome being
                    // reconciled, so this is what tells the user the request is running — the reason every
                    // alternative is withheld until it answers. The spinner declares its own progressbar role
                    // and label, so the row is a layout wrapper and adds nothing to announce.
                    <View style={styles.outcomeRetryRow}>
                      <IndeterminateSpinner size="sm" />
                    </View>
                  )}
                </View>
              )}

              {showsForeignHoldNotice && (
                // The rows are withheld because a swap on ANOTHER meal is still unconfirmed, and a withheld
                // list with nothing said about it reads as "no alternatives". The copy names that wait rather
                // than reusing the unconfirmed-outcome pair: nothing the user did HERE failed, and telling them
                // to check their connection would ask for an action that cannot help. It carries no action
                // either, because only the meal holding the key may replay it. `statusRole` is what announces
                // it on both platforms — a wait the rows disappeared for must not be left to be found.
                <View style={styles.errorBannerWrapper}>
                  <InfoBanner
                    tone="error"
                    glyph="alert"
                    title={MEAL_PLAN_OTHER_MEAL_PENDING_TITLE}
                    body={MEAL_PLAN_OTHER_MEAL_PENDING_BODY}
                    statusRole="alert"
                  />
                </View>
              )}

              {currentMeal !== null && (
                <>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.title,
                      (bannerSlot === 'aboveTitle' || showsForeignHoldNotice) && styles.titleAfterBanner
                    ]}>
                    {buildSwapTitle(currentMeal.slot)}
                  </Text>

                  <View style={styles.currentMealWrapper}>
                    <CurrentMealCard
                      name={currentMeal.recipe.name}
                      iconKey={currentMeal.recipe.iconKey}
                      meta={buildMealMetaText({
                        calories: currentMeal.planned.calories,
                        protein: currentMeal.planned.protein,
                        totalMinutes: currentMeal.recipe.totalMinutes
                      })}
                      variant={view.currentMealVariant}
                      eyebrow={currentMealEyebrow(view.currentMealVariant, currentMeal.slot)}
                    />
                  </View>
                </>
              )}

              {blocks.length > 0 && (
                <View style={styles.sectionRow}>
                  {/* The overline speaks the result count, as a live region on Android and as the cursor's
                      destination on iOS, so the end of the wait a screen reader was told about ("Loading", 13c)
                      reaches the user instead of leaving them to sweep the screen for it. The hint stays a
                      sibling rather than being folded into this name, which keeps it readable on its own;
                      nothing else here is announced. */}
                  {/* No heading role on the overline: this wrapper is the one element the platform exposes
                      here, so a role on its child would never be reached. The role is not moved onto the
                      wrapper either, because the wrapper is the live-region announcement above and its
                      semantics are owned elsewhere — the screen's own title already carries the heading. */}
                  <View
                    ref={resultsRef}
                    accessible
                    accessibilityLabel={resultsAccessibilityLabel}
                    accessibilityLiveRegion="polite">
                    <SectionOverline text={SWAP_ALTERNATIVES_HEADER} />
                  </View>

                  {showsGuidance && <Text style={styles.sectionHint}>{SWAP_FITS_TARGETS_LABEL}</Text>}
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <>
              {banner !== null && bannerSlot === 'alternatives' && (
                // The alternatives area, below the title and the current-meal card that both stay (0.2.5): a
                // read failed, not the plan. It replaces content the user was waiting on rather than arriving
                // with the screen, so it has to be announced — and `statusRole` is where that announcement now
                // comes from, on both platforms, over the banner's own grouped title and body. This wrapper
                // declares nothing: a live region around that group would announce the same failure twice.
                <View style={styles.alternativesBannerWrapper}>
                  <InfoBanner
                    tone={banner.tone}
                    glyph={banner.glyph}
                    title={banner.title}
                    body={banner.body}
                    statusRole="alert"
                    actionLabel={banner.actionLabel}
                    onAction={onBannerAction}
                    isActionPending={isRetryPending}
                  />
                </View>
              )}

              {showsCommitBusyState && (
                // A commit is unresolved while nothing on screen states it — the silent replay is still on the
                // wire, or its banner has been dismissed — and the alternatives are withheld until its key is
                // answered, so this is what keeps the slot from reading as "nothing to show". It carries no
                // visible label because the copy this release ships here ("Finding alternatives") describes the
                // list rather than the commit being reconciled.
                <View
                  style={styles.loadingRow}
                  accessible
                  accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}
                  accessibilityState={{busy: true}}>
                  <IndeterminateSpinner size="sm" />
                </View>
              )}

              {view.kind === 'loading' && (
                <>
                  <View
                    style={styles.loadingRow}
                    accessible
                    accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}
                    accessibilityState={{busy: true}}>
                    <IndeterminateSpinner size="sm" />

                    <Text style={styles.loadingLabel}>{SWAP_FINDING_ALTERNATIVES_TEXT}</Text>
                  </View>

                  <View style={styles.skeletonWrapper}>
                    <SkeletonAlternatives />
                  </View>
                </>
              )}

              {view.kind === 'empty' && currentMeal !== null && (
                <>
                  {/* 13d replaces the same spinner the list does, so its headline and body are announced the
                      same way rather than waiting for the user to sweep the screen again. */}
                  <View style={styles.emptyCardWrapper} accessibilityLiveRegion="polite">
                    <View style={styles.emptyCard}>
                      <EmptyState
                        icon={
                          <SearchMinusIcon
                            size={Sizes.ICON_BADGE}
                            color={Theme.colors.lime}
                            strokeWidth={Stroke.BADGE_ZOOM}
                          />
                        }
                        variant="badge"
                        bottomInset="none"
                        headline={SWAP_NO_ALTERNATIVES_TITLE}
                        body={buildNoAlternativesBody(currentMeal.slot)}
                        primaryLabel={MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
                        onPrimary={onEditPreferences}
                        secondaryLabel={SWAP_KEEP_CURRENT_MEAL_BUTTON_TEXT}
                        onSecondary={navigation.goBack}
                      />
                    </View>
                  </View>

                  <View style={styles.infoBannerWrapper}>
                    <InfoBanner tone="success" glyph="info" body={SWAP_NO_ALTERNATIVES_BANNER_BODY} />
                  </View>
                </>
              )}
            </>
          }
          ListFooterComponent={
            blocks.length > 0 && showsGuidance ? (
              <Text style={styles.footnote}>{SWAP_ALTERNATIVES_FOOTNOTE}</Text>
            ) : null
          }
        />
      </ContentColumn>
    </SafeAreaView>
  )
}

export default SwapMealScreen
