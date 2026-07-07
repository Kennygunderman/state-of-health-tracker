import React from 'react'

import {TouchableOpacity, View} from 'react-native'

import {CoachGoal} from '@data/models/CoachState'
import {useCoachStateQuery} from '@queries/coach/useCoachStateQuery'

import SegmentedControl from '@components/SegmentedControl'
import Text from '@components/Text'

import {
  COACH_GOAL_GAIN,
  COACH_GOAL_LOSE,
  COACH_GOAL_MAINTAIN,
  COACH_RATE_HEADER,
  COACH_RATE_PCT_TEXT,
  COACH_RATE_WEEKLY_TEXT,
  stringWithParameters
} from '@constants/strings'

import styles from './index.styled'
import {DEFAULT_RATE, formatWeeklyChange, RATE_PRESETS, weeklyChangeUnitLabel} from '../../coachRates'

const GOAL_OPTIONS = [
  {key: 'lose' as const, label: COACH_GOAL_LOSE},
  {key: 'maintain' as const, label: COACH_GOAL_MAINTAIN},
  {key: 'gain' as const, label: COACH_GOAL_GAIN}
]

interface Props {
  goal: CoachGoal
  ratePctBw: number
  onGoalChange: (goal: CoachGoal, ratePctBw: number) => void
  onRateChange: (ratePctBw: number) => void
}

const GoalRateSelector = ({goal, ratePctBw, onGoalChange, onRateChange}: Props) => {
  const {data: coachState} = useCoachStateQuery()

  const presets = RATE_PRESETS[goal]

  return (
    <View>
      <SegmentedControl
        options={GOAL_OPTIONS}
        selected={goal}
        onChange={next => onGoalChange(next, DEFAULT_RATE[next])}
      />

      {presets.length > 0 && (
        <>
          <Text style={styles.rateHeader}>{COACH_RATE_HEADER}</Text>

          <View style={styles.rateList}>
            {presets.map(preset => {
              const isSelected = preset.pct === ratePctBw
              const weeklyChange = coachState
                ? formatWeeklyChange(preset.pct, coachState.trendWeightKg, coachState.weightUnit)
                : null

              return (
                <TouchableOpacity
                  key={preset.pct}
                  style={[styles.rateRow, isSelected && styles.rateRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => onRateChange(preset.pct)}>
                  <View>
                    <Text style={[styles.rateLabel, isSelected && styles.rateLabelSelected]}>{preset.label}</Text>

                    <Text style={styles.rateSubLabel}>
                      {stringWithParameters(COACH_RATE_PCT_TEXT, preset.pct.toString())}
                    </Text>
                  </View>

                  {weeklyChange !== null && coachState && (
                    <Text style={[styles.rateWeekly, isSelected && styles.rateLabelSelected]}>
                      {stringWithParameters(
                        COACH_RATE_WEEKLY_TEXT,
                        weeklyChange,
                        weeklyChangeUnitLabel(coachState.weightUnit)
                      )}
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </>
      )}
    </View>
  )
}

export default GoalRateSelector
