import React from 'react'

import {View} from 'react-native'

import BorderRadius from '@constants/BorderRadius'
import {Ionicons, MaterialCommunityIcons, FontAwesome5, Entypo} from '@expo/vector-icons'
import {useStyleTheme} from '@theme/Theme'

import {ExerciseTypeEnum} from '../data/models/Exercise'

interface Props {
  exerciseType: ExerciseTypeEnum
}

const ExerciseTypeChip = (props: Props) => {
  const {exerciseType} = props

  const getIcon = () => {
    switch (exerciseType) {
      case ExerciseTypeEnum.DUMBBELL:
        return <MaterialCommunityIcons name="dumbbell" size={24} color={useStyleTheme().colors.white} />
      case ExerciseTypeEnum.BODYWEIGHT:
        return <MaterialCommunityIcons name="weight-lifter" size={24} color={useStyleTheme().colors.white} />
      case ExerciseTypeEnum.CABLE:
        return <MaterialCommunityIcons name="jump-rope" size={24} color={useStyleTheme().colors.white} />
      case ExerciseTypeEnum.WEIGHTED:
        return (
          <FontAwesome5 style={{marginTop: -3}} name="weight-hanging" size={20} color={useStyleTheme().colors.white} />
        )
      case ExerciseTypeEnum.MACHINE:
        return <MaterialCommunityIcons name="stairs-up" size={24} color={useStyleTheme().colors.white} />
      case ExerciseTypeEnum.KETTLEBELL:
        return <MaterialCommunityIcons name="kettlebell" size={28} color={useStyleTheme().colors.white} />
      case ExerciseTypeEnum.TIMED:
        return <Entypo name="stopwatch" size={24} color={useStyleTheme().colors.white} />
      case ExerciseTypeEnum.BARBELL:
      default:
        return <Ionicons style={{marginRight: -2}} name="barbell" size={24} color={useStyleTheme().colors.white} />
    }
  }

  return (
    <View
      style={{
        width: 40,
        height: 40,
        backgroundColor: useStyleTheme().colors.secondary,
        borderRadius: BorderRadius.CHIP,
        alignItems: 'center',
        justifyContent: 'center'
      }}>
      {getIcon()}
    </View>
  )
}

export default ExerciseTypeChip
