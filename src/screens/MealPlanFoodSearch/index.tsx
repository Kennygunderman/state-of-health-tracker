import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import {
  FlatList,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  ListRenderItemInfo,
  Platform,
  TouchableOpacity,
  View
} from 'react-native'

import type {CatalogFood} from '@data/models/CatalogFood'
import type {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {Navigation} from '@navigation/types'
import {useCatalogSearchInfiniteQuery} from '@queries/catalog/useCatalogSearchInfiniteQuery'
import {queryKeys} from '@queries/keys'
import {useNavigation} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {useQueryClient} from '@tanstack/react-query'

import CatalogSearchField from '@components/CatalogSearchField'
import ContentColumn from '@components/ContentColumn'
import {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'
import PrimaryButton from '@components/PrimaryButton'
import Screen from '@components/Screen'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'

import {
  CATALOG_SEARCH_ERROR_TEXT,
  MEAL_PLAN_DONE_BUTTON_TEXT,
  MEAL_PLAN_FOOD_SEARCH_CLEAR_ALL_TEXT,
  MEAL_PLAN_FOOD_SEARCH_HELPER_TEXT,
  MEAL_PLAN_FOOD_SEARCH_NO_RESULTS_TEMPLATE,
  MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER,
  MEAL_PLAN_FOOD_SEARCH_RESULTS_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_FOOD_SEARCH_RESULTS_HEADER,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_SELECTED_COUNT_TEMPLATE,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  stringWithNamedParameters
} from '@constants/strings'

import FoodSearchResultRow from './components/FoodSearchResultRow'
import SelectedChipsRow from './components/SelectedChipsRow'
import styles from './index.styled'

const SEARCH_DEBOUNCE_MS = 400

// The server rejects a shorter query and useCatalogSearchInfiniteQuery is disabled below it, which leaves the
// query permanently pending — so this bound decides the first branch of the empty-state order, not a request.
const CATALOG_QUERY_MIN_LENGTH = 2

const SEARCH_PAGE_END_THRESHOLD = 0.2

// Skeleton takes a numeric width and reads it once at mount, so a proportional bar has to be measured against
// the filled column rather than given a percentage. The three pairs are Figma 13c's own skeleton bars
// (193.68/129.12, 156.02/107.59, 177.54/139.88) over the 281px text column a row leaves beside its control.
const SEARCH_SKELETON_ROWS: ReadonlyArray<{primary: number; secondary: number}> = Object.freeze([
  Object.freeze({primary: 0.69, secondary: 0.46}),
  Object.freeze({primary: 0.55, secondary: 0.38}),
  Object.freeze({primary: 0.63, secondary: 0.5})
])

const MealPlanFoodSearchScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  const queryClient = useQueryClient()
  const {draft, toggleDislikedFood, setDislikedFoods} = useMealPlanSetupDraft()
  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [skeletonBarAreaWidth, setSkeletonBarAreaWidth] = useState(0)
  // The draft carries ids, so an ingredient staged on 06 arrives here with no name to put on its chip. Reading
  // the preferences the wizard already fetched is a label lookup, not a fetch: getQueryData issues no request,
  // adds no subscription and triggers no refetch, which is why this screen still runs no preferences query.
  const [foodLabels, setFoodLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (queryClient.getQueryData<MealPlanPreferences>(queryKeys.mealPlanPreferences)?.dislikedFoods ?? []).map(food => [
        food.id,
        food.name
      ])
    )
  )
  // Cancel discards the changes made in THIS visit, and the draft is shared with 06, so the set to restore is
  // the one this screen mounted with. A ref captures it once; later renders can never overwrite it.
  const mountedSelectionRef = useRef<string[]>(draft.dislikedFoodIds)
  const {data, isError, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, refetch} =
    useCatalogSearchInfiniteQuery(debouncedQuery)

  const catalogFoods = useMemo<CatalogFood[]>(() => data?.pages.flatMap(page => page.items) ?? [], [data])

  const trimmedQuery = debouncedQuery.trim()
  const isSearchable = trimmedQuery.length >= CATALOG_QUERY_MIN_LENGTH
  const selectedCount = draft.dislikedFoodIds.length

  const selectedFoods = useMemo(
    () =>
      draft.dislikedFoodIds.flatMap(id => {
        const name = foodLabels[id]

        return name ? [{id, name}] : []
      }),
    [draft.dislikedFoodIds, foodLabels]
  )

  const resultsAccessibilityLabel = stringWithNamedParameters(MEAL_PLAN_FOOD_SEARCH_RESULTS_ACCESSIBILITY_TEMPLATE, {
    count: catalogFoods.length
  })

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchText), SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [searchText])

  useEffect(() => {
    setFoodLabels(previous => {
      const unlabelled = catalogFoods.filter(food => previous[food.id] !== food.name)

      if (unlabelled.length === 0) {
        return previous
      }

      return {...previous, ...Object.fromEntries(unlabelled.map(food => [food.id, food.name]))}
    })
  }, [catalogFoods])

  const onClearPressed = useCallback(() => {
    setSearchText('')
    setDebouncedQuery('')
  }, [])

  const onCancelPressed = useCallback(() => {
    setDislikedFoods(mountedSelectionRef.current)
    navigation.goBack()
  }, [navigation, setDislikedFoods])

  const onDonePressed = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const onClearAllPressed = useCallback(() => {
    setDislikedFoods([])
  }, [setDislikedFoods])

  const onRetryPressed = useCallback(() => {
    refetch()
  }, [refetch])

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const onSkeletonBarAreaLayout = useCallback((event: LayoutChangeEvent) => {
    setSkeletonBarAreaWidth(event.nativeEvent.layout.width)
  }, [])

  const renderResult = ({item, index}: ListRenderItemInfo<CatalogFood>): React.JSX.Element => (
    <FoodSearchResultRow
      food={item}
      isAdded={draft.dislikedFoodIds.includes(item.id)}
      isFirst={index === 0}
      isLast={index === catalogFoods.length - 1}
      onPress={() => toggleDislikedFood(item.id)}
    />
  )

  const resultsHeader = (): React.JSX.Element => (
    <>
      <View style={styles.resultsSection} accessible accessibilityLabel={resultsAccessibilityLabel}>
        <SectionOverline text={MEAL_PLAN_FOOD_SEARCH_RESULTS_HEADER} />
      </View>

      <View style={styles.resultsListWrapper} />
    </>
  )

  const emptyBlock = (): React.JSX.Element | null => {
    if (!isSearchable) {
      return null
    }

    if (isError) {
      return (
        <TouchableOpacity
          style={styles.retryContainer}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
          onPress={onRetryPressed}>
          <Text style={styles.retryMessage}>{CATALOG_SEARCH_ERROR_TEXT}</Text>

          <Text style={styles.retryAction}>{MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}</Text>
        </TouchableOpacity>
      )
    }

    if (isPending) {
      return (
        <View style={styles.skeletonList} accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
          {SEARCH_SKELETON_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.skeletonRow}>
              <View style={styles.skeletonTextColumn} onLayout={onSkeletonBarAreaLayout}>
                {skeletonBarAreaWidth > 0 && (
                  <>
                    <SkeletonBlock
                      height={Sizes.SKELETON_BAR}
                      width={Math.round(skeletonBarAreaWidth * row.primary)}
                      borderRadius={BorderRadius.CHECKBOX}
                      style={styles.skeletonBar}
                    />

                    <SkeletonBlock
                      height={Sizes.SKELETON_BAR_SM}
                      width={Math.round(skeletonBarAreaWidth * row.secondary)}
                      borderRadius={BorderRadius.CHECKBOX}
                      style={styles.skeletonBar}
                    />
                  </>
                )}
              </View>

              <SkeletonBlock
                height={Sizes.ADD_CONTROL}
                width={Sizes.ADD_CONTROL}
                borderRadius={BorderRadius.PILL}
                style={styles.skeletonBar}
              />
            </View>
          ))}
        </View>
      )
    }

    return (
      <Text style={styles.emptyCaption}>
        {stringWithNamedParameters(MEAL_PLAN_FOOD_SEARCH_NO_RESULTS_TEMPLATE, {query: trimmedQuery})}
      </Text>
    )
  }

  const selectedSection = (): React.JSX.Element => (
    <View style={styles.selectedSection}>
      <View style={styles.selectedHeaderRow}>
        <SectionOverline text={stringWithNamedParameters(MEAL_PLAN_SELECTED_COUNT_TEMPLATE, {count: selectedCount})} />

        {selectedCount > 0 && (
          <TouchableOpacity
            activeOpacity={Opacity.PRESSED}
            hitSlop={Spacing.SMALL}
            accessibilityRole="button"
            accessibilityLabel={MEAL_PLAN_FOOD_SEARCH_CLEAR_ALL_TEXT}
            onPress={onClearAllPressed}>
            <Text style={styles.clearAllLabel}>{MEAL_PLAN_FOOD_SEARCH_CLEAR_ALL_TEXT}</Text>
          </TouchableOpacity>
        )}
      </View>

      {selectedFoods.length > 0 && (
        <View style={styles.selectedChipsWrapper}>
          <SelectedChipsRow foods={selectedFoods} onRemove={toggleDislikedFood} />
        </View>
      )}

      <Text style={styles.helperText}>{MEAL_PLAN_FOOD_SEARCH_HELPER_TEXT}</Text>
    </View>
  )

  return (
    <Screen edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ContentColumn>
          <CatalogSearchField
            mode="input"
            autoFocus
            value={searchText}
            placeholder={MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER}
            accessibilityLabel={MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER}
            onChangeText={setSearchText}
            onClear={onClearPressed}
            onCancel={onCancelPressed}
          />

          {/* 06b keeps the field focused and the keyboard up while the results scroll (47:463), so AddFood's
              keyboardDismissMode="on-drag" is deliberately not carried over from the reference screen;
              persistTaps is what lets the first tap on a row reach it instead of dismissing the keyboard. */}
          <FlatList
            data={catalogFoods}
            renderItem={renderResult}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={SEARCH_PAGE_END_THRESHOLD}
            ListHeaderComponent={isSearchable ? resultsHeader() : null}
            ListEmptyComponent={emptyBlock()}
            ListFooterComponent={selectedSection()}
          />
        </ContentColumn>
      </KeyboardAvoidingView>

      <SetupFooter hairline>
        <PrimaryButton label={MEAL_PLAN_DONE_BUTTON_TEXT} onPress={onDonePressed} />
      </SetupFooter>
    </Screen>
  )
}

export default MealPlanFoodSearchScreen
