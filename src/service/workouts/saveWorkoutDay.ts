import Endpoints from '@constants/Endpoints'
import {WorkoutDay} from '@data/models/WorkoutDay'
import {mapWorkoutDay} from '@data/converters/mapWorkoutDay'
import {WorkoutDayResponse} from '@data/decoders/WorkoutDayDecoder'

import {httpPost} from '@service/http/httpUtil'

import CrashUtility from '../../utility/CrashUtility'

export async function saveWorkoutDay(workoutDay: WorkoutDay): Promise<WorkoutDay> {
  try {
    const response = await httpPost(Endpoints.Workout, WorkoutDayResponse, workoutDay)

    if (response?.status !== 201 || !response.data) {
      throw new Error(`Unexpected response: status=${response?.status}`)
    }

    const data = response.data

    const mappedWorkoutDay = mapWorkoutDay(data)
    mappedWorkoutDay.synced = true

    return mappedWorkoutDay
  } catch (error) {
    console.log('ERROR_SAVING', error)
    CrashUtility.recordError(error)
    throw error
  }
}
