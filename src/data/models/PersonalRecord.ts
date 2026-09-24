export enum RecordTypeEnum {
  MAX_WEIGHT = 'MAX_WEIGHT',
  MAX_REPS = 'MAX_REPS',
  MAX_ESTIMATED_1RM = 'MAX_ESTIMATED_1RM',
  MAX_VOLUME = 'MAX_VOLUME',
  MAX_DURATION = 'MAX_DURATION',
  MAX_DISTANCE = 'MAX_DISTANCE'
}

export interface PersonalRecord {
  id: string
  exerciseId: string
  exerciseName?: string
  recordType: string
  value: number
  unit: string
  repsAtRecord?: number | null
  achievedAt: string
}

export interface ExerciseHistoryEntry {
  setId: string
  date: string
  reps: number | null
  weight: number | null
  addedWeight: number | null
  durationSeconds: number | null
  distanceMeters: number | null
  rpe: number | null
}

export interface SessionSummary {
  date: string
  topSet: {weight: number; reps: number} | null
  setCount: number
  estimatedOneRepMax: number | null
}
