import CrashUtility from '../../utility/CrashUtility'

import offlineWorkoutStorageService from './OfflineWorkoutStorageService'
import {saveWorkoutDay} from './saveWorkoutDay'

const syncOfflineWorkouts = async () => {
  try {
    const workouts = await offlineWorkoutStorageService.readAll()

    for (const workout of workouts) {
      if (workout.synced) continue
      const success = await saveWorkoutDay(workout)
      if (success) {
        workout.synced = true
        await offlineWorkoutStorageService.save(workout)
      }
    }

    await offlineWorkoutStorageService.deleteAllSynced()
  } catch (error) {
    CrashUtility.recordError(error)
  }
}

export default syncOfflineWorkouts
