import React from 'react'

import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {Theme} from '@styles/theme'

import AddFoodScreen from '@screens/AddFood'
import CreateFoodScreen from '@screens/CreateFood'
import FoodDetailScreen from '@screens/FoodDetail'
import GroceryListScreen from '@screens/GroceryList'
import LogPlannedMealScreen from '@screens/LogPlannedMeal'
import LogWithAIScreen from '@screens/LogWithAI'
import MacrosScreen from '@screens/Macros'
import MacrosHistoryScreen from '@screens/MacrosHistory'
import MealPlanAboutYouScreen from '@screens/MealPlanAboutYou'
import MealPlanActivityScreen from '@screens/MealPlanActivity'
import MealPlanCookingBudgetScreen from '@screens/MealPlanCookingBudget'
import MealPlanDietScreen from '@screens/MealPlanDiet'
import MealPlanEditTargetsScreen from '@screens/MealPlanEditTargets'
import MealPlanFoodPreferencesScreen from '@screens/MealPlanFoodPreferences'
import MealPlanFoodSearchScreen from '@screens/MealPlanFoodSearch'
import MealPlanGeneratingScreen from '@screens/MealPlanGenerating'
import MealPlanGoalScreen from '@screens/MealPlanGoal'
import MealPlanIntroScreen from '@screens/MealPlanIntro'
import MealPlanScheduleScreen from '@screens/MealPlanSchedule'
import MealPlanTargetsScreen from '@screens/MealPlanTargets'
import PlanSettingsScreen from '@screens/PlanSettings'
import RecipeDetailScreen from '@screens/RecipeDetail'
import SwapMealScreen from '@screens/SwapMeal'
import SwapPreviewScreen from '@screens/SwapPreview'

import MealPlanSetupProvider, {useMealPlanSetupDraft} from '@components/MealPlanSetupProvider'

import Screens from '@constants/screens'

const Stack = createNativeStackNavigator()

// Split from MacrosStack because a component cannot consume the context it provides, and this
// navigator needs the draft action below.
const MacrosNavigator = (): React.JSX.Element => {
  const {resetDraft} = useMealPlanSetupDraft()

  return (
    <Stack.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: {backgroundColor: Theme.colors.background},
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

      <Stack.Screen name={Screens.MEAL_PLAN_INTRO} component={MealPlanIntroScreen} options={{headerShown: false}} />

      <Stack.Screen name={Screens.MEAL_PLAN_GOAL} component={MealPlanGoalScreen} options={{headerShown: false}} />

      <Stack.Screen
        name={Screens.MEAL_PLAN_ABOUT_YOU}
        component={MealPlanAboutYouScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_ACTIVITY}
        component={MealPlanActivityScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen name={Screens.MEAL_PLAN_DIET} component={MealPlanDietScreen} options={{headerShown: false}} />

      <Stack.Screen
        name={Screens.MEAL_PLAN_FOOD_PREFERENCES}
        component={MealPlanFoodPreferencesScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_FOOD_SEARCH}
        component={MealPlanFoodSearchScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_SCHEDULE}
        component={MealPlanScheduleScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_COOKING_BUDGET}
        component={MealPlanCookingBudgetScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen name={Screens.MEAL_PLAN_TARGETS} component={MealPlanTargetsScreen} options={{headerShown: false}} />

      <Stack.Screen
        name={Screens.MEAL_PLAN_EDIT_TARGETS}
        component={MealPlanEditTargetsScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen
        name={Screens.MEAL_PLAN_GENERATING}
        component={MealPlanGeneratingScreen}
        options={{headerShown: false}}
      />

      <Stack.Screen name={Screens.RECIPE_DETAIL} component={RecipeDetailScreen} options={{headerShown: false}} />

      <Stack.Screen name={Screens.SWAP_MEAL} component={SwapMealScreen} options={{headerShown: false}} />

      <Stack.Screen name={Screens.SWAP_PREVIEW} component={SwapPreviewScreen} options={{headerShown: false}} />

      <Stack.Screen name={Screens.GROCERY_LIST} component={GroceryListScreen} options={{headerShown: false}} />

      <Stack.Screen name={Screens.LOG_PLANNED_MEAL} component={LogPlannedMealScreen} options={{headerShown: false}} />

      <Stack.Screen name={Screens.PLAN_SETTINGS} component={PlanSettingsScreen} options={{headerShown: false}} />
    </Stack.Navigator>
  )
}

// The meal-plan setup draft is provided around the navigator, not inside a wizard screen: the
// seven steps are separate routes, so a provider mounted on one of them would drop every answer
// the moment the user continued to the next. See the lifecycle note in MealPlanSetupProvider.
const MacrosStack = (): React.JSX.Element => {
  return (
    <MealPlanSetupProvider>
      <MacrosNavigator />
    </MealPlanSetupProvider>
  )
}

export default MacrosStack
