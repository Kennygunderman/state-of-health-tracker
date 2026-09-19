import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {AccessibilityInfo, LayoutChangeEvent, Platform, TouchableOpacity, View} from 'react-native'

import type {MealPlanMeal} from '@data/models/MealPlan'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {LogPlannedMealRouteProp, Navigation} from '@navigation/types'
import type {LogPlannedMealResult} from '@queries/api/mealPlanning/logPlannedMeal'
import {mutationKeys} from '@queries/keys'
import {useDailyMacrosQuery} from '@queries/macros/useDailyMacrosQuery'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useLogPlannedMealMutation} from '@queries/mealPlanning/useLogPlannedMealMutation'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {useSessionStore} from '@store/session/useSessionStore'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {useIsMutating} from '@tanstack/react-query'
import {mintKey} from '@utility/IdempotencyUtility'
import {isWriteAllowedByVerdict, isWriteRefusedByVerdict} from '@utility/MealPlanLifecycleUtility'
import {applyFractionPart} from '@utility/ServingsUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'
import {v4 as uuidv4} from 'uuid'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import ChevronLeftIcon from '@components/icons/ChevronLeftIcon'
import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import InfoBanner from '@components/InfoBanner'
import MetricGrid4 from '@components/MetricGrid4'
import PrimaryButton from '@components/PrimaryButton'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  LOG_PLANNED_MEAL_ADD_TO_DIARY_BUTTON_TEXT,
  LOG_PLANNED_MEAL_ADD_TO_HEADER,
  LOG_PLANNED_MEAL_SLOT_FALLBACK_CAPTION,
  LOG_PLANNED_MEAL_THIS_ADDS_ANNOUNCEMENT_TEMPLATE,
  LOG_PLANNED_MEAL_TITLE,
  MEAL_PLAN_ANNOUNCEMENT_SEPARATOR,
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_METRIC_ANNOUNCEMENT_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_OTHER_MEAL_PENDING_BODY,
  MEAL_PLAN_OTHER_MEAL_PENDING_TITLE,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  SERVINGS_HEADER,
  stringWithNamedParameters,
  THIS_ADDS_LABEL
} from '@constants/strings'

import FractionChips from './components/FractionChips'
import RecipeSummaryCard from './components/RecipeSummaryCard'
import ServingsStepper from './components/ServingsStepper'
import SlotPicker from './components/SlotPicker'
import styles from './index.styled'
import {
  buildThisAddsItems,
  canChangeLogDate,
  classifyLogFailure,
  dateOverlineText,
  isLogFormEditable,
  isLogOutcomeUnconfirmed,
  isPlanStateReadFailure,
  LogCommitTarget,
  logDateStepAccessibilityLabel,
  logDateStepperLabel,
  LogPlanDateRange,
  nextLogDate,
  nextPlannedServings,
  parsePlannedServingsInput,
  planDayQueryRecovery,
  planDayQueryScope,
  planLogAttempt,
  planStoredLogReplay,
  planUnconfirmedRefetch,
  resolveLogAttemptDispatch,
  resolveLogCacheScope,
  resolveLogDiaryDestination,
  resolveLogFormValues,
  resolveLogLaunch,
  resolveLogReservationRecord,
  resolveLogSubmitAffordance,
  resolveRestoredLogDraft,
  resolveUnresolvedLogIntent,
  resolveViewTarget,
  thisAddsTotals
} from './index.util'

const ONE_PORTION = 1

interface LogReadyState {
  meal: MealPlanMeal
  planRevision: number
  target: LogCommitTarget
}

/**
 * Frame 15: the portion of a planned meal that was actually eaten, and the diary bucket it lands in.
 *
 * The write is keyed, and this screen is the owner of its intent (0.7.2). The unresolved intent is resolved
 * before anything else is derived: while one is on record it supplies the visible portion, day and bucket, it
 * locks them, it is replayed silently once as the screen opens, and every attempt — the open replay, the
 * banner's "Try again" and the footer CTA alike — sends its stored snapshot under its stored key. A fresh key
 * is minted only when nothing is unresolved, because a key answered by a lost response may already have
 * written the entry: re-sending it returns that same entry, while a new key writes a second one.
 *
 * A failure never leaves this screen — the portion, the date and the bucket all stay exactly as entered.
 */
const LogPlannedMealScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<LogPlannedMealRouteProp>()

  const userId = useAuthStore(state => state.userId)
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  // Read through the hook, not `getState()`: the persisted slice arrives from AsyncStorage after the first
  // frame, and the replay below has to re-render and reconsider when it lands (0.7.2).
  const hasHydratedIntents = useMealPlanStore(state => state.hasHydratedIntents)
  // The same fact with its third case kept, which is the one the user can act on: a read that was refused
  // leaves the slot unknown, so the screen says so and offers the read again rather than minting beside it.
  const intentsHydration = useMealPlanStore(state => state.intentsHydration)
  const retryIntentsHydration = useMealPlanStore(state => state.retryIntentsHydration)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setPostLogResult = useMealPlanStore(state => state.setPostLogResult)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  // Selected alongside the day on success: the plan tab binds the success banner to whatever plan it is
  // showing, and `selectedPlanId` is ephemeral, so an entry logged against the upcoming week has to name its
  // own plan or the banner is raised on this week instead (0.1.4 iii, 0.7.4).
  const setSelectedPlanId = useMealPlanStore(state => state.setSelectedPlanId)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  // Read only. This is the day the Diary itself calls today, and the only value the post-log destination may
  // be decided against: a second reading of "today" could send the user to a screen the entry is not on.
  const sessionDayKey = useSessionStore(state => state.sessionStartDateIso)

  const [logDate, setLogDate] = useState(params.date)
  const [servings, setServings] = useState(ONE_PORTION)
  const [chosenBucketId, setChosenBucketId] = useState<string | null>(null)
  // The key this screen has had an unknown answer for, which is what the unconfirmed banner belongs to — not
  // the presence of a stored intent, which is owed a silent replay first.
  const [unconfirmedKey, setUnconfirmedKey] = useState<string | null>(null)
  const [skeletonWidth, setSkeletonWidth] = useState(0)

  // One clock for this mount: the stepper's day labels and the stored intent's 7-day life are day-granular, so
  // re-reading it per render could only let two readings of the same day disagree. The post-log destination is
  // decided against the session's day key instead, because that is the one the Diary itself is showing.
  const now = useMemo(() => new Date(), [])

  // Counted across the app rather than read off this screen's own mutation: the Meal Plan tab is the AAP's
  // cold-start owner for this action and sends the same mutation key, so an instance-local pending flag would
  // let this screen's replay and the tab's put one key on the wire twice (0.7.2).
  const logRequestsInFlight = useIsMutating({mutationKey: mutationKeys.logPlannedMeal})
  const isLogRequestInFlight = logRequestsInFlight > 0

  // What may be done about the planned-log action at all, decided from the state of the ACTION's one intent
  // slot rather than from this route's scope: another meal's unresolved key is not an empty slot, and neither
  // is a slice that has not been read back yet. Resolved before the form and before every query scope,
  // because it decides whether anything on screen may be edited.
  const launch = useMemo(
    () =>
      resolveLogLaunch({
        pendingIntents,
        userId,
        planId: params.planId,
        mealId: params.mealId,
        now: now.getTime(),
        hasHydratedIntents,
        isRequestInFlight: isLogRequestInFlight
      }),
    [hasHydratedIntents, isLogRequestInFlight, now, params.mealId, params.planId, pendingIntents, userId]
  )

  // This screen's own unresolved intent, which is the authority on what is displayed while it exists: its
  // stored snapshot is the request the next attempt must send byte for byte. Kept separate from the launch
  // verdict because a verdict blocked by an in-flight request carries no intent, while the values on screen
  // must still be the stored ones.
  const storedIntent = useMemo(
    () =>
      resolveUnresolvedLogIntent({
        pendingIntents,
        userId,
        planId: params.planId,
        mealId: params.mealId,
        now: now.getTime()
      }),
    [now, params.mealId, params.planId, pendingIntents, userId]
  )

  // The values on screen, and whether they may be edited. An unresolved key is re-sent unchanged, so the
  // stepper, the chips, the bucket picker and the date stepper all show the stored request and hold still
  // until that key is answered — editing them could only describe a request no attempt from here may send.
  // They hold still for the same reason before hydration has succeeded and while any other holder has the
  // slot: a value accepted then could never become the request that is sent.
  const form = useMemo(
    () =>
      resolveLogFormValues({
        intent: storedIntent,
        isEditable: isLogFormEditable(launch),
        servings,
        selectedDate: logDate,
        chosenBucketId
      }),
    [chosenBucketId, launch, logDate, servings, storedIntent]
  )

  /**
   * The stored request adopted into this screen's own draft, once, while its intent exists.
   *
   * The derivation above only overrides what it returns, so without this the portion, day and bucket the
   * screen holds stay at one serving, the route's date and no bucket — and the moment a confirmed refusal
   * retires the intent the screen falls back to those, losing the restored request the user was looking at.
   * 0.2.5 keeps a failed attempt on this screen with every entered value intact, and a restored attempt is no
   * different. Safe against a user edit by construction: the form is locked for as long as an intent is on
   * record, and the resolver answers `null` once the three values already match, so the effect settles after
   * one pass.
   */
  const restoredDraft = useMemo(
    () =>
      resolveRestoredLogDraft({
        intent: storedIntent,
        servings,
        selectedDate: logDate,
        chosenBucketId
      }),
    [chosenBucketId, logDate, servings, storedIntent]
  )

  useEffect(() => {
    if (restoredDraft === null) {
      return
    }

    setServings(restoredDraft.servings)
    setLogDate(restoredDraft.selectedDate)
    setChosenBucketId(restoredDraft.chosenBucketId)
  }, [restoredDraft])

  // The meal belongs to the planned day the route names; the entry is written to the day the form resolves,
  // which is the day the diary is read for and the date the payload carries.
  const cacheScope = useMemo(
    () => resolveLogCacheScope({planId: params.planId, plannedDate: params.date, selectedDate: form.selectedDate}),
    [form.selectedDate, params.date, params.planId]
  )

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own reads, or a keyed write it
  // issued — is terminal for a gated screen: no recovery that stays here can succeed, so the guard leaves for
  // the Meal Plan segment, which states the refusal once (AAP 0.2.5). Every other failure, including a lost
  // response or an undecodable body, is untouched and still retryable in place.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const dayQuery = useMealPlanDayQuery(...planDayQueryScope(cacheScope))
  const macrosQuery = useDailyMacrosQuery(cacheScope.diaryDate)
  const currentPlanQuery = useCurrentMealPlanQuery(isGatedRequestAllowed)
  const logMutation = useLogPlannedMealMutation(cacheScope.planId, params.mealId)

  const refetchDisplay = dayQuery.refetch
  const refetchDiary = macrosQuery.refetch
  const refetchCurrentPlan = currentPlanQuery.refetch

  const hasRefetchedUnconfirmed = useRef(false)
  const hasAnnouncedPlanState = useRef(false)
  // Every key this screen has sent in this lifetime, however it was sent — the open replay, the banner's
  // "Try again" or the footer CTA. Latched before the request leaves so the replay decision below can never
  // send the same key a second time while the first is still on the wire.
  const sentKey = useRef<string | null>(null)
  // Whether a dispatch is between its decision and its answer. The in-flight count it complements is a render
  // value, so this is what closes the one-frame window in which two presses could both plan a fresh key.
  const isAttemptDispatching = useRef(false)
  const hasAnnouncedWriteRefused = useRef(false)

  const envelope = dayQuery.data
  const diaryMeals = macrosQuery.data?.meals

  const meal = useMemo(
    () => envelope?.day.meals.find(candidate => candidate.id === params.mealId) ?? null,
    [envelope, params.mealId]
  )

  // Whether the bucket was a canonical slot-name match or a fallback onto a renamed diary day is the
  // condition of the caption below, so it is resolved here with the bucket itself.
  const destination = useMemo(
    () =>
      resolveLogDiaryDestination({
        selectedDate: cacheScope.diaryDate,
        slot: meal?.slot ?? null,
        planSlots: envelope?.day.meals.map(planned => planned.slot) ?? [],
        diaryMeals,
        chosenBucketId: form.chosenBucketId
      }),
    [cacheScope.diaryDate, diaryMeals, envelope, form.chosenBucketId, meal]
  )

  const planRange = useMemo<LogPlanDateRange | null>(() => {
    const plans = currentPlanQuery.data

    if (plans === undefined) {
      return null
    }

    const match = [plans.current, plans.upcoming].find(candidate => candidate?.id === params.planId)

    return match === undefined || match === null ? null : {startDate: match.startDate, endDate: match.endDate}
  }, [currentPlanQuery.data, params.planId])

  // The recipe card, the figures, the bucket picker and the write are all the same one meal, so they are
  // narrowed in one place: a ready state, or nothing.
  const ready = useMemo<LogReadyState | null>(() => {
    const target = destination.target

    return meal === null || envelope === undefined || target === null
      ? null
      : {meal, planRevision: envelope.planRevision, target}
  }, [destination.target, envelope, meal])

  // What the COMMIT is ready against, which is narrower than what the screen renders. The gate is the day
  // envelope's own `isWritable` and nothing local (the contract on `MealPlanDayEnvelope`): endedness is judged
  // in the user's saved zone, so an ended or superseded week reaches here looking perfectly loadable while
  // every write against it is refused `409 plan_not_active`. Spelled through `isWriteAllowedByVerdict` so the
  // unanswered verdict — `null` on the envelope seeded from the cached week — is never read as permission.
  const commitReady = useMemo<LogReadyState | null>(
    () => (ready !== null && isWriteAllowedByVerdict(envelope?.isWritable) ? ready : null),
    [envelope?.isWritable, ready]
  )

  const isLoading = dayQuery.isLoading || macrosQuery.isLoading

  // What the footer CTA and the banner's retry may offer. Commit readiness is only half of it: a press taken
  // before the persisted slice has been read, while another meal's key is unresolved, or while an attempt is
  // on the wire would either duplicate a write or abandon a key, so those states offer a spinner, a retry of
  // the READ, or nothing at all (0.7.2).
  //
  // A REPLAY is the one attempt a refused verdict still permits: a reserved key is answered from its stored
  // response before the transaction reads the plan's status (0.5.1), and that answer is the only way this
  // client learns whether a write whose response was lost committed. A fresh write against that plan stays
  // barred, which is why the two readings of "ready" differ by exactly the verdict.
  const affordance = useMemo(
    () =>
      resolveLogSubmitAffordance({
        launch,
        isCommitReady: launch.kind === 'replay' ? ready !== null : commitReady !== null,
        intentsHydration
      }),
    [commitReady, intentsHydration, launch, ready]
  )

  // The one failure the plan draws on this frame: an outcome that may already have committed promises nothing
  // and offers the same key again. It is stated only once that key has actually answered with an unknown
  // outcome — a stored intent whose replay has not been tried yet is finished silently instead (0.7.2) — and
  // it stays on screen, spinner and all, until that key is resolved. Every confirmed refusal is reported by
  // toast instead, because the key it answered is spent.
  const isUnconfirmed = isLogOutcomeUnconfirmed({intent: storedIntent, unconfirmedKey})

  const onLogged = useCallback(
    (result: LogPlannedMealResult, loaded: LogReadyState): void => {
      // A server answer to the key resolves the intent, whether it committed now or replayed a stored entry.
      clearPendingIntent('log')
      setPostLogResult({
        entryId: result.entry.id,
        dateIso: loaded.target.diaryDate,
        slotLabel: loaded.target.bucketLabel,
        recipeName: loaded.meal.recipe.name,
        viewTarget: resolveViewTarget(loaded.target.diaryDate, sessionDayKey)
      })
      // The route's own plan and PLANNED day, which are the authoritative origin of this entry: the diary date
      // above may sit on another day of the week, and the tab reads its banner's plan and day from the
      // selection. Plan first, then day — selecting a different plan clears the day by design.
      setSelectedPlanId(params.planId)
      setSelectedPlanDate(params.date)
      setMacrosSegment('mealPlan')
      // The success banner is the plan tab's (38:351), raised from postLogResult — no toast is raised here.
      navigation.popTo(Screens.MACROS)
    },
    [
      clearPendingIntent,
      navigation,
      params.date,
      params.planId,
      sessionDayKey,
      setMacrosSegment,
      setPostLogResult,
      setSelectedPlanDate,
      setSelectedPlanId
    ]
  )

  const onLogFailed = useCallback(
    (error: unknown, idempotencyKey: string): void => {
      const decision = classifyLogFailure(error)

      if (decision.disposition === 'retire') {
        clearPendingIntent('log')
      }

      // An unknown outcome is stated in place by the banner below and carries no toast, because its key is
      // still the only safe way to ask again. Held against the key that earned it, and dropped on a confirmed
      // refusal: that answer is terminal for the key, so there is nothing left for the screen to be unsure
      // about and the toast below reports it instead.
      setUnconfirmedKey(decision.isUnconfirmed ? idempotencyKey : null)

      if (decision.toast !== null) {
        showToast('error', decision.toast)
      }

      if (decision.refetchCurrentPlan) {
        refetchCurrentPlan()
      }

      // A rebuilt bucket list is what lets the next attempt name a bucket the day actually has.
      if (decision.refetchDiary) {
        refetchDiary()
      }
    },
    [clearPendingIntent, refetchCurrentPlan, refetchDiary]
  )

  /**
   * One attempt of the keyed write, whoever asks for it: the silent replay as the screen opens, the banner's
   * "Try again" and the footer CTA all run this — because all three have to make the *same* request. While an
   * intent is unresolved that request is its stored snapshot under its stored key; only when the action's slot
   * is genuinely free is a key minted, at the press rather than at render, so an edited portion, a stepped
   * date or a different bucket earns its own.
   *
   * Every refusal before the request is somebody else's decision, not this handler's: an unread persisted
   * slice, another meal's unresolved key and a request already on the wire all end here with no request sent,
   * no key minted and the slot untouched — and so does a reservation the device would not confirm, because a
   * key that is not at rest cannot reconcile a write the server may already have made (0.7.2).
   */
  const submitLogAttempt = useCallback(async (): Promise<void> => {
    // The synchronous half of the in-flight guard. `useIsMutating` and the launch verdict it feeds are render
    // values, so two presses queued in one frame would both read a free slot; this latch is what makes the
    // second one a no-op before either has re-rendered.
    if (ready === null || isAttemptDispatching.current) {
      return
    }

    const plan = planLogAttempt({
      planId: cacheScope.planId,
      mealId: params.mealId,
      servings: form.servings,
      diaryDate: ready.target.diaryDate,
      diaryMealId: ready.target.diaryMealId,
      planRevision: ready.planRevision,
      userId,
      launch,
      attemptedAt: Date.now(),
      mintFreshKey: () => mintKey(uuidv4)
    })

    // Blocked: nothing was minted and nothing was filed, and the state that blocked it is what the CTA and
    // the banners above are already rendering.
    if (plan.kind === 'blocked') {
      return
    }

    const attempt = plan.attempt

    isAttemptDispatching.current = true

    // Latched before anything is awaited, so the open replay cannot send this key again — including the key
    // this very attempt just minted, and including across the storage write below.
    sentKey.current = attempt.payload.idempotencyKey
    hasRefetchedUnconfirmed.current = false

    try {
      // Awaited before the request leaves, which is what makes a response lost in flight replayable at all: a
      // record written in memory and a request sent in the same tick raced the storage write, and a kill in
      // that window left the key nowhere — the next launch minted a second one and wrote a second diary entry
      // for one meal (0.7.2). A replay's record is normally already at rest and the reservation then answers
      // from the confirmed slice without touching the device; `resolveLogReservationRecord` is what finds it,
      // and restates it under its own `createdAt` rather than refiling a key the user pressed once.
      const record = resolveLogReservationRecord(attempt, pendingIntents)
      const dispatch = resolveLogAttemptDispatch(
        record === null ? null : await recordPendingIntent(record),
        attempt.isReplay
      )

      if (dispatch.kind === 'refused') {
        // Nothing is sent: a key the device never confirmed cannot reconcile a write the server may already
        // have committed. A never-sent key's record goes rather than locking the portion, the day and the
        // bucket behind a request that never left; a replayed key's record stays, because that request may
        // have landed. The CTA is offered again either way, and the refusal is reported the way every other
        // confirmed refusal of this write is.
        if (!dispatch.retainsPendingIntent) {
          clearPendingIntent('log')
        }

        showToast('error', dispatch.toast)

        return
      }

      // Awaited here rather than handed to per-call callbacks: the mutation's own options own the cache
      // invalidations and this screen owns every consequence the user meets. Per-call callbacks are also
      // dropped when the screen unmounts mid-flight, which would leave a committed write's intent unresolved
      // and the next mount stating an outcome the server had already confirmed.
      const result = await logMutation.mutateAsync(attempt.payload)

      onLogged(result, ready)
    } catch (error) {
      onLogFailed(error, attempt.payload.idempotencyKey)
    } finally {
      isAttemptDispatching.current = false
    }
  }, [
    cacheScope.planId,
    clearPendingIntent,
    form.servings,
    launch,
    logMutation,
    onLogFailed,
    onLogged,
    params.mealId,
    pendingIntents,
    ready,
    recordPendingIntent,
    userId
  ])

  useEffect(() => {
    // AAP 0.7.2: the owning screen replays an unresolved intent silently on the next open or cold start,
    // before leaving the user with a manual retry. Exactly one attempt per key — the latch is written before
    // the request is dispatched, so a re-run of this effect while the first attempt is still being set up
    // cannot double it — and nothing here resolves the intent: only the server's answer to that key does.
    //
    // The intent comes from the launch verdict, so a replay can only fire for a key this screen owns, once the
    // persisted read has succeeded, and never while a log request is already on the wire anywhere in the app.
    const replay = planStoredLogReplay({
      launch,
      isCommitReady: ready !== null,
      isRequestInFlight: isLogRequestInFlight,
      replayedKey: sentKey.current
    })

    sentKey.current = replay.replayedKey

    if (replay.replays) {
      // Not awaited and needs no rejection handler: every outcome is handled inside, by `onLogged` or
      // `onLogFailed`.
      submitLogAttempt()
    }
  }, [isLogRequestInFlight, launch, ready, submitLogAttempt])

  useEffect(() => {
    const refetch = planUnconfirmedRefetch({
      isUnconfirmed,
      hasRefetched: hasRefetchedUnconfirmed.current
    })

    if (!refetch.refetchPlanDay && !refetch.refetchDiary) {
      return
    }

    hasRefetchedUnconfirmed.current = true

    if (refetch.refetchPlanDay) {
      refetchDisplay()
    }

    if (refetch.refetchDiary) {
      refetchDiary()
    }
  }, [isUnconfirmed, refetchDiary, refetchDisplay])

  const dayQueryError = dayQuery.error

  useEffect(() => {
    // A decoded plan-state code gets its own copy (0.2.5): the read failed because the plan moved on, which
    // the generic card's "Try again" could never resolve. The ref is what keeps one failure to one toast —
    // the day query's identity changes with every date step, so this effect re-runs on a failure the user has
    // already been told about.
    const recovery = planDayQueryRecovery({error: dayQueryError, hasAnnounced: hasAnnouncedPlanState.current})

    hasAnnouncedPlanState.current = recovery.isPlanStateFailure

    if (recovery.toast !== null) {
      showToast('error', recovery.toast)
    }

    if (recovery.refetchCurrentPlan) {
      refetchCurrentPlan()
    }
  }, [dayQueryError, refetchCurrentPlan])

  // Only an answered `false` is a refusal, which is why it is asked with its own predicate: a screen stating
  // "your plan changed" on an unanswered verdict would be blaming the plan for its own request still being in
  // flight.
  const isWriteRefused = isWriteRefusedByVerdict(envelope?.isWritable)

  useEffect(() => {
    // A refused verdict earns the same recovery 0.2.5 gives the plan-state codes — the code's own copy and a
    // re-read of the plan the tab holds — and the screen is left standing, because an ended week's portion and
    // figures are still worth reading. Said once per mount by the ref, and not at all when the day read itself
    // failed with one of those codes: the effect above has already raised this very copy for the same fact.
    if (!isWriteRefused || isPlanStateReadFailure(dayQueryError) || hasAnnouncedWriteRefused.current) {
      return
    }

    hasAnnouncedWriteRefused.current = true
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [dayQueryError, isWriteRefused, refetchCurrentPlan])

  // The card's own four figures as one sentence, so what is spoken and what is drawn cannot disagree about the
  // portion they describe.
  const thisAddsAnnouncement = useMemo<string | null>(() => {
    if (ready === null) {
      return null
    }

    const metrics = buildThisAddsItems(thisAddsTotals(ready.meal.planned, form.servings))
      .map(item =>
        stringWithNamedParameters(MEAL_PLAN_METRIC_ANNOUNCEMENT_TEMPLATE, {caption: item.caption, value: item.value})
      )
      .join(MEAL_PLAN_ANNOUNCEMENT_SEPARATOR)

    return stringWithNamedParameters(LOG_PLANNED_MEAL_THIS_ADDS_ANNOUNCEMENT_TEMPLATE, {
      label: THIS_ADDS_LABEL,
      metrics
    })
  }, [form.servings, ready])

  const announcedThisAdds = useRef<string | null>(null)

  useEffect(() => {
    // The card's `accessibilityLiveRegion` is Android-only in RN 0.86, so VoiceOver never hears the figures
    // change: focus stays on the stepper or the field and nothing re-reads the card. iOS is therefore told
    // explicitly, while Android is left to its live region rather than announced twice.
    //
    // The first composition is only recorded: on mount VoiceOver is reading the screen itself, and speaking
    // then would interrupt it with figures the user has not reached yet.
    if (thisAddsAnnouncement === null || thisAddsAnnouncement === announcedThisAdds.current) {
      return
    }

    const isFirstComposition = announcedThisAdds.current === null

    announcedThisAdds.current = thisAddsAnnouncement

    if (!isFirstComposition && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(thisAddsAnnouncement)
    }
  }, [thisAddsAnnouncement])

  // The three edit paths, each closed while a key is unresolved: the value on screen is that key's stored
  // request, and a portion, chip or bucket accepted here would show the user something no attempt from this
  // screen may send until the key is answered.
  const onServingsText = useCallback(
    (text: string): void => {
      const parsed = parsePlannedServingsInput(text)

      // An unparseable keystroke leaves the confirmed value alone; the stepper's own draft keeps it on screen.
      if (parsed !== null && !form.isLocked) {
        setServings(parsed)
      }
    },
    [form.isLocked]
  )

  const onServingsStep = (direction: 1 | -1): void => {
    if (!form.isLocked) {
      setServings(current => nextPlannedServings(current, direction))
    }
  }

  const onFractionSelected = (fractionValue: number): void => {
    if (!form.isLocked) {
      setServings(current => applyFractionPart(current, fractionValue))
    }
  }

  const onBucketSelected = (mealId: string): void => {
    if (!form.isLocked) {
      setChosenBucketId(mealId)
    }
  }

  const canStepDate = (direction: 1 | -1): boolean =>
    canChangeLogDate({
      selectedDate: form.selectedDate,
      direction,
      planRange,
      isCommitPending: isLogRequestInFlight,
      isIntentUnresolved: form.isLocked
    })

  const stepTargetDate = (direction: 1 | -1): string =>
    nextLogDate({selectedDate: form.selectedDate, direction, planRange})

  const onStepDate = (direction: 1 | -1): void => {
    if (!canStepDate(direction)) {
      return
    }

    setLogDate(stepTargetDate(direction))
    // A bucket is a row of one day's diary, so a chosen one cannot carry to another day: the new day resolves
    // its own, which is also what keeps the picker from holding an id the new day does not contain.
    setChosenBucketId(null)
  }

  const onSkeletonLayout = (event: LayoutChangeEvent): void => setSkeletonWidth(event.nativeEvent.layout.width)

  const onRetryLoadPressed = (): void => {
    refetchDisplay()
    refetchDiary()
  }

  // A plan-state failure keeps the banner but drops its retry: refetching the same superseded plan cannot
  // answer differently, and the code's own copy was raised as a toast instead (0.2.5).
  const canRetryLoad = !isPlanStateReadFailure(dayQueryError)

  const skeletonBar = (height: number): React.JSX.Element => (
    <SkeletonBlock height={height} width={skeletonWidth} borderRadius={BorderRadius.CARD_LG} />
  )

  const loadingBlock = (): React.JSX.Element => (
    <View onLayout={onSkeletonLayout} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {skeletonWidth > 0 && (
        <>
          <View style={styles.recipeCardSection}>{skeletonBar(Sizes.CONTROL_LG)}</View>

          <View style={styles.stepperSection}>{skeletonBar(Sizes.CONTROL)}</View>

          <View style={styles.chipsSection}>{skeletonBar(Sizes.CONTROL)}</View>

          <View style={styles.thisAddsSection}>{skeletonBar(Sizes.CONTROL_LG)}</View>

          <View style={styles.slotSection}>{skeletonBar(Sizes.CONTROL)}</View>
        </>
      )}
    </View>
  )

  // Every status banner below is an `alert`: each one refuses or holds the write the user came here to make,
  // so it interrupts what is being read rather than waiting its turn. `statusRole` is also what groups a
  // banner's title and body into one spoken element instead of two loose text nodes, and what states an
  // appearing status at all — the assertive live region is Android's half, and InfoBanner announces the
  // composed message on iOS, which has none. Its retry stays a separately reachable button.
  const errorBlock = (): React.JSX.Element => (
    <View style={styles.bannerSection}>
      <InfoBanner
        tone="error"
        glyph="alert"
        body={MEAL_PLAN_LOAD_ERROR_TITLE}
        statusRole="alert"
        actionLabel={canRetryLoad ? MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT : undefined}
        onAction={canRetryLoad ? onRetryLoadPressed : undefined}
        secondaryActionLabel={MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  const logBody = (loaded: LogReadyState): React.JSX.Element => (
    <>
      {/* The persisted read was refused, so what the log slot holds is unknown and nothing may be sent: the
          form below is read-only and the only action offered is the read itself, which is the single way out
          of that state (0.7.2). The copy is the failed-read pair — a read that changed nothing is plainly
          safe to repeat. */}
      {affordance.offersHydrationRetry && (
        <View style={styles.bannerSection}>
          <InfoBanner
            tone="error"
            glyph="alert"
            body={MEAL_PLAN_LOAD_ERROR_TITLE}
            statusRole="alert"
            actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
            onAction={retryIntentsHydration}
          />
        </View>
      )}

      {/* A log on ANOTHER meal is still unconfirmed, and the action holds one idempotency-key slot, so this
          meal may not be sent until that key is answered — overwriting it is what would write that other meal
          twice (0.7.2). The form below stays readable but read-only, and no action is offered here: only the
          meal holding the key may replay it, and the Meal Plan tab replays it on its own. */}
      {affordance.isBlockedByOtherMeal && (
        <View style={styles.bannerSection}>
          <InfoBanner
            tone="error"
            glyph="alert"
            title={MEAL_PLAN_OTHER_MEAL_PENDING_TITLE}
            body={MEAL_PLAN_OTHER_MEAL_PENDING_BODY}
            statusRole="alert"
          />
        </View>
      )}

      {isUnconfirmed && (
        <View style={styles.bannerSection}>
          <InfoBanner
            tone="error"
            glyph="alert"
            title={MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE}
            body={MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY}
            statusRole="alert"
            // Offered only while a send is actually permitted: a retry that the launch verdict would refuse
            // would promise the user an attempt that never leaves.
            actionLabel={affordance.canSubmit ? MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT : undefined}
            onAction={affordance.canSubmit ? submitLogAttempt : undefined}
            isActionPending={affordance.isPending}
          />
        </View>
      )}

      <View style={styles.recipeCardSection}>
        <RecipeSummaryCard name={loaded.meal.recipe.name} iconKey={loaded.meal.recipe.iconKey} />
      </View>

      {/* Hidden from assistive technology, not from the eye: the stepper's own field already announces
          "Servings", and a label stop of the same name immediately above it is indistinguishable from the
          control it names. */}
      <Text style={styles.controlLabel} accessibilityElementsHidden importantForAccessibility="no">
        {SERVINGS_HEADER}
      </Text>

      {/* Disabled rather than merely ignored while the form is locked: the handlers refuse the edit anyway, but
          a control that only stops touches stays reachable — its accessibility actions are still offered, and
          the servings field could still take focus and display a portion no attempt from here would send. The
          `disabled` prop withdraws the actionability everywhere, and `pointerEvents` keeps a stray touch from
          flashing as though it had been taken. The values themselves stay readable: they are the request. */}
      <View pointerEvents={form.isLocked ? 'none' : 'auto'}>
        <ServingsStepper
          value={form.servings}
          disabled={form.isLocked}
          onDecrement={() => onServingsStep(-1)}
          onIncrement={() => onServingsStep(1)}
          onChangeText={onServingsText}
        />
      </View>

      <View style={styles.chipsSection} pointerEvents={form.isLocked ? 'none' : 'auto'}>
        <FractionChips servings={form.servings} disabled={form.isLocked} onSelect={onFractionSelected} />
      </View>

      <View style={styles.thisAddsSection}>
        <View style={styles.thisAddsCard}>
          <SectionOverline text={THIS_ADDS_LABEL} isHeading />

          {/* One element, so the four figures are read as caption-and-value pairs rather than four orphan
              numbers, and polite so a changed portion is announced without interrupting the field. The region
              is Android's half of that; iOS has none, so VoiceOver is told by `thisAddsAnnouncement` above. */}
          <View accessible accessibilityLiveRegion="polite">
            <MetricGrid4 items={buildThisAddsItems(thisAddsTotals(loaded.meal.planned, form.servings))} />
          </View>
        </View>
      </View>

      <Text style={styles.controlLabel}>{LOG_PLANNED_MEAL_ADD_TO_HEADER}</Text>

      <View style={styles.slotSection} pointerEvents={form.isLocked ? 'none' : 'auto'}>
        <SlotPicker
          options={destination.options}
          selectedMealId={loaded.target.diaryMealId}
          disabled={form.isLocked}
          onSelect={onBucketSelected}
        />
      </View>

      {/* The diary day was renamed, so the bucket this log lands in was inferred rather than matched: saying
          so is what lets the user move it before the write goes out. */}
      {loaded.target.isInferredBucket && (
        <Text style={styles.bucketFallbackCaption}>{LOG_PLANNED_MEAL_SLOT_FALLBACK_CAPTION}</Text>
      )}
    </>
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        {/* The servings field opens the number pad, which is tall enough to cover the fraction chips, the
            bucket picker and the CTA — so the scroll region lifts with it. The footer stays outside it,
            pinned to the safe area (0.7.2). */}
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <View style={styles.headerRow}>
            <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />
          </View>

          <Text style={styles.dateOverline}>{dateOverlineText(form.selectedDate)}</Text>

          <Text style={styles.title} accessibilityRole="header">
            {LOG_PLANNED_MEAL_TITLE}
          </Text>

          <View style={styles.dateRow}>
            {/* Each arrow is named by its direction and then the day it moves to ("Previous day, Sep 14"):
                the glyph carries no destination, and the day alone carries no direction — at the ends of the
                plan week the clamped target is the day already shown, so the two would read alike.
                An arrow that cannot step is also withdrawn from the reader, the way `disabled` withdraws the
                affordance everywhere else on this screen, so a boundary leaves one stop rather than two. */}
            <TouchableOpacity
              style={[styles.dateStepButton, !canStepDate(-1) && styles.dateStepButtonDisabled]}
              activeOpacity={Opacity.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={logDateStepAccessibilityLabel(stepTargetDate(-1), -1, now)}
              accessibilityState={{disabled: !canStepDate(-1)}}
              accessibilityElementsHidden={!canStepDate(-1)}
              importantForAccessibility={canStepDate(-1) ? 'yes' : 'no-hide-descendants'}
              disabled={!canStepDate(-1)}
              onPress={() => onStepDate(-1)}>
              <ChevronLeftIcon color={Theme.colors.text} />
            </TouchableOpacity>

            {/* Hidden from assistive technology, not from sight: the overline above already announces the
                selected date in full ("Monday, September 14th") and both arrows now name concrete dates, so a
                third stop reading only a bare date adds nothing — and at the ends of the plan week it
                duplicated the backward arrow's name verbatim. */}
            <Text style={styles.dateLabel} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {logDateStepperLabel(form.selectedDate, now)}
            </Text>

            <TouchableOpacity
              style={[styles.dateStepButton, !canStepDate(1) && styles.dateStepButtonDisabled]}
              activeOpacity={Opacity.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={logDateStepAccessibilityLabel(stepTargetDate(1), 1, now)}
              accessibilityState={{disabled: !canStepDate(1)}}
              accessibilityElementsHidden={!canStepDate(1)}
              importantForAccessibility={canStepDate(1) ? 'yes' : 'no-hide-descendants'}
              disabled={!canStepDate(1)}
              onPress={() => onStepDate(1)}>
              <ChevronRightIcon color={Theme.colors.text} />
            </TouchableOpacity>
          </View>

          {/* Not ready and still fetching is the placeholder; not ready once fetching has settled is the error
              banner, which covers a failed read and a read that came back without the meal or without a diary
              bucket to log into — both leave nothing to log, and neither may render an empty card. */}
          {ready === null && (isLoading ? loadingBlock() : errorBlock())}

          {ready !== null && logBody(ready)}
        </KeyboardAwareScrollView>
      </ContentColumn>

      {/* Node 38:9 draws the footer and its one CTA in every state, so a screen still loading — or holding an
          error where there is nothing to log, or a plan whose verdict does not permit the write — shows the
          action disabled rather than dropping it. The same applies to every state the launch verdict refuses:
          the persisted read still out or refused, another meal's key unresolved, or an attempt already on the
          wire. */}
      <SetupFooter hairline>
        <PrimaryButton
          label={LOG_PLANNED_MEAL_ADD_TO_DIARY_BUTTON_TEXT}
          isLoading={affordance.isPending}
          disabled={!affordance.canSubmit}
          onPress={submitLogAttempt}
        />
      </SetupFooter>
    </SafeAreaView>
  )
}

export default LogPlannedMealScreen
