import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {SectionList, SectionListData, SectionListRenderItem, useWindowDimensions, View} from 'react-native'

import {Navigation, RecipeDetailRouteProp} from '@navigation/types'
import {useCurrentMealPlanRecovery} from '@queries/mealPlanning/useCurrentMealPlanRecovery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useRecipeDetailQuery} from '@queries/mealPlanning/useRecipeDetailQuery'
import {useSwapPreviewQuery} from '@queries/mealPlanning/useSwapPreviewQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import BadgePill from '@components/BadgePill'
import ContentColumn from '@components/ContentColumn'
import InfoBanner from '@components/InfoBanner'
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
  MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT,
  MEAL_PLAN_LOAD_ERROR_BODY,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_LOG_MEAL_BUTTON_TEXT,
  MEAL_PLAN_OFFLINE_BANNER_TEXT,
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
  RECIPE_NUTRITION_METHOD_CAPTION,
  SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT,
  SWAP_RECIPE_INELIGIBLE_TOAST
} from '@constants/strings'

import ActionBar from './components/ActionBar'
import RecipeRow from './components/RecipeRow'
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
  buildRecipeDetailSections,
  IngredientDisplayMode,
  previewQueryScope,
  RecipeDetailRow,
  RecipeDetailSection,
  resolveActionBarState,
  resolveBadgeLabels,
  resolveDisplayedIngredients,
  resolvePlannedNutrition,
  resolveRecipeDetailRead,
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

// One shared identity for the empty case: handing the list a fresh `[]` on each render would churn its props
// while the screen has nothing to show yet.
const NO_SECTIONS: RecipeDetailSection[] = []

