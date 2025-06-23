import * as io from 'io-ts'
import CrashUtility from '../../utility/CrashUtility'

import { Exercise } from '../../data/models/Exercise'
import { mapExerciseBodyPart, mapExerciseType } from '../../data/converters/ExerciseConverter'
import Endpoints from "../../constants/Endpoints";
import { httpGet } from "../http/httpUtil";

const LatestCompletedSet = io.type({
  id: io.string,
  reps: io.number,
  weight: io.number,
  setNumber: io.union([io.number, io.undefined, io.null]),
  completed: io.union([io.boolean, io.undefined, io.null]),
  completedAt: io.union([io.string, io.undefined, io.null]),
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

    return data.map((ex): Exercise => ({
      id: ex.id,
      name: ex.name,
      exerciseType: mapExerciseType(ex.exerciseType),
      exerciseBodyPart: mapExerciseBodyPart(ex.exerciseBodyPart),
      latestCompletedSets: ex.latestCompletedSets.map(set => ({
        id: set.id,
        reps: set.reps,
        weight: set.weight,
        setNumber: set.setNumber ?? 0,
        completed: set.completed ?? false,
        completedAt: set.completedAt,
      })),
    }));
  } catch (error) {
    CrashUtility.recordError(error)
    throw error;
  }
}
