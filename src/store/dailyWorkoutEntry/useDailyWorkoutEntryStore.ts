import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createWorkoutDay, WorkoutDay } from "../../data/models/WorkoutDay";
import { getCurrentDateISO } from "../../utility/DateUtility";
import { Exercise } from "../exercises/models/Exercise";
import { createDailyExercise, DailyExercise } from "../dailyExerciseEntries/models/DailyExercise";
import { createSet } from "../exercises/models/ExerciseSet";
import offlineWorkoutStorageService from "../../service/workouts/OfflineWorkoutStorageService";
import syncOfflineWorkouts from "../../service/workouts/syncOfflineWorkouts";
import { fetchWorkoutForDay } from "../../service/workouts/fetchWorkoutForDay";

export type DailyWorkoutState = {
  currentWorkoutDay: WorkoutDay | null;
  initCurrentWorkoutDay: () => Promise<void>;
  isInitializing : boolean;
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
        await offlineWorkoutStorageService.save({
          ...state.currentWorkoutDay,
          synced: false
        });
      }
    };

    return {
      currentWorkoutDay: null,
      isInitializing: false,
      initCurrentWorkoutDay: async () => {
        set({ isInitializing: true });


        // 03wD83qf64Oq5YSXOd2plYifhoA2
        // BCsEDn7nMXatgkegN83pTksIcGs2
        const userId = 'BCsEDn7nMXatgkegN83pTksIcGs2';
        await syncOfflineWorkouts(userId);

        const today = getCurrentDateISO();

        try {
          const workout = await fetchWorkoutForDay(userId, today);
          workout.synced = true;
          await offlineWorkoutStorageService.save(workout);
          set({ currentWorkoutDay: workout, isInitializing: false });
        } catch (error) {
          let localWorkout = await offlineWorkoutStorageService.findLocalWorkoutByDate(today);
          if (!localWorkout) {
            // if no remote workout, create a new offline copy
            localWorkout = createWorkoutDay(userId, today);
            await offlineWorkoutStorageService.save(localWorkout);
          }
          set({ currentWorkoutDay: localWorkout, isInitializing: false });
        }
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
