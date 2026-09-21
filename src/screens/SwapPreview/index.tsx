import React, {useCallback, useEffect, useMemo, useRef} from 'react'

import {ScrollView, useWindowDimensions, View} from 'react-native'

import type {SwapMealPayload} from '@data/models/SwapAlternative'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {Navigation, SwapPreviewRouteProp} from '@navigation/types'
import {mutationKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {useSwapPreviewQuery} from '@queries/mealPlanning/useSwapPreviewQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {Theme} from '@styles/theme'
import {useIsMutating} from '@tanstack/react-query'
import {composeAccessibleName} from '@utility/AccessibilityUtility'
import {
  API_ERROR_CODES,
  getApiErrorCode,
  isFeatureDisabledError,
  isPlanStateError,
  isUnknownOutcome
} from '@utility/ApiErrorUtility'
import {mintKey, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {dayStripLabel} from '@utility/MealPlanDateUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'
import {v4 as uuidv4} from 'uuid'

import BigNumberRow from '@components/BigNumberRow'
import ContentColumn from '@components/ContentColumn'
import DeltaPill from '@components/DeltaPill'
import InfoBanner from '@components/InfoBanner'
import IngredientRow from '@components/IngredientRow'
import MacroLegendRow from '@components/MacroLegendRow'
import MetricGrid4 from '@components/MetricGrid4'
import PrimaryButton from '@components/PrimaryButton'
import RecipeHero from '@components/RecipeHero'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_LOAD_ERROR_BODY,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_OTHER_MEAL_PENDING_BODY,
  MEAL_PLAN_OTHER_MEAL_PENDING_TITLE,
  RECIPE_DETAIL_INGREDIENTS_HEADER,
  RECIPE_NUTRITION_METHOD_CAPTION,
  stringWithNamedParameters,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_PREVIEW_DAY_TOTAL_TEMPLATE,
  SWAP_PREVIEW_DELTA_DOWN_ACCESSIBILITY_TEMPLATE,
  SWAP_PREVIEW_DELTA_UP_ACCESSIBILITY_TEMPLATE,
  SWAP_PREVIEW_OF_TARGET_TEMPLATE,
  SWAP_PREVIEW_THIS_MEAL_LABEL,
  SWAP_RECIPE_INELIGIBLE_TOAST,
  SWAP_SUCCESS_TOAST,
  SWAP_USE_THIS_MEAL_BUTTON_TEXT,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import CalorieProgressBar from './components/CalorieProgressBar'
import styles, {
  PLACEHOLDER_BAR_RADIUS,
  placeholderCardWidth,
  placeholderWidth,
  THIS_MEAL_PLACEHOLDER_HEIGHTS,
  TITLE_PLACEHOLDER_HEIGHTS,
  TOTALS_PLACEHOLDER_HEIGHTS
} from './index.styled'
import {
  buildSwapMacroLegend,
  buildThisMealMetrics,
  calorieProgressRatio,
  deriveCalorieDelta,
  formatPreviewSubtitle,
  formatReplacingContext,
  isOutcomeOwnedBySwapMeal,
  resolveCommitFailureDisposition,
  resolveSwapCommitDispatch,
  resolvePreviewIngredients,
  resolveSwapCommitGate,
  resolveSwapCommitLaunch,
  resolveSwapSlotOwnership,
  SwapMacroLegendItem
} from './index.util'

// The legend's three dots, in the app's established macro colours (the Diary summary and the targets card use
// the same three), so one macro is one colour wherever a user compares them.
const MACRO_DOT_COLORS: Record<SwapMacroLegendItem['key'], string> = {
  protein: Theme.colors.accentGreen,
  carbs: Theme.colors.teal,
  fat: Theme.colors.lime
}

/**
 * Frame 13b, and the only screen that commits a swap. The commit is keyed: the intent is recorded before the
 * request leaves and the key is reused only for a byte-identical replay, so a response lost in transit is
 * asked again rather than swapping the meal a second time (AAP 0.7.2).
 *
 * The drawn failure states — 13e, its neutral unconfirmed variant and the rowless refusal a contradicted plan
 * revision earns — belong to `SwapMeal` (AAP 0.2.5), and this screen draws none of them. It hands those
 * outcomes over by returning there with the mutation and the pending intent untouched (see `onCommitFailed`):
 * `SwapMeal` finds THIS attempt by matching the intent recorded below (its own user, plan and meal) and then
 * the shared mutation cache entry carrying that intent's idempotency key, and it owns the same-key retry, the
 * "still your lunch" assurance, the withheld alternatives and the display-only plan/day refetch those states
 * require. It is also this screen's only pusher, so `goBack()` always lands on it.
 */
const SwapPreviewScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<SwapPreviewRouteProp>()
  const {width: windowWidth} = useWindowDimensions()

  const userId = useAuthStore(state => state.userId)
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  // Subscribed rather than read once: the slice arrives from AsyncStorage after the first frame, and this
  // screen may neither mint nor record a key until that read has SUCCEEDED (0.7.2).
  const hasHydratedIntents = useMealPlanStore(state => state.hasHydratedIntents)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own reads, or the keyed commit it
  // fires — is terminal for a gated screen: no recovery that stays here can succeed, so the guard leaves for
  // the Meal Plan segment, which states the refusal once (AAP 0.2.5). Every other failure, including a lost
  // response or an undecodable body, is untouched and still retryable in place.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const previewQuery = useSwapPreviewQuery(params.planId, params.mealId, params.recipeVersionId, params.planRevision)
  const dayQuery = useMealPlanDayQuery(params.planId, params.date)
  // Gated like every other reader of `/meal-planning/plans/current`: no gated request may be issued once the
  // capability latch has flipped, and a mounted observer would otherwise keep asking on every remount, focus
  // and reconnect (AAP 0.2.5, 0.7.5).
  const currentPlanQuery = useCurrentMealPlanQuery(isGatedRequestAllowed)
  const swapMutation = useSwapMealMutation(params.planId, params.mealId)

  // TanStack keeps refetch and mutateAsync stable while replacing the observer object on every status change,
  // so the callbacks and effects below depend on these rather than on the observers they hang off.
  const {refetch: refetchPreview} = previewQuery
  const {refetch: refetchDay} = dayQuery
  const {refetch: refetchCurrentPlanRoute} = currentPlanQuery
  const {mutateAsync: commitSwap} = swapMutation

  // The recovery re-read is itself a gated request, so `enabled` does not cover it: `refetch` fetches whatever
  // the option says, which is how an already-open screen kept probing a route that had just refused it — the
  // `feature_disabled` branch below being the plainest case. It is skipped once the latch has flipped, and
  // everything else each recovery does is unchanged (AAP 0.2.5, 0.7.5).
  const refetchCurrentPlan = useCallback((): void => {
    if (!isGatedRequestAllowed) {
      return
    }

    refetchCurrentPlanRoute()
  }, [isGatedRequestAllowed, refetchCurrentPlanRoute])

  const preview = previewQuery.data ?? null
  const meal = dayQuery.data?.day.meals.find(candidate => candidate.id === params.mealId) ?? null

  // Counted across the app rather than read from this hook instance: the swap screen underneath owns a silent
  // same-key replay of its own, and the two must never put one key on the wire at the same time (0.7.2).
  const isCommitInFlight = useIsMutating({mutationKey: mutationKeys.swapMeal}) > 0

  // One clock for this mount: a pending intent's life is measured in days, so re-reading it per render could
  // only make two reads of the same record disagree.
  const now = useMemo(() => Date.now(), [])

  // Who holds the single `swap` slot. A record for another plan or meal is not an empty slot: recording over it
  // would abandon the only key that can reconcile a swap the server may already have committed (0.7.2).
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

  // Everything the commit has to have in hand, in one place (see `resolveSwapCommitGate`): the one `swap`
  // slot free, the persisted slice read, a verdict that positively permits the write, a preview still bound
  // to the day's revision, and no read or write of its own in flight. An unknown verdict is not a refusal —
  // the server decides, and it decides on the request — but it is not permission either, so the CTA stays
  // inert until the day route answers.
  const commitGate = resolveSwapCommitGate({
    ownership: swapSlotOwnership,
    isHydrated: hasHydratedIntents,
    isCommitInFlight,
    isPlanWritable: dayQuery.data?.isWritable,
    dayPlanRevision: dayQuery.data?.planRevision,
    previewPlanRevision: preview?.planRevision,
    isPreviewFetching: previewQuery.isFetching
  })

  const {isCommitDisabled, isCommitPending, showsForeignHoldNotice} = commitGate

  // Whether a press is between its decision and its answer. The in-flight count above is a render value and the
  // press now awaits its own storage write before sending, so this is what closes the window in which two
  // presses would both read a free slot and both reach the wire.
  const isCommitDispatching = useRef(false)

  // The hero names the meal being replaced and the card states the candidate's figures, so nothing is drawn
  // until both are in hand. Memoised because the commit handler closes over it.
  const ready = useMemo(() => (preview !== null && meal !== null ? {preview, meal} : null), [meal, preview])

  const isLoading = previewQuery.isLoading || dayQuery.isLoading

  // A decoded 422 on the preview is not a failed read to retry: the server has answered that this alternative
  // can no longer be planned, so 0.2.5 sends the user back to the alternatives (13) with the code's own copy
  // rather than offering "Try again" against a refusal the next request would earn again. `isUnknownOutcome`
  // keeps a transport failure out of this branch, which is why the generic card below is reserved for one.
  const isRecipeIneligible =
    !isUnknownOutcome(previewQuery.error) && getApiErrorCode(previewQuery.error) === API_ERROR_CODES.recipeIneligible

  // The hero placeholder and the card silhouettes are one state, so it is decided once: the two are the same
  // shell split across the full-bleed band and the content column.
  const isShellLoading = ready === null && (isLoading || isRecipeIneligible)

  const dayName = useMemo(() => dayStripLabel(params.date).weekday, [params.date])

  // Set by `onSwapCommitted` before it toasts and navigates, and read by every effect below. `popTo` unmounts
  // only after the native transition, so this screen keeps rendering — and its observers keep answering — while
  // the commit's own invalidations put the day's NEW revision and an emptied preview cache in front of those
  // effects. The re-read preview then names the recipe this commit has just made the slot's current one, which
  // the server refuses, and recovering from that refusal would contradict the success already on screen: the
  // documented outcome is one toast and one navigation (AAP 0.7.4). A ref, not state, so the same commit's
  // effects observe it as true without re-rendering a screen that is leaving.
  const hasCommitted = useRef(false)

  const hasRecoveredIneligible = useRef(false)

  useEffect(() => {
    // Once per outcome: the effect re-runs whenever a query object's identity changes, and a second pass would
    // toast and pop again for a refusal already recovered from. Skipped outright after a successful commit,
    // whose own re-preview is what earns that refusal — a 422 reaching a user still on this screen is still
    // recovered the way 0.2.5 draws it.
    if (!isRecipeIneligible || hasRecoveredIneligible.current || hasCommitted.current) {
      return
    }

    hasRecoveredIneligible.current = true
    showToast('error', SWAP_RECIPE_INELIGIBLE_TOAST)
    navigation.goBack()
  }, [isRecipeIneligible, navigation])

  const hasWarnedWriteRefused = useRef(false)

  useEffect(() => {
    // Said once, and the screen is left standing: the candidate is still worth reading even though it can no
    // longer be taken, and the plan it belonged to is a tap away. The ANSWERED refusal only — a verdict still
    // in flight is not a dead plan and gets no copy of its own. Nothing is said after a successful commit: the
    // write this copy warns about has already landed, so a stale-plan toast on top of the success one would
    // report a refusal that never happened.
    if (!commitGate.isWriteRefused || hasWarnedWriteRefused.current || hasCommitted.current) {
      return
    }

    hasWarnedWriteRefused.current = true
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
  }, [commitGate.isWriteRefused])

  // No effect asks the day route for the write verdict the seed reports as unknown, and none is needed: the
  // seeded entry is stamped as already stale in `buildMealPlanDayQueryOptions`, so the observer fetches at
  // mount and on every key change, focus and reconnect that finds it stale. An effect calling `refetch()` here
  // would also defeat the gate that same factory applies — `refetch` fetches whatever the option says,
  // `enabled` and all — and send one day read out on a session a gated route has already refused (AAP 0.2.5).

  const refetchedForRevision = useRef<number | null>(null)

  useEffect(() => {
    // The revision this commit itself advanced is not another client's write: re-binding a preview the user is
    // leaving buys nothing, and the request it sends is the one the server answers 422 for.
    if (hasCommitted.current) {
      return
    }

    const dayRevision = dayQuery.data?.planRevision

    // This preview answers for the revision its route named, so a day that has since advanced leaves its
    // portion and totals describing a plan the server no longer holds. Asking again re-binds both — the
    // revision is this query's cache identity rather than part of its request — which is what keeps the commit
    // from going out against a revision it would only be refused for. Guarded by the revision observed, so a
    // server still reporting the older one is asked once and not again.
    if (dayRevision === undefined || preview === null || dayRevision <= preview.planRevision) {
      return
    }

    if (refetchedForRevision.current === dayRevision) {
      return
    }

    refetchedForRevision.current = dayRevision
    refetchPreview()
  }, [dayQuery.data?.planRevision, preview, refetchPreview])

  const onSwapCommitted = useCallback((): void => {
    // Latched first, ahead of the toast and the navigation: the invalidations this commit has already fired
    // reach the effects above through the next render, and every one of them must find the commit settled.
    hasCommitted.current = true

    // A server answer to the key resolves the intent, whether it committed now or replayed a stored result.
    clearPendingIntent('swap')
    showToast('success', SWAP_SUCCESS_TOAST)
    setSelectedPlanDate(params.date)
    setMacrosSegment('mealPlan')
    // popTo, not navigate: navigate() would push a second Macros screen rather than return to the one this
    // flow was opened from, leaving the swap flow underneath it.
    navigation.popTo(Screens.MACROS)
  }, [clearPendingIntent, navigation, params.date, setMacrosSegment, setSelectedPlanDate])

  /**
   * Which screen owns this outcome, and whether the key survives it.
   *
   * FOUR OUTCOMES ARE HANDED BACK TO `SwapMeal` UNTOUCHED (AAP 0.2.5): an outcome nothing described and a
   * confirmed `swap_failed`, which are its drawn unconfirmed and 13e states, plus `preview_stale` and
   * `recipe_ineligible`, which say the revision its alternatives were computed for is not the one a commit
   * would land against — so its rows must go, and stay gone until that list has answered again.
   *
   * THE PENDING RECORD IS WHAT MAKES THAT POSSIBLE, so it must outlive the handoff. `SwapMeal` fires none of
   * these commits: it finds the attempt by resolving the pending intent for its own user, plan and meal and
   * matching that intent's key against the shared mutation cache. Retiring the record here would leave it with
   * no key, no outcome to classify and the very candidates the server has just refused, still tappable — which
   * is why the handoff runs ahead of everything below and retires nothing itself. That screen then owns the
   * whole recovery: the rowless refusal, its toast, the day and alternatives re-read, the display-only
   * `mealPlanCurrent`/`mealPlanDay` refetch an unknown outcome earns, the same-key retry where one is offered,
   * and retiring the key where a replay could never resolve it (0.7.2). Recovering any of it here instead
   * would reconcile against a preview the user is leaving.
   *
   * WHAT REMAINS IS WHAT THIS SCREEN STILL ANSWERS FOR, and retiring the key is the decision it makes:
   * every confirmed answer resolves the action, so only an outcome nothing described keeps the intent — that
   * request may have committed before its response was lost, which leaves its key the only way to ask again
   * without risking a second swap (AAP 0.7.2). A confirmed refusal the server would repeat — a plan that has
   * moved on, a key already spent on another payload, a `swap_failed` that persisted nothing (0.5.2) — ends
   * the intent, so the next attempt mints a fresh one and cannot be answered with `idempotency_conflict`.
   */
  const onCommitFailed = useCallback(
    (error: unknown): void => {
      // The pending record and the mutation cache entry are the whole handoff: no route parameter carries an
      // outcome, because a param cannot say whether the key it describes is still unresolved. Signed-in only —
      // `pendingIntents` is keyed by user, so a signed-out attempt was never recorded, `resolveReplayableSwap`
      // answers null for it over there, and this screen is the only one that could ever report it.
      if (userId !== null && isOutcomeOwnedBySwapMeal(error)) {
        navigation.goBack()

        return
      }

      const code = getApiErrorCode(error)

      // Which outcomes spend the key, stated in one place: `resolveCommitFailureDisposition` keeps a record
      // only for an outcome nothing described, and every confirmed answer — including a `swap_failed`, which
      // persisted nothing — retires it. The four outcomes handed to `SwapMeal` above never reach this line:
      // that screen reads the attempt out of the record first and retires the key itself, so no answer
      // outlives its key either way.
      const disposition = resolveCommitFailureDisposition(error)

      if (!disposition.retainsPendingIntent) {
        clearPendingIntent('swap')
      }

      // Reached by a signed-out attempt at the two outcomes with no copy of their own, and by a rejection
      // that carried no value to classify. Reported here, and the key's fate is the disposition's above: an
      // outcome nothing described may have committed, which makes that key the only way to ask again without
      // risking a second swap (AAP 0.7.2). The user keeps the candidate they were about to commit.
      if (isUnknownOutcome(error) || code === API_ERROR_CODES.swapFailed) {
        showToast('error', TOAST_GENERIC_ERROR)

        return
      }

      // Signed out, so nothing recorded the attempt and this code and `recipe_ineligible` are recovered here
      // rather than handed over. The server recomputed a different portion for this alternative, so the figures
      // on screen are answers about a portion it will not commit. The alternatives are keyed by plan revision,
      // so refreshing the plan is what makes the list behind this screen ask again.
      if (code === API_ERROR_CODES.previewStale) {
        showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
        refetchCurrentPlan()
        navigation.goBack()

        return
      }

      if (code === API_ERROR_CODES.recipeIneligible) {
        showToast('error', SWAP_RECIPE_INELIGIBLE_TOAST)
        navigation.goBack()

        return
      }

      // Superseded or ended: nothing in this flow can be committed against that plan again, so the alternatives
      // behind this screen are no more use than the preview and the whole flow gives way to the current plan.
      if (isPlanStateError(error)) {
        showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
        refetchCurrentPlan()
        setSelectedPlanDate(params.date)
        setMacrosSegment('mealPlan')
        navigation.popTo(Screens.MACROS)

        return
      }

      // Meal planning itself has been switched off behind a mounted backend, so no commit from this preview
      // can ever land and there is nothing here to retry. The refusal is stated once, by the Meal Plan
      // segment's neutral no-CTA unavailable card (AAP 0.2.5, 0.7.5), so this carries NO toast and leaves for
      // that tab — re-reading the current plan on the way, because the same `feature_disabled` answer from a
      // gated route is the signal the entitlement router turns into that card. `SwapMeal`'s own
      // 'exitToPlanTab' recovery and `MealPlanGenerating`'s unavailable family do exactly this.
      if (isFeatureDisabledError(error)) {
        refetchCurrentPlan()
        setMacrosSegment('mealPlan')
        navigation.popTo(Screens.MACROS)

        return
      }

      // `idempotency_conflict` included: the key it rejected has just been retired, so the retry this screen
      // still offers goes out under a new one.
      showToast('error', TOAST_GENERIC_ERROR)
    },
    [clearPendingIntent, navigation, params.date, refetchCurrentPlan, setMacrosSegment, setSelectedPlanDate, userId]
  )

  /**
   * Sends the commit itself, once the launch decision has named it and its key is on the device.
   *
   * Separate from the press below so the order is visible: a keyed write may only leave AFTER its record is
   * durable, and this function knows nothing about that — it is handed the body to send.
   *
   * Awaited rather than handed callbacks so the toast, the navigation and the intent's fate stay at the call
   * site: the mutation's own options own the cache, and nothing else.
   */
  const sendCommit = useCallback(
    async (payload: SwapMealPayload): Promise<void> => {
      try {
        // The portion goes back exactly as the preview bound it, and on a replay every member comes from the
        // STORED snapshot. Recomputing either here is what earns `preview_stale` or `409 idempotency_conflict`:
        // the server derives the same number from the same function and compares the fingerprint.
        await commitSwap(payload)

        onSwapCommitted()
      } catch (error) {
        onCommitFailed(error)
      }
    },
    [commitSwap, onCommitFailed, onSwapCommitted]
  )

  /**
   * The snapshot is built here because this screen is the only place holding all five members of the 0.5.2 wire
   * request: the route's plan and meal, the alternative it is previewing, and the portion and revision the
   * preview envelope bound.
   *
   * Nothing leaves before its record is on the device (AAP 0.7.2), and nothing leaves twice: the reservation is
   * awaited, so this handler owns both the latch that refuses a second press in that window and the refusal the
   * user is told about when the device will not confirm the key.
   */
  const onUseThisMealPressed = useCallback(async (): Promise<void> => {
    if (ready === null || isCommitDispatching.current) {
      return
    }

    const request: SwapRequestSnapshot = {
      action: 'swap',
      planId: params.planId,
      mealId: params.mealId,
      recipeVersionId: params.recipeVersionId,
      portionMultiplier: ready.preview.alternative.portionMultiplier,
      expectedPlanRevision: ready.preview.planRevision
    }

    // Minted at the press, never before it: a key survives only for a byte-identical replay, so a different
    // alternative or a moved revision gets its own. Whether it is used at all is the launch decision's, which
    // reads the persisted slot first — an unread slice, an attempt on the wire or another meal's unresolved key
    // each mean nothing may be recorded or sent (0.7.2).
    const launch = resolveSwapCommitLaunch({
      state: {pendingIntents},
      request,
      userId,
      isHydrated: hasHydratedIntents,
      isCommitInFlight,
      attemptedAt: Date.now(),
      freshKey: mintKey(uuidv4)
    })

    if (launch.kind === 'blocked') {
      // The CTA is drawn pending for 'hydrating' and 'inFlight' and the hold notice states 'otherResource', so
      // the refusal is already on screen; this only catches a press queued before that state arrived. What must
      // not happen is a second key recorded over an unresolved one.
      return
    }

    // Taken before the first await and released in `finally`: the reservation below suspends this handler while
    // no request is pending anywhere, so `isCommitInFlight` — a render value counted from the mutation cache —
    // reports false for that whole window and a second press would reach `commitSwap` with a key of its own.
    isCommitDispatching.current = true

    try {
      // Awaited, because the record is the whole reason a response lost in flight can be replayed: it has to be
      // ON THE DEVICE before the request leaves. Recording it and sending immediately — what this screen did —
      // raced its own storage write, and a kill in that window left the key nowhere, so the retry minted a
      // second one and swapped the meal twice (0.7.2).
      const reservation = launch.intent === null ? null : await recordPendingIntent(launch.intent)
      const dispatch = resolveSwapCommitDispatch(reservation, launch.isReplay)

      if (dispatch.kind === 'refused') {
        // Nothing is sent and nothing is navigated: a key the device never confirmed cannot reconcile a swap
        // the server may already have committed. A freshly minted key has been on no wire at all, so its record
        // goes rather than holding the one `swap` slot — and with it this meal's alternatives — behind an
        // attempt that never happened; a replayed key's record stays, because that request may have landed.
        if (!dispatch.retainsPendingIntent) {
          clearPendingIntent('swap')
        }

        // The CTA is still offered and the candidate is still on screen, so the refusal is reported the way
        // every other failure of this press is: said once, in place, and pressable again.
        showToast('error', dispatch.toast)

        return
      }

      await sendCommit(launch.payload)
    } finally {
      isCommitDispatching.current = false
    }
  }, [
    clearPendingIntent,
    hasHydratedIntents,
    isCommitInFlight,
    params.mealId,
    params.planId,
    params.recipeVersionId,
    pendingIntents,
    ready,
    recordPendingIntent,
    sendCommit,
    userId
  ])

  const onRetryPressed = useCallback(() => {
    refetchPreview()
    refetchDay()
  }, [refetchDay, refetchPreview])

  const onOpenRecipePressed = useCallback((): void => {
    // The route's revision, not the envelope's: recipe detail reads this candidate's planned figures out of the
    // preview cache, and the route's value is the one that cache entry is keyed by.
    navigation.navigate(Screens.RECIPE_DETAIL, {
      recipeVersionId: params.recipeVersionId,
      context: {
        kind: 'preview',
        planId: params.planId,
        mealId: params.mealId,
        date: params.date,
        candidateRecipeVersionId: params.recipeVersionId,
        planRevision: params.planRevision
      }
    })
  }, [navigation, params.date, params.mealId, params.planId, params.planRevision, params.recipeVersionId])

  // Skeleton reads its width as a number rather than from a style, so the width a bar stands in for is passed
  // in: the content column's for the title block, the cards' inner width for what sits inside a card.
  const placeholderBars = (heights: readonly number[], width: number): React.JSX.Element[] =>
    heights.map((height, index) => (
      <SkeletonBlock
        key={`${height}-${index}`}
        height={height}
        width={width}
        borderRadius={PLACEHOLDER_BAR_RADIUS}
        style={styles.skeletonBar}
      />
    ))

  // One accessible element for the whole shell, reporting busy: the bars underneath it say nothing a screen
  // reader can use, and hiding them without a status left this screen announcing nothing at all while it
  // loaded. `accessible` on the wrapper is what collapses them into it.
  const loadingBlock = (): React.JSX.Element => (
    <View accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL} accessibilityState={{busy: true}}>
      {/* The real title block, whose own row gap is the one the title and subtitle sit at. */}
      <View style={styles.titleBlock}>{placeholderBars(TITLE_PLACEHOLDER_HEIGHTS, placeholderWidth(windowWidth))}</View>

      <View style={styles.thisMealSection}>
        <View style={styles.skeletonStack}>
          {placeholderBars(THIS_MEAL_PLACEHOLDER_HEIGHTS, placeholderCardWidth(windowWidth))}
        </View>
      </View>

      <View style={styles.totalsCard}>
        <View style={styles.skeletonStack}>
          {placeholderBars(TOTALS_PLACEHOLDER_HEIGHTS, placeholderCardWidth(windowWidth))}
        </View>
      </View>
    </View>
  )

  const errorBlock = (): React.JSX.Element => (
    // The only thing on this screen that appears in response to a failure, so it is announced as one rather
    // than waiting to be found: the hero and the footer are both absent in this state, and a screen reader
    // would otherwise be left on a screen whose loading status simply stopped. `statusRole` is what announces
    // it — the banner groups its own title and body and speaks them on both platforms, so this wrapper
    // declares nothing and its "Try again" and "Back to alternatives" stay separately reachable.
    <View style={styles.errorBlock}>
      <InfoBanner
        tone="error"
        glyph="alert"
        title={MEAL_PLAN_LOAD_ERROR_TITLE}
        body={MEAL_PLAN_LOAD_ERROR_BODY}
        statusRole="alert"
        actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        onAction={onRetryPressed}
        secondaryActionLabel={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  /**
   * Why the commit is closed when the single `swap` slot is held by another plan or meal. A disabled CTA with
   * nothing said about it is indistinguishable from a broken screen, and this state lasts until that other key
   * is answered rather than for a moment.
   *
   * The copy names the wait rather than reusing the unconfirmed-outcome pair, because nothing the user did on
   * THIS meal has failed and there is nothing here for them to retry. No "Try again" is offered either — this
   * screen's mutation is bound to its own plan and meal, so the only honest move is back to the alternatives
   * while the owning screen replays that key. It takes the same `statusRole` as the failure above for the same
   * reason: it replaces the commit this screen was opened to make, and a closed CTA nobody announced is the
   * broken screen it reads as.
   */
  const foreignHoldBlock = (): React.JSX.Element => (
    <View style={styles.errorBlock}>
      <InfoBanner
        tone="error"
        glyph="alert"
        title={MEAL_PLAN_OTHER_MEAL_PENDING_TITLE}
        body={MEAL_PLAN_OTHER_MEAL_PENDING_BODY}
        statusRole="alert"
        secondaryActionLabel={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  const previewBlock = (loaded: NonNullable<typeof ready>): React.JSX.Element => {
    const {alternative, dayTotalsIfSwapped, targets, calorieDelta} = loaded.preview
    const delta = deriveCalorieDelta(calorieDelta)

    // The pill's own text leads with a mathematical minus sign, so the direction is spoken in words: colour and
    // that one glyph are otherwise the whole difference between a day that drops and a day that climbs.
    const deltaAccessibilityLabel = stringWithNamedParameters(
      delta?.tone === 'negative'
        ? SWAP_PREVIEW_DELTA_DOWN_ACCESSIBILITY_TEMPLATE
        : SWAP_PREVIEW_DELTA_UP_ACCESSIBILITY_TEMPLATE,
      {calories: formatCalories(Math.abs(calorieDelta))}
    )

    const ingredients = resolvePreviewIngredients(
      alternative.recipe.ingredients,
      alternative.portionMultiplier,
      alternative.recipe.yieldServings
    )

    // The day's figure and the target it is measured against are one fact drawn as two text nodes, so they are
    // announced as one stop. Composed from the same two strings the row draws, so what is spoken and what is
    // on screen cannot disagree about which day total this is.
    const totalsFigure = formatCalories(dayTotalsIfSwapped.calories)
    const totalsUnit = stringWithNamedParameters(SWAP_PREVIEW_OF_TARGET_TEMPLATE, {
      calories: formatCalories(targets.calories)
    })

    return (
      <>
        <View style={styles.titleBlock}>
          <Text style={styles.title} accessibilityRole="header">
            {alternative.recipe.name}
          </Text>

          <Text style={styles.subtitle}>
            {formatPreviewSubtitle(alternative.portionText, alternative.recipe.totalMinutes)}
          </Text>
        </View>

        <View style={styles.thisMealSection}>
          <SectionOverline text={SWAP_PREVIEW_THIS_MEAL_LABEL} isHeading />

          <MetricGrid4 items={buildThisMealMetrics(alternative.nutrition)} />
        </View>

        <Text style={styles.provenanceCaption}>{RECIPE_NUTRITION_METHOD_CAPTION}</Text>

        <View style={styles.totalsCard}>
          <View style={styles.totalsHeaderRow}>
            <Text style={styles.totalsOverline}>
              {stringWithNamedParameters(SWAP_PREVIEW_DAY_TOTAL_TEMPLATE, {day: dayName})}
            </Text>

            {delta !== null && (
              <View accessible accessibilityLabel={deltaAccessibilityLabel}>
                <DeltaPill text={delta.text} tone={delta.tone} />
              </View>
            )}
          </View>

          <View
            style={styles.totalsFigureRow}
            accessible
            accessibilityLabel={composeAccessibleName([totalsFigure, totalsUnit])}>
            <BigNumberRow size="stat" figure={totalsFigure} unit={totalsUnit} />
          </View>

          <View style={styles.totalsBar}>
            <CalorieProgressBar
              ratio={calorieProgressRatio(dayTotalsIfSwapped.calories, targets.calories)}
              totalCalories={dayTotalsIfSwapped.calories}
              targetCalories={targets.calories}
            />
          </View>

          <View style={styles.legendBlock}>
            {buildSwapMacroLegend(dayTotalsIfSwapped, targets).map((item, index) => (
              <MacroLegendRow
                key={item.key}
                label={MEAL_PLAN_MACRO_LABELS[item.key]}
                valueText={item.valueText}
                dotColor={MACRO_DOT_COLORS[item.key]}
                isFirst={index === 0}
              />
            ))}
          </View>
        </View>

        <View style={styles.ingredientsSection}>
          <Text style={styles.ingredientsHeading}>{RECIPE_DETAIL_INGREDIENTS_HEADER}</Text>

          <View style={styles.ingredientsList}>
            {/* An ingredient and its quantity are one fact, and read ungrouped they are two stops with nothing
                tying them together — the same rows already read as one stop on the recipe screen, whose list
                wrapper is `accessible`. The wrapper carries no style because the row inside it stretches, so
                the list's own row gap and every row's geometry are unchanged. */}
            {ingredients.map(ingredient => (
              <View
                key={ingredient.key}
                accessible
                accessibilityLabel={composeAccessibleName([ingredient.name, ingredient.quantityText])}>
                <IngredientRow name={ingredient.name} quantityText={ingredient.quantityText} />
              </View>
            ))}
          </View>
        </View>
      </>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* The band's pending variant rather than a bare `Skeleton`: the hero owns this route's only back
            control — no header, no tab bar — so a placeholder that replaced the whole band left a read that can
            run to the request timeout with no way out, on screen or through a screen reader. It also keeps the
            13b hero's 180px full-bleed band in place, so no row moves when the real hero arrives (AAP 0.2.5:
            the loading Skeletons sit UNDER the hero). Recipe detail's loading state resolves this the same way.
            Outside `ContentColumn` for the same reason the hero itself is: the band spans the window, and only
            the rows below it take the gutter. */}
        {isShellLoading && <RecipeHero variant="pending" width={windowWidth} onBack={navigation.goBack} />}

        {/* The hero opens the recipe through its own content pressable, so the back button it draws stays a
            sibling of that pressable rather than a control nested inside one. */}
        {ready !== null && (
          <RecipeHero
            size="preview"
            iconKey={ready.preview.alternative.recipe.iconKey}
            contextText={formatReplacingContext(ready.meal.slot, params.date)}
            onBack={navigation.goBack}
            onPress={onOpenRecipePressed}
            accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE, {
              recipe: ready.preview.alternative.recipe.name
            })}
          />
        )}

        <ContentColumn>
          {/* The ineligible refusal keeps the loading shape until the effect above pops the screen: its recovery
              is the toast, so drawing the generic "couldn't load" card and its retry would state the wrong cause
              for the one frame this screen has left. */}
          {ready === null && (isShellLoading ? loadingBlock() : errorBlock())}

          {ready !== null && showsForeignHoldNotice && foreignHoldBlock()}

          {ready !== null && previewBlock(ready)}
        </ContentColumn>
      </ScrollView>

      {ready !== null && (
        <SetupFooter hairline>
          <PrimaryButton
            label={SWAP_USE_THIS_MEAL_BUTTON_TEXT}
            isLoading={isCommitPending}
            disabled={isCommitDisabled}
            onPress={onUseThisMealPressed}
          />

          <TertiaryTextButton
            label={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
            disabled={swapMutation.isPending}
            onPress={navigation.goBack}
          />
        </SetupFooter>
      )}
    </View>
  )
}

export default SwapPreviewScreen
