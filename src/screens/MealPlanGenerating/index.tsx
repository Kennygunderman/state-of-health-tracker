import React, {useCallback, useEffect, useMemo, useRef} from 'react'

import {ScrollView, View} from 'react-native'

import type {MealPlan} from '@data/models/MealPlan'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
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
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {SafeAreaView} from 'react-native-safe-area-context'

import ContentColumn from '@components/ContentColumn'
import IndeterminateSpinner from '@components/IndeterminateSpinner'
import InfoBanner from '@components/InfoBanner'
import PrimaryButton from '@components/PrimaryButton'
import SecondaryButton from '@components/SecondaryButton'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
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

// Shaped like the loaded preference card — its overline and three label/value rows — rather than one block of
// a different height.
const SUMMARY_SKELETON_HEIGHTS: number[] = [
  Sizes.SKELETON_BAR_SM,
  Sizes.SKELETON_BAR,
  Sizes.SKELETON_BAR,
  Sizes.SKELETON_BAR
]

/**
 * Frames 10 / 10b / 10c. The attempt is keyed: the intent is recorded before the request leaves and retired
 * only by a server answer to that key, so a response lost in transit is asked again rather than committing a
 * second plan (AAP 0.7.2). Every drawn state comes from `index.util`; this file applies what that derivation
 * names — the same-key replay, the terminal recovery and the display-only refetch.
 */
const MealPlanGeneratingScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanGeneratingRouteProp>()
  const {returnFromTargets} = useHomeTabsNavigation()

  const userId = useAuthStore(state => state.userId)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setSelectedPlanId = useMealPlanStore(state => state.setSelectedPlanId)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const preferencesQuery = useMealPlanPreferencesQuery()
  const targetsQuery = useNutritionTargetsQuery()
  const currentPlanQuery = useCurrentMealPlanQuery()
  const {context, expectedPreferencesRevision, expectedTargetsRevision, idempotencyKey, startDate} = params

  const generateMutation = useGeneratePlanMutation()
  // The regeneration hook closes over the plan it regenerates, so the id travels here rather than in the
  // variables. Called unconditionally with an empty id on the setup and next-week paths, where it is never
  // fired: rules-of-hooks forbids skipping the call, and `hasAttempted` gates the only `mutate` it has.
  const regenerateMutation = useRegeneratePlanMutation(context.kind === 'regenerate' ? context.planId : '')

  // Rebuilt from the route's own params rather than held in memory by whatever navigated here, so a cold start
  // reconstructs the byte-identical request the stored key was minted for.
  const generationRequest = useMemo(
    () => buildGenerationRequest({context, startDate, expectedPreferencesRevision, expectedTargetsRevision}),
    [context, expectedPreferencesRevision, expectedTargetsRevision, startDate]
  )

  const mutation = context.kind === 'regenerate' ? regenerateMutation : generateMutation

  // One attempt per mount, and both recovery guards are per-attempt: a retry's recovery must not be skipped
  // because the previous attempt already applied its own.
  const hasAttempted = useRef(false)
  const recoveredTerminalCode = useRef<string | null>(null)
  const hasRefetchedUnconfirmed = useRef(false)

  const preferences = preferencesQuery.data ?? null
  const targets = targetsQuery.data ?? null

  const view = resolveGenerationView(mutation.status, mutation.error, context)
  const summary = resolveGenerationSummary(view.kind, preferences, targets)
  const constraintRows = buildLimitingConstraintRows(extractLimitingConstraints(mutation.error), preferences)

  // The plan-state and capability refusals answer with a destination instead of a card, so they draw neither
  // copy nor footer. That frame keeps the spinner and 10's centring rather than painting an empty column while
  // the recovery below navigates.
  const isLeavingTerminal = view.kind === 'terminal' && view.actions === null
  const isCentered = view.isCentered || isLeavingTerminal

  // Two of the three destinations are screens this one was opened from, so they return through the
  // targets-return dispatcher — a `popTo` that keeps the target's own params — rather than pushing a second
  // copy.
  const leaveTo = useCallback(
    (route: keyof RootStackParamList): void => {
      switch (route) {
        case Screens.MACROS:
          navigation.popTo(Screens.MACROS)

          return
        case Screens.PLAN_SETTINGS:
          returnFromTargets({kind: 'stack', route: 'settings'})

          return
        case Screens.MEAL_PLAN_TARGETS:
          returnFromTargets({kind: 'stack', route: 'review'})

          return
        default:
          // `resolveActionRoute` and `resolveTerminalRecovery` name only the three routes above. A fourth would
          // be a destination this screen has no way back from, so it is not navigated to blindly.
          return
      }
    },
    [navigation, returnFromTargets]
  )

  const openConstraintStep = useCallback(
    (row: LimitingConstraintRow): void => {
      const mode: StepMode = {mode: 'edit', returnTo: resolveConstraintReturnTo(context), origin: 'noMatch'}

      // Every route the constraint table names takes a `StepMode`, but `navigate` types its params per route,
      // so the literal name has to be matched before the call rather than passed through as a variable.
      switch (resolveConstraintEditRoute(row.editStep)) {
        case Screens.MEAL_PLAN_GOAL:
          navigation.navigate(Screens.MEAL_PLAN_GOAL, mode)

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
        case Screens.MEAL_PLAN_TARGETS:
          navigation.navigate(Screens.MEAL_PLAN_TARGETS, mode)

          return
        default:
          // The table maps every setup step to one of the six routes above, and an unknown step is normalised
          // to Review by `resolveConstraintEditRoute`, so no other value can arrive here.
          return
      }
    },
    [context, navigation]
  )

  const onGenerated = useCallback(
    (generated: MealPlan): void => {
      // A server answer to this key resolves the intent, whether it committed now or replayed a stored result.
      clearPendingIntent(generationRequest.action)
      setSelectedPlanId(generated.id)
      // Setup finishes on the Macros tab's plan segment: the plan the user just asked for is what they came
      // here to see, and the diary segment would hide it behind a control they never touched.
      setMacrosSegment('mealPlan')
      navigation.popTo(Screens.MACROS)
    },
    [clearPendingIntent, generationRequest.action, navigation, setMacrosSegment, setSelectedPlanId]
  )

  // No failure path on purpose: the card an error draws comes from the mutation's own state, and the only
  // thing that may retire the key — the terminal recovery — runs in its own effect below. Nothing here
  // navigates on failure.
  const attempt = useCallback((): void => {
    const now = Date.now()

    // The store owns the replay decision (0.7.2): an unresolved intent whose fingerprint matches this very
    // request answers with the key it was minted for, so a lost response is asked again under that key rather
    // than committing a second plan. Anything else goes out under the key the press minted.
    const plan =
      userId === null
        ? {idempotencyKey, isReplay: false, request: generationRequest}
        : resolveKeyedRequest(useMealPlanStore.getState(), generationRequest, userId, now, idempotencyKey)

    // Recorded before the request leaves, which is what makes a lost response recoverable at all. An attempt
    // with no signed-in user to scope the record to is not persisted: `pendingIntents` is keyed by user, and an
    // unattributed entry could be replayed by whoever signs in next.
    if (userId !== null) {
      recordPendingIntent(buildPendingIntent(plan.request, plan.idempotencyKey, userId, now))
    }

    recoveredTerminalCode.current = null
    hasRefetchedUnconfirmed.current = false

    if (context.kind === 'regenerate') {
      regenerateMutation.mutate(
        {
          idempotencyKey: plan.idempotencyKey,
          expectedPlanRevision: context.planRevision,
          expectedPreferencesRevision,
          expectedTargetsRevision
        },
        {onSuccess: onGenerated}
      )

      return
    }

    generateMutation.mutate(
      {
        // The start date the snapshot carries — for a next-week generation the context's own copy rather than
        // the route's — read back from it instead of being decided a second time here.
        startDate: generationRequest.action === 'generate' ? generationRequest.startDate : startDate,
        idempotencyKey: plan.idempotencyKey,
        expectedPreferencesRevision,
        expectedTargetsRevision
      },
      {onSuccess: onGenerated}
    )
  }, [
    context,
    expectedPreferencesRevision,
    expectedTargetsRevision,
    generateMutation,
    generationRequest,
    idempotencyKey,
    onGenerated,
    recordPendingIntent,
    regenerateMutation,
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

    // Applied once per outcome: the effect re-runs whenever a query object identity changes, and a second pass
    // would toast and navigate again for an answer already recovered from.
    if (view.terminalCode === null || recovery === null || recoveredTerminalCode.current === view.terminalCode) {
      return
    }

    recoveredTerminalCode.current = view.terminalCode

    if (recovery.clearsPendingIntent) {
      clearPendingIntent(generationRequest.action)
    }

    if (recovery.refetchesCurrentPlan) {
      currentPlanQuery.refetch()
    }

    if (recovery.toast !== null) {
      showToast('error', recovery.toast)
    }

    if (recovery.route !== null) {
      leaveTo(recovery.route)
    }
  }, [clearPendingIntent, context, currentPlanQuery, generationRequest.action, leaveTo, view.terminalCode])

  useEffect(() => {
    if (view.kind !== 'unconfirmed' || hasRefetchedUnconfirmed.current) {
      return
    }

    hasRefetchedUnconfirmed.current = true
    // Display-only (0.2.5): it warms the plan this attempt may already have committed, so the tab shows it the
    // moment the user leaves. It never resolves or clears the pending intent — only a server answer to the same
    // key does, which is what "Try again" asks for.
    currentPlanQuery.refetch()
  }, [currentPlanQuery, view.kind])

  const onActionPressed = useCallback(
    (action: GenerationAction): void => {
      const route = resolveActionRoute(action.kind, context)

      if (route === null) {
        // Retry stays on this screen and replays the same key: the intent recorded for this request still
        // matches it, so the server answers with its stored result instead of generating a second plan.
        attempt()

        return
      }

      leaveTo(route)
    },
    [attempt, context, leaveTo]
  )

  const badgeBlock = (): React.JSX.Element | null => {
    if (view.showSpinner || isLeavingTerminal) {
      return (
        <View style={styles.badgeBlock}>
          <IndeterminateSpinner />
        </View>
      )
    }

    if (view.badgeVariant === null) {
      return null
    }

    return (
      <View style={styles.badgeBlock}>
        <StatusBadgeCircle variant={view.badgeVariant} />
      </View>
    )
  }

  const summaryPlaceholder = (): React.JSX.Element => (
    <View style={styles.cardBlock}>
      <View style={styles.summaryCard}>
        {SUMMARY_SKELETON_HEIGHTS.map((height, index) => (
          <View key={`${height}-${index}`} style={styles.bodyBlock}>
            <SkeletonBlock
              height={height}
              // The stretch style overrides this, but Skeleton drives its shimmer sweep from the prop, so the
              // column's own maximum is the width the animation is sized against.
              width={Sizes.CONTENT_MAX_WIDTH}
              borderRadius={BorderRadius.BAR}
              style={styles.contentBlock}
            />
          </View>
        ))}
      </View>
    </View>
  )

  const summaryBlock = (): React.JSX.Element | null => {
    if (summary !== null) {
      return (
        <View style={styles.cardBlock}>
          <View style={styles.summaryCard}>
            <SummaryRows rows={summary.rows} overline={summary.overline} />
          </View>
        </View>
      )
    }

    // Only 10 and 10b draw a card at all; the other states answer with a constraint card or leave the screen.
    const drawsCard = view.kind === 'pending' || view.kind === 'failed'

    return drawsCard && preferencesQuery.isLoading ? summaryPlaceholder() : null
  }

  const footer = (): React.JSX.Element | null => {
    if (view.actions === null) {
      return null
    }

    const {primary, secondary} = view.actions

    return (
      <SetupFooter>
        <PrimaryButton label={primary.label} onPress={() => onActionPressed(primary)} />

        {secondary !== null && (
          <SecondaryButton label={secondary.label} variant="dark" onPress={() => onActionPressed(secondary)} />
        )}
      </SetupFooter>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, isCentered && styles.scrollContentCentered]}>
          <View style={[styles.contentBlock, isCentered && styles.contentBlockCentered]}>
            {badgeBlock()}

            {!!view.headline && (
              <View style={view.kind === 'pending' ? styles.headlineBlockPending : styles.headlineBlock}>
                <Text
                  style={[
                    styles.headline,
                    view.headlineSize === 'alternate' && styles.headlineAlternate,
                    isCentered && styles.textCentered
                  ]}>
                  {view.headline}
                </Text>
              </View>
            )}

            {!!view.body && (
              <View style={styles.bodyBlock}>
                <Text style={[styles.body, isCentered && styles.textCentered]}>{view.body}</Text>
              </View>
            )}

            {summaryBlock()}

            {constraintRows.length > 0 && view.kind === 'noMatch' && (
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

      {footer()}
    </SafeAreaView>
  )
}

export default MealPlanGeneratingScreen
