import React from 'react'

import {SectionList} from 'react-native'

import {CatalogFood} from '@data/models/CatalogFood'
import {FoodSourceEnum, PersonalFood} from '@data/models/Food'
import {useMealPlanEntitlement} from '@hooks/mealPlanning/useMealPlanEntitlement'
import {useCatalogSearchInfiniteQuery} from '@queries/catalog/useCatalogSearchInfiniteQuery'
import {useBrandedFoodSearchQuery} from '@queries/foods/useBrandedFoodSearchQuery'
import {useDeleteFoodMutation} from '@queries/foods/useDeleteFoodMutation'
import {useFoodsInfiniteQuery} from '@queries/foods/useFoodsQuery'
import {act, create, ReactTestInstance, ReactTestRenderer} from 'react-test-renderer'

import SearchBar from '@components/SearchBar'
import Skeleton from '@components/Skeleton'

import {MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL} from '@constants/strings'

import AddFoodScreen from '../index'
import styles from '../index.styled'
import {CATALOG_SKELETON_ROWS} from '../index.util'

// Only the two hooks are replaced: `@styles/theme` reads the library's own DefaultTheme, so the rest of the
// module has to stay real. Both stubs answer with the same object every render, the way the library does, so
// the screen's memoized callbacks keep their identity across a re-render.
jest.mock('@react-navigation/native', () => {
  const navigation = {push: jest.fn()}
  const route = {params: {mealId: 'meal-1', mealName: 'Lunch'}}

  return {
    ...jest.requireActual('@react-navigation/native'),
    useNavigation: () => navigation,
    useRoute: () => route
  }
})

// Factories rather than automocks: every one of these modules reaches the HTTP layer, and the Firebase auth
// module behind it has no native side in the runner, so the real file must never be required at all
jest.mock('@hooks/mealPlanning/useMealPlanEntitlement', () => ({useMealPlanEntitlement: jest.fn()}))
jest.mock('@queries/catalog/useCatalogSearchInfiniteQuery', () => ({useCatalogSearchInfiniteQuery: jest.fn()}))
jest.mock('@queries/foods/useBrandedFoodSearchQuery', () => ({useBrandedFoodSearchQuery: jest.fn()}))
jest.mock('@queries/foods/useDeleteFoodMutation', () => ({useDeleteFoodMutation: jest.fn()}))
jest.mock('@queries/foods/useFoodsQuery', () => ({useFoodsInfiniteQuery: jest.fn()}))

// The shimmer inside `Skeleton` runs on Reanimated's worklet runtime, which exists only on a device, and
// Reanimated 4's published mock re-enters that runtime. These four primitives are the whole of what
// `Skeleton` uses: the shared value becomes a plain box, the animated style is evaluated once and the timing
// helpers resolve to their target, so the real skeleton component still renders here.
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native')

  return {
    __esModule: true,
    // `createAnimatedComponent` is reached by the gesture handler behind the library rows' swipe-to-delete,
    // which wraps its own views before this screen renders one
    default: {View, createAnimatedComponent: <TComponent,>(component: TComponent): TComponent => component},
    useSharedValue: <T,>(initial: T): {value: T} => ({value: initial}),
    useAnimatedStyle: (build: () => Record<string, unknown>): Record<string, unknown> => build(),
    withTiming: <T,>(target: T): T => target,
    withRepeat: <T,>(animation: T): T => animation
  }
})

// A native view with no JavaScript implementation, which the shimmer draws inside the skeleton box.
jest.mock('react-native-linear-gradient', () => {
  const {View} = jest.requireActual('react-native')

  return {__esModule: true, default: View}
})

// The library rows' swipe-to-delete is native: its handler module installs itself on the JSI at mount, and
// the gesture cannot be exercised off a device. Both wrappers stand in as plain views, which leaves the row
// content — the part this suite reads — rendering exactly as it does on device.
jest.mock('react-native-gesture-handler', () => {
  const {View} = jest.requireActual('react-native')

  return {__esModule: true, GestureHandlerRootView: View, Swipeable: View}
})

