import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createWorkoutDay, WorkoutDay } from "../../data/models/WorkoutDay";
import { getCurrentDateISO } from "../../utility/DateUtility";
import { Exercise } from "../exercises/models/Exercise";
import { createDailyExercise, DailyExercise } from "../dailyExerciseEntries/models/DailyExercise";
import { createSet } from "../exercises/models/ExerciseSet";
import offlineWorkoutStorageService from "../../service/workouts/OfflineWorkoutStorageService";

export type DailyWorkoutState = {
  currentWorkoutDay: WorkoutDay | null;
  initCurrentWorkoutDay: () => Promise<void>;
  addDailyExercise: (exercise: Exercise) => boolean;
  deleteDailyExercise: (dailyExerciseId: string) => void;
  updateDailyExercises: (dailyExercises: DailyExercise[]) => void;
  addSet: (exercise: Exercise) => void;
  completeSet: (
    exercise: Exercise,
    setId: string,
    isCompleted: boolean,
    weight?: number,
    reps?: number
  ) => void;
  deleteSet: (exercise: Exercise, setId: string) => void;
};

const useDailyWorkoutEntryStore = create<DailyWorkoutState>()(
  immer((set, get) => {
    const persist = async (state: { currentWorkoutDay: WorkoutDay | null }) => {
      if (state.currentWorkoutDay) {
        await offlineWorkoutStorageService.save(state.currentWorkoutDay);
      }
    };

    return {
      currentWorkoutDay: null,

      initCurrentWorkoutDay: async () => {
        const today = getCurrentDateISO();
        const localWorkouts = await offlineWorkoutStorageService.readAll();
        const localWorkout = localWorkouts.find((w) => w.date === today);

        if (localWorkout) {
          set((state) => {
            state.currentWorkoutDay = localWorkout;
          });
          return;
        }

        const newWorkout = createWorkoutDay('BCsEDn7nMXatgkegN83pTksIcGs2', today);
        await offlineWorkoutStorageService.save(newWorkout);

        set((state) => {
          state.currentWorkoutDay = newWorkout;
        });
      },

      addDailyExercise: (exercise) => {
        let wasAdded = true;

        set((state) => {
          const workout = state.currentWorkoutDay;
          if (!workout) return;

          if (workout.dailyExercises.some(e => e.exercise.name === exercise.name)) {
            wasAdded = false;
            return;
          }

          workout.dailyExercises.push(createDailyExercise(exercise));
        })

        persist(get());

        return wasAdded;
      },

      deleteDailyExercise: (dailyExerciseId) => {
        set((state) => {
          const workout = state.currentWorkoutDay;
          if (!workout) return;

          workout.dailyExercises = workout.dailyExercises.filter(e => e.id !== dailyExerciseId)
        })

        persist(get());
      },

      updateDailyExercises: (dailyExercises) => {
        set((state) => {
          const workout = state.currentWorkoutDay;
          if (!workout) return;

          workout.dailyExercises = dailyExercises;
        })

        persist(get());
      },

      addSet: (exercise) => {
        set((state) => {
          const workout = state.currentWorkoutDay;
          if (!workout) return;

          const target = workout.dailyExercises.find(e => e.exercise.name === exercise.name);
          if (!target) return;

          target.sets.push(createSet());
        })

        persist(get());
      },

      completeSet: (exercise, setId, isCompleted, weight, reps) => {
        set((state) => {
          const workout = state.currentWorkoutDay;
          if (!workout) return;

          const entry = workout.dailyExercises.find(e => e.exercise.name === exercise.name);
          const setItem = entry?.sets.find(s => s.id === setId);
          if (!setItem) return;

          setItem.completed = isCompleted;
          if (weight !== undefined) setItem.weight = weight;
          if (reps !== undefined) setItem.reps = reps;
          setItem.setNumber = isCompleted ? (entry?.sets.length || 0) + 1 : null;
          setItem.completedAt = isCompleted ? new Date().toISOString() : null;
        })

        persist(get());
      },

      deleteSet: (exercise, setId) => {
        set((state) => {
          const workout = state.currentWorkoutDay;
          if (!workout) return;

          const entry = workout.dailyExercises.find(e => e.exercise.name === exercise.name);
          if (!entry) return;

          entry.sets = entry.sets.filter(s => s.id !== setId);
        })

        persist(get());
      },
    };
  })
);

export default useDailyWorkoutEntryStore;
