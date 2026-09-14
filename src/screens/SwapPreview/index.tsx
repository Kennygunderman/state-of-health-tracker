import React, {useCallback, useEffect, useMemo, useRef} from 'react'

import {ScrollView, View} from 'react-native'

import {Navigation, SwapPreviewRouteProp} from '@navigation/types'
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
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES, getApiErrorCode, isUnknownOutcome} from '@utility/ApiErrorUtility'
import {mintKey, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {dayStripLabel} from '@utility/MealPlanDateUtility'
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
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  RECIPE_DETAIL_INGREDIENTS_HEADER,
  stringWithNamedParameters,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_PREVIEW_DAY_TOTAL_TEMPLATE,
  SWAP_PREVIEW_OF_TARGET_TEMPLATE,
  SWAP_PREVIEW_THIS_MEAL_LABEL,
  SWAP_RECIPE_INELIGIBLE_TOAST,
  SWAP_SUCCESS_TOAST,
  SWAP_USE_THIS_MEAL_BUTTON_TEXT
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

/**
 * Frame 13b. The commit is keyed: the intent is recorded before the request leaves and the key is reused only
 * for a byte-identical replay, so a response lost in transit is asked again rather than swapping the meal a
 * second time (AAP 0.7.2). Every failure of it is drawn by `SwapMeal`, which owns 13e and the same-key retry.
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

  const previewQuery = useSwapPreviewQuery(params.planId, params.mealId, params.recipeVersionId, params.planRevision)
  const dayQuery = useMealPlanDayQuery(params.planId, params.date)
  const swapMutation = useSwapMealMutation(params.planId, params.mealId)

  const preview = previewQuery.data ?? null
  const meal = dayQuery.data?.day.meals.find(candidate => candidate.id === params.mealId) ?? null

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

  const onSwapCommitted = useCallback((): void => {
    // A server answer to the key resolves the intent, whether it committed now or replayed a stored result.
    clearPendingIntent('swap')
    showToast('success', SWAP_SUCCESS_TOAST)
    setSelectedPlanDate(params.date)
    setMacrosSegment('mealPlan')
    navigation.popTo(Screens.MACROS)
  }, [clearPendingIntent, navigation, params.date, setMacrosSegment, setSelectedPlanDate])

  /**
   * The snapshot is built here because this screen is the only place holding all five members of the 0.5.2 wire
   * request: the route's plan and meal, the alternative it is previewing, and the portion and revision the
   * preview envelope bound.
   *
   * `onError` leaves for `SwapMeal` on purpose: every drawn failure state of a swap belongs to that frame (13e
   * and the neutral unconfirmed variant), it reads the outcome from the shared mutation cache so this unmount
   * loses nothing, and this screen holds no entered values to lose.
   */
  const onUseThisMealPressed = useCallback((): void => {
    if (ready === null) {
      return
    }

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

    swapMutation.mutate(
      {
        recipeVersionId: params.recipeVersionId,
        portionMultiplier: request.portionMultiplier,
        expectedPlanRevision: request.expectedPlanRevision,
        idempotencyKey: plan.idempotencyKey
      },
      {onSuccess: onSwapCommitted, onError: navigation.goBack}
    )
  }, [
    navigation.goBack,
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
        body={MEAL_PLAN_LOAD_ERROR_TITLE}
        actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        onAction={onRetryPressed}
        secondaryActionLabel={SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  const previewBlock = (loaded: NonNullable<typeof ready>): React.JSX.Element => {
    const {alternative, dayTotalsIfSwapped, targets, calorieDelta} = loaded.preview
    const delta = deriveCalorieDelta(calorieDelta)
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

            {delta !== null && <DeltaPill text={delta.text} tone={delta.tone} />}
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
        {ready !== null && (
          <RecipeHero
            size="preview"
            iconKey={ready.preview.alternative.recipe.iconKey}
            contextText={formatReplacingContext(ready.meal.slot, params.date)}
            onBack={navigation.goBack}
          />
        )}

        <ContentColumn>
          {/* The ineligible refusal keeps the loading shape until the effect above pops the screen: its recovery
              is the toast, so drawing the generic "couldn't load" card and its retry would state the wrong cause
              for the one frame this screen has left. */}
          {ready === null && (isLoading || isRecipeIneligible ? loadingBlock() : errorBlock())}

          {ready !== null && previewBlock(ready)}
        </ContentColumn>
      </ScrollView>

      {ready !== null && (
        <SetupFooter hairline>
          <PrimaryButton
            label={SWAP_USE_THIS_MEAL_BUTTON_TEXT}
            isLoading={swapMutation.isPending}
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
