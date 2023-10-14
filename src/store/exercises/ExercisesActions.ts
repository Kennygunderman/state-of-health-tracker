import { Exercise } from './models/Exercise';
import { ExerciseSet } from './models/ExerciseSet';

export const ADD_EXERCISE: string = 'ADD_EXERCISE';
export const DELETE_EXERCISE: string = 'DELETE_EXERCISE';
export const UPDATE_EXERCISE_LATEST_COMPLETED_SETS: string = 'UPDATE_EXERCISE_LATEST_COMPLETED_SETS';

export function addExercise(exercise: Exercise) {
    return {
        payload: exercise,
        type: ADD_EXERCISE,
    };
}

export function deleteExercise(exercise: Exercise) {
    return {
        payload: exercise,
        type: DELETE_EXERCISE,
    };
}

export function updateLatestCompletedSets(exercise: Exercise, set: ExerciseSet, setIndex: number) {
    return {
        payload: { exercise, set, setIndex },
        type: UPDATE_EXERCISE_LATEST_COMPLETED_SETS,
    };
}
