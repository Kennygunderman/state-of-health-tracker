import React, {useState} from 'react'

import {TextStyle, View, ViewStyle} from 'react-native'

import BarGraph from '@components/BarGraph'
import TargetWorkoutsModal from '@components/dialog/TargetWorkoutsModal'
import {
  WEEKLY_WORKOUTS_GRAPH_LABEL1,
  WEEKLY_WORKOUTS_GRAPH_LABEL2,
  WEEKLY_WORKOUTS_GRAPH_TITLE
} from '@constants/Strings'
import {useStyleTheme} from '@theme/Theme'

import useUserData from '@store/userData/useUserData'
import useWeeklyWorkoutSummariesStore from '@store/weeklyWorkoutSummaries/useWeeklyWorkoutSummariesStore'
import {formatDateToMonthDay, getLast7Mondays} from '../../../utility/DateUtility'

const WeeklyWorkoutsGraphModule = () => {
  const [isInputModalVisible, setIsInputModalVisible] = useState(false)

  const {targetWorkouts} = useUserData()
  const {weeklySummaries} = useWeeklyWorkoutSummariesStore()

  const targetWorkoutsPerWeek = Math.max(targetWorkouts, 1)

  const presentTargetWorkoutsModal = () => {
    setIsInputModalVisible(true)
  }

  const weekWorkoutsCompletedMap: {[label: string]: number} = {}
  weeklySummaries.forEach(summary => {
    weekWorkoutsCompletedMap[summary.startOfWeek] = summary.completedWorkouts
  })

  const xAxisLabels = getLast7Mondays().map(date => formatDateToMonthDay(date))

  const getYAxisBarLabels = () => {
    let mostWorkoutsFromWeek = 0

    Object.keys(weekWorkoutsCompletedMap).forEach(key => {
      const numWorkouts = weekWorkoutsCompletedMap[key]
      if (numWorkouts > mostWorkoutsFromWeek) {
        mostWorkoutsFromWeek = numWorkouts
      }
    })

    const labels = []
    const compare = Math.max(mostWorkoutsFromWeek, targetWorkoutsPerWeek)
    for (let i = 0; i < compare; i++) {
      labels.push(`${i + 1}`)
    }

    return labels.reverse()
  }

  const barStyle = (label: string): ViewStyle => {
    const currentWeek = xAxisLabels[xAxisLabels.length - 1]
    let backgroundColor = useStyleTheme().colors.secondaryLighter
    let opacity = currentWeek === label ? 1 : 0.5

    const didHitTarget = weekWorkoutsCompletedMap[label] >= targetWorkoutsPerWeek
    if (didHitTarget) {
      backgroundColor = useStyleTheme().colors.success
      opacity = 1
    }

    return {
      backgroundColor,
      opacity
    }
  }

  const xAxisLabelStyle = (label: string): TextStyle => ({
    fontWeight: xAxisLabels[xAxisLabels.length - 1] === label ? 'bold' : 'normal'
  })

  return (
    <>
      <TargetWorkoutsModal isVisible={isInputModalVisible} onDismissed={() => setIsInputModalVisible(false)} />
      <View>
        <BarGraph
          title={WEEKLY_WORKOUTS_GRAPH_TITLE}
          label1={WEEKLY_WORKOUTS_GRAPH_LABEL1 + targetWorkoutsPerWeek}
          label2={WEEKLY_WORKOUTS_GRAPH_LABEL2 + (weekWorkoutsCompletedMap[xAxisLabels[xAxisLabels.length - 1]] || 0)}
          getNumberOfItemsForLabel={xAxisLabel => weekWorkoutsCompletedMap[xAxisLabel] || 0}
          barType="increment"
          xAxisLeftMarginMultiplier={3}
          yAxisLabels={getYAxisBarLabels()}
          getBarStyleForLabel={barStyle}
          xAxisLabels={xAxisLabels}
          getXAxisLabelStyle={xAxisLabelStyle}
          onLabelsPressed={presentTargetWorkoutsModal}
        />
      </View>
    </>
  )
}

export default WeeklyWorkoutsGraphModule
