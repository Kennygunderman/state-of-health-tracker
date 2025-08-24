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
import {Navigation} from '../../../../navigation/types'

interface Props {
  exercise: Exercise
}

const ExerciseListItem = ({exercise}: Props) => {
  const theme = useStyleTheme()

  const navigation = useNavigation<Navigation>()

  const {addDailyExercise} = useDailyWorkoutEntryStore()

  const onPress = () => {
    // Skip running exercises since they now have a dedicated Run tab
    if (exercise.name === 'Running' && exercise.exerciseBodyPart === 'Cardio') {
      showToast('info', 'Use the Run tab to track your runs', '')
      return
    }
    
    if (addDailyExercise(exercise)) {
      showToast('success', TOAST_EXERCISE_ADDED, exercise.name)
      navigation.goBack()
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
            {exercise.name}
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
