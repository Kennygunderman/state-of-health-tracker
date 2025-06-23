import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  AppState, LogBox, StatusBar, TouchableOpacity,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from 'react-redux';
import ToastConfig from './src/components/toast/ToastConfig';
import store, { useThunkDispatch } from './src/store';
import { syncUserData } from './src/store/user/UserActions';
import { darkTheme, useStyleTheme } from './src/styles/Theme';
import GlobalBottomSheet from "./src/components/GlobalBottomSheet";
import AuthStack from "./src/navigation/AuthStack";
import HomeTabs from "./src/navigation/HomeTabs";
import useAuthStore from "./src/store/auth/useAuthStore";

const Stack = createNativeStackNavigator();

LogBox.ignoreAllLogs(true);

const AppStateChanged = () => {
  const dispatch = useThunkDispatch();
  const { userId, isAuthed } = useAuthStore();

  async function onApplicationStateChange(appState: string) {
    if (appState === 'active') {
      if (isAuthed && userId) {
        dispatch(syncUserData(userId));
      }
    }
  }

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
