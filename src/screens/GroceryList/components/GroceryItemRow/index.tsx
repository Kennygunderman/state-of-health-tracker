import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {GroceryItem} from '@data/models/GroceryList'
import {Opacity} from '@styles/sizes'

import CheckboxSquare from '@components/CheckboxSquare'
import Text from '@components/Text'

import {GROCERY_ITEM_ACCESSIBILITY_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles from './index.styled'

interface Props {
  item: GroceryItem
  variant: 'unchecked' | 'checkedMuted'
  isFirst: boolean
  isPending: boolean
  onToggle: () => void
}

const GroceryItemRow = ({item, variant, isFirst, isPending, onToggle}: Props): React.JSX.Element => {
  const rowStyle = [styles.row, !isFirst && styles.rowDivider]
  const checkboxStyle = [styles.checkbox, isPending && styles.checkboxPending]
  const checkboxState = variant
  const accessibilityLabel = stringWithNamedParameters(GROCERY_ITEM_ACCESSIBILITY_TEMPLATE, {
    name: item.name,
    quantity: item.displayText
  })

  return (
    <TouchableOpacity
      style={rowStyle}
      activeOpacity={Opacity.PRESSED}
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{checked: item.isChecked, busy: isPending}}
      onPress={onToggle}>
      {/* CheckboxSquare declares its own checkbox role, so hiding it keeps the row a single announcement. */}
      <View style={checkboxStyle} accessible={false} importantForAccessibility="no-hide-descendants">
        <CheckboxSquare
          state={checkboxState}
          disabled={isPending}
          accessibilityLabel={accessibilityLabel}
          onPress={onToggle}
        />
      </View>

      <Text style={[styles.name, variant === 'checkedMuted' && styles.nameMuted]}>{item.name}</Text>

      <Text style={[styles.quantity, variant === 'checkedMuted' && styles.quantityMuted]}>{item.displayText}</Text>
    </TouchableOpacity>
  )
}

export default GroceryItemRow
