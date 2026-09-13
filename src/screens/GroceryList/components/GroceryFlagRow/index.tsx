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

  const handleToggle = () => {
    if (isPending) {
      return
    }

    onToggle()
  }

  return (
    <TouchableOpacity
      style={rowStyle}
      activeOpacity={Opacity.PRESSED}
      disabled={isPending}
      accessibilityRole="checkbox"
      accessibilityLabel={rowAccessibilityLabel}
      accessibilityState={{checked: true, busy: isPending, disabled: isPending}}
      onPress={handleToggle}>
      {/* BLITZY [A11Y]: this row renders no colour of its own — its checked-emphasis box and its danger delta
          pill both come from shared components whose Figma-exact pairs measure below the WCAG minimums (white
          on accent 2.45:1 against 3:1; danger on dangerTint 4.41:1 against 4.5:1). Both are upheld and
          flagged at their source, and the coordinated decision is recorded in the accessible-colour register
          in `@styles/theme`. */}
      {/* CheckboxSquare declares its own checkbox role and exposes no accessibility pass-through, so it is
          hidden here to keep the row a single announced control. */}
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <CheckboxSquare
          state="checkedEmphasis"
          disabled={isPending}
          accessibilityLabel={checkboxAccessibilityLabel}
          onPress={handleToggle}
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
