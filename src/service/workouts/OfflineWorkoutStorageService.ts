import * as FileSystem from 'expo-file-system';
import { WorkoutDay } from '../../data/models/WorkoutDay';

const OFFLINE_FILE_PATH = `${FileSystem.documentDirectory}unsynced-workouts.json`;

class OfflineWorkoutStorageService {
  async save(workoutDay: WorkoutDay): Promise<void> {
    try {

      console.log('saving workout:', workoutDay);
      const existing = await this.readAll();

      const updated = existing.filter((w) => w.date !== workoutDay.date);
      updated.push(workoutDay);

      await FileSystem.writeAsStringAsync(
        OFFLINE_FILE_PATH,
        JSON.stringify(updated)
      );
    } catch (error) {
      console.error('Failed to save unsynced workout:', error);
    }
  }

  async readAll(): Promise<WorkoutDay[]> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(OFFLINE_FILE_PATH);
      if (!fileInfo.exists) return [];

      const content = await FileSystem.readAsStringAsync(OFFLINE_FILE_PATH);
      return JSON.parse(content || '[]');
    } catch (error) {
      console.error('Failed to read unsynced workouts:', error);
      return [];
    }
  }

  async clear(): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(OFFLINE_FILE_PATH);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(OFFLINE_FILE_PATH);
      }
    } catch (error) {
      console.error('Failed to clear offline workouts:', error);
    }
  }

  async deleteAllSynced(): Promise<void> {
    try {
      const allWorkouts = await this.readAll();
      const unsyncedOnly = allWorkouts.filter((w) => !w.synced);

      await FileSystem.writeAsStringAsync(
        OFFLINE_FILE_PATH,
        JSON.stringify(unsyncedOnly)
      );

      console.log(`Deleted ${allWorkouts.length - unsyncedOnly.length} synced workout(s).`);
    } catch (error) {
      console.error('Failed to delete synced workouts:', error);
    }
  }

  async hasData(): Promise<boolean> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(OFFLINE_FILE_PATH);
      return fileInfo.exists;
    } catch {
      return false;
    }
  }
}

const offlineWorkoutStorageService = new OfflineWorkoutStorageService();
export default offlineWorkoutStorageService;
