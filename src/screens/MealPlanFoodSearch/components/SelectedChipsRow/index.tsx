import React from 'react'

import {ScrollView} from 'react-native'

import SelectableChip from '@components/SelectableChip'

import styles from './index.styled'

interface Props {
  foods: {id: string; name: string}[]
  onRemove: (id: string) => void
}

const SelectedChipsRow = ({foods, onRemove}: Props) => {
  return (
    // ChipCloud's scroll variant cannot forward keyboardShouldPersistTaps, and 06b
    // keeps the search field focused, so a chip tap would only dismiss the keyboard.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={styles.row}
      contentContainerStyle={styles.rowContent}>
      {foods.map(food => (
        <SelectableChip key={food.id} label={food.name} selected removable onPress={() => onRemove(food.id)} />
      ))}
    </ScrollView>
  )
}

export default SelectedChipsRow
