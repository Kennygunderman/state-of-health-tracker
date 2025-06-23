import React from 'react'

import {TextStyle, ViewStyle} from 'react-native'
import {useSelector} from 'react-redux'

import BarGraph, {BAR_GRAPH_MAX_HEIGHT} from '@components/BarGraph'
import {CALORIES_LABEL, DAILY_CURRENT_TEXT, DAILY_GOAL_TEXT} from '@constants/Strings'
import {useStyleTheme} from '@theme/Theme'
import LocalStore from '@store/LocalStore'
import {useSessionStore} from '@store/session/useSessionStore'
import useUserData from '@store/userData/useUserData'

import {DayTotals, getTotalsForWeekSelector} from '../../../selectors/MealsSelector'
import {formatDateToMonthDay} from '../../../utility/DateUtility'

const WeeklyCalorieProgressGraphModule = () => {
  const totals = useSelector<LocalStore, DayTotals[]>((state: LocalStore) => getTotalsForWeekSelector(state))

  const {sessionStartDate} = useSessionStore()

  const currentDayCaloriesConsumed = totals.find(dayTotal => dayTotal.day === sessionStartDate)?.totals.calories

  const xAxisLabels = totals.map(dayTotals => formatDateToMonthDay(dayTotals.day))

  const {targetCalories} = useUserData()

  const yAxisLabels = (): string[] => {
    const values = []
    for (let i = 5; i > 0; i--) {
      const oneFifth = targetCalories * 0.2
      values.push(`${Math.round(oneFifth * i)}`)
    }

    return values
  }

  const getHeightFromCalories = (calories: number): number => {
    if (!targetCalories || targetCalories === 0) return 0
    const height = (calories / targetCalories) * BAR_GRAPH_MAX_HEIGHT
    if (height > BAR_GRAPH_MAX_HEIGHT) {
      return BAR_GRAPH_MAX_HEIGHT
    }

    return height
  }

  const getBarHeightForLabel = (label: string) => {
    for (let i = 0; i < totals.length; i++) {
      const dayTotals = totals[i]
      if (formatDateToMonthDay(dayTotals.day) === label) {
        return getHeightFromCalories(dayTotals.totals.calories)
      }
    }

    return 0
  }

  const isCurrentDay = (label: string) => label === formatDateToMonthDay(sessionStartDate)

  const xAxisBarStyle = (label: string): ViewStyle => {
    const height = getBarHeightForLabel(label)
    const opacity = height >= BAR_GRAPH_MAX_HEIGHT || isCurrentDay(label) ? 1 : 0.5
    const color =
      height >= BAR_GRAPH_MAX_HEIGHT ? useStyleTheme().colors.success : useStyleTheme().colors.secondaryLighter

    return {
      opacity,
      width: 25,
      alignSelf: 'center',
      height,
      backgroundColor: color
    }
  }

  const xAxisLabelStyle = (label: string): TextStyle => ({
    fontWeight: isCurrentDay(label) ? 'bold' : 'normal'
  })

  return (
    <BarGraph
      barType="solid"
      title={CALORIES_LABEL}
      label1={`${DAILY_GOAL_TEXT} ${targetCalories}`}
      label2={`${DAILY_CURRENT_TEXT} ${Math.round(currentDayCaloriesConsumed ?? 0)}`}
      yAxisLabels={yAxisLabels()}
      getBarStyleForLabel={xAxisBarStyle}
      xAxisLabels={xAxisLabels}
      getXAxisLabelStyle={xAxisLabelStyle}
    />
  )
}

export default WeeklyCalorieProgressGraphModule
