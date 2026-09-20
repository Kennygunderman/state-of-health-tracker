import React from 'react'

import {View} from 'react-native'

import {GroceryItem} from '@data/models/GroceryList'

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
  // Takes the row back rather than closing over it, which is what lets the screen hand every row one reader:
  // a per-item closure would be a new prop for every row on each of the three renders a toggle costs.
  onToggle: (item: GroceryItem) => void
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

    onToggle(item)
  }

  return (
    <View style={rowStyle}>
      {/* BLITZY [A11Y]: this row renders no colour of its own — its checked-emphasis box and its danger delta
          pill both come from shared components whose Figma-exact pairs measure below the WCAG minimums (white
          on accent 2.45:1 against 3:1; danger on dangerTint 4.41:1 against 4.5:1). Both are upheld and
          flagged at their source, and the coordinated decision is recorded in the accessible-colour register
          in `@styles/theme`. */}
      {/* CheckboxSquare declares its own checkbox role, label and state, and Figma draws that 22x22 box as the
          row's entire target with no pressed state — so it is the row's one announced control and the row
          itself is a plain layout View. */}
      <View>
        <CheckboxSquare
          state="checkedEmphasis"
          disabled={isPending}
          accessibilityLabel={checkboxAccessibilityLabel}
          onPress={handleToggle}
        />
      </View>

      {/* Grouped so the flag reads as one statement — name, "amount went up", now/was and the delta — rather
          than as the two text fragments it is drawn as; the delta is folded into that label, which is why the
          pill below stays hidden. */}
      <View style={styles.textColumn} accessible accessibilityLabel={rowAccessibilityLabel}>
        <Text style={styles.name}>{item.name}</Text>

        <Text style={styles.subLine}>{changeText}</Text>
      </View>

      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <DeltaPill tone="danger" text={flag.deltaDisplayText} />
      </View>
    </View>
  )
}

/**
 * Memoized for the same reason as the plain row: a toggle renders the screen three times over a checked card
 * whose other rows are the same objects, and this row's body also composes three templated strings.
 */
export default React.memo(GroceryFlagRow)
