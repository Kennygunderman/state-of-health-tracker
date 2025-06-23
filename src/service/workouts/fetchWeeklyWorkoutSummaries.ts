import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import {WeeklyWorkoutSummary} from '../../data/models/WeeklyWorkoutSummary'
import CrashUtility from '../../utility/CrashUtility'
import {httpGet} from '../http/httpUtil'

const WeeklyWorkoutSummaryResponse = io.type({
  startOfWeek: io.string,
  completedWorkouts: io.number
})

const WeeklyWorkoutSummariesResponse = io.array(WeeklyWorkoutSummaryResponse)

export async function fetchWeeklyWorkoutSummaries(): Promise<WeeklyWorkoutSummary[]> {
  try {
    const response = await httpGet(Endpoints.WeeklyWorkoutSummary, WeeklyWorkoutSummariesResponse)

    const data = response?.data

    if (!Array.isArray(data)) {
      throw new Error('Invalid weekly workout summary response')
    }

    return data
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
