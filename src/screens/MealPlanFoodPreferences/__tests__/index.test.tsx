import React from 'react'

import type {CatalogFoodSuggestion} from '@data/models/CatalogFood'
import type {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import type {StepMode} from '@navigation/types'
import {useCatalogSuggestionsQuery} from '@queries/catalog/useCatalogSuggestionsQuery'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {act, create, ReactTestRenderer, ReactTestRendererJSON} from 'react-test-renderer'

import MealPlanSetupProvider from '@components/MealPlanSetupProvider'
import ProgressSegments from '@components/WizardHeader/components/ProgressSegments'

import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_FOOD_PREFERENCES_TITLE,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT,
  MEAL_PLAN_WIZARD_STEP_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import MealPlanFoodPreferencesScreen from '../index'

// The screen's data and navigation seams, mocked at the module boundary: what this suite pins is which header
// the screen draws for a given route, so the answers it reads come from fixtures rather than from a query
// client or a navigator.
//
// `@react-navigation/native` is spread rather than replaced, because `@styles/theme` builds the app's palette
// on its `DefaultTheme` and a factory returning the two hooks alone leaves every stylesheet without colors.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(),
  useRoute: jest.fn()
}))

jest.mock('@queries/mealPlanning/useMealPlanPreferencesQuery', () => ({
  useMealPlanPreferencesQuery: jest.fn()
}))

jest.mock('@queries/mealPlanning/useSaveSetupStepMutation', () => ({
  useSaveSetupStepMutation: jest.fn()
}))

jest.mock('@queries/catalog/useCatalogSuggestionsQuery', () => ({
  useCatalogSuggestionsQuery: jest.fn()
}))

jest.mock('@hooks/mealPlanning/useMealPlanCapabilityGuard', () => ({
  useMealPlanCapabilityGuard: jest.fn()
}))

jest.mock('@hooks/mealPlanning/useHomeTabsNavigation', () => ({
  useHomeTabsNavigation: jest.fn()
}))

// The device seams the screen reaches through real code: the safe-area insets the footer reads and the
// animation runtime the suggestions skeleton is built on are native. Each package's own published Jest mock
// stands in for its native module, so the footer and the skeleton stay the shipped implementations.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{default: unknown}>('react-native-safe-area-context/jest/mock').default
)

// Reanimated 4 initializes its worklets runtime on import, and its own published mock re-enters that import,
// so the animation primitives the suggestions skeleton builds on are stubbed here instead — the skeleton
// itself stays the shipped component. It renders only while suggestions are loading, which the fixtures below
// never are; this mock exists so importing it does not reach for a native runtime.
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: {View: jest.requireActual<typeof import('react-native')>('react-native').View},
  useSharedValue: (value: number) => ({value}),
  useAnimatedStyle: (build: () => Record<string, unknown>) => build(),
  withTiming: (value: number) => value,
  withRepeat: (value: number) => value
}))

const SAVED_PREFERENCES: MealPlanPreferences = {
  setupStatus: 'completed',
  setupStep: null,
  reviewStartDate: null,
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 11,
  goal: 'lose',
  goalWeightKg: 75,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 178,
  weightKg: 82.6,
  sexForEstimate: 'male',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'lightly_active',
  diet: 'none',
  allergens: [],
  dislikedFoods: [{id: 'food-mushroom', name: 'Mushrooms', foodGroup: 'mushroom'}],
  dislikedFoodGroups: [],
  mealSchedule: 'three',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: null,
  noBudgetPreference: true,
  budgetTier: null,
  hasActivePlan: true
}

const SUGGESTIONS: CatalogFoodSuggestion[] = [
  {id: 'food-olive', name: 'Olives', foodGroup: 'olive'},
  {id: 'food-anchovy', name: 'Anchovies', foodGroup: 'fish'}
]

// The step reopened for a single "Save changes" edit, from the Plan settings row and from the Review row.
const EDIT_FROM_SETTINGS: StepMode = {mode: 'edit', returnTo: 'settings', origin: 'row'}

const EDIT_FROM_REVIEW: StepMode = {mode: 'edit', returnTo: 'review', origin: 'row'}

const SETUP_ROUTE: StepMode = {mode: 'setup'}

// The fifth of the seven steps the calculated-target route runs, which is the counter this screen prints
// while it is part of that flow.
const SETUP_STEP_COUNTER = stringWithNamedParameters(MEAL_PLAN_WIZARD_STEP_TEMPLATE, {n: 5, m: 7})

const STEP_COUNTER_PATTERN = /^\d+ of \d+$/

// Hook seams are reached through their own typed shapes rather than through the hooks' full generic
// signatures: a UseQueryResult faked in full would state nothing this suite asserts, and the narrow shapes
// below are exactly what the screen reads from each.
interface RouteShape {
  params: StepMode
}

interface PreferencesQueryShape {
  data: MealPlanPreferences
  isPending: boolean
  refetch: jest.Mock
}

interface SuggestionsQueryShape {
  data: CatalogFoodSuggestion[]
  isPending: boolean
  isError: boolean
}

interface SaveMutationShape {
  isPending: boolean
  mutateAsync: jest.Mock
}

const mockedHook = <T,>(hook: unknown): jest.MockedFunction<() => T> => hook as jest.MockedFunction<() => T>

