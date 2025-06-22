import React from 'react';
import { Ionicons } from '@expo/vector-icons';
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
import store, { useThunkDispatch } from './src/store';
import { addDailyMealEntry } from './src/store/dailyMealEntries/DailyMealEntriesActions';
import { syncUserData } from './src/store/user/UserActions';
import { setCurrentDate } from './src/store/userInfo/UserInfoActions';
import { darkTheme, useStyleTheme } from './src/styles/Theme';
import { getCurrentDate } from './src/utility/DateUtility';
import GlobalBottomSheet from "./src/components/GlobalBottomSheet";
import AuthStack from "./src/navigation/AuthStack";
import HomeTabs from "./src/navigation/HomeTabs";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

LogBox.ignoreAllLogs(true);

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
  return (
    <Provider store={store}>
      <StatusBar barStyle="light-content"/>
      <AppStateChanged/>
      <NavigationContainer theme={darkTheme}>
        <Stack.Navigator
          initialRouteName={Screens.MEALS}
          screenOptions={({ navigation }) => ({
            headerLeft: () => (
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Ionicons name="chevron-back" size={24} color={useStyleTheme().colors.white}/>
              </TouchableOpacity>
            )
          })}
        >
          <Stack.Screen
            name="Home"
            component={HomeTabs}
            options={{ headerShown: false }}
          />

          <Stack.Screen name="Auth" component={AuthStack} options={{ headerShown: false }}/>

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
