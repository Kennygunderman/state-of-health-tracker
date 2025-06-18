import offlineWorkoutStorageService from "./OfflineWorkoutStorageService";
import { saveWorkoutDay } from "./saveWorkoutDay";
import CrashUtility from "../../utility/CrashUtility";

// userId = 'BCsEDn7nMXatgkegN83pTksIcGs2'
const syncOfflineWorkouts = async (userId: string) => {
  try {
    const workouts = await offlineWorkoutStorageService.readAll();

    let syncedCount = 0;

    for (const workout of workouts) {
      const success = await saveWorkoutDay(userId, workout);
      if (success) {
        workout.synced = true;
        await offlineWorkoutStorageService.save(workout);
        syncedCount++;
      }
    }

    await offlineWorkoutStorageService.deleteAllSynced()
  } catch (error) {
    CrashUtility.recordError(error);
  }
};

export default syncOfflineWorkouts;
