import offlineWorkoutStorageService from "./OfflineWorkoutStorageService";
import { saveWorkoutDay } from "./saveWorkoutDay";
import CrashUtility from "../../utility/CrashUtility";

// userId = 'BCsEDn7nMXatgkegN83pTksIcGs2'
const syncOfflineWorkouts = async (userId: string) => {
  try {
    const workouts = await offlineWorkoutStorageService.readAll();

    for (const workout of workouts) {
      if (workout.synced) continue;
      const success = await saveWorkoutDay(userId, workout);
      if (success) {
        workout.synced = true;
        await offlineWorkoutStorageService.save(workout);
      }
    }

    await offlineWorkoutStorageService.deleteAllSynced()
  } catch (error) {
    CrashUtility.recordError(error);
  }
};

export default syncOfflineWorkouts;
