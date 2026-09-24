import React from 'react'

import {View} from 'react-native'

import {composeAccessibleName} from '@utility/AccessibilityUtility'

import Text from '@components/Text'

import styles, {dotFill} from './index.styled'

interface Props {
  label: string
  valueText: string
  dotColor: string
  isFirst?: boolean
}

// The macro and its figure are one fact, so the row is one reading stop named 'Protein, 116 / 128g' rather
// than two stops with nothing tying them together. The dot carries the same information as the label it sits
// beside, so collapsing it into the group is what it deserves.
const MacroLegendRow = ({label, valueText, dotColor, isFirst = false}: Props): React.JSX.Element => (
  <View
    style={[styles.container, !isFirst && styles.rowDivider]}
    accessible
    accessibilityLabel={composeAccessibleName([label, valueText])}>
    <View style={[styles.dot, dotFill(dotColor)]} />

    <Text style={styles.label}>{label}</Text>

    <Text style={styles.value}>{valueText}</Text>
  </View>
)

export default MacroLegendRow
