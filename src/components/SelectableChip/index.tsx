import React from 'react'

import {TouchableOpacity} from 'react-native'

import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'

import Text from '@components/Text'

import {
  MEAL_PLAN_CHIP_REMOVE_GLYPH,
  MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import styles from './index.styled'

interface Props {
  label: string
  selected: boolean
  removable?: boolean
  onPress: () => void
}

const SelectableChip = ({label, selected, removable = false, onPress}: Props) => {
  const isRemovable = removable && selected
  const removeHint = isRemovable
    ? stringWithNamedParameters(MEAL_PLAN_REMOVE_FOOD_ACCESSIBILITY_TEMPLATE, {name: label})
    : undefined

  return (
    <TouchableOpacity
      style={[styles.container, selected && styles.containerSelected]}
      activeOpacity={Opacity.PRESSED}
      hitSlop={Spacing.TIGHT}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={removeHint}
      accessibilityState={{selected}}
      onPress={onPress}>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>

      {isRemovable && <Text style={styles.removeGlyph}>{MEAL_PLAN_CHIP_REMOVE_GLYPH}</Text>}
    </TouchableOpacity>
  )
}

export default SelectableChip
