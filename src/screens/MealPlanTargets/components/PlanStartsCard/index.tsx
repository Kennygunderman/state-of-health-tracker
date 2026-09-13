import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'

import Text from '@components/Text'

import {MEAL_PLAN_PLAN_START_ACTION_ACCESSIBILITY_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles, {PLAN_STARTS_CHANGE_HIT_SLOP, PLAN_STARTS_ROW_HIT_SLOP} from './index.styled'

interface Props {
  readonly label: string
  readonly rangeText: string
  readonly changeLabel: string
  readonly onChangePress: () => void
}

const PlanStartsCard = ({label, rangeText, changeLabel, onChangePress}: Props) => {
  return (
    <View style={styles.card}>
      <View style={styles.row} hitSlop={PLAN_STARTS_ROW_HIT_SLOP}>
        <View style={styles.textColumn}>
          <Text style={styles.label}>{label}</Text>

          <Text style={styles.value}>{rangeText}</Text>
        </View>

        <TouchableOpacity
          style={styles.changeButton}
          activeOpacity={Opacity.PRESSED}
          hitSlop={PLAN_STARTS_CHANGE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_PLAN_START_ACTION_ACCESSIBILITY_TEMPLATE, {
            action: changeLabel
          })}
          onPress={onChangePress}>
          <Text style={styles.changeLabel}>{changeLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default PlanStartsCard
