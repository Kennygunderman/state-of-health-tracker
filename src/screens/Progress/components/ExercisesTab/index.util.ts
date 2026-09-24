import type {PrCardData} from '../NewPrCard'
import {Exercise} from '@data/models/Exercise'
import {PersonalRecord, RecordTypeEnum, SessionSummary} from '@data/models/PersonalRecord'

const latestCompletedAt = (exercise: Exercise): string =>
  exercise.latestCompletedSets.reduce(
    (latest, set) => (set.completedAt && set.completedAt > latest ? set.completedAt : latest),
    ''
  )

/**
 * Picks the exercise to show by default: the one with the most logged sets,
 * tie-broken by the most recently completed set.
 */
export const getDefaultExerciseId = (exercises: Exercise[]): string | undefined => {
  if (exercises.length === 0) return undefined

  let bestExercise = exercises[0]

  exercises.slice(1).forEach(exercise => {
    const hasMoreSets = exercise.totalCompletedSets > bestExercise.totalCompletedSets
    const isMoreRecent =
      exercise.totalCompletedSets === bestExercise.totalCompletedSets &&
      latestCompletedAt(exercise) > latestCompletedAt(bestExercise)

    if (hasMoreSets || isMoreRecent) {
      bestExercise = exercise
    }
  })

  return bestExercise.id
}

/**
 * Builds the "new PR" celebration card — only when the exercise's max-weight
 * record was achieved in the latest session. `deltaLbs` compares against the
 * best top set from any earlier session, or null when there is no prior data.
 */
export const buildPrCard = (
  records: PersonalRecord[],
  sessions: SessionSummary[],
  selectedExerciseId: string | undefined
): PrCardData | null => {
  const maxWeightRecord = records.find(
    record => record.exerciseId === selectedExerciseId && record.recordType === RecordTypeEnum.MAX_WEIGHT
  )
  const latestSession = sessions[0] ?? null
  const isNewPR = !!(maxWeightRecord && latestSession && maxWeightRecord.achievedAt.slice(0, 10) === latestSession.date)

  if (!isNewPR || !maxWeightRecord?.repsAtRecord) {
    return null
  }

  const previousBestWeight = sessions
    .filter(session => session.date < latestSession.date)
    .reduce((best, session) => Math.max(best, session.topSet?.weight ?? 0), 0)

  return {
    weight: maxWeightRecord.value,
    reps: maxWeightRecord.repsAtRecord,
    date: maxWeightRecord.achievedAt.slice(0, 10),
    deltaLbs: previousBestWeight > 0 ? Math.round(maxWeightRecord.value - previousBestWeight) : null
  }
}
