import React from 'react'

import Screens from '@constants/Screens'
import {MACROS_TITLE, WORKOUTS_TITLE} from '@constants/Strings'
import {FontAwesome5, Ionicons, MaterialCommunityIcons} from '@expo/vector-icons'
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs'
import AccountScreen from '@screens/Account/AccountScreen'
import DebugScreen from '@screens/debug/DebugScreen'
import {useStyleTheme} from '@theme/Theme'

import MealsStack from './MealsStack'
import WorkoutsStack from './WorkoutsStack'

const Tab = createBottomTabNavigator()

const HomeTabs = () => {
  const theme = useStyleTheme()

  const macrosIcon = (color: string) => (
    <FontAwesome5 name="utensils" size={16} color={color} style={{marginBottom: -3}} />
  )

  const barbellIcon = (color: string) => <Ionicons name="barbell" size={24} color={color} style={{marginBottom: -3}} />

  const accountIcon = (color: string) => (
    <MaterialCommunityIcons name="account" size={24} color={color} style={{marginBottom: -3}} />
  )

  const debugIcon = (color: string) => (
    <MaterialCommunityIcons name="desktop-mac" size={24} color={color} style={{marginBottom: -3}} />
  )

  return (
    <Tab.Navigator
      sceneContainerStyle={{backgroundColor: theme.colors.background}}
      screenOptions={({route}) => ({
        tabBarIcon: ({color}) => {
          if (route.name === 'MealsStack') return macrosIcon(color)
          if (route.name === 'WorkoutsStack') return barbellIcon(color)
          if (route.name === Screens.ACCOUNT) return accountIcon(color)
          if (route.name === Screens.DEBUG) return debugIcon(color)
        },
        headerShown: false,
        tabBarActiveTintColor: theme.colors.white,
        tabBarInactiveTintColor: theme.colors.grey,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: theme.colors.navBar
        }
      })}>
      <Tab.Screen name={'MealsStack'} component={MealsStack} options={{title: MACROS_TITLE}} />
      <Tab.Screen name={'WorkoutsStack'} component={WorkoutsStack} options={{title: WORKOUTS_TITLE}} />
      <Tab.Screen name={Screens.ACCOUNT} component={AccountScreen} />
      <Tab.Screen name={Screens.DEBUG} component={DebugScreen} />
    </Tab.Navigator>
  )
}

export default HomeTabs
