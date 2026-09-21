import React from 'react'

import {Dimensions} from 'react-native'

import {MacroTotals} from '@data/models/Macros'
import {MealPlanDayEnvelope, MealPlanMeal} from '@data/models/MealPlan'
import {RecipeVersion} from '@data/models/Recipe'
import {SwapPreview} from '@data/models/SwapAlternative'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import {useCurrentMealPlanQuery} from '@queries/mealPlanning/useCurrentMealPlanQuery'
import {useMealPlanDayQuery} from '@queries/mealPlanning/useMealPlanDayQuery'
import {useSwapMealMutation} from '@queries/mealPlanning/useSwapMealMutation'
import {useSwapPreviewQuery} from '@queries/mealPlanning/useSwapPreviewQuery'
import {useNavigation, useRoute} from '@react-navigation/native'
import useAuthStore, {AuthState} from '@store/auth/useAuthStore'
import useMealPlanStore, {MealPlanStore} from '@store/mealPlan/useMealPlanStore'
import {Sizes} from '@styles/sizes'
import {UseQueryResult} from '@tanstack/react-query'
import {ReactTestInstance, ReactTestRenderer, act, create} from 'react-test-renderer'

import RecipeHero from '@components/RecipeHero'

import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL,
  MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import SwapPreviewScreen from '../index'
import {formatReplacingContext} from '../index.util'

/**
 * Frame 13b's two hero states, and the back control the loading one used to drop.
 *
 * Every seam the screen reads through is mocked at its module boundary, which is what lets the loading branch
 * be held open: the preview and day reads are the only things deciding between the shell and the loaded
 * screen, and a real query observer would resolve or fail rather than stay pending.
 */

// Only the two hooks are replaced: `@styles/theme` builds the app's palette on this module's `DefaultTheme`,
// so a factory returning the hooks alone would leave every themed style without its fonts and colours.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn()
}))

jest.mock('@queries/mealPlanning/useSwapPreviewQuery', () => ({
  useSwapPreviewQuery: jest.fn()
}))

jest.mock('@queries/mealPlanning/useMealPlanDayQuery', () => ({
  useMealPlanDayQuery: jest.fn()
}))

jest.mock('@queries/mealPlanning/useCurrentMealPlanQuery', () => ({
  useCurrentMealPlanQuery: jest.fn()
}))

jest.mock('@queries/mealPlanning/useSwapMealMutation', () => ({
  useSwapMealMutation: jest.fn()
}))

jest.mock('@hooks/mealPlanning/useMealPlanCapabilityGuard', () => ({
  useMealPlanCapabilityGuard: jest.fn()
}))

jest.mock('@store/auth/useAuthStore', () => ({
  __esModule: true,
  default: jest.fn()
}))

// The persist adapter is stubbed the way this store's own suite stubs it, which keeps the real store module
// — and the pending-intent resolvers this screen's `index.util` reads from it — free of native modules.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

// Only the hook itself is replaced: this screen's own `index.util` reads the slot-ownership resolver that
// lives in this module, and that resolver is real logic the render depends on.
jest.mock('@store/mealPlan/useMealPlanStore', () => ({
  ...jest.requireActual('@store/mealPlan/useMealPlanStore'),
  __esModule: true,
  default: jest.fn()
}))

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useIsMutating: jest.fn(() => 0)
}))

jest.mock('@components/toast/util/ShowToast', () => ({
  showToast: jest.fn()
}))

// The shimmer inside `Skeleton` runs on Reanimated's worklet runtime, which exists only on a device — and
// Reanimated 4's own published mock re-enters that runtime, so it cannot stand in here. These four primitives
// are the whole of what `Skeleton` uses: the shared value becomes a plain box, the animated style is evaluated
// once, and the timing helpers resolve to their target so the sweep has a number rather than a worklet.
jest.mock('react-native-reanimated', () => {
  const {View} = jest.requireActual('react-native')

  return {
    __esModule: true,
    default: {View},
    useSharedValue: <T,>(initial: T): {value: T} => ({value: initial}),
    useAnimatedStyle: (build: () => Record<string, unknown>): Record<string, unknown> => build(),
    withTiming: <T,>(target: T): T => target,
    withRepeat: <T,>(animation: T): T => animation
  }
})

// The package ships browser ESM that the runner does not transform, and the screen only mints a key when the
// commit is pressed — which neither branch under test does.
jest.mock('uuid', () => ({v4: (): string => 'swap-preview-test-idempotency-key'}))

