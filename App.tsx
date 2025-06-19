import React from 'react';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  AppState, LogBox, StatusBar, TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from 'react-redux';
import ToastConfig from './src/components/toast/ToastConfig';
import Screens from './src/constants/Screens';
import {
  MACROS_TITLE,
  NEW_FOOD_ITEM_TEXT,
  PREVIOUS_ENTRIES_TITLE,
  PREVIOUS_WORKOUTS_TITLE,
  QUICK_ADD_FOOD_SCREEN_TITLE,
} from './src/constants/Strings';
import AccountScreen from './src/screens/Account/AccountScreen';
import AddFoodScreen from './src/screens/AddFoodScreen';
import LogInScreen from './src/screens/Auth/LogInScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';
import CreateExerciseScreen from './src/screens/CreateExercise';
import CreateFoodScreen from './src/screens/CreateFoodScreen';
import FoodDetailScreen from './src/screens/FoodDetailScreen';
import MealsScreen from './src/screens/Meals/MealsScreen';
import PreviousDailyExerciseEntriesScreen
  from './src/screens/PreviousDailyExercises/PreviousDailyExerciseEntriesScreen';
import PreviousDailyMealEntriesScreen from './src/screens/PreviousDailyMealEntriesScreen';
import WorkoutsScreen from './src/screens/Workouts/WorkoutsScreen';
import WorkoutTemplateDetailScreen from './src/screens/TemplateDetail';
import store, { useThunkDispatch } from './src/store';
import { addDailyMealEntry } from './src/store/dailyMealEntries/DailyMealEntriesActions';
import { syncUserData } from './src/store/user/UserActions';
import { setCurrentDate } from './src/store/userInfo/UserInfoActions';
import { darkTheme, useStyleTheme } from './src/styles/Theme';
import { getCurrentDate } from './src/utility/DateUtility';
import AddExerciseScreen from "./src/screens/AddExercise";
import GlobalBottomSheet from "./src/components/GlobalBottomSheet";
import DebugScreen from "./src/screens/debug/DebugScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

LogBox.ignoreAllLogs(true);

const Home = () => {
  const macrosIcon = (color: string) => (
    <FontAwesome5
      name="utensils"
      color={color}
      size={16}
      style={{ marginBottom: -3 }}
    />
  );

  const barbellIcon = (color: string) => (
    <Ionicons
      name="barbell"
      color={color}
      size={24}
      style={{ marginBottom: -3 }}
    />
  );

  const accountIcon = (color: string) => (
    <MaterialCommunityIcons
      name="account"
      size={24}
      color={color}
      style={{ marginBottom: -3 }}
    />
  );

  const debugIcon = (color: string) => (
    <MaterialCommunityIcons
      name="desktop-mac"
      size={24}
      color={color}
      style={{ marginBottom: -3 }}
    />
  );

  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: useStyleTheme().colors.background }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color }) => {
          if (route.name === Screens.MEALS) {
            return macrosIcon(color);
          }
          if (route.name === Screens.WORKOUTS) {
            return barbellIcon(color);
          }
          if (route.name === Screens.ACCOUNT) {
            return accountIcon(color);
          }

          if (route.name === Screens.DEBUG) {
            return debugIcon(color);
          }
        },
        headerShown: false,
        tabBarActiveTintColor: useStyleTheme().colors.white,
        tabBarInactiveTintColor: useStyleTheme().colors.grey,
        tabBarStyle: {
          borderTopWidth: 0,
          backgroundColor: useStyleTheme().colors.navBar,
        },
      })}
    >
      {/* <Tab.Screen name={Screens.MEALS} options={{ title: MACROS_TITLE }} component={MealsScreen} /> */}
      <Tab.Screen name={Screens.WORKOUTS} component={WorkoutsScreen}/>
      <Tab.Screen name={Screens.ACCOUNT} component={AccountScreen}/>
      <Tab.Screen name={Screens.DEBUG} component={DebugScreen}/>
    </Tab.Navigator>
  );
};

const AppStateChanged = () => {
  const dispatch = useThunkDispatch();

  async function onApplicationStateChange(appState: string) {
    if (appState === 'active') {
      const currentDate = getCurrentDate();
      dispatch(setCurrentDate(currentDate));
      dispatch(addDailyMealEntry(currentDate));
      dispatch(syncUserData());
    }
  }

  dispatch(syncUserData());

  AppState.addEventListener('change', onApplicationStateChange);
  // eslint-disable-next-line react/jsx-no-useless-fragment
  return (<></>);
};

const App = () => {
  const backButton = (onPress: () => void) => (
    <TouchableOpacity onPress={onPress}>
      <Ionicons name="chevron-back" size={24} color={useStyleTheme().colors.white}/>
    </TouchableOpacity>
  );

  const closeButton = (onPress: () => void) => (
    <TouchableOpacity onPress={onPress}>
      <Ionicons name="close" size={24} color={useStyleTheme().colors.white}/>
    </TouchableOpacity>
  );
  return (
    <Provider store={store}>
      <StatusBar barStyle="light-content"/>
      <AppStateChanged/>
      <NavigationContainer theme={darkTheme}>
        <Stack.Navigator
          initialRouteName={Screens.MEALS}
          screenOptions={({
                            navigation,
                            route
                          }) => ({
            headerLeft: () => {
              if (route.name === Screens.MEALS) {
                return;
              }

              return backButton(() => navigation.goBack());
            },
            headerShown: route.name !== Screens.MEALS,
            headerStyle: {
              backgroundColor: useStyleTheme().colors.background,
            },
            headerShadowVisible: false,
            headerTintColor: useStyleTheme().colors.white,
          })}
        >
          <Stack.Screen
            name="Home"
            component={Home}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name={Screens.ADD_FOOD}
            options={{
              title: QUICK_ADD_FOOD_SCREEN_TITLE,
              headerStyle: {
                backgroundColor: useStyleTheme().colors.secondary,
              },
            }}
            component={AddFoodScreen}
          />

          <Stack.Group screenOptions={({ navigation }) => ({
            headerLeft: () => (
              closeButton(() => navigation.goBack())
            ),
            presentation: 'modal',
          })}
          >
            <Stack.Screen name={Screens.LOG_IN} component={LogInScreen}/>
            <Stack.Screen name={Screens.REGISTER} component={RegisterScreen}/>
          </Stack.Group>

          <Stack.Screen name={Screens.FOOD_DETAIL_SCREEN} component={FoodDetailScreen}/>

          <Stack.Screen
            name={Screens.CREATE_FOOD}
            options={{ title: NEW_FOOD_ITEM_TEXT }}
            component={CreateFoodScreen}
          />
          <Stack.Screen
            name={Screens.PREVIOUS_DAILY_MEAL_ENTRIES}
            options={{ title: PREVIOUS_ENTRIES_TITLE }}
            component={PreviousDailyMealEntriesScreen}
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
          <Stack.Screen name={Screens.WORKOUT_TEMPLATE_DETAIL} component={WorkoutTemplateDetailScreen}/>
          <Stack.Screen name={Screens.CREATE_EXERCISE} component={CreateExerciseScreen}/>
          <Stack.Screen
            name={Screens.PREVIOUS_DAILY_EXERCISE_ENTRIES}
            options={{ title: PREVIOUS_WORKOUTS_TITLE }}
            component={PreviousDailyExerciseEntriesScreen}
          />

        </Stack.Navigator>
        <GlobalBottomSheet/>
        <Toast
          config={ToastConfig}
          position="top"
          topOffset={50}
        />
      </NavigationContainer>
    </Provider>
  );
};

export default App;
