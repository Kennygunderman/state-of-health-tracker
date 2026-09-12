import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'

import Text from '@components/Text'

import styles from './index.styled'

const ACTION_PILL_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

interface Props {
  title: string
  rangeText: string
  actionLabel: string
  onActionPressed: () => void
}

const LastDayCard = ({title, rangeText, actionLabel, onActionPressed}: Props): React.JSX.Element => {
  return (
    <View style={styles.card}>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.rangeText}>{rangeText}</Text>
      </View>

      <TouchableOpacity
        style={styles.actionPill}
        activeOpacity={Opacity.PRESSED}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        hitSlop={ACTION_PILL_HIT_SLOP}
        onPress={onActionPressed}>
        <Text style={styles.actionLabel}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default LastDayCard