// A native view with no JavaScript implementation, which the shimmer draws inside the skeleton box.
jest.mock('react-native-linear-gradient', () => {
  const {View} = jest.requireActual('react-native')

  return {__esModule: true, default: View}
})

// The hero places its back button below the live top inset, and no provider is mounted around a bare renderer.
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0})
}))

const ROUTE_PARAMS = {
  planId: 'plan-1',
  mealId: 'meal-1',
  date: '2026-09-09',
  recipeVersionId: 'recipe-version-1',
  planRevision: 4
}

const NUTRITION: MacroTotals = {calories: 540, protein: 38, carbs: 49, fat: 19}

const DAY_TOTALS: MacroTotals = {calories: 1835, protein: 135, carbs: 179, fat: 59}

const TARGETS: MacroTotals = {calories: 1940, protein: 146, carbs: 194, fat: 65}

const RECIPE: RecipeVersion = {
  versionId: ROUTE_PARAMS.recipeVersionId,
  recipeId: 'recipe-1',
  version: 1,
  status: 'current',
  name: 'Turkey and hummus wrap',
  description: 'A cold lunch wrap.',
  iconKey: 'cloche',
  instructions: ['Warm the tortilla.', 'Fill and roll.'],
  yieldServings: 1,
  servingDescription: '1 wrap',
  prepMinutes: 15,
  cookMinutes: 0,
  totalMinutes: 15,
  mealSlots: ['lunch'],
  badges: ['high_protein'],
  dietTags: [],
  allergenTags: [],
  allergenStatus: 'known',
  budgetTier: 1,
  nutritionProvenance: 'source_backed',
  perServing: NUTRITION,
  ingredients: [
    {
      catalogFoodId: 'catalog-food-1',
      name: 'Tortilla, whole wheat',
      quantity: 1,
      unit: 'tortilla',
      gramWeight: 64,
      displayText: '1 tortilla',
      nutritionProvenance: 'source_backed',
      isOptional: false
    }
  ]
}

const PREVIEW: SwapPreview = {
  alternative: {
    recipe: RECIPE,
    portionMultiplier: 1,
    portionText: '1 serving',
    nutrition: NUTRITION
  },
  dayTotalsIfSwapped: DAY_TOTALS,
  targets: TARGETS,
  calorieDelta: -70,
  planRevision: ROUTE_PARAMS.planRevision
}

const MEAL: MealPlanMeal = {
  id: ROUTE_PARAMS.mealId,
  revision: 1,
  slot: 'lunch',
  slotTime: '12:30',
  sortOrder: 1,
  recipe: {
    versionId: 'recipe-version-0',
    recipeId: 'recipe-0',
    name: 'Chipotle chicken salad',
    iconKey: 'bowl',
    totalMinutes: 25,
    badges: [],
    nutritionProvenance: 'source_backed'
  },
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: {calories: 610, protein: 45, carbs: 40, fat: 20},
  flags: [],
  previousRecipe: null,
  loggedEntries: []
}

const DAY_ENVELOPE: MealPlanDayEnvelope = {
  planId: ROUTE_PARAMS.planId,
  planRevision: ROUTE_PARAMS.planRevision,
  planStatus: 'active',
  planLifecycle: 'active',
  isWritable: true,
  day: {
    id: 'day-1',
    date: ROUTE_PARAMS.date,
    dayIndex: 2,
    plannedTotals: DAY_TOTALS,
    isLastDay: false,
    meals: [MEAL]
  }
}

const LOADED_HERO_ACCESSIBILITY_LABEL = stringWithNamedParameters(MEAL_PLAN_OPEN_RECIPE_ACCESSIBILITY_TEMPLATE, {
  recipe: RECIPE.name
})

const mockUseNavigation = jest.mocked(useNavigation)
const mockUseRoute = jest.mocked(useRoute)
const mockUseSwapPreviewQuery = jest.mocked(useSwapPreviewQuery)
const mockUseMealPlanDayQuery = jest.mocked(useMealPlanDayQuery)
const mockUseCurrentMealPlanQuery = jest.mocked(useCurrentMealPlanQuery)
const mockUseSwapMealMutation = jest.mocked(useSwapMealMutation)
const mockUseMealPlanCapabilityGuard = jest.mocked(useMealPlanCapabilityGuard)
const mockUseAuthStore = jest.mocked(useAuthStore)
const mockUseMealPlanStore = jest.mocked(useMealPlanStore)

const goBack = jest.fn()

