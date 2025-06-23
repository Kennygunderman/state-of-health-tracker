import {create} from 'zustand'
import {persist} from 'zustand/middleware'

import {zustandAsyncStorage} from '@store/zustandAsyncStorage'

type UserDataStore = {
  currentWeight: number
  targetWorkouts: number
  targetCalories: number
  setCurrentWeight: (weight: number) => void
  setTargetWorkouts: (value: number) => void
  setTargetCalories: (value: number) => void
}

const useUserDataStore = create<UserDataStore>()(
  persist(
    set => ({
      currentWeight: 180,
      targetWorkouts: 5,
      targetCalories: 1800,
      setCurrentWeight: weight => set({currentWeight: weight}),
      setTargetWorkouts: value => set({targetWorkouts: value}),
      setTargetCalories: value => set({targetCalories: value})
    }),
    {
      name: 'user-data-store',
      storage: zustandAsyncStorage
    }
  )
)

export default useUserDataStore
