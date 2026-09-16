import React, {useCallback, useEffect, useState} from 'react'

import {ScrollView, useWindowDimensions, View} from 'react-native'

import type {SwapPreview} from '@data/models/SwapAlternative'
import {Navigation, RecipeDetailRouteProp} from '@navigation/types'
import {queryKeys} from '@queries/keys'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useRecipeDetailQuery} from '@queries/mealPlanning/useRecipeDetailQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'
import {getApiErrorCode, getApiErrorStatus} from '@utility/ApiErrorUtility'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import BadgePill from '@components/BadgePill'
import ContentColumn from '@components/ContentColumn'
import InfoBanner from '@components/InfoBanner'
import IngredientRow from '@components/IngredientRow'
import MetricGrid4 from '@components/MetricGrid4'
import RecipeHero from '@components/RecipeHero'
import SegmentedControl, {SegmentedControlOption} from '@components/SegmentedControl'
import Skeleton from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_PLAN_LOAD_ERROR_BODY,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_LOG_MEAL_BUTTON_TEXT,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_SWAP_BUTTON_TEXT,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_SLOT_LABELS,
  PROTEIN_LABEL,
  RECIPE_BADGE_DISCLAIMER_CAPTION,
  RECIPE_BADGE_LABELS,
  RECIPE_DETAIL_FULL_RECIPE_SEGMENT_LABEL,
  RECIPE_DETAIL_INGREDIENTS_HEADER,
  RECIPE_DETAIL_INSTRUCTIONS_HEADER,
  RECIPE_DETAIL_PLANNED_PORTION_LABEL,
  RECIPE_DETAIL_UNAVAILABLE_TEXT,
  RECIPE_DETAIL_YOUR_PORTION_SEGMENT_LABEL,
  RECIPE_NUTRITION_METHOD_CAPTION
} from '@constants/strings'

import ActionBar from './components/ActionBar'
import InstructionStep from './components/InstructionStep'
import styles, {
  HERO_PLACEHOLDER_HEIGHT,
  PLACEHOLDER_RADIUS,
  PLACEHOLDER_ROW_HEIGHTS,
  placeholderWidth,
  scrollBottomReserve
} from './index.styled'
import {
  buildContextPillText,
  buildMetricGridItems,
  IngredientDisplayMode,
  resolveActionBarState,
  resolveBadgeLabels,
  resolveDisplayedIngredients,
  resolvePlannedNutrition,
  resolveRecipeDetailErrorBranch,
  shouldShowBadgeCaption
} from './index.util'

const METRIC_CAPTIONS = {
  calories: CAL_LABEL,
  protein: PROTEIN_LABEL,
  carbs: CARBS_LABEL,
  fat: FAT_LABEL
}

const SEGMENT_OPTIONS: SegmentedControlOption<IngredientDisplayMode>[] = [
  {key: 'portion', label: RECIPE_DETAIL_YOUR_PORTION_SEGMENT_LABEL},
  {key: 'full', label: RECIPE_DETAIL_FULL_RECIPE_SEGMENT_LABEL}
]

