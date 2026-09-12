import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {GroceryItem} from '@data/models/GroceryList'
import {Opacity} from '@styles/sizes'

import CheckboxSquare from '@components/CheckboxSquare'
import DeltaPill from '@components/DeltaPill'
import Text from '@components/Text'

import {
  GROCERY_FLAG_CHANGE_TEMPLATE,
  GROCERY_FLAG_ROW_ACCESSIBILITY_TEMPLATE,
  GROCERY_UNCHECK_ITEM_ACCESSIBILITY_TEMPLATE,
  stringWithNamedParameters
} from '@constants/strings'

import styles from './index.styled'

interface Props {
  item: GroceryItem
  isFirst: boolean
  isPending: boolean
  onToggle: () => void
}

const GroceryFlagRow = ({item, isFirst, isPending, onToggle}: Props): React.JSX.Element => {
  const {flag} = item

  if (!flag) {
    return <></>
  }

  const rowStyle = [styles.row, !isFirst && styles.rowDivider]
  const checkboxStyle = [isPending && styles.checkboxPending]

  const changeText = stringWithNamedParameters(GROCERY_FLAG_CHANGE_TEMPLATE, {
    newAmount: flag.newDisplayText,
    oldAmount: flag.previousDisplayText
  })
  const rowAccessibilityLabel = stringWithNamedParameters(GROCERY_FLAG_ROW_ACCESSIBILITY_TEMPLATE, {
    name: item.name,
    newAmount: flag.newDisplayText,
    oldAmount: flag.previousDisplayText,
    delta: flag.deltaDisplayText
  })
  const checkboxAccessibilityLabel = stringWithNamedParameters(GROCERY_UNCHECK_ITEM_ACCESSIBILITY_TEMPLATE, {
    name: item.name
  })

  return (
    <TouchableOpacity
      style={rowStyle}
      activeOpacity={Opacity.PRESSED}
      accessibilityRole="checkbox"
      accessibilityLabel={rowAccessibilityLabel}
      accessibilityState={{checked: true, busy: isPending}}
      onPress={onToggle}>
      {/* CheckboxSquare declares its own checkbox role and exposes no accessibility pass-through, so it is
          hidden here to keep the row a single announced control. */}
      <View style={checkboxStyle} accessible={false} importantForAccessibility="no-hide-descendants">
        <CheckboxSquare
          state="checkedEmphasis"
          disabled={isPending}
          accessibilityLabel={checkboxAccessibilityLabel}
          onPress={onToggle}
        />
      </View>

      <View style={styles.textColumn}>
        <Text style={styles.name}>{item.name}</Text>

        <Text style={styles.subLine}>{changeText}</Text>
      </View>

      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <DeltaPill tone="danger" text={flag.deltaDisplayText} />
      </View>
    </TouchableOpacity>
  )
}

export default GroceryFlagRow
