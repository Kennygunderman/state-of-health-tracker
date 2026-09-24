import React from 'react'

import {View} from 'react-native'

import {SWAP_PREVIEW_CALORIE_PROGRESS_ACCESSIBILITY_LABEL} from '@constants/strings'

import styles, {fillWidth} from './index.styled'

interface Props {
  ratio: number
  totalCalories: number
  targetCalories: number
}

const CalorieProgressBar = ({ratio, totalCalories, targetCalories}: Props): React.JSX.Element => {
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={SWAP_PREVIEW_CALORIE_PROGRESS_ACCESSIBILITY_LABEL}
      accessibilityValue={{min: 0, max: targetCalories, now: totalCalories}}>
      <View style={[styles.fill, fillWidth(ratio)]} />
    </View>
  )
}

export default CalorieProgressBar
