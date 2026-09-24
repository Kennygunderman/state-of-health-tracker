import React, {useMemo} from 'react'

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

const DayStrip = ({dayKeys, selectedDayKey, onDayPressed}: Props): React.JSX.Element => {
  // Each label is two date formats, so they are derived from the week rather than from the selection: moving
  // the selection re-renders the strip but re-formats nothing.
  const labels = useMemo(() => dayKeys.map(dayKey => ({dayKey, ...dayStripLabel(dayKey)})), [dayKeys])

  return (
    <View style={styles.strip}>
      {labels.map(({dayKey, weekday, dayNumber}) => {
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

// Memoized so the strip re-renders when the week or the selected day changes rather than on every store and
// query change the tab above it observes.
export default React.memo(DayStrip)
