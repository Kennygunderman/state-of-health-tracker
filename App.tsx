import React, {useEffect, useMemo} from 'react'

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

import styles from './App.styled'
import GlobalBottomSheet from './src/components/GlobalBottomSheet'
import MinimumVersionSheet from './src/components/MinimumVersionSheet'
import ToastConfig from './src/components/toast/ToastConfig'
import AuthStack from './src/navigation/AuthStack'
import HomeTabs from './src/navigation/HomeTabs'
import {
  discardForeignPersistedQueryCaches,
  purgeLegacyQueryCache,
  queryClient,
  sessionCacheBindingFor
} from './src/queries/queryClient'
import authService from './src/service/auth/AuthService'
import useAuthStore from './src/store/auth/useAuthStore'
import {useSessionStore} from './src/store/session/useSessionStore'

const Stack = createNativeStackNavigator()

LogBox.ignoreAllLogs(true)

const App = (): React.JSX.Element => {
  const {isAuthed, userId} = useAuthStore()

  useEffect(() => {
    SplashScreen.hideAsync()
  }, [])

  // Earlier builds kept one device-wide cache blob. Nothing reads it now that a cache is keyed by
  // account, so it belongs to whichever account signed in here last and leaves the device at the
  // first launch after this change. A failed removal is reported, never thrown: it must not be the
  // reason the app fails to start.
  useEffect(() => {
    purgeLegacyQueryCache().catch(error => {
      console.error('Failed to remove the legacy device-wide persisted query cache:', error)
    })
  }, [])

  // The partition of the account being replaced is removed as the account changes, but that removal
  // is started rather than awaited, so a process that dies in between can leave it on disk. Sweeping
  // every other partition once an account is known is what makes the removal unconditional. It is
  // skipped while no identity exists, because at launch the app renders before Firebase has restored
  // its session and this account's own cache is exactly what must survive that moment.
  useEffect(() => {
    if (userId === null) {
      return
    }

    discardForeignPersistedQueryCaches(userId).catch(error => {
      console.error("Failed to remove another account's persisted query cache:", error)
    })
  }, [userId])

  // The session tree belongs to one account: `sessionKey` is its React identity, so the subtree is
  // recreated when the account changes, and `persistOptions` reads and writes that account's cache
  // partition alone. They are derived together (see sessionCacheBindingFor) because mounting one
  // account's persister under another account's tree is the leak both guards exist to prevent.
  const {sessionKey, persistOptions} = useMemo(() => sessionCacheBindingFor(userId), [userId])

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
    <PersistQueryClientProvider key={sessionKey} client={queryClient} persistOptions={persistOptions}>
      <GestureHandlerRootView style={styles.gestureRoot}>
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
