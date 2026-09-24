import React, {useEffect, useRef, useState} from 'react'

import {Linking, TouchableWithoutFeedback, View} from 'react-native'

import BottomSheet from '@gorhom/bottom-sheet'
import {getMinimumAppVersion, initRemoteConfig} from '@service/remoteConfig/initRemoteConfig'
import CrashUtility from '@utility/CrashUtility'
import Constants from 'expo-constants'
import {noop} from 'lodash'

import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'

import {UPDATE_APP_VERSION_BUTTON, UPDATE_APP_VERSION_TEXT, UPDATE_APP_VERSION_TITLE} from '@constants/strings'
import {urls} from '@constants/urls'

import styles from './index.styled'
import {isVersionGreaterOrEqual} from './index.util'

const MinimumVersionSheet = () => {
  const sheetRef = useRef<BottomSheet>(null)

  const [isOpen, setIsOpen] = useState(false)

  // The app's single Remote Config fetch, kept mount-only: there is no foreground refresh (AAP 0.7.5), and the
  // activation it settles is broadcast by the service itself to the consumers that read activated values.
  useEffect(() => {
    initRemoteConfig()
      .then(initialized => {
        if (initialized) {
          const appVersion = Constants.expoConfig?.version ?? ''
          const remoteMinimum = getMinimumAppVersion()

          if (!isVersionGreaterOrEqual(appVersion, remoteMinimum)) {
            setTimeout(() => {
              sheetRef.current?.expand()
              setIsOpen(true)
            }, 2_000)
          }
        }
      })
      // A failed fetch leaves the last activated values in force, so there is nothing to show the user and
      // nothing to retry here — but the failure is still reported rather than swallowed, through the same
      // channel the rest of the app uses.
      .catch(error => CrashUtility.recordError(error))
  }, [])

  const onUpdateButtonPress = async () => {
    const supported = await Linking.canOpenURL(urls.iosStore)

    if (supported) {
      await Linking.openURL(urls.iosStore)
    }
  }

  return (
    <>
      {isOpen && (
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={noop}>
            <View style={styles.backdropTouchableArea} />
          </TouchableWithoutFeedback>
        </View>
      )}

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['30%']}
        enablePanDownToClose={false}
        enableHandlePanningGesture={false}
        handleComponent={null}
        backgroundStyle={styles.sheetBackground}
        style={styles.sheetShadow}
        onClose={noop}>
        <View style={styles.sheetContent}>
          <View>
            <Text style={styles.title}>{UPDATE_APP_VERSION_TITLE}</Text>

            <Text style={styles.desc}>{UPDATE_APP_VERSION_TEXT}</Text>
          </View>

          <PrimaryButton style={styles.button} label={UPDATE_APP_VERSION_BUTTON} onPress={onUpdateButtonPress} />
        </View>
      </BottomSheet>
    </>
  )
}

export default MinimumVersionSheet
