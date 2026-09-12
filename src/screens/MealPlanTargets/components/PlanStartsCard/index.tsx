import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'

import Text from '@components/Text'

import styles from './index.styled'

interface Props {
  readonly label: string
  readonly rangeText: string
  readonly changeLabel: string
  readonly onChangePress: () => void
}

const PlanStartsCard = ({label, rangeText, changeLabel, onChangePress}: Props) => {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.textColumn}>
          <Text style={styles.label}>{label}</Text>

          <Text style={styles.value}>{rangeText}</Text>
        </View>

        <TouchableOpacity
          style={styles.changeButton}
          activeOpacity={Opacity.PRESSED}
          hitSlop={Spacing.TIGHT}
          accessibilityRole="button"
          onPress={onChangePress}>
          <Text style={styles.changeLabel}>{changeLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default PlanStartsCard
