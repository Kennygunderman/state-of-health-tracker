import React from 'react'

import {ProgressStackParamList} from '@navigation/ProgressStack'
import {RootStackParamList} from '@navigation/types'
import {BottomTabNavigationOptions, createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import {getFocusedRouteNameFromRoute, NavigatorScreenParams} from '@react-navigation/native'
import FontSize from '@styles/fontSize'
import {Theme} from '@styles/theme'

import AccountScreen from '@screens/Account'

import AccountIcon from '@components/icons/AccountIcon'
import BarbellIcon from '@components/icons/BarbellIcon'
import PieChartIcon from '@components/icons/PieChartIcon'
import PulseIcon from '@components/icons/PulseIcon'
import RunIcon from '@components/icons/RunIcon'

import Screens from '@constants/screens'
import {MACROS_TITLE, PROGRESS_TITLE, WORKOUTS_TITLE} from '@constants/strings'

import MacrosStack from './MacrosStack'
import ProgressStack from './ProgressStack'
import RunsStack from './RunsStack'
import WorkoutsStack from './WorkoutsStack'

export type HomeTabsParamList = {
  MacrosStack: NavigatorScreenParams<RootStackParamList>
  WorkoutsStack: undefined
  // Params are optional so a tab return can resume the stack's retained screen; a caller that wants a
  // specific inner screen still passes one.
  ProgressStack: NavigatorScreenParams<ProgressStackParamList> | undefined
  [Screens.RUNS]: undefined
  [Screens.ACCOUNT]: undefined
}

const Tab = createBottomTabNavigator<HomeTabsParamList>()

const TAB_ICON_SIZE = 22

// The tab bar belongs to the Macros states (frames 11, 11b, 11c, 15b). Figma's 11b draws neither it nor the
// segmented control; the app keeps both there as the divergence AAP 0.1.4 (iii) authorises. These full-screen
// meal-planning routes hide the bar, while the six shipped MacrosStack routes keep their existing behaviour.
const FULL_SCREEN_MACROS_ROUTES: readonly string[] = [
  Screens.MEAL_PLAN_INTRO,
  Screens.MEAL_PLAN_GOAL,
  Screens.MEAL_PLAN_ABOUT_YOU,
  Screens.MEAL_PLAN_ACTIVITY,
  Screens.MEAL_PLAN_DIET,
  Screens.MEAL_PLAN_FOOD_PREFERENCES,
  Screens.MEAL_PLAN_FOOD_SEARCH,
  Screens.MEAL_PLAN_SCHEDULE,
  Screens.MEAL_PLAN_COOKING_BUDGET,
  Screens.MEAL_PLAN_TARGETS,
  Screens.MEAL_PLAN_EDIT_TARGETS,
  Screens.MEAL_PLAN_GENERATING,
  Screens.RECIPE_DETAIL,
  Screens.SWAP_MEAL,
  Screens.SWAP_PREVIEW,
  Screens.GROCERY_LIST,
  Screens.LOG_PLANNED_MEAL,
  Screens.PLAN_SETTINGS
]

// The tint the navigator hands its icon renderer; the renderers ignore the `focused` and `size` it also
// passes, because the size is fixed above and the tint already encodes focus.
interface TabBarIconProps {
  color: string
}

// One renderer per tab, built once here rather than inside screenOptions: a function returning JSX that
// is created during render is a new component type on every render, which React remounts along with the
// subtree's state (react/no-unstable-nested-components). Keyed by route name because tabBarIcon receives
// only {focused, color, size} and cannot see which tab it is drawing.
const TAB_BAR_ICONS: Record<keyof HomeTabsParamList, NonNullable<BottomTabNavigationOptions['tabBarIcon']>> = {
  MacrosStack: ({color}: TabBarIconProps) => <PieChartIcon color={color} size={TAB_ICON_SIZE} />,
  WorkoutsStack: ({color}: TabBarIconProps) => <BarbellIcon color={color} size={TAB_ICON_SIZE} />,
  ProgressStack: ({color}: TabBarIconProps) => <PulseIcon color={color} size={TAB_ICON_SIZE} />,
  [Screens.RUNS]: ({color}: TabBarIconProps) => <RunIcon color={color} size={TAB_ICON_SIZE} />,
  [Screens.ACCOUNT]: ({color}: TabBarIconProps) => <AccountIcon color={color} size={TAB_ICON_SIZE} />
}

const HomeTabs = (): React.JSX.Element => {
  return (
    <Tab.Navigator
      screenOptions={({route}) => {
        const focusedRouteName = getFocusedRouteNameFromRoute(route)
        const hideTabBar = focusedRouteName !== undefined && FULL_SCREEN_MACROS_ROUTES.includes(focusedRouteName)

        return {
          freezeOnBlur: true,
          sceneStyle: {backgroundColor: Theme.colors.background},
          tabBarIcon: TAB_BAR_ICONS[route.name],
          headerShown: false,
          tabBarActiveTintColor: Theme.colors.accentGreen,
          tabBarInactiveTintColor: Theme.colors.textFaint,
          tabBarLabelStyle: {
            fontSize: FontSize.TAB_LABEL,
            fontWeight: '600'
          },
          tabBarStyle: {
            display: hideTabBar ? 'none' : 'flex',
            borderTopWidth: 1,
            borderTopColor: Theme.colors.hairline,
            backgroundColor: Theme.colors.navBar
          }
        }
      }}>
      <Tab.Screen name={'MacrosStack'} component={MacrosStack} options={{title: MACROS_TITLE}} />

      <Tab.Screen name={'WorkoutsStack'} component={WorkoutsStack} options={{title: WORKOUTS_TITLE}} />

      <Tab.Screen name={'ProgressStack'} component={ProgressStack} options={{title: PROGRESS_TITLE}} />

      <Tab.Screen name={Screens.RUNS} component={RunsStack} />

      <Tab.Screen name={Screens.ACCOUNT} component={AccountScreen} />
    </Tab.Navigator>
  )
}

export default HomeTabs
