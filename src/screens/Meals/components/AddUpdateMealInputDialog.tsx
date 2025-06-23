import React, {useState} from 'react'

import InputModal from '@components/dialog/InputModal'
import {showToast} from '@components/toast/util/ShowToast'
import {
  ADD_MEAL_BUTTON_TEXT,
  ADD_MEAL_PLACEHOLDER_TEXT,
  DIALOG_MEAL_NAME_ERROR,
  DIALOG_MEAL_NAME_SUBTITLE,
  DIALOG_MEAL_NAME_TITLE,
  DIALOG_MEAL_UPDATE_BUTTON_TEXT,
  TOAST_ADDED,
  TOAST_MEAL_UPDATED
} from '@constants/Strings'
import {MaterialCommunityIcons} from '@expo/vector-icons'
import {useStyleTheme} from '@theme/Theme'

import {useThunkDispatch} from '../../../store'
import {addMeal, updateMealName} from '@store/meals/MealsActions'
import {createMeal} from '@store/meals/models/Meal'

export enum MealAction {
  ADD,
  UPDATE_NAME
}

interface Props {
  inputMealName: string
  inputMealUpdateId?: string
  visible: boolean
  onCancel: () => void
  onChangeText: (text: string) => void
  action: MealAction
}

const AddUpdateMealInputDialog = (props: Props) => {
  const {inputMealName, inputMealUpdateId, visible, onCancel, onChangeText, action} = props

  const [showError, setShowError] = useState(false)

  const dispatch = useThunkDispatch()

  const closeDialog = () => {
    setShowError(false)
    onCancel()
  }

  const onAddUpdatePressed = () => {
    if (inputMealName === '') {
      setShowError(true)
      return
    }

    if (action === MealAction.ADD) {
      const meal = createMeal(inputMealName, [])
      dispatch(addMeal(meal))
      showToast('success', `${inputMealName} ${TOAST_ADDED}`)
      closeDialog()
    }

    if (action === MealAction.UPDATE_NAME) {
      if (inputMealUpdateId) {
        dispatch(updateMealName(inputMealUpdateId, inputMealName))
        showToast('success', `${inputMealName} ${TOAST_MEAL_UPDATED}`)
      }
      closeDialog()
    }
  }

  return (
    <InputModal
      title={DIALOG_MEAL_NAME_TITLE}
      subtitle={DIALOG_MEAL_NAME_SUBTITLE}
      icon={
        <MaterialCommunityIcons
          style={{alignSelf: 'center'}}
          name="pot-steam"
          size={96}
          color={useStyleTheme().colors.secondaryLighter}
        />
      }
      value={inputMealName}
      isVisible={visible}
      onCancel={closeDialog}
      buttonText={action === MealAction.ADD ? ADD_MEAL_BUTTON_TEXT : DIALOG_MEAL_UPDATE_BUTTON_TEXT}
      onChangeText={onChangeText}
      showError={showError}
      errorMessage={DIALOG_MEAL_NAME_ERROR}
      onButtonPressed={onAddUpdatePressed}
      placeholder={ADD_MEAL_PLACEHOLDER_TEXT}
    />
  )
}

export default AddUpdateMealInputDialog
