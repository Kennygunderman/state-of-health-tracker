import React, {useCallback, useEffect, useMemo, useState} from 'react'

import {
  LayoutChangeEvent,
  SectionList,
  SectionListData,
  SectionListRenderItem,
  TouchableOpacity,
  View
} from 'react-native'

import {BrandedFood} from '@data/models/BrandedFood'
import {CatalogFood} from '@data/models/CatalogFood'
import {Food, formatServingText} from '@data/models/Food'
import {useMealPlanEntitlement} from '@hooks/mealPlanning/useMealPlanEntitlement'
import {AddFoodRouteProp, Navigation} from '@navigation/types'
import {useCatalogSearchInfiniteQuery} from '@queries/catalog/useCatalogSearchInfiniteQuery'
import {useBrandedFoodSearchQuery} from '@queries/foods/useBrandedFoodSearchQuery'
import {useDeleteFoodMutation} from '@queries/foods/useDeleteFoodMutation'
import {useFoodsInfiniteQuery} from '@queries/foods/useFoodsQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import BorderRadius from '@styles/borderRadius'
import {Opacity, Sizes} from '@styles/sizes'
import ListSwipeItemManager from '@utility/ListSwipeItemManager'

import SearchBar from '@components/SearchBar'
import SecondaryButton from '@components/SecondaryButton'
import Skeleton from '@components/Skeleton'
import Text from '@components/Text'
import {showToast} from '@components/toast/util/ShowToast'

import Screens from '@constants/screens'
import {
  ADD_FOOD_TITLE,
  ADDING_TO_EYEBROW,
  BRANDED_HEADER,
  CATALOG_HEADER,
  CATALOG_SEARCH_ERROR_TEXT,
  catalogCategoryLabel,
  MEAL_PLAN_FOOD_SEARCH_NO_RESULTS_TEMPLATE,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  NEW_FOOD_BUTTON_TEXT,
  NO_FOOD_FOUND_EMPTY_TEXT,
  SEARCH_YOUR_FOODS_PLACEHOLDER,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR,
  YOUR_FOODS_HEADER
} from '@constants/strings'

import AiEscapeHatchCard from './components/AiEscapeHatchCard'
import FoodResultRow from './components/FoodResultRow'
import LibraryFoodRow from './components/LibraryFoodRow'
import styles from './index.styled'
import {
  CATALOG_SKELETON_ROWS,
  catalogProvenanceBadge,
  catalogSkeletonBarWidth,
  isCatalogSearchResult,
  mapBrandedFoodToFood,
  mapCatalogFoodToFood
} from './index.util'

const SEARCH_DEBOUNCE_MS = 400

const BRANDED_MIN_QUERY_LENGTH = 2

// Deliberately not the branded threshold: branded search starts above two characters while catalog search
// starts at two, matching `useCatalogSearchInfiniteQuery`'s own `enabled` predicate. The two are specified
// separately and must not be collapsed into one constant.
const CATALOG_MIN_QUERY_LENGTH = 2

// An empty query is what keeps the catalog request from firing while the section is hidden: the search hook
// stays mounted on every render (hook order never changes) and its `enabled` predicate rejects the query.
const NO_CATALOG_QUERY = ''

type SectionItem = Food | CatalogFood | BrandedFood

interface Section {
  key: 'library' | 'catalog' | 'branded'
  title: string
  data: SectionItem[]
}

const listSwipeItemManager = new ListSwipeItemManager()

