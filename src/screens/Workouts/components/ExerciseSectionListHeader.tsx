import React, {useState} from 'react'

import SectionListHeader from '@components/SectionListHeader'
import {ADD_SET_BUTTON_TEXT} from '@constants/Strings'

import {DailyExercise} from '@data/models/DailyExercise'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'

import ExerciseListItemDropdown from './ExerciseListItemDropdown'

interface Props {
  dailyExercise: DailyExercise
  dailyExercisesToReorg: DailyExercise[]
}

const ExerciseSectionListHeader = (props: Props) => {
  const {dailyExercise, dailyExercisesToReorg} = props

  const [isDropdownVisible, setIsDropdownVisible] = useState(false)
  const [dropdownTopMargin, setDropdownTopMargin] = useState(0)
  const [dropdownDailyExercise, setDropdownDailyExercise] = useState<DailyExercise>()

  const {addSet} = useDailyWorkoutEntryStore()

  const dropdown = () => (
    <ExerciseListItemDropdown
      onDropdownCancel={isVisible => {
        setIsDropdownVisible(isVisible)
      }}
      isVisible={isDropdownVisible}
      dropdownTopMargin={dropdownTopMargin}
      dailyExercisesToReorg={dailyExercisesToReorg}
      dailyExerciseToDelete={dropdownDailyExercise}
    />
  )

  return (
    <>
      {dropdown()}
      <SectionListHeader
        key={dailyExercise.id}
        title={dailyExercise.exercise.name}
        onTitlePressed={(topMargin?: number) => {
          if (topMargin) {
            setDropdownTopMargin(topMargin)
          }
          setDropdownDailyExercise(dailyExercise)
          setIsDropdownVisible(true)
        }}
        buttonText={ADD_SET_BUTTON_TEXT}
        onButtonPressed={() => {
          addSet(dailyExercise.exercise)
        }}
      />
    </>
  )
}

export default ExerciseSectionListHeader
