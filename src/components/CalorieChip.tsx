import React from 'react'

import {StyleProp, ViewStyle} from 'react-native'

import {CAL_LABEL} from '@constants/Strings'
import {MaterialCommunityIcons} from '@expo/vector-icons'
import {useStyleTheme} from '@theme/Theme'

import Chip from './Chip'

interface Props {
  calories: number
  style?: StyleProp<ViewStyle>
}

const CalorieChip = (props: Props) => {
  const {calories, style} = props

  const icon = (
    <MaterialCommunityIcons
      name="fire"
      size={24}
      color={useStyleTheme().colors.fireOrange}
    />
  )
  return (
    <Chip
      label={`${calories.toString()} ${CAL_LABEL}`}
      icon={icon}
      style={[{alignSelf: 'flex-end'}, style]}
    />
  )
}

export default CalorieChip
