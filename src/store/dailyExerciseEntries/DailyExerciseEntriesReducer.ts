import {
    ADD_DAILY_EXERCISE,
    ADD_DAILY_EXERCISE_SET,
    COMPLETE_DAILY_EXERCISE_SET, DELETE_DAILY_EXERCISE,
    DELETE_DAILY_EXERCISE_SET, UPDATE_DAILY_EXERCISES,
} from './DailyExerciseActions';
import DailyExerciseEntriesState from './DailyExerciseEntriesState';
import { createDailyExercise, DailyExercise } from './models/DailyExercise';
import { Exercise } from '../exercises/models/Exercise';
import { createSet, ExerciseSet } from '../exercises/models/ExerciseSet';

function addDailyExercise(state: DailyExerciseEntriesState, action: Action<{ date: string, exercise: Exercise }>): DailyExerciseEntriesState {
    const date = action.payload?.date;
    const exercise = action.payload?.exercise;

    if (!date || !exercise) {
        return state;
    }

    const doesExist = (state.map[date] ?? []).find((dailyExercise) => dailyExercise.exercise.name === exercise.name);

    if (doesExist) {
        return state;
    }

    return {
        ...state,
        map: {
            ...state.map,
            [date]: [...state.map[date] ?? [], createDailyExercise(exercise)],
        },
    };
}

function deleteDailyExercise(state: DailyExerciseEntriesState, action: Action<{ date: string, dailyExerciseId: string }>): DailyExerciseEntriesState {
    const date = action.payload?.date;
    const dailyExerciseId = action.payload?.dailyExerciseId;

    if (!date || !dailyExerciseId) {
        return state;
    }

    const dailyExercises = [...state.map[date]];
    const indexToDelete = dailyExercises.findIndex((dailyExercise: DailyExercise) => dailyExercise.id === dailyExerciseId);

    if (indexToDelete === -1) {
        return state;
    }

    dailyExercises.splice(indexToDelete, 1);

    return {
        ...state,
        map: {
            ...state.map,
            [date]: dailyExercises,
        },
    };
}

function updateDailyExercises(state: DailyExerciseEntriesState, action: Action<{ date: string, dailyExercises: DailyExercise[] }>): DailyExerciseEntriesState {
    const date = action.payload?.date;
    const dailyExercises = action.payload?.dailyExercises;

    if (!date || !dailyExercises) {
        return state;
    }

    return {
        ...state,
        map: {
            ...state.map,
            [date]: dailyExercises,
        },
    };
}

function addSet(state: DailyExerciseEntriesState, action: Action<{ date: string, exercise: Exercise }>): DailyExerciseEntriesState {
    const date = action.payload?.date;
    const exercise = action.payload?.exercise;

    if (!date || !exercise) {
        return state;
    }

    const dailyExercises = [...state.map[date]];
    const indexToUpdate = dailyExercises.findIndex((dailyExercise: DailyExercise) => dailyExercise.exercise.name === exercise.name);

    if (indexToUpdate === -1) {
        return state;
    }

    dailyExercises[indexToUpdate].sets.push(createSet());
    return {
        ...state,
        map: {
            ...state.map,
            [date]: dailyExercises,
        },
    };
}

function completeSet(state: DailyExerciseEntriesState, action: Action<{ date: string, exercise: Exercise, setId: string, isCompleted: boolean, weight: number, reps: number }>): DailyExerciseEntriesState {
    const date = action.payload?.date;
    const exercise = action.payload?.exercise;
    const setId = action.payload?.setId;
    const isCompleted = action.payload?.isCompleted;
    const weight = action.payload?.weight;
    const reps = action.payload?.reps;

    if (!date || !exercise || !setId || isCompleted === undefined) {
        return state;
    }

    const dailyExercises = [...state.map[date]];
    const dailyExerciseIndex = dailyExercises.findIndex((dailyExercise: DailyExercise) => dailyExercise.exercise.name === exercise.name);

    if (dailyExerciseIndex === -1) {
        return state;
    }

    const setIndex = dailyExercises[dailyExerciseIndex].sets.findIndex((set: ExerciseSet) => set.id === setId);

    if (setIndex === -1) {
        return state;
    }

    dailyExercises[dailyExerciseIndex].sets[setIndex].completed = isCompleted;
    dailyExercises[dailyExerciseIndex].sets[setIndex].weight = weight;
    dailyExercises[dailyExerciseIndex].sets[setIndex].reps = reps;

    return {
        ...state,
        map: {
            ...state.map,
            [date]: dailyExercises,
        },
    };
}

function deleteSet(state: DailyExerciseEntriesState, action: Action<{ date: string, exercise: Exercise, setId: string }>): DailyExerciseEntriesState {
    const date = action.payload?.date;
    const exercise = action.payload?.exercise;
    const setId = action.payload?.setId;

    if (!date || !exercise || !setId) {
        return state;
    }

    const dailyExercises = [...state.map[date]];
    const dailyExerciseIndex = dailyExercises.findIndex((dailyExercise: DailyExercise) => dailyExercise.exercise.name === exercise.name);

    if (dailyExerciseIndex === -1) {
        return state;
    }

    const setIndex = dailyExercises[dailyExerciseIndex].sets.findIndex((set: ExerciseSet) => set.id === setId);

    if (setIndex === -1) {
        return state;
    }

    dailyExercises[dailyExerciseIndex].sets.splice(setIndex, 1);

    return {
        ...state,
        map: {
            ...state.map,
            [date]: dailyExercises,
        },
    };
}
export const DAILY_EXERCISE_ENTRIES_INITIAL_STATE: DailyExerciseEntriesState = {
    map: {},
};

const dailyExerciseEntriesReducerMap = {
    [ADD_DAILY_EXERCISE]: addDailyExercise,
    [DELETE_DAILY_EXERCISE]: deleteDailyExercise,
    [UPDATE_DAILY_EXERCISES]: updateDailyExercises,
    [ADD_DAILY_EXERCISE_SET]: addSet,
    [COMPLETE_DAILY_EXERCISE_SET]: completeSet,
    [DELETE_DAILY_EXERCISE_SET]: deleteSet,
};

export function dailyExerciseEntriesReducer(state = DAILY_EXERCISE_ENTRIES_INITIAL_STATE, action: Action<any>): DailyExerciseEntriesState {
    const reducer = dailyExerciseEntriesReducerMap[action.type];

    if (!reducer) {
        return state;
    }

    return reducer(state, action);
}
