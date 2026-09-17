import {Exercise, ExerciseBodyPartEnum, ExerciseTypeEnum, LoggingTypeEnum} from '@data/models/Exercise'
import {PersonalRecord, RecordTypeEnum, SessionSummary} from '@data/models/PersonalRecord'

import {buildPrCard, getDefaultExerciseId} from '../index.util'

const EXERCISE_ID = 'exercise-1'

const makeRecord = (overrides: Partial<PersonalRecord> = {}): PersonalRecord => ({
  id: 'record-1',
  exerciseId: EXERCISE_ID,
  recordType: RecordTypeEnum.MAX_WEIGHT,
  value: 225,
  unit: 'lbs',
  repsAtRecord: 5,
  achievedAt: '2026-06-10T09:00:00.000Z',
  ...overrides
})

const makeSession = (overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  date: '2026-06-10',
  topSet: {weight: 225, reps: 5},
  setCount: 3,
  estimatedOneRepMax: 262,
  ...overrides
})

describe('buildPrCard', () => {
  it('returns the card when the max-weight record was achieved in the latest session', () => {
    const sessions = [makeSession(), makeSession({date: '2026-06-01', topSet: {weight: 200, reps: 5}})]

    expect(buildPrCard([makeRecord()], sessions, EXERCISE_ID)).toEqual({
      weight: 225,
      reps: 5,
      date: '2026-06-10',
      deltaLbs: 25
    })
  })

  it('returns null when the record was achieved in an older session', () => {
    const sessions = [makeSession({date: '2026-06-15'})]

    expect(buildPrCard([makeRecord({achievedAt: '2026-06-10T09:00:00.000Z'})], sessions, EXERCISE_ID)).toBeNull()
  })

  it('returns null when there is no max-weight record for the selected exercise', () => {
    const records = [makeRecord({exerciseId: 'other-exercise'}), makeRecord({recordType: RecordTypeEnum.MAX_REPS})]

    expect(buildPrCard(records, [makeSession()], EXERCISE_ID)).toBeNull()
  })

  it('returns null when there are no sessions', () => {
    expect(buildPrCard([makeRecord()], [], EXERCISE_ID)).toBeNull()
  })

  it('returns null when the record has no reps information', () => {
    expect(buildPrCard([makeRecord({repsAtRecord: null})], [makeSession()], EXERCISE_ID)).toBeNull()
  })

  it('returns a null delta when there is no earlier weighted session', () => {
    const sessions = [makeSession(), makeSession({date: '2026-06-01', topSet: null})]

    expect(buildPrCard([makeRecord()], sessions, EXERCISE_ID)?.deltaLbs).toBeNull()
  })

  it('returns null when no exercise is selected', () => {
    expect(buildPrCard([makeRecord()], [makeSession()], undefined)).toBeNull()
  })
})

const makeExercise = (id: string, overrides: Partial<Exercise> = {}): Exercise => ({
  id,
  name: `Exercise ${id}`,
  exerciseType: ExerciseTypeEnum.BARBELL,
  exerciseBodyPart: ExerciseBodyPartEnum.CHEST,
  loggingType: LoggingTypeEnum.WEIGHT_REPS,
  totalCompletedSets: 0,
  latestCompletedSets: [],
  ...overrides
})

const makeCompletedSet = (id: string, completedAt: string) => ({
  id,
  reps: 5,
  weight: 135,
  setNumber: 1,
  completed: true,
  completedAt
})

describe('getDefaultExerciseId', () => {
  it('returns undefined when there are no exercises', () => {
    expect(getDefaultExerciseId([])).toBeUndefined()
  })

  it('falls back to the first exercise when no exercise has logged sets', () => {
    expect(getDefaultExerciseId([makeExercise('a'), makeExercise('b')])).toBe('a')
  })

  it('picks the exercise with the most logged sets over the first alphabetical one', () => {
    const exercises = [
      makeExercise('a', {totalCompletedSets: 3}),
      makeExercise('b', {totalCompletedSets: 12}),
      makeExercise('c', {totalCompletedSets: 7})
    ]

    expect(getDefaultExerciseId(exercises)).toBe('b')
  })

  it('breaks set-count ties by the most recently completed set', () => {
    const exercises = [
      makeExercise('a', {
        totalCompletedSets: 5,
        latestCompletedSets: [makeCompletedSet('s1', '2026-05-01T09:00:00.000Z')]
      }),
      makeExercise('b', {
        totalCompletedSets: 5,
        latestCompletedSets: [makeCompletedSet('s2', '2026-06-20T09:00:00.000Z')]
      })
    ]

    expect(getDefaultExerciseId(exercises)).toBe('b')
  })

  it('keeps the first exercise on a tie with no recency signal', () => {
    const exercises = [makeExercise('a', {totalCompletedSets: 5}), makeExercise('b', {totalCompletedSets: 5})]

    expect(getDefaultExerciseId(exercises)).toBe('a')
  })
})
