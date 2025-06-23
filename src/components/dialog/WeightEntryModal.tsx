import React, {useState} from 'react'

import {showToast} from '@components/toast/util/ShowToast'
import Spacing from '@constants/Spacing'
import {
  CURRENT_WEIGHT_MODAL_BODY,
  CURRENT_WEIGHT_MODAL_BUTTON,
  CURRENT_WEIGHT_MODAL_ERROR,
  CURRENT_WEIGHT_MODAL_TITLE,
  TOAST_WEIGHT_UPDATED
} from '@constants/Strings'
import {FontAwesome5} from '@expo/vector-icons'
import {useStyleTheme} from '@theme/Theme'

import useUserData from '../../store/userData/useUserData'
import {isNumber} from '../../utility/TextUtility'

import BaseModalProps from './BaseInputModalProps'
import InputModal from './InputModal'

const WeightEntryModal = (props: BaseModalProps) => {
  const {isVisible, onDismissed} = props

  const {setCurrentWeight, currentWeight} = useUserData()

  const [value, setValue] = useState(currentWeight.toString())
  const [showError, setShowError] = useState(false)

  const onPrimaryButtonPressed = () => {
    const intVal = parseInt(value, 10)
    if (!isNumber(value) || intVal === 0) {
      setShowError(true)
      return
    }

    onDismissed()
    setShowError(false)

    setCurrentWeight(intVal)
    showToast('success', TOAST_WEIGHT_UPDATED, value)
  }

  return (
    <InputModal
      title={CURRENT_WEIGHT_MODAL_TITLE}
      subtitle={CURRENT_WEIGHT_MODAL_BODY}
      icon={
        <FontAwesome5
          name="weight"
          size={96}
          style={{
            alignSelf: 'center',
            marginBottom: Spacing.X_SMALL
          }}
          color={useStyleTheme().colors.secondaryLighter}
        />
      }
      value={value}
      isVisible={isVisible}
      onCancel={onDismissed}
      buttonText={CURRENT_WEIGHT_MODAL_BUTTON}
      onChangeText={setValue}
      showError={showError}
      errorMessage={CURRENT_WEIGHT_MODAL_ERROR}
      keyboardType="number-pad"
      maxInputLength={3}
      onButtonPressed={onPrimaryButtonPressed}
    />
  )
}

export default WeightEntryModal
