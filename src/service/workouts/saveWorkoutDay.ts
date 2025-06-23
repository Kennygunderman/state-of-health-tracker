import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import {WorkoutDay} from '@data/models/WorkoutDay'
import {httpPost} from '@service/http/httpUtil'

import CrashUtility from '../../utility/CrashUtility'

const VoidResponse = io.unknown // Accepts any response (even empty)

export async function saveWorkoutDay(workoutDay: WorkoutDay): Promise<boolean> {
  try {
    const response = await httpPost(Endpoints.SaveWorkout, VoidResponse, workoutDay)

    if (response?.status != 201) {
      throw new Error(`Unexpected response status: ${response?.status}`)
    }

    return true
  } catch (error) {
    CrashUtility.recordError(error)
    console.error('Failed to save workout day:', error)
    return false
  }
}
