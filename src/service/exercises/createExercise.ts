import {mapExerciseBodyPart, mapExerciseType} from '@data/converters/ExerciseConverter'
import {CreateExercisePayload, Exercise} from '@data/models/Exercise'
import {httpPost} from '@service/http/httpUtil'
import * as io from 'io-ts'

import Endpoints from '@constants/Endpoints'

import CrashUtility from '../../utility/CrashUtility'

const ExerciseResponse = io.type({
  id: io.string,
  name: io.string,
  exerciseType: io.string,
  exerciseBodyPart: io.string
})

export async function createExercise(payload: CreateExercisePayload): Promise<Exercise> {
  try {
    const response = await httpPost(Endpoints.Exercise, ExerciseResponse, payload)

    if (!response || !response.data) {
      throw new Error('Invalid response when creating exercise')
    }

    return {
      id: response.data.id,
      name: response.data.name,
      exerciseType: mapExerciseType(response.data.exerciseType),
      exerciseBodyPart: mapExerciseBodyPart(response.data.exerciseBodyPart),
      latestCompletedSets: []
    }
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
