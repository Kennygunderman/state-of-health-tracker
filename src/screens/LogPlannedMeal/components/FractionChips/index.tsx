import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'

import Text from '@components/Text'

import styles, {CHIP_HIT_SLOP} from './index.styled'
import {buildFractionChipStates} from '../../index.util'

interface Props {
  servings: number
  onSelect: (fractionValue: number) => void
}

// Node 38:62 draws every chip unselected; its note (38:152) delegates the selected treatment to FoodDetail's chips.
const FractionChips = ({servings, onSelect}: Props) => {
  const chips = buildFractionChipStates(servings)

  return (
    <View style={styles.container}>
      {chips.map(chip => (
        <TouchableOpacity
          key={chip.fraction.glyph}
          style={[styles.chip, chip.isSelected && styles.chipSelected]}
          activeOpacity={Opacity.PRESSED}
          hitSlop={CHIP_HIT_SLOP}
          accessibilityRole="button"
          accessibilityState={{selected: chip.isSelected}}
          onPress={() => onSelect(chip.fraction.value)}>
          <Text style={[styles.chipLabel, chip.isSelected && styles.chipLabelSelected]}>{chip.fraction.glyph}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default FractionChips