const RecipeDetail = (): React.JSX.Element => {
  const {recipeVersionId, context} = useRoute<RecipeDetailRouteProp>().params
  const navigation = useNavigation<Navigation>()
  const insets = useSafeAreaInsets()
  const {width: windowWidth} = useWindowDimensions()
  const queryClient = useQueryClient()

  // The toggle is a display preference of this one screen and writes nothing — not the plan, not the grocery
  // list, not the server (Figma note 49:679). Editing the planned portion happens when the meal is logged.
  const [displayMode, setDisplayMode] = useState<IngredientDisplayMode>('portion')

  const recipeQuery = useRecipeDetailQuery(recipeVersionId)
  const dayQuery = useMealPlanDayQuery(context.planId, context.date)
  const {refetch: refetchCurrentPlan} = useCurrentMealPlanQuery()

  const recipe = recipeQuery.data
  const envelope = dayQuery.data
  const plannedMeal = envelope?.day.meals.find(meal => meal.id === context.mealId)

  const isPreview = context.kind === 'preview'
  const previewAlternative = isPreview
    ? queryClient.getQueryData<SwapPreview>(
        queryKeys.swapPreview(context.planId, context.mealId, context.candidateRecipeVersionId, context.planRevision)
      )?.alternative
    : undefined

  const plannedTotals = isPreview ? previewAlternative?.nutrition : plannedMeal?.planned
  const portionText = isPreview ? previewAlternative?.portionText : plannedMeal?.portionText
  const portionMultiplier = isPreview ? previewAlternative?.portionMultiplier : plannedMeal?.portionMultiplier

  const actionBarState = resolveActionBarState(context.kind, envelope?.isWritable)
  const isPlanWriteRefused = actionBarState.isVisible && !actionBarState.isEnabled && !actionBarState.isPending

  const loadError = recipeQuery.error ?? dayQuery.error ?? null
  const isNotFound =
    loadError !== null &&
    resolveRecipeDetailErrorBranch(getApiErrorStatus(loadError), getApiErrorCode(loadError)) === 'not_found'
  const isLoading = recipeQuery.isPending || recipeQuery.isFetching || dayQuery.isPending || dayQuery.isFetching

  const planRevision = envelope?.planRevision
  const {refetch: refetchRecipe} = recipeQuery
  const {refetch: refetchDay} = dayQuery

  useEffect(() => {
    if (!isNotFound) {
      return
    }

    // A 404 from a resource route is the combined not-found/ownership answer: it never distinguishes a recipe
    // that is missing from one that is not the caller's, and it never means the feature is unavailable. There
    // is nothing here to retry, so the screen says so and leaves.
    showToast('error', RECIPE_DETAIL_UNAVAILABLE_TEXT)
    navigation.goBack()
  }, [isNotFound, navigation])

  useEffect(() => {
    if (!isPlanWriteRefused) {
      return
    }

    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    refetchCurrentPlan()
  }, [isPlanWriteRefused, refetchCurrentPlan])

  const onBack = useCallback((): void => {
    navigation.goBack()
  }, [navigation])

  const onRetry = useCallback((): void => {
    refetchDay()
    refetchRecipe()
  }, [refetchDay, refetchRecipe])

  const onLogMeal = useCallback((): void => {
    if (planRevision === undefined) {
      return
    }

    navigation.push(Screens.LOG_PLANNED_MEAL, {
      planId: context.planId,
      mealId: context.mealId,
      date: context.date,
      planRevision
    })
  }, [context.date, context.mealId, context.planId, navigation, planRevision])

  const onSwap = useCallback((): void => {
    if (planRevision === undefined) {
      return
    }

    navigation.push(Screens.SWAP_MEAL, {
      planId: context.planId,
      mealId: context.mealId,
      date: context.date,
      planRevision
    })
  }, [context.date, context.mealId, context.planId, navigation, planRevision])

  if (
    recipe === undefined ||
    plannedMeal === undefined ||
    plannedTotals === undefined ||
    portionText === undefined ||
    portionMultiplier === undefined
  ) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.scrollContent, scrollBottomReserve(insets.bottom)]}>
          <Skeleton height={HERO_PLACEHOLDER_HEIGHT} width={windowWidth} />

          <ContentColumn>
            {isLoading || isNotFound ? (
              <View accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL} style={styles.skeletonBlock}>
                {PLACEHOLDER_ROW_HEIGHTS.map(height => (
                  <Skeleton
                    key={height}
                    height={height}
                    width={placeholderWidth(windowWidth)}
                    borderRadius={PLACEHOLDER_RADIUS}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.errorBlock}>
                <InfoBanner
                  tone="error"
                  glyph="alert"
                  title={MEAL_PLAN_LOAD_ERROR_TITLE}
                  body={MEAL_PLAN_LOAD_ERROR_BODY}
                  actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
                  onAction={onRetry}
                />
              </View>
            )}
          </ContentColumn>
        </ScrollView>
      </View>
    )
  }

  const badgeLabels = resolveBadgeLabels(recipe.badges, RECIPE_BADGE_LABELS)
  const displayedIngredients = resolveDisplayedIngredients(
    recipe.ingredients,
    displayMode,
    portionMultiplier,
    recipe.yieldServings
  )
  const metricItems = buildMetricGridItems(resolvePlannedNutrition({planned: plannedTotals}), METRIC_CAPTIONS)
  const contextText = buildContextPillText(plannedMeal.slot, context.date, plannedMeal.slotTime, MEAL_SLOT_LABELS)
  const showBadgeCaption = shouldShowBadgeCaption(badgeLabels)

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.scrollContent, scrollBottomReserve(insets.bottom)]}>
        <RecipeHero iconKey={recipe.iconKey} contextText={contextText} onBack={onBack} />

        <ContentColumn>
          <Text style={styles.title}>{recipe.name}</Text>

          {badgeLabels.length > 0 && (
            <View style={styles.badgeRow}>
              {badgeLabels.map(label => (
                <BadgePill key={label} label={label} />
              ))}
            </View>
          )}

          {showBadgeCaption && <Text style={styles.badgeCaption}>{RECIPE_BADGE_DISCLAIMER_CAPTION}</Text>}

          <View style={styles.nutritionCard}>
            <View style={styles.nutritionHeaderRow}>
              <Text style={styles.nutritionCardLabel}>{RECIPE_DETAIL_PLANNED_PORTION_LABEL}</Text>

              <Text style={styles.portionValue}>{portionText}</Text>
            </View>

            <View style={styles.divider} />

            <View accessible>
              <MetricGrid4 items={metricItems} />
            </View>
          </View>

          <Text style={styles.provenanceCaption}>{RECIPE_NUTRITION_METHOD_CAPTION}</Text>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>{RECIPE_DETAIL_INGREDIENTS_HEADER}</Text>

            <SegmentedControl
              options={SEGMENT_OPTIONS}
              selected={displayMode}
              onChange={setDisplayMode}
              variant="small"
            />
          </View>

          <View style={styles.ingredientList}>
            {displayedIngredients.map((ingredient, position) => (
              <View accessible key={position}>
                <IngredientRow name={ingredient.name} quantityText={ingredient.quantityText} />
              </View>
            ))}
          </View>

          <Text style={[styles.sectionHeading, styles.standaloneSectionHeading]}>
            {RECIPE_DETAIL_INSTRUCTIONS_HEADER}
          </Text>

          <View style={styles.instructionList}>
            {recipe.instructions.map((instruction, position) => (
              <View accessible key={position}>
                <InstructionStep index={position + 1} text={instruction} />
              </View>
            ))}
          </View>
        </ContentColumn>
      </ScrollView>

      {actionBarState.isVisible && (
        <ActionBar
          onLogMeal={onLogMeal}
          onSwap={onSwap}
          logLabel={MEAL_PLAN_LOG_MEAL_BUTTON_TEXT}
          swapLabel={MEAL_PLAN_SWAP_BUTTON_TEXT}
          isEnabled={actionBarState.isEnabled}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  )
}

export default RecipeDetail
