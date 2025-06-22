import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  AppState, LogBox, StatusBar, TouchableOpacity, View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from 'react-redux';
import ToastConfig from './src/components/toast/ToastConfig';
import store, { useThunkDispatch } from './src/store';
import { addDailyMealEntry } from './src/store/dailyMealEntries/DailyMealEntriesActions';
import { syncUserData } from './src/store/user/UserActions';
import { setCurrentDate } from './src/store/userInfo/UserInfoActions';
import { darkTheme, useStyleTheme } from './src/styles/Theme';
import { getCurrentDate } from './src/utility/DateUtility';
import GlobalBottomSheet from "./src/components/GlobalBottomSheet";
import AuthStack from "./src/navigation/AuthStack";
import HomeTabs from "./src/navigation/HomeTabs";
import useAuthStore from "./src/store/auth/useAuthStore";

const Stack = createNativeStackNavigator();

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

  const { isAuthed } = useAuthStore();

  const backButton = (onPress: () => void) => {
    return (
      <TouchableOpacity onPress={onPress}>
        <Ionicons name="chevron-back" size={24} color={useStyleTheme().colors.white}/>
      </TouchableOpacity>
    )
  }

  return (
    <Provider store={store}>
      <StatusBar barStyle="light-content"/>
      <AppStateChanged/>
      <NavigationContainer
        theme={darkTheme}
      >
        {
          !isAuthed ? (
            <Stack.Navigator
              initialRouteName={'Auth'}
              screenOptions={({ navigation }) => ({
                headerLeft: () => backButton(() => navigation.goBack()),
              })}
            >
              <Stack.Screen
                name="Auth"
                component={AuthStack}
                options={{
                  title: '',
                  gestureEnabled: false,
                  headerShown: false,
                  presentation: "modal"
                }}
              />

            </Stack.Navigator>
          ) : (
            <Stack.Navigator
              initialRouteName={'Home'}
              screenOptions={({ navigation }) => ({
                headerLeft: () => backButton(() => navigation.goBack()),
              })}
            >
              <Stack.Screen
                name="Home"
                component={HomeTabs}
                options={{
                  animation: 'fade',
                  headerShown: false
                }}
              />
            </Stack.Navigator>
          )
        }

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
