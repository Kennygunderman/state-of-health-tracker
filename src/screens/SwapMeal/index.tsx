import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {FlatList, ListRenderItemInfo, View} from 'react-native'

import type {SwapAlternative} from '@data/models/SwapAlternative'
import {Navigation, SwapMealRouteProp} from '@navigation/types'
import {mutationKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useSwapAlternativesQuery} from '@queries/mealPlanning/useSwapAlternativesQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {useMutationState} from '@tanstack/react-query'
import {mintKey} from '@utility/IdempotencyUtility'
import {SafeAreaView} from 'react-native-safe-area-context'
import {v4 as uuidv4} from 'uuid'

import BackCircleButton from '@components/BackCircleButton'
import ContentColumn from '@components/ContentColumn'
import EmptyState from '@components/EmptyState'
import SearchMinusIcon from '@components/icons/SearchMinusIcon'
import IndeterminateSpinner from '@components/IndeterminateSpinner'
import InfoBanner from '@components/InfoBanner'
import SectionOverline from '@components/SectionOverline'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_STALE_PLAN_TOAST,
  SWAP_ALTERNATIVES_FOOTNOTE,
  SWAP_ALTERNATIVES_HEADER,
  SWAP_FINDING_ALTERNATIVES_TEXT,
  SWAP_FITS_TARGETS_LABEL,
  SWAP_KEEP_CURRENT_MEAL_BUTTON_TEXT,
  SWAP_NO_ALTERNATIVES_BANNER_BODY,
  SWAP_NO_ALTERNATIVES_TITLE,
  SWAP_SUCCESS_TOAST,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import AlternativeRow from './components/AlternativeRow'
import CurrentMealCard from './components/CurrentMealCard'
import SkeletonAlternatives from './components/SkeletonAlternatives'
import {
  guardsForNewAttempt,
  resolveAlternativesRevision,
  resolveReplayableSwap,
  resolveSwapRetryPlan,
  resolveUnconfirmedRefetch,
  selectSwapAttemptState
} from './index.orchestration'
import styles from './index.styled'
import {
  buildMealMetaText,
  buildNoAlternativesBody,
  buildSwapDateLabel,
  buildSwapTitle,
  currentMealEyebrow,
  isPlanInactive,
  rendersAlternatives,
  rendersAlternativesGuidance,
  resolveSwapView,
  retiresPendingIntent
} from './index.util'

/**
 * The alternatives card, as the list's single item. Figma wraps every row in ONE card and separates them with a
 * 1px top border on each row after the first, so the card is what the list renders and the rows are mapped
 * inside it — the shape the grocery list's section cards already take. The key is a constant because the card's
 * identity never changes: a fresh set of alternatives refills the same card rather than replacing it.
 */
type AlternativesBlock = {
  key: string
  alternatives: readonly SwapAlternative[]
}

const ALTERNATIVES_BLOCK_KEY = 'swap-alternatives'

/**
 * Frames 13 / 13c / 13d / 13e. The commit is pressed on the preview screen, so this screen draws the outcome of
 * an attempt it never fired, and its "Try again" replays the very key that attempt was minted for — a commit
 * whose response was lost returns its stored result instead of swapping the meal twice (AAP 0.7.2).
 */
const SwapMealScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<SwapMealRouteProp>()

  const userId = useAuthStore(state => state.userId)
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const dayQuery = useMealPlanDayQuery(params.planId, params.date)
  const {refetch: refetchCurrentPlan} = useCurrentMealPlanQuery()

  const envelope = dayQuery.data ?? null
  const currentMeal = envelope?.day.meals.find(candidate => candidate.id === params.mealId) ?? null

  const planRevision = resolveAlternativesRevision({
    dayPlanRevision: envelope?.planRevision,
    openedPlanRevision: params.planRevision
  })

  const alternativesQuery = useSwapAlternativesQuery(params.planId, params.mealId, planRevision)
  const swapMutation = useSwapMealMutation(params.planId, params.mealId)

  // One clock for this mount: the pending intent's expiry is measured in days, so re-reading it per render
  // could only make two reads of the same record disagree.
  const now = useMemo(() => Date.now(), [])

  const [dismissedAttemptAt, setDismissedAttemptAt] = useState<number | null>(null)

  // Both guards are per-attempt: each attempt earns its own outcome, so a retry's recovery must not be skipped
  // because the previous attempt already applied its own. `onRetrySwap` resets them as the request leaves.
  const recoveredTerminalCode = useRef<string | null>(null)
  const hasRefetchedUnconfirmed = useRef(false)

  // The unresolved commit for this user, plan and meal — its stored request, which a replay has to re-send, and
  // the key it was minted for, which is what finds its outcome below. The alternative and the portion the
  // preview bound live in that snapshot, not in this screen's params.
  const pendingSwap = resolveReplayableSwap({
    state: {pendingIntents},
    userId,
    planId: params.planId,
    mealId: params.mealId,
    now
  })

  /**
   * Read from the mutation cache rather than from a hook instance this screen owns, because the attempt was
   * fired by the preview screen and that screen is gone by the time its failure is drawn here. The attempt is
   * identified by its idempotency key: `useSwapMealMutation(planId, mealId)` closes over both ids and its wire
   * body carries neither, so an entry's variables are a bare payload and the key is the only field that ties
   * one to the intent the preview recorded beside it. That intent is already scoped to this user, plan and
   * meal, so an attempt on another meal can never draw this meal's banner.
   */
  const swapStates = useMutationState({
    filters: {mutationKey: mutationKeys.swapMeal},
    select: mutation => mutation.state
  })

  const swapState = selectSwapAttemptState(swapStates, pendingSwap?.key ?? null)

  // "Back to alternatives" dismisses the attempt it was shown for, not every future one: a later commit that
  // fails again is a new outcome and draws its own banner.
  const isDismissed = swapState !== null && swapState.submittedAt === dismissedAttemptAt

  const view = resolveSwapView({
    currentMeal,
    alternatives: alternativesQuery.data?.alternatives,
    isAlternativesPending: alternativesQuery.isPending,
    alternativesError: alternativesQuery.error,
    swapError: isDismissed ? null : (swapState?.error ?? null),
    isDayPending: dayQuery.isPending,
    dayError: dayQuery.error
  })

  const banner = 'banner' in view ? view.banner : null

  // Only an ANSWERED false is a refusal: a verdict the day query has not returned — null on the cache-seeded
  // envelope, undefined with no envelope at all — is not a dead plan, and telling the user their plan is gone
  // while a read is still in flight would be a worse lie than letting them reach a commit the server can refuse.
  const isPlanWriteRefused = isPlanInactive(envelope?.isWritable)

  const onSwapCommitted = useCallback((): void => {
    // The server answered the key, so the intent is resolved whether this was a fresh commit or a stored replay.
    clearPendingIntent('swap')
    showToast('success', SWAP_SUCCESS_TOAST)
    setSelectedPlanDate(params.date)
    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [clearPendingIntent, navigation, params.date, setMacrosSegment, setSelectedPlanDate])

  // 13e's retry sits inside the error banner rather than navigating. The key and the body it sends are the
  // orchestration module's answer: the stored key while the request still fingerprints to the intent, and the
  // freshly minted one otherwise, so the server is never asked to reuse a key under a changed body (0.7.2).
  //
  // A refused write verdict deliberately does NOT gate this. The attempt may already be durable, and only a
  // server answer to its own key can settle that — a read reporting the plan inactive cannot. Replaying returns
  // the stored result, or the confirmed refusal that finally retires the intent.
  const onRetrySwap = useCallback(async (): Promise<void> => {
    if (pendingSwap === null || userId === null) {
      // Nothing replayable is on record — the intent was retired or belongs to another user — so the only
      // honest move is back to the alternatives, where the next attempt is built from a fresh preview.
      setDismissedAttemptAt(swapState?.submittedAt ?? null)

      return
    }

    const plan = resolveSwapRetryPlan({
      state: {pendingIntents},
      snapshot: pendingSwap.request,
      userId,
      attemptedAt: Date.now(),
      freshKey: mintKey(uuidv4)
    })

    // Re-recorded before the request leaves: the key may be the stored one or the fresh one, and either way the
    // record has to describe the request that is actually in flight — including for the selector above, which
    // finds this attempt's outcome by that very key.
    recordPendingIntent(plan.intent)

    const guards = guardsForNewAttempt()

    recoveredTerminalCode.current = guards.recoveredTerminalCode
    hasRefetchedUnconfirmed.current = guards.hasRefetchedUnconfirmed

    try {
      await swapMutation.mutateAsync(plan.variables.payload)

      onSwapCommitted()
    } catch {
      // Awaited rather than given a per-call `onSuccess`, because TanStack drops those callbacks when the
      // caller unmounts: a reply that arrived after the user left would never have retired the intent the
      // server had just answered. The continuation survives, so the intent is always retired on a reply.
      //
      // Nothing imperative belongs in this catch. A failure is drawn, not announced — `resolveSwapView` reads
      // this attempt's outcome straight from the mutation cache and returns 13e or the unconfirmed variant,
      // and a terminal code is retired by the effect above. Toasting here would report the same failure twice.
    }
  }, [onSwapCommitted, pendingIntents, pendingSwap, recordPendingIntent, swapMutation, swapState, userId])

  const onBannerAction = useCallback(async (): Promise<void> => {
    if (view.kind === 'error') {
      if (view.retry === 'day') {
        dayQuery.refetch()

        return
      }

      alternativesQuery.refetch()

      return
    }

    await onRetrySwap()
  }, [alternativesQuery, dayQuery, onRetrySwap, view])

  const onDismissAttempt = useCallback((): void => {
    setDismissedAttemptAt(swapState?.submittedAt ?? null)
  }, [swapState])

  const onEditPreferences = useCallback((): void => {
    navigation.navigate(Screens.PLAN_SETTINGS, {planId: params.planId})
  }, [navigation, params.planId])

  const onOpenPreview = useCallback(
    (alternative: SwapAlternative): void => {
      if (isPlanWriteRefused) {
        // The preview's whole job is to bind a commit, and nothing downstream could make one land, so the
        // refusal is repeated here rather than letting the user choose a portion against a plan already gone.
        showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)

        return
      }

      navigation.navigate(Screens.SWAP_PREVIEW, {
        planId: params.planId,
        mealId: params.mealId,
        date: params.date,
        recipeVersionId: alternative.recipeVersionId,
        planRevision
      })
    },
    [isPlanWriteRefused, navigation, params.date, params.mealId, params.planId, planRevision]
  )

  useEffect(() => {
    if (view.kind !== 'terminal' || recoveredTerminalCode.current === view.terminal.code) {
      return
    }

    recoveredTerminalCode.current = view.terminal.code

    // Only an answer to the key itself may retire the intent, which is why the predicate — and not the code —
    // decides: a terminal answer from the day query is a read, and says nothing about whether the swap
    // committed.
    if (retiresPendingIntent(view)) {
      clearPendingIntent('swap')
    }

    if (view.terminal.recovery === 'exitToPlanTab') {
      // Meal planning itself is switched off, so there is no list to re-read and nothing here to retry. Carry
      // no toast — the Meal Plan segment's unavailable card is where that is explained, once — and leave for
      // it, re-reading the current plan on the way so the tab renders from a fresh answer.
      refetchCurrentPlan()
      setMacrosSegment('mealPlan')
      navigation.popTo(Screens.MACROS)

      return
    }

    showToast('error', view.terminal.toastText ?? TOAST_GENERIC_ERROR)

    if (view.terminal.recovery === 'refetchPlan') {
      dayQuery.refetch()

      return
    }

    // The chosen alternative is what the refusal was about, so the list is re-read and the user picks again;
    // the next attempt is then built from a fresh preview under a new key.
    alternativesQuery.refetch()
  }, [alternativesQuery, clearPendingIntent, dayQuery, navigation, refetchCurrentPlan, setMacrosSegment, view])

  useEffect(() => {
    const decision = resolveUnconfirmedRefetch({
      viewKind: view.kind,
      hasRefetchedUnconfirmed: hasRefetchedUnconfirmed.current
    })

    if (!decision.refetchesPlanDay) {
      return
    }

    hasRefetchedUnconfirmed.current = decision.hasRefetchedUnconfirmed
    // Display-only (0.2.5): it warms the day a commit this attempt may already have made, so the plan shows it
    // the moment the user leaves. It never resolves or clears the pending intent — only a server answer to the
    // same key does, which is what "Try again" asks for — and it leaves the unconfirmed banner's copy alone
    // even when the day answers with a terminal code of its own.
    dayQuery.refetch()
  }, [dayQuery, view.kind])

  useEffect(() => {
    if (!isPlanWriteRefused) {
      return
    }

    // The plan this screen opened on can no longer be written to — superseded by a regeneration, or its week
    // has ended. Say so once and re-read the current plan, so the tab behind this screen is already showing the
    // replacement when the user gets back to it.
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [isPlanWriteRefused, refetchCurrentPlan])

  const blocks: readonly AlternativesBlock[] =
    rendersAlternatives(view) && view.alternatives.length > 0
      ? [{key: ALTERNATIVES_BLOCK_KEY, alternatives: view.alternatives}]
      : []

  // Frame 13's two explanatory pieces travel together and frame 13e drops both (see index.util).
  const showsGuidance = rendersAlternativesGuidance(view)

  const renderAlternatives = useCallback(
    ({item: block}: ListRenderItemInfo<AlternativesBlock>): React.JSX.Element => (
      <View style={styles.alternativesCard}>
        {block.alternatives.map((alternative, index) => (
          <AlternativeRow
            key={alternative.recipeVersionId}
            alternative={alternative}
            meta={buildMealMetaText({
              calories: alternative.calories,
              protein: alternative.protein,
              totalMinutes: alternative.totalMinutes
            })}
            isFirst={index === 0}
            onPress={() => onOpenPreview(alternative)}
          />
        ))}
      </View>
    ),
    [onOpenPreview]
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <FlatList
          data={blocks}
          keyExtractor={block => block.key}
          renderItem={renderAlternatives}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={
            <>
              <View style={styles.headerRow}>
                <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

                <Text style={styles.dateLabel}>{buildSwapDateLabel(params.date)}</Text>
              </View>

              {banner !== null && (
                // The banner is the only thing on this screen that appears in response to a failure, so it is
                // announced as one. `InfoBanner` declares no role of its own, so there is nothing to double up.
                <View style={styles.errorBannerWrapper} accessibilityRole="alert">
                  <InfoBanner
                    tone={banner.tone}
                    glyph={banner.glyph}
                    title={banner.title}
                    body={banner.body}
                    actionLabel={banner.actionLabel}
                    onAction={onBannerAction}
                    isActionPending={swapState?.status === 'pending'}
                    secondaryActionLabel={banner.secondaryActionLabel}
                    onSecondaryAction={banner.secondaryActionLabel === undefined ? undefined : onDismissAttempt}
                  />
                </View>
              )}

              {currentMeal !== null && (
                <>
                  <Text style={[styles.title, banner !== null && styles.titleAfterBanner]}>
                    {buildSwapTitle(currentMeal.slot)}
                  </Text>

                  <View style={styles.currentMealWrapper}>
                    <CurrentMealCard
                      name={currentMeal.recipe.name}
                      iconKey={currentMeal.recipe.iconKey}
                      meta={buildMealMetaText({
                        calories: currentMeal.planned.calories,
                        protein: currentMeal.planned.protein,
                        totalMinutes: currentMeal.recipe.totalMinutes
                      })}
                      variant={view.currentMealVariant}
                      eyebrow={currentMealEyebrow(view.currentMealVariant, currentMeal.slot)}
                    />
                  </View>
                </>
              )}

              {blocks.length > 0 && (
                <View style={styles.sectionRow}>
                  <SectionOverline text={SWAP_ALTERNATIVES_HEADER} />

                  {showsGuidance && <Text style={styles.sectionHint}>{SWAP_FITS_TARGETS_LABEL}</Text>}
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <>
              {view.kind === 'loading' && (
                <>
                  <View
                    style={styles.loadingRow}
                    accessible
                    accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}
                    accessibilityState={{busy: true}}>
                    <IndeterminateSpinner size="sm" />

                    <Text style={styles.loadingLabel}>{SWAP_FINDING_ALTERNATIVES_TEXT}</Text>
                  </View>

                  <View style={styles.skeletonWrapper}>
                    <SkeletonAlternatives />
                  </View>
                </>
              )}

              {view.kind === 'empty' && currentMeal !== null && (
                <>
                  <View style={styles.emptyCardWrapper}>
                    <View style={styles.emptyCard}>
                      <EmptyState
                        icon={
                          <SearchMinusIcon
                            size={Sizes.ICON_BADGE}
                            color={Theme.colors.lime}
                            strokeWidth={Stroke.BADGE_ZOOM}
                          />
                        }
                        variant="badge"
                        headline={SWAP_NO_ALTERNATIVES_TITLE}
                        body={buildNoAlternativesBody(currentMeal.slot)}
                        primaryLabel={MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
                        onPrimary={onEditPreferences}
                        secondaryLabel={SWAP_KEEP_CURRENT_MEAL_BUTTON_TEXT}
                        onSecondary={navigation.goBack}
                      />
                    </View>
                  </View>

                  <View style={styles.infoBannerWrapper}>
                    <InfoBanner tone="success" glyph="info" body={SWAP_NO_ALTERNATIVES_BANNER_BODY} />
                  </View>
                </>
              )}
            </>
          }
          ListFooterComponent={
            blocks.length > 0 && showsGuidance ? (
              <Text style={styles.footnote}>{SWAP_ALTERNATIVES_FOOTNOTE}</Text>
            ) : null
          }
        />
      </ContentColumn>
    </SafeAreaView>
  )
}

export default SwapMealScreen
