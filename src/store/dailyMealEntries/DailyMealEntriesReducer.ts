import {
    ADD_DAILY_MEAL_ENTRY,
    ADD_MEAL_TO_DAILY_ENTRY,
    SET_DAILY_MEALS_HAS_SYNCED_FALSE, SET_MEAL_ENTRIES_SYNCED,
} from './DailyMealEntriesActions';
import DailyMealEntriesState, { DailyMealEntryMap } from './DailyMealEntriesState';
import { createDailyMealEntry } from './models/DailyMealEntry';

function addDailyMealEntry(state: DailyMealEntriesState, action: Action<string>): DailyMealEntriesState {
    const date = action.payload;

    if (!date) {
        return state;
    }

    const doesExist = state.map[date] !== undefined;
    if (doesExist) {
        return {
            ...state,
        };
    }
    return {
        ...state,
        map: {
            ...state.map,
            [date]: createDailyMealEntry(),
        },
    };
}

function addMealToDailyEntry(state: DailyMealEntriesState, action: Action<{ entryDate: string, mealId: string }>): DailyMealEntriesState {
    const date = action.payload?.entryDate;
    const mealId = action.payload?.mealId;

    if (!date || !mealId) {
        return state;
    }

    const doesExist = state.map[date] !== undefined;
    if (doesExist) {
        return {
            ...state,
            map: {
                ...state.map,
                [date]: {
                    ...state.map[date],
                    hasSynced: false,
                    mealIds: [...state.map[date].mealIds, mealId],
                },
            },
        };
    }
    return state;
}

function setMealHasSyncedFalse(state: DailyMealEntriesState, action: Action<string>) {
    const date = action.payload;

    if (!date) {
        return state;
    }

    return {
        ...state,
        map: {
            ...state.map,
            [date]: {
                ...state.map[date],
                hasSynced: false,
            },
        },
    };
}

function setMealEntriesSynced(state: DailyMealEntriesState, action: Action<boolean>) {
    const updatedMap: DailyMealEntryMap = {};
    Object.keys(state.map).forEach((key) => {
        updatedMap[key] = { ...state.map[key], hasSynced: true };
    });

    return {
        ...state,
        map: updatedMap,
    };
}

export const DAILY_MEAL_ENTRIES_INITIAL_STATE: DailyMealEntriesState = {
    map: {},
};

const dailyMealEntriesReducerMap = {
    [ADD_DAILY_MEAL_ENTRY]: addDailyMealEntry,
    [ADD_MEAL_TO_DAILY_ENTRY]: addMealToDailyEntry,
    [SET_DAILY_MEALS_HAS_SYNCED_FALSE]: setMealHasSyncedFalse,
    [SET_MEAL_ENTRIES_SYNCED]: setMealEntriesSynced,
};

export function dailyMealEntriesReducer(state = DAILY_MEAL_ENTRIES_INITIAL_STATE, action: Action<any>): DailyMealEntriesState {
    const reducer = dailyMealEntriesReducerMap[action.type];

    if (!reducer) {
        return state;
    }

    return reducer(state, action);
}
