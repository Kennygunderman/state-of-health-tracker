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
import {filledSegmentCount, shouldRenderProgress} from './index.util'

interface Props {
  step: number
  totalSteps: number
  onBack: () => void
  // Omitted, the header is the setup flow's: back button, progress segments and the "n of m" counter, which
  // is what every screen of the flow itself wants. A screen reopened outside that flow passes false and gets
  // the back button alone — the same treatment Review (frame 09) already gives a wizard screen that is not a
  // numbered step.
  isProgressVisible?: boolean
}

const WizardHeader = ({step, totalSteps, onBack, isProgressVisible = true}: Props): React.JSX.Element => {
  const isProgressShown = shouldRenderProgress(isProgressVisible, totalSteps)
  const filled = filledSegmentCount(step, totalSteps)
  const counterText = stringWithNamedParameters(MEAL_PLAN_WIZARD_STEP_TEMPLATE, {n: step, m: totalSteps})

  return (
    <View style={styles.header}>
      <BackCircleButton onPress={onBack} accessibilityLabel={MEAL_PLAN_BACK_ACCESSIBILITY_LABEL} />

      {isProgressShown && <ProgressSegments total={totalSteps} filled={filled} />}

      {isProgressShown && <Text style={styles.counter}>{counterText}</Text>}
    </View>
  )
}

export default WizardHeader
