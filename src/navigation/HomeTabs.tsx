import React, { useEffect } from 'react';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useStyleTheme } from '../styles/Theme';
import Screens from '../constants/Screens';
import { MACROS_TITLE } from '../constants/Strings';

import MealsStack from './MealsStack';
import WorkoutsStack from './WorkoutsStack';
import AccountScreen from '../screens/Account/AccountScreen';
import DebugScreen from '../screens/debug/DebugScreen';
import { useNavigation } from "@react-navigation/native";
import { Navigation } from "./types";
import { getUserId } from "../service/auth/userStorage";

const Tab = createBottomTabNavigator();

const HomeTabs = () => {
  const theme = useStyleTheme();

  const { push } = useNavigation<Navigation>();

  useEffect(() => {
    getUserId().then((id) => {
      if (!id) {
        push('Auth', { screen: Screens.LOG_IN });
      }
    })
  }, []);

  const macrosIcon = (color: string) => (
    <FontAwesome5 name="utensils" size={16} color={color} style={{ marginBottom: -3 }} />
  );

  const barbellIcon = (color: string) => (
    <Ionicons name="barbell" size={24} color={color} style={{ marginBottom: -3 }} />
  );

  const accountIcon = (color: string) => (
    <MaterialCommunityIcons name="account" size={24} color={color} style={{ marginBottom: -3 }} />
  );

  const debugIcon = (color: string) => (
    <MaterialCommunityIcons name="desktop-mac" size={24} color={color} style={{ marginBottom: -3 }} />
  );

  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: theme.colors.background }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          if (route.name === Screens.MEALS) return macrosIcon(color);
          if (route.name === Screens.WORKOUTS) return barbellIcon(color);
          if (route.name === Screens.ACCOUNT) return accountIcon(color);
          if (route.name === Screens.DEBUG) return debugIcon(color);
        },
        headerShown: false,
        tabBarActiveTintColor: theme.colors.white,
        tabBarInactiveTintColor: theme.colors.grey,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: theme.colors.navBar,
        },
      })}
    >
      <Tab.Screen name={Screens.MEALS} component={MealsStack} options={{ title: MACROS_TITLE }} />
      <Tab.Screen name={Screens.WORKOUTS} component={WorkoutsStack} />
      <Tab.Screen name={Screens.ACCOUNT} component={AccountScreen} />
      <Tab.Screen name={Screens.DEBUG} component={DebugScreen} />
    </Tab.Navigator>
  );
};

export default HomeTabs;
