import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {LayoutChangeEvent, TouchableOpacity, View} from 'react-native'

import type {MealPlanMeal} from '@data/models/MealPlan'
import {LogPlannedMealRouteProp, Navigation} from '@navigation/types'
import type {LogPlannedMealResult} from '@queries/api/mealPlanning/logPlannedMeal'
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
import {mintKey} from '@utility/IdempotencyUtility'
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
  LOG_PLANNED_MEAL_TITLE,
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  SERVINGS_HEADER,
  THIS_ADDS_LABEL
} from '@constants/strings'

import FractionChips from './components/FractionChips'
import RecipeSummaryCard from './components/RecipeSummaryCard'
import ServingsStepper from './components/ServingsStepper'
import SlotPicker from './components/SlotPicker'
import {
  canChangeLogDate,
  classifyLogFailure,
  hasUnresolvedLogIntent,
  isPlanStateReadFailure,
  LogCommitTarget,
  LogPlanDateRange,
  nextLogDate,
  planDayQueryRecovery,
  planDayQueryScope,
  planLogAttempt,
  planUnconfirmedRefetch,
  resolveLogCacheScope,
  resolveLogDiaryDestination
} from './index.orchestration'
import styles from './index.styled'
import {
  buildThisAddsItems,
  dateOverlineText,
  logDateStepperLabel,
  nextPlannedServings,
  parsePlannedServingsInput,
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
 * The write is keyed. `planLogAttempt` rebuilds its request from the route, the chosen portion and the chosen
 * bucket: an unresolved intent describing the identical request answers with the key it was minted for, so a
 * lost response is replayed rather than writing a second diary entry (0.7.2). A failure never leaves this
 * screen — the portion, the date and the bucket all stay exactly as entered.
 */
const LogPlannedMealScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<LogPlannedMealRouteProp>()

  const userId = useAuthStore(state => state.userId)
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setPostLogResult = useMealPlanStore(state => state.setPostLogResult)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  // Read only. This is the day the Diary itself calls today, and the only value the post-log destination may
  // be decided against: a second reading of "today" could send the user to a screen the entry is not on.
  const sessionDayKey = useSessionStore(state => state.sessionStartDateIso)

  const [logDate, setLogDate] = useState(params.date)
  const [servings, setServings] = useState(ONE_PORTION)
  const [chosenBucketId, setChosenBucketId] = useState<string | null>(null)
  const [skeletonWidth, setSkeletonWidth] = useState(0)

  // The meal belongs to the planned day the route names; the entry is written to the day the user selected,
  // which is the day the diary is read for and the date the payload carries.
  const cacheScope = useMemo(
    () => resolveLogCacheScope({planId: params.planId, plannedDate: params.date, selectedDate: logDate}),
    [logDate, params.date, params.planId]
  )

  const dayQuery = useMealPlanDayQuery(...planDayQueryScope(cacheScope))
  const macrosQuery = useDailyMacrosQuery(cacheScope.diaryDate)
  const currentPlanQuery = useCurrentMealPlanQuery()
  const logMutation = useLogPlannedMealMutation(cacheScope.planId, params.mealId)

  const refetchDisplay = dayQuery.refetch
  const refetchDiary = macrosQuery.refetch
  const refetchCurrentPlan = currentPlanQuery.refetch

  // One clock for this mount: the stepper's day labels and the stored intent's 7-day life are day-granular, so
  // re-reading it per render could only let two readings of the same day disagree. The post-log destination is
  // decided against the session's day key instead, because that is the one the Diary itself is showing.
  const now = useMemo(() => new Date(), [])

  const hasRefetchedUnconfirmed = useRef(false)
  const hasAnnouncedPlanState = useRef(false)

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
        chosenBucketId
      }),
    [cacheScope.diaryDate, chosenBucketId, diaryMeals, envelope, meal]
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

  const isLoading = dayQuery.isLoading || macrosQuery.isLoading

  // An intent an earlier mount left unresolved, which this screen is the one that can still answer. Read only
  // while the mutation is idle: a request in flight has its intent recorded too, so an unguarded read would
  // state an unconfirmed outcome over a write that simply has not answered yet.
  const hasStoredIntent = useMemo(
    () => hasUnresolvedLogIntent({pendingIntents, userId, mealId: params.mealId, now: now.getTime()}),
    [now, params.mealId, pendingIntents, userId]
  )

  // The one failure the plan draws on this frame: an outcome that may already have committed promises
  // nothing and offers the same key again. Every confirmed refusal is reported by toast instead, because the
  // key it answered is spent.
  const isUnconfirmed = logMutation.isError
    ? classifyLogFailure(logMutation.error).isUnconfirmed
    : logMutation.isIdle && hasStoredIntent

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
      setSelectedPlanDate(params.date)
      setMacrosSegment('mealPlan')
      // The success banner is the plan tab's (38:351), raised from postLogResult — no toast is raised here.
      navigation.popTo(Screens.MACROS)
    },
    [
      clearPendingIntent,
      navigation,
      params.date,
      sessionDayKey,
      setMacrosSegment,
      setPostLogResult,
      setSelectedPlanDate
    ]
  )

  const onLogFailed = useCallback(
    (error: unknown): void => {
      const decision = classifyLogFailure(error)

      if (decision.disposition === 'retire') {
        clearPendingIntent('log')
      }

      // An unknown outcome is stated in place by the banner below and carries no toast, because its key is
      // still the only safe way to ask again.
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

  const onAddToDiaryPressed = useCallback(async (): Promise<void> => {
    // Nothing to log, or a request already in flight under a key of its own: a second press must not open a
    // second write, and the banner's "Try again" reaches this handler as well as the footer's CTA does.
    if (ready === null || logMutation.isPending) {
      return
    }

    // The key is minted at the press, never at render: a key holds only for a byte-identical replay, so an
    // edited portion, a stepped date or a different bucket earns its own.
    const attempt = planLogAttempt({
      planId: cacheScope.planId,
      mealId: params.mealId,
      servings,
      diaryDate: ready.target.diaryDate,
      diaryMealId: ready.target.diaryMealId,
      planRevision: ready.planRevision,
      userId,
      pendingIntents,
      attemptedAt: Date.now(),
      freshKey: mintKey(uuidv4)
    })

    if (attempt.intent !== null) {
      // Recorded before the request leaves, which is what makes a response lost in flight replayable at all.
      recordPendingIntent(attempt.intent)
    }

    hasRefetchedUnconfirmed.current = false

    // Awaited here rather than handed to per-call callbacks: the mutation's own options own the cache
    // invalidations and this screen owns every consequence the user meets. Per-call callbacks are also dropped
    // when the screen unmounts mid-flight, which would leave a committed write's intent unresolved and the
    // next mount stating an outcome the server had already confirmed.
    try {
      const result = await logMutation.mutateAsync(attempt.payload)

      onLogged(result, ready)
    } catch (error) {
      onLogFailed(error)
    }
  }, [
    cacheScope.planId,
    logMutation,
    onLogFailed,
    onLogged,
    params.mealId,
    pendingIntents,
    ready,
    recordPendingIntent,
    servings,
    userId
  ])

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

  const onServingsText = useCallback((text: string): void => {
    const parsed = parsePlannedServingsInput(text)

    // An unparseable keystroke leaves the confirmed value alone; the stepper's own draft keeps it on screen.
    if (parsed !== null) {
      setServings(parsed)
    }
  }, [])

  const canStepDate = (direction: 1 | -1): boolean =>
    canChangeLogDate({selectedDate: logDate, direction, planRange, isCommitPending: logMutation.isPending})

  const stepTargetDate = (direction: 1 | -1): string => nextLogDate({selectedDate: logDate, direction, planRange})

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

  const errorBlock = (): React.JSX.Element => (
    <View style={styles.bannerSection}>
      <InfoBanner
        tone="error"
        glyph="alert"
        body={MEAL_PLAN_LOAD_ERROR_TITLE}
        actionLabel={canRetryLoad ? MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT : undefined}
        onAction={canRetryLoad ? onRetryLoadPressed : undefined}
        secondaryActionLabel={MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  const logBody = (loaded: LogReadyState): React.JSX.Element => (
    <>
      {isUnconfirmed && (
        <View style={styles.bannerSection}>
          <InfoBanner
            tone="error"
            glyph="alert"
            title={MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE}
            body={MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY}
            actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
            onAction={onAddToDiaryPressed}
            isActionPending={logMutation.isPending}
          />
        </View>
      )}

      <View style={styles.recipeCardSection}>
        <RecipeSummaryCard name={loaded.meal.recipe.name} iconKey={loaded.meal.recipe.iconKey} />
      </View>

      <Text style={styles.controlLabel}>{SERVINGS_HEADER}</Text>

      <ServingsStepper
        value={servings}
        onDecrement={() => setServings(current => nextPlannedServings(current, -1))}
        onIncrement={() => setServings(current => nextPlannedServings(current, 1))}
        onChangeText={onServingsText}
      />

      <View style={styles.chipsSection}>
        <FractionChips
          servings={servings}
          onSelect={fractionValue => setServings(current => applyFractionPart(current, fractionValue))}
        />
      </View>

      <View style={styles.thisAddsSection}>
        <View style={styles.thisAddsCard}>
          <SectionOverline text={THIS_ADDS_LABEL} />

          {/* One element, so the four figures are read as caption-and-value pairs rather than four orphan
              numbers, and polite so a changed portion is announced without interrupting the field. */}
          <View accessible accessibilityLiveRegion="polite">
            <MetricGrid4 items={buildThisAddsItems(thisAddsTotals(loaded.meal.planned, servings))} />
          </View>
        </View>
      </View>

      <Text style={styles.controlLabel}>{LOG_PLANNED_MEAL_ADD_TO_HEADER}</Text>

      <View style={styles.slotSection}>
        <SlotPicker
          options={destination.options}
          selectedMealId={loaded.target.diaryMealId}
          onSelect={setChosenBucketId}
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

          <Text style={styles.dateOverline}>{dateOverlineText(logDate)}</Text>

          <Text style={styles.title}>{LOG_PLANNED_MEAL_TITLE}</Text>

          <View style={styles.dateRow}>
            {/* Each arrow is named by the day it moves to, which is the accessible name a date stepper needs:
                the glyph alone carries no destination, and the visible label sits between the two. */}
            <TouchableOpacity
              style={[styles.dateStepButton, !canStepDate(-1) && styles.dateStepButtonDisabled]}
              activeOpacity={Opacity.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={logDateStepperLabel(stepTargetDate(-1), now)}
              accessibilityState={{disabled: !canStepDate(-1)}}
              disabled={!canStepDate(-1)}
              onPress={() => onStepDate(-1)}>
              <ChevronLeftIcon color={Theme.colors.text} />
            </TouchableOpacity>

            <Text style={styles.dateLabel}>{logDateStepperLabel(logDate, now)}</Text>

            <TouchableOpacity
              style={[styles.dateStepButton, !canStepDate(1) && styles.dateStepButtonDisabled]}
              activeOpacity={Opacity.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={logDateStepperLabel(stepTargetDate(1), now)}
              accessibilityState={{disabled: !canStepDate(1)}}
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
          error where there is nothing to log — shows the action disabled rather than dropping it. */}
      <SetupFooter hairline>
        <PrimaryButton
          label={LOG_PLANNED_MEAL_ADD_TO_DIARY_BUTTON_TEXT}
          isLoading={logMutation.isPending}
          disabled={ready === null}
          onPress={onAddToDiaryPressed}
        />
      </SetupFooter>
    </SafeAreaView>
  )
}

export default LogPlannedMealScreen
