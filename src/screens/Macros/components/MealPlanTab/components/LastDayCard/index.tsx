import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity, Sizes} from '@styles/sizes'

import Text from '@components/Text'

import styles from './index.styled'

const ACTION_PILL_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

// `action` is nullable rather than absent because the last day of an upcoming plan has no other week to
// offer: reaching it is where the user already is, and a further week cannot be planned. The card then
// states the last day alone instead of carrying a pill that would reopen the plan on screen. Label and
// handler travel together as one required value, so no caller can supply half an action.
interface Props {
  title: string
  rangeText: string
  action: {label: string; onPress: () => void} | null
}

const LastDayCard = ({title, rangeText, action}: Props): React.JSX.Element => {
  return (
    <View style={styles.card}>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>

        <Text style={styles.rangeText}>{rangeText}</Text>
      </View>

      {action !== null && (
        <TouchableOpacity
          style={styles.actionPill}
          activeOpacity={Opacity.PRESSED}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={ACTION_PILL_HIT_SLOP}
          onPress={action.onPress}>
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default LastDayCard
