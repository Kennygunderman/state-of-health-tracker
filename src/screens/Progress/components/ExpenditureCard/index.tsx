import React from 'react'

import {View} from 'react-native'

import {CoachConfidence} from '@data/models/CoachState'
import {useCoachStateQuery} from '@queries/coach/useCoachStateQuery'
import {Theme} from '@styles/theme'

import MiniLineChart from '@components/MiniLineChart'
import Text from '@components/Text'

import {
  EXPENDITURE_CALIBRATING_HINT,
  EXPENDITURE_CARD_CAPTION,
  EXPENDITURE_CARD_LABEL,
  EXPENDITURE_CARD_UNIT,
  EXPENDITURE_CONFIDENCE_CALIBRATING,
  EXPENDITURE_CONFIDENCE_HIGH,
  EXPENDITURE_CONFIDENCE_LOW,
  EXPENDITURE_CONFIDENCE_MEDIUM
} from '@constants/strings'

import styles from './index.styled'
import {buildExpenditureTrend, formatKcal} from './index.util'

const CHART_HEIGHT = 100
const MIN_POINTS_FOR_CHART = 2

const CONFIDENCE_LABELS: Record<CoachConfidence, string> = {
  calibrating: EXPENDITURE_CONFIDENCE_CALIBRATING,
  low: EXPENDITURE_CONFIDENCE_LOW,
  medium: EXPENDITURE_CONFIDENCE_MEDIUM,
  high: EXPENDITURE_CONFIDENCE_HIGH
}

const ExpenditureCard = () => {
  const {data: coachState} = useCoachStateQuery()

  if (!coachState || coachState.tdeeKcal === null) {
    return null
  }

  const trend = buildExpenditureTrend(coachState.expenditureSeries)
  const isCalibrating = coachState.confidence === 'calibrating'

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{EXPENDITURE_CARD_LABEL}</Text>

        <View style={[styles.confidenceChip, isCalibrating && styles.confidenceChipCalibrating]}>
          <Text style={[styles.confidenceText, isCalibrating && styles.confidenceTextCalibrating]}>
            {CONFIDENCE_LABELS[coachState.confidence]}
          </Text>
        </View>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{formatKcal(coachState.tdeeKcal)}</Text>

        <Text style={styles.unit}>{EXPENDITURE_CARD_UNIT}</Text>
      </View>

      {trend.length >= MIN_POINTS_FOR_CHART && (
        <View style={styles.chartWrapper}>
          <MiniLineChart
            points={trend}
            height={CHART_HEIGHT}
            color={Theme.colors.accentGreen}
            pointLabel={value => formatKcal(value)}
          />
        </View>
      )}

      <Text style={styles.caption}>{isCalibrating ? EXPENDITURE_CALIBRATING_HINT : EXPENDITURE_CARD_CAPTION}</Text>
    </View>
  )
}

export default ExpenditureCard
