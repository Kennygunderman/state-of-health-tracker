import React, {useCallback, useEffect, useMemo, useState} from 'react'

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
import {Navigation} from '@navigation/types'
import {useCatalogSearchInfiniteQuery} from '@queries/catalog/useCatalogSearchInfiniteQuery'
import {useNavigation} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
// The bound the provider's reducers refuse an addition past, read from the module that owns it so this
// screen cannot restate the server's number and drift from it.
import {isDislikeSelectionAtCap, MAX_DISLIKED_FOOD_IDS} from '@utility/DislikeSelectionUtility'

import CatalogSearchField from '@components/CatalogSearchField'
import {columnScrollStyles} from '@components/ColumnScrollView'
import ContentColumn from '@components/ContentColumn'
import {useDislikeStaging, useMealPlanSetupActions} from '@components/MealPlanSetupProvider'
import PrimaryButton from '@components/PrimaryButton'
import Screen from '@components/Screen'
import SectionOverline from '@components/SectionOverline'
import SetupFooter from '@components/SetupFooter'
import SkeletonBlock from '@components/Skeleton'
import Text from '@components/Text'

import {
  CATALOG_SEARCH_ERROR_TEXT,
  MEAL_PLAN_DISLIKES_CAP_TEMPLATE,
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
import {
  catalogResultsTotal,
  EMPTY_SEARCH_QUERY,
  flattenCatalogPages,
  isCatalogQuerySearchable,
  resolveSearchFooterView,
  resolveSearchResultsView,
  SEARCH_SKELETON_ROWS,
  SearchGesture,
  searchQueryAfter,
  SearchQueryState,
  skeletonBarWidth
} from './index.util'

const SEARCH_DEBOUNCE_MS = 400

const SEARCH_PAGE_END_THRESHOLD = 0.2

// Module scope so the list is never handed a new reader: a keystroke re-renders this screen on every
// character, and a prop that changes identity makes FlatList re-run every row it is holding.
const keyExtractor = (item: CatalogFood): string => item.id

const MealPlanFoodSearchScreen = (): React.JSX.Element => {
  const navigation = useNavigation<Navigation>()
  // This screen stages rather than answers, so it reads and writes the visit the provider holds and never the
  // step's own selection: the visit reaches the draft only through commitDislikeStaging, below, which is what
  // makes Done the one way out that keeps these changes. It carries the name of every food it stages, because
  // a food reached from catalog search is one the saved preferences cannot name yet and screen 06 has to put
  // it on a chip the user can review and remove.
  const {
    beginDislikeStaging,
    toggleStagedDislike,
    removeStagedDislike,
    clearStagedDislikes,
    commitDislikeStaging,
    discardDislikeStaging
  } = useMealPlanSetupActions()
  const stagedDislikes = useDislikeStaging()
  const [search, setSearch] = useState<SearchQueryState>(EMPTY_SEARCH_QUERY)
  const [skeletonBarAreaWidth, setSkeletonBarAreaWidth] = useState(0)
  const {data, isError, isPending, hasNextPage, isFetchingNextPage, fetchNextPage, refetch} =
    useCatalogSearchInfiniteQuery(search.query)

  const catalogFoods = useMemo<CatalogFood[]>(() => flattenCatalogPages(data?.pages), [data])

  const trimmedQuery = search.query.trim()
  const resultsView = resolveSearchResultsView({
    isSearchable: isCatalogQuerySearchable(search),
    isError,
    isPending,
    resultCount: catalogFoods.length
  })
  // The staged selection is the truth of what Done would keep, so the count is its length whether or not
  // every entry can be named.
  const selectedCount = stagedDislikes.selection.length

  const {showNextPageLoading, showSelectedHeader} = resolveSearchFooterView({
    resultsView,
    isFetchingNextPage,
    selectedCount
  })

  // At the cap the reducer refuses a tap on an unselected row, and no frame draws that state (AAP 0.2.5):
  // the caption below is what tells the user why the row did not take and how to make room.
  const isSelectionAtCap = isDislikeSelectionAtCap(stagedDislikes.selection)

  const selectedFoods = useMemo(
    () =>
      stagedDislikes.selection.flatMap(id => {
        const food = stagedDislikes.labels[id]

        return food === undefined ? [] : [{id, name: food.name}]
      }),
    [stagedDislikes.labels, stagedDislikes.selection]
  )

  // Every row asks whether it is selected, so the answer is a set rather than a scan of the staged array.
  const selectedIds = useMemo(() => new Set(stagedDislikes.selection), [stagedDislikes.selection])

  const resultsAccessibilityLabel = useMemo(
    () =>
      stringWithNamedParameters(MEAL_PLAN_FOOD_SEARCH_RESULTS_ACCESSIBILITY_TEMPLATE, {
        count: catalogResultsTotal(data?.pages, catalogFoods.length)
      }),
    [catalogFoods.length, data]
  )

  // Every gesture reports here, so the one module that decides what a gesture does to the query is also the
  // only writer of it.
  const applyGesture = useCallback((gesture: SearchGesture): void => {
    setSearch(previous => searchQueryAfter(previous, gesture))
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => applyGesture({kind: 'debounce_elapsed'}), SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [applyGesture, search.text])

  // Opening the visit on mount and discarding it on the way out is one rule for every exit this route has:
  // the drawn Cancel, the iOS swipe, Android system back and any pop a parent performs all unmount the
  // screen, and none of them reaches a handler. Done commits before it pops, so the discard that follows it
  // has nothing left to drop.
  useEffect(() => {
    beginDislikeStaging()

    return () => discardDislikeStaging()
  }, [beginDislikeStaging, discardDislikeStaging])

  const onChangeText = useCallback(
    (text: string) => {
      applyGesture({kind: 'typed', text})
    },
    [applyGesture]
  )

  const onClearPressed = useCallback(() => {
    applyGesture({kind: 'query_cleared'})
  }, [applyGesture])

  // Cancel stages nothing and commits nothing: the visit is discarded by the unmount below, which is the
  // same exit the iOS swipe and Android system back take.
  const onCancelPressed = useCallback(() => {
    applyGesture({kind: 'cancel_pressed'})
    navigation.goBack()
  }, [applyGesture, navigation])

  const onDonePressed = useCallback(() => {
    applyGesture({kind: 'done_pressed'})
    commitDislikeStaging()
    navigation.goBack()
  }, [applyGesture, commitDislikeStaging, navigation])

  const onClearAllPressed = useCallback(() => {
    applyGesture({kind: 'clear_all_pressed'})
    clearStagedDislikes()
  }, [applyGesture, clearStagedDislikes])

  // The loaded pages, by id: the row hands back the id it was drawn from, and staging needs the food's own
  // name — nothing else here can name a food reached from catalog search.
  const foodsById = useMemo(() => new Map(catalogFoods.map(food => [food.id, food])), [catalogFoods])

  const onFoodPressed = useCallback(
    (foodId: string) => {
      const food = foodsById.get(foodId)

      if (food === undefined) {
        return
      }

      applyGesture({kind: 'food_pressed'})
      toggleStagedDislike({id: food.id, name: food.name, foodGroup: food.foodGroup})
    },
    [applyGesture, foodsById, toggleStagedDislike]
  )

  const onChipRemoved = useCallback(
    (foodId: string) => {
      applyGesture({kind: 'chip_removed'})
      removeStagedDislike(foodId)
    },
    [applyGesture, removeStagedDislike]
  )

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

  // The row hands its id back so the reader it is memoized against stays the same one across a keystroke;
  // the food itself is looked up here, because staging records the name the chip will show.
  const renderResult = useCallback(
    ({item, index}: ListRenderItemInfo<CatalogFood>): React.JSX.Element => (
      <FoodSearchResultRow
        food={item}
        isAdded={selectedIds.has(item.id)}
        isFirst={index === 0}
        isLast={index === catalogFoods.length - 1}
        onToggle={onFoodPressed}
      />
    ),
    [catalogFoods.length, onFoodPressed, selectedIds]
  )

  const resultsHeader = useMemo(
    () => (
      <>
        {/* The role belongs on this wrapper rather than on the overline inside it: the wrapper is already the
            one element the platform exposes here, so a role on its child is never reached. Naming the heading
            with the result count is the same text the section announces, so the rotor entry and the reading
            stop stay one thing. */}
        <View
          style={styles.resultsSection}
          accessible
          accessibilityRole="header"
          accessibilityLabel={resultsAccessibilityLabel}>
          <SectionOverline text={MEAL_PLAN_FOOD_SEARCH_RESULTS_HEADER} />
        </View>

        <View style={styles.resultsListWrapper} />
      </>
    ),
    [resultsAccessibilityLabel]
  )

  // One card, two placements. The list's empty slot carries it while the first page loads; the footer carries
  // it while a later page loads under rows that are already on screen, which is the only moment the empty slot
  // is not rendered at all. The two placements are mutually exclusive — an empty list has no rows to load
  // beneath — so sharing one element keeps the two loading affordances identical, as AAP 0.2.5 asks, and
  // leaves exactly one labelled loading region in the tree for a screen reader to find.
  const skeletonCard = useMemo(
    () => (
      <View style={styles.skeletonCard} accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
        {SEARCH_SKELETON_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.skeletonRow, rowIndex > 0 && styles.skeletonRowDivider]}>
            <View style={styles.skeletonTextColumn} onLayout={onSkeletonBarAreaLayout}>
              {skeletonBarAreaWidth > 0 && (
                <>
                  <SkeletonBlock
                    height={Sizes.SKELETON_BAR}
                    width={skeletonBarWidth(skeletonBarAreaWidth, row.primary)}
                    borderRadius={BorderRadius.CHECKBOX}
                    style={styles.skeletonBar}
                  />

                  <SkeletonBlock
                    height={Sizes.SKELETON_BAR_SM}
                    width={skeletonBarWidth(skeletonBarAreaWidth, row.secondary)}
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
    ),
    [onSkeletonBarAreaLayout, skeletonBarAreaWidth]
  )

  const emptyBlock = useMemo((): React.JSX.Element | null => {
    if (resultsView === 'idle' || resultsView === 'results') {
      return null
    }

    if (resultsView === 'error') {
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

    if (resultsView === 'loading') {
      return skeletonCard
    }

    return (
      <Text style={styles.emptyCaption}>
        {stringWithNamedParameters(MEAL_PLAN_FOOD_SEARCH_NO_RESULTS_TEMPLATE, {query: trimmedQuery})}
      </Text>
    )
  }, [onRetryPressed, resultsView, skeletonCard, trimmedQuery])

  const selectedSection = useMemo(
    () => (
      <View style={styles.selectedSection}>
        {/* The whole row goes with the count: Figma prints it only once something is staged (`47:284` at two,
            `47:424` at three) and never draws a zero, which is how the sibling frame 06 gates its selected
            block too. The section itself stays mounted, because the footnote below it is drawn in every state
            and the cap caption has to be able to appear. */}
        {showSelectedHeader && (
          <View style={styles.selectedHeaderRow}>
            <SectionOverline
              text={stringWithNamedParameters(MEAL_PLAN_SELECTED_COUNT_TEMPLATE, {count: selectedCount})}
              isHeading
            />

            <TouchableOpacity
              style={styles.clearAllButton}
              activeOpacity={Opacity.PRESSED}
              accessibilityRole="button"
              accessibilityLabel={MEAL_PLAN_FOOD_SEARCH_CLEAR_ALL_TEXT}
              onPress={onClearAllPressed}>
              <Text style={styles.clearAllLabel}>{MEAL_PLAN_FOOD_SEARCH_CLEAR_ALL_TEXT}</Text>
            </TouchableOpacity>
          </View>
        )}

        {selectedFoods.length > 0 && (
          <View style={styles.selectedChipsWrapper}>
            <SelectedChipsRow foods={selectedFoods} onRemove={onChipRemoved} />
          </View>
        )}

        <Text style={styles.helperText}>{MEAL_PLAN_FOOD_SEARCH_HELPER_TEXT}</Text>

        {isSelectionAtCap && (
          <Text style={styles.helperText} accessibilityLiveRegion="polite">
            {stringWithNamedParameters(MEAL_PLAN_DISLIKES_CAP_TEMPLATE, {count: MAX_DISLIKED_FOOD_IDS})}
          </Text>
        )}
      </View>
    ),
    [isSelectionAtCap, onChipRemoved, onClearAllPressed, selectedCount, selectedFoods, showSelectedHeader]
  )

  // The footer is where a later page announces itself: it loads beneath rows the list is already holding, so
  // the empty slot that carries the first page's placeholder is not rendered then. The rung above the card is
  // the same one the results overline uses, so the placeholder sits below the last row exactly as a results
  // card does below the overline.
  const listFooter = useMemo(
    () => (
      <>
        {showNextPageLoading && <View style={styles.resultsListWrapper}>{skeletonCard}</View>}

        {selectedSection}
      </>
    ),
    [selectedSection, showNextPageLoading, skeletonCard]
  )

  return (
    <Screen edges={['top']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.keyboardAvoider} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ContentColumn>
          <CatalogSearchField
            mode="input"
            autoFocus
            value={search.text}
            placeholder={MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER}
            accessibilityLabel={MEAL_PLAN_FOOD_SEARCH_PLACEHOLDER}
            onChangeText={onChangeText}
            onClear={onClearPressed}
            onCancel={onCancelPressed}
          />

          {/* 06b keeps the field focused and the keyboard up while the results scroll (47:463), so AddFood's
              keyboardDismissMode="on-drag" is deliberately not carried over from the reference screen;
              persistTaps is what lets the first tap on a row reach it instead of dismissing the keyboard. */}
          <FlatList
            style={columnScrollStyles.viewport}
            data={catalogFoods}
            renderItem={renderResult}
            keyExtractor={keyExtractor}
            contentContainerStyle={[columnScrollStyles.content, styles.listContent]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onEndReached={onEndReached}
            onEndReachedThreshold={SEARCH_PAGE_END_THRESHOLD}
            ListHeaderComponent={resultsView === 'idle' ? null : resultsHeader}
            ListEmptyComponent={emptyBlock}
            ListFooterComponent={listFooter}
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
