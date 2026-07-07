import React, {useEffect, useState} from 'react'

import {MaterialCommunityIcons} from '@expo/vector-icons'
import {useUpdateMacroTargetsMutation} from '@queries/macros/useUpdateMacroTargetsMutation'
import useUserData from '@store/userData/useUserData'
import {Theme} from '@styles/theme'
import {isNumber} from '@utility/TextUtility'

import {
  TARGET_CALORIE_MODAL_BODY,
  TARGET_CALORIE_MODAL_BUTTON,
  TARGET_CALORIE_MODAL_ERROR,
  TARGET_CALORIE_MODAL_TITLE
} from '@constants/strings'

import BaseInputModalProps from '../BaseInputModalProps'
import InputModal from '../InputModal'
import styles from './index.styled'

const TargetCaloriesModal = (props: BaseInputModalProps) => {
  const {isVisible, onDismissed} = props

  const targetCalories = useUserData(state => state.targetCalories)
  const setTargetCalories = useUserData(state => state.setTargetCalories)
  const {mutate: updateTargets} = useUpdateMacroTargetsMutation()

  const [value, setValue] = useState(targetCalories.toString())
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    setValue(targetCalories.toString())
  }, [targetCalories])

  const onPrimaryButtonPressed = () => {
    if (!isNumber(value) || parseInt(value, 10) <= 0) {
      setShowError(true)

      return
    }

    onDismissed()
    setShowError(false)

    const calories = parseInt(value, 10)

    setTargetCalories(calories)
    // Fire-and-forget server sync: the Zustand value stays the offline
    // fallback (resolveMacroTargets), so a failed sync self-heals on the
    // next save. The server copy is what the Coach engine reads.
    updateTargets({calories})
  }

  return (
    <InputModal
      title={TARGET_CALORIE_MODAL_TITLE}
      subtitle={TARGET_CALORIE_MODAL_BODY}
      icon={<MaterialCommunityIcons style={styles.icon} name="fire" size={96} color={Theme.colors.fireOrange} />}
      value={value ?? targetCalories.toString()}
      isVisible={isVisible}
      onCancel={onDismissed}
      buttonText={TARGET_CALORIE_MODAL_BUTTON}
      onChangeText={setValue}
      showError={showError}
      errorMessage={TARGET_CALORIE_MODAL_ERROR}
      keyboardType="number-pad"
      maxInputLength={4}
      onButtonPressed={onPrimaryButtonPressed}
    />
  )
}

export default TargetCaloriesModal