// Each stub below declares the members this screen actually reads off an observer, a mutation, the guard or a
// store, and is asserted into the real type: those types carry dozens of further members, none of which the two
// branches under test reach, and reproducing them would only obscure what each case is holding.
const queryObserver = <T,>(overrides: Partial<UseQueryResult<T>>): UseQueryResult<T> =>
  ({
    data: undefined,
    error: null,
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
    ...overrides
  }) as unknown as UseQueryResult<T>

const AUTH_STATE = {userId: 'user-1'} as unknown as AuthState

const MEAL_PLAN_STATE = {
  pendingIntents: {},
  hasHydratedIntents: true,
  recordPendingIntent: jest.fn(),
  clearPendingIntent: jest.fn(),
  setSelectedPlanDate: jest.fn(),
  setMacrosSegment: jest.fn()
} as unknown as MealPlanStore

// The two reads the shell is decided by (`isShellLoading`): pending leaves the screen in its loading branch,
// settled with data puts the real hero and the preview on screen.
const givenPreviewIsLoading = (): void => {
  mockUseSwapPreviewQuery.mockReturnValue(queryObserver<SwapPreview>({isLoading: true, isFetching: true}))
  mockUseMealPlanDayQuery.mockReturnValue(queryObserver<MealPlanDayEnvelope>({isLoading: true, isFetching: true}))
}

const givenPreviewIsLoaded = (): void => {
  mockUseSwapPreviewQuery.mockReturnValue(queryObserver<SwapPreview>({data: PREVIEW}))
  mockUseMealPlanDayQuery.mockReturnValue(queryObserver<MealPlanDayEnvelope>({data: DAY_ENVELOPE}))
}

const renderScreen = (): ReactTestRenderer => {
  let renderer!: ReactTestRenderer

  act(() => {
    renderer = create(<SwapPreviewScreen />)
  })

  return renderer
}

// The band the hero mounts, whichever variant drew it: its first host node.
const heroBand = (renderer: ReactTestRenderer): ReactTestInstance =>
  renderer.root.findByType(RecipeHero).findAll(node => typeof node.type === 'string')[0]

// Host nodes only — the views the platform mounts are the tree a screen reader walks.
const hostNodesWhere = (
  renderer: ReactTestRenderer,
  predicate: (node: ReactTestInstance) => boolean
): ReactTestInstance[] => renderer.root.findAll(node => typeof node.type === 'string' && predicate(node))

// A Touchable hands its press handling to the platform through the responder system rather than through an
// `onPress` prop on the view it mounts, so the control is recognised here by what a screen reader reads — the
// mounted node's role and name — and pressed through the element that still carries the handler.
const backControls = (renderer: ReactTestRenderer): ReactTestInstance[] =>
  hostNodesWhere(
    renderer,
    node =>
      node.props.accessibilityRole === 'button' && node.props.accessibilityLabel === MEAL_PLAN_BACK_ACCESSIBILITY_LABEL
  )

// The Touchable behind the back button is an outer forwarding element over its implementation, so more than
// one composite element carries the name; one distinct handler behind them is what proves they are one control.
const pressBack = (renderer: ReactTestRenderer): void => {
  const pressables = renderer.root.findAll(
    node =>
      typeof node.type !== 'string' &&
      node.props.accessibilityLabel === MEAL_PLAN_BACK_ACCESSIBILITY_LABEL &&
      typeof node.props.onPress === 'function'
  )
  const handlers = new Set(pressables.map(node => node.props.onPress))

  expect(pressables.length).toBeGreaterThan(0)
  expect(handlers.size).toBe(1)

  act(() => {
    pressables[0].props.onPress()
  })
}

// What the old placeholder did wrong: a wrapper carrying either of these takes everything under it out of the
// accessibility tree, so the control is only reachable while no ancestor of it declares one.
const hidesDescendantsFromAssistiveTech = (node: ReactTestInstance): boolean =>
  node.props.accessibilityElementsHidden === true || node.props.importantForAccessibility === 'no-hide-descendants'

const assistiveTechHidingAncestors = (instance: ReactTestInstance): ReactTestInstance[] => {
  const hiding: ReactTestInstance[] = []

  for (let ancestor = instance.parent; ancestor; ancestor = ancestor.parent) {
    if (hidesDescendantsFromAssistiveTech(ancestor)) {
      hiding.push(ancestor)
    }
  }

  return hiding
}

