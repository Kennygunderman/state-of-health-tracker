import React from 'react'

import {FlatList, ListRenderItemInfo} from 'react-native'

import {Exercise} from '@data/models/Exercise'
import {useNavigation} from '@react-navigation/native'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import useExercisesStore from '@store/exercises/useExercisesStore'
import useExerciseTemplateStore from '@store/exerciseTemplates/useExerciseTemplateStore'
import {Text, useStyleTheme} from '@theme/Theme'

import ExerciseTypeChip from '@components/ExerciseTypeChip'
import ListItem from '@components/ListItem'
import PrimaryButton from '@components/PrimaryButton'
import {showToast} from '@components/toast/util/ShowToast'

import {
  stringWithParameters,
  TEMPLATE_START,
  TOAST_TEMPLATE_EXERCISES_ADDED,
  TOAST_TEMPLATE_EXERCISES_ADDED_BODY
} from '@constants/Strings'
import Screens from '@constants/Screens'

import styles from './index.styled'
import {Navigation} from '../../navigation/types'

const WorkoutTemplateDetailScreen = () => {
  const navigation = useNavigation<Navigation>()
  const {getExercises} = useExercisesStore()
  const {addDailyExercise} = useDailyWorkoutEntryStore()
  const {selectedTemplate} = useExerciseTemplateStore()

  if (!selectedTemplate) return null

  const exercises = getExercises(selectedTemplate.exerciseIds)

  const addExerciseToDailyEntry = () => {
    // Filter out running exercises since they have a dedicated Run tab
    const nonRunningExercises = exercises.filter(exercise => 
      !(exercise.name === 'Running' && exercise.exerciseBodyPart === 'Cardio')
    )
    
    nonRunningExercises.forEach(exercise => {
      addDailyExercise(exercise)
    })
    
    // Show warning if template contained running exercises
    if (exercises.length !== nonRunningExercises.length) {
      showToast('info', 'Running exercises skipped', 'Use the Run tab to track runs')
    }
  }

  const onStartWorkoutPressed = () => {
    addExerciseToDailyEntry()
    showToast(
      'success',
      TOAST_TEMPLATE_EXERCISES_ADDED,
      stringWithParameters(TOAST_TEMPLATE_EXERCISES_ADDED_BODY, selectedTemplate.name)
    )
    
    navigation.pop(2)
  }

  const renderItem = ({item}: ListRenderItemInfo<Exercise>) => (
    <ListItem
      isTappable={false}
      isSwipeable={false}
      leftRightMargin={styles.itemMargin.marginHorizontal}
      title={item.name}
      subtitle={item.exerciseBodyPart}
      chip={<ExerciseTypeChip exerciseType={item.exerciseType} />}
    />
  )

  return (
    <FlatList
      stickyHeaderIndices={[0]}
      data={exercises}
      ListHeaderComponent={
        <Text style={[styles.headerText, {backgroundColor: useStyleTheme().colors.background}]}>
          {selectedTemplate.name}
        </Text>
      }
      ListFooterComponent={
        <PrimaryButton style={styles.footerButton} label={TEMPLATE_START} onPress={onStartWorkoutPressed} />
      }
      renderItem={renderItem}
    />
  )
}

export default WorkoutTemplateDetailScreen
