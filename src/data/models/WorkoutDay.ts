import {v4 as uuidv4} from 'uuid'

import {DailyExercise} from './DailyExercise'

export interface WorkoutDay {
  id?: string // nullable id for new offline workouts
  userId: string
  date: string
  dailyExercises: DailyExercise[]
  updatedAt: number
  syncAttempts?: number // track how many times we've tried to sync this workout
  synced?: boolean // track if local data is dirty and needs to be synced
}

export function createWorkoutDay(userId: string, date: string, dailyExercises: DailyExercise[] = []): WorkoutDay {
  return {
    userId,
    date,
    updatedAt: Date.now(),
    dailyExercises
  }
}
