import {
    ADD_EXERCISE, ADD_WORKOUT_TEMPLATE,
    DELETE_EXERCISE, DELETE_WORKOUT_TEMPLATE,
    UPDATE_EXERCISE_LATEST_COMPLETED_SETS,
} from './ExercisesActions';
import ExercisesState from './ExercisesState';
import { Exercise } from './models/Exercise';
import { ExerciseSet } from './models/ExerciseSet';
import { WorkoutTemplate } from './models/WorkoutTemplate';

function addExercise(state: ExercisesState, action: Action<Exercise>): ExercisesState {
    const exercise = action.payload;
    if (!exercise || state.map[exercise.name]) {
        return state;
    }

    return {
        ...state,
        map: {
            ...state.map,
            [exercise.name]: {
                ...exercise,
            },
        },
    };
}

function deleteExercise(state: ExercisesState, action: Action<Exercise>): ExercisesState {
    const exercise = action.payload;
    if (!exercise || !state.map[exercise.name]) {
        return state;
    }

    delete state.map[exercise.name];

    return {
        ...state,
        map: {
            ...state.map,
        },
    };
}

function updateLatestCompletedSets(state: ExercisesState, action: Action<{ exercise: Exercise, set: ExerciseSet, setIndex: number }>): ExercisesState {
    const exercise = action.payload?.exercise;
    const set = action.payload?.set;
    const setIndex = action.payload?.setIndex;

    if (!exercise || !set || setIndex === undefined || !state.map[exercise.name]) {
        return state;
    }

    const { latestCompletedSets } = state.map[exercise.name];
    if (set.completed) {
        latestCompletedSets[setIndex] = set;
    } else {
        return state;
    }

    return {
        ...state,
        map: {
            ...state.map,
            [exercise.name]: {
                ...exercise,
                latestCompletedSets,
            },
        },
    };
}

function addWorkoutTemplate(state: ExercisesState, action: Action<WorkoutTemplate>): ExercisesState {
    const template = action.payload;
    if (!template) {
        return state;
    }

    return {
        ...state,
        templates: [...state.templates ?? [], template],
    };
}

function deleteWorkoutTemplate(state: ExercisesState, action: Action<string>): ExercisesState {
    const templateId = action.payload;
    if (!templateId) {
        return state;
    }

    return {
        ...state,
        templates: (state.templates ?? []).filter((template) => template.id !== templateId),
    };
}

export const EXERCISES_INITIAL_STATE: ExercisesState = {
    templates: [],
    map: {},
};

const exercisesReducerMap = {
    [ADD_EXERCISE]: addExercise,
    [DELETE_EXERCISE]: deleteExercise,
    [UPDATE_EXERCISE_LATEST_COMPLETED_SETS]: updateLatestCompletedSets,
    [ADD_WORKOUT_TEMPLATE]: addWorkoutTemplate,
    [DELETE_WORKOUT_TEMPLATE]: deleteWorkoutTemplate,
};

export function exercisesReducer(state = EXERCISES_INITIAL_STATE, action: Action<any>): ExercisesState {
    const reducer = exercisesReducerMap[action.type];

    if (!reducer) {
        return state;
    }

    return reducer(state, action);
}
