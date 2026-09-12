import React from 'react'

import {View} from 'react-native'

import BackCircleButton from '@components/BackCircleButton'
import Text from '@components/Text'

import {
  MEAL_PLAN_BACK_ACCESSIBILITY_LABEL,
  MEAL_PLAN_WIZARD_STEP_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import ProgressSegments from './components/ProgressSegments'
import styles from './index.styled'
import {filledSegmentCount} from './index.util'

interface Props {
  step: number
  totalSteps: number
  onBack: () => void
}

const WizardHeader = ({step, totalSteps, onBack}: Props): React.JSX.Element => {
  const filled = filledSegmentCount(step, totalSteps)
  const counterText = stringWithNamedParameters(MEAL_PLAN_WIZARD_STEP_TEMPLATE, {n: step, m: totalSteps})

  return (
    <View style={styles.header}>
      <BackCircleButton onPress={onBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

      <ProgressSegments total={totalSteps} filled={filled} />

      <Text style={styles.counter}>{counterText}</Text>
    </View>
  )
}

export default WizardHeader
