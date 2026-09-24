import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import Text from '@components/Text'

import styles from './index.styled'
import {rowChevronGeometry} from './index.util'

// Derived once: the glyph is the same on all seven rows, so the arguments 38:412 reconciles to are resolved
// at module scope rather than per render.
const {size: chevronSize, strokeWidth: chevronStrokeWidth} = rowChevronGeometry()

interface Props {
  readonly label: string
  readonly value: string
  readonly isFirst: boolean
  readonly onPress: () => void
  readonly accessibilityLabel: string
}

const SettingsRow = (props: Props): React.JSX.Element => {
  const {label, value, isFirst, onPress, accessibilityLabel} = props

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={Opacity.PRESSED}
      onPress={onPress}
      style={[styles.row, !isFirst && styles.rowDivider]}>
      <View style={styles.textColumn}>
        <Text style={styles.label}>{label}</Text>

        <Text style={styles.value}>{value}</Text>
      </View>

      <View style={styles.chevronSlot}>
        <ChevronRightIcon color={Theme.colors.textFaint} size={chevronSize} strokeWidth={chevronStrokeWidth} />
      </View>
    </TouchableOpacity>
  )
}

export default SettingsRow
