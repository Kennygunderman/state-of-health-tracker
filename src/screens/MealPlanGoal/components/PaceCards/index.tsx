import React from 'react'

import {View} from 'react-native'

import {PaceLbPerWeek} from '@data/models/MealPlanPreferences'

import OptionCard from '@components/OptionCard'

import styles from './index.styled'
// The screen's util is the sanctioned home for a helper shared with its components/ children, and has no alias.
import {PaceOption} from '../../index.util'

interface Props {
  options: PaceOption[]
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
