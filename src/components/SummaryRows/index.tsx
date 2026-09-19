import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'
import {composeAccessibleName} from '@utility/AccessibilityUtility'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import Text from '@components/Text'

import {MEAL_PLAN_SUMMARY_ROW_ACCESSIBILITY_HINT} from '@constants/strings'

import styles, {valueTextColor} from './index.styled'

export type SummaryRowValueSize = 'label' | 'body'

export interface SummaryRow {
  readonly label: string
  readonly value: string
  readonly valueColor?: string
  readonly onPress?: () => void
  readonly action?: React.ReactNode
  // Both are overrides a row supplies when it names its own destination more precisely than "this answer";
  // every other row takes the defaults composed below. The label applies to either branch, since both are one
  // grouped element; the hint applies to a pressable row only, because it describes activating one.
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
        // A row with nothing to report still gets a name from its label alone rather than a trailing separator,
        // and a row whose answer is not recorded yet is one stop named by its label rather than that label
        // followed by a silent one.
        const accessibleName = row.accessibilityLabel ?? composeAccessibleName([row.label, row.value])

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
          // Grouped for the same reason the pressable branch is, and named the same way: a row the user cannot
          // open is still one answer, and split into a label stop and a value stop it reads as two.
          <View key={row.label} style={rowStyle} accessible accessibilityLabel={accessibleName}>
            {content}
          </View>
        )
      })}
    </View>
  )
}

export default SummaryRows
