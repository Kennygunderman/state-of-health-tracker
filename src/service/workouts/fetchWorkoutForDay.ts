import * as io from 'io-ts'

import {mapExerciseBodyPart, mapExerciseType} from '@data/converters/ExerciseConverter'
import {WorkoutDay} from '@data/models/WorkoutDay'
import {getUserId} from '@service/auth/userStorage'
import {httpGet} from '@service/http/httpUtil'

import CrashUtility from '../../utility/CrashUtility'

const ExerciseSetResponse = io.type({
  id: io.string,
  reps: io.number,
  weight: io.number,
  completed: io.boolean
})

const ExerciseResponse = io.type({
  id: io.string,
  name: io.string,
  exerciseType: io.string,
  exerciseBodyPart: io.string
})

const DailyExerciseResponse = io.type({
  dailyExerciseId: io.string,
  exercise: ExerciseResponse,
  order: io.union([io.number, io.undefined]),
  sets: io.array(ExerciseSetResponse)
})

const WorkoutDayResponse = io.type({
  id: io.string,
  date: io.string,
  dailyExercises: io.array(DailyExerciseResponse)
})

export async function fetchWorkoutForDay(isoDayStamp: string): Promise<WorkoutDay> {
  try {
    const response = await httpGet(`http://192.168.4.104:3000/api/workouts/${isoDayStamp}`, WorkoutDayResponse)

    const data = response?.data
    const userId = await getUserId()

    if (!response || !data || !userId) throw new Error('Error fetching workout for day')

    return {
      id: data.id,
      date: data.date,
      userId: userId,
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
  } catch (error) {
    CrashUtility.recordError(error)
    throw error
  }
}
