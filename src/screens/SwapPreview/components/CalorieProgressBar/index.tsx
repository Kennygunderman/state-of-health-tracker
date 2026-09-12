import React from 'react'

import {View} from 'react-native'

import styles, {fillWidth} from './index.styled'

interface Props {
  ratio: number
  totalCalories: number
  targetCalories: number
}

const CalorieProgressBar = ({ratio, totalCalories, targetCalories}: Props) => {
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityValue={{min: 0, max: targetCalories, now: totalCalories}}>
      <View style={[styles.fill, fillWidth(ratio)]} />
    </View>
  )
}

export default CalorieProgressBar
