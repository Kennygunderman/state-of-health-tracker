import React from 'react'

import {View} from 'react-native'

import OptionCard from '@components/OptionCard'

import styles from './index.styled'
import {DiaryBucketOption} from '../../index.util'

interface Props {
  options: readonly DiaryBucketOption[]
  selectedMealId: string | null
  onSelect: (mealId: string) => void
}

const SlotPicker = ({options, selectedMealId, onSelect}: Props) => {
  return (
    <View style={styles.column}>
      {/* BLITZY [A11Y]: these rows render no colour of their own. Figma authors this picker from the same
          template objects as OptionCard — `38:119` matches `46:170` node for node — so the selected
          indicator carries OptionCard's white-on-accent pair at 2.45:1 and the unselected ring its
          hollow-outline pair at 2.23:1, both upheld and flagged at that component. See the
          accessible-colour register in `@styles/theme`. */}
      {options.map(option => (
        <OptionCard
          key={option.mealId}
          label={option.label}
          selected={option.mealId === selectedMealId}
          onPress={() => onSelect(option.mealId)}
        />
      ))}
    </View>
  )
}

export default SlotPicker
