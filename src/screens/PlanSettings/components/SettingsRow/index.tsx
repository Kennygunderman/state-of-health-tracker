import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import ChevronRightIcon from '@components/icons/ChevronRightIcon'
import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  readonly label: string
  readonly value: string
  readonly isFirst: boolean
  readonly onPress: () => void
  readonly accessibilityLabel: string
}

const SettingsRow = (props: Props) => {
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

      <ChevronRightIcon color={Theme.colors.textFaint} strokeWidth={Stroke.BOLD} />
    </TouchableOpacity>
  )
}

export default SettingsRow
