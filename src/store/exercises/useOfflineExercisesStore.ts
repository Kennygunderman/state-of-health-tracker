import {Exercise} from '@data/models/Exercise'
import {create} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import {persist} from 'zustand/middleware'
import {zustandAsyncStorage} from '@store/zustandAsyncStorage'

const MAX_OFFLINE_VALUES = 50

export type OfflineExercisesState = {
  offlineExercises: Exercise[]
  setOfflineExercises: (exercises: Exercise[]) => void
}

const useOfflineExercisesStore = create<OfflineExercisesState>()(
  persist(
    immer((set, get) => ({
      offlineExercises: [],
      setOfflineExercises: (exercises: Exercise[]) => {
        set(state => {
          state.offlineExercises = exercises.slice(0, MAX_OFFLINE_VALUES)
        })
      }
    })),
    {
      name: 'offline-exercises-store',
      storage: zustandAsyncStorage
    }
  )
)

export default useOfflineExercisesStore
