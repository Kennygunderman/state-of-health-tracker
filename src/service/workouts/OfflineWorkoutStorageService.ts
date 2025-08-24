import {WorkoutDay} from '@data/models/WorkoutDay'
import * as FileSystem from 'expo-file-system'
import {RunData} from '../../types/run'

import {compareIsoDateStrings} from '../../utility/DateUtility'

const OFFLINE_FILE_PATH = `${FileSystem.documentDirectory}unsynced-workouts.json`
const TEMP_FILE_PATH = `${FileSystem.documentDirectory}unsynced-workouts.tmp.json`
const RUNS_FILE_PATH = `${FileSystem.documentDirectory}runs.json`
const RUNS_TEMP_FILE_PATH = `${FileSystem.documentDirectory}runs.tmp.json`

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

  async deleteByDate(date: string): Promise<void> {
    await this.withLock(async () => {
      const allWorkouts = await this.readAll()
      const remaining = allWorkouts.filter(w => !compareIsoDateStrings(w.date, date))

      const json = JSON.stringify(remaining)

      await FileSystem.writeAsStringAsync(TEMP_FILE_PATH, json)
      await FileSystem.moveAsync({
        from: TEMP_FILE_PATH,
        to: OFFLINE_FILE_PATH
      })

      console.log(`Deleted workout with date ${date}`)
    })
  }

  async findLocalWorkoutByDate(date: string): Promise<WorkoutDay | null> {
    const workouts = await this.readAll()
    const workout = workouts.find(w => compareIsoDateStrings(w.date, date))

    return workout || null
  }

  // Run storage methods
  async readAllRuns(): Promise<RunData[]> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(RUNS_FILE_PATH)

      if (!fileInfo.exists) return []

      const content = await FileSystem.readAsStringAsync(RUNS_FILE_PATH)

      return JSON.parse(content || '[]')
    } catch (error) {
      console.error('Failed to read runs:', error)

      return []
    }
  }

  async saveRun(runData: RunData): Promise<void> {
    await this.withLock(async () => {
      const existing = await this.readAllRuns()

      // Remove any existing run with the same ID
      const updated = existing.filter(r => r.id !== runData.id)

      updated.push(runData)

      const json = JSON.stringify(updated)

      await FileSystem.writeAsStringAsync(RUNS_TEMP_FILE_PATH, json)
      await FileSystem.moveAsync({
        from: RUNS_TEMP_FILE_PATH,
        to: RUNS_FILE_PATH
      })
    })
  }

  async getRuns(userId: string): Promise<RunData[]> {
    const allRuns = await this.readAllRuns()
    return allRuns.filter(run => run.userId === userId)
  }

  async deleteRun(runId: string): Promise<void> {
    await this.withLock(async () => {
      const allRuns = await this.readAllRuns()
      const remaining = allRuns.filter(r => r.id !== runId)

      const json = JSON.stringify(remaining)

      await FileSystem.writeAsStringAsync(RUNS_TEMP_FILE_PATH, json)
      await FileSystem.moveAsync({
        from: RUNS_TEMP_FILE_PATH,
        to: RUNS_FILE_PATH
      })

      console.log(`Deleted run with id ${runId}`)
    })
  }
}

const offlineWorkoutStorageService = new OfflineWorkoutStorageService()

export default offlineWorkoutStorageService
