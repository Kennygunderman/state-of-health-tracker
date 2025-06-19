import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { fetchExercises } from "../../service/exercises/fetchExercises";
import { CreateExercisePayload, Exercise } from "../../data/models/Exercise";
import { CreateExerciseEvent, CreateExerciseEventSubject$ } from "../../screens/CreateExercise";
import { createExercise } from "../../service/exercises/createExercise";
import CrashUtility from "../../utility/CrashUtility";

export type ExercisesState = {
  exercises: Exercise[]
  fetchExercises: () => Promise<void>
  createExercise: (exercise: CreateExercisePayload) => Promise<void>
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
        const exercises = await fetchExercises();

        set((state) => {
          state.exercises = exercises
        })

      } catch (error) {
        console.error('Failed to fetch exercises', error)
      }
    },
    createExercise: async (exercise: CreateExercisePayload) => {
      const { exercises } = get();
      const existingExercise = exercises.find(
        e => e.name === exercise.name && e.exerciseType === exercise.exerciseType
      );

      if (existingExercise) {
        CreateExerciseEventSubject$.next(CreateExerciseEvent.Exists);
        return;
      }

      try {
        const exerciseCreated = await createExercise(exercise);
        set({ exercises: [...exercises, exerciseCreated]})
      } catch (error) {
        CreateExerciseEventSubject$.next(CreateExerciseEvent.Error);
        CrashUtility.recordError(error);
      }
    }
  }))
)

export default useExercisesStore;
