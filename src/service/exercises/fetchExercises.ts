import * as io from 'io-ts'
import CrashUtility from '../../utility/CrashUtility'

import { createExercise, Exercise } from '../../store/exercises/models/Exercise'
import { mapExerciseBodyPart, mapExerciseType } from '../../store/exercises/utils/ExerciseConverter'
import Endpoints from "../../constants/Endpoints";
import { httpGet } from "../http/httpUtil";

const ExerciseResponse = io.type({
  id: io.string,
  name: io.string,
  exerciseType: io.string,
  exerciseBodyPart: io.string,
})

const ExerciseArrayResponse = io.array(ExerciseResponse)

export async function fetchExercises(
  userId: string
): Promise<Exercise[]> {
  try {
    const response = await httpGet(Endpoints.Exercises, ExerciseArrayResponse, {
      headers: {
        'x-user-id': userId,
      },
    })

    if (!response) throw new Error('No exercises found')


    return response.map((ex) => {
      const exerciseType = mapExerciseType(ex.exerciseType)
      const exercise = createExercise(
        ex.name,
        exerciseType,
        mapExerciseBodyPart(ex.exerciseBodyPart)
      )

      return {
        ...exercise,
        id: ex.id
      }
    })
  } catch (error) {
    CrashUtility.recordError(error)
    throw error;
  }
}
