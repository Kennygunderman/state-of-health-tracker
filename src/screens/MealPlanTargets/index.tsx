import React, {useCallback, useMemo, useRef, useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import type {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import type {StepMode} from '@navigation/types'
import {MealPlanTargetsRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {selectNutritionTargets} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useSaveNutritionTargetsMutation} from '@queries/mealPlanning/useSaveNutritionTargetsMutation'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useTargetEstimateQuery} from '@queries/mealPlanning/useTargetEstimateQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {mintKey} from '@utility/IdempotencyUtility'
import {addDaysToDayKey, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {SafeAreaView} from 'react-native-safe-area-context'
import {v4 as uuidv4} from 'uuid'

import BackCircleButton from '@components/BackCircleButton'
import ColumnScrollView from '@components/ColumnScrollView'
import ContentColumn from '@components/ContentColumn'
import ConfirmModal from '@components/dialog/ConfirmModal'
import {closeGlobalBottomSheet, openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import ChevronLeftIcon from '@components/icons/ChevronLeftIcon'
import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import InfoBanner from '@components/InfoBanner'
import PrimaryButton from '@components/PrimaryButton'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import SummaryRows, {SummaryRow} from '@components/SummaryRows'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CHANGE_LINK_TEXT,
  MEAL_PLAN_DONE_BUTTON_TEXT,
  MEAL_PLAN_ENTER_TARGETS_MANUALLY_BUTTON_TEXT,
  MEAL_PLAN_ESTIMATE_UNAVAILABLE_TITLE,
  MEAL_PLAN_GENERATE_BUTTON_TEXT,
  MEAL_PLAN_GENERATION_TERMINAL_COPY,
  MEAL_PLAN_LOAD_ERROR_BODY,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_PLAN_STARTS_LABEL,
  MEAL_PLAN_REVIEW_HEADER_LABEL,
  MEAL_PLAN_REVIEW_TITLE,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNAVAILABLE_TEXT,
  MEAL_PLAN_YOUR_ANSWERS_OVERLINE,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import PlanStartsCard from './components/PlanStartsCard'
import TargetsCard from './components/TargetsCard'
import styles from './index.styled'
import {
  AnswerRowEditStep,
  buildAnswerRows,
  GenerateRevisionConflict,
  GenerateSequenceCommitments,
  authoritativeEstimate,
  isConfirmedEstimateUnavailableError,
  NO_GENERATE_COMMITMENTS,
  planGenerateSequence,
  resolveDisplayedTargets,
  resolveGenerateCtaState,
  resolveInitialStartDate,
  resolveReviewReadState,
  resolveStartDateStepState,
  runGenerateSequence
} from './index.util'

// The rhythm 13c loads into: the calorie figure, the three legend rows and the plan-start row.
const SKELETON_BLOCK_HEIGHTS: number[] = [
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR,
  Sizes.SKELETON_BAR,
  Sizes.SKELETON_BAR,
  Sizes.CONTROL
]

const MealPlanTargetsScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanTargetsRouteProp>()

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own read, a setup save, a nested
  // plan read — is terminal for a gated screen: there is nothing here to retry, so the guard leaves for the
  // Meal Plan segment, which states the refusal once (AAP 0.2.5). The gate it returns also keeps this screen's
  // gated read from going out when the screen is mounted with the verdict already in force.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const preferencesQuery = useMealPlanPreferencesQuery(isGatedRequestAllowed)
  const targetsQuery = useNutritionTargetsQuery()
  const estimateQuery = useTargetEstimateQuery()
  const saveTargetsMutation = useSaveNutritionTargetsMutation()
  const saveStepMutation = useSaveSetupStepMutation()

  // TanStack keeps refetch and mutateAsync stable while the observer object it hangs off is replaced on every
  // status change, so the callbacks below close over and depend on these rather than on the observers.
  const {refetch: refetchPreferences} = preferencesQuery
  const {refetch: refetchTargets} = targetsQuery
  const {refetch: refetchEstimate} = estimateQuery
  const {mutateAsync: saveTargets} = saveTargetsMutation
  const {mutateAsync: saveSetupStep} = saveStepMutation

  // One clock for the screen's life: the bounds are day-key granular, so re-reading it per render would
  // only risk the min and the selection disagreeing across a midnight rollover mid-session.
  const now = useMemo(() => new Date(), [])

  // What the last successful step wrote, so a retry after a later failure re-runs only what is still unsaved
  // (0.7.4). A ref rather than state: the sequence reads it as it runs and no render depends on it.
  const commitments = useRef<GenerateSequenceCommitments>(NO_GENERATE_COMMITMENTS)

  const [chosenStartDate, setChosenStartDate] = useState<string | null>(null)
  const [conflict, setConflict] = useState<GenerateRevisionConflict | null>(null)

  // The press, not the write. A refused save leaves `isPending` behind while the sequence is still refetching
  // the authoritative row and deciding whether the refusal was a conflict — re-enabling the CTA there would
  // let a second press start against revisions the first one is in the middle of replacing (0.7.2).
  const [isSequenceRunning, setIsSequenceRunning] = useState(false)

  const preferences = preferencesQuery.data ?? null
  // A targets read that did not answer — no server targets, a failure, or a rolled-back backend whose route
  // is gone (AAP 0.7.5) — means fall back to the local target, never clear it.
  const targets = selectNutritionTargets(targetsQuery)
  // Only a successful estimate read is an estimate: a retained one from before a confirmed
  // `estimate_unavailable` would otherwise render as the card's figures with a Generate path that confirms
  // them — see `authoritativeEstimate`.
  const estimate = authoritativeEstimate(estimateQuery)

  const paramStartDate = params.mode === 'nextWeek' ? params.startDate : null

  // In nextWeek mode the param already is the successor week's first day, so the active plan it succeeds ended
  // the day before: naming that end date is what keeps the picker's upper bound admitting the chosen start.
  const activePlanEndDate = paramStartDate === null ? null : addDaysToDayKey(paramStartDate, -1)

  const startDate =
    chosenStartDate ??
    resolveInitialStartDate({
      reviewStartDate: preferences?.reviewStartDate ?? null,
      paramStartDate,
      now,
      activePlanEndDate
    })

  // The whole press: the writes and the recovery that follows a refusal, so every affordance the press owns
  // stays closed until the sequence has actually settled.
  const isSubmitting = saveTargetsMutation.isPending || saveStepMutation.isPending || isSequenceRunning

  // The card's own estimate answer: the server's confirmed verdict that no estimate can be calculated, whose
  // recovery is manual entry (0.2.5). `isError` is part of the test because TanStack keeps the last error
  // object on a result that has since succeeded.
  const isEstimateUnavailable = estimateQuery.isError && isConfirmedEstimateUnavailableError(estimateQuery.error)

  // The press is planned before the reads are composed, because whether the estimate can still decide the
  // press is the plan's own answer (`dependsOnEstimate`) — and with no preferences row there is no plan to ask.
  const plan = preferences === null ? null : planGenerateSequence({targets, estimate, preferences, startDate})

  // One derivation for the whole body, keyed on what each read answered rather than on the data it left
  // behind: a refetch that failed keeps its last row in the cache, and reading that row as an answer is what
  // let this screen hide its own retry card and generate against revisions nothing reported.
  const readState = resolveReviewReadState({
    preferences: preferencesQuery,
    targets: targetsQuery,
    estimate: estimateQuery,
    dependsOnEstimate: plan?.dependsOnEstimate ?? false
  })

  // Both states withhold the press. Every revision it pins comes from these reads, and neither a failure nor
  // an absent capability reported one; what separates them is that only the failure has a retry to offer.
  const hasReadFailure = readState.status === 'failed' || readState.status === 'unavailable'

  // Refetches exactly the reads that failed, each keyed on its own read rather than on the data it left
  // behind: a failed refetch keeps its last row, so a retry keyed on that row's absence would re-request
  // nothing and stand there as a dead control. A targets read that never answered is what leaves the
  // confirmation save with no revision to pin, so resolving it here is what keeps a later Generate from
  // arguing with the server about a conflict the user never had.
  const onRetryReadsPressed = useCallback(() => {
    if (readState.retryPreferences) {
      refetchPreferences()
    }

    if (readState.retryTargets) {
      refetchTargets()
    }

    if (readState.retryEstimate) {
      refetchEstimate()
    }
  }, [
    readState.retryEstimate,
    readState.retryPreferences,
    readState.retryTargets,
    refetchEstimate,
    refetchPreferences,
    refetchTargets
  ])

  const openEditTargets = useCallback(
    (mode: 'edit' | 'manual', intent?: 'confirm_estimate' | 'edit_saved' | 'manual_entry') => {
      navigation.navigate(Screens.MEAL_PLAN_EDIT_TARGETS, {
        mode,
        returnTo: {kind: 'stack', route: 'review'},
        intent
      })
    },
    [navigation]
  )

  const openAnswerStep = useCallback(
    (editStep: AnswerRowEditStep) => {
      // Each destination takes the same StepMode, but navigate() needs a literal route name to type its
      // params, which is why this is a switch over the five steps rather than a lookup table.
      const stepParams: StepMode = {mode: 'edit', returnTo: 'review', origin: 'row'}

      switch (editStep) {
        case 'goal':
          navigation.navigate(Screens.MEAL_PLAN_GOAL, stepParams)
          break
        case 'diet':
          navigation.navigate(Screens.MEAL_PLAN_DIET, stepParams)
          break
        case 'dislikes':
          navigation.navigate(Screens.MEAL_PLAN_FOOD_PREFERENCES, stepParams)
          break
        case 'schedule':
          navigation.navigate(Screens.MEAL_PLAN_SCHEDULE, stepParams)
          break
        case 'cooking':
          navigation.navigate(Screens.MEAL_PLAN_COOKING_BUDGET, stepParams)
          break
      }
    },
    [navigation]
  )

  /**
   * The generate sequence of AAP 0.7.4. Its ordering, selective retry and conflict recovery are decided in
   * index.util, where they are tested without a renderer; this screen supplies the collaborators and turns the
   * outcome into copy.
   */
  const runSequence = useCallback(
    async (
      confirmedPreferences: MealPlanPreferences,
      keepMineConflict: GenerateRevisionConflict | null
    ): Promise<void> => {
      setIsSequenceRunning(true)

      try {
        const outcome = await runGenerateSequence({
          targets,
          estimate,
          preferences: confirmedPreferences,
          startDate,
          planStartDate: paramStartDate,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          commitments: commitments.current,
          keepMineConflict,
          collaborators: {
            saveTargets,
            saveSetupStep,
            // Each refetch reports whether it reached the server, never just the row it left in the cache: a
            // failed refetch retains the pre-press data, which recovery would otherwise read as the server's
            // own answer and accept as proof a refused write had landed.
            refetchTargets: async () => {
              const result = await refetchTargets()

              return result.isSuccess ? {status: 'ok', data: selectNutritionTargets(result)} : {status: 'failed'}
            },
            refetchPreferences: async () => {
              const result = await refetchPreferences()

              return result.isSuccess ? {status: 'ok', data: result.data ?? null} : {status: 'failed'}
            },
            refetchEstimate: async () => {
              const result = await refetchEstimate()

              return result.isSuccess ? {status: 'ok', data: result.data ?? null} : {status: 'failed'}
            },
            mintIdempotencyKey: () => mintKey(uuidv4),
            navigateToGenerating: generatingParams =>
              navigation.navigate(Screens.MEAL_PLAN_GENERATING, generatingParams)
          }
        })

        commitments.current = outcome.commitments
        setConflict(outcome.status === 'conflict' ? outcome.conflict : null)

        if (outcome.status === 'estimate_stale') {
          showToast('error', MEAL_PLAN_GENERATION_TERMINAL_COPY.stale_revision.body)
        }

        if (outcome.status === 'failed') {
          showToast('error', TOAST_GENERIC_ERROR)
        }
      } finally {
        setIsSequenceRunning(false)
      }
    },
    [
      estimate,
      navigation,
      paramStartDate,
      refetchEstimate,
      refetchPreferences,
      refetchTargets,
      saveSetupStep,
      saveTargets,
      startDate,
      targets
    ]
  )

  const displayed = preferences === null ? null : resolveDisplayedTargets({targets, estimate, preferences})

  const ctaState =
    plan === null
      ? null
      : resolveGenerateCtaState({
          plan,
          isEstimateLoading: estimateQuery.isLoading,
          isPending: isSubmitting,
          hasReadFailure
        })

  const onGeneratePressed = useCallback(() => {
    if (preferences === null || ctaState === null) {
      return
    }

    if (ctaState.action === 'manual_targets') {
      openEditTargets('manual', 'manual_entry')

      return
    }

    // A saved set the planner will not accept — legacy, or missing figures (0.5.2) — is the user's to settle,
    // so the press opens the editor on their own numbers instead of generating against them or silently
    // replacing them with the estimate.
    if (ctaState.action === 'review_targets') {
      openEditTargets('edit', 'edit_saved')

      return
    }

    runSequence(preferences, null)
  }, [ctaState, openEditTargets, preferences, runSequence])

  // Review holds two things the user chose — the start date they set and the estimate they pressed Generate
  // on — so both refusals offer this answer. It runs the sequence rather than clearing the conflict itself,
  // because a second 409 has to raise the prompt again (0.7.2).
  const onKeepMinePressed = useCallback(() => {
    if (preferences === null || conflict === null) {
      return
    }

    runSequence(preferences, conflict)
  }, [conflict, preferences, runSequence])

  // Adopting the row's own start date, null included — which returns the card to the default the bounds
  // resolve. A refused confirmation needs no such step: the refetched figures are already on the card.
  const onUseTheirsPressed = useCallback(() => {
    if (conflict !== null && conflict.step === 'startDate') {
      setChosenStartDate(conflict.theirStartDate)
    }

    setConflict(null)
  }, [conflict])

  const startDateStep = resolveStartDateStepState({startDate, now, activePlanEndDate})

  // The sheet host replaces its content in place, so each step re-pushes the next day's panel rather than
  // keeping a visibility flag that the backdrop tap and pan-down dismissals would silently invalidate.
  const startDateSheetContent = (dayKey: string): React.JSX.Element => {
    const step = resolveStartDateStepState({startDate: dayKey, now, activePlanEndDate})
    const previousDay = addDaysToDayKey(dayKey, -1)
    const nextDay = addDaysToDayKey(dayKey, 1)

    const onStep = (target: string) => {
      setChosenStartDate(target)
      openGlobalBottomSheet(startDateSheetContent(target))
    }

    return (
      <View style={styles.sheetContainer}>
        <Text style={styles.sheetTitle}>{MEAL_PLAN_PLAN_STARTS_LABEL}</Text>

        <View style={styles.sheetStepperRow}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={formatPlanDayLabel(previousDay)}
            accessibilityState={{disabled: !step.canStepBack}}
            style={[styles.sheetStepButton, !step.canStepBack && styles.sheetStepButtonDisabled]}
            activeOpacity={Opacity.PRESSED}
            disabled={!step.canStepBack}
            onPress={() => onStep(previousDay)}>
            <ChevronLeftIcon color={step.canStepBack ? Theme.colors.text : Theme.colors.textDisabled} />
          </TouchableOpacity>

          <Text style={styles.sheetDateLabel}>{step.rangeText}</Text>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={formatPlanDayLabel(nextDay)}
            accessibilityState={{disabled: !step.canStepForward}}
            style={[styles.sheetStepButton, !step.canStepForward && styles.sheetStepButtonDisabled]}
            activeOpacity={Opacity.PRESSED}
            disabled={!step.canStepForward}
            onPress={() => onStep(nextDay)}>
            <ChevronRightIcon color={step.canStepForward ? Theme.colors.text : Theme.colors.textDisabled} />
          </TouchableOpacity>
        </View>

        <View style={styles.sheetFooter}>
          <PrimaryButton label={MEAL_PLAN_DONE_BUTTON_TEXT} onPress={closeGlobalBottomSheet} />
        </View>
      </View>
    )
  }

  const answerRows = (loaded: MealPlanPreferences): SummaryRow[] =>
    buildAnswerRows(loaded).map(row => ({
      label: row.label,
      value: row.value,
      onPress: () => openAnswerStep(row.editStep)
    }))

  const loadingBlock = (): React.JSX.Element => (
    <View style={styles.skeletonGroup}>
      {SKELETON_BLOCK_HEIGHTS.map((height, index) => (
        <SkeletonBlock
          key={`${height}-${index}`}
          height={height}
          // The stretch style overrides this, but Skeleton drives its shimmer sweep from the prop, so the
          // column's own maximum is the width the animation is sized against.
          width={Sizes.CONTENT_MAX_WIDTH}
          borderRadius={BorderRadius.CARD_LG}
          style={styles.skeletonStretch}
        />
      ))}
    </View>
  )

  const errorBlock = (onRetry: () => void): React.JSX.Element => (
    <View style={styles.bannerWrapper}>
      <InfoBanner
        tone="error"
        glyph="alert"
        title={MEAL_PLAN_LOAD_ERROR_TITLE}
        body={MEAL_PLAN_LOAD_ERROR_BODY}
        actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        onAction={onRetry}
      />
    </View>
  )

  const targetsBlock = (): React.JSX.Element => {
    if (displayed === null) {
      return loadingBlock()
    }

    if (displayed.source !== 'unavailable') {
      return (
        <>
          <View style={styles.targetsCardWrapper}>
            <TargetsCard
              label={displayed.cardLabel}
              calorieFigure={displayed.calories}
              unitLabel={displayed.unitLabel}
              macros={displayed.macros}
              editLabel={displayed.editLabel}
              // The recalculated figure beside the saved one it would replace (0.7.3), so the Recalculate link
              // states what adopting it changes rather than the estimate quietly taking the card over.
              estimateFigure={displayed.freshEstimateText ?? undefined}
              summaryAccessibilityLabel={displayed.summaryAccessibilityLabel}
              onEditPress={() =>
                openEditTargets('edit', displayed.source === 'estimate' ? 'confirm_estimate' : 'edit_saved')
              }
            />
          </View>

          {/* Outside the card, because 34:80 is its sibling rather than its child, and it belongs to this
              branch alone: the frame draws no caption under a skeleton or an unavailable estimate. */}
          <View style={styles.targetsCaptionWrapper}>
            <Text style={styles.targetsCaption}>{displayed.caption}</Text>
          </View>
        </>
      )
    }

    if (estimateQuery.isLoading) {
      return loadingBlock()
    }

    if (isEstimateUnavailable) {
      return (
        <View style={styles.bannerWrapper}>
          <InfoBanner
            tone="error"
            glyph="alert"
            body={MEAL_PLAN_ESTIMATE_UNAVAILABLE_TITLE}
            actionLabel={MEAL_PLAN_ENTER_TARGETS_MANUALLY_BUTTON_TEXT}
            onAction={() => openEditTargets('manual', 'manual_entry')}
          />
        </View>
      )
    }

    return errorBlock(() => {
      refetchEstimate()
    })
  }

  const reviewBody = (loaded: MealPlanPreferences): React.JSX.Element => (
    <>
      {targetsBlock()}

      <View style={styles.planStartsCardWrapper}>
        <PlanStartsCard
          label={MEAL_PLAN_PLAN_STARTS_LABEL}
          rangeText={startDateStep.rangeText}
          changeLabel={MEAL_PLAN_CHANGE_LINK_TEXT}
          onChangePress={() => openGlobalBottomSheet(startDateSheetContent(startDate))}
        />
      </View>

      <View style={styles.answersOverlineWrapper}>
        <SectionOverline text={MEAL_PLAN_YOUR_ANSWERS_OVERLINE} isHeading />
      </View>

      <View style={styles.answersCardWrapper}>
        <View style={styles.answersCard}>
          <SummaryRows rows={answerRows(loaded)} valueSize="body" divided />
        </View>
      </View>
    </>
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ContentColumn>
        <ColumnScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive">
          <View style={styles.headerRow}>
            <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

            <Text style={styles.headerLabel}>{MEAL_PLAN_REVIEW_HEADER_LABEL}</Text>
          </View>

          <Text style={styles.headline} accessibilityRole="header">
            {MEAL_PLAN_REVIEW_TITLE}
          </Text>

          {readState.status === 'loading' && loadingBlock()}

          {readState.status === 'failed' && errorBlock(onRetryReadsPressed)}

          {/* No retry for this one. A capability the server has switched off, or a route a rolled-back backend
              no longer mounts, answers a repeat probe identically until it is put back, so the state says so
              and offers no control that cannot change it (0.2.5). */}
          {readState.status === 'unavailable' && (
            <View style={styles.bannerWrapper}>
              <InfoBanner tone="neutral" glyph="info" body={MEAL_PLAN_UNAVAILABLE_TEXT} />
            </View>
          )}

          {/* The retry card replaces the review rather than sitting above it. Every revision the press pins
              comes from these reads, so a review rendered without one of them offers a Generate that cannot
              name what it is generating against — and answer rows, a start date and a targets card drawn from
              a partial read read as settled state the server never confirmed. */}
          {readState.status === 'ready' && preferences !== null && reviewBody(preferences)}
        </ColumnScrollView>
      </ContentColumn>

      <SetupFooter hairline>
        <PrimaryButton
          label={ctaState?.label ?? MEAL_PLAN_GENERATE_BUTTON_TEXT}
          isLoading={isSubmitting}
          disabled={ctaState === null || !ctaState.isEnabled}
          onPress={onGeneratePressed}
        />
      </SetupFooter>

      <ConfirmModal
        isVisible={conflict !== null}
        confirmationTitle={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        confirmButtonText={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        confirmButtonColor={Theme.colors.accentGreen}
        cancelButtonText={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        cancelButtonColor={Theme.colors.track}
        isConfirmPending={isSubmitting}
        avoidKeyboard
        onConfirmPressed={onKeepMinePressed}
        onCancel={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanTargetsScreen
