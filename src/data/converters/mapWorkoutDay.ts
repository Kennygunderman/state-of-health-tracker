import * as io from 'io-ts'

import {mapExerciseBodyPart, mapExerciseType} from '@data/converters/ExerciseConverter'
import {WorkoutDay} from '@data/models/WorkoutDay'
import {WorkoutDayResponse} from '@data/decoders/WorkoutDayDecoder'

export function mapWorkoutDay(data: io.TypeOf<typeof WorkoutDayResponse>): WorkoutDay {
  return {
    id: data.id,
    date: data.date,
    userId: data.userId,
    updatedAt: data.updatedAt,
    dailyExercises: data.dailyExercises.map(entry => ({
      id: entry.dailyExerciseId,
      dailyExerciseId: entry.dailyExerciseId,
      order: entry.order ?? 0,
      exercise: {
        id: entry.exercise.id,
        name: entry.exercise.name,
        exerciseType: mapExerciseType(entry.exercise.exerciseType),
        exerciseBodyPart: mapExerciseBodyPart(entry.exercise.exerciseBodyPart),
        latestCompletedSets: []
      },
      sets: entry.sets
    }))
  }
}
