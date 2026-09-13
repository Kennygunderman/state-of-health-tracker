import React from 'react'

import {View} from 'react-native'

import {PaceLbPerWeek} from '@data/models/MealPlanPreferences'

import OptionCard from '@components/OptionCard'

import styles from './index.styled'
import {PaceOption} from '../../index.util'

interface Props {
  options: readonly PaceOption[]
  // Null is a real answer state, not a missing prop: the mock's highlighted "1 lb a week" card is not a
  // chosen answer, so the pace section opens with nothing selected until the user picks a rate.
  selected: PaceLbPerWeek | null
  onSelect: (pace: PaceLbPerWeek) => void
}

const PaceCards = ({options, selected, onSelect}: Props): React.JSX.Element => {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {options.map(option => (
        <OptionCard
          key={option.value}
          label={option.label}
          subcopy={option.subcopy}
          selected={option.value === selected}
          onPress={() => onSelect(option.value)}
        />
      ))}
    </View>
  )
}

export default PaceCards
