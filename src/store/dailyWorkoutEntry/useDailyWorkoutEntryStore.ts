import {createDailyExercise, DailyExercise} from '@data/models/DailyExercise'
import {Exercise} from '@data/models/Exercise'
import {createSet} from '@data/models/ExerciseSet'
import {createWorkoutDay, WorkoutDay} from '@data/models/WorkoutDay'
import {fetchWorkoutForDay} from '@service/workouts/fetchWorkoutForDay'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import syncOfflineWorkouts from '@service/workouts/syncOfflineWorkouts'
import {useSessionStore} from '@store/session/useSessionStore'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import useAuthStore from '@store/auth/useAuthStore'
import {saveWorkoutDay} from '@service/workouts/saveWorkoutDay'
import {updateWorkoutDay} from '@service/workouts/updateWorkoutDay'

export type DailyWorkoutState = {
  currentWorkoutDay: WorkoutDay | null
  initCurrentWorkoutDay: () => Promise<void>
  isInitializing: boolean
  addDailyExercise: (exercise: Exercise) => boolean
  deleteDailyExercise: (dailyExerciseId: string) => void
  updateDailyExercises: (dailyExercises: DailyExercise[]) => void
  addSet: (exercise: Exercise) => void
  completeSet: (exercise: Exercise, setId: string, isCompleted: boolean, weight?: number, reps?: number) => void
  deleteSet: (exercise: Exercise, setId: string) => void
}

const useDailyWorkoutEntryStore = create<DailyWorkoutState>()(
  immer((set, get) => {
    const persist = async () => {
      const state = get()

      if (state.currentWorkoutDay) {
        await offlineWorkoutStorageService.save({
          ...state.currentWorkoutDay,
          updatedAt: Date.now(),
          synced: false
        })
      }
    }

    return {
      currentWorkoutDay: null,
      isInitializing: false,
      initCurrentWorkoutDay: async () => {
        set({isInitializing: true})
        await syncOfflineWorkouts()
        const today = useSessionStore.getState().sessionStartDateIso
        const userId = useAuthStore.getState().userId

        try {
          if (!userId) throw new Error('User ID not found')
        } catch (error) {
          set({isInitializing: false})
          return
        }

        try {
          const remote = await fetchWorkoutForDay(today) // returns null if not found

          if (remote) {
            // 1a. Workout exists remotely - compare timestamps
            const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)

            if (local && !local.synced && local.updatedAt > remote.updatedAt) {
              const updated = await updateWorkoutDay(local)
              set({currentWorkoutDay: updated})
            } else {
              await offlineWorkoutStorageService.save(remote) // sync remote -> local
              set({currentWorkoutDay: remote})
            }
          } else {
            // 1b. No workout exists remotely — create one
            try {
              const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)

              if (local) {
                const newRemote = await saveWorkoutDay(local)
                await offlineWorkoutStorageService.save(newRemote)
                set({currentWorkoutDay: newRemote})
              } else {
                // fallback safety if somehow no local still exists
                const newEmptyLocal = createWorkoutDay(userId, today)
                await offlineWorkoutStorageService.save(newEmptyLocal)
                set({currentWorkoutDay: newEmptyLocal})
              }
            } catch (error) {
              // 1b-i. Failed to create remotely (probably offline) — go local
              const local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)
              if (local) {
                set({currentWorkoutDay: local})
              } else {
                const newEmptyLocal = createWorkoutDay(userId, today) // no ID yet
                await offlineWorkoutStorageService.save(newEmptyLocal)
                set({currentWorkoutDay: newEmptyLocal})
              }
            }
          }
        } catch (error) {
          // 2. Failed to fetch workout remotely (probably offline)
          let local = await offlineWorkoutStorageService.findLocalWorkoutByDate(today)

          if (local) {
            set({currentWorkoutDay: local})
          } else {
            const newEmptyLocal = createWorkoutDay(userId, today)
            await offlineWorkoutStorageService.save(newEmptyLocal)
            set({currentWorkoutDay: newEmptyLocal})
          }
        } finally {
          set({isInitializing: false})
        }
      },

      addDailyExercise: exercise => {
        let wasAdded = true

        set(state => {
          const workout = state.currentWorkoutDay

          if (!workout) return

          if (workout.dailyExercises.some(e => e.exercise.name === exercise.name)) {
            wasAdded = false

            return
          }

          workout.dailyExercises.push(createDailyExercise(exercise, workout.dailyExercises.length + 1))
        })

        persist()

        return wasAdded
      },

      deleteDailyExercise: dailyExerciseId => {
        set(state => {
          const workout = state.currentWorkoutDay

          if (!workout) return

          const filtered = workout.dailyExercises.filter(e => e.id !== dailyExerciseId)

          workout.dailyExercises = filtered.map((e, index) => ({
            ...e,
            order: index + 1
          }))
        })

        persist()
      },

      updateDailyExercises: dailyExercises => {
        set(state => {
          const workout = state.currentWorkoutDay

          if (!workout) return

          // Reset order based on new position in array
          workout.dailyExercises = dailyExercises.map((exercise, index) => ({
            ...exercise,
            order: index + 1
          }))
        })

        persist()
      },
      addSet: exercise => {
        set(state => {
          const workout = state.currentWorkoutDay

          if (!workout) return

          const target = workout.dailyExercises.find(e => e.exercise.name === exercise.name)

          if (!target) return

          target.sets.push(createSet())
        })

        persist()
      },

      completeSet: (exercise, setId, isCompleted, weight, reps) => {
        set(state => {
          const workout = state.currentWorkoutDay

          if (!workout) return

          const entry = workout.dailyExercises.find(e => e.exercise.name === exercise.name)
          const setItem = entry?.sets.find(s => s.id === setId)

          if (!setItem) return

          setItem.completed = isCompleted
          if (weight !== undefined) setItem.weight = weight
          if (reps !== undefined) setItem.reps = reps
          setItem.setNumber = isCompleted ? (entry?.sets.length || 0) + 1 : null
          setItem.completedAt = isCompleted ? new Date().toISOString() : null
        })

        persist()
      },

      deleteSet: (exercise, setId) => {
        set(state => {
          const workout = state.currentWorkoutDay

          if (!workout) return

          const entry = workout.dailyExercises.find(e => e.exercise.name === exercise.name)

          if (!entry) return

          entry.sets = entry.sets.filter(s => s.id !== setId)
        })

        persist()
      }
    }
  })
)

export default useDailyWorkoutEntryStore
