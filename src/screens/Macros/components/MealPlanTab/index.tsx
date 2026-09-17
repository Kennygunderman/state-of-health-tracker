import React, {ReactNode, useCallback, useContext, useEffect, useMemo, useState} from 'react'

import {AccessibilityInfo, LayoutChangeEvent, Platform, TouchableOpacity, useWindowDimensions, View} from 'react-native'

import {LoggedPlannedEntry, MealPlan, MealPlanDay, MealPlanMeal} from '@data/models/MealPlan'
import {useMealPlanEntitlement} from '@hooks/mealPlanning/useMealPlanEntitlement'
import {useSetupResumeNavigation} from '@hooks/mealPlanning/useSetupResumeNavigation'
import {Navigation} from '@navigation/types'
import {mutationKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useLogPlannedMealMutation} from '@queries/mealPlanning/useLogPlannedMealMutation'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {BottomTabBarHeightContext} from '@react-navigation/bottom-tabs'
import {useIsFocused, useNavigation} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {useSessionStore} from '@store/session/useSessionStore'
import BorderRadius from '@styles/borderRadius'
import FontSize, {LineHeight} from '@styles/fontSize'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {useIsMutating, useMutationState} from '@tanstack/react-query'
import {isPlanStateError, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {formatIsoDayMonthDay} from '@utility/DateUtility'
import {
  addDaysToDayKey,
  formatPlanDayLabel,
  formatPlanRange,
  parseDayKey,
  planDates
} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroPair} from '@utility/NutritionFormatUtility'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import InfoBanner from '@components/InfoBanner'
import SectionOverline from '@components/SectionOverline'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MACROS_TITLE,
  MEAL_PLAN_DAY_TARGET_TEMPLATE,
  MEAL_PLAN_EMPTY_BODY,
  MEAL_PLAN_EMPTY_TITLE,
  MEAL_PLAN_GO_TO_DIARY_BUTTON_TEXT,
  MEAL_PLAN_LAST_DAY_TITLE,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MEAL_COUNT_TEMPLATE,
  MEAL_PLAN_NEXT_WEEK_LINK_TEXT,
  MEAL_PLAN_OFFLINE_BANNER_TEXT,
  MEAL_PLAN_PLAN_ANOTHER_WEEK_BUTTON_TEXT,
  MEAL_PLAN_PLANNED_FOR_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TARGETS_STALE_CAPTION,
  MEAL_PLAN_THIS_WEEK_LINK_TEXT,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNAVAILABLE_TEXT,
  MEAL_PLAN_VIEW_DIARY_LINK_TEXT,
  MEAL_PLAN_VIEW_NEXT_WEEK_BUTTON_TEXT,
  PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import DayStrip from './components/DayStrip'
import EmptyPlanState from './components/EmptyPlanState'
import LastDayCard from './components/LastDayCard'
import MealPlanCard from './components/MealPlanCard'
import PlanHeader from './components/PlanHeader'
import PlannedTotalsCard from './components/PlannedTotalsCard'
import PlanSettingsRow from './components/PlanSettingsRow'
import styles, {emptyRegion} from './index.styled'
import {
  arePlanActionsOffered,
  buildMealCardModels,
  EmptyPlanCta,
  flexItemWidth,
  formatPostLogBannerBody,
  InPlaceWriteAction,
  isKeyedWriteHeldByAnotherMeal,
  isPostLogBannerVisible,
  isStalePlanError,
  LastDayAction,
  MealCardModel,
  planDayWeekdayName,
  PlanSwitchLink,
  resolveEmptyPlanCtaLabel,
  resolveFrameOutcome,
  resolveHandoffLatch,
  resolveLastDayAction,
  resolveLogOwnership,
  resolveMealPlanBody,
  resolveMealPlanDaySection,
  resolvePendingGeneration,
  resolvePlanSwitchLink,
  resolvePostLogBannerOrigin,
  resolveSelectedPlanDate,
  resolveStalePlanSelection,
  resolveSwapOwnership,
  resolveTabFrame,
  resolveViewTarget
} from './index.util'

// The day query is scoped to a plan and this tab renders four states that have none. The empty id is never
// sent: it is paired with the disabled gate below, so no request is issued without a plan to read.
const NO_PLAN_ID = ''

// The same for the two replay mutations, which are addressed by plan and meal. A mutation fires nothing until
// something calls `mutate`, and the only caller is the replay path — which runs only with an intent in hand,
// so these stand-ins are never on the wire.
const NO_MEAL_ID = ''

const NEXT_WEEK_OFFSET_DAYS = 1

const SKELETON_OVERLINE_WIDTH_RATIO = 0.4

const SKELETON_TITLE_WIDTH_RATIO = 0.6

const SKELETON_LABEL_WIDTH_RATIO = 0.5

const SKELETON_VALUE_WIDTH_RATIO = 0.25

const SKELETON_TOTALS_ROW_KEYS: number[] = [0, 1, 2]

const SKELETON_MEAL_ROW_KEYS: number[] = [0, 1]

const SKELETON_MEAL_CARD_KEYS: number[] = [0, 1]

const CARD_INSET_SIDES = 2

