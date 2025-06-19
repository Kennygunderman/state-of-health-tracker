import * as io from 'io-ts'
import CrashUtility from '../../utility/CrashUtility'

import { createExercise, Exercise } from '../../store/exercises/models/Exercise'
import { mapExerciseBodyPart, mapExerciseType } from '../../store/exercises/utils/ExerciseConverter'
import Endpoints from "../../constants/Endpoints";
import { httpGet } from "../http/httpUtil";

const LatestCompletedSet = io.type({
  id: io.string,
  reps: io.number,
  weight: io.number,
  setNumber: io.number,
  completedAt: io.string,
});

const ExerciseResponse = io.type({
  id: io.string,
  name: io.string,
  exerciseType: io.string,
  exerciseBodyPart: io.string,
  latestCompletedSets: io.array(LatestCompletedSet),
});

const ExerciseArrayResponse = io.array(ExerciseResponse)

export async function fetchExercises(): Promise<Exercise[]> {
  try {
    const response = await httpGet(Endpoints.Exercises, ExerciseArrayResponse)

    const data = response?.data

    if (!response || !data) throw new Error('No exercises found')

    return data.map((ex) => {
      const exerciseType = mapExerciseType(ex.exerciseType)
      const exercise = createExercise(
        ex.name,
        exerciseType,
        mapExerciseBodyPart(ex.exerciseBodyPart),
        ex.latestCompletedSets.map(set => ({
          id: set.id,
          reps: set.reps,
          weight: set.weight,
          setNumber: set.setNumber,
          completedAt: new Date(set.completedAt)
        }))
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
