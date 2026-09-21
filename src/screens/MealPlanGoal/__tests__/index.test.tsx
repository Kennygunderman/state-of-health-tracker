import React from 'react'

import type {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {useHomeTabsNavigation} from '@hooks/mealPlanning/useHomeTabsNavigation'
import {useMealPlanCapabilityGuard} from '@hooks/mealPlanning/useMealPlanCapabilityGuard'
import type {StepMode} from '@navigation/types'
import {useMealPlanPreferencesQuery} from '@queries/mealPlanning/useMealPlanPreferencesQuery'
import {useSaveSetupStepMutation} from '@queries/mealPlanning/useSaveSetupStepMutation'
import {useNavigation, useRoute} from '@react-navigation/native'
import {act, create, ReactTestRenderer, ReactTestRendererJSON} from 'react-test-renderer'

import MealPlanSetupProvider from '@components/MealPlanSetupProvider'
import TextField from '@components/TextField'

import {
  MEAL_PLAN_CONTINUE_BUTTON_TEXT,
  MEAL_PLAN_GOAL_LABELS,
  MEAL_PLAN_GOAL_TITLE,
  MEAL_PLAN_GOAL_WEIGHT_HEADER,
  MEAL_PLAN_PACE_HEADER,
  MEAL_PLAN_PACE_RATE_TEMPLATE,
  MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT
} from '@constants/strings'

import PaceCards from '../components/PaceCards'
import MealPlanGoalScreen from '../index'

// The screen's data and navigation seams, mocked at the module boundary: what this suite pins is which
// question the screen asks and which controls it draws for a given route, so the answers it reads come from
// fixtures rather than from a query client, a navigator or a persisted store.
// Spread rather than replaced: `@styles/theme` builds the app's palette on this module's `DefaultTheme`, so a
// factory returning the two hooks alone leaves every stylesheet in the tree without colors.
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

jest.mock('@hooks/mealPlanning/useMealPlanCapabilityGuard', () => ({
  useMealPlanCapabilityGuard: jest.fn()
}))

jest.mock('@hooks/mealPlanning/useHomeTabsNavigation', () => ({
  useHomeTabsNavigation: jest.fn()
}))

// The device seams the screen reaches through real code: the weight-unit store is persisted, the safe-area
// insets and the keyboard-aware scroll region are native views. Each package's own published Jest mock stands
// in for its native module, so the store, the footer and the scroll region stay the shipped implementations.
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{default: unknown}>('react-native-safe-area-context/jest/mock').default
)

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('react-native-keyboard-aware-scroll-view', () => ({
  KeyboardAwareScrollView: jest.requireActual<typeof import('react-native')>('react-native').ScrollView
}))

