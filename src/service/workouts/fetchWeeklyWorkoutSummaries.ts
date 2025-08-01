import {WeeklyWorkoutSummary} from '@data/models/WeeklyWorkoutSummary'
import {httpGet} from '@service/http/httpUtil'
import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import CrashUtility from '../../utility/CrashUtility'

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
