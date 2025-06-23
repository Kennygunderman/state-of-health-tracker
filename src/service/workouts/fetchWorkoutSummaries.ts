import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import {Pagination} from '../../data/models/Pagination'
import {WorkoutSummary} from '../../data/models/WorkoutSummary'
import CrashUtility from '../../utility/CrashUtility'
import {httpGet} from '../http/httpUtil'

const BestSetResponse = io.type({
  weight: io.number,
  reps: io.number
})

const ExerciseSummaryResponse = io.type({
  setsCompleted: io.number,
  bestSet: io.union([BestSetResponse, io.undefined]),
  exercise: io.type({
    name: io.string
  })
})

const WorkoutSummaryResponse = io.type({
  workoutDayId: io.string,
  day: io.string,
  totalWeight: io.number,
  exercises: io.array(ExerciseSummaryResponse)
})

const WorkoutSummariesApiResponse = io.type({
  summaries: io.array(WorkoutSummaryResponse),
  pagination: io.type({
    page: io.number,
    limit: io.number,
    total: io.number,
    totalPages: io.number
  })
})

export async function fetchWorkoutSummaries(page: number = 1): Promise<{
  summaries: WorkoutSummary[]
  pagination: Pagination
}> {
  try {
    const response = await httpGet(Endpoints.WorkoutSummaries + `?page=${page}&limit=15`, WorkoutSummariesApiResponse)

    const data = response?.data

    if (!data?.summaries) throw new Error('No workout summaries returned')

    return {
      summaries: data.summaries,
      pagination: data.pagination
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
