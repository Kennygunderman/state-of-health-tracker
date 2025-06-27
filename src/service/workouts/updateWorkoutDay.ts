import Endpoints from '@constants/Endpoints'
import {WorkoutDay} from '@data/models/WorkoutDay'
import {mapWorkoutDay} from '@data/converters/mapWorkoutDay'
import {WorkoutDayResponse} from '@data/decoders/WorkoutDayDecoder'

import {httpPut} from '@service/http/httpUtil'
import CrashUtility from '../../utility/CrashUtility'

export async function updateWorkoutDay(workoutDay: WorkoutDay): Promise<WorkoutDay> {
  try {
    const response = await httpPut(Endpoints.Workout + workoutDay.id, WorkoutDayResponse, workoutDay)

    if (response?.status !== 200 || !response.data) {
      throw new Error(`Unexpected response: status=${response?.status}`)
    }

    const data = response.data

    const mappedWorkoutDay = mapWorkoutDay(data)
    mappedWorkoutDay.synced = true

    return mappedWorkoutDay
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
