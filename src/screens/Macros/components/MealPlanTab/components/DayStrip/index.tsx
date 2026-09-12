import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {Opacity} from '@styles/sizes'
import {dayStripLabel} from '@utility/MealPlanDateUtility'

import Text from '@components/Text'

import {MEAL_PLAN_DAY_CHIP_ACCESSIBILITY_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import styles from './index.styled'

interface Props {
  dayKeys: string[]
  selectedDayKey: string
  onDayPressed: (dayKey: string) => void
}

const DayStrip = ({dayKeys, selectedDayKey, onDayPressed}: Props) => {
  return (
    <View style={styles.strip}>
      {dayKeys.map(dayKey => {
        const {weekday, dayNumber} = dayStripLabel(dayKey)
        const isSelected = dayKey === selectedDayKey

        return (
          <TouchableOpacity
            key={dayKey}
            style={[styles.chip, isSelected && styles.chipSelected]}
            activeOpacity={Opacity.PRESSED}
            accessibilityRole="button"
            accessibilityState={{selected: isSelected}}
            accessibilityLabel={stringWithNamedParameters(MEAL_PLAN_DAY_CHIP_ACCESSIBILITY_TEMPLATE, {
              day: `${weekday} ${dayNumber}`
            })}
            onPress={() => onDayPressed(dayKey)}>
            <Text style={[styles.weekday, isSelected && styles.weekdaySelected]}>{weekday}</Text>

            <Text style={[styles.dayNumber, isSelected && styles.dayNumberSelected]}>{dayNumber}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

export default DayStrip
