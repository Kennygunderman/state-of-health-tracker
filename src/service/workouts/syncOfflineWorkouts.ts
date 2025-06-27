import offlineWorkoutStorageService from './OfflineWorkoutStorageService'
import {saveWorkoutDay} from './saveWorkoutDay'

import {updateWorkoutDay} from '@service/workouts/updateWorkoutDay'
import {WorkoutDay} from '@data/models/WorkoutDay'

import {isServerFailureError} from '../../utility/isServerFailureError'
import {compareIsoDateStrings} from '../../utility/DateUtility'

/**
 * Attempts to sync all unsynced workouts that are not from today.
 * - If a workout syncs successfully, marks it as synced.
 * - If a workout fails 3 times, deletes it.
 * @param todayISO - ISO date string (e.g., '2025-10-20')
 */
export default async function syncOfflineWorkouts(todayISO: string) {
  const workouts = await offlineWorkoutStorageService.readAll()

  for (const workout of workouts) {
    if (compareIsoDateStrings(workout.date, todayISO)) continue

    if (workout.synced) continue

    try {
      let modifiedWorkout: WorkoutDay
      if (workout.id) {
        modifiedWorkout = await updateWorkoutDay(workout)
      } else {
        modifiedWorkout = await saveWorkoutDay(workout)
      }

      if (modifiedWorkout) {
        await offlineWorkoutStorageService.save({
          ...workout,
          synced: true,
          syncAttempts: 0
        })
      }
    } catch (err) {
      if (!isServerFailureError(err)) {
        continue
      }

      const attempts = (workout.syncAttempts ?? 0) + 1

      if (attempts >= 3) {
        await offlineWorkoutStorageService.deleteByDate(workout.date)
      } else {
        await offlineWorkoutStorageService.save({
          ...workout,
          syncAttempts: attempts
        })
      }
    }
  }

  // Clean up any records marked as synced
  await offlineWorkoutStorageService.deleteAllSynced()
}
