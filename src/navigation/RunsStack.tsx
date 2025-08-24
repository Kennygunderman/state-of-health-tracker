import React from 'react'

import {createNativeStackNavigator} from '@react-navigation/native-stack'

import {useStyleTheme} from '@theme/Theme'

import ActiveRunScreen from '@screens/ActiveRun'
import RunFlowScreen from '@screens/RunFlow'
import RunHistoryScreen from '@screens/RunHistory'
import RunSummaryScreen from '@screens/RunSummary'

export type RunsStackParamList = {
  RunHistory: undefined
  RunFlow: undefined
  ActiveRun: undefined
  RunSummary: {runId: string}
}

const Stack = createNativeStackNavigator<RunsStackParamList>()

const RunsStack = () => {
  const theme = useStyleTheme()

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.primary
        },
        headerTintColor: theme.colors.white,
        headerTitleStyle: {
          fontWeight: 'bold',
          color: theme.colors.white
        }
      }}>
      <Stack.Screen
        name="RunHistory"
        component={RunHistoryScreen}
        options={{
          title: 'Runs',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="RunFlow"
        component={RunFlowScreen}
        options={{
          title: 'Run Tracker',
          headerShown: true
        }}
      />
      <Stack.Screen
        name="ActiveRun"
        component={ActiveRunScreen}
        options={{
          title: 'Run in Progress',
          headerShown: true,
          gestureEnabled: false // Prevent swipe back during active run
        }}
      />
      <Stack.Screen
        name="RunSummary"
        component={RunSummaryScreen}
        options={{
          title: 'Run Summary',
          headerShown: true
        }}
      />
    </Stack.Navigator>
  )
}

export default RunsStack
