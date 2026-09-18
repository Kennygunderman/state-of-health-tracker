import React from 'react'

import {RootStackParamList} from '@navigation/types'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {Theme} from '@styles/theme'

import AddFoodScreen from '@screens/AddFood'
import CreateFoodScreen from '@screens/CreateFood'
import FoodDetailScreen from '@screens/FoodDetail'
import LogWithAIScreen from '@screens/LogWithAI'
import MacrosScreen from '@screens/Macros'
import MacrosHistoryScreen from '@screens/MacrosHistory'

import {useMealPlanSetupActions} from '@components/MealPlanSetupProvider'

import Screens from '@constants/screens'

import styles from './MacrosRoutesStack.styled'

// The 18 meal-planning routes are registered through React Navigation's `getComponent` boundary, which
// defers a screen's module until that route is first rendered. Deferring is the whole point, so the module
// has to be fetched at call time — a static import would put all 18 feature screens (and everything they
// pull in) into the startup bundle of a tab that loads with the app. No other require exists in this file,
// so the disable covers nothing but those 18 registrations.
/* eslint-disable @typescript-eslint/no-var-requires */

const Stack = createNativeStackNavigator<RootStackParamList>()

// The route registrations live here rather than in MacrosStack because a component cannot consume the
// context it provides, and this stack needs the draft action below. MacrosStack stays the module HomeTabs
// mounts; this one holds the routes.
//
// Deliberately the actions hook and not useMealPlanSetupDraft: the actions never change identity, whereas
// reading the draft here would re-render this navigator — and with it every screen it declares — on each
// keystroke of a wizard field.
const MacrosRoutesStack = (): React.JSX.Element => {
  const {resetDraft} = useMealPlanSetupActions()

  return (
    <Stack.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: styles.header,
        headerTintColor: Theme.colors.white,
        headerShadowVisible: false
      }}>
      {/* The Macros root regaining focus means no setup route is left on this stack, which is how
          a wizard session ends whether the user generated a plan or tapped 'Not now'. Clearing
          here is what keeps a finished or abandoned draft from being reused by a later visit in
          the same app session; every answered step is already on the server, so re-entering the
          wizard seeds from setup_step rather than from this draft. Clearing an untouched draft is
          a no-op, so the ordinary case of returning from Add food costs nothing. */}
      <Stack.Screen
        name={Screens.MACROS}
        component={MacrosScreen}
        options={{headerShown: false}}
        listeners={{focus: () => resetDraft('flow_exited')}}
      />

      <Stack.Screen name={Screens.ADD_FOOD} component={AddFoodScreen} options={{title: ''}} />

      <Stack.Screen name={Screens.FOOD_DETAIL_SCREEN} component={FoodDetailScreen} options={{title: ''}} />

      <Stack.Screen name={Screens.CREATE_FOOD} component={CreateFoodScreen} options={{title: ''}} />

      <Stack.Screen name={Screens.LOG_WITH_AI} component={LogWithAIScreen} options={{title: ''}} />

      <Stack.Screen name={Screens.MACROS_HISTORY} component={MacrosHistoryScreen} options={{title: ''}} />

      <Stack.Screen
        name={Screens.MEAL_PLAN_INTRO}
        getComponent={() => require('@screens/MealPlanIntro').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_GOAL}
        getComponent={() => require('@screens/MealPlanGoal').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_ABOUT_YOU}
        getComponent={() => require('@screens/MealPlanAboutYou').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_ACTIVITY}
        getComponent={() => require('@screens/MealPlanActivity').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_DIET}
        getComponent={() => require('@screens/MealPlanDiet').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_FOOD_PREFERENCES}
        getComponent={() => require('@screens/MealPlanFoodPreferences').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_FOOD_SEARCH}
        getComponent={() => require('@screens/MealPlanFoodSearch').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_SCHEDULE}
        getComponent={() => require('@screens/MealPlanSchedule').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_COOKING_BUDGET}
        getComponent={() => require('@screens/MealPlanCookingBudget').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_TARGETS}
        getComponent={() => require('@screens/MealPlanTargets').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_EDIT_TARGETS}
        getComponent={() => require('@screens/MealPlanEditTargets').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_GENERATING}
        getComponent={() => require('@screens/MealPlanGenerating').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.RECIPE_DETAIL}
        getComponent={() => require('@screens/RecipeDetail').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.SWAP_MEAL}
        getComponent={() => require('@screens/SwapMeal').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.SWAP_PREVIEW}
        getComponent={() => require('@screens/SwapPreview').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.GROCERY_LIST}
        getComponent={() => require('@screens/GroceryList').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.LOG_PLANNED_MEAL}
        getComponent={() => require('@screens/LogPlannedMeal').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />

      <Stack.Screen
        name={Screens.PLAN_SETTINGS}
        getComponent={() => require('@screens/PlanSettings').default}
        options={{headerShown: false, freezeOnBlur: true}}
      />
    </Stack.Navigator>
  )
}

export default MacrosRoutesStack
