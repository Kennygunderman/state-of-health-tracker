import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import Text from '@components/Text'

import {MEAL_PLAN_LIST_SEPARATOR, MEAL_PLAN_SUMMARY_ROW_ACCESSIBILITY_HINT} from '@constants/strings'

import styles, {valueTextColor} from './index.styled'

export type SummaryRowValueSize = 'label' | 'body'

export interface SummaryRow {
  readonly label: string
  readonly value: string
  readonly valueColor?: string
  readonly onPress?: () => void
  readonly action?: React.ReactNode
  // Both apply to a pressable row only, and both are overrides: a row that names its own destination more
  // precisely than "this answer" supplies them, and every other row takes the defaults composed below.
  readonly accessibilityLabel?: string
  readonly accessibilityHint?: string
}

interface Props {
  readonly rows: SummaryRow[]
  readonly overline?: string
  readonly valueSize?: SummaryRowValueSize
  readonly divided?: boolean
}

const SummaryRows = (props: Props): React.JSX.Element => {
  const {rows, overline, valueSize = 'label', divided = false} = props

  return (
    <View style={styles.container}>
      {overline ? <Text style={styles.overline}>{overline}</Text> : null}

      {rows.map((row, index) => {
        const rowStyle = [
          styles.row,
          divided ? styles.rowStacked : styles.rowInline,
          divided && index > 0 && styles.rowDivider,
          !divided && index > 0 && styles.rowSpaced
        ]

        const labelText = <Text style={[styles.label, !divided && styles.labelInline]}>{row.label}</Text>

        const valueText = (
          <Text
            style={[
              styles.value,
              valueSize === 'body' ? styles.valueBody : styles.valueLabel,
              divided ? styles.valueStacked : styles.valueInline,
              row.valueColor ? valueTextColor(row.valueColor) : undefined
            ]}>
            {row.value}
          </Text>
        )

        const trailing =
          row.action ??
          (row.onPress ? <ChevronRightIcon color={Theme.colors.textFaint} strokeWidth={Stroke.BOLD} /> : null)

        const content = divided ? (
          <>
            <View style={styles.textColumn}>
              {labelText}

              {valueText}
            </View>

            {trailing}
          </>
        ) : (
          <>
            {labelText}

            {valueText}

            {trailing}
          </>
        )

        // The value is composed into the name rather than left to accessibilityValue, because the name is what
        // voice control matches and what a rotor listing reads; the hint carries the one thing neither the
        // label nor the value says, which is that activating the row reopens the step that owns the answer.
        // A row with nothing to report still gets a name from its label alone rather than a trailing separator.
        const accessibleName =
          row.accessibilityLabel ??
          [row.label, row.value].filter(part => part.length > 0).join(MEAL_PLAN_LIST_SEPARATOR)

        return row.onPress ? (
          <TouchableOpacity
            key={row.label}
            style={rowStyle}
            activeOpacity={Opacity.PRESSED}
            accessibilityRole="button"
            accessibilityLabel={accessibleName}
            accessibilityHint={row.accessibilityHint ?? MEAL_PLAN_SUMMARY_ROW_ACCESSIBILITY_HINT}
            onPress={row.onPress}>
            {content}
          </TouchableOpacity>
        ) : (
          <View key={row.label} style={rowStyle}>
            {content}
          </View>
        )
      })}
    </View>
  )
}

export default SummaryRows
