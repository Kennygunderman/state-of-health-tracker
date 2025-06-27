import React, {useEffect, useState} from 'react'

import {View} from 'react-native'

import {CreateExercisePayload, ExerciseBodyPartEnum, ExerciseTypeEnum} from '@data/models/Exercise'
import {Ionicons} from '@expo/vector-icons'
import {useNavigation} from '@react-navigation/native'
import useExercisesStore from '@store/exercises/useExercisesStore'
import {Text, useStyleTheme} from '@theme/Theme'
import {Subject} from 'rxjs'

import LoadingOverlay from '@components/LoadingOverlay'
import Picker from '@components/Picker'
import PrimaryButton from '@components/PrimaryButton'
import TextInputWithHeader from '@components/TextInputWithHeader'
import {showToast} from '@components/toast/util/ShowToast'

import {
  CREATE_EXERCISE_BODY_PART_PICKER_HEADER,
  CREATE_EXERCISE_BUTTON_TEXT,
  CREATE_EXERCISE_ERROR,
  CREATE_EXERCISE_EXERCISE_TYPE_PICKER_HEADER,
  CREATE_EXERCISE_NAME_ERROR,
  CREATE_EXERCISE_NAME_HEADER,
  CREATE_EXERCISE_NAME_PLACEHOLDER_TEXT,
  TOAST_ALREADY_EXISTS,
  TOAST_EXERCISE_CREATED
} from '@constants/Strings'

import styles, {createExerciseMaxPickerWidth} from './index.styled'
import {Navigation} from '../../navigation/types'
import {combineExerciseNameType} from '../../utility/combineExerciseNameType'
import {exerciseTypeValues, bodyPartValues} from '../../utility/exercisePickerItems'

export enum CreateExerciseEvent {
  Created = 'created',
  Exists = 'deleted',
  Error = 'error'
}

export const CreateExerciseEventSubject$ = new Subject<{
  event: CreateExerciseEvent
  payload: CreateExercisePayload
}>()

const CreateExerciseScreen = () => {
  const theme = useStyleTheme()
  const {goBack} = useNavigation<Navigation>()

  const {createExercise} = useExercisesStore()

  const [exerciseNameText, setExerciseNameText] = useState('')
  const [showExerciseNameError, setShowExerciseNameError] = useState(false)

  const [exerciseType, setExerciseType] = useState<ExerciseTypeEnum>(ExerciseTypeEnum.BARBELL)
  const [bodyPart, setBodyPart] = useState<ExerciseBodyPartEnum>(ExerciseBodyPartEnum.CHEST)

  const [isCreatingExercise, setIsCreatingExercise] = useState(false)

  useEffect(() => {
    const sub = CreateExerciseEventSubject$.subscribe({
      next: ({event, payload}) => {
        if (event === CreateExerciseEvent.Created) {
          showToast('success', TOAST_EXERCISE_CREATED, payload.name)
          goBack()
        } else if (event === CreateExerciseEvent.Exists) {
          showToast('error', `${combineExerciseNameType(payload.name, payload.exerciseType)} ${TOAST_ALREADY_EXISTS}`)
        } else if (event === CreateExerciseEvent.Error) {
          showToast('error', CREATE_EXERCISE_ERROR)
        }
        setIsCreatingExercise(false)
      }
    })

    return () => {
      sub.unsubscribe()
    }
  }, [])

  const onNameTextChanged = (text: string) => {
    setExerciseNameText(text)
    setShowExerciseNameError(false)
  }

  const onCreateExercisePressed = () => {
    if (exerciseNameText === '') {
      setShowExerciseNameError(true)

      return
    }

    setIsCreatingExercise(true)
    createExercise({
      name: exerciseNameText,
      exerciseType,
      exerciseBodyPart: bodyPart
    })
  }

  return (
    <>
      {isCreatingExercise && <LoadingOverlay />}

      <Ionicons style={styles.icon} name="barbell" size={128} color={theme.colors.secondary} />

      <View style={styles.inputContainer}>
        <TextInputWithHeader
          header={CREATE_EXERCISE_NAME_HEADER}
          placeholder={CREATE_EXERCISE_NAME_PLACEHOLDER_TEXT}
          maxLength={30}
          value={exerciseNameText}
          showError={showExerciseNameError}
          errorMessage={CREATE_EXERCISE_NAME_ERROR}
          onChangeText={onNameTextChanged}
        />
      </View>

      <View style={styles.pickerRow}>
        <View style={styles.pickerColumn}>
          <Text style={styles.pickerHeader}>{CREATE_EXERCISE_EXERCISE_TYPE_PICKER_HEADER}</Text>

          <Picker
            initialValue={exerciseType}
            items={exerciseTypeValues}
            width={createExerciseMaxPickerWidth * 0.47 - 4}
            onValueSet={setExerciseType}
          />
        </View>

        <View style={styles.pickerColumn}>
          <Text style={styles.pickerHeader}>{CREATE_EXERCISE_BODY_PART_PICKER_HEADER}</Text>

          <Picker
            initialValue={bodyPart}
            items={bodyPartValues}
            width={createExerciseMaxPickerWidth * 0.47 - 4}
            onValueSet={setBodyPart}
          />
        </View>
      </View>

      <PrimaryButton style={styles.button} label={CREATE_EXERCISE_BUTTON_TEXT} onPress={onCreateExercisePressed} />
    </>
  )
}

export default CreateExerciseScreen