const RecipeDetail = (): React.JSX.Element => {
  const {recipeVersionId, context} = useRoute<RecipeDetailRouteProp>().params
  const navigation = useNavigation<Navigation>()
  const insets = useSafeAreaInsets()
  const {width: windowWidth} = useWindowDimensions()
  const recoverCurrentPlan = useCurrentMealPlanRecovery()

  // The toggle is a display preference of this one screen and writes nothing — not the plan, not the grocery
  // list, not the server (Figma note 49:679). Editing the planned portion happens when the meal is logged.
  const [displayMode, setDisplayMode] = useState<IngredientDisplayMode>('portion')

  const recipeQuery = useRecipeDetailQuery(recipeVersionId)
  const dayQuery = useMealPlanDayQuery(context.planId, context.date)
  // OBSERVED, not sampled. A one-time `getQueryData` read never subscribed, so the screen missed the entry
  // landing and its retry had no way to ask for a preview that had been evicted or never cached; the scope
  // disables the query outright in the plan context, which has no candidate to preview.
  const previewQuery = useSwapPreviewQuery(...previewQueryScope(context))

  const recipe = recipeQuery.data
  const envelope = dayQuery.data
  const plannedMeal = envelope?.day.meals.find(meal => meal.id === context.mealId)

  const isPreview = context.kind === 'preview'
  const previewAlternative = previewQuery.data?.alternative

  const plannedTotals = isPreview ? previewAlternative?.nutrition : plannedMeal?.planned
  const portionText = isPreview ? previewAlternative?.portionText : plannedMeal?.portionText
  const portionMultiplier = isPreview ? previewAlternative?.portionMultiplier : plannedMeal?.portionMultiplier

  // Everything frame 12 needs, held as one value so each member is non-null wherever it is read. Memoized on
  // its own members rather than rebuilt per render, because the row projection below is keyed on it.
  const content = useMemo(
    () =>
      recipe !== undefined &&
      plannedMeal !== undefined &&
      plannedTotals !== undefined &&
      portionText !== undefined &&
      portionMultiplier !== undefined
        ? {recipe, plannedMeal, plannedTotals, portionText, portionMultiplier}
        : null,
    [plannedMeal, plannedTotals, portionMultiplier, portionText, recipe]
  )

  // A disabled query stays `pending` for the life of the screen, so the plan context counts the preview read
  // only when it is the context that issues one — otherwise the loading strip would never resolve.
  const isPreviewReadInFlight = isPreview && (previewQuery.isPending || previewQuery.isFetching)
  const isReadInFlight =
    recipeQuery.isPending ||
    recipeQuery.isFetching ||
    dayQuery.isPending ||
    dayQuery.isFetching ||
    isPreviewReadInFlight
  // What the Try-again press is waiting on, which is narrower: a read already in flight, not one that has yet
  // to start.
  const isRetryPending = recipeQuery.isFetching || dayQuery.isFetching || (isPreview && previewQuery.isFetching)

  // Each read is classified against its own route: only `/recipes/:id` can report the recipe unavailable, and a
  // failure is reported whether or not there is cached content to render (see `resolveRecipeDetailRead`).
  const read = resolveRecipeDetailRead({
    recipeError: recipeQuery.error,
    dayError: dayQuery.error,
    previewError: previewQuery.error,
    isReadInFlight,
    hasContent: content !== null
  })

  const actionBarState = resolveActionBarState(context.kind, envelope?.isWritable, read.isWriteUnconfirmed)
  const isPlanWriteRefused = actionBarState.isVisible && !actionBarState.isEnabled && !actionBarState.isPending

  // The two recoveries that leave the screen, and the copy each owes the user. A recipe 404 is the combined
  // not-found/ownership answer of the recipe resource; a confirmed `recipe_ineligible` is the preview route
  // retiring the candidate. Neither can be retried, so both say why and go back.
  const departureToast =
    read.failure?.recovery === 'recipeUnavailable'
      ? RECIPE_DETAIL_UNAVAILABLE_TEXT
      : read.failure?.recovery === 'previewIneligible'
        ? SWAP_RECIPE_INELIGIBLE_TOAST
        : null
  // The third departure, and the one that is about the feature rather than about this recipe or this plan: a
  // gated route has confirmed meal planning is switched off behind a mounted backend.
  const needsPlanTabDeparture = read.failure?.recovery === 'exitToPlanTab'
  // One recovery for both ways a plan stops being the plan this screen holds — a plan route that contradicted
  // it, and a verdict that refused writes on it — so the user is told once and the current plan is re-read once.
  //
  // It yields to the capability departure, which can coincide with it: a seeded day envelope that answered
  // `isWritable: false` refuses writes while a gated read reports the capability off, and a plan that is simply
  // out of reach must not be announced as one the server has contradicted (AAP 0.2.5 — the capability answer is
  // the one that governs). The departure re-reads the current plan itself, so nothing is lost by standing down.
  const needsPlanRecovery = !needsPlanTabDeparture && (read.failure?.recovery === 'planRecovery' || isPlanWriteRefused)

  const planRevision = envelope?.planRevision
  const {refetch: refetchRecipe} = recipeQuery
  const {refetch: refetchDay} = dayQuery
  const {refetch: refetchPreview} = previewQuery

  useEffect(() => {
    if (departureToast === null) {
      return
    }

    // Neither departure means the feature is unavailable, and neither has anything to retry: a resource 404
    // never distinguishes a recipe that is missing from one that is not the caller's, and an ineligible
    // candidate stays ineligible however often it is asked for.
    showToast('error', departureToast)
    navigation.goBack()
  }, [departureToast, navigation])

  useEffect(() => {
    if (!needsPlanTabDeparture) {
      return
    }

    // Nothing this screen reads can answer again while the capability is off, so there is nothing here to
    // retry and no copy to carry: the refusal is stated once, by the Meal Plan segment's neutral unavailable
    // card (AAP 0.2.5), which is why this departure is silent — the treatment `SwapMeal` and `SwapPreview`
    // already give this answer.
    //
    // NO refetch goes out with it. The error that produced this departure is already in the query cache, and
    // the entitlement recorder reads the whole cache, so the signal that raises that card is recorded without
    // another request. Re-reading the current plan here would be a gated request issued *after* a confirmed
    // refusal — the one thing AAP 0.2.5 says a latched client must not do — against the route that has just
    // refused, which is the recovery this very screen classifies as the one that cannot succeed.
    navigation.popTo(Screens.MACROS)
  }, [navigation, needsPlanTabDeparture])

  useEffect(() => {
    if (!needsPlanRecovery) {
      return
    }

    showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
    // Refetched on demand rather than through a mounted observer: this screen never renders the current plan,
    // and a normal observer would keep `/plans/current` live behind every stacked route for a recovery that
    // rarely happens. Which entry that is, and how it is re-read, belongs to the query layer.
    recoverCurrentPlan()
  }, [needsPlanRecovery, recoverCurrentPlan])

  const onBack = useCallback((): void => {
    navigation.goBack()
  }, [navigation])

  const onRetry = useCallback((): void => {
    refetchDay()
    refetchRecipe()

    if (isPreview) {
      refetchPreview()
    }
  }, [isPreview, refetchDay, refetchPreview, refetchRecipe])

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

  // The two lists frame 12 draws are the sections of one virtualized list, so a long recipe mounts the rows it
  // shows instead of all of them (AAP 0.7.4). The projection is recomputed only when the recipe or the portion
  // toggle changes, which is what lets the memoized rows hold.
  const sections = useMemo<RecipeDetailSection[]>(
    () =>
      content === null
        ? NO_SECTIONS
        : buildRecipeDetailSections(
            resolveDisplayedIngredients(
              content.recipe.ingredients,
              displayMode,
              content.portionMultiplier,
              content.recipe.yieldServings
            ),
            content.recipe.instructions
          ),
    [content, displayMode]
  )

  const rowKey = useCallback((row: RecipeDetailRow): string => row.key, [])

  const renderRow = useCallback<SectionListRenderItem<RecipeDetailRow, RecipeDetailSection>>(
    ({item}) => (
      <View accessible style={[styles.listColumn, styles.listRow]}>
        <RecipeRow row={item} />
      </View>
    ),
    []
  )

  const renderSectionHeader = useCallback(
    ({section}: {section: SectionListData<RecipeDetailRow, RecipeDetailSection>}): React.JSX.Element =>
      section.key === 'ingredients' ? (
        <View style={[styles.listColumn, styles.sectionHeaderRow]}>
          <Text style={styles.sectionHeading}>{RECIPE_DETAIL_INGREDIENTS_HEADER}</Text>

          <SegmentedControl
            options={SEGMENT_OPTIONS}
            selected={displayMode}
            onChange={setDisplayMode}
            variant="small"
          />
        </View>
      ) : (
        <View style={styles.listColumn}>
          <Text style={[styles.sectionHeading, styles.standaloneSectionHeading]}>
            {RECIPE_DETAIL_INSTRUCTIONS_HEADER}
          </Text>
        </View>
      ),
    [displayMode]
  )

  const badgeLabels = content === null ? [] : resolveBadgeLabels(content.recipe.badges, RECIPE_BADGE_LABELS)

  // Content shown over a read that failed is the last answer this screen received, so it says so and offers the
  // read again. The write actions are withheld by the same flag, because the plan revision they would pin is
  // exactly what could not be confirmed.
  const savedCopyBanner = read.isSavedCopy ? (
    <ContentColumn>
      <View style={styles.bannerBlock}>
        <InfoBanner
          tone="neutral"
          glyph="info"
          body={MEAL_PLAN_OFFLINE_BANNER_TEXT}
          actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
          onAction={onRetry}
          isActionPending={isRetryPending}
        />
      </View>
    </ContentColumn>
  ) : null

  const listHeader = (
    <>
      {content === null ? (
        <Skeleton height={HERO_PLACEHOLDER_HEIGHT} width={windowWidth} />
      ) : (
        <RecipeHero
          iconKey={content.recipe.iconKey}
          contextText={buildContextPillText(
            content.plannedMeal.slot,
            context.date,
            content.plannedMeal.slotTime,
            MEAL_SLOT_LABELS
          )}
          onBack={onBack}
        />
      )}

      {savedCopyBanner}

      {content !== null && (
        <ContentColumn>
          <Text style={styles.title}>{content.recipe.name}</Text>

          {badgeLabels.length > 0 && (
            <View style={styles.badgeRow}>
              {badgeLabels.map(label => (
                <BadgePill key={label} label={label} />
              ))}
            </View>
          )}

          {shouldShowBadgeCaption(badgeLabels) && (
            <Text style={styles.badgeCaption}>{RECIPE_BADGE_DISCLAIMER_CAPTION}</Text>
          )}

          <View style={styles.nutritionCard}>
            <View style={styles.nutritionHeaderRow}>
              <Text style={styles.nutritionCardLabel}>{RECIPE_DETAIL_PLANNED_PORTION_LABEL}</Text>

              <Text style={styles.portionValue}>{content.portionText}</Text>
            </View>

            <View style={styles.divider} />

            <View accessible>
              <MetricGrid4
                items={buildMetricGridItems(resolvePlannedNutrition({planned: content.plannedTotals}), METRIC_CAPTIONS)}
              />
            </View>
          </View>

          <Text style={styles.provenanceCaption}>{RECIPE_NUTRITION_METHOD_CAPTION}</Text>
        </ContentColumn>
      )}
    </>
  )

  // What stands in for the recipe while there is none to show. A recipe 404 gets nothing: its recovery is
  // already leaving the screen, and a retry card there would offer a retry that cannot succeed.
  const listPlaceholder =
    read.placeholder === 'loading' ? (
      <ContentColumn>
        {/* One accessible element reporting busy, the same shape `SwapPreview`'s loading shell takes: the bars
            under it say nothing a screen reader can use, and the status it is given while the strip is up is
            the one the error placeholder below then replaces. */}
        <View
          accessible
          accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}
          accessibilityState={{busy: true}}
          style={styles.skeletonBlock}>
          {PLACEHOLDER_ROW_HEIGHTS.map(height => (
            <Skeleton
              key={height}
              height={height}
              width={placeholderWidth(windowWidth)}
              borderRadius={PLACEHOLDER_RADIUS}
            />
          ))}
        </View>
      </ContentColumn>
    ) : read.placeholder === 'error' ? (
      <ContentColumn>
        {/* `statusRole` because this arrives in place of the busy strip above rather than with the screen:
            the banner groups its own title and body into one alert and speaks the pair on both platforms,
            leaving "Try again" and the back action separately reachable. */}
        <View style={styles.errorBlock}>
          <InfoBanner
            tone="error"
            glyph="alert"
            title={MEAL_PLAN_LOAD_ERROR_TITLE}
            body={MEAL_PLAN_LOAD_ERROR_BODY}
            statusRole="alert"
            actionLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
            onAction={onRetry}
            isActionPending={isRetryPending}
            secondaryActionLabel={
              isPreview ? SWAP_BACK_TO_ALTERNATIVES_BUTTON_TEXT : MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT
            }
            onSecondaryAction={onBack}
          />
        </View>
      </ContentColumn>
    ) : null

  return (
    <View style={styles.screen}>
      <SectionList<RecipeDetailRow, RecipeDetailSection>
        sections={sections}
        keyExtractor={rowKey}
        renderItem={renderRow}
        renderSectionHeader={renderSectionHeader}
        // Frame 12 pins neither heading: both scroll away with the rows they introduce.
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.scrollContent, scrollBottomReserve(insets.bottom)]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listPlaceholder}
      />

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
