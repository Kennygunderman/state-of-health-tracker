import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutsScreen from '../screens/Workouts';
import CreateExerciseScreen from '../screens/CreateExercise';
import CreateTemplateScreen from '../screens/CreateTemplate';
import SearchExercisesScreen from '../screens/SearchExercises';
import WorkoutTemplateDetailScreen from '../screens/TemplateDetail';
import PreviousWorkoutEntries from '../screens/PreviousWorkoutEntries';
import { useStyleTheme } from "../styles/Theme";
import AddExerciseScreen from "../screens/AddExercise";

import Screens from "../constants/Screens";
import { PREVIOUS_WORKOUTS_TITLE } from "../constants/Strings";

const Stack = createNativeStackNavigator();

const WorkoutsStack = () => {
  const theme = useStyleTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerBackTitleVisible: false,
        headerStyle: { backgroundColor: theme.colors.background },
        headerTintColor: theme.colors.white,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name={Screens.WORKOUTS}
        component={WorkoutsScreen}
      />

      <Stack.Screen
        name={Screens.CREATE_EXERCISE}
        component={CreateExerciseScreen}
      />

      <Stack.Screen
        options={{
          headerStyle: {
            backgroundColor: useStyleTheme().colors.secondary,
          },
        }}
        name={Screens.ADD_EXERCISE}
        component={AddExerciseScreen}
      />


      <Stack.Screen
        options={{
          headerStyle: {
            backgroundColor: useStyleTheme().colors.secondary,
          },
        }}
        name={Screens.CREATE_TEMPLATE}
        component={CreateTemplateScreen}
      />


      <Stack.Screen
        options={{
          headerStyle: {
            backgroundColor: useStyleTheme().colors.secondary,
          },
        }}
        name={Screens.SEARCH_EXERCISES}
        component={SearchExercisesScreen}
      />

      <Stack.Screen
        name={Screens.WORKOUT_TEMPLATE_DETAIL}
        component={WorkoutTemplateDetailScreen}
      />

      <Stack.Screen
        name={Screens.PREVIOUS_DAILY_EXERCISE_ENTRIES}
        options={{ title: PREVIOUS_WORKOUTS_TITLE }}
        component={PreviousWorkoutEntries}
      />

    </Stack.Navigator>
  );
}

export default WorkoutsStack;
