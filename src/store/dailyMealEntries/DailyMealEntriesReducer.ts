import { ADD_DAILY_MEAL_ENTRY, ADD_MEAL_TO_DAILY_ENTRY } from './DailyMealEntriesActions';
import DailyMealEntriesState from './DailyMealEntriesState';

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
            [date]: [],
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
                [date]: [...state.map[date], mealId],
            },
        };
    }
    return state;
}

export const DAILY_MEAL_ENTRIES_INITIAL_STATE: DailyMealEntriesState = {
    map: {},
};

const dailyMealEntriesReducerMap = {
    [ADD_DAILY_MEAL_ENTRY]: addDailyMealEntry,
    [ADD_MEAL_TO_DAILY_ENTRY]: addMealToDailyEntry,
};

export function dailyMealEntriesReducer(state = DAILY_MEAL_ENTRIES_INITIAL_STATE, action: Action<any>): DailyMealEntriesState {
    const reducer = dailyMealEntriesReducerMap[action.type];

    if (!reducer) {
        return state;
    }

    return reducer(state, action);
}
