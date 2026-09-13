import React from 'react'

import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {Theme} from '@styles/theme'

import AddFoodScreen from '@screens/AddFood'
import CreateFoodScreen from '@screens/CreateFood'
import FoodDetailScreen from '@screens/FoodDetail'
import LogWithAIScreen from '@screens/LogWithAI'
import MacrosScreen from '@screens/Macros'
import MacrosHistoryScreen from '@screens/MacrosHistory'

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
