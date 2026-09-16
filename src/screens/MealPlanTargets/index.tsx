import React, {useCallback, useMemo, useRef, useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import type {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import type {StepMode} from '@navigation/types'
import {MealPlanTargetsRouteProp, Navigation} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {
  isNutritionTargetsReadFailure,
  selectNutritionTargets
} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useSaveNutritionTargetsMutation} from '@queries/mealPlanning/useSaveNutritionTargetsMutation'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useTargetEstimateQuery} from '@queries/mealPlanning/useTargetEstimateQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode} from '@utility/ApiErrorUtility'
import {mintKey} from '@utility/IdempotencyUtility'
import {addDaysToDayKey, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'
import {SafeAreaView} from 'react-native-safe-area-context'
import {v4 as uuidv4} from 'uuid'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import {closeGlobalBottomSheet, openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import ChevronLeftIcon from '@components/icons/ChevronLeftIcon'
import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import InfoBanner from '@components/InfoBanner'
import PrimaryButton from '@components/PrimaryButton'
import RevisionConflictDialog from '@components/RevisionConflictDialog'
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
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_PLAN_STARTS_LABEL,
  MEAL_PLAN_REVIEW_HEADER_LABEL,
  MEAL_PLAN_REVIEW_TITLE,
  MEAL_PLAN_STALE_REVISION_DIALOG_TITLE,
  MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT,
  MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_YOUR_ANSWERS_OVERLINE,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import PlanStartsCard from './components/PlanStartsCard'
import TargetsCard from './components/TargetsCard'
import {
  GenerateRevisionConflict,
  GenerateSequenceCommitments,
  NO_GENERATE_COMMITMENTS,
  runGenerateSequence
} from './index.orchestration'
import styles from './index.styled'
import {
  AnswerRowEditStep,
  buildAnswerRows,
  planGenerateSequence,
  resolveDisplayedTargets,
  resolveGenerateCtaState,
  resolveInitialStartDate,
  resolveStartDateStepState
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

  const preferencesQuery = useMealPlanPreferencesQuery()
  const targetsQuery = useNutritionTargetsQuery()
  const estimateQuery = useTargetEstimateQuery()
  const saveTargetsMutation = useSaveNutritionTargetsMutation()
  const saveStepMutation = useSaveSetupStepMutation()

  // One clock for the screen's life: the bounds are day-key granular, so re-reading it per render would
  // only risk the min and the selection disagreeing across a midnight rollover mid-session.
  const now = useMemo(() => new Date(), [])

  // What the last successful step wrote, so a retry after a later failure re-runs only what is still unsaved
  // (0.7.4). A ref rather than state: the sequence reads it as it runs and no render depends on it.
  const commitments = useRef<GenerateSequenceCommitments>(NO_GENERATE_COMMITMENTS)

  const [chosenStartDate, setChosenStartDate] = useState<string | null>(null)
  const [conflict, setConflict] = useState<GenerateRevisionConflict | null>(null)

  const preferences = preferencesQuery.data ?? null
  // A targets read that did not answer — no server targets, a failure, or a rolled-back backend whose route
  // is gone (AAP 0.7.5) — means fall back to the local target, never clear it.
  const targets = selectNutritionTargets(targetsQuery)
  const estimate = estimateQuery.data ?? null

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

  const isSubmitting = saveTargetsMutation.isPending || saveStepMutation.isPending

  const estimateErrorCode = getApiErrorCode(estimateQuery.error)
  const isEstimateUnavailable = estimateErrorCode === API_ERROR_CODES.estimateUnavailable

  // A route-missing targets answer is deliberately not a read failure: it cannot come back on a retry, so
  // drawing the retry card for it would offer a dead control. The card still renders and the local target
  // stands, exactly as it does for a user who never opted in (AAP 0.7.5).
  const hasTargetsReadFailure = isNutritionTargetsReadFailure(targetsQuery)
  const hasReadFailure = !preferencesQuery.isLoading && (preferences === null || hasTargetsReadFailure)

  // Retries whichever read failed, never both blindly: a targets read that never answered is what leaves the
  // confirmation save with no revision to pin, so resolving it here is what keeps a later Generate from
  // arguing with the server about a conflict the user never had.
  const onRetryReadsPressed = useCallback(() => {
    if (preferences === null) {
      preferencesQuery.refetch()
    }

    if (hasTargetsReadFailure) {
      targetsQuery.refetch()
    }
  }, [hasTargetsReadFailure, preferences, preferencesQuery, targetsQuery])

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
   * index.orchestration, where they are tested without a renderer; this screen supplies the collaborators and
   * turns the outcome into copy.
   */
  const runSequence = useCallback(
    async (
      confirmedPreferences: MealPlanPreferences,
      keepMineConflict: GenerateRevisionConflict | null
    ): Promise<void> => {
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
          saveTargets: saveTargetsMutation.mutateAsync,
          saveSetupStep: saveStepMutation.mutateAsync,
          refetchTargets: async () => selectNutritionTargets(await targetsQuery.refetch()),
          refetchPreferences: async () => (await preferencesQuery.refetch()).data ?? null,
          refetchEstimate: async () => {
            await estimateQuery.refetch()
          },
          mintIdempotencyKey: () => mintKey(uuidv4),
          navigateToGenerating: generatingParams => navigation.navigate(Screens.MEAL_PLAN_GENERATING, generatingParams)
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
    },
    [
      estimate,
      estimateQuery,
      navigation,
      paramStartDate,
      preferencesQuery,
      saveStepMutation,
      saveTargetsMutation,
      startDate,
      targets,
      targetsQuery
    ]
  )

  const displayed = preferences === null ? null : resolveDisplayedTargets({targets, estimate, preferences})

  const ctaState =
    preferences === null
      ? null
      : resolveGenerateCtaState({
          plan: planGenerateSequence({targets, estimate, preferences, startDate}),
          isEstimateLoading: estimateQuery.isLoading,
          isPending: isSubmitting
        })

  const onGeneratePressed = useCallback(() => {
    if (preferences === null || ctaState === null) {
      return
    }

    if (ctaState.action === 'manual_targets') {
      openEditTargets('manual', 'manual_entry')

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
        body={MEAL_PLAN_LOAD_ERROR_TITLE}
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
      estimateQuery.refetch()
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
        <SectionOverline text={MEAL_PLAN_YOUR_ANSWERS_OVERLINE} />
      </View>

      <View style={styles.answersCardWrapper}>
        <View style={styles.answersCard}>
          <SummaryRows rows={answerRows(loaded)} divided />
        </View>
      </View>
    </>
  )

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ContentColumn>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          extraHeight={Spacing.X_LARGE}
          keyboardDismissMode="interactive">
          <View style={styles.headerRow}>
            <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

            <Text style={styles.headerLabel}>{MEAL_PLAN_REVIEW_HEADER_LABEL}</Text>
          </View>

          <Text style={styles.headline}>{MEAL_PLAN_REVIEW_TITLE}</Text>

          {preferencesQuery.isLoading && loadingBlock()}

          {hasReadFailure && errorBlock(onRetryReadsPressed)}

          {preferences !== null && reviewBody(preferences)}
        </KeyboardAwareScrollView>
      </ContentColumn>

      <SetupFooter hairline>
        <PrimaryButton
          label={ctaState?.label ?? MEAL_PLAN_GENERATE_BUTTON_TEXT}
          isLoading={isSubmitting}
          disabled={ctaState === null || !ctaState.isEnabled}
          onPress={onGeneratePressed}
        />
      </SetupFooter>

      <RevisionConflictDialog
        isVisible={conflict !== null}
        title={MEAL_PLAN_STALE_REVISION_DIALOG_TITLE}
        keepMineLabel={MEAL_PLAN_STALE_REVISION_KEEP_MINE_BUTTON_TEXT}
        useTheirsLabel={MEAL_PLAN_STALE_REVISION_USE_THEIRS_BUTTON_TEXT}
        isKeepMinePending={isSubmitting}
        onKeepMine={onKeepMinePressed}
        onUseTheirs={onUseTheirsPressed}
      />
    </SafeAreaView>
  )
}

export default MealPlanTargetsScreen
