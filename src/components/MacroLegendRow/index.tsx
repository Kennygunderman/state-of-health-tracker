import React from 'react'

import {View} from 'react-native'

import Text from '@components/Text'

import styles, {dotFill} from './index.styled'

interface Props {
  label: string
  valueText: string
  dotColor: string
  isFirst?: boolean
}

const MacroLegendRow = ({label, valueText, dotColor, isFirst = false}: Props) => (
  <View style={[styles.container, !isFirst && styles.rowDivider]}>
    <View style={[styles.dot, dotFill(dotColor)]} />

    <Text style={styles.label}>{label}</Text>

    <Text style={styles.value}>{valueText}</Text>
  </View>
)

export default MacroLegendRow