const SEARCH_DEBOUNCE_MS = 400

// Two characters is the catalog's minimum, so this query is one the catalog answers and the branded search
// (strictly more than two) does not — which keeps the branded section out of these trees
const CATALOG_QUERY = 'ric'

const LIBRARY_FOODS: PersonalFood[] = [
  {
    id: 'library-1',
    name: 'Overnight oats',
    servingAmount: 1,
    servingUnit: 'bowl',
    calories: 320,
    protein: 14,
    carbs: 48,
    fat: 8,
    brand: null,
    source: FoodSourceEnum.MANUAL
  },
  {
    id: 'library-2',
    name: 'Chicken thigh',
    servingAmount: 150,
    servingUnit: 'g',
    calories: 265,
    protein: 25,
    carbs: 0,
    fat: 18,
    brand: null,
    source: FoodSourceEnum.MANUAL
  }
]

const CATALOG_FOODS: CatalogFood[] = [
  {
    id: 'catalog-1',
    name: 'Brown rice, cooked',
    category: 'grain',
    foodState: 'cooked',
    identitySource: 'usda',
    nutritionProvenance: 'source_backed',
    nutritionBasis: 'per_100g',
    basisAmount: 100,
    calories: 123,
    protein: 2.7,
    carbs: 26,
    fat: 1,
    fiber: 1.6,
    defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 195},
    allergenTags: [],
    allergenStatus: 'known',
    foodGroup: 'rice'
  },
  {
    id: 'catalog-2',
    name: 'White rice, cooked',
    category: 'grain',
    foodState: 'cooked',
    identitySource: 'usda',
    nutritionProvenance: 'source_backed',
    nutritionBasis: 'per_100g',
    basisAmount: 100,
    calories: 130,
    protein: 2.4,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
    defaultPortion: {description: '1 cup', amount: 1, unit: 'cup', gramWeight: 186},
    allergenTags: [],
    allergenStatus: 'known',
    foodGroup: 'rice'
  }
]

interface PagingState {
  isFetchingMoreFoods?: boolean
  isFetchingMoreCatalogFoods?: boolean
  foods?: PersonalFood[]
  catalogFoods?: CatalogFood[]
}

// The two bound page-fetchers, held module-side so a test can watch the end of the list advance them
const fetchMoreFoods = jest.fn()
const fetchMoreCatalogFoods = jest.fn()

// The half of an infinite-query result this screen reads: the flattened pages, the paging flags and the two
// bound callbacks. Mocked at the hook's own module boundary, so the screen's own derivation is what runs.
const mockQueries = ({
  isFetchingMoreFoods = false,
  isFetchingMoreCatalogFoods = false,
  foods = LIBRARY_FOODS,
  catalogFoods = CATALOG_FOODS
}: PagingState): void => {
  jest.mocked(useFoodsInfiniteQuery).mockReturnValue({
    data: {pages: [{foods}], pageParams: [1]},
    hasNextPage: true,
    isFetchingNextPage: isFetchingMoreFoods,
    fetchNextPage: fetchMoreFoods,
    isLoading: false,
    isFetching: isFetchingMoreFoods
  } as unknown as ReturnType<typeof useFoodsInfiniteQuery>)

  jest.mocked(useCatalogSearchInfiniteQuery).mockReturnValue({
    data: {pages: [{items: catalogFoods}], pageParams: [1]},
    hasNextPage: true,
    isFetchingNextPage: isFetchingMoreCatalogFoods,
    fetchNextPage: fetchMoreCatalogFoods,
    refetch: jest.fn(),
    isLoading: false,
    isError: false,
    isSuccess: true,
    isFetching: isFetchingMoreCatalogFoods
  } as unknown as ReturnType<typeof useCatalogSearchInfiniteQuery>)

  jest.mocked(useBrandedFoodSearchQuery).mockReturnValue({
    data: undefined,
    isFetching: false
  } as unknown as ReturnType<typeof useBrandedFoodSearchQuery>)

  jest.mocked(useDeleteFoodMutation).mockReturnValue({
    mutateAsync: jest.fn()
  } as unknown as ReturnType<typeof useDeleteFoodMutation>)

  jest
    .mocked(useMealPlanEntitlement)
    .mockReturnValue({isCatalogVisible: true} as unknown as ReturnType<typeof useMealPlanEntitlement>)
}

