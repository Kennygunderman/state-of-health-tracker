import React, {useEffect} from 'react'

import {View} from 'react-native'

import Shadow from '@theme/Shadow'
import {Text, useStyleTheme} from '@theme/Theme'
import * as Haptics from 'expo-haptics'
import Modal from 'react-native-modal'

import PrimaryButton from '@components/PrimaryButton'

import BorderRadius from '@constants/BorderRadius'
import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'
import {CANCEL_BUTTON_TEXT, DELETE_BUTTON_TEXT} from '@constants/Strings'

interface Props {
  confirmationTitle: string
  confirmationBody: string
  confirmButtonText?: string
  confirmButtonColor?: string
  cancelButtonText?: string
  isVisible: boolean
  onConfirmPressed: () => void
  onCancel: () => void
}

const ConfirmModal = (props: Props) => {
  const {
    confirmationTitle,
    confirmationBody,
    confirmButtonText = DELETE_BUTTON_TEXT,
    confirmButtonColor = useStyleTheme().colors.error,
    cancelButtonText = CANCEL_BUTTON_TEXT,
    isVisible,
    onConfirmPressed,
    onCancel
  } = props

  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [isVisible])

  return (
    <Modal
      useNativeDriverForBackdrop={true}
      animationIn="pulse"
      backdropOpacity={0.5}
      animationOut="fadeOut"
      animationInTiming={300}
      animationOutTiming={100}
      isVisible={isVisible}
      onBackdropPress={() => {
        onCancel()
      }}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center'
        }}
        pointerEvents="box-none">
        <View
          style={{
            ...Shadow.MODAL,
            borderRadius: BorderRadius.MODAL,
            backgroundColor: useStyleTheme().colors.primary,
            alignSelf: 'center',
            width: '90%',
            padding: Spacing.LARGE
          }}>
          <Text
            style={{
              textAlign: 'center',
              fontSize: FontSize.H2,
              fontWeight: 'bold'
            }}>
            {confirmationTitle}
          </Text>

          <Text
            style={{
              marginTop: Spacing.MEDIUM,
              textAlign: 'center'
            }}>
            {confirmationBody}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: Spacing.LARGE
            }}>
            <PrimaryButton
              width="48%"
              style={{
                padding: Spacing.X_SMALL
              }}
              label={cancelButtonText}
              onPress={() => {
                onCancel()
              }}
            />

            <PrimaryButton
              width="48%"
              style={{
                backgroundColor: confirmButtonColor,
                padding: Spacing.X_SMALL
              }}
              label={confirmButtonText}
              onPress={() => {
                onConfirmPressed()
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}

export default ConfirmModal