beforeEach(() => {
  jest.clearAllMocks()

  mockUseNavigation.mockReturnValue({goBack, navigate: jest.fn(), popTo: jest.fn()} as unknown as ReturnType<
    typeof useNavigation
  >)
  mockUseRoute.mockReturnValue({params: ROUTE_PARAMS} as unknown as ReturnType<typeof useRoute>)
  mockUseCurrentMealPlanQuery.mockReturnValue(queryObserver({}) as ReturnType<typeof useCurrentMealPlanQuery>)
  mockUseSwapMealMutation.mockReturnValue({mutateAsync: jest.fn(), isPending: false} as unknown as ReturnType<
    typeof useSwapMealMutation
  >)
  mockUseMealPlanCapabilityGuard.mockReturnValue({isGatedRequestAllowed: true} as ReturnType<
    typeof useMealPlanCapabilityGuard
  >)
  mockUseAuthStore.mockImplementation(selector => selector(AUTH_STATE))
  mockUseMealPlanStore.mockImplementation(selector => selector(MEAL_PLAN_STATE))
  givenPreviewIsLoading()
})

describe('SwapPreview loading branch', () => {
  it('keeps the hero band as its pending variant rather than replacing it with a bare skeleton', () => {
    const renderer = renderScreen()
    const heroes = renderer.root.findAllByType(RecipeHero)

    expect(heroes).toHaveLength(1)
    expect(heroes[0].props.variant).toBe('pending')
    // The band is full-bleed, and `Skeleton` sizes its sweep from a number, so the window's own width is what
    // the hero is handed — the same value the loaded band spans.
    expect(heroes[0].props.width).toBe(Dimensions.get('window').width)
    // Its height is the loaded band's, which is why nothing below it moves when the real hero arrives.
    expect(heroBand(renderer).props.style).toMatchObject({height: Sizes.HERO_BAND_H})

    act(() => {
      renderer.unmount()
    })
  })

  it('leaves one labelled back control reachable while the preview is still loading', () => {
    const renderer = renderScreen()
    const controls = backControls(renderer)

    expect(controls).toHaveLength(1)
    expect(controls[0].props.accessibilityLabel).toBe(MEAL_PLAN_BACK_ACCESSIBILITY_LABEL)
    expect(assistiveTechHidingAncestors(controls[0])).toEqual([])
    expect(assistiveTechHidingAncestors(heroBand(renderer))).toEqual([])
    expect(hidesDescendantsFromAssistiveTech(heroBand(renderer))).toBe(false)

    act(() => {
      renderer.unmount()
    })
  })

  it('returns to the alternatives when that back control is pressed', () => {
    const renderer = renderScreen()

    pressBack(renderer)

    expect(goBack).toHaveBeenCalledTimes(1)

    act(() => {
      renderer.unmount()
    })
  })

  it('still announces the content shell as busy, so the band is an addition and not a replacement', () => {
    const renderer = renderScreen()
    const busyRegions = hostNodesWhere(
      renderer,
      node => node.props.accessibilityLabel === MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL
    )

    expect(busyRegions).toHaveLength(1)
    expect(busyRegions[0].props.accessibilityState).toEqual({busy: true})

    act(() => {
      renderer.unmount()
    })
  })
})

describe('SwapPreview loaded branch', () => {
  beforeEach(() => {
    givenPreviewIsLoaded()
  })

  it('renders the real hero with the candidate recipe, its replacing context and its own back control', () => {
    const renderer = renderScreen()
    const heroes = renderer.root.findAllByType(RecipeHero)
    const controls = backControls(renderer)

    expect(heroes).toHaveLength(1)
    expect(heroes[0].props.variant).toBeUndefined()
    expect(heroes[0].props).toMatchObject({
      size: 'preview',
      iconKey: RECIPE.iconKey,
      contextText: formatReplacingContext(MEAL.slot, ROUTE_PARAMS.date),
      accessibilityLabel: LOADED_HERO_ACCESSIBILITY_LABEL
    })
    expect(controls).toHaveLength(1)
    expect(assistiveTechHidingAncestors(controls[0])).toEqual([])

    act(() => {
      renderer.unmount()
    })
  })

  it('drops the loading shell once the preview is in hand', () => {
    const renderer = renderScreen()
    const busyRegions = hostNodesWhere(
      renderer,
      node => node.props.accessibilityLabel === MEAL_PLAN_LOADING_ACCESSIBILITY_LABEL
    )

    expect(busyRegions).toEqual([])

    act(() => {
      renderer.unmount()
    })
  })
})
