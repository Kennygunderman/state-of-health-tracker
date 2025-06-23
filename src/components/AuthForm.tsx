import React, {useState} from 'react'

import {TouchableOpacity, View} from 'react-native'
import {KeyboardAwareScrollView} from 'react-native-keyboard-aware-scroll-view'

import Screens from '@constants/Screens'
import Spacing from '@constants/Spacing'
import {
  AUTH_FORM_CONFIRM_PASSWORD_HEADER,
  AUTH_FORM_EMAIL_ERROR,
  AUTH_FORM_EMAIL_HEADER,
  AUTH_FORM_PASSWORD_CONFIRM_ERROR,
  AUTH_FORM_PASSWORD_ERROR,
  AUTH_FORM_PASSWORD_HEADER,
  AUTH_LOG_IN_BUTTON_TEXT,
  AUTH_NO_ACCOUNT_BUTTON_TEXT,
  AUTH_REGISTER_BUTTON_TEXT
} from '@constants/Strings'
import {useNavigation} from '@react-navigation/native'
import {Text, useStyleTheme} from '@theme/Theme'

import {Navigation} from '../navigation/types'
import {useThunkDispatch} from '../store'
import useAuthStore from '../store/auth/useAuthStore'
import {isValidEmail, isValidPassword} from '../utility/AccountUtility'

import PasswordTextInput from './PasswordTextInput'
import PrimaryButton from './PrimaryButton'
import TextInputWithHeader from './TextInputWithHeader'

interface Props {
  readonly authType: 'register' | 'log-in'
}

const AuthForm = (props: Props) => {
  const {authType} = props

  const {goBack, push} = useNavigation<Navigation>()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showEmailError, setShowEmailError] = useState(false)
  const [showPasswordError, setShowPasswordError] = useState(false)
  const [showConfirmPasswordError, setShowConfirmPasswordError] =
    useState(false)

  const {isAttemptingAuth, loginUser, registerUser} = useAuthStore()

  const dispatch = useThunkDispatch()

  const validate = (): boolean => {
    let isValid = true
    if (!isValidEmail(email)) {
      setShowEmailError(true)
      isValid = false
    }

    if (!isValidPassword(password)) {
      setShowPasswordError(true)
      return false
    }

    if (authType === 'register' && password !== confirmPassword) {
      setShowConfirmPasswordError(true)
      return false
    }

    return isValid
  }

  const onEmailTextChanged = (text: string) => {
    setShowEmailError(false)
    setEmail(text)
  }

  const onPasswordTextChanged = (text: string) => {
    setShowPasswordError(false)
    setPassword(text)
  }

  const onPasswordConfirmTextChanged = (text: string) => {
    setShowConfirmPasswordError(false)
    setConfirmPassword(text)
  }

  const handleAuth = () => {
    if (validate()) {
      if (authType === 'register') {
        registerUser(email, password)
      } else {
        loginUser(email, password, dispatch)
      }
    }
  }

  return (
    <>
      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="always"
        extraHeight={Spacing.X_LARGE}
        keyboardDismissMode="interactive">
        <View
          style={{
            marginTop: Spacing.MEDIUM,
            marginHorizontal: Spacing.MEDIUM
          }}>
          <TextInputWithHeader
            maxLength={64}
            header={AUTH_FORM_EMAIL_HEADER}
            value={email}
            onChangeText={onEmailTextChanged}
            errorMessage={AUTH_FORM_EMAIL_ERROR}
            showError={showEmailError}
          />
          <PasswordTextInput
            header={AUTH_FORM_PASSWORD_HEADER}
            value={password}
            onChangeText={onPasswordTextChanged}
            errorMessage={AUTH_FORM_PASSWORD_ERROR}
            showError={showPasswordError}
            secureTextEntry={true}
          />

          {authType === 'register' && (
            <PasswordTextInput
              header={AUTH_FORM_CONFIRM_PASSWORD_HEADER}
              value={confirmPassword}
              onChangeText={onPasswordConfirmTextChanged}
              errorMessage={AUTH_FORM_PASSWORD_CONFIRM_ERROR}
              showError={showConfirmPasswordError}
              secureTextEntry={true}
            />
          )}
          <PrimaryButton
            style={{marginTop: Spacing.LARGE}}
            isLoading={isAttemptingAuth}
            label={
              authType === 'register'
                ? AUTH_REGISTER_BUTTON_TEXT
                : AUTH_LOG_IN_BUTTON_TEXT
            }
            onPress={handleAuth}
          />
          {authType === 'log-in' && (
            <TouchableOpacity
              onPress={() => {
                goBack()
                setTimeout(() => {
                  push('Auth', {screen: Screens.REGISTER})
                }, 300)
              }}>
              <Text
                style={{
                  marginTop: Spacing.LARGE,
                  alignSelf: 'center',
                  fontWeight: 'bold',
                  color: useStyleTheme().colors.secondaryLighter
                }}>
                {AUTH_NO_ACCOUNT_BUTTON_TEXT}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>
    </>
  )
}

export default AuthForm
