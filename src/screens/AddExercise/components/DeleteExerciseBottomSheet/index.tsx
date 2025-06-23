import React, {useState} from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Exercise} from '@data/models/Exercise'
import {Ionicons} from '@expo/vector-icons'
import useExercisesStore from '@store/exercises/useExercisesStore'
import {Text, useStyleTheme} from '@theme/Theme'

import ConfirmModal from '@components/dialog/ConfirmModal'
import {closeGlobalBottomSheet} from '@components/GlobalBottomSheet'

import {
  DELETE_BUTTON_TEXT,
  DELETE_EXERCISE_MODAL_BODY,
  DELETE_EXERCISE_MODAL_TITLE,
  stringWithParameters
} from '@constants/Strings'

import styles from './index.styled'

interface Props {
  readonly exercise: Exercise
}

const DeleteExerciseBottomSheet = ({exercise}: Props) => {
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false)

  const {deleteExercise} = useExercisesStore()

  const handleDeletePressed = () => {
    setIsConfirmModalVisible(true)
  }

  const closeSheet = () => {
    closeGlobalBottomSheet()
    setIsConfirmModalVisible(false)
  }

  const onConfirmedPressed = () => {
    deleteExercise(exercise.id)
    closeSheet()
  }

  return (
    <>
      <ConfirmModal
        confirmationTitle={DELETE_EXERCISE_MODAL_TITLE}
        confirmationBody={stringWithParameters(DELETE_EXERCISE_MODAL_BODY, exercise.name)}
        isVisible={isConfirmModalVisible}
        onConfirmPressed={onConfirmedPressed}
        onCancel={closeSheet}
      />

      <View>
        <Text style={styles.title} numberOfLines={2}>
          {exercise.name}
        </Text>

        <TouchableOpacity onPress={handleDeletePressed} activeOpacity={0.7} style={styles.deleteContainer}>
          <Ionicons name="trash-bin-outline" size={20} color={useStyleTheme().colors.error} />

          <Text style={styles.deleteText}>{DELETE_BUTTON_TEXT}</Text>
        </TouchableOpacity>
      </View>
    </>
  )
}

export default DeleteExerciseBottomSheet
