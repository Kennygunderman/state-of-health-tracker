import {httpGet} from '@service/http/httpUtil'
import Endpoints from '@constants/Endpoints'

import {WorkoutDay} from '@data/models/WorkoutDay'
import {mapWorkoutDay} from '@data/converters/mapWorkoutDay'
import {WorkoutDayResponse} from '@data/decoders/WorkoutDayDecoder'

import CrashUtility from '../../utility/CrashUtility'

export async function fetchWorkoutForDay(isoDayStamp: string): Promise<WorkoutDay | null> {
  try {
    const response = await httpGet(`${Endpoints.Workout}${isoDayStamp}`, WorkoutDayResponse)

    const data = response?.data

    if (!response) throw new Error('Error fetching workout for day')

    // no workout found for the day
    if (!data) return null

    return mapWorkoutDay(data)
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
