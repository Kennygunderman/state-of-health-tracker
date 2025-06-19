import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { fetchExercises } from "../../service/exercises/fetchExercises";
import { Exercise } from "../../data/models/Exercise";

export type ExercisesState = {
  exercises: Exercise[]
  fetchExercises: () => Promise<void>
  getExercises: (exerciseIds: string[]) => Exercise[]
}

const useExercisesStore = create<ExercisesState>()(
  immer((set, get) => ({
    exercises: [],
    getExercises: (exerciseIds: string[]) => {
      const exercises = get().exercises
      return exercises.filter(exercise => exerciseIds.includes(exercise.id))
    },
    fetchExercises: async () => {
      try {
        const exercises = await fetchExercises()

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
