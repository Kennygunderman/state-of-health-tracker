import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'

import {fetchWorkoutForDay} from '@service/workouts/fetchWorkoutForDay'
import {updateWorkoutDay} from '@service/workouts/updateWorkoutDay'
import {saveWorkoutDay} from '@service/workouts/saveWorkoutDay'
import {createWorkoutDay} from '@data/models/WorkoutDay'

/**
 * Synchronizes the workout for the specified day between remote and local storage.
 *
 * This function:
 * - Attempts to fetch the workout from the remote API.
 * - If a remote workout is found, compares it to the local version:
 *   - If the local version is newer and unsynced, pushes it to the remote.
 *   - Otherwise, updates the local storage with the remote version.
 * - If no remote workout exists:
 *   - Attempts to create it from any existing local workout.
 *   - If no local workout exists, creates a new empty workout for the day.
 * - If network requests fail (offline or errors), falls back to using the latest available local workout or creates a new one.
 *
 * Returns the resolved workout object that should be used as the current state.
 * Supports offline capabilities and ensures there is always a workout available locally.
 */
export async function syncWorkoutDay(today: string, userId: string) {
  try {
    console.log('[Sync] Fetching remote workout for', today)
    const remote = await fetchWorkoutForDay(today)

    if (remote) {
      console.log('[Sync] Found remote workout:', remote)

      const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
      console.log('[Sync] Found local workout:', local)

      if (local && !local.synced && local.updatedAt > remote.updatedAt) {
        console.log(local.updatedAt, remote.updatedAt)
        console.log('[Sync] Local is newer and unsynced — pushing local to remote')
        const updated = await updateWorkoutDay(local)
        console.log('[Sync] Remote update successful:', updated)

        return updated
      } else {
        console.log('[Sync] Remote is up-to-date — syncing remote -> local')
        await offlineWorkoutStorageService.save(remote)
        return remote
      }
    } else {
      console.log('[Sync] No remote workout found — attempting to push local to remote')

      try {
        const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
        console.log('[Sync] Local workout to sync:', local)

        if (local) {
          const newRemote = await saveWorkoutDay(local)
          console.log('[Sync] Created remote workout from local:', newRemote)

          await offlineWorkoutStorageService.save(newRemote)
          return newRemote
        } else {
          console.log('[Sync] No local workout found — creating new local workout')
          const newEmptyLocal = createWorkoutDay(userId, today)
          await offlineWorkoutStorageService.save(newEmptyLocal)
          return newEmptyLocal
        }
      } catch (error) {
        console.warn('[Sync] Failed to create remote workout — falling back to local', error)

        const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)

        if (local) {
          console.log('[Sync] Using existing local workout after remote failure:', local)
          return local
        } else {
          console.log('[Sync] No local workout available — creating new one')
          const newEmptyLocal = createWorkoutDay(userId, today)
          await offlineWorkoutStorageService.save(newEmptyLocal)
          return newEmptyLocal
        }
      }
    }
  } catch (error) {
    console.warn('[Sync] Failed to fetch remote workout — assuming offline:', error)

    const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)

    if (local) {
      console.log('[Sync] Using local workout due to fetch failure:', local)
      return local
    } else {
      console.log('[Sync] No local workout available — creating new one')
      const newEmptyLocal = createWorkoutDay(userId, today)
      await offlineWorkoutStorageService.save(newEmptyLocal)
      return newEmptyLocal
    }
  }
}

//
// try {
//   console.log('[Sync] Fetching remote workout for', today)
//   const remote = await fetchWorkoutForDay(today) // returns null if not found
//
//   if (remote) {
//     console.log('[Sync] Found remote workout:', remote)
//
//     const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
//     console.log('[Sync] Found local workout:', local)
//
//     if (local && !local.synced && local.updatedAt > remote.updatedAt) {
//       console.log(local.updatedAt, remote.updatedAt)
//       console.log('[Sync] Local is newer and unsynced — pushing local to remote')
//       const updated = await updateWorkoutDay(local)
//       console.log('[Sync] Remote update successful:', updated)
//
//       set({currentWorkoutDay: updated})
//     } else {
//       console.log('[Sync] Remote is up-to-date — syncing remote -> local')
//       await offlineWorkoutStorageService.save(remote)
//       set({currentWorkoutDay: remote})
//     }
//   } else {
//     console.log('[Sync] No remote workout found — attempting to push local to remote')
//
//     try {
//       const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
//       console.log('[Sync] Local workout to sync:', local)
//
//       if (local) {
//         const newRemote = await saveWorkoutDay(local)
//         console.log('[Sync] Created remote workout from local:', newRemote)
//
//         await offlineWorkoutStorageService.save(newRemote)
//         set({currentWorkoutDay: newRemote})
//       } else {
//         console.log('[Sync] No local workout found — creating new local workout')
//         const newEmptyLocal = createWorkoutDay(userId, today)
//         await offlineWorkoutStorageService.save(newEmptyLocal)
//         set({currentWorkoutDay: newEmptyLocal})
//       }
//     } catch (error) {
//       console.warn('[Sync] Failed to create remote workout — falling back to local', error)
//
//       const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
//
//       if (local) {
//         console.log('[Sync] Using existing local workout after remote failure:', local)
//         set({currentWorkoutDay: local})
//       } else {
//         console.log('[Sync] No local workout available — creating new one')
//         const newEmptyLocal = createWorkoutDay(userId, today)
//         await offlineWorkoutStorageService.save(newEmptyLocal)
//         set({currentWorkoutDay: newEmptyLocal})
//       }
//     }
//   }
// } catch (error) {
//   console.warn('[Sync] Failed to fetch remote workout — assuming offline:', error)
//
//   const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
//
//   if (local) {
//     console.log('[Sync] Using local workout due to fetch failure:', local)
//     set({currentWorkoutDay: local})
//   } else {
//     console.log('[Sync] No local workout available — creating new one')
//     const newEmptyLocal = createWorkoutDay(userId, today)
//     await offlineWorkoutStorageService.save(newEmptyLocal)
//     set({currentWorkoutDay: newEmptyLocal})
//   }
// } finally {
//   console.log('[Sync] Initialization complete')
//   set({isInitializing: false})
// }
