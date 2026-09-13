import React, {useEffect, useMemo} from 'react'

import {AppState, LogBox, StatusBar, TouchableOpacity} from 'react-native'

import {Ionicons} from '@expo/vector-icons'
import {NavigationContainer} from '@react-navigation/native'
import {createNativeStackNavigator} from '@react-navigation/native-stack'
import {Theme} from '@styles/theme'
import {PersistQueryClientProvider, PersistQueryClientProviderProps} from '@tanstack/react-query-persist-client'
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
  PERSISTED_QUERY_KEYS,
  purgeLegacyQueryCache,
  queryCachePersisterFor,
  queryClient
} from './src/queries/queryClient'
import authService from './src/service/auth/AuthService'
import useAuthStore from './src/store/auth/useAuthStore'
import {useSessionStore} from './src/store/session/useSessionStore'

const Stack = createNativeStackNavigator()

// The React key of the session tree while nobody is signed in. Any value works as long as it cannot
// collide with a Firebase uid, which is what the signed-in branch keys by.
const SIGNED_OUT_SESSION_KEY = 'signed-out'

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

  // Restore is deferred until an identity exists (queryCachePersisterFor(null) stores and restores
  // nothing) and then reads only that account's partition. `buster` is the second guard behind the
  // key: a payload written by another account is removed by restore instead of hydrated.
  const persistOptions = useMemo<PersistQueryClientProviderProps['persistOptions']>(
    () => ({
      persister: queryCachePersisterFor(userId),
      buster: userId ?? '',
      dehydrateOptions: {
        // Only whitelisted queries are written to the device — see queryClient.ts
        shouldDehydrateQuery: query => PERSISTED_QUERY_KEYS.includes(String(query.queryKey[0]))
      }
    }),
    [userId]
  )

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

  // The signed-in uid is the identity of everything below it, so React recreates this whole subtree
  // when the account changes — not only when someone signs out. Signing in as a different user
  // without a signed-out render in between (Firebase delivers that as one uid replacing another)
  // would otherwise leave the previous account's data in places a store reset cannot reach: the
  // meal-plan setup draft held in React Context (age, weight, diet, allergies, schedule, budget) and
  // the navigation state, whose route params carry that account's plan, meal and recipe ids.
  return (
    <PersistQueryClientProvider
      key={userId ?? SIGNED_OUT_SESSION_KEY}
      client={queryClient}
      persistOptions={persistOptions}>
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
