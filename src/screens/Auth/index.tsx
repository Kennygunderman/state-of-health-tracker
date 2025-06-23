import {useEffect, useState} from 'react'

import {Alert, View, Image} from 'react-native'
import {Subject} from 'rxjs'

import Screens from '@constants/Screens'
import {OKAY_BUTTON_TEXT} from '@constants/Strings'
import {useNavigation} from '@react-navigation/native'
import {useStyleTheme} from '@theme/Theme'

import {AuthEvent, authEventType} from '../../data/types/authEvent'
import {authStatus} from '../../data/types/authStatus'
import {Navigation} from '../../navigation/types'
import useAuthStore from '../../store/auth/useAuthStore'

import styles from './index.styled'

export const AuthSubject$ = new Subject<AuthEvent>()

const RootAuthScreen = () => {
  const {replace, push} = useNavigation<Navigation>()

  const theme = useStyleTheme()

  const [isRendered, setIsRendered] = useState(false)

  const {initAuth} = useAuthStore()

  useEffect(() => {
    if (isRendered) {
      initAuth()
    }
  }, [isRendered])

  useEffect(() => {
    const subscription = AuthSubject$.subscribe({
      next: (event: AuthEvent) => {
        if (event.type === authEventType.Error) {
          Alert.alert(event.error.errorPath, event.error.errorMessage, [
            {
              text: OKAY_BUTTON_TEXT
            }
          ])
        } else {
          if (event.status === authStatus.Unauthed) {
            push('Auth', {screen: Screens.LOG_IN})
          } else if (event.status === authStatus.Authed) {
            replace('Home')
          }
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const onLayout = () => {
    if (!isRendered) {
      setIsRendered(true)
    }
  }

  return (
    <View onLayout={onLayout} style={[styles.container, {backgroundColor: theme.colors.background}]}>
      <Image source={require('../../assets/splash.png')} style={styles.splashImage} resizeMode="cover" />
    </View>
  )
}

export default RootAuthScreen
