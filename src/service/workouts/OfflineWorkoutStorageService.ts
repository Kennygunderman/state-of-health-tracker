import * as FileSystem from 'expo-file-system'

import {WorkoutDay} from '@data/models/WorkoutDay'
import {compareIsoDateStrings} from '../../utility/DateUtility'

const OFFLINE_FILE_PATH = `${FileSystem.documentDirectory}unsynced-workouts.json`
const TEMP_FILE_PATH = `${FileSystem.documentDirectory}unsynced-workouts.tmp.json`

class OfflineWorkoutStorageService {
  private isLocked = false

  private async withLock(task: () => Promise<void>) {
    if (this.isLocked) {
      console.log('[OfflineStorage] Write in progress, skipping.')
      return
    }

    this.isLocked = true
    try {
      await task()
    } finally {
      this.isLocked = false
    }
  }

  async readAll(): Promise<WorkoutDay[]> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(OFFLINE_FILE_PATH)
      if (!fileInfo.exists) return []

      const content = await FileSystem.readAsStringAsync(OFFLINE_FILE_PATH)
      return JSON.parse(content || '[]')
    } catch (error) {
      console.error('Failed to read offline workouts:', error)
      return []
    }
  }

  async save(workoutDay: WorkoutDay): Promise<void> {
    await this.withLock(async () => {
      const existing = await this.readAll()

      const updated = existing.filter(w => !compareIsoDateStrings(w.date, workoutDay.date))

      updated.push(workoutDay)

      const json = JSON.stringify(updated)
      await FileSystem.writeAsStringAsync(TEMP_FILE_PATH, json)
      await FileSystem.moveAsync({
        from: TEMP_FILE_PATH,
        to: OFFLINE_FILE_PATH
      })
    })
  }

  async clear(): Promise<void> {
    await this.withLock(async () => {
      const fileInfo = await FileSystem.getInfoAsync(OFFLINE_FILE_PATH)
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(OFFLINE_FILE_PATH)
      }
    })
  }

  async deleteAllSynced(): Promise<void> {
    await this.withLock(async () => {
      const allWorkouts = await this.readAll()
      const unsyncedOnly = allWorkouts.filter(w => !w.synced)

      const json = JSON.stringify(unsyncedOnly)
      await FileSystem.writeAsStringAsync(TEMP_FILE_PATH, json)
      await FileSystem.moveAsync({
        from: TEMP_FILE_PATH,
        to: OFFLINE_FILE_PATH
      })

      console.log(`Deleted ${allWorkouts.length - unsyncedOnly.length} synced workout(s).`)
    })
  }

  async findLocalWorkoutByDate(date: string): Promise<WorkoutDay | null> {
    const workouts = await this.readAll()
    const workout = workouts.find(w => compareIsoDateStrings(w.date, date))
    return workout || null
  }
}

const offlineWorkoutStorageService = new OfflineWorkoutStorageService()
export default offlineWorkoutStorageService
