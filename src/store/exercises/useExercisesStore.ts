import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { fetchExercises } from "../../service/exercises/fetchExercises";
import { CreateExercisePayload, Exercise } from "../../data/models/Exercise";
import { CreateExerciseEvent, CreateExerciseEventSubject$ } from "../../screens/CreateExercise";
import { createExercise } from "../../service/exercises/createExercise";
import { combineExerciseNameType } from "../../utility/combineExerciseNameType";
import { deleteExercise } from "../../service/exercises/deleteExercise";
import { ExerciseScreenUpdateSubject$ } from "../../screens/AddExercise";
import useExerciseTemplateStore from "../exerciseTemplates/useExerciseTemplateStore";
import { DELETE_EXERCISE_ERROR, DELETE_EXERCISE_SUCCESS } from "../../constants/Strings";

export type ExercisesState = {
  exercises: Exercise[]
  getExercises: (exerciseIds: string[]) => Exercise[]
  fetchExercises: () => Promise<void>
  createExercise: (exercise: CreateExercisePayload) => Promise<void>
  deleteExercise: (exerciseId: string) => Promise<void>
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
        // gracefully handle the error
      }
    },
    createExercise: async (exercise: CreateExercisePayload) => {
      const { exercises } = get();
      const existingExercise = exercises.find(
        e => e.name === exercise.name && e.exerciseType === exercise.exerciseType
      );

      if (existingExercise) {
        CreateExerciseEventSubject$.next({
          event: CreateExerciseEvent.Exists,
          exerciseName: combineExerciseNameType(exercise.name, exercise.exerciseType)
        });
        return;
      }

      try {
       const exerciseCreated = await createExercise(exercise);
       set({ exercises: [...exercises, exerciseCreated]});
        CreateExerciseEventSubject$.next({
          event: CreateExerciseEvent.Created,
          exerciseName: combineExerciseNameType(exercise.name, exercise.exerciseType)
        });
      } catch (error) {
        CreateExerciseEventSubject$.next({ event: CreateExerciseEvent.Error, exerciseName: '' });
      }
    },
    deleteExercise: async (exerciseId: string) => {
      try {
        ExerciseScreenUpdateSubject$.next({ isUpdating: true });
        await deleteExercise(exerciseId);

        set((state) => {
          state.exercises = state.exercises.filter(exercise => exercise.id !== exerciseId);
        });

        useExerciseTemplateStore.getState().removeExerciseFromAllTemplates(exerciseId);

        ExerciseScreenUpdateSubject$.next({ isUpdating: false,
          updatePayload: {
            success: true,
            message: DELETE_EXERCISE_SUCCESS
          }
        })
      } catch (error) {
        ExerciseScreenUpdateSubject$.next({ isUpdating: false,
          updatePayload: {
            success: false,
            message: DELETE_EXERCISE_ERROR
          }
        })
      }
    }
  }))
)

export default useExercisesStore;
