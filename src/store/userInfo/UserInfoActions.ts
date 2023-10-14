export const SET_CURRENT_DATE: string = 'SET_CURRENT_DATE';
export const SET_TARGET_CALORIES: string = 'SET_TARGET_CALORIES';
export const SET_TARGET_WORKOUTS: string = 'SET_TARGET_WORKOUTS';
export const ADD_WEIGHT_ENTRY: string = 'ADD_WEIGHT_ENTRY';

export function setCurrentDate(date: string) {
    return {
        payload: date,
        type: SET_CURRENT_DATE,
    };
}

export function setTargetCalories(targetCalories: number) {
    return {
        payload: targetCalories,
        type: SET_TARGET_CALORIES,
    };
}

export function setTargetWorkouts(targetWorkouts: number) {
    return {
        payload: targetWorkouts,
        type: SET_TARGET_WORKOUTS,
    };
}

export function addWeightEntry(date: string, weight: number) {
    return {
        payload: { date, weight },
        type: ADD_WEIGHT_ENTRY,
    };
}
