export const ADD_DAILY_MEAL_ENTRY: string = 'ADD_DAILY_MEAL_ENTRY';
export const ADD_MEAL_TO_DAILY_ENTRY: string = 'ADD_MEAL_TO_DAILY_ENTRY';

export function addDailyMealEntry(date: string) {
    return {
        payload: date,
        type: ADD_DAILY_MEAL_ENTRY,
    };
}

export function addMealToDailyEntry(entryDate: string, mealId: string) {
    return {
        payload: { entryDate, mealId },
        type: ADD_MEAL_TO_DAILY_ENTRY,
    };
}
