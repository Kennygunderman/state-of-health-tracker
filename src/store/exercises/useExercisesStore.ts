import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { fetchExercises } from "../../service/exercises/fetchExercises";
import { Exercise } from "./models/Exercise";

export type ExercisesState = {
  exercises: Exercise[]
  fetchExercises: () => Promise<void>
}

const useExercisesStore = create<ExercisesState>()(
  immer((set) => ({
    exercises: [],
    fetchExercises: async () => {
      try {
        const exercises = await fetchExercises('BCsEDn7nMXatgkegN83pTksIcGs2')

        set((state) => {
          state.exercises = exercises
        })

      } catch (error) {
        console.error('Failed to fetch exercises', error)
      }
    },
  }))
)

export default useExercisesStore;
