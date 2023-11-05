import { Exercise } from './models/Exercise';
import { ExerciseSet } from './models/ExerciseSet';
import { WorkoutTemplate } from './models/WorkoutTemplate';

export const ADD_EXERCISE: string = 'ADD_EXERCISE';
export const DELETE_EXERCISE: string = 'DELETE_EXERCISE';
export const UPDATE_EXERCISE_LATEST_COMPLETED_SETS: string = 'UPDATE_EXERCISE_LATEST_COMPLETED_SETS';
export const ADD_WORKOUT_TEMPLATE: string = 'ADD_WORKOUT_TEMPLATE';
export const DELETE_WORKOUT_TEMPLATE: string = 'DELETE_WORKOUT_TEMPLATE';

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

export function addWorkoutTemplate(template: WorkoutTemplate) {
    return {
        payload: template,
        type: ADD_WORKOUT_TEMPLATE,
    };
}

export function deleteWorkoutTemplate(templateId: string) {
    return {
        payload: templateId,
        type: DELETE_WORKOUT_TEMPLATE,
    };
}

export function updateLatestCompletedSets(exercise: Exercise, set: ExerciseSet, setIndex: number) {
    return {
        payload: { exercise, set, setIndex },
        type: UPDATE_EXERCISE_LATEST_COMPLETED_SETS,
    };
}
