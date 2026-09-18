import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {ScrollView, View} from 'react-native'

import type {CurrentMealPlans} from '@data/models/MealPlan'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import type {RootStackParamList, StepMode} from '@navigation/types'
import {MealPlanGeneratingRouteProp, Navigation} from '@navigation/types'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useGeneratePlanMutation} from '@queries/mealPlanning/useGeneratePlanMutation'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useNutritionTargetsQuery} from '@queries/mealPlanning/useNutritionTargetsQuery'
import {useRegeneratePlanMutation} from '@queries/mealPlanning/useRegeneratePlanMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
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
  GenerationRequestSnapshot,
  GenerationTerminalRecovery,
  LimitingConstraintRow,
  resolveActionRoute,
  resolveConstraintEditRoute,
  resolveConstraintReturnTo,
  resolveGenerationLaunch,
  resolveGenerationSummary,
  resolveGenerationView,
  resolveIntentRefusal,
  resolveSettledGenerationPlanId,
  resolveTerminalRecovery,
  resolveUpcomingPlanId
} from './index.util'

const MealPlanGeneratingScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<MealPlanGeneratingRouteProp>()
  const {context, expectedPreferencesRevision, expectedTargetsRevision, idempotencyKey, startDate} = params

  const userId = useAuthStore(state => state.userId)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setSelectedPlanId = useMealPlanStore(state => state.setSelectedPlanId)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)
  // Subscribed, not read at the attempt: this screen sends on mount, and the persisted intent slice arrives
  // from AsyncStorage after that first frame — so the launch decision has to be re-taken when the read lands
  // rather than concluding on a frame where nothing was knowable yet (0.7.2).
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  const hasHydratedIntents = useMealPlanStore(state => state.hasHydratedIntents)
  // The same read in all three of its states. The launch gates on the boolean, which is 'succeeded' alone and
  // so fails closed; the banner below needs the third case to say that the read was refused and offer it again.
  const intentsHydration = useMealPlanStore(state => state.intentsHydration)
  const retryIntentsHydration = useMealPlanStore(state => state.retryIntentsHydration)

  // A confirmed `503 feature_disabled` from ANY gated route — this screen's own reads, or the keyed generation
  // it sends — is terminal for a gated screen: no recovery that stays here can succeed, so the guard leaves
  // for the Meal Plan segment, which states the refusal once (AAP 0.2.5). Every other failure, including a
  // lost response or an undecodable body, is untouched and still retryable in place.
  const {isGatedRequestAllowed} = useMealPlanCapabilityGuard()

  const preferencesQuery = useMealPlanPreferencesQuery()
  const targetsQuery = useNutritionTargetsQuery()
  // Gated like every other reader of `/meal-planning/plans/current`: no gated request may be issued once the
  // capability latch has flipped, and a mounted observer would otherwise keep asking on every remount, focus
  // and reconnect (AAP 0.2.5, 0.7.5).
  const {data: currentPlans, refetch: refetchCurrentPlanRoute} = useCurrentMealPlanQuery(isGatedRequestAllowed)

  // The re-read both recoveries below depend on, and the one thing `enabled` does not cover: `refetch` fetches
  // whatever the option says, which is how an already-open screen kept probing a route that had just refused
  // it. Once the latch has flipped this answers from the entry already in hand instead — a recovery still has
  // to resolve against whatever answer exists, and the unavailable family's own recovery leaves for the tab
  // that explains the refusal either way (AAP 0.2.5, 0.7.5).
  const readCurrentPlans = useCallback(
    async (): Promise<CurrentMealPlans | undefined> =>
      isGatedRequestAllowed ? (await refetchCurrentPlanRoute()).data : currentPlans,
    [currentPlans, isGatedRequestAllowed, refetchCurrentPlanRoute]
  )

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

  // One clock for this mount: the stored intent's 7-day life is day-granular, so re-reading the clock on every
  // render could only let two readings of the same day disagree — and it is what keeps the decision below
  // stable while the persisted read is still out.
  const attemptedAt = useMemo(() => Date.now(), [])

  /**
   * Whether this screen's generation may leave at all, and under which key. Taken from the state of the
   * ACTION's one intent slot rather than from the route's key alone: an unresolved generation on disk may
   * already have committed, so a key minted beside it would abandon the only key that could reconcile that
   * write and would ask the server for a second plan (AAP 0.7.2).
   */
  const launch = useMemo(
    () =>
      resolveGenerationLaunch({
        pendingIntents,
        userId,
        request: generationRequest,
        hasHydratedIntents,
        intentsHydration,
        idempotencyKey,
        attemptedAt
      }),
    [attemptedAt, generationRequest, hasHydratedIntents, idempotencyKey, intentsHydration, pendingIntents, userId]
  )

  // Latches the ATTEMPT, not the render: the frames before the persisted read answers decide nothing, so the
  // effect below has to be free to run again when it does.
  const hasAttempted = useRef(false)
  // The attempt now awaits its own storage write before sending, so the press that started it has to hold the
  // door until it has either sent or refused — `mutation.isPending` does not cover that window.
  const isAttemptInFlight = useRef(false)
  const recoveredTerminalCode = useRef<string | null>(null)
  const hasRefetchedUnconfirmed = useRef(false)
  // The key the attempt actually went out under — the stored one on a replay, the route's otherwise. It is
  // what an unconfirmed outcome is reconciled against, so it is read from the attempt rather than from the
  // route, which cannot know that a stored key was replayed instead.
  const sentIdempotencyKey = useRef<string | null>(null)

  // A reservation the device would not confirm. Held as state rather than derived, because it is a fact about
  // the attempt that was made and not about anything the store or the route says.
  const [isReservationRefused, setIsReservationRefused] = useState(false)

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

  /**
   * Issues the request itself, once the launch decision has named it and its key is on the device.
   *
   * Separate from the attempt below so the order is visible: a keyed write may only leave AFTER its record is
   * durable, and this function knows nothing about that — it is handed the request and the key to send them
   * under. A stored key travels with its STORED snapshot, because a reused key carrying a changed body is
   * what the server answers `409 idempotency_conflict` (0.5.1, 0.7.2).
   */
  const sendGeneration = useCallback(
    async (sent: GenerationRequestSnapshot, sentKey: string): Promise<void> => {
      try {
        // The commit answers with the plan it produced — on a fresh write and on a replay of a committed key
        // alike — so the plan the user is taken back to is that plan, never the week that happened to be
        // selected before. Leaving the selection alone is what reopened the current week after a next-week
        // generation or an upcoming-plan regeneration.
        const committed =
          sent.action === 'regenerate'
            ? await regenerateMutation.mutateAsync({
                idempotencyKey: sentKey,
                expectedPlanRevision: sent.expectedPlanRevision,
                expectedPreferencesRevision: sent.expectedPreferencesRevision,
                expectedTargetsRevision: sent.expectedTargetsRevision
              })
            : await generateMutation.mutateAsync({
                startDate: sent.startDate,
                idempotencyKey: sentKey,
                expectedPreferencesRevision: sent.expectedPreferencesRevision,
                expectedTargetsRevision: sent.expectedTargetsRevision
              })

        clearPendingIntent(generationRequest.action)
        setSelectedPlanId(resolveSettledGenerationPlanId({kind: 'committed', plan: committed}))
        setMacrosSegment('mealPlan')
        leaveTo(Screens.MACROS)
      } catch (error) {
        const outcome = resolveGenerationView('error', error, context).kind

        if (outcome === 'failed' || outcome === 'noMatch') {
          clearPendingIntent(generationRequest.action)
        }
      }
    },
    [
      clearPendingIntent,
      context,
      generateMutation,
      generationRequest.action,
      leaveTo,
      regenerateMutation,
      setMacrosSegment,
      setSelectedPlanId
    ]
  )

  /**
   * Sends this screen's generation, and only ever the one the launch decision permits, and only once its key
   * is on the device.
   *
   * Every refusal before the request is somebody else's decision, not this handler's: a persisted read still
   * out or refused, and an unresolved generation that belongs elsewhere, all end here with no request sent, no
   * key minted and the slot untouched — and so does a reservation the device would not confirm.
   */
  const attempt = useCallback(async (): Promise<void> => {
    // The reservation below is awaited, so this handler now has a window in which no mutation is pending yet
    // and a second press would open a second one. The latch is that press's refusal, and it is released in
    // `finally` so a refused write can be attempted again.
    if (launch.kind !== 'send' || isAttemptInFlight.current) {
      return
    }

    isAttemptInFlight.current = true

    try {
      if (launch.intent !== null) {
        // Awaited, because the record is the whole reason a response lost in flight can be replayed: it has to
        // be ON THE DEVICE before the request leaves. Recording it in memory and sending immediately — what
        // this screen did — raced its own storage write, and a kill in that window left the key nowhere, so
        // the next launch minted a second one and committed the same plan twice (0.7.2).
        const reservation = await recordPendingIntent(launch.intent)

        // Nothing is sent and nothing is navigated: a key the device never confirmed cannot reconcile an
        // action the server may already have committed, so the screen says so and offers the write again. The
        // memory record is deliberately left as it is, so that retry re-sends this very key rather than
        // minting beside it.
        if (reservation.kind !== 'durable') {
          setIsReservationRefused(true)

          return
        }
      }

      setIsReservationRefused(false)
      recoveredTerminalCode.current = null
      hasRefetchedUnconfirmed.current = false
      sentIdempotencyKey.current = launch.idempotencyKey

      await sendGeneration(launch.request, launch.idempotencyKey)
    } finally {
      isAttemptInFlight.current = false
    }
  }, [launch, recordPendingIntent, sendGeneration])

  useEffect(() => {
    if (hasAttempted.current) {
      return
    }

    // An unresolved generation the slot holds for another week — or another plan — is neither this screen's to
    // replay nor its to overwrite, so it goes to the Meal Plan tab, which owns reconstructing a stranded
    // generation from its persisted intent (0.7.2). Nothing is sent from here and the record is left as it is.
    if (launch.kind === 'handOff') {
      hasAttempted.current = true
      setMacrosSegment('mealPlan')
      leaveTo(Screens.MACROS)

      return
    }

    // 'waiting' and 'unreadable' decide nothing, so neither may latch: the first keeps the pending state with
    // no request in flight until the read answers, and the second is a refusal only `retryIntentsHydration`
    // can leave.
    if (launch.kind !== 'send') {
      return
    }

    hasAttempted.current = true
    attempt()
  }, [attempt, launch.kind, leaveTo, setMacrosSegment])

  /**
   * What a terminal refusal does on its way out. Everything but one branch is synchronous; the exception is
   * the refusal that is answered by opening the plan the user already has, where the plan to select is named
   * by the refetch rather than by anything this screen holds (AAP 0.7.4).
   *
   * A refetch that answers with no upcoming plan still leaves for the Meal Plan tab. The plan may have rolled
   * into the current week, or another client may have replaced it; the tab resolves `current ?? upcoming` on
   * its own, and this outcome draws no card, so staying here would leave the user on an empty screen.
   */
  const applyTerminalRecovery = useCallback(
    async (recovery: GenerationTerminalRecovery): Promise<void> => {
      if (recovery.clearsPendingIntent) {
        clearPendingIntent(generationRequest.action)
      }

      if (recovery.toast !== null) {
        showToast('error', recovery.toast)
      }

      if (recovery.selectsUpcomingPlan) {
        const upcomingPlanId = resolveUpcomingPlanId(await readCurrentPlans())

        if (upcomingPlanId !== null) {
          setSelectedPlanId(upcomingPlanId)
        }

        setMacrosSegment('mealPlan')
      } else if (recovery.refetchesCurrentPlan) {
        // Warms the tab this recovery leaves for, so its answer is fresh by the time the user arrives. Not
        // awaited and needs no rejection handler: `refetch` resolves with the query's own result, and a read
        // the capability latch skips leaves the entry as it stands.
        readCurrentPlans()
      }

      if (recovery.route !== null) {
        leaveTo(recovery.route)
      }
    },
    [clearPendingIntent, generationRequest.action, leaveTo, readCurrentPlans, setMacrosSegment, setSelectedPlanId]
  )

  useEffect(() => {
    const recovery = resolveTerminalRecovery(view.terminalCode, context)

    if (view.terminalCode === null || recovery === null || recoveredTerminalCode.current === view.terminalCode) {
      return
    }

    recoveredTerminalCode.current = view.terminalCode

    // Not awaited: every outcome is handled inside. `refetch` resolves with the query's own result rather
    // than rejecting, so a read that failed answers with no data and the recovery still leaves for the tab.
    applyTerminalRecovery(recovery)
  }, [applyTerminalRecovery, context, view.terminalCode])

  /**
   * The one thing that can still resolve an outcome the server never confirmed: a plan carrying the very key
   * this attempt sent. On that exact match the request did commit, so the intent is retired, the plan it
   * produced becomes the selection and the flow finishes as the success it always was.
   *
   * Anything else leaves the refetch display-only — it neither clears the intent nor claims success nor
   * replaces the unconfirmed card — because a week in hand may be the one another device wrote or the one
   * this request was about to replace (AAP 0.2.5, 0.7.2).
   */
  const reconcileUnconfirmedOutcome = useCallback(async (): Promise<void> => {
    const planId = resolveSettledGenerationPlanId({
      kind: 'refetched',
      plans: await readCurrentPlans(),
      sentKey: sentIdempotencyKey.current
    })

    if (planId === null) {
      return
    }

    clearPendingIntent(generationRequest.action)
    setSelectedPlanId(planId)
    setMacrosSegment('mealPlan')
    leaveTo(Screens.MACROS)
  }, [clearPendingIntent, generationRequest.action, leaveTo, readCurrentPlans, setMacrosSegment, setSelectedPlanId])

  useEffect(() => {
    if (view.kind !== 'unconfirmed' || hasRefetchedUnconfirmed.current) {
      return
    }

    hasRefetchedUnconfirmed.current = true
    reconcileUnconfirmedOutcome()
  }, [reconcileUnconfirmedOutcome, view.kind])

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
  // The persisted intent layer refusing, in either of its two ways, is drawn as refused rather than as busy:
  // nothing may be sent while the slot's contents are unknown or while the key about to be sent exists only
  // in this process, so a spinner would promise an attempt that cannot leave. Asking storage again is the
  // only way out of both, which is what the banner's action does.
  const intentRefusal = resolveIntentRefusal(launch.kind, isReservationRefused)
  const showSpinner = view.showSpinner && intentRefusal === null

  // A refused read is retried by re-reading; a refused reservation by attempting the write again under the
  // same key, which is exactly what the attempt does with the record it already holds.
  const onIntentRefusalRetry = useCallback((): void => {
    if (intentRefusal === null) {
      return
    }

    if (intentRefusal.kind === 'read') {
      retryIntentsHydration()

      return
    }

    attempt()
  }, [attempt, intentRefusal, retryIntentsHydration])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ContentColumn>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, view.isCentered && styles.scrollContentCentered]}>
          <View style={[styles.contentBlock, view.isCentered && styles.contentBlockCentered]}>
            {(showSpinner || view.badgeVariant !== null) && (
              <View style={[!view.isCentered && styles.badgeBlock]}>
                {showSpinner && <IndeterminateSpinner />}

                {view.badgeVariant !== null && <StatusBadgeCircle variant={view.badgeVariant} />}
              </View>
            )}

            {/* The persisted intent layer refused, so what the generation slot holds is unknown or the key
                this attempt would send is not on the device — and no request may leave in either case. The
                only action offered is the storage call itself, which is the single way out of both (0.7.2),
                and it is plainly safe to repeat because neither call changed anything. */}
            {intentRefusal !== null && (
              <View style={styles.bannerBlock}>
                <InfoBanner
                  tone="error"
                  glyph="alert"
                  body={intentRefusal.body}
                  actionLabel={intentRefusal.actionLabel}
                  onAction={onIntentRefusalRetry}
                />
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
