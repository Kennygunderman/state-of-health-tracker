import React, {useEffect} from 'react'
import {Ionicons} from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import {TouchableOpacity, View} from 'react-native'
import Modal from 'react-native-modal'
import BorderRadius from '@constants//BorderRadius'
import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'
import Shadow from '@theme/Shadow'
import {Text, TextInput, useStyleTheme} from '@theme/Theme'
import PrimaryButton from '../PrimaryButton'

interface Props {
  isVisible: boolean
  onCancel: () => void
  onButtonPressed: () => void
  value?: string
  onChangeText: (text: string) => void
  icon?: JSX.Element
  title: string
  subtitle?: string
  buttonText: string
  showError?: boolean
  errorMessage?: string
  keyboardType?: 'default' | 'numeric' | 'number-pad'
  maxInputLength?: number
  placeholder?: string
}

const InputModal = (props: Props) => {
  const {
    isVisible,
    title,
    subtitle,
    buttonText,
    icon,
    value = '',
    onChangeText,
    onCancel,
    onButtonPressed,
    showError = false,
    errorMessage = '',
    keyboardType = 'default',
    maxInputLength = 24,
    placeholder
  } = props

  useEffect(() => {
    if (isVisible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }, [isVisible])

  return (
    <Modal
      isVisible={isVisible}
      avoidKeyboard={true}
      useNativeDriverForBackdrop={true}
      backdropOpacity={0.5}
      animationIn="pulse"
      animationOut="fadeOut"
      animationInTiming={250}
      animationOutTiming={50}
      backdropTransitionInTiming={100}
      onBackdropPress={onCancel}>
      <View
        style={{
          ...Shadow.MODAL,
          padding: Spacing.MEDIUM,
          borderRadius: BorderRadius.MODAL,
          width: '90%',
          paddingBottom: Spacing.LARGE,
          backgroundColor: useStyleTheme().colors.primary,
          alignSelf: 'center'
        }}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons
            name="close"
            size={24}
            color={useStyleTheme().colors.white}
            style={{alignSelf: 'flex-end'}}
          />
        </TouchableOpacity>

        <Text
          style={{
            alignSelf: 'center',
            fontSize: FontSize.H2,
            paddingBottom: Spacing.SMALL,
            fontWeight: 'bold'
          }}>
          {title}
        </Text>
        {icon && icon}
        {subtitle && (
          <Text
            style={{
              alignSelf: 'center',
              fontSize: FontSize.PARAGRAPH,
              paddingTop: Spacing.X_SMALL,
              paddingBottom: Spacing.MEDIUM,
              fontWeight: '300'
            }}>
            {subtitle}
          </Text>
        )}
        <TextInput
          placeholder={placeholder}
          returnKeyType="done"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          maxLength={maxInputLength}
        />
        {showError && (
          <Text
            style={{
              color: useStyleTheme().colors.error,
              alignSelf: 'flex-start',
              fontSize: FontSize.PARAGRAPH,
              fontWeight: '300',
              marginTop: Spacing.XX_SMALL
            }}>
            {errorMessage}
          </Text>
        )}
        <PrimaryButton
          style={{marginTop: Spacing.MEDIUM}}
          label={buttonText}
          onPress={onButtonPressed}
        />
      </View>
    </Modal>
  )
}

export default InputModal
