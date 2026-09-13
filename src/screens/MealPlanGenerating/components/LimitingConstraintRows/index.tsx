import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'

import Text from '@components/Text'

import styles from './index.styled'
import {LimitingConstraintRow} from '../../index.util'

interface Props {
  readonly rows: LimitingConstraintRow[]
  readonly onEditConstraint: (row: LimitingConstraintRow) => void
}

// This card draws its own rows rather than composing @components/SummaryRows because frame 10c inverts the
// emphasis that component was built for: here the constraint name is the semibold 15px line and the current
// value is the muted 13px one, where the Review (34:98) and Plan-settings (38:402) cards mute the name and
// emphasise the value. The design file proves it is intent rather than a slip — node 34:466 renders "Maximum
// cooking time" at 600/15/#EDF3EF while node 34:146 renders the same words at 400/13/#7E8B84 — and the value
// line heights differ with it (18.85 here, 19.5 there), so no combination of that component's props expresses
// this row. Note that this is a deliberate departure from the row entry in the plan's component inventory,
// which generalises all three cards into one treatment and cites node ids that do not describe this card
// (34:464 is the stacked text column, not a row, and 34:103 is absent from the file); the node data above is
// the authority. Composing SummaryRows again would need an additive emphasis variant on that shared
// component, which several other screens consume.
const LimitingConstraintRows = ({rows, onEditConstraint}: Props): React.JSX.Element | null => {
  // The 422 analysis names between one and seven constraints, so an empty list draws no card at all rather
  // than an empty surface.
  if (rows.length === 0) {
    return null
  }

  return (
    <View style={styles.card}>
      {rows.map((row, index) => (
        <View key={row.constraintKey} style={[styles.row, index > 0 && styles.rowDivided]}>
          <View style={styles.textColumn}>
            <Text style={styles.name}>{row.label}</Text>

            {!!row.value && <Text style={styles.value}>{row.value}</Text>}
          </View>

          <TouchableOpacity
            style={styles.editPill}
            activeOpacity={Opacity.PRESSED}
            hitSlop={Spacing.X_SMALL}
            accessibilityRole="button"
            accessibilityLabel={row.editAccessibilityLabel}
            onPress={() => onEditConstraint(row)}>
            <Text style={styles.editPillLabel}>{row.editLabel}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

export default LimitingConstraintRows
