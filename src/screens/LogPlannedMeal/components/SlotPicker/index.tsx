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
