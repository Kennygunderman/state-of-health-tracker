import React from 'react'

import {View} from 'react-native'

import {GroceryItem} from '@data/models/GroceryList'

import CheckboxSquare from '@components/CheckboxSquare'
import Text from '@components/Text'

import {GROCERY_ITEM_ACCESSIBILITY_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles from './index.styled'

interface Props {
  item: GroceryItem
  variant: 'unchecked' | 'checkedMuted'
  isFirst: boolean
  isPending: boolean
  // Takes the row back rather than closing over it, which is what lets the screen hand every row one reader:
  // a per-item closure would be a new prop for every row on each of the three renders a toggle costs.
  onToggle: (item: GroceryItem) => void
}

const GroceryItemRow = ({item, variant, isFirst, isPending, onToggle}: Props): React.JSX.Element => {
  const rowStyle = [styles.row, !isFirst && styles.rowDivider]
  const checkboxStyle = styles.checkbox
  const checkboxState = variant
  const accessibilityLabel = stringWithNamedParameters(GROCERY_ITEM_ACCESSIBILITY_TEMPLATE, {
    name: item.name,
    quantity: item.displayText
  })

  const handleToggle = () => {
    if (isPending) {
      return
    }

    onToggle(item)
  }

  return (
    <View style={rowStyle}>
      {/* Figma draws the 22x22 box as the row's entire target and no pressed state, so the row is a plain
          layout View and CheckboxSquare — which declares its own checkbox role, label and state, and reaches
          44x44 through its own hit slop — is the one announced control here. */}
      <View style={checkboxStyle}>
        <CheckboxSquare
          state={checkboxState}
          disabled={isPending}
          accessibilityLabel={accessibilityLabel}
          onPress={handleToggle}
        />
      </View>

      <Text style={[styles.name, variant === 'checkedMuted' && styles.nameMuted]}>{item.name}</Text>

      <Text style={[styles.quantity, variant === 'checkedMuted' && styles.quantityMuted]}>{item.displayText}</Text>
    </View>
  )
}

/**
 * Memoized because one optimistic toggle renders the screen three times — pending, cache write, settle — over a
 * list whose other rows are unchanged: the cache hands back the same row objects, so a row that is given the
 * same item, variant, position, pending flag and reader does not re-run its body with the screen above it.
 */
export default React.memo(GroceryItemRow)
