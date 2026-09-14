import React, {useCallback, useState} from 'react'

import {ScrollView, View} from 'react-native'

import type {MealPlan, MealPlanSummary} from '@data/models/MealPlan'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'
import type {RootStackParamList, StepMode} from '@navigation/types'
import {Navigation, PlanSettingsRouteProp} from '@navigation/types'
import {useAffectedMealsQuery} from '@queries/mealPlanning/useAffectedMealsQuery'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {
  isNutritionTargetsReadFailure,
  selectNutritionTargets
} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {useNavigation, useRoute} from '@react-navigation/native'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {mintKey} from '@utility/IdempotencyUtility'
import {SafeAreaView} from 'react-native-safe-area-context'
import {v4 as uuidv4} from 'uuid'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import InfoBanner from '@components/InfoBanner'
import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import {SummaryRow} from '@components/SummaryRows'
import Text from '@components/Text'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_TITLE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  PLAN_REGENERATE_CONFIRM_BUTTON_TEXT,
  PLAN_REGENERATE_DIALOG_TITLE,
  PLAN_REGENERATE_DISMISS_BUTTON_TEXT,
  PLAN_SETTINGS_FOOTNOTE,
  PLAN_SETTINGS_REGENERATE_BUTTON_TEXT,
  PLAN_SETTINGS_TITLE,
  PLAN_SETTINGS_USE_FOR_NEXT_PLAN_BUTTON_TEXT,
  stringWithNamedParameters
} from '@constants/strings'

import PlanConfirmDialog from './components/PlanConfirmDialog'
import SettingsRow from './components/SettingsRow'
import styles, {regenerateSummaryValueColor} from './index.styled'
import {
  buildPlanSettingsRows,
  buildRegenerateDialogBody,
  buildRegenerateSummaryRows,
  derivePlanSettingsBanner,
  earliestFlaggedDate,
  nextPlanAcknowledgementTarget,
  PlanSettingsRow,
  shouldRecalculateTargets,
  shouldShowUseForNextPlan
} from './index.util'

// Four row-height bars, so the placeholder carries the settings card's own rhythm rather than one block of
// an unrelated height.
const SKELETON_ROW_HEIGHTS: number[] = [Sizes.CONTROL_LG, Sizes.CONTROL_LG, Sizes.CONTROL_LG, Sizes.CONTROL]

/**
 * Frames 16 / 16b: the seven saved answers of the running plan, the flagged-meals banner, and the two ways an
 * edit can be applied.
 *
 * Every row was already persisted by its own "Save changes", so this screen writes nothing through its own
 * controls: `buildPlanSettingsRows` hands it navigation descriptors it dispatches, "Use for next plan" is an
 * acknowledgement that navigates and mutates nothing (AAP 0.7.4), and "Regenerate this week" confirms through
 * 16b and then hands the keyed write to `MealPlanGenerating`, which owns the idempotency key from there.
 */
const PlanSettingsScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<PlanSettingsRouteProp>()

  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const preferencesQuery = useMealPlanPreferencesQuery()
  const targetsQuery = useNutritionTargetsQuery()
  const currentPlanQuery = useCurrentMealPlanQuery()
  const affectedMealsQuery = useAffectedMealsQuery(params.planId)

  const [isConfirmVisible, setIsConfirmVisible] = useState(false)

  const preferences = preferencesQuery.data ?? null
  // A targets read that did not answer — no server targets, a failure, or a rolled-back backend whose route is
  // gone (AAP 0.7.5) — means the rows fall back to the local target, never clear it.
  const targets = selectNutritionTargets(targetsQuery)
  const plans = currentPlanQuery.data ?? null

  // The plan this screen was opened for. The current and upcoming plans are returned together and the route
  // names which of them by id, so a settings screen opened for next week never reads this week's counts.
  const plan: MealPlan | null =
    plans === null ? null : ([plans.current, plans.upcoming].find(candidate => candidate?.id === params.planId) ?? null)

  const banner = derivePlanSettingsBanner(affectedMealsQuery.data, affectedMealsQuery.isError)

  const showUseForNextPlan =
    plan !== null &&
    shouldShowUseForNextPlan({hasIncompatibilities: plan.hasIncompatibilities, targetsStale: plan.targetsStale})

  // Regeneration pins three revisions, and two of them come from these queries. The targets pin is only real
  // once the targets read has answered: `NO_TARGETS_REVISION` states "there is no prior revision" and is
  // honest only when the server said so, so while that read is loading or failed there is no pin to send and
  // this stays null — a fabricated one earns a targets refusal the user cannot act on (0.2.5, 0.5.2).
  const targetsRevision = targetsQuery.isSuccess ? (targets?.revision ?? NO_TARGETS_REVISION) : null

  // A read that has not answered is not silently disabling: the card below explains it and offers the retry
  // that makes this control available again.
  const canRegenerate = plan !== null && preferences !== null && targetsRevision !== null

  /**
   * A row descriptor's route, dispatched as a push. Every step route takes a `StepMode`, but `navigate` types
   * its params per route, so the literal name has to be matched before the call rather than passed through as
   * a variable.
   */
  const openStep = useCallback(
    (route: keyof RootStackParamList, mode: StepMode): void => {
      switch (route) {
        case Screens.MEAL_PLAN_GOAL:
          navigation.navigate(Screens.MEAL_PLAN_GOAL, mode)

          return
        case Screens.MEAL_PLAN_ACTIVITY:
          navigation.navigate(Screens.MEAL_PLAN_ACTIVITY, mode)

          return
        case Screens.MEAL_PLAN_DIET:
          navigation.navigate(Screens.MEAL_PLAN_DIET, mode)

          return
        case Screens.MEAL_PLAN_FOOD_PREFERENCES:
          navigation.navigate(Screens.MEAL_PLAN_FOOD_PREFERENCES, mode)

          return
        case Screens.MEAL_PLAN_SCHEDULE:
          navigation.navigate(Screens.MEAL_PLAN_SCHEDULE, mode)

          return
        case Screens.MEAL_PLAN_COOKING_BUDGET:
          navigation.navigate(Screens.MEAL_PLAN_COOKING_BUDGET, mode)

          return
        default:
          // `buildPlanSettingsRows` pairs a step descriptor with one of the six routes above; the seventh row
          // carries the targets editor's own params and is dispatched by `openRow` instead.
          return
      }
    },
    [navigation]
  )

  /**
   * One settings row, opened through the descriptor its derivation carries — `{route, params}` applied as
   * navigation and nothing else. The two descriptor shapes are told apart by the members they declare: a step
   * edit names the origin it came from, and the targets editor names where to return to.
   */
  const openRow = useCallback(
    (row: PlanSettingsRow): void => {
      const {route, params: descriptor} = row.target

      if (descriptor === undefined) {
        return
      }

      if ('origin' in descriptor) {
        openStep(route, descriptor)

        return
      }

      if (route === Screens.MEAL_PLAN_EDIT_TARGETS && 'returnTo' in descriptor) {
        // A confirmed set whose inputs have moved, or a figure that predates the planner, is opened as a
        // recalculation rather than a plain edit: the editor then offers the fresh estimate to confirm, which
        // is the only route by which a save may claim it.
        navigation.navigate(
          Screens.MEAL_PLAN_EDIT_TARGETS,
          shouldRecalculateTargets(targets) ? {...descriptor, intent: 'confirm_estimate'} : descriptor
        )
      }
    },
    [navigation, openStep, targets]
  )

  const onReviewAffectedPressed = useCallback(() => {
    // The banner names days rather than meals, so the review lands on the earliest flagged one with the plan
    // segment selected; the flags themselves stay until the user swaps those meals.
    setSelectedPlanDate(earliestFlaggedDate(affectedMealsQuery.data ?? []))
    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [affectedMealsQuery.data, navigation, setMacrosSegment, setSelectedPlanDate])

  const onUseForNextPlanPressed = useCallback(() => {
    // Acknowledgement only (0.7.4): every edit was already persisted by its own "Save changes" and the server
    // reads the latest preferences when it next generates, so this dispatches the descriptor's navigation and
    // no mutation at all.
    if (nextPlanAcknowledgementTarget().route === Screens.MACROS) {
      setMacrosSegment('mealPlan')
      navigation.popTo(Screens.MACROS)
    }
  }, [navigation, setMacrosSegment])

  const onConfirmRegeneratePressed = useCallback(() => {
    if (plan === null || preferences === null || targetsRevision === null) {
      return
    }

    setIsConfirmVisible(false)

    navigation.navigate(Screens.MEAL_PLAN_GENERATING, {
      context: {kind: 'regenerate', planId: plan.id, planRevision: plan.revision},
      // Minted here, at the press that decides the replacement: the key belongs to this request, and a key
      // minted at render would be reused by a second confirmation whose payload had moved on.
      idempotencyKey: mintKey(uuidv4),
      expectedPreferencesRevision: preferences.revision,
      expectedTargetsRevision: targetsRevision,
      startDate: plan.startDate
    })
  }, [navigation, plan, preferences, targetsRevision])

  // Both reads feed the rows and the regenerate pin, so the card waits for both rather than rendering rows
  // that read 'Not set' for a target the server has not answered for yet (0.2.5).
  const isSettingsLoading = preferencesQuery.isLoading || targetsQuery.isLoading

  // A route-missing targets answer is deliberately not a read failure here: it cannot come back on a retry, so
  // drawing the retry card for it would offer a dead control. The rows still render from preferences, and
  // regeneration stays disabled because `targetsRevision` has no answer to pin (AAP 0.7.5).
  const hasReadFailure = !isSettingsLoading && (preferences === null || isNutritionTargetsReadFailure(targetsQuery))

  const onRetryReadsPressed = (): void => {
    if (preferences === null) {
      preferencesQuery.refetch()
    }

    if (isNutritionTargetsReadFailure(targetsQuery)) {
      targetsQuery.refetch()
    }
  }

  const regenerateRows = (summary: MealPlanSummary): SummaryRow[] =>
    buildRegenerateSummaryRows(summary).map(row => ({
      label: row.label,
      value: row.value,
      valueColor: regenerateSummaryValueColor(row.tone)
    }))

  const loadingBlock = (): React.JSX.Element => (
    <View style={styles.cardWrapper}>
      <View style={styles.settingsCard}>
        <View style={styles.skeletonWrapper}>
          {SKELETON_ROW_HEIGHTS.map((height, index) => (
            <SkeletonBlock
              key={`${height}-${index}`}
              height={height}
              // The card bounds the bar (it clips its own overflow), while Skeleton drives its shimmer sweep
              // from this prop — so the column's own maximum is the width the animation is sized against.
              width={Sizes.CONTENT_MAX_WIDTH}
              borderRadius={BorderRadius.BAR}
            />
          ))}
        </View>
      </View>
    </View>
  )

  // The card is also what explains a disabled "Regenerate this week": a failed targets read leaves no revision
  // to pin, and its retry is how the control becomes available again (0.2.5).
  const errorBlock = (): React.JSX.Element => (
    <View style={styles.errorCard}>
      <InfoBanner
        tone="error"
        glyph="alert"
        body={MEAL_PLAN_LOAD_ERROR_TITLE}
        actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        onAction={onRetryReadsPressed}
      />
    </View>
  )

  const settingsBlock = (): React.JSX.Element | null => {
    if (preferences === null) {
      return null
    }

    return (
      <>
        <View style={styles.cardWrapper}>
          <View style={styles.settingsCard}>
            {buildPlanSettingsRows(preferences, targets).map((row, index) => (
              <SettingsRow
                key={row.key}
                label={row.label}
                value={row.value}
                isFirst={index === 0}
                accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE, {
                  label: row.label
                })}
                onPress={() => openRow(row)}
              />
            ))}
          </View>
        </View>

        <View style={styles.footnoteWrapper}>
          <Text style={styles.footnote}>{PLAN_SETTINGS_FOOTNOTE}</Text>
        </View>
      </>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={[styles.content, isConfirmVisible && styles.contentDimmed]}>
        <ContentColumn>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.backRow}>
              <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

              <Text style={styles.backLabel}>{MEAL_PLAN_TITLE}</Text>
            </View>

            <Text style={styles.title}>{PLAN_SETTINGS_TITLE}</Text>

            {banner !== null && (
              <View style={styles.bannerWrapper}>
                <InfoBanner
                  tone="error"
                  glyph="alert"
                  title={banner.title}
                  body={banner.body}
                  actionLabel={banner.actionLabel}
                  onAction={onReviewAffectedPressed}
                />
              </View>
            )}

            {isSettingsLoading && loadingBlock()}

            {hasReadFailure && errorBlock()}

            {!isSettingsLoading && settingsBlock()}
          </ScrollView>
        </ContentColumn>

        <SetupFooter hairline>
          {showUseForNextPlan && (
            <PrimaryButton label={PLAN_SETTINGS_USE_FOR_NEXT_PLAN_BUTTON_TEXT} onPress={onUseForNextPlanPressed} />
          )}

          <SecondaryButton
            label={PLAN_SETTINGS_REGENERATE_BUTTON_TEXT}
            variant="dark"
            disabled={!canRegenerate}
            onPress={() => setIsConfirmVisible(true)}
          />
        </SetupFooter>
      </View>

      {plan !== null && (
        <PlanConfirmDialog
          isVisible={isConfirmVisible}
          title={PLAN_REGENERATE_DIALOG_TITLE}
          body={buildRegenerateDialogBody(plan.startDate, plan.endDate)}
          summaryRows={regenerateRows(plan.summary)}
          confirmLabel={PLAN_REGENERATE_CONFIRM_BUTTON_TEXT}
          dismissLabel={PLAN_REGENERATE_DISMISS_BUTTON_TEXT}
          onConfirm={onConfirmRegeneratePressed}
          onDismiss={() => setIsConfirmVisible(false)}
        />
      )}
    </SafeAreaView>
  )
}

export default PlanSettingsScreen