const PLAN_SWITCH_HIT_SLOP = Math.ceil((Sizes.TOUCH_TARGET - FontSize.LABEL) / 2)

const RETRY_PILL_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

// The bottom padding the host Macros screen puts on its scroll content. Subtracted from the measured
// remainder so filling it leaves the empty state centred rather than scrollable by that padding.
const HOST_SCROLL_BOTTOM_PADDING = Spacing.X_LARGE

const NO_DAY_KEYS: string[] = []

const NO_MEAL_CARDS: MealCardModel[] = []

interface Props {
  segmentedControl: ReactNode
}

const MealPlanTab = ({segmentedControl}: Props): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {resumeSetup} = useSetupResumeNavigation()

  // Whether this tab is the route on screen, which is what keeps the generation handoff below from firing
  // while the Generating screen is already open above it or the user is looking at another tab.
  const isFocused = useIsFocused()

  const userId = useAuthStore(state => state.userId)
  const isGeneratePending = useIsMutating({mutationKey: mutationKeys.generatePlan}) > 0
  const isRegeneratePending = useIsMutating({mutationKey: mutationKeys.regeneratePlan}) > 0
  // Counted across every instance of these mutations, this tab's own included, which is what keeps the tab and
  // the write's own screen from ever sending one key at the same time.
  const isSwapPending = useIsMutating({mutationKey: mutationKeys.swapMeal}) > 0
  const isLogPending = useIsMutating({mutationKey: mutationKeys.logPlannedMeal}) > 0

  const {availability, isGatedRequestAllowed} = useMealPlanEntitlement()
  // The app's own 'today', re-evaluated on every foreground, which is what makes the rollover refetch fire.
  // Never written from here.
  const sessionDayKey = useSessionStore(state => state.sessionStartDateIso)

  // Gated on the flag the entitlement hook reads, so these observers share its query instances rather than
  // splitting each read in two with conflicting enablement.
  const preferencesQuery = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const currentPlanQuery = useCurrentMealPlanQuery(isGatedRequestAllowed, sessionDayKey)

  // Read through the store hook, not getState(): the persisted intents arrive from AsyncStorage after the
  // first frame, so this tab has to re-render when the slice and its hydration state land.
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  // The three-state read rather than `hasHydratedIntents`, because this tab draws the difference: a refused
  // read leaves what is stored unknown and has to offer the retry that is the only way out of it.
  const intentsHydration = useMealPlanStore(state => state.intentsHydration)
  const selectedPlanId = useMealPlanStore(state => state.selectedPlanId)
  const selectedPlanDate = useMealPlanStore(state => state.selectedPlanDate)
  const postLogResult = useMealPlanStore(state => state.postLogResult)
  const dismissedSuccessBannerFor = useMealPlanStore(state => state.dismissedSuccessBannerFor)
  const setSelectedPlanId = useMealPlanStore(state => state.setSelectedPlanId)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const dismissSuccessBanner = useMealPlanStore(state => state.dismissSuccessBanner)
  const clearPostLogResult = useMealPlanStore(state => state.clearPostLogResult)
  const retryIntentsHydration = useMealPlanStore(state => state.retryIntentsHydration)

  // The newest successful swap, read from the shared mutation cache rather than from the swap hook, which
  // this tab does not own. Success only: a swap that failed or lost its answer changed nothing the post-log
  // confirmation was describing, so it must not retire it.
  const swapSuccessTimes = useMutationState({
    filters: {mutationKey: mutationKeys.swapMeal, status: 'success'},
    select: mutation => mutation.state.submittedAt
  })
  const lastSwapSucceededAt = swapSuccessTimes.reduce((latest, at) => (at > latest ? at : latest), 0)

  const {height: windowHeight} = useWindowDimensions()
  const safeAreaInsets = useSafeAreaInsets()
  // Read through the context rather than the hook so this tab still renders outside a tab navigator, where the
  // hook throws; the scene is laid out above the bar, so the window height includes it.
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0

  const [columnWidth, setColumnWidth] = useState(0)
  const [emptyRegionTop, setEmptyRegionTop] = useState(0)

  // The generation key this tab has handed to the Generating screen for the handoff it is holding. State
  // rather than a ref because the body renders the placeholder until the handoff is taken, so taking the latch
  // has to re-render; it is released when focus is lost, which is when that handoff has been taken.
  const [navigatedGenerationKey, setNavigatedGenerationKey] = useState<string | null>(null)
  // The swap and log keys this tab has already sent. One replay per key, whatever else re-renders this tab.
  const [replayedSwapKey, setReplayedSwapKey] = useState<string | null>(null)
  const [replayedLogKey, setReplayedLogKey] = useState<string | null>(null)

  // One reading of the clock per render, shared by all three intent decisions below so they cannot disagree
  // about which records are still within their 7-day life.
  const now = Date.now()

  const plans = currentPlanQuery.data
  const planOutcome = resolveMealPlanBody({
    availability,
    preferences: preferencesQuery.data,
    preferencesError: preferencesQuery.error,
    plans,
    currentPlanError: currentPlanQuery.error,
    isLoading: preferencesQuery.isLoading || currentPlanQuery.isLoading,
    selectedPlanId
  })

  /**
   * AAP 0.7.2: this tab is the cold-start owner of an unresolved generation. Navigation state is not
   * persisted, so once the Generating route is gone nothing else would ever ask again for a plan the request
   * may already have committed — the tab reopens that screen with the stored key and the stored snapshot.
   *
   * The signed-in account scopes the lookup (a record minted by a previous account is nobody's to replay),
   * focus keeps the handoff from firing while Generating is already on top of this tab or the user is in
   * another tab, and the in-flight gate keeps it from racing an attempt already on the wire.
   */
  const generation = resolvePendingGeneration({
    intents: {pendingIntents},
    userId,
    now,
    intentsHydration,
    isHandoffAllowed: isFocused && availability === 'enabled' && planOutcome.kind !== 'loading',
    isGenerationInFlight: isGeneratePending || isRegeneratePending,
    navigatedKey: navigatedGenerationKey,
    plans,
    todayDayKey: sessionDayKey
  })

  /**
   * AAP 0.7.2 also names this tab the cold-start owner of the two keyed writes that have no screen to
   * reconstruct: a swap or a planned log whose response was lost is replayed here silently, under the stored
   * key and from the stored body, before the tab offers a write of its own.
   *
   * The gate is the same one the handoff uses — the persisted slice read, an account known, this tab focused
   * and the feature available — plus the per-action in-flight count, which is what stops this tab and the
   * write's own screen from ever putting one key on the wire twice.
   */
  const inPlaceWriteGate = {
    intents: {pendingIntents},
    userId,
    now,
    intentsHydration,
    isReplayAllowed: isFocused && availability === 'enabled'
  }

  const swapOwnership = resolveSwapOwnership({
    ...inPlaceWriteGate,
    isRequestInFlight: isSwapPending,
    replayedKey: replayedSwapKey
  })

  const logOwnership = resolveLogOwnership({
    ...inPlaceWriteGate,
    isRequestInFlight: isLogPending,
    replayedKey: replayedLogKey
  })

  // Addressed from the STORED record, so a replay commits against the meal the user acted on rather than the
  // one on screen. Both instances exist on every render — a mutation sends nothing until `mutate` is called —
  // which is what keeps the hook order stable while the records come and go.
  const swapReplayMutation = useSwapMealMutation(
    swapOwnership.intent?.planId ?? NO_PLAN_ID,
    swapOwnership.intent?.mealId ?? NO_MEAL_ID
  )
  const logReplayMutation = useLogPlannedMealMutation(
    logOwnership.intent?.planId ?? NO_PLAN_ID,
    logOwnership.intent?.mealId ?? NO_MEAL_ID
  )

  const frame = resolveTabFrame(planOutcome, generation.outcome)
  // The body outcome the header and the body block are drawn from. A withheld frame borrows the first-load
  // placeholder, and a refused persisted read borrows the inline retry card — neither draws a plan, a setup
  // call to action or a write control while an unresolved keyed write may exist (0.7.2).
  const outcome = resolveFrameOutcome(frame)
  const handoffParams = generation.outcome.kind === 'handoff' ? generation.outcome.params : null
  const handoffLatch = generation.navigatedKey
  const settledGeneration = generation.outcome.kind === 'settled' ? generation.outcome : null
  const settledAction = settledGeneration?.action ?? null
  const settledPlanId = settledGeneration?.planId ?? null

  useEffect(() => {
    if (handoffParams === null) {
      return
    }

    setNavigatedGenerationKey(handoffLatch)
    navigation.navigate(Screens.MEAL_PLAN_GENERATING, handoffParams)
  }, [handoffLatch, handoffParams, navigation])

  /**
   * The latch belongs to the handoff, not to this component's lifetime. Losing focus is the moment the handoff
   * has been taken — the Generating screen is now the route on screen — so the latch is released there, and a
   * return to an intent that is still unresolved reconstructs its owner again instead of drawing the plan
   * surfaces, with their Swap and Log controls, over a key nobody owns (0.7.2).
   */
  useEffect(() => {
    setNavigatedGenerationKey(latch => resolveHandoffLatch(latch, isFocused))
  }, [isFocused])

  /**
   * The one resolution a READ may reach: a returned plan carries the pending `generationKey`, so the server
   * has answered that key (AAP 0.2.5) and the record is retired here rather than filtered away on every
   * render. Retiring it is what frees the action's single slot — an unretired record makes the launch path
   * hand its superseded request back to this tab, which filters it again, so the user could not regenerate
   * until the 7-day expiry.
   *
   * The selection is set alongside it because the plan that key produced is the one the user asked for, and
   * the two writes land in a single React commit before the body leaves the placeholder frame above.
   */
  useEffect(() => {
    if (settledAction === null || settledPlanId === null) {
      return
    }

    setSelectedPlanId(settledPlanId)
    clearPendingIntent(settledAction)
  }, [clearPendingIntent, setSelectedPlanId, settledAction, settledPlanId])

  // Taken from the outcome rather than resolved a second time, so the plan the body renders and the plan the
  // day query, the header and every route parameter are built from cannot diverge.
  const plan = outcome.kind === 'plan' ? outcome.plan : null
  const planId = plan?.id ?? null
  const sessionDate = useMemo(() => parseDayKey(sessionDayKey), [sessionDayKey])
  const selectedDayKey = plan === null ? sessionDayKey : resolveSelectedPlanDate(plan, selectedPlanDate, sessionDate)

  const dayQuery = useMealPlanDayQuery(planId ?? NO_PLAN_ID, selectedDayKey, plan !== null && isGatedRequestAllowed)

  const envelope = dayQuery.data ?? null
  const daySection =
    plan === null ? null : resolveMealPlanDaySection({plan, selectedDayKey, envelope, dayError: dayQuery.error})
  const day = daySection?.kind === 'day' ? daySection.day : null

  // A record for either in-place write withholds both controls on every OTHER meal: the single slot per action
  // must not be replaceable while its key is unanswered (0.7.2). The meal the record names keeps its controls,
  // because its own screen is where the unconfirmed outcome is drawn and where "Try again" replays that key
  // (0.2.5) — see `isKeyedWriteHeldByAnotherMeal`.
  const unresolvedInPlaceWrites = useMemo(
    () => [swapOwnership.intent, logOwnership.intent],
    [logOwnership.intent, swapOwnership.intent]
  )

  const isDayWritable = envelope?.isWritable

  // Per meal rather than per screen, and memoised because every card reads it: the meal a record names keeps
  // its controls, and every other meal loses them until that record is retired.
  const areWriteActionsEnabledFor = useCallback(
    (mealId: string): boolean =>
      arePlanActionsOffered(
        outcome,
        isDayWritable,
        isKeyedWriteHeldByAnotherMeal(unresolvedInPlaceWrites, planId ?? NO_PLAN_ID, mealId)
      ),
    [isDayWritable, outcome, planId, unresolvedInPlaceWrites]
  )

  // The refusal itself, as opposed to a verdict that has not arrived or a plan restored from the cache: only
  // this one has something true to tell the user when a control is pressed.
  const isWriteRefused = isDayWritable === false

  const planSwitchLink = plan === null ? null : resolvePlanSwitchLink(plans, selectedPlanId)
  const lastDayAction = plan === null ? null : resolveLastDayAction(plans, selectedPlanId, selectedDayKey)

  const [bannerOrigin, setBannerOrigin] = useState<ReturnType<typeof resolvePostLogBannerOrigin>>(null)
  // Adjusted during render rather than in an effect: the banner stands where the totals card does, so an
  // origin settled after paint costs one frame of the wrong day's success. The resolver returns the same
  // object when nothing changed, which is what ends the adjustment after a single pass.
  const nextBannerOrigin = resolvePostLogBannerOrigin(bannerOrigin, postLogResult, planId, lastSwapSucceededAt)

  if (nextBannerOrigin !== bannerOrigin) {
    setBannerOrigin(nextBannerOrigin)
  }

  const isSuccessBannerVisible = isPostLogBannerVisible({
    result: postLogResult,
    origin: nextBannerOrigin,
    dismissedEntryId: dismissedSuccessBannerFor,
    planId,
    selectedDayKey,
    lastSwapSucceededAt
  })

  const isDayReadFailed = daySection?.kind === 'error' || (daySection?.kind === 'day' && daySection.hasFailedRead)

  const refetchCurrentPlan = currentPlanQuery.refetch
  const refetchPreferences = preferencesQuery.refetch
  const refetchDay = dayQuery.refetch

  const recoverFromStalePlan = useCallback((): void => {
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [refetchCurrentPlan])

  /**
   * The silent same-key attempt both in-place replays make, and the only place their records are retired.
   *
   * `mutateAsync` is awaited rather than fired and forgotten so the continuation runs even if the user leaves
   * this segment mid-flight — the store action it calls is not component state, which is what makes that safe.
   *
   * What clears the record is an answer to its own key (AAP 0.2.5). A commit or a stored replay answers it, so
   * it goes. A CONFIRMED failure is the server describing this key's fate and is terminal, so it goes too —
   * and a plan the server will no longer read or write earns the stale-plan toast and refetch the AAP asks for
   * (0.7.2). An UNKNOWN outcome answers nothing: the write may have committed before the response was lost, so
   * the key stays on record as the only safe way to ask again, and the next launch owns it once more.
   */
  const replayKeyedWrite = useCallback(
    async (action: InPlaceWriteAction, send: () => Promise<unknown>): Promise<void> => {
      try {
        await send()
        clearPendingIntent(action)
      } catch (error) {
        if (isUnknownOutcome(error)) {
          return
        }

        clearPendingIntent(action)

        if (isPlanStateError(error)) {
          recoverFromStalePlan()
        }
      }
    },
    [clearPendingIntent, recoverFromStalePlan]
  )

  const swapReplayPayload = swapOwnership.payload
  const swapReplayLatch = swapOwnership.replayedKey
  const sendSwapReplay = swapReplayMutation.mutateAsync

  useEffect(() => {
    if (swapReplayPayload === null) {
      return
    }

    setReplayedSwapKey(swapReplayLatch)
    replayKeyedWrite('swap', () => sendSwapReplay(swapReplayPayload))
  }, [replayKeyedWrite, sendSwapReplay, swapReplayLatch, swapReplayPayload])

  const logReplayPayload = logOwnership.payload
  const logReplayLatch = logOwnership.replayedKey
  const sendLogReplay = logReplayMutation.mutateAsync

  useEffect(() => {
    if (logReplayPayload === null) {
      return
    }

    setReplayedLogKey(logReplayLatch)
    replayKeyedWrite('log', () => sendLogReplay(logReplayPayload))
  }, [logReplayLatch, logReplayPayload, replayKeyedWrite, sendLogReplay])

  // Whichever read surfaced it, the plan the screen holds has been contradicted, so the recovery is the same.
  // The error's own identity is the effect's key, and it only changes when a further read fails.
  const stalePlanReadError = [currentPlanQuery.error, preferencesQuery.error, dayQuery.error].find(isStalePlanError)

  useEffect(() => {
    if (stalePlanReadError === undefined) {
      return
    }

    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [refetchCurrentPlan, stalePlanReadError])

  useEffect(() => {
    const resolvedPlanId = resolveStalePlanSelection(plans, selectedPlanId)

    if (resolvedPlanId !== selectedPlanId) {
      setSelectedPlanId(resolvedPlanId)
    }
  }, [plans, selectedPlanId, setSelectedPlanId])

  // Visibility is decided at render; this only retires the payload once it can no longer be shown. Gated on a
  // known plan id, because "no plan yet" is indistinguishable from "a different plan" until the week's read
  // answers, and clearing on the former would discard a confirmation that was about to become visible.
  useEffect(() => {
    if (postLogResult === null) {
      return
    }

    if (planId !== null && !isSuccessBannerVisible) {
      clearPostLogResult()
    }
  }, [clearPostLogResult, isSuccessBannerVisible, planId, postLogResult])

  // Leaving the segment unmounts this tab, the last of the ways the banner ends.
  useEffect(() => clearPostLogResult, [clearPostLogResult])

  const bannerBody =
    isSuccessBannerVisible && postLogResult !== null
      ? formatPostLogBannerBody(postLogResult.dateIso, postLogResult.slotLabel, sessionDayKey)
      : null
  const announcement = outcome.kind === 'error' || isDayReadFailed ? MEAL_PLAN_LOAD_ERROR_TITLE : bannerBody

  // The blocks below carry a polite live region, which Android announces on its own; iOS does not, so it is
  // announced here and only there, so neither platform says it twice.
  useEffect(() => {
    if (announcement !== null && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(announcement)
    }
  }, [announcement])

  const onColumnLayout = (event: LayoutChangeEvent): void => setColumnWidth(event.nativeEvent.layout.width)

  const onEmptyRegionLayout = (event: LayoutChangeEvent): void => setEmptyRegionTop(event.nativeEvent.layout.y)

  const onEmptyPrimaryPressed = (cta: EmptyPlanCta): void => {
    if (cta === 'create') {
      navigation.navigate(Screens.MEAL_PLAN_INTRO)

      return
    }

    if (cta === 'continueSetupStep') {
      resumeSetup(preferencesQuery.data?.setupStep ?? null, preferencesQuery.data?.setupStatus)

      return
    }

    if (cta === 'continueSetupReview') {
      navigation.navigate(Screens.MEAL_PLAN_TARGETS, {mode: 'setup'})

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_TARGETS, {mode: 'nextWeek', startDate: sessionDayKey})
  }

  const onGoToDiaryPressed = (): void => setMacrosSegment('diary')

  /**
   * Everything the inline retry card can ask again for: the two reads behind the plan state and — when the
   * persisted intent slice is what failed — storage itself. `retryIntentsHydration` is a no-op unless that
   * read was refused, so one handler serves both failures and the card never has to guess which it is drawn
   * for (a refused intents read resolves to the same `error` outcome, per `resolveFrameOutcome`).
   */
  const onRetryPlanReadPressed = (): void => {
    retryIntentsHydration()
    refetchPreferences()
    refetchCurrentPlan()
  }

  const onRetryDayReadPressed = (): void => {
    refetchDay()
  }

  const onGroceryPressed = useCallback((): void => {
    if (planId === null) {
      return
    }

    navigation.navigate(Screens.GROCERY_LIST, {planId})
  }, [navigation, planId])

  const onPlanSettingsPressed = useCallback((): void => {
    if (planId === null) {
      return
    }

    navigation.navigate(Screens.PLAN_SETTINGS, {planId})
  }, [navigation, planId])

  const onPlanSwitchPressed = (link: PlanSwitchLink): void => {
    const target = link === 'next' ? plans?.upcoming : plans?.current

    if (target === null || target === undefined) {
      return
    }

    setSelectedPlanId(target.id)
  }

  const onLastDayActionPressed = (action: LastDayAction): void => {
    if (plan === null) {
      return
    }

    if (action === 'viewNextWeek') {
      const upcoming = plans?.upcoming ?? null

      if (upcoming !== null) {
        setSelectedPlanId(upcoming.id)
      }

      return
    }

    navigation.navigate(Screens.MEAL_PLAN_TARGETS, {
      mode: 'nextWeek',
      startDate: addDaysToDayKey(plan.endDate, NEXT_WEEK_OFFSET_DAYS)
    })
  }

  const onOpenRecipePressed = useCallback(
    (meal: MealPlanMeal): void => {
      if (planId === null) {
        return
      }

      navigation.navigate(Screens.RECIPE_DETAIL, {
        recipeVersionId: meal.recipe.versionId,
        context: {kind: 'plan', planId, mealId: meal.id, date: selectedDayKey}
      })
    },
    [navigation, planId, selectedDayKey]
  )

  // A refused plan earns the stale-plan recovery rather than a control that silently does nothing; an
  // unanswered verdict earns only the dimming, because there is nothing true to say about it yet.
  const onWriteActionPressed = useCallback(
    (route: typeof Screens.LOG_PLANNED_MEAL | typeof Screens.SWAP_MEAL, meal: MealPlanMeal): void => {
      if (planId === null || envelope === null) {
        return
      }

      if (!areWriteActionsEnabledFor(meal.id)) {
        if (isWriteRefused) {
          recoverFromStalePlan()
        }

        return
      }

      const routeParams = {
        planId,
        mealId: meal.id,
        date: selectedDayKey,
        // The revision the day was read at, which is what the destination pins its write to.
        planRevision: envelope.planRevision
      }

      if (route === Screens.SWAP_MEAL) {
        navigation.navigate(Screens.SWAP_MEAL, routeParams)

        return
      }

      navigation.navigate(Screens.LOG_PLANNED_MEAL, routeParams)
    },
    [areWriteActionsEnabledFor, envelope, isWriteRefused, navigation, planId, recoverFromStalePlan, selectedDayKey]
  )

  const onSwapPressed = useCallback(
    (meal: MealPlanMeal): void => onWriteActionPressed(Screens.SWAP_MEAL, meal),
    [onWriteActionPressed]
  )

  const onLogPressed = useCallback(
    (meal: MealPlanMeal): void => onWriteActionPressed(Screens.LOG_PLANNED_MEAL, meal),
    [onWriteActionPressed]
  )

  // Switching segments is the whole answer for today: no row is scrolled to or highlighted, which would put
  // the shipped Diary list in scope.
  const onViewEntryPressed = useCallback(
    (entry: LoggedPlannedEntry): void => {
      if (resolveViewTarget(entry.date, sessionDayKey) === 'diary') {
        setMacrosSegment('diary')

        return
      }

      navigation.navigate(Screens.MACROS_HISTORY)
    },
    [navigation, sessionDayKey, setMacrosSegment]
  )

  const onBannerViewDiaryPressed = (): void => {
    if (postLogResult === null) {
      return
    }

    dismissSuccessBanner(postLogResult.entryId)

    // Resolved now rather than when the entry was written: across midnight the destination the banner names
    // and the one it opens would otherwise disagree.
    if (resolveViewTarget(postLogResult.dateIso, sessionDayKey) === 'diary') {
      setMacrosSegment('diary')

      return
    }

    navigation.navigate(Screens.MACROS_HISTORY)
  }

  const planDayKeys = useMemo(() => (plan === null ? NO_DAY_KEYS : planDates(plan.startDate)), [plan])

  const skeletonDayKeys = useMemo(() => planDates(sessionDayKey), [sessionDayKey])

  const mealCardModels = useMemo(() => (day === null ? NO_MEAL_CARDS : buildMealCardModels(day)), [day])

  const totalsLegend = useMemo(
    () =>
      plan === null || day === null
        ? []
        : [
            {
              label: MEAL_PLAN_MACRO_LABELS.protein,
              valueText: formatMacroPair(day.plannedTotals.protein, plan.targets.protein),
              dotColor: Theme.colors.accentGreen
            },
            {
              label: MEAL_PLAN_MACRO_LABELS.carbs,
              valueText: formatMacroPair(day.plannedTotals.carbs, plan.targets.carbs),
              dotColor: Theme.colors.teal
            },
            {
              label: MEAL_PLAN_MACRO_LABELS.fat,
              valueText: formatMacroPair(day.plannedTotals.fat, plan.targets.fat),
              dotColor: Theme.colors.lime
            }
          ],
    [day, plan]
  )

  const skeletonHeaderBlock = (): React.JSX.Element => (
    <View style={styles.skeletonHeaderRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {columnWidth > 0 && (
        <>
          <SkeletonBlock
            height={Sizes.SKELETON_BAR_SM}
            // Skeleton takes a number and sizes its shimmer sweep from it, so the measured column width is what
            // the animation has to match.
            width={columnWidth * SKELETON_OVERLINE_WIDTH_RATIO}
            borderRadius={BorderRadius.BAR}
          />

          <SkeletonBlock
            height={LineHeight.SCREEN_TITLE}
            width={columnWidth * SKELETON_TITLE_WIDTH_RATIO}
            borderRadius={BorderRadius.TILE}
          />
        </>
      )}
    </View>
  )

  const macrosHeaderBlock = (): React.JSX.Element => (
    <View style={styles.macrosHeader}>
      <SectionOverline text={formatIsoDayMonthDay(sessionDayKey)} tone="green" />

      <Text style={styles.screenTitle}>{MACROS_TITLE}</Text>
    </View>
  )

  const headerBlock = (): React.JSX.Element => {
    if (outcome.kind === 'plan') {
      return (
        <PlanHeader
          rangeText={formatPlanRange(outcome.plan.startDate, outcome.plan.endDate)}
          onGroceryPressed={onGroceryPressed}
        />
      )
    }

    if (outcome.kind === 'loading') {
      return skeletonHeaderBlock()
    }

    return macrosHeaderBlock()
  }

  const planSwitchBlock = (link: PlanSwitchLink): React.JSX.Element => (
    <View style={styles.planSwitchRow}>
      <TouchableOpacity
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={link === 'next' ? MEAL_PLAN_NEXT_WEEK_LINK_TEXT : MEAL_PLAN_THIS_WEEK_LINK_TEXT}
        hitSlop={PLAN_SWITCH_HIT_SLOP}
        onPress={() => onPlanSwitchPressed(link)}>
        <Text style={styles.planSwitchLink}>
          {link === 'next' ? MEAL_PLAN_NEXT_WEEK_LINK_TEXT : MEAL_PLAN_THIS_WEEK_LINK_TEXT}
        </Text>
      </TouchableOpacity>
    </View>
  )

  const skeletonCardBlock = (cardKey: string, rowKeys: number[]): React.JSX.Element => {
    const innerWidth = columnWidth - Spacing.GUTTER * CARD_INSET_SIDES

    return (
      <View key={cardKey} style={styles.skeletonCard}>
        {rowKeys.map(rowKey => (
          <View key={rowKey} style={styles.skeletonRow}>
            <SkeletonBlock
              height={Sizes.SKELETON_BAR}
              width={innerWidth * SKELETON_LABEL_WIDTH_RATIO}
              borderRadius={BorderRadius.BAR}
            />

            <SkeletonBlock
              height={Sizes.SKELETON_BAR_SM}
              width={innerWidth * SKELETON_VALUE_WIDTH_RATIO}
              borderRadius={BorderRadius.BAR}
            />
          </View>
        ))}
      </View>
    )
  }

  const dayPlaceholderBlock = (): React.JSX.Element => (
    <View accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
      {columnWidth > 0 && (
        <>
          {skeletonCardBlock('totals', SKELETON_TOTALS_ROW_KEYS)}

          {SKELETON_MEAL_CARD_KEYS.map(cardKey => skeletonCardBlock(`meal-${cardKey}`, SKELETON_MEAL_ROW_KEYS))}
        </>
      )}
    </View>
  )

  const loadingBlock = (): React.JSX.Element => (
    <View accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
      {columnWidth > 0 && (
        <>
          <View style={styles.skeletonDayStrip}>
            {skeletonDayKeys.map(dayKey => (
              <SkeletonBlock
                key={dayKey}
                height={Sizes.CONTROL_LG}
                width={flexItemWidth(columnWidth, Spacing.TIGHT, skeletonDayKeys.length)}
                borderRadius={BorderRadius.TILE}
              />
            ))}
          </View>

          {skeletonCardBlock('totals', SKELETON_TOTALS_ROW_KEYS)}

          {SKELETON_MEAL_CARD_KEYS.map(cardKey => skeletonCardBlock(`meal-${cardKey}`, SKELETON_MEAL_ROW_KEYS))}
        </>
      )}
    </View>
  )

  const errorBlock = (onRetryPressed: () => void): React.JSX.Element => (
    <View style={styles.errorCard} accessibilityLiveRegion="polite">
      <Text style={styles.errorTitle}>{MEAL_PLAN_LOAD_ERROR_TITLE}</Text>

      <TouchableOpacity
        style={styles.retryPill}
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        hitSlop={RETRY_PILL_HIT_SLOP}
        onPress={onRetryPressed}>
        <Text style={styles.retryLabel}>{MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}</Text>
      </TouchableOpacity>
    </View>
  )

  const unavailableBlock = (): React.JSX.Element => (
    <View style={styles.unavailableCard}>
      <Text style={styles.unavailableText}>{MEAL_PLAN_UNAVAILABLE_TEXT}</Text>
    </View>
  )

  // minHeight rather than height: a scaled-up text size must still be able to grow the block and scroll.
  const emptyBlock = (cta: EmptyPlanCta): React.JSX.Element => {
    const availableHeight =
      windowHeight - safeAreaInsets.top - tabBarHeight - emptyRegionTop - HOST_SCROLL_BOTTOM_PADDING

    return (
      <View style={emptyRegion(Math.max(0, availableHeight))} onLayout={onEmptyRegionLayout}>
        <EmptyPlanState
          headline={MEAL_PLAN_EMPTY_TITLE}
          body={MEAL_PLAN_EMPTY_BODY}
          primaryLabel={resolveEmptyPlanCtaLabel(cta)}
          onPrimary={() => onEmptyPrimaryPressed(cta)}
          secondaryLabel={MEAL_PLAN_GO_TO_DIARY_BUTTON_TEXT}
          onSecondary={onGoToDiaryPressed}
        />
      </View>
    )
  }

  const successBannerBlock = (body: string): React.JSX.Element => (
    <View style={styles.bannerContainer} accessibilityLiveRegion="polite">
      <InfoBanner
        tone="success"
        glyph="disc"
        body={body}
        actionLabel={MEAL_PLAN_VIEW_DIARY_LINK_TEXT}
        onAction={onBannerViewDiaryPressed}
      />
    </View>
  )

  const totalsBlock = (activePlan: MealPlan, plannedDay: MealPlanDay): React.JSX.Element => (
    <View style={styles.totalsCardContainer}>
      <PlannedTotalsCard
        dayName={stringWithNamedParameters(MEAL_PLAN_PLANNED_FOR_TEMPLATE, {
          day: planDayWeekdayName(plannedDay.date)
        })}
        targetText={stringWithNamedParameters(MEAL_PLAN_DAY_TARGET_TEMPLATE, {
          calories: formatCalories(activePlan.targets.calories)
        })}
        figure={formatCalories(plannedDay.plannedTotals.calories)}
        unitText={stringWithNamedParameters(MEAL_PLAN_MEAL_COUNT_TEMPLATE, {n: plannedDay.meals.length})}
        legend={totalsLegend}
      />

      {activePlan.targetsStale && (
        <View style={styles.captionContainer}>
          <Text style={styles.staleCaption}>{MEAL_PLAN_TARGETS_STALE_CAPTION}</Text>
        </View>
      )}
    </View>
  )

  const mealCardsBlock = (): React.JSX.Element[] =>
    mealCardModels.map((model, index) => (
      <View key={model.meal.id} style={index === 0 ? styles.mealCardContainerFirst : styles.mealCardContainer}>
        <MealPlanCard
          meal={model.meal}
          loggedState={model.loggedState}
          areWriteActionsEnabled={areWriteActionsEnabledFor(model.meal.id)}
          onOpen={onOpenRecipePressed}
          onSwap={onSwapPressed}
          onLog={onLogPressed}
          onViewEntry={onViewEntryPressed}
        />
      </View>
    ))

  const daySectionBlock = (activePlan: MealPlan): React.JSX.Element => {
    if (daySection === null || daySection.kind === 'loading') {
      return dayPlaceholderBlock()
    }

    if (daySection.kind === 'error') {
      return errorBlock(onRetryDayReadPressed)
    }

    return (
      <>
        {daySection.hasFailedRead && errorBlock(onRetryDayReadPressed)}

        {bannerBody === null ? totalsBlock(activePlan, daySection.day) : successBannerBlock(bannerBody)}

        {mealCardsBlock()}
      </>
    )
  }

  const lastDayBlock = (activePlan: MealPlan, action: LastDayAction): React.JSX.Element => (
    <View style={styles.lastDayCardContainer}>
      <LastDayCard
        title={MEAL_PLAN_LAST_DAY_TITLE}
        rangeText={stringWithNamedParameters(PLAN_REGENERATE_DIALOG_RANGE_TEMPLATE, {
          start: formatPlanDayLabel(activePlan.startDate),
          end: formatPlanDayLabel(activePlan.endDate)
        })}
        action={{
          label:
            action === 'viewNextWeek' ? MEAL_PLAN_VIEW_NEXT_WEEK_BUTTON_TEXT : MEAL_PLAN_PLAN_ANOTHER_WEEK_BUTTON_TEXT,
          onPress: () => onLastDayActionPressed(action)
        }}
      />
    </View>
  )

  const planBlock = (activePlan: MealPlan, isSavedCopy: boolean): React.JSX.Element => (
    <>
      {isSavedCopy && (
        <View style={styles.bannerContainer}>
          <InfoBanner tone="neutral" glyph="info" body={MEAL_PLAN_OFFLINE_BANNER_TEXT} />
        </View>
      )}

      <View style={styles.dayStripContainer}>
        <DayStrip dayKeys={planDayKeys} selectedDayKey={selectedDayKey} onDayPressed={setSelectedPlanDate} />
      </View>

      {daySectionBlock(activePlan)}

      {lastDayAction !== null && lastDayBlock(activePlan, lastDayAction)}

      <View style={styles.planSettingsRowContainer}>
        <PlanSettingsRow onPress={onPlanSettingsPressed} />
      </View>
    </>
  )

  const bodyBlock = (): React.JSX.Element => {
    if (outcome.kind === 'unavailable') {
      return unavailableBlock()
    }

    if (outcome.kind === 'loading') {
      return loadingBlock()
    }

    if (outcome.kind === 'error') {
      return errorBlock(onRetryPlanReadPressed)
    }

    if (outcome.kind === 'empty') {
      return emptyBlock(outcome.cta)
    }

    return planBlock(outcome.plan, outcome.isSavedCopy)
  }

  return (
    <View style={styles.body} onLayout={onColumnLayout}>
      {headerBlock()}

      {segmentedControl}

      {planSwitchLink !== null && planSwitchBlock(planSwitchLink)}

      {bodyBlock()}
    </View>
  )
}

export default MealPlanTab