const renderFoodPreferencesScreen = (params: StepMode): ReactTestRenderer => {
  mockedHook<RouteShape>(useRoute).mockReturnValue({params})

  let renderer!: ReactTestRenderer

  act(() => {
    renderer = create(
      <MealPlanSetupProvider>
        <MealPlanFoodPreferencesScreen />
      </MealPlanSetupProvider>
    )
  })

  return renderer
}

// Read off the mounted host tree — the views the platform draws — because that is what a user sees and a
// screen reader walks; the composite elements above them repeat the same props and strings.
const TEXT_HOST_TYPE = 'Text'

const isHostNode = (child: ReactTestRendererJSON | string): child is ReactTestRendererJSON => typeof child !== 'string'

const hostNodesOf = (node: ReactTestRendererJSON): ReactTestRendererJSON[] => [
  node,
  ...(node.children ?? []).filter(isHostNode).flatMap(hostNodesOf)
]

const hostNodes = (renderer: ReactTestRenderer): ReactTestRendererJSON[] => {
  const root = renderer.toJSON()

  if (root === null) {
    throw new Error('Expected the screen to mount a host tree')
  }

  return (Array.isArray(root) ? root : [root]).flatMap(hostNodesOf)
}

const renderedText = (renderer: ReactTestRenderer): string[] =>
  hostNodes(renderer)
    .filter(node => node.type === TEXT_HOST_TYPE)
    .flatMap(node => (node.children ?? []).filter((child): child is string => typeof child === 'string'))

const backControls = (renderer: ReactTestRenderer): ReactTestRendererJSON[] =>
  hostNodes(renderer).filter(node => node.props.accessibilityLabel === MEAL_PLAN_BACK_ACCESSIBILITY_LABEL)

const stepCounters = (renderer: ReactTestRenderer): string[] =>
  renderedText(renderer).filter(copy => STEP_COUNTER_PATTERN.test(copy))

beforeEach(() => {
  jest.clearAllMocks()

  mockedHook<{goBack: jest.Mock; navigate: jest.Mock}>(useNavigation).mockReturnValue({
    goBack: jest.fn(),
    navigate: jest.fn()
  })

  mockedHook<PreferencesQueryShape>(useMealPlanPreferencesQuery).mockReturnValue({
    data: SAVED_PREFERENCES,
    isPending: false,
    refetch: jest.fn()
  })

  mockedHook<SuggestionsQueryShape>(useCatalogSuggestionsQuery).mockReturnValue({
    data: SUGGESTIONS,
    isPending: false,
    isError: false
  })

  mockedHook<SaveMutationShape>(useSaveSetupStepMutation).mockReturnValue({
    isPending: false,
    mutateAsync: jest.fn()
  })

  mockedHook<{isGatedRequestAllowed: boolean; isCapabilityUnavailable: boolean}>(
    useMealPlanCapabilityGuard
  ).mockReturnValue({isGatedRequestAllowed: true, isCapabilityUnavailable: false})

  mockedHook<{returnFromTargets: jest.Mock}>(useHomeTabsNavigation).mockReturnValue({
    returnFromTargets: jest.fn()
  })
})

describe('MealPlanFoodPreferences reopened for a single edit', () => {
  it('carries the back control alone, asserting no setup-flow progress', () => {
    const renderer = renderFoodPreferencesScreen(EDIT_FROM_SETTINGS)

    expect(renderer.root.findAllByType(ProgressSegments)).toHaveLength(0)
    expect(stepCounters(renderer)).toEqual([])
    expect(backControls(renderer)).toHaveLength(1)

    act(() => {
      renderer.unmount()
    })
  })

  it('still draws the step itself, saving the one answer it owns', () => {
    const renderer = renderFoodPreferencesScreen(EDIT_FROM_SETTINGS)
    const text = renderedText(renderer)

    expect(text).toContain(MEAL_PLAN_FOOD_PREFERENCES_TITLE)
    expect(text).toContain(MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT)
    expect(text).not.toContain(MEAL_PLAN_CONTINUE_BUTTON_TEXT)

    act(() => {
      renderer.unmount()
    })
  })

  it('hides the progress whichever row reopened it, since both are one-step edits', () => {
    const renderer = renderFoodPreferencesScreen(EDIT_FROM_REVIEW)

    expect(renderer.root.findAllByType(ProgressSegments)).toHaveLength(0)
    expect(stepCounters(renderer)).toEqual([])

    act(() => {
      renderer.unmount()
    })
  })
})

describe('MealPlanFoodPreferences on the setup flow', () => {
  it('still states its progress through the flow, back control included', () => {
    const renderer = renderFoodPreferencesScreen(SETUP_ROUTE)

    expect(renderer.root.findAllByType(ProgressSegments)).toHaveLength(1)
    expect(stepCounters(renderer)).toEqual([SETUP_STEP_COUNTER])
    expect(backControls(renderer)).toHaveLength(1)

    act(() => {
      renderer.unmount()
    })
  })

  it('still continues to the next step rather than saving one', () => {
    const renderer = renderFoodPreferencesScreen(SETUP_ROUTE)
    const text = renderedText(renderer)

    expect(text).toContain(MEAL_PLAN_FOOD_PREFERENCES_TITLE)
    expect(text).toContain(MEAL_PLAN_CONTINUE_BUTTON_TEXT)
    expect(text).not.toContain(MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT)

    act(() => {
      renderer.unmount()
    })
  })
})
