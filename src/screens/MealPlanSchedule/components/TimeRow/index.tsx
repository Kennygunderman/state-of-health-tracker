import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {MealSlot} from '@data/models/Recipe'
import {Opacity, Sizes} from '@styles/sizes'

import MealIconTile from '@components/MealIconTile'
import Text from '@components/Text'

import {MEAL_PLAN_EDIT_TIME_ACCESSIBILITY_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles from './index.styled'
import {mealSlotIconKey, SLOT_ICON_STROKE_WIDTH} from '../../index.util'

const TIME_PILL_HIT_SLOP = (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2

interface Props {
  slot: MealSlot
  name: string
  time: string
  isFirst?: boolean
  onPress: () => void
}

const TimeRow = ({slot, name, time, isFirst = false, onPress}: Props) => {
  return (
    <View style={[styles.row, !isFirst && styles.rowDivided]}>
      <MealIconTile iconKey={mealSlotIconKey(slot)} size="md" strokeWidth={SLOT_ICON_STROKE_WIDTH} />

      {/* Deliberately uncapped, unlike the app's other icon rows: the row grows with the reader's text size. */}
      <Text style={styles.name}>{name}</Text>

      <TouchableOpacity
        style={styles.timePill}
        activeOpacity={Opacity.PRESSED}
        hitSlop={TIME_PILL_HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_EDIT_TIME_ACCESSIBILITY_TEMPLATE, {slot: name})}
        accessibilityValue={{text: time}}
        onPress={onPress}>
        <Text style={styles.timePillLabel}>{time}</Text>
      </TouchableOpacity>
    </View>
  )
}

export default TimeRow
