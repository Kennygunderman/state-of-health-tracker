import React from 'react'

import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {useStyleTheme} from '@theme/Theme'

import AddFoodScreen from '@screens/AddFoodScreen'
import CreateFoodScreen from '@screens/CreateFoodScreen'
import FoodDetailScreen from '@screens/FoodDetailScreen'
import MealsScreen from '@screens/Meals/MealsScreen'
import PreviousDailyMealEntriesScreen from '@screens/PreviousDailyMealEntriesScreen'

import Screens from '@constants/Screens'
import {MACROS_TITLE, NEW_FOOD_ITEM_TEXT, PREVIOUS_ENTRIES_TITLE, QUICK_ADD_FOOD_SCREEN_TITLE} from '@constants/Strings'

const Stack = createNativeStackNavigator()

const MealsStack = () => {
  const theme = useStyleTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        headerStyle: {backgroundColor: theme.colors.background},
        headerTintColor: theme.colors.white,
        headerShadowVisible: false
      }}>
      <Stack.Screen name={Screens.MEALS} component={MealsScreen} options={{title: MACROS_TITLE}} />

      <Stack.Screen
        name={Screens.ADD_FOOD}
        component={AddFoodScreen}
        options={{
          title: QUICK_ADD_FOOD_SCREEN_TITLE,
          headerStyle: {backgroundColor: theme.colors.secondary}
        }}
      />

      <Stack.Screen name={Screens.CREATE_FOOD} component={CreateFoodScreen} options={{title: NEW_FOOD_ITEM_TEXT}} />

      <Stack.Screen options={{title: ''}} name={Screens.FOOD_DETAIL_SCREEN} component={FoodDetailScreen} />

      <Stack.Screen
        name={Screens.PREVIOUS_DAILY_MEAL_ENTRIES}
        component={PreviousDailyMealEntriesScreen}
        options={{title: PREVIOUS_ENTRIES_TITLE}}
      />
    </Stack.Navigator>
  )
}

export default MealsStack