// The stored answers the "Activity and pace" row reopens this screen on top of: a loss goal with a pace
// already chosen, which is the only shape in which the pace section has cards to draw at all.
const SAVED_PREFERENCES: MealPlanPreferences = {
  setupStatus: 'completed',
  setupStep: null,
  reviewStartDate: null,
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 7,
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
  dislikedFoods: [],
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

const PACE_SCOPE_ROUTE: StepMode = {mode: 'edit', returnTo: 'settings', origin: 'row', scope: 'pace'}

const SETUP_ROUTE: StepMode = {mode: 'setup'}

const GOAL_LABELS: readonly string[] = [
  MEAL_PLAN_GOAL_LABELS.lose,
  MEAL_PLAN_GOAL_LABELS.maintain,
  MEAL_PLAN_GOAL_LABELS.gain
]

const PACE_CARD_LABEL = MEAL_PLAN_PACE_RATE_TEMPLATE.replace('{pace}', '1')

// The wizard header's counter, in the only form it can take: a screen still asserting setup-flow progress
// prints one of these, and a single-step edit prints none.
const STEP_COUNTER_PATTERN = /^\d+ of \d+$/

// Hook seams are reached through their own typed shapes rather than through the hooks' full generic
// signatures: a UseQueryResult or a navigator object faked in full would state nothing this suite asserts,
// and the narrow shapes below are exactly what the screen reads from each.
interface RouteShape {
  params: StepMode
}

interface PreferencesQueryShape {
  data: MealPlanPreferences
  refetch: jest.Mock
}

interface SaveMutationShape {
  isPending: boolean
  mutateAsync: jest.Mock
}

const mockedHook = <T,>(hook: unknown): jest.MockedFunction<() => T> => hook as jest.MockedFunction<() => T>

const renderGoalScreen = (params: StepMode): ReactTestRenderer => {
  mockedHook<RouteShape>(useRoute).mockReturnValue({params})

  let renderer!: ReactTestRenderer

  act(() => {
    renderer = create(
      <MealPlanSetupProvider>
        <MealPlanGoalScreen />
      </MealPlanSetupProvider>
    )
  })

  return renderer
}

// Read off the mounted host tree — the views the platform draws — because that is the copy a user reads and a
// screen reader walks; the composite elements above them repeat the same strings.
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

const ownText = (node: ReactTestRendererJSON): string[] =>
  (node.children ?? []).filter((child): child is string => typeof child === 'string')

const renderedText = (renderer: ReactTestRenderer): string[] =>
  hostNodes(renderer)
    .filter(node => node.type === TEXT_HOST_TYPE)
    .flatMap(ownText)

const headlineText = (renderer: ReactTestRenderer): string[] => {
  const headers = hostNodes(renderer).filter(node => node.props.accessibilityRole === 'header')

  if (headers.length !== 1) {
    throw new Error(`Expected exactly one heading on the screen, found ${headers.length}`)
  }

  return ownText(headers[0])
}

const occurrencesOf = (renderer: ReactTestRenderer, copy: string): number =>
  renderedText(renderer).filter(text => text === copy).length

beforeEach(() => {
  jest.clearAllMocks()

  mockedHook<{goBack: jest.Mock; navigate: jest.Mock}>(useNavigation).mockReturnValue({
    goBack: jest.fn(),
    navigate: jest.fn()
  })

  mockedHook<PreferencesQueryShape>(useMealPlanPreferencesQuery).mockReturnValue({
    data: SAVED_PREFERENCES,
    refetch: jest.fn()
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

describe('MealPlanGoal on the pace-scope edit route', () => {
  it('asks the pace question instead of a goal question whose answers are all hidden', () => {
    const renderer = renderGoalScreen(PACE_SCOPE_ROUTE)

    expect(headlineText(renderer)).toEqual([MEAL_PLAN_PACE_HEADER])
    expect(renderedText(renderer)).not.toContain(MEAL_PLAN_GOAL_TITLE)

    act(() => {
      renderer.unmount()
    })
  })

  it('asks it exactly once, so the promoted headline does not repeat as the section label', () => {
    const renderer = renderGoalScreen(PACE_SCOPE_ROUTE)

    expect(occurrencesOf(renderer, MEAL_PLAN_PACE_HEADER)).toBe(1)

    act(() => {
      renderer.unmount()
    })
  })

  it('draws the pace cards and nothing that answers the goal question', () => {
    const renderer = renderGoalScreen(PACE_SCOPE_ROUTE)
    const text = renderedText(renderer)

    expect(renderer.root.findAllByType(PaceCards)).toHaveLength(1)
    expect(text).toContain(PACE_CARD_LABEL)
    GOAL_LABELS.forEach(label => {
      expect(text).not.toContain(label)
    })
    expect(text).not.toContain(MEAL_PLAN_GOAL_WEIGHT_HEADER)
    expect(renderer.root.findAllByType(TextField)).toHaveLength(0)

    act(() => {
      renderer.unmount()
    })
  })

  it('carries the back control alone and saves the one step it edits', () => {
    const renderer = renderGoalScreen(PACE_SCOPE_ROUTE)
    const text = renderedText(renderer)

    expect(text.filter(copy => STEP_COUNTER_PATTERN.test(copy))).toEqual([])
    expect(text).toContain(MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT)
    expect(text).not.toContain(MEAL_PLAN_CONTINUE_BUTTON_TEXT)

    act(() => {
      renderer.unmount()
    })
  })
})

describe('MealPlanGoal on the setup flow', () => {
  it('still asks the goal question and labels the pace section under it', () => {
    const renderer = renderGoalScreen(SETUP_ROUTE)

    expect(headlineText(renderer)).toEqual([MEAL_PLAN_GOAL_TITLE])
    expect(occurrencesOf(renderer, MEAL_PLAN_PACE_HEADER)).toBe(1)

    act(() => {
      renderer.unmount()
    })
  })

  it('still draws every goal control, the goal-weight field and the pace cards', () => {
    const renderer = renderGoalScreen(SETUP_ROUTE)
    const text = renderedText(renderer)

    GOAL_LABELS.forEach(label => {
      expect(text).toContain(label)
    })
    expect(text).toContain(MEAL_PLAN_GOAL_WEIGHT_HEADER)
    expect(renderer.root.findAllByType(TextField)).toHaveLength(1)
    expect(renderer.root.findAllByType(PaceCards)).toHaveLength(1)
    expect(text).toContain(PACE_CARD_LABEL)

    act(() => {
      renderer.unmount()
    })
  })

  it('still states setup-flow progress and continues rather than saving one step', () => {
    const renderer = renderGoalScreen(SETUP_ROUTE)
    const text = renderedText(renderer)

    expect(text.filter(copy => STEP_COUNTER_PATTERN.test(copy))).toHaveLength(1)
    expect(text).toContain(MEAL_PLAN_CONTINUE_BUTTON_TEXT)
    expect(text).not.toContain(MEAL_PLAN_SAVE_CHANGES_BUTTON_TEXT)

    act(() => {
      renderer.unmount()
    })
  })
})