// The catalog section only renders for a query it can answer, and the query reaches the hooks through the
// screen's own 400 ms debounce — so the search text is entered the way the user enters it, through the
// SearchBar the screen renders, and the debounce is then run out.
const renderScreen = (paging: PagingState): ReactTestRenderer => {
  mockQueries(paging)

  let renderer!: ReactTestRenderer

  act(() => {
    renderer = create(<AddFoodScreen />)
  })

  act(() => {
    renderer.root.findByType(SearchBar).props.onSearchTextChanged(CATALOG_QUERY)
  })

  act(() => {
    jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS)
  })

  return renderer
}

const listFooterOf = (renderer: ReactTestRenderer): React.ReactElement | null =>
  renderer.root.findByType(SectionList).props.ListFooterComponent

// Read over host nodes — the views the platform mounts — because that is the tree a screen reader walks, and
// because the row components above them are memoized, which leaves the composite element out of this tree.
const hostNodes = (
  instance: ReactTestInstance,
  match: (node: ReactTestInstance, hostType: string) => boolean
): ReactTestInstance[] => instance.findAll(node => typeof node.type === 'string' && match(node, node.type))

// The footer the list mounts: the one block carrying both the paging style and the loading announcement.
const pagingFootersIn = (renderer: ReactTestRenderer): ReactTestInstance[] =>
  hostNodes(
    renderer.root,
    node =>
      node.props.style === styles.pagingFooter &&
      node.props.accessibilityLabel === MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL
  )

// Counted over the placeholder rows themselves: one block is CATALOG_SKELETON_ROWS long, so a footer
// announcing both paged sections carries twice the rows of one announcing a single section.
const skeletonRowsIn = (instance: ReactTestInstance): ReactTestInstance[] =>
  hostNodes(instance, node => node.props.style === styles.catalogSkeletonRow)

const renderedTextIn = (instance: ReactTestInstance): string[] =>
  hostNodes(instance, (_node, hostType) => hostType === 'Text').flatMap(node =>
    node.children.filter((child): child is string => typeof child === 'string')
  )

// Every row the list is holding when the footer appears, which is what "existing results stay visible" means
const ROW_NAMES: readonly string[] = [
  ...LIBRARY_FOODS.map(food => food.name),
  ...CATALOG_FOODS.map(catalogFood => catalogFood.name)
]

const expectEveryRowStillOnScreen = (renderer: ReactTestRenderer): void => {
  const texts = renderedTextIn(renderer.root)

  ROW_NAMES.forEach(name => {
    expect(texts).toContain(name)
  })
}

// The skeleton bars are sized against the filled column, so they are drawn only once it has been measured —
// a layout pass the renderer does not perform on its own.
const measureSkeletonBarAreas = (renderer: ReactTestRenderer): void => {
  const measurable = renderer.root.findAll(node => typeof node.props.onLayout === 'function')

  act(() => {
    measurable.forEach(node => node.props.onLayout({nativeEvent: {layout: {width: 300, height: 40}}}))
  })
}

