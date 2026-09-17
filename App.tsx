import React, {useEffect} from 'react'

import {AppState, LogBox, StatusBar, TouchableOpacity} from 'react-native'

import {Ionicons} from '@expo/vector-icons'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {Theme} from '@styles/theme'
import {PersistQueryClientProvider} from '@tanstack/react-query-persist-client'
import * as SplashScreen from 'expo-splash-screen'
import {GestureHandlerRootView} from 'react-native-gesture-handler'
import {ReducedMotionConfig, ReduceMotion} from 'react-native-reanimated'
import {initialWindowMetrics, SafeAreaProvider} from 'react-native-safe-area-context'
import Toast from 'react-native-toast-message'

import GlobalBottomSheet from './src/components/GlobalBottomSheet'
import MinimumVersionSheet from './src/components/MinimumVersionSheet'
import ToastConfig from './src/components/toast/ToastConfig'
import AuthStack from './src/navigation/AuthStack'
import HomeTabs from './src/navigation/HomeTabs'
import {asyncStoragePersister, PERSISTED_QUERY_KEYS, queryClient} from './src/queries/queryClient'
import authService from './src/service/auth/AuthService'
import useAuthStore from './src/store/auth/useAuthStore'
import {useSessionStore} from './src/store/session/useSessionStore'

const Stack = createNativeStackNavigator()

LogBox.ignoreAllLogs(true)

const App = () => {
  const {isAuthed} = useAuthStore()

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  // Keep the auth store in sync with Firebase's async auth state — cold-start
  // session restore and remote sign-outs both land here
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuthChanges(user => {
      useAuthStore.getState().syncAuthState(user)
    })

    return unsubscribe
  }, [])

  // "Today" is captured when the JS bundle loads; an app resumed after
  // midnight must re-evaluate it or meals/sets get attributed to the old day
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        useSessionStore.getState().refreshSessionDate()
      }
    })

    return () => subscription.remove()
  }, [])

  const backButton = (onPress: () => void) => {
    return (
      <TouchableOpacity onPress={onPress}>
        <Ionicons name="chevron-back" size={24} color={Theme.colors.white} />
      </TouchableOpacity>
    )
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: asyncStoragePersister,
        dehydrateOptions: {
          // Only whitelisted queries are written to the device — see queryClient.ts
          shouldDehydrateQuery: query => PERSISTED_QUERY_KEYS.includes(String(query.queryKey[0]))
        }
      }}>
      <GestureHandlerRootView style={{flex: 1}}>
        {/* System Reduce Motion leaves entering-animated views stuck invisible
            on Reanimated 4 (blank Macros/Workouts screens); our animations are
            short fades, so run them regardless of the OS setting */}
        <ReducedMotionConfig mode={ReduceMotion.Never} />

        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <StatusBar barStyle="light-content" />

          <NavigationContainer theme={Theme}>
            {!isAuthed ? (
              <Stack.Navigator
                initialRouteName={'Auth'}
                screenOptions={({navigation}) => ({
                  headerLeft: () => backButton(() => navigation.goBack())
                })}>
                <Stack.Screen
                  name="Auth"
                  component={AuthStack}
                  options={{
                    title: '',
                    gestureEnabled: false,
                    headerShown: false,
                    presentation: 'modal'
                  }}
                />
              </Stack.Navigator>
            ) : (
              <Stack.Navigator
                initialRouteName={'Home'}
                screenOptions={({navigation}) => ({
                  headerLeft: () => backButton(() => navigation.goBack())
                })}>
                <Stack.Screen
                  name="Home"
                  component={HomeTabs}
                  options={{
                    animation: 'fade',
                    headerShown: false
                  }}
                />
              </Stack.Navigator>
            )}

            <GlobalBottomSheet />

            <MinimumVersionSheet />

            <Toast config={ToastConfig} position="top" topOffset={50} />
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  )
}

export default App
