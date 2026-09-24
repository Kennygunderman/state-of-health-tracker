import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'

import Text from '@components/Text'

import styles, {CHIP_HIT_SLOP} from './index.styled'
import {buildFractionChipStates} from '../../index.util'

interface Props {
  servings: number
  onSelect: (fractionValue: number) => void
  /**
   * The portion is on record and cannot be changed, so the chips are dimmed and no longer actionable — for a
   * screen reader as well as for a touch. The selected chip stays marked, because which fraction the pending
   * write carries is still worth reading (0.7.2).
   */
  disabled?: boolean
}

// Node 38:62 draws every chip unselected; its note (38:152) delegates the selected treatment to FoodDetail's chips.
const FractionChips = ({servings, onSelect, disabled = false}: Props): React.JSX.Element => {
  const chips = buildFractionChipStates(servings)

  return (
    <View style={styles.container}>
      {chips.map(chip => (
        <TouchableOpacity
          key={chip.fraction.glyph}
          style={[styles.chip, chip.isSelected && styles.chipSelected, disabled && styles.chipDisabled]}
          activeOpacity={Opacity.PRESSED}
          hitSlop={CHIP_HIT_SLOP}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={chip.accessibilityLabel}
          accessibilityState={{selected: chip.isSelected, disabled}}
          onPress={() => onSelect(chip.fraction.value)}>
          <Text style={[styles.chipLabel, chip.isSelected && styles.chipLabelSelected]}>{chip.fraction.glyph}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

export default FractionChips
