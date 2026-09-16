import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {ScrollView, TouchableOpacity, View} from 'react-native'

import {Navigation, SwapPreviewRouteProp} from '@navigation/types'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {useSwapPreviewQuery} from '@queries/mealPlanning/useSwapPreviewQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore from '@store/auth/useAuthStore'
import useMealPlanStore, {
  buildPendingIntent,
  KeyedRequestPlan,
  resolveKeyedRequest
} from '@store/mealPlan/useMealPlanStore'
import {Opacity, Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode, isPlanStateError, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {mintKey, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {dayStripLabel} from '@utility/MealPlanDateUtility'
import {isWriteRefusedByVerdict} from '@utility/MealPlanLifecycleUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'
import {v4 as uuidv4} from 'uuid'

import BigNumberRow from '@components/BigNumberRow'
import ContentColumn from '@components/ContentColumn'
import DeltaPill from '@components/DeltaPill'
import InfoBanner from '@components/InfoBanner'
import IngredientRow from '@components/IngredientRow'
import MacroLegendRow from '@components/MacroLegendRow'
import MetricGrid4 from '@components/MetricGrid4'
import PrimaryButton from '@components/PrimaryButton'
import RecipeHero from '@components/RecipeHero'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import TertiaryTextButton from '@components/TertiaryTextButton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_LOAD_ERROR_BODY,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  MEAL_SLOT_SENTENCE_LABELS,
  RECIPE_DETAIL_INGREDIENTS_HEADER,
  stringWithNamedParameters,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_FAILED_BODY_TEMPLATE,
  SWAP_FAILED_TITLE,
  SWAP_PREVIEW_DAY_TOTAL_TEMPLATE,
  SWAP_PREVIEW_DELTA_DOWN_ACCESSIBILITY_TEMPLATE,
  SWAP_PREVIEW_DELTA_UP_ACCESSIBILITY_TEMPLATE,
  SWAP_PREVIEW_OF_TARGET_TEMPLATE,
  SWAP_PREVIEW_THIS_MEAL_LABEL,
  SWAP_RECIPE_INELIGIBLE_TOAST,
  SWAP_SUCCESS_TOAST,
  SWAP_USE_THIS_MEAL_BUTTON_TEXT,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import CalorieProgressBar from './components/CalorieProgressBar'
import styles from './index.styled'
import {
  buildSwapMacroLegend,
  buildThisMealMetrics,
  calorieProgressRatio,
  deriveCalorieDelta,
  formatPreviewSubtitle,
  formatReplacingContext,
  resolvePreviewIngredients,
  SwapMacroLegendItem
} from './index.util'

// The legend's three dots, in the app's established macro colours (the Diary summary and the targets card use
// the same three), so one macro is one colour wherever a user compares them.
const MACRO_DOT_COLORS: Record<SwapMacroLegendItem['key'], string> = {
  protein: Theme.colors.accentGreen,
  carbs: Theme.colors.teal,
  fat: Theme.colors.lime
}

// Shaped like the loaded column: the title, the "This meal" card, the day-totals card and two ingredient rows.
const SKELETON_HEIGHTS: number[] = [
  Sizes.CONTROL,
  Sizes.CONTROL_LG,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR,
  Sizes.SKELETON_BAR
]

// Which assurance the failed commit is allowed to make. A server that answered `swap_failed` has told us
// nothing was written, so the drawn copy naming the meal unchanged is truthful; an outcome nothing described
// may have committed before its response was lost, so that screen states only that it could not be confirmed.
type CommitFailure = 'confirmed' | 'unconfirmed'

/**
 * Frame 13b, and the only screen that commits a swap. The commit is keyed: the intent is recorded before the
 * request leaves and the key is reused only for a byte-identical replay, so a response lost in transit is
 * asked again rather than swapping the meal a second time (AAP 0.7.2).
 *
 * The two drawn failure states (13e and its neutral unconfirmed variant) belong to `SwapMeal` in the design,
 * but that screen selects the attempt out of the shared mutation cache by a `mealId` this mutation's variables
 * do not carry, so an attempt made here is invisible to it. Both are therefore drawn in place, which also
 * keeps the retry on the screen still holding the pending key.
 */
const SwapPreviewScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<SwapPreviewRouteProp>()

  const userId = useAuthStore(state => state.userId)
  const pendingIntents = useMealPlanStore(state => state.pendingIntents)
  const recordPendingIntent = useMealPlanStore(state => state.recordPendingIntent)
  const clearPendingIntent = useMealPlanStore(state => state.clearPendingIntent)
  const setSelectedPlanDate = useMealPlanStore(state => state.setSelectedPlanDate)
  const setMacrosSegment = useMealPlanStore(state => state.setMacrosSegment)

  const [commitFailure, setCommitFailure] = useState<CommitFailure | null>(null)

  const previewQuery = useSwapPreviewQuery(params.planId, params.mealId, params.recipeVersionId, params.planRevision)
  const dayQuery = useMealPlanDayQuery(params.planId, params.date)
  const currentPlanQuery = useCurrentMealPlanQuery()
  const swapMutation = useSwapMealMutation(params.planId, params.mealId)

  const preview = previewQuery.data ?? null
  const meal = dayQuery.data?.day.meals.find(candidate => candidate.id === params.mealId) ?? null

  // A plan the server has closed to writes cannot be swapped, so the commit is barred before it is attempted
  // rather than after a 409. An unknown verdict — the day seeded from cache, which reports none — is not a
  // refusal: the server decides, and it decides on the request.
  const isWriteRefused = isWriteRefusedByVerdict(dayQuery.data?.isWritable)
  const isCommitBlocked = swapMutation.isPending || isWriteRefused

  // The hero names the meal being replaced and the card states the candidate's figures, so nothing is drawn
  // until both are in hand. Memoised because the commit handler closes over it.
  const ready = useMemo(() => (preview !== null && meal !== null ? {preview, meal} : null), [meal, preview])

  const isLoading = previewQuery.isLoading || dayQuery.isLoading

  // A decoded 422 on the preview is not a failed read to retry: the server has answered that this alternative
  // can no longer be planned, so 0.2.5 sends the user back to the alternatives (13) with the code's own copy
  // rather than offering "Try again" against a refusal the next request would earn again. `isUnknownOutcome`
  // keeps a transport failure out of this branch, which is why the generic card below is reserved for one.
  const isRecipeIneligible =
    !isUnknownOutcome(previewQuery.error) && getApiErrorCode(previewQuery.error) === API_ERROR_CODES.recipeIneligible

  const dayName = useMemo(() => dayStripLabel(params.date).weekday, [params.date])

  const hasRecoveredIneligible = useRef(false)

  useEffect(() => {
    // Once per outcome: the effect re-runs whenever a query object's identity changes, and a second pass would
    // toast and pop again for a refusal already recovered from.
    if (!isRecipeIneligible || hasRecoveredIneligible.current) {
      return
    }

    hasRecoveredIneligible.current = true
    showToast('error', SWAP_RECIPE_INELIGIBLE_TOAST)
    navigation.goBack()
  }, [isRecipeIneligible, navigation])

  const hasWarnedWriteRefused = useRef(false)

  useEffect(() => {
    // Said once, and the screen is left standing: the candidate is still worth reading even though it can no
    // longer be taken, and the plan it belonged to is a tap away.
    if (!isWriteRefused || hasWarnedWriteRefused.current) {
      return
    }

    hasWarnedWriteRefused.current = true
    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
  }, [isWriteRefused])

  const refetchedForRevision = useRef<number | null>(null)

  useEffect(() => {
    const dayRevision = dayQuery.data?.planRevision

    // This preview answers for the revision its route named, so a day that has since advanced leaves its
    // portion and totals describing a plan the server no longer holds. Asking again re-binds both — the
    // revision is this query's cache identity rather than part of its request — which is what keeps the commit
    // from going out against a revision it would only be refused for. Guarded by the revision observed, so a
    // server still reporting the older one is asked once and not again.
    if (dayRevision === undefined || preview === null || dayRevision <= preview.planRevision) {
      return
    }

    if (refetchedForRevision.current === dayRevision) {
      return
    }

    refetchedForRevision.current = dayRevision
    previewQuery.refetch()
  }, [dayQuery.data?.planRevision, preview, previewQuery])

  const onSwapCommitted = useCallback((): void => {
    // A server answer to the key resolves the intent, whether it committed now or replayed a stored result.
    clearPendingIntent('swap')
    showToast('success', SWAP_SUCCESS_TOAST)
    setSelectedPlanDate(params.date)
    setMacrosSegment('mealPlan')
    // popTo, not navigate: navigate() would push a second Macros screen rather than return to the one this
    // flow was opened from, leaving the swap flow underneath it.
    navigation.popTo(Screens.MACROS)
  }, [clearPendingIntent, navigation, params.date, setMacrosSegment, setSelectedPlanDate])

  /**
   * Retiring the key is the decision this makes.
   *
   * A confirmed refusal the server would repeat — a portion it recomputed differently, a plan that has moved
   * on, a key already spent on another payload — ends the intent, so the next attempt mints a fresh one and
   * cannot be answered with `idempotency_conflict`. A confirmed `swap_failed` and an outcome nothing described
   * both keep it: the first is the drawn same-key retry, and the second may have committed before its response
   * was lost, which leaves that key the only way to ask again without risking a second swap (AAP 0.7.2).
   */
  const onCommitFailed = useCallback(
    (error: unknown): void => {
      if (isUnknownOutcome(error)) {
        setCommitFailure('unconfirmed')

        return
      }

      const code = getApiErrorCode(error)

      if (code === API_ERROR_CODES.swapFailed) {
        setCommitFailure('confirmed')

        return
      }

      clearPendingIntent('swap')

      // The server recomputed a different portion for this alternative, so the figures on screen are answers
      // about a portion it will not commit. The alternatives are keyed by plan revision, so refreshing the plan
      // is what makes the list behind this screen ask again.
      if (code === API_ERROR_CODES.previewStale) {
        showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
        currentPlanQuery.refetch()
        navigation.goBack()

        return
      }

      if (code === API_ERROR_CODES.recipeIneligible) {
        showToast('error', SWAP_RECIPE_INELIGIBLE_TOAST)
        navigation.goBack()

        return
      }

      // Superseded or ended: nothing in this flow can be committed against that plan again, so the alternatives
      // behind this screen are no more use than the preview and the whole flow gives way to the current plan.
      if (isPlanStateError(error)) {
        showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
        currentPlanQuery.refetch()
        setSelectedPlanDate(params.date)
        setMacrosSegment('mealPlan')
        navigation.popTo(Screens.MACROS)

        return
      }

      // `idempotency_conflict` included: the key it rejected has just been retired, so the retry this screen
      // still offers goes out under a new one.
      showToast('error', TOAST_GENERIC_ERROR)
    },
    [clearPendingIntent, currentPlanQuery, navigation, params.date, setMacrosSegment, setSelectedPlanDate]
  )

  /**
   * The snapshot is built here because this screen is the only place holding all five members of the 0.5.2 wire
   * request: the route's plan and meal, the alternative it is previewing, and the portion and revision the
   * preview envelope bound.
   *
   * Awaited rather than handed callbacks so the toast, the navigation and the intent's fate stay at the call
   * site: the mutation's own options own the cache, and nothing else.
   */
  const onUseThisMealPressed = useCallback(async (): Promise<void> => {
    if (ready === null) {
      return
    }

    // A fresh attempt speaks for itself; leaving the last failure drawn would state an outcome for a request
    // now in flight.
    setCommitFailure(null)

    const request: SwapRequestSnapshot = {
      action: 'swap',
      planId: params.planId,
      mealId: params.mealId,
      recipeVersionId: params.recipeVersionId,
      portionMultiplier: ready.preview.alternative.portionMultiplier,
      expectedPlanRevision: ready.preview.planRevision
    }

    const attemptedAt = Date.now()

    // Minted at the press, never before it: a key survives only for a byte-identical replay, so a different
    // alternative or a moved revision gets its own. An attempt with no signed-in user to scope a record to
    // still goes out under a fresh key, but is not persisted — `pendingIntents` is keyed by user.
    const freshKey = mintKey(uuidv4)
    const plan: KeyedRequestPlan =
      userId === null
        ? {idempotencyKey: freshKey, isReplay: false, request}
        : resolveKeyedRequest({pendingIntents}, request, userId, attemptedAt, freshKey)

    if (userId !== null) {
      recordPendingIntent(buildPendingIntent(plan.request, plan.idempotencyKey, userId, attemptedAt))
    }

    try {
      // The portion goes back exactly as the preview bound it. Recomputing it here is what earns
      // `preview_stale`: the server derives the same number from the same function and compares.
      await swapMutation.mutateAsync({
        recipeVersionId: params.recipeVersionId,
        portionMultiplier: request.portionMultiplier,
        expectedPlanRevision: request.expectedPlanRevision,
        idempotencyKey: plan.idempotencyKey
      })

      onSwapCommitted()
    } catch (error) {
      onCommitFailed(error)
    }
  }, [
    onCommitFailed,
    onSwapCommitted,
    params.mealId,
    params.planId,
    params.recipeVersionId,
    pendingIntents,
    ready,
    recordPendingIntent,
    swapMutation,
    userId
  ])

  const onRetryPressed = useCallback(() => {
    previewQuery.refetch()
    dayQuery.refetch()
  }, [dayQuery, previewQuery])

  const onOpenRecipePressed = useCallback((): void => {
    // The route's revision, not the envelope's: recipe detail reads this candidate's planned figures out of the
    // preview cache, and the route's value is the one that cache entry is keyed by.
    navigation.navigate(Screens.RECIPE_DETAIL, {
      recipeVersionId: params.recipeVersionId,
      context: {
        kind: 'preview',
        planId: params.planId,
        mealId: params.mealId,
        date: params.date,
        candidateRecipeVersionId: params.recipeVersionId,
        planRevision: params.planRevision
      }
    })
  }, [navigation, params.date, params.mealId, params.planId, params.planRevision, params.recipeVersionId])

  const loadingBlock = (): React.JSX.Element => (
    <View style={styles.skeletonBlock} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {SKELETON_HEIGHTS.map((height, index) => (
        <View key={`${height}-${index}`} style={styles.skeletonRow}>
          <SkeletonBlock
            height={height}
            // The fill style overrides this, but Skeleton sizes its shimmer sweep from the prop, so the
            // column's own maximum is what the animation is measured against.
            width={Sizes.CONTENT_MAX_WIDTH}
            style={styles.skeletonFill}
          />
        </View>
      ))}
    </View>
  )

  const errorBlock = (): React.JSX.Element => (
    <View style={styles.errorBlock}>
      <InfoBanner
        tone="error"
        glyph="alert"
        title={MEAL_PLAN_LOAD_ERROR_TITLE}
        body={MEAL_PLAN_LOAD_ERROR_BODY}
        actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        onAction={onRetryPressed}
        secondaryActionLabel={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  // 13e, and the neutral variant of it that an unconfirmed outcome earns. Drawn above the title, where the
  // frame puts it, and offering the same key again: a swap that did commit answers the retry with its stored
  // result, so the flow reaches the plan either way.
  const commitFailureBlock = (loaded: NonNullable<typeof ready>): React.JSX.Element => {
    const isConfirmed = commitFailure === 'confirmed'
    const title = isConfirmed ? SWAP_FAILED_TITLE : MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE
    const body = isConfirmed
      ? stringWithNamedParameters(SWAP_FAILED_BODY_TEMPLATE, {slot: MEAL_SLOT_SENTENCE_LABELS[loaded.meal.slot]})
      : MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY

    return (
      <View style={styles.errorBlock}>
        <InfoBanner
          tone="error"
          glyph="alert"
          title={title}
          body={body}
          actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
          onAction={onUseThisMealPressed}
          isActionPending={swapMutation.isPending}
          secondaryActionLabel={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
          onSecondaryAction={navigation.goBack}
        />
      </View>
    )
  }

  const previewBlock = (loaded: NonNullable<typeof ready>): React.JSX.Element => {
    const {alternative, dayTotalsIfSwapped, targets, calorieDelta} = loaded.preview
    const delta = deriveCalorieDelta(calorieDelta)

    // The pill's own text leads with a mathematical minus sign, so the direction is spoken in words: colour and
    // that one glyph are otherwise the whole difference between a day that drops and a day that climbs.
    const deltaAccessibilityLabel = stringWithNamedParameters(
      delta?.tone === 'negative'
        ? SWAP_PREVIEW_DELTA_DOWN_ACCESSIBILITY_TEMPLATE
        : SWAP_PREVIEW_DELTA_UP_ACCESSIBILITY_TEMPLATE,
      {calories: formatCalories(Math.abs(calorieDelta))}
    )

    const ingredients = resolvePreviewIngredients(
      alternative.recipe.ingredients,
      alternative.portionMultiplier,
      alternative.recipe.yieldServings
    )

    return (
      <>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{alternative.recipe.name}</Text>

          <Text style={styles.subtitle}>
            {formatPreviewSubtitle(alternative.portionText, alternative.recipe.totalMinutes)}
          </Text>
        </View>

        <View style={styles.thisMealSection}>
          <SectionOverline text={SWAP_PREVIEW_THIS_MEAL_LABEL} />

          <MetricGrid4 items={buildThisMealMetrics(alternative.nutrition)} />
        </View>

        <View style={styles.totalsCard}>
          <View style={styles.totalsHeaderRow}>
            <Text style={styles.totalsOverline}>
              {stringWithNamedParameters(SWAP_PREVIEW_DAY_TOTAL_TEMPLATE, {day: dayName})}
            </Text>

            {delta !== null && (
              <View accessible accessibilityLabel={deltaAccessibilityLabel}>
                <DeltaPill text={delta.text} tone={delta.tone} />
              </View>
            )}
          </View>

          <View style={styles.totalsFigureRow}>
            <BigNumberRow
              size="stat"
              figure={formatCalories(dayTotalsIfSwapped.calories)}
              unit={stringWithNamedParameters(SWAP_PREVIEW_OF_TARGET_TEMPLATE, {
                calories: formatCalories(targets.calories)
              })}
            />
          </View>

          <View style={styles.totalsBar}>
            <CalorieProgressBar
              ratio={calorieProgressRatio(dayTotalsIfSwapped.calories, targets.calories)}
              totalCalories={dayTotalsIfSwapped.calories}
              targetCalories={targets.calories}
            />
          </View>

          <View style={styles.legendBlock}>
            {buildSwapMacroLegend(dayTotalsIfSwapped, targets).map((item, index) => (
              <MacroLegendRow
                key={item.key}
                label={MEAL_PLAN_MACRO_LABELS[item.key]}
                valueText={item.valueText}
                dotColor={MACRO_DOT_COLORS[item.key]}
                isFirst={index === 0}
              />
            ))}
          </View>
        </View>

        <View style={styles.ingredientsSection}>
          <Text style={styles.ingredientsHeading}>{RECIPE_DETAIL_INGREDIENTS_HEADER}</Text>

          <View style={styles.ingredientsList}>
            {ingredients.map(ingredient => (
              <IngredientRow key={ingredient.name} name={ingredient.name} quantityText={ingredient.quantityText} />
            ))}
          </View>
        </View>
      </>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* The hero opens the recipe; the back button nested inside it is the deeper responder and keeps its
            own touches. */}
        {ready !== null && (
          <TouchableOpacity
            activeOpacity={Opacity.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE, {
              recipe: ready.preview.alternative.recipe.name
            })}
            onPress={onOpenRecipePressed}>
            <RecipeHero
              size="preview"
              iconKey={ready.preview.alternative.recipe.iconKey}
              contextText={formatReplacingContext(ready.meal.slot, params.date)}
              onBack={navigation.goBack}
            />
          </TouchableOpacity>
        )}

        <ContentColumn>
          {/* The ineligible refusal keeps the loading shape until the effect above pops the screen: its recovery
              is the toast, so drawing the generic "couldn't load" card and its retry would state the wrong cause
              for the one frame this screen has left. */}
          {ready === null && (isLoading || isRecipeIneligible ? loadingBlock() : errorBlock())}

          {ready !== null && commitFailure !== null && commitFailureBlock(ready)}

          {ready !== null && previewBlock(ready)}
        </ContentColumn>
      </ScrollView>

      {ready !== null && (
        <SetupFooter hairline>
          <PrimaryButton
            label={SWAP_USE_THIS_MEAL_BUTTON_TEXT}
            isLoading={swapMutation.isPending}
            disabled={isCommitBlocked}
            onPress={onUseThisMealPressed}
          />

          <TertiaryTextButton
            label={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
            disabled={swapMutation.isPending}
            onPress={navigation.goBack}
          />
        </SetupFooter>
      )}
    </View>
  )
}

export default SwapPreviewScreen
