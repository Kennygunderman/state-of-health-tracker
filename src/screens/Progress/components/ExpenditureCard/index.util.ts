import {ExpenditurePoint} from '@data/models/CoachState'

import {LineChartPoint} from '@components/MiniLineChart'

export const buildExpenditureTrend = (series: ExpenditurePoint[]): LineChartPoint[] =>
  series.map(point => ({date: point.day, value: point.tdeeKcal}))

export const formatKcal = (value: number): string => Math.round(value).toLocaleString('en-US')