const AddFoodScreen = () => {
  const navigation = useNavigation<Navigation>()
  const {
    params: {mealId, mealName}
  } = useRoute<AddFoodRouteProp>()

  const [searchText, setSearchText] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [skeletonBarAreaWidth, setSkeletonBarAreaWidth] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(searchText), SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [searchText])

  // The single gate for the catalog section, and the whole of it: with Remote Config off, or a backend whose
  // meal-planning routes are gone (a bare 404 from a resource-less GET), the section is neither rendered nor
  // requested. A backend that is merely running with MEAL_PLANNING_ENABLED off keeps it — `/catalog/*` is never
  // gated by that flag, so catalog search still answers even while the Meal Plan tab shows its unavailable card
  const {isCatalogVisible} = useMealPlanEntitlement()

  const foodsQuery = useFoodsInfiniteQuery(debouncedQuery)
  const brandedQuery = useBrandedFoodSearchQuery(debouncedQuery)
  const catalogQuery = useCatalogSearchInfiniteQuery(isCatalogVisible ? debouncedQuery : NO_CATALOG_QUERY)
  const {mutateAsync: deleteFood} = useDeleteFoodMutation()

  // Destructured rather than read through the query objects, because TanStack rebuilds its top-level result on
  // every render: a callback that listed `foodsQuery` or `catalogQuery` in its dependencies would take a new
  // identity each time and its useCallback would buy nothing. The members below are the stable half of that
  // result — `fetchNextPage` and `refetch` are bound to the observer and keep their identity, and the rest are
  // primitives — so a callback closing over these changes only when its own inputs do.
  const {
    hasNextPage: hasMoreFoods,
    isFetchingNextPage: isFetchingMoreFoods,
    fetchNextPage: fetchMoreFoods,
    isLoading: isLoadingFoods,
    isFetching: isFetchingFoods
  } = foodsQuery
  const {
    hasNextPage: hasMoreCatalogFoods,
    isFetchingNextPage: isFetchingMoreCatalogFoods,
    fetchNextPage: fetchMoreCatalogFoods,
    refetch: refetchCatalog,
    isLoading: isCatalogLoading,
    isError: hasCatalogError,
    isSuccess: isCatalogLoaded,
    isFetching: isFetchingCatalog
  } = catalogQuery

  // Each list is memoized on the query data it flattens, so a render that changes neither the pages nor the
  // search hands the SectionList the same arrays — and the memoized rows inside them the same items
  const foods = useMemo(() => foodsQuery.data?.pages.flatMap(page => page.foods) ?? [], [foodsQuery.data])
  const isBrandedSearchActive = debouncedQuery.trim().length > BRANDED_MIN_QUERY_LENGTH
  const brandedFoods = useMemo(
    () => (isBrandedSearchActive ? (brandedQuery.data ?? []) : []),
    [isBrandedSearchActive, brandedQuery.data]
  )

  // `/catalog/foods` answers with `items`, not `foods` — the two search endpoints name their page differently
  const catalogFoods = useMemo(() => catalogQuery.data?.pages.flatMap(page => page.items) ?? [], [catalogQuery.data])
  const isCatalogSearchActive = isCatalogVisible && debouncedQuery.trim().length >= CATALOG_MIN_QUERY_LENGTH

  // Excludes pagination on both paged queries so scrolling the library or the catalog doesn't flash the
  // search spinner
  const isSearching =
    (isFetchingFoods && !isFetchingMoreFoods) ||
    brandedQuery.isFetching ||
    (isFetchingCatalog && !isFetchingMoreCatalogFoods)

  listSwipeItemManager.setRows(foods)

  // The branded section stays quiet unless it has something to show — errors
  // and empty results just leave the library list as the only content
  const showBranded = isBrandedSearchActive && (brandedFoods.length > 0 || brandedQuery.isFetching)

  // An empty library yields to branded results; without them it stays visible
  // so the empty state and New Food button still render
  const showLibrary = foods.length > 0 || isLoadingFoods || !showBranded

  // Unlike branded, the catalog section stays mounted for the whole search: its loading, no-results and error
  // states are distinct answers the user is owed, so the section renders whenever the search is running.
  // Only a decoded empty page is "no results" — an error must never reach the same caption
  const hasNoCatalogResults = isCatalogLoaded && catalogFoods.length === 0

  const sections = useMemo<Section[]>(() => {
    const visibleSections: Section[] = []

    if (showLibrary) {
      visibleSections.push({key: 'library', title: YOUR_FOODS_HEADER, data: foods})
    }

    if (isCatalogSearchActive) {
      visibleSections.push({key: 'catalog', title: CATALOG_HEADER, data: catalogFoods})
    }

    if (showBranded) {
      visibleSections.push({key: 'branded', title: BRANDED_HEADER, data: brandedFoods})
    }

    return visibleSections
  }, [showLibrary, foods, isCatalogSearchActive, catalogFoods, showBranded, brandedFoods])

  const openFoodDetail = useCallback(
    (food: Food) => {
      navigation.push(Screens.FOOD_DETAIL_SCREEN, {path: 'add', mealId, mealName, food})
    },
    [navigation, mealId, mealName]
  )

  // One handler for both search sections: the row hands back the result it drew and the mapping happens here,
  // where Food Detail's route param is assembled
  const onSearchResultPressed = useCallback(
    (result: CatalogFood | BrandedFood) => {
      openFoodDetail(isCatalogSearchResult(result) ? mapCatalogFoodToFood(result) : mapBrandedFoodToFood(result))
    },
    [openFoodDetail]
  )

  const onDeleteFoodPressed = useCallback(
    async (food: Food) => {
      try {
        await deleteFood(food.id)
      } catch {
        showToast('error', TOAST_GENERIC_ERROR)
      }
    },
    [deleteFood]
  )

  const onSkeletonBarAreaLayout = useCallback(
    (event: LayoutChangeEvent) => setSkeletonBarAreaWidth(event.nativeEvent.layout.width),
    []
  )

  // Held as its own stable callback so the section header does not have to close over the query object to
  // reach `refetch`
  const onCatalogRetryPressed = useCallback(() => {
    refetchCatalog()
  }, [refetchCatalog])

  const keyExtractor = useCallback((item: SectionItem) => item.id, [])

  const renderItem = useCallback<SectionListRenderItem<SectionItem, Section>>(
    ({item, index, section}) => {
      // Before the library fall-through below: a catalog food read as a Food would show a swipe-to-delete row
      // for a food the user does not own
      if (section.key === 'catalog') {
        const catalogFood = item as CatalogFood
        const food = mapCatalogFoodToFood(catalogFood)

        return (
          <FoodResultRow
            result={catalogFood}
            name={catalogFood.name}
            detail={formatServingText(food)}
            subtitle={catalogCategoryLabel(catalogFood.category)}
            calories={food.calories}
            badge={catalogProvenanceBadge(catalogFood.nutritionProvenance)}
            onPress={onSearchResultPressed}
          />
        )
      }

      if (section.key === 'branded') {
        const brandedFood = item as BrandedFood

        return (
          <FoodResultRow
            result={brandedFood}
            name={brandedFood.name}
            subtitle={brandedFood.brand}
            calories={brandedFood.calories}
            onPress={onSearchResultPressed}
          />
        )
      }

      return (
        <LibraryFoodRow
          food={item as Food}
          index={index}
          swipeItemManager={listSwipeItemManager}
          onPress={openFoodDetail}
          onDelete={onDeleteFoodPressed}
        />
      )
    },
    [onSearchResultPressed, openFoodDetail, onDeleteFoodPressed]
  )

  const renderSectionHeader = useCallback(
    ({section}: {section: SectionListData<SectionItem, Section>}) => {
      if (section.key === 'catalog') {
        return (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>{section.title}</Text>
            </View>

            {isCatalogLoading && (
              <View accessible accessibilityLabel={MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL}>
                {CATALOG_SKELETON_ROWS.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.catalogSkeletonRow}>
                    <View style={styles.catalogSkeletonBarArea} onLayout={onSkeletonBarAreaLayout}>
                      {skeletonBarAreaWidth > 0 && (
                        <>
                          <Skeleton
                            height={Sizes.SKELETON_BAR}
                            width={catalogSkeletonBarWidth(skeletonBarAreaWidth, row.primary)}
                            borderRadius={BorderRadius.CHECKBOX}
                            style={styles.catalogSkeletonBar}
                          />

                          <Skeleton
                            height={Sizes.SKELETON_BAR_SM}
                            width={catalogSkeletonBarWidth(skeletonBarAreaWidth, row.secondary)}
                            borderRadius={BorderRadius.CHECKBOX}
                            style={styles.catalogSkeletonBar}
                          />
                        </>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {hasCatalogError && (
              <TouchableOpacity
                style={styles.retryContainer}
                activeOpacity={Opacity.PRESSED}
                accessibilityRole="button"
                accessibilityLabel={MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
                onPress={onCatalogRetryPressed}>
                <Text style={styles.retryText}>{CATALOG_SEARCH_ERROR_TEXT}</Text>

                <Text style={styles.retryAction}>{MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}</Text>
              </TouchableOpacity>
            )}

            {hasNoCatalogResults && (
              <Text style={styles.catalogEmptyText}>
                {stringWithNamedParameters(MEAL_PLAN_FOOD_SEARCH_NO_RESULTS_TEMPLATE, {
                  query: debouncedQuery.trim()
                })}
              </Text>
            )}
          </>
        )
      }

      if (section.key === 'branded') {
        return (
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>

            {!showLibrary && (
              <SecondaryButton
                label={NEW_FOOD_BUTTON_TEXT}
                onPress={() => navigation.push(Screens.CREATE_FOOD, {prefillName: searchText})}
              />
            )}
          </View>
        )
      }

      return (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>

            <SecondaryButton
              label={NEW_FOOD_BUTTON_TEXT}
              onPress={() => navigation.push(Screens.CREATE_FOOD, {prefillName: searchText})}
            />
          </View>

          {!isLoadingFoods && foods.length === 0 && <Text style={styles.emptyText}>{NO_FOOD_FOUND_EMPTY_TEXT}</Text>}
        </>
      )
    },
    [
      isCatalogLoading,
      skeletonBarAreaWidth,
      onSkeletonBarAreaLayout,
      hasCatalogError,
      onCatalogRetryPressed,
      hasNoCatalogResults,
      debouncedQuery,
      showLibrary,
      navigation,
      searchText,
      isLoadingFoods,
      foods.length
    ]
  )

  const onEndReached = useCallback(() => {
    if (hasMoreFoods && !isFetchingMoreFoods) {
      fetchMoreFoods()
    }

    // Each query owns its own paging — the hook computes the next page from the response's pagination
    // block — so reaching the end of the list advances whichever of the two still has pages
    if (hasMoreCatalogFoods && !isFetchingMoreCatalogFoods) {
      fetchMoreCatalogFoods()
    }
  }, [
    hasMoreFoods,
    isFetchingMoreFoods,
    fetchMoreFoods,
    hasMoreCatalogFoods,
    isFetchingMoreCatalogFoods,
    fetchMoreCatalogFoods
  ])

  return (
    <SectionList<SectionItem, Section>
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      stickySectionHeadersEnabled={false}
      contentContainerStyle={styles.listContent}
      sections={sections}
      keyExtractor={keyExtractor}
      ListHeaderComponent={
        <>
          <Text style={styles.eyebrow}>{`${ADDING_TO_EYEBROW} ${mealName.toUpperCase()}`}</Text>

          <Text style={styles.title}>{ADD_FOOD_TITLE}</Text>

          <SearchBar
            placeholder={SEARCH_YOUR_FOODS_PLACEHOLDER}
            isLoading={isSearching}
            onSearchTextChanged={setSearchText}
          />

          <AiEscapeHatchCard onPress={() => navigation.push(Screens.LOG_WITH_AI, {mealId, initialText: searchText})} />
        </>
      }
      renderSectionHeader={renderSectionHeader}
      renderItem={renderItem}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.2}
    />
  )
}

export default AddFoodScreen
