import { DailyExercise } from '../../data/models/DailyExercise';
import { Exercise } from '../../data/models/Exercise';

export const ADD_DAILY_EXERCISE: string = 'ADD_DAILY_EXERCISE';
export const DELETE_DAILY_EXERCISE: string = 'DELETE_DAILY_EXERCISE';
export const UPDATE_DAILY_EXERCISES: string = 'UPDATE_DAILY_EXERCISES';
export const ADD_DAILY_EXERCISE_SET: string = 'ADD_DAILY_EXERCISE_SET';
export const DELETE_DAILY_EXERCISE_SET: string = 'DELETE_DAILY_EXERCISE_SET';
export const COMPLETE_DAILY_EXERCISE_SET: string = 'COMPLETE_DAILY_EXERCISE_SET';
export const SET_EXERCISE_ENTRIES_SYNCED: string = 'SET_EXERCISE_ENTRIES_SYNCED';

export function addDailyExercise(date: string, exercise: Exercise) {
    return {
        payload: { date, exercise },
        type: ADD_DAILY_EXERCISE,
    };
}

export function deleteDailyExercise(date: string, dailyExerciseId: String) {
    return {
        payload: { date, dailyExerciseId },
        type: DELETE_DAILY_EXERCISE,
    };
}

export function updateDailyExercise(date: string, dailyExercises: DailyExercise[]) {
    return {
        payload: { date, dailyExercises },
        type: UPDATE_DAILY_EXERCISES,
    };
}

export function addSet(date: string, exercise: Exercise) {
    return {
        payload: { date, exercise },
        type: ADD_DAILY_EXERCISE_SET,
    };
}

export function completeSet(date: string, exercise: Exercise, setId: string, isCompleted: boolean, weight?: number, reps?: number) {
    return {
        payload: {
            date, exercise, setId, isCompleted, weight, reps,
        },
        type: COMPLETE_DAILY_EXERCISE_SET,
    };
}

export function deleteSet(date: string, exercise: Exercise, setId: string) {
    return {
        payload: { date, exercise, setId },
        type: DELETE_DAILY_EXERCISE_SET,
    };
}

export function setExerciseEntriesSynced() {
    return {
        payload: true,
        type: SET_EXERCISE_ENTRIES_SYNCED,
    };
}
