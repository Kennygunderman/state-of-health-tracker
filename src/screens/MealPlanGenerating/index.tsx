import React, {useCallback, useEffect, useMemo, useRef} from 'react'

import {ScrollView, View} from 'react-native'

import type {RootStackParamList, StepMode} from '@navigation/types'
import {MealPlanGeneratingRouteProp, Navigation} from '@navigation/types'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useGeneratePlanMutation} from '@queries/mealPlanning/useGeneratePlanMutation'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {useRegeneratePlanMutation} from '@queries/mealPlanning/useRegeneratePlanMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore, {buildPendingIntent, resolveKeyedRequest} from '@store/mealPlan/useMealPlanStore'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import IndeterminateSpinner from '@components/IndeterminateSpinner'
import InfoBanner from '@components/InfoBanner'
import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import SetupFooter from '@components/SetupFooter'
import StatusBadgeCircle from '@components/StatusBadgeCircle'
import SummaryRows from '@components/SummaryRows'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {MEAL_PLAN_ALLERGIES_KEPT_BANNER_BODY} from '@constants/strings'

import LimitingConstraintRows from './components/LimitingConstraintRows'
import styles from './index.styled'
import {
  buildGenerationRequest,
  buildLimitingConstraintRows,
  extractLimitingConstraints,
  GenerationAction,
  LimitingConstraintRow,
  resolveActionRoute,
  resolveConstraintEditRoute,
  resolveConstraintReturnTo,
  resolveGenerationSummary,
  resolveGenerationView,
  resolveTerminalRecovery
} from './index.util'

const MealPlanGeneratingScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanGeneratingRouteProp>()
  const {context, expectedPreferencesRevision, expectedTargetsRevision, idempotencyKey, startDate} = params

  const userId = useAuthStore(state => state.userId)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const preferencesQuery = useMealPlanPreferencesQuery()
  const targetsQuery = useNutritionTargetsQuery()
  const {refetch: refetchCurrentPlan} = useCurrentMealPlanQuery()

  const generateMutation = useGeneratePlanMutation()
  // The regeneration hook closes over the plan it regenerates, so that id travels here rather than in the
  // variables. It is called unconditionally with an empty id on the setup and next-week paths, where it never
  // sends a request: rules-of-hooks forbids skipping the call, and the context decides which one fires.
  const regenerateMutation = useRegeneratePlanMutation(context.kind === 'regenerate' ? context.planId : '')

  const mutation = context.kind === 'regenerate' ? regenerateMutation : generateMutation

  const generationRequest = useMemo(
    () => buildGenerationRequest({context, startDate, expectedPreferencesRevision, expectedTargetsRevision}),
    [context, expectedPreferencesRevision, expectedTargetsRevision, startDate]
  )

  const hasAttempted = useRef(false)
  const recoveredTerminalCode = useRef<string | null>(null)
  const hasRefetchedUnconfirmed = useRef(false)

  const preferences = preferencesQuery.data ?? null
  const targets = targetsQuery.data ?? null

  const view = resolveGenerationView(mutation.status, mutation.error, context)
  const summary = resolveGenerationSummary(view.kind, preferences, targets)
  const constraintRows = buildLimitingConstraintRows(extractLimitingConstraints(mutation.error), preferences)

  const leaveTo = useCallback(
    (route: keyof RootStackParamList): void => {
      // popTo, not navigate: v7 navigate() pushes a second copy of the screen
      // instead of returning to the existing one
      if (route === Screens.PLAN_SETTINGS && context.kind === 'regenerate') {
        navigation.popTo(Screens.PLAN_SETTINGS, {planId: context.planId})

        return
      }

      if (route === Screens.MEAL_PLAN_TARGETS) {
        navigation.popTo(
          Screens.MEAL_PLAN_TARGETS,
          context.kind === 'nextWeek' ? {mode: 'nextWeek', startDate: context.startDate} : {mode: 'setup'}
        )

        return
      }

      navigation.popTo(Screens.MACROS)
    },
    [context, navigation]
  )

  const openConstraintStep = useCallback(
    (row: LimitingConstraintRow): void => {
      const mode: StepMode = {mode: 'edit', returnTo: resolveConstraintReturnTo(context), origin: 'noMatch'}

      switch (resolveConstraintEditRoute(row.editStep)) {
        case Screens.MEAL_PLAN_GOAL:
          navigation.push(Screens.MEAL_PLAN_GOAL, mode)

          return
        case Screens.MEAL_PLAN_DIET:
          navigation.push(Screens.MEAL_PLAN_DIET, mode)

          return
        case Screens.MEAL_PLAN_FOOD_PREFERENCES:
          navigation.push(Screens.MEAL_PLAN_FOOD_PREFERENCES, mode)

          return
        case Screens.MEAL_PLAN_SCHEDULE:
          navigation.push(Screens.MEAL_PLAN_SCHEDULE, mode)

          return
        case Screens.MEAL_PLAN_COOKING_BUDGET:
          navigation.push(Screens.MEAL_PLAN_COOKING_BUDGET, mode)

          return
        default:
          navigation.push(Screens.MEAL_PLAN_TARGETS, mode)

          return
      }
    },
    [context, navigation]
  )

  const attempt = useCallback(async (): Promise<void> => {
    const now = Date.now()

    const plan =
      userId === null
        ? {idempotencyKey, request: generationRequest}
        : resolveKeyedRequest(useMealPlanStore.getState(), generationRequest, userId, now, idempotencyKey)

    if (userId !== null) {
      recordPendingIntent(buildPendingIntent(plan.request, plan.idempotencyKey, userId, now))
    }

    recoveredTerminalCode.current = null
    hasRefetchedUnconfirmed.current = false

    try {
      if (context.kind === 'regenerate') {
        await regenerateMutation.mutateAsync({
          idempotencyKey: plan.idempotencyKey,
          expectedPlanRevision: context.planRevision,
          expectedPreferencesRevision,
          expectedTargetsRevision
        })
      } else {
        await generateMutation.mutateAsync({
          startDate: plan.request.action === 'generate' ? plan.request.startDate : startDate,
          idempotencyKey: plan.idempotencyKey,
          expectedPreferencesRevision,
          expectedTargetsRevision
        })
      }

      clearPendingIntent(generationRequest.action)
      setMacrosSegment('mealPlan')
      leaveTo(Screens.MACROS)
    } catch (error) {
      const outcome = resolveGenerationView('error', error, context).kind

      if (outcome === 'failed' || outcome === 'noMatch') {
        clearPendingIntent(generationRequest.action)
      }
    }
  }, [
    clearPendingIntent,
    context,
    expectedPreferencesRevision,
    expectedTargetsRevision,
    generateMutation,
    generationRequest,
    idempotencyKey,
    leaveTo,
    recordPendingIntent,
    regenerateMutation,
    setMacrosSegment,
    startDate,
    userId
  ])

  useEffect(() => {
    if (hasAttempted.current) {
      return
    }

    hasAttempted.current = true
    attempt()
  }, [attempt])

  useEffect(() => {
    const recovery = resolveTerminalRecovery(view.terminalCode, context)

    if (view.terminalCode === null || recovery === null || recoveredTerminalCode.current === view.terminalCode) {
      return
    }

    recoveredTerminalCode.current = view.terminalCode

    if (recovery.clearsPendingIntent) {
      clearPendingIntent(generationRequest.action)
    }

    if (recovery.refetchesCurrentPlan) {
      refetchCurrentPlan()
    }

    if (recovery.toast !== null) {
      showToast('error', recovery.toast)
    }

    if (recovery.route !== null) {
      leaveTo(recovery.route)
    }
  }, [clearPendingIntent, context, generationRequest.action, leaveTo, refetchCurrentPlan, view.terminalCode])

  useEffect(() => {
    if (view.kind !== 'unconfirmed' || hasRefetchedUnconfirmed.current) {
      return
    }

    hasRefetchedUnconfirmed.current = true
    refetchCurrentPlan()
  }, [refetchCurrentPlan, view.kind])

  const onActionPressed = useCallback(
    (action: GenerationAction): void => {
      const route = resolveActionRoute(action.kind, context)

      if (route !== null) {
        if (view.kind !== 'unconfirmed') {
          clearPendingIntent(generationRequest.action)
        }

        leaveTo(route)

        return
      }

      if (mutation.isPending) {
        return
      }

      attempt()
    },
    [attempt, clearPendingIntent, context, generationRequest.action, leaveTo, mutation.isPending, view.kind]
  )

  const isInFlight = view.kind === 'pending'
  const primaryAction = view.actions?.primary ?? null
  const secondaryAction = view.actions?.secondary ?? null

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, view.isCentered && styles.scrollContentCentered]}>
          <View style={[styles.contentBlock, view.isCentered && styles.contentBlockCentered]}>
            {(view.showSpinner || view.badgeVariant !== null) && (
              <View style={[!view.isCentered && styles.badgeBlock]}>
                {view.showSpinner && <IndeterminateSpinner />}

                {view.badgeVariant !== null && <StatusBadgeCircle variant={view.badgeVariant} />}
              </View>
            )}

            {!!view.headline && (
              <View style={isInFlight ? styles.headlineBlockPending : styles.headlineBlock}>
                <Text
                  accessibilityRole={isInFlight ? 'header' : 'alert'}
                  accessibilityLiveRegion={isInFlight ? 'polite' : 'assertive'}
                  style={[
                    styles.headline,
                    view.headlineSize === 'alternate' && styles.headlineAlternate,
                    view.isCentered && styles.textCentered
                  ]}>
                  {view.headline}
                </Text>
              </View>
            )}

            {!!view.body && (
              <View style={styles.bodyBlock}>
                <Text style={[styles.body, view.isCentered && styles.textCentered]}>{view.body}</Text>
              </View>
            )}

            {summary !== null && (
              <View style={styles.cardBlock}>
                <View style={styles.summaryCard}>
                  <SummaryRows rows={summary.rows} overline={summary.overline} valueSize="body" />
                </View>
              </View>
            )}

            {view.kind === 'noMatch' && constraintRows.length > 0 && (
              <View style={styles.constraintCardBlock}>
                <LimitingConstraintRows rows={constraintRows} onEditConstraint={openConstraintStep} />
              </View>
            )}

            {view.showAllergiesBanner && (
              <View style={styles.bannerBlock}>
                <InfoBanner tone="success" glyph="info" body={MEAL_PLAN_ALLERGIES_KEPT_BANNER_BODY} />
              </View>
            )}
          </View>
        </ScrollView>
      </ContentColumn>

      {primaryAction !== null && (
        <SetupFooter>
          <PrimaryButton
            label={primaryAction.label}
            disabled={mutation.isPending}
            onPress={() => onActionPressed(primaryAction)}
          />

          {secondaryAction !== null && (
            <SecondaryButton
              label={secondaryAction.label}
              variant="dark"
              onPress={() => onActionPressed(secondaryAction)}
            />
          )}
        </SetupFooter>
      )}
    </SafeAreaView>
  )
}

export default MealPlanGeneratingScreen
