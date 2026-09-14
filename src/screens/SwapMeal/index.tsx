import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {ScrollView, View} from 'react-native'

import type {SwapAlternative} from '@data/models/SwapAlternative'
import {Navigation, SwapMealRouteProp} from '@navigation/types'
import {mutationKeys} from '@queries/keys'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useSwapAlternativesQuery} from '@queries/mealPlanning/useSwapAlternativesQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import {Sizes} from '@styles/sizes'
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
  resolveUnconfirmedRefetch
} from './index.orchestration'
import styles from './index.styled'
import {
  buildMealMetaText,
  buildNoAlternativesBody,
  buildSwapDateLabel,
  buildSwapTitle,
  currentMealEyebrow,
  rendersAlternatives,
  resolveSwapView,
  retiresPendingIntent
} from './index.util'

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

  /**
   * Read from the mutation cache rather than from a hook instance this screen owns, because the attempt was
   * fired by the preview screen and that screen is gone by the time its failure is drawn here. Each entry's
   * variables name the meal it was for — `useSwapMealMutation` takes `{mealId, payload}` — so an attempt on
   * another meal can never draw this meal's banner.
   */
  const swapStates = useMutationState({
    filters: {mutationKey: mutationKeys.swapMeal},
    select: mutation => mutation.state
  })

  const mealSwapStates = swapStates
    .filter(state => (state.variables as {mealId?: string} | undefined)?.mealId === params.mealId)
    .sort((left, right) => left.submittedAt - right.submittedAt)

  const swapState = mealSwapStates.length === 0 ? null : mealSwapStates[mealSwapStates.length - 1]

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

  // The stored request of an unresolved commit for this very meal, which is what a replay has to send: the
  // alternative and the portion the preview bound live in the snapshot, not in this screen's params.
  const pendingSwap = resolveReplayableSwap({
    state: {pendingIntents},
    userId,
    planId: params.planId,
    mealId: params.mealId,
    now
  })

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
  const onRetrySwap = useCallback((): void => {
    if (pendingSwap === null || userId === null) {
      // Nothing replayable is on record — the intent was retired or belongs to another user — so the only
      // honest move is back to the alternatives, where the next attempt is built from a fresh preview.
      setDismissedAttemptAt(swapState?.submittedAt ?? null)

      return
    }

    const plan = resolveSwapRetryPlan({
      state: {pendingIntents},
      snapshot: pendingSwap,
      userId,
      attemptedAt: Date.now(),
      freshKey: mintKey(uuidv4)
    })

    // Re-recorded before the request leaves: the key may be the stored one or the fresh one, and either way the
    // record has to describe the request that is actually in flight.
    recordPendingIntent(plan.intent)

    const guards = guardsForNewAttempt()

    recoveredTerminalCode.current = guards.recoveredTerminalCode
    hasRefetchedUnconfirmed.current = guards.hasRefetchedUnconfirmed

    swapMutation.mutate(plan.variables.payload, {onSuccess: onSwapCommitted})
  }, [onSwapCommitted, pendingIntents, pendingSwap, recordPendingIntent, swapMutation, swapState, userId])

  const onBannerAction = useCallback((): void => {
    if (view.kind === 'error') {
      if (view.retry === 'day') {
        dayQuery.refetch()

        return
      }

      alternativesQuery.refetch()

      return
    }

    onRetrySwap()
  }, [alternativesQuery, dayQuery, onRetrySwap, view])

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

    showToast('error', view.terminal.toastText ?? TOAST_GENERIC_ERROR)

    if (view.terminal.recovery === 'refetchPlan') {
      dayQuery.refetch()

      return
    }

    // The chosen alternative is what the refusal was about, so the list is re-read and the user picks again;
    // the next attempt is then built from a fresh preview under a new key.
    alternativesQuery.refetch()
  }, [alternativesQuery, clearPendingIntent, dayQuery, view])

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

  const openPreview = (alternative: SwapAlternative): void => {
    navigation.navigate(Screens.SWAP_PREVIEW, {
      planId: params.planId,
      mealId: params.mealId,
      date: params.date,
      recipeVersionId: alternative.recipeVersionId,
      planRevision
    })
  }

  const loadingBlock = (): React.JSX.Element => (
    <>
      <View style={styles.loadingRow}>
        <IndeterminateSpinner size="sm" />

        <Text style={styles.loadingLabel}>{SWAP_FINDING_ALTERNATIVES_TEXT}</Text>
      </View>

      <View style={styles.skeletonWrapper}>
        <SkeletonAlternatives />
      </View>
    </>
  )

  const alternativesBlock = (alternatives: readonly SwapAlternative[]): React.JSX.Element => (
    <>
      <View style={styles.sectionRow}>
        <SectionOverline text={SWAP_ALTERNATIVES_HEADER} />

        <Text style={styles.sectionHint}>{SWAP_FITS_TARGETS_LABEL}</Text>
      </View>

      <View style={styles.alternativesCard}>
        {alternatives.map((alternative, index) => (
          <AlternativeRow
            key={alternative.recipeVersionId}
            alternative={alternative}
            meta={buildMealMetaText({
              calories: alternative.calories,
              protein: alternative.protein,
              totalMinutes: alternative.totalMinutes
            })}
            isFirst={index === 0}
            onPress={() => openPreview(alternative)}
          />
        ))}
      </View>

      <Text style={styles.footnote}>{SWAP_ALTERNATIVES_FOOTNOTE}</Text>
    </>
  )

  const emptyBlock = (): React.JSX.Element | null => {
    if (currentMeal === null) {
      return null
    }

    return (
      <>
        <View style={styles.emptyCardWrapper}>
          <View style={styles.emptyCard}>
            <EmptyState
              icon={<SearchMinusIcon size={Sizes.ICON_BADGE} color={Theme.colors.lime} />}
              variant="badge"
              headline={SWAP_NO_ALTERNATIVES_TITLE}
              body={buildNoAlternativesBody(currentMeal.slot)}
              primaryLabel={MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
              onPrimary={() => navigation.navigate(Screens.PLAN_SETTINGS, {planId: params.planId})}
              secondaryLabel={SWAP_KEEP_CURRENT_MEAL_BUTTON_TEXT}
              onSecondary={navigation.goBack}
            />
          </View>
        </View>

        <View style={styles.infoBannerWrapper}>
          <InfoBanner tone="success" glyph="info" body={SWAP_NO_ALTERNATIVES_BANNER_BODY} />
        </View>
      </>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ContentColumn>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <BackCircleButton onPress={navigation.goBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

            <Text style={styles.dateLabel}>{buildSwapDateLabel(params.date)}</Text>
          </View>

          {banner !== null && (
            <View style={styles.errorBannerWrapper}>
              <InfoBanner
                tone={banner.tone}
                glyph={banner.glyph}
                title={banner.title}
                body={banner.body}
                actionLabel={banner.actionLabel}
                onAction={onBannerAction}
                isActionPending={swapState?.status === 'pending'}
                secondaryActionLabel={banner.secondaryActionLabel}
                onSecondaryAction={
                  banner.secondaryActionLabel === undefined
                    ? undefined
                    : () => setDismissedAttemptAt(swapState?.submittedAt ?? null)
                }
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

          {view.kind === 'loading' && loadingBlock()}

          {view.kind === 'empty' && emptyBlock()}

          {rendersAlternatives(view) && view.alternatives.length > 0 && alternativesBlock(view.alternatives)}
        </ScrollView>
      </ContentColumn>
    </SafeAreaView>
  )
}

export default SwapMealScreen
