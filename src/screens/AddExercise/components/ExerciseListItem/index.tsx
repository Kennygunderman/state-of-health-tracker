import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Exercise} from '@data/models/Exercise'
import {useNavigation} from '@react-navigation/native'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import {Text, useStyleTheme} from '@theme/Theme'

import DeleteExerciseBottomSheet from '@screens/AddExercise/components/DeleteExerciseBottomSheet'

import ExerciseTypeChip from '@components/ExerciseTypeChip'
import {openGlobalBottomSheet} from '@components/GlobalBottomSheet'
import {showToast} from '@components/toast/util/ShowToast'

import {TOAST_EXERCISE_ADDED, TOAST_EXERCISE_ALREADY_ADDED} from '@constants/Strings'

import styles from './index.styled'
import {combineExerciseNameType} from '../../../../utility/combineExerciseNameType'

interface Props {
  exercise: Exercise
}

const ExerciseListItem = ({exercise}: Props) => {
  const theme = useStyleTheme()

  const {goBack} = useNavigation()

  const {addDailyExercise} = useDailyWorkoutEntryStore()

  const onPress = () => {
    if (addDailyExercise(exercise)) {
      showToast('success', TOAST_EXERCISE_ADDED, exercise.name)
      goBack()
    } else {
      showToast('error', TOAST_EXERCISE_ALREADY_ADDED, exercise.name)
    }
  }

  const onLongPress = () => {
    openGlobalBottomSheet(<DeleteExerciseBottomSheet exercise={exercise} />)
  }

  return (
    <TouchableOpacity activeOpacity={0.5} delayPressIn={50} onPress={onPress} onLongPress={onLongPress}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border
          }
        ]}>
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {combineExerciseNameType(exercise.name, exercise.exerciseType)}
          </Text>

          <Text style={styles.subtitle} numberOfLines={1}>
            {exercise.exerciseBodyPart}
          </Text>
        </View>

        {<View style={styles.chipContainer}>{<ExerciseTypeChip exerciseType={exercise.exerciseType} />}</View>}
      </View>
    </TouchableOpacity>
  )
}

export default ExerciseListItem
