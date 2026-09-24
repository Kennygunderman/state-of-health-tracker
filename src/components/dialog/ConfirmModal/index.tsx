import React, {useEffect} from 'react'

import {View} from 'react-native'

import {Theme} from '@styles/theme'
import * as Haptics from 'expo-haptics'
import Modal from 'react-native-modal'

import PrimaryButton from '@components/PrimaryButton'
import Text from '@components/Text'

import {CANCEL_BUTTON_TEXT, DELETE_BUTTON_TEXT} from '@constants/strings'

import styles, {confirmButtonBackground} from './index.styled'

interface Props {
  confirmationTitle: string
  // Optional because the stale-revision prompt is specified as a title plus its two answers and has no body copy
  confirmationBody?: string
  confirmButtonText?: string
  confirmButtonColor?: string
  // The dismiss answer is not always "Cancel": the stale-revision prompt answers it with "Use theirs"
  cancelButtonText?: string
  cancelButtonColor?: string
  // A pending confirm shows its spinner and swallows further presses, so one answer can never write twice
  isConfirmPending?: boolean
  // Callers whose screen carries a number pad set this so the keyboard cannot cover the dialog's actions
  avoidKeyboard?: boolean
  isVisible: boolean
  onConfirmPressed: () => void
  onCancel: () => void
}

const ConfirmModal = (props: Props) => {
  const {
    confirmationTitle,
    confirmationBody,
    confirmButtonText = DELETE_BUTTON_TEXT,
    confirmButtonColor = Theme.colors.error,
    cancelButtonText = CANCEL_BUTTON_TEXT,
    cancelButtonColor = Theme.colors.accentGreen,
    isConfirmPending = false,
    avoidKeyboard = false,
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
      avoidKeyboard={avoidKeyboard}
      isVisible={isVisible}
      onBackdropPress={() => {
        if (isConfirmPending) {
          return
        }

        onCancel()
      }}>
      <View style={styles.container} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <Text style={styles.title}>{confirmationTitle}</Text>

          {confirmationBody != null && <Text style={styles.body}>{confirmationBody}</Text>}

          <View style={styles.buttonRow}>
            <PrimaryButton
              width="48%"
              style={[styles.button, confirmButtonBackground(cancelButtonColor)]}
              label={cancelButtonText}
              disabled={isConfirmPending}
              onPress={() => {
                onCancel()
              }}
            />

            <PrimaryButton
              width="48%"
              style={[styles.button, confirmButtonBackground(confirmButtonColor)]}
              label={confirmButtonText}
              isLoading={isConfirmPending}
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
