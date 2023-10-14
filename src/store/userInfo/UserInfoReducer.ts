import {
    ADD_WEIGHT_ENTRY, SET_CURRENT_DATE, SET_TARGET_CALORIES, SET_TARGET_WORKOUTS,
} from './UserInfoActions';

function setCurrentDate(state: UserInfoState, action: Action<string>): UserInfoState {
    const currentDate = action.payload;

    if (!currentDate || state.currentDate === currentDate) {
        return state;
    }

    return {
        ...state,
        currentDate,
    };
}

function setTargetCalories(state: UserInfoState, action: Action<number>): UserInfoState {
    const targetCalories = action.payload;

    if (!targetCalories) {
        return state;
    }

    return {
        ...state,
        targetCalories,
    };
}

function setTargetWorkouts(state: UserInfoState, action: Action<number>): UserInfoState {
    const targetWorkouts = action.payload;

    if (!targetWorkouts) {
        return state;
    }

    return {
        ...state,
        targetWorkouts,
    };
}

function addWeightEntry(state: UserInfoState, action: Action<{ date: string, weight: number }>): UserInfoState {
    const date = action.payload?.date;
    const weight = action.payload?.weight;

    if (!date || !weight) {
        return state;
    }

    return {
        ...state,
        dateWeightMap: {
            ...state.dateWeightMap,
            [date]: weight,
        },
    };
}

export const USER_INFO_INITIAL_STATE: UserInfoState = {
    currentDate: '',
    targetCalories: 0,
    targetWorkouts: 0,
    dateWeightMap: {},
};

const userInfoReducerMap = {
    [SET_CURRENT_DATE]: setCurrentDate,
    [SET_TARGET_CALORIES]: setTargetCalories,
    [SET_TARGET_WORKOUTS]: setTargetWorkouts,
    [ADD_WEIGHT_ENTRY]: addWeightEntry,
};

export function userInfoReducer(state = USER_INFO_INITIAL_STATE, action: Action<any>): UserInfoState {
    const reducer = userInfoReducerMap[action.type];

    if (!reducer) {
        return state;
    }

    return reducer(state, action);
}