describe('AddFood next-page loading affordance', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('gives the list no footer while neither section is paging', () => {
    const renderer = renderScreen({})

    expect(listFooterOf(renderer)).toBeNull()
    expect(pagingFootersIn(renderer)).toHaveLength(0)
    expectEveryRowStillOnScreen(renderer)

    act(() => {
      renderer.unmount()
    })
  })

  // The finding's own reproduction, in order: reach the end of a section that has more pages, let the query
  // report the fetch in flight, then read what the list was configured with.
  it('announces the page that reaching the end of the list put in flight', () => {
    const renderer = renderScreen({})

    act(() => {
      renderer.root.findByType(SectionList).props.onEndReached({distanceFromEnd: 0})
    })

    expect(fetchMoreFoods).toHaveBeenCalledTimes(1)
    expect(fetchMoreCatalogFoods).toHaveBeenCalledTimes(1)
    expect(listFooterOf(renderer)).toBeNull()

    mockQueries({isFetchingMoreFoods: true, isFetchingMoreCatalogFoods: true})

    act(() => {
      renderer.update(<AddFoodScreen />)
    })

    expect(listFooterOf(renderer)).not.toBeNull()
    expect(skeletonRowsIn(pagingFootersIn(renderer)[0])).toHaveLength(CATALOG_SKELETON_ROWS.length * 2)
    expectEveryRowStillOnScreen(renderer)

    act(() => {
      renderer.unmount()
    })
  })

  it('hands the list one block while the library pages, under the rows it is extending', () => {
    const renderer = renderScreen({isFetchingMoreFoods: true})
    const footers = pagingFootersIn(renderer)

    expect(listFooterOf(renderer)).not.toBeNull()
    expect(footers).toHaveLength(1)
    expect(skeletonRowsIn(footers[0])).toHaveLength(CATALOG_SKELETON_ROWS.length)
    expectEveryRowStillOnScreen(renderer)

    act(() => {
      renderer.unmount()
    })
  })

  it('hands the list one block while the catalog pages, under the rows it is extending', () => {
    const renderer = renderScreen({isFetchingMoreCatalogFoods: true})
    const footers = pagingFootersIn(renderer)

    expect(listFooterOf(renderer)).not.toBeNull()
    expect(footers).toHaveLength(1)
    expect(skeletonRowsIn(footers[0])).toHaveLength(CATALOG_SKELETON_ROWS.length)
    expectEveryRowStillOnScreen(renderer)

    act(() => {
      renderer.unmount()
    })
  })

  it('announces both paged sections at once, each with its own block', () => {
    const renderer = renderScreen({isFetchingMoreFoods: true, isFetchingMoreCatalogFoods: true})
    const footers = pagingFootersIn(renderer)

    expect(listFooterOf(renderer)).not.toBeNull()
    expect(footers).toHaveLength(1)
    expect(skeletonRowsIn(footers[0])).toHaveLength(CATALOG_SKELETON_ROWS.length * 2)
    expectEveryRowStillOnScreen(renderer)

    act(() => {
      renderer.unmount()
    })
  })

  it('announces the footer to assistive technology and draws it as shimmer bars once measured', () => {
    const renderer = renderScreen({isFetchingMoreCatalogFoods: true})

    measureSkeletonBarAreas(renderer)

    const footer = pagingFootersIn(renderer)[0]

    expect(footer.props.accessible).toBe(true)
    expect(footer.props.accessibilityLabel).toBe(MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL)
    expect(footer.findAllByType(Skeleton)).toHaveLength(CATALOG_SKELETON_ROWS.length * 2)

    act(() => {
      renderer.unmount()
    })
  })

  it('stops announcing the page once it has settled, leaving the rows it added on screen', () => {
    const renderer = renderScreen({isFetchingMoreCatalogFoods: true})

    expect(pagingFootersIn(renderer)).toHaveLength(1)

    mockQueries({})

    act(() => {
      renderer.update(<AddFoodScreen />)
    })

    expect(listFooterOf(renderer)).toBeNull()
    expect(pagingFootersIn(renderer)).toHaveLength(0)
    expectEveryRowStillOnScreen(renderer)

    act(() => {
      renderer.unmount()
    })
  })
})
