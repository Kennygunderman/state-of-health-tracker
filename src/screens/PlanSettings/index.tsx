import React, {useCallback, useEffect, useRef, useState} from 'react'

import {AccessibilityInfo, Platform, ScrollView, View} from 'react-native'

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
import {useSavePreferencesMutation} from '@queries/mealPlanning/useSavePreferencesMutation'
import {useFocusEffect, useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
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
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_TITLE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  PLAN_REGENERATE_CONFIRM_BUTTON_TEXT,
  PLAN_REGENERATE_DIALOG_TITLE,
  PLAN_REGENERATE_DISMISS_BUTTON_TEXT,
  PLAN_SETTINGS_BANNER_ANNOUNCEMENT_TEMPLATE,
  PLAN_SETTINGS_FOOTNOTE,
  PLAN_SETTINGS_REGENERATE_BUTTON_TEXT,
  PLAN_SETTINGS_ROW_ACCESSIBILITY_TEMPLATE,
  PLAN_SETTINGS_TITLE,
  PLAN_SETTINGS_USE_FOR_NEXT_PLAN_BUTTON_TEXT,
  stringWithNamedParameters
} from '@constants/strings'

import PlanConfirmDialog, {PlanConfirmNotice} from './components/PlanConfirmDialog'
import SettingsRow from './components/SettingsRow'
import styles, {regenerateSummaryValueColor} from './index.styled'
import {
  buildPlanSettingsRows,
  buildRegenerateDialogBody,
  buildRegenerateSummaryRows,
  canSubmitRegeneration,
  derivePlanSettingsBanner,
  deriveRegenerateConfirmState,
  earliestFlaggedDate,
  nextPlanAcknowledgementTarget,
  PlanSettingsRow,
  RegenerateLatchEvent,
  reconcilePreferencesTimeZone,
  resolveRegenerateLatch,
  resolveRegenerateLaunch,
  shouldRecalculateTargets,
  shouldShowUseForNextPlan
} from './index.util'

// Four row-height bars, so the placeholder carries the settings card's own rhythm rather than one block of
// an unrelated height.
const SKELETON_ROW_HEIGHTS: number[] = [Sizes.CONTROL_LG, Sizes.CONTROL_LG, Sizes.CONTROL_LG, Sizes.CONTROL]

// The randomness a key is minted from, entering at the press that decides to mint (0.7.2). Module scope so
// the launch decision is handed the same source on every render.
const mintRegenerateKey = (): string => mintKey(uuidv4)

/**
 * Frames 16 / 16b: the seven saved answers of the running plan, the flagged-meals banner, and the two ways an
 * edit can be applied.
 *
 * Every row was already persisted by its own "Save changes", so this screen writes nothing through its own
 * controls: `buildPlanSettingsRows` hands it navigation descriptors it dispatches, "Use for next plan" is an
 * acknowledgement that navigates and mutates nothing (AAP 0.7.4), and "Regenerate this week" confirms through
 * 16b, resolves which key that write must carry against the regeneration already on record, and hands it to
 * `MealPlanGenerating`, which sends it from there.
 *
 * Its one write is not a control at all: the full preferences save carries the device's time zone when it no
 * longer matches the stored one, which is the refresh AAP 0.5.2 requires of every such save. See the effect
 * below for why it belongs here and why it is silent.
 */
const PlanSettingsScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<PlanSettingsRouteProp>()

  const userId = useAuthStore(state => state.userId)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  // Subscribed, not read at the press: a confirmation decided before the persisted slice arrived would
  // conclude that no regeneration was pending, and this is what re-renders the screen when it does arrive.
  const hasHydratedIntents = useMealPlanStore(state => state.hasHydratedIntents)
  // The same read in all three of its states. The press keeps gating on the boolean, which is 'succeeded'
  // alone and so fails closed; the dialog needs the third case to say whether it is waiting on that read or
  // refused by it.
  const intentsHydration = useMealPlanStore(state => state.intentsHydration)
  const retryIntentsHydration = useMealPlanStore(state => state.retryIntentsHydration)

  const preferencesQuery = useMealPlanPreferencesQuery()
  const targetsQuery = useNutritionTargetsQuery()
  const currentPlanQuery = useCurrentMealPlanQuery()
  const affectedMealsQuery = useAffectedMealsQuery(params.planId)
  const {mutateAsync: savePreferences} = useSavePreferencesMutation()

  const [isConfirmVisible, setIsConfirmVisible] = useState(false)
  // Held while the zone reconciliation and the refetches it triggers are in flight, because that save moves
  // the very revisions "Regenerate this week" pins.
  const [isReconcilingTimeZone, setIsReconcilingTimeZone] = useState(false)
  // Keyed on the zone rather than set once, so a save that failed is retried on the next open and a server
  // that stored a different spelling of the same zone cannot start a loop.
  const reconciledTimeZone = useRef<string | null>(null)

  /**
   * Held from the moment a confirmation dispatches a launch until a re-launch is legitimate again. A ref
   * rather than state because it has to stop the very next press in the same tick: two queued taps on the
   * dialog's confirm both run before React re-renders it away, and each would otherwise file its own key into
   * the single `pendingIntents.regenerate` slot — one user intent, two keys, the second burying the first.
   */
  const isLaunchLatched = useRef(false)

  /**
   * The same latch as a render, because a ref is deliberately invisible to React: the guard above is what
   * makes a second press decide nothing, and this is what makes the button say so. Never written on its own
   * — `applyRegenerateLatch` sets both from one `resolveRegenerateLatch` answer, so the button cannot read
   * as available while the ref is refusing presses, or as busy while it is not.
   */
  const [isLaunchDispatched, setIsLaunchDispatched] = useState(false)

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

  // The alert as VoiceOver has to be given it: one string carrying the same title and body the banner draws.
  const bannerAnnouncement =
    banner === null
      ? null
      : stringWithNamedParameters(PLAN_SETTINGS_BANNER_ANNOUNCEMENT_TEMPLATE, {title: banner.title, body: banner.body})

  const announcedBanner = useRef<string | null>(null)

  useEffect(() => {
    // iOS honours neither half of the wrapper's markup: `accessibilityRole="alert"` sets traits on a view that
    // is not an accessibility element (it deliberately lacks `accessible`, which would swallow the 'Review
    // affected meals' pill) and `accessibilityLiveRegion` is Android-only in RN 0.86 — so the appearing alert
    // is announced here instead, and Android is left to its live region rather than told twice. Guarded by the
    // message announced, so a re-render or a refetch answering the same flags does not repeat it.
    if (bannerAnnouncement === null || bannerAnnouncement === announcedBanner.current) {
      return
    }

    announcedBanner.current = bannerAnnouncement

    if (Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(bannerAnnouncement)
    }
  }, [bannerAnnouncement])

  const showUseForNextPlan =
    plan !== null &&
    shouldShowUseForNextPlan({hasIncompatibilities: plan.hasIncompatibilities, targetsStale: plan.targetsStale})

  // Regeneration pins three revisions, and two of them come from these queries. The targets pin is only real
  // once the targets read has answered: `NO_TARGETS_REVISION` states "there is no prior revision" and is
  // honest only when the server said so, so while that read is loading or failed there is no pin to send and
  // this stays null — a fabricated one earns a targets refusal the user cannot act on (0.2.5, 0.5.2).
  const targetsRevision = targetsQuery.isSuccess ? (targets?.revision ?? NO_TARGETS_REVISION) : null

  // A read that has not answered is not silently disabling: the card below explains it and offers the retry
  // that makes this control available again. The zone reconciliation below is the fourth term, because it
  // moves the revisions a regeneration pins — see `canSubmitRegeneration`.
  const canRegenerate = canSubmitRegeneration({
    hasPlan: plan !== null,
    hasPreferences: preferences !== null,
    hasTargetsRevision: targetsRevision !== null,
    isReconcilingTimeZone
  })

  /**
   * Runs the stored-zone reconciliation once per mount, and only when the two zones actually disagree — which
   * makes it a no-op for everyone who has not travelled. The decision, the `409 stale_revision` recovery and
   * the single re-submission all live in `reconcilePreferencesTimeZone`, where they are tested; this effect
   * supplies the collaborators and records what came back.
   *
   * It is silent by design: nobody asked for it, so nothing it does may interrupt the user. `failed` is the
   * one retryable outcome and it is retried by reopening the screen, which is why the guard below is keyed on
   * the zone rather than set once.
   */
  useEffect(() => {
    if (preferences === null || preferences.timeZone === null) {
      return
    }

    const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    if (deviceTimeZone === preferences.timeZone || reconciledTimeZone.current === deviceTimeZone) {
      return
    }

    reconciledTimeZone.current = deviceTimeZone
    setIsReconcilingTimeZone(true)

    reconcilePreferencesTimeZone({
      storedTimeZone: preferences.timeZone,
      deviceTimeZone,
      expectedRevision: preferences.revision,
      savePreferences,
      refetchPreferences: async () => (await preferencesQuery.refetch()).data ?? null
    })
      .then(outcome => {
        if (outcome === 'failed') {
          reconciledTimeZone.current = null
        }
      })
      .finally(() => {
        setIsReconcilingTimeZone(false)
      })
    // `preferencesQuery` is read for its stable `refetch` only; listing the query object itself would retrigger
    // this on every render, because TanStack rebuilds that result each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences, savePreferences])

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
    const earliest = earliestFlaggedDate(affectedMealsQuery.data ?? [])

    // Both the helper and the setter admit null, so a set that emptied between this render and this press would
    // otherwise clear the day the user had chosen — the plan tab would reopen on its default day instead of the
    // one they were reading.
    if (earliest !== null) {
      setSelectedPlanDate(earliest)
    }

    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [affectedMealsQuery.data, navigation, setMacrosSegment, setSelectedPlanDate])

  /**
   * One latch event, applied to the guard and to what the dialog draws. The ref is written first and
   * synchronously — that is the half that stops the very next press in the same tick — and the state write
   * React applies on a later render is what the confirm button reads. Both take the same value from the same
   * rule, so `resolveRegenerateLatch` stays the only place the lifecycle is decided.
   */
  const applyRegenerateLatch = useCallback((event: RegenerateLatchEvent): void => {
    const isLatched = resolveRegenerateLatch(event)

    isLaunchLatched.current = isLatched
    setIsLaunchDispatched(isLatched)
  }, [])

  const onRegeneratePressed = useCallback(() => {
    // Reopening 16b is a new user intent, so the latch the last launch left is released here — this press is
    // also the only way back to the confirmation, which is what keeps the button from dying for the session.
    applyRegenerateLatch('confirmReopened')
    setIsConfirmVisible(true)
  }, [applyRegenerateLatch])

  useFocusEffect(
    useCallback(() => {
      // Returning to this screen means the launch this latch was guarding has ended: the generating screen it
      // dispatched is gone, so a further confirmation is a new intent rather than a duplicate of that one —
      // and an intent still unresolved is replayed under its own key rather than minted over.
      applyRegenerateLatch('screenFocused')
    }, [applyRegenerateLatch])
  )

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
    const decision = resolveRegenerateLaunch({
      isLaunchLatched: isLaunchLatched.current,
      hasHydratedIntents,
      // Read at the press rather than subscribed: the record a launch may not overwrite is whatever is on
      // disk at this moment, and nothing on this screen renders from it.
      state: useMealPlanStore.getState(),
      plan: plan === null ? null : {id: plan.id, revision: plan.revision, startDate: plan.startDate},
      expectedPreferencesRevision: preferences?.revision ?? null,
      expectedTargetsRevision: targetsRevision,
      userId,
      attemptedAt: Date.now(),
      mintFreshKey: mintRegenerateKey
    })

    // A press the decision declined — a launch already dispatched, a pin that has not answered, or a slice
    // still on its way out of storage — leaves the dialog up, so the next press decides again.
    if (decision.kind === 'ignored') {
      return
    }

    // Latched synchronously, ahead of every record and every dispatch: `setIsConfirmVisible(false)` is a state
    // write React applies on a later render, so a second queued press would otherwise run this body again and
    // file a second key for one user intent. The same call puts the confirm button into its pending state,
    // which is the user-visible half of that refusal rather than the guarantee behind it.
    applyRegenerateLatch('launchDispatched')
    setIsConfirmVisible(false)

    // An unresolved regeneration of another plan holds the one slot this screen could record into. It is not
    // this week's to replay and not this press's to overwrite, so the press goes to the plan tab, which owns
    // reconstructing a generation from a persisted intent.
    if (decision.kind === 'handOff') {
      setMacrosSegment('mealPlan')
      navigation.popTo(Screens.MACROS)

      return
    }

    // Recorded before the screen that sends it has even mounted, so a launch killed in between still finds
    // this key and asks again under it rather than committing a second plan (0.7.2). The record is the
    // decision's own, which is what ties the stored fingerprint to the request below: the generating screen
    // rebuilds that snapshot from these params and recognises the key as its own instead of minting.
    if (decision.intent !== null) {
      recordPendingIntent(decision.intent)
    }

    navigation.navigate(Screens.MEAL_PLAN_GENERATING, decision.params)
  }, [
    applyRegenerateLatch,
    hasHydratedIntents,
    navigation,
    plan,
    preferences,
    recordPendingIntent,
    setMacrosSegment,
    targetsRevision,
    userId
  ])

  // What the confirmation draws, from the two facts that make a press decide nothing: this screen's own latch
  // and the persisted read the launch may not mint ahead of. A declined press is otherwise indistinguishable
  // from an ignored one — the dialog stays up, nothing moves, and the button still invites the tap.
  const confirmState = deriveRegenerateConfirmState({isLaunchDispatched, intentsHydration})

  // A refused read of the persisted intents is the one reason the confirmation is disabled rather than busy:
  // the slice may already hold the key of a regeneration that committed, so nothing may be minted until a
  // read succeeds — and asking storage again is the only way out of it.
  const confirmNotice: PlanConfirmNotice | undefined =
    confirmState.reason === 'failedIntentsRead'
      ? {
          body: MEAL_PLAN_LOAD_ERROR_TITLE,
          actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
          onAction: retryIntentsHydration
        }
      : undefined

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
                accessibilityLabel={stringWithNamedParameters(PLAN_SETTINGS_ROW_ACCESSIBILITY_TEMPLATE, {
                  label: row.label,
                  value: row.value
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
              // Announced as an alert here rather than inside InfoBanner, which serves ten frames in tones that
              // are not alerts. The role is set without `accessible`, deliberately: grouping the wrapper would
              // swallow the pill inside it, and the pill must stay reachable immediately after the announcement.
              <View style={styles.bannerWrapper} accessibilityRole="alert" accessibilityLiveRegion="polite">
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
            onPress={onRegeneratePressed}
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
          isConfirmPending={confirmState.isPending}
          isConfirmDisabled={confirmState.isDisabled}
          notice={confirmNotice}
          onConfirm={onConfirmRegeneratePressed}
          onDismiss={() => setIsConfirmVisible(false)}
        />
      )}
    </SafeAreaView>
  )
}

export default PlanSettingsScreen
