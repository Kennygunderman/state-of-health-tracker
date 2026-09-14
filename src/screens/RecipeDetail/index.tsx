import React, {useEffect, useRef, useState} from 'react'

import {LayoutChangeEvent, SectionList, SectionListRenderItem, View} from 'react-native'

import type {SwapPreview} from '@data/models/SwapAlternative'
import {Navigation, RecipeDetailRouteProp} from '@navigation/types'
import {queryKeys} from '@queries/keys'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useRecipeDetailQuery} from '@queries/mealPlanning/useRecipeDetailQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {useQueryClient} from '@tanstack/react-query'
import {getApiErrorCode} from '@utility/ApiErrorUtility'

import BadgePill from '@components/BadgePill'
import ContentColumn from '@components/ContentColumn'
import InfoBanner from '@components/InfoBanner'
import IngredientRow from '@components/IngredientRow'
import MetricGrid4 from '@components/MetricGrid4'
import RecipeHero from '@components/RecipeHero'
import SegmentedControl, {SegmentedControlOption} from '@components/SegmentedControl'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT,
  MEAL_PLAN_LOAD_ERROR_TITLE,
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
import styles from './index.styled'
import {
  buildContextPillText,
  buildMetricGridItems,
  DisplayedIngredient,
  IngredientDisplayMode,
  MetricGridCaptions,
  PlannedNutritionSource,
  RecipeDetailErrorBranch,
  resolveActionBarState,
  resolveBadgeLabels,
  resolveDisplayedIngredients,
  resolvePlannedNutrition,
  resolveRecipeDetailErrorBranch,
  shouldShowBadgeCaption
} from './index.util'

// The metric grid's four captions. MetricGrid4 uppercases them itself, so the lower-case shared labels are the
// same tokens the swap preview's own metrics use — one wording for one figure across both frames.
const METRIC_CAPTIONS: MetricGridCaptions = {
  calories: CAL_LABEL,
  protein: PROTEIN_LABEL,
  carbs: CARBS_LABEL,
  fat: FAT_LABEL
}

// Only frame 12 offers the whole-recipe column, so the two segments live with this screen rather than with the
// scaling utility the swap preview shares.
const INGREDIENT_SEGMENTS: SegmentedControlOption<IngredientDisplayMode>[] = [
  {key: 'portion', label: RECIPE_DETAIL_YOUR_PORTION_SEGMENT_LABEL},
  {key: 'full', label: RECIPE_DETAIL_FULL_RECIPE_SEGMENT_LABEL}
]

// The loading shape of the content column: the hero band, the title, the nutrition card and two list rows.
const SKELETON_HEIGHTS: number[] = [
  Sizes.HERO_BAND_H,
  Sizes.CONTROL,
  Sizes.CONTROL_LG,
  Sizes.SKELETON_BAR,
  Sizes.SKELETON_BAR
]

const FIRST_STEP_NUMBER = 1

// The two lists frame 12 draws are sections of one list, so every row below the header sizes to content at
// large dynamic type instead of being mapped eagerly inside a scroll view (AAP 0.7.4).
type RecipeRow =
  | {kind: 'ingredient'; key: string; ingredient: DisplayedIngredient}
  | {kind: 'instruction'; key: string; step: number; text: string}

interface RecipeSection {
  key: 'ingredients' | 'instructions'
  data: RecipeRow[]
}

/**
 * Frame 12: one planned recipe, read either as the meal it is in the plan or as the candidate a swap preview is
 * offering.
 *
 * Both context variants carry `planId`, `mealId` and `date`, so the day query is called unconditionally and the
 * meal it returns supplies the context pill and — in the plan context — the planned portion. The preview
 * context's planned values are the ones the swap preview already computed, read from the cache that screen
 * populated rather than by enabling a second request for figures the app is holding.
 */
const RecipeDetailScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const {params} = useRoute<RecipeDetailRouteProp>()
  const queryClient = useQueryClient()

  const {context, recipeVersionId} = params

  const recipeQuery = useRecipeDetailQuery(recipeVersionId)
  const dayQuery = useMealPlanDayQuery(context.planId, context.date)

  const [ingredientMode, setIngredientMode] = useState<IngredientDisplayMode>('portion')
  const [skeletonWidth, setSkeletonWidth] = useState(0)

  const recipe = recipeQuery.data ?? null
  const envelope = dayQuery.data ?? null
  const meal = envelope?.day.meals.find(candidate => candidate.id === context.mealId) ?? null

  const preview =
    context.kind === 'preview'
      ? (queryClient.getQueryData<SwapPreview>(
          queryKeys.swapPreview(context.planId, context.mealId, context.candidateRecipeVersionId, context.planRevision)
        ) ?? null)
      : null

  // The portion this screen describes: the plan's own multiplier, or the candidate's as the preview scaled it.
  // The server's scaled nutrition is preferred over recomputing it from the per-serving figures, because the
  // day it would be planned against was balanced with exactly those numbers.
  const portionMultiplier =
    context.kind === 'preview' ? (preview?.alternative.portionMultiplier ?? null) : (meal?.portionMultiplier ?? null)
  const portionText =
    context.kind === 'preview' ? (preview?.alternative.portionText ?? null) : (meal?.portionText ?? null)
  const plannedSource: PlannedNutritionSource | null =
    context.kind === 'preview'
      ? preview === null
        ? null
        : {planned: preview.alternative.nutrition}
      : meal === null
        ? null
        : {planned: meal.planned}

  // Held as one object so each member is non-null wherever it is read, rather than re-checked at every use.
  const ready =
    recipe !== null && meal !== null && plannedSource !== null && portionText !== null && portionMultiplier !== null
      ? {recipe, meal, plannedSource, portionText, portionMultiplier}
      : null

  const isLoading = recipeQuery.isLoading || dayQuery.isLoading

  // A 404 on a resource route is the combined not-found and ownership answer, and the branch is the util's to
  // decide — only the caller holds the error the status and code come from. Null while the read has not failed,
  // because the util answers 'inline' for every non-404 status, the absence of one included.
  const recipeError: unknown = recipeQuery.error ?? null
  const errorBranch: RecipeDetailErrorBranch | null =
    recipeError === null
      ? null
      : resolveRecipeDetailErrorBranch(
          (recipeError as {response?: {status?: number}}).response?.status ?? null,
          getApiErrorCode(recipeError)
        )

  const actionBarState = resolveActionBarState(context.kind, envelope?.isWritable)

  const recoveredNotFoundRecipe = useRef(false)

  /**
   * AAP 0.2.5 for `useRecipeDetailQuery`: a 404 from the resource route is answered by the recipe-unavailable
   * toast and `goBack()`, and there is nothing to retry, so no banner is drawn for it. The ref makes that one
   * recovery per screen — a new query identity must not toast again behind a screen that is already popping.
   */
  useEffect(() => {
    if (errorBranch !== 'not_found' || recoveredNotFoundRecipe.current) {
      return
    }

    recoveredNotFoundRecipe.current = true

    showToast('error', RECIPE_DETAIL_UNAVAILABLE_TEXT)
    navigation.goBack()
  }, [errorBranch, navigation])

  const onSkeletonLayout = (event: LayoutChangeEvent) => setSkeletonWidth(event.nativeEvent.layout.width)

  const onRetryPressed = () => {
    recipeQuery.refetch()
    dayQuery.refetch()
  }

  const openPlanRoute = (route: typeof Screens.LOG_PLANNED_MEAL | typeof Screens.SWAP_MEAL): void => {
    if (envelope === null) {
      return
    }

    const routeParams = {
      planId: context.planId,
      mealId: context.mealId,
      date: context.date,
      // The revision the day was read at, which is what both destinations pin their write to.
      planRevision: envelope.planRevision
    }

    if (route === Screens.LOG_PLANNED_MEAL) {
      navigation.navigate(Screens.LOG_PLANNED_MEAL, routeParams)

      return
    }

    navigation.navigate(Screens.SWAP_MEAL, routeParams)
  }

  /**
   * A plan the server has superseded — or a week that has finished, which storage still calls active — can
   * accept neither write, and the envelope's `isWritable` is what says so. AAP 0.2.5 answers that where the
   * user asked for it — the stale-plan toast and a `mealPlanCurrent` refetch — rather than with two controls
   * that do nothing, so `isEnabled` decides what the press does and never whether it is possible.
   *
   * A verdict that has not arrived is NOT that refusal. The bar renders disabled while `isPending`, so this
   * branch is normally unreachable; it returns rather than toasting because reaching it would mean telling a
   * user whose plan is live that it is no longer active, purely because the day request is still in flight.
   */
  const onPlanActionPressed = (route: typeof Screens.LOG_PLANNED_MEAL | typeof Screens.SWAP_MEAL): void => {
    if (actionBarState.isPending) {
      return
    }

    if (!actionBarState.isEnabled) {
      showToast('error', MEAL_PLAN_STALE_PLAN_TOAST)
      queryClient.refetchQueries({queryKey: queryKeys.mealPlanCurrent})

      return
    }

    openPlanRoute(route)
  }

  const loadingBlock = (): React.JSX.Element => (
    <View
      style={styles.skeletonBlock}
      onLayout={onSkeletonLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {skeletonWidth > 0 &&
        SKELETON_HEIGHTS.map((height, index) => (
          <SkeletonBlock
            key={`${height}-${index}`}
            height={height}
            // Skeleton takes a number and sizes its shimmer sweep from it, so the measured column width is what
            // the animation has to match (the 13c pattern).
            width={skeletonWidth}
            borderRadius={BorderRadius.TILE}
          />
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
        secondaryActionLabel={MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT}
        onSecondaryAction={navigation.goBack}
      />
    </View>
  )

  // What stands in for the recipe while there is none to show. A 404 gets nothing: its recovery is already
  // popping this screen, and the retry card would offer a retry that cannot succeed.
  const placeholderBlock = (): React.JSX.Element | null => {
    if (isLoading) {
      return loadingBlock()
    }

    return errorBranch === 'not_found' ? null : errorBlock()
  }

  const badgeLabels = ready === null ? [] : resolveBadgeLabels(ready.recipe.badges, RECIPE_BADGE_LABELS)

  const sections: RecipeSection[] =
    ready === null
      ? []
      : [
          {
            key: 'ingredients',
            data: resolveDisplayedIngredients(
              ready.recipe.ingredients,
              ingredientMode,
              ready.portionMultiplier,
              ready.recipe.yieldServings
            ).map((ingredient): RecipeRow => ({kind: 'ingredient', key: ingredient.name, ingredient}))
          },
          {
            key: 'instructions',
            data: ready.recipe.instructions.map(
              (instruction, index): RecipeRow => ({
                kind: 'instruction',
                key: `${index}-${instruction}`,
                step: index + FIRST_STEP_NUMBER,
                text: instruction
              })
            )
          }
        ]

  const headerBlock = (loaded: NonNullable<typeof ready>): React.JSX.Element => (
    <>
      <Text style={styles.title}>{loaded.recipe.name}</Text>

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
          <Text style={styles.nutritionOverline}>{RECIPE_DETAIL_PLANNED_PORTION_LABEL}</Text>

          <Text style={styles.portionValue}>{loaded.portionText}</Text>
        </View>

        <View style={styles.divider} />

        <MetricGrid4 items={buildMetricGridItems(resolvePlannedNutrition(loaded.plannedSource), METRIC_CAPTIONS)} />

        <Text style={styles.provenanceCaption}>{RECIPE_NUTRITION_METHOD_CAPTION}</Text>
      </View>
    </>
  )

  const renderSectionHeader = (section: RecipeSection): React.JSX.Element =>
    section.key === 'ingredients' ? (
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeading}>{RECIPE_DETAIL_INGREDIENTS_HEADER}</Text>

        <SegmentedControl
          options={INGREDIENT_SEGMENTS}
          selected={ingredientMode}
          onChange={setIngredientMode}
          variant="unit"
        />
      </View>
    ) : (
      <Text style={[styles.sectionHeading, styles.standaloneSectionHeading]}>{RECIPE_DETAIL_INSTRUCTIONS_HEADER}</Text>
    )

  /**
   * Each row carries its list's own style as a wrapper: a virtualized cell is laid out alone and cannot inherit
   * the container's `rowGap`, while that style's `marginTop` is already the rung the frame draws between rows
   * and above the first one — so the rhythm is unchanged and no style has to be added.
   */
  const renderRow: SectionListRenderItem<RecipeRow, RecipeSection> = ({item}) =>
    item.kind === 'ingredient' ? (
      <View style={styles.ingredientList}>
        <IngredientRow name={item.ingredient.name} quantityText={item.ingredient.quantityText} />
      </View>
    ) : (
      <View style={styles.instructionList}>
        <InstructionStep index={item.step} text={item.text} />
      </View>
    )

  return (
    <View style={styles.screen}>
      {/* The hero band bleeds to both screen edges, so it sits above the column that insets everything else. */}
      {ready !== null && (
        <RecipeHero
          iconKey={ready.recipe.iconKey}
          contextText={buildContextPillText(ready.meal.slot, context.date, ready.meal.slotTime, MEAL_SLOT_LABELS)}
          onBack={navigation.goBack}
        />
      )}

      <ContentColumn>
        <SectionList<RecipeRow, RecipeSection>
          sections={sections}
          keyExtractor={row => row.key}
          renderItem={renderRow}
          renderSectionHeader={({section}) => renderSectionHeader(section)}
          // Frame 12 pins neither heading: both scroll away with the rows they introduce.
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.scrollContent}
          ListHeaderComponent={ready === null ? null : headerBlock(ready)}
          ListEmptyComponent={ready === null ? placeholderBlock() : null}
        />
      </ContentColumn>

      {ready !== null && actionBarState.isVisible && (
        <ActionBar
          logLabel={MEAL_PLAN_LOG_MEAL_BUTTON_TEXT}
          swapLabel={MEAL_PLAN_SWAP_BUTTON_TEXT}
          // Pressable whenever a verdict has arrived, so a refusal can explain itself on press; disabled only
          // while none has, which is the app's treatment for a control whose answer is still loading.
          isEnabled={!actionBarState.isPending}
          onLogMeal={() => onPlanActionPressed(Screens.LOG_PLANNED_MEAL)}
          onSwap={() => onPlanActionPressed(Screens.SWAP_MEAL)}
        />
      )}
    </View>
  )
}

export default RecipeDetailScreen
