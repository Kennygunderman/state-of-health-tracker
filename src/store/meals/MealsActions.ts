import { Meal } from './models/Meal';
import { addMealToDailyEntry } from '../dailyMealEntries/DailyMealEntriesActions';
import FoodItem from '../food/models/FoodItem';
import LocalStore from '../LocalStore';

export const ADD_MEAL: string = 'ADD_MEAL';
export const UPDATE_MEAL_FOOD: string = 'UPDATE_MEAL_FOOD';
export const DELETE_MEAL_FOOD: string = 'DELETE_MEAL_FOOD';
export const UPDATE_MEAL_NAME: string = 'UPDATE_MEAL_NAME';
export const UPDATE_MEAL_FOOD_ITEM_SERVINGS: string = 'UPDATE_MEAL_FOOD_ITEM_SERVINGS';

export function addMeal(meal: Meal) {
    return async (dispatch: any, getState: () => LocalStore) => {
        dispatch({
            payload: meal,
            type: ADD_MEAL,
        });
        dispatch(addMealToDailyEntry(getState().userInfo.currentDate, meal.id));
    };
}

export function updateMealFood(mealId: string, foodItem: FoodItem) {
    return {
        payload: { mealId, foodItem },
        type: UPDATE_MEAL_FOOD,
    };
}

export function deleteMealFood(mealId: string, foodItemId: string) {
    return {
        payload: { mealId, foodItemId },
        type: DELETE_MEAL_FOOD,
    };
}

export function updateMealName(mealId: string, mealName: string) {
    return {
        payload: { mealId, mealName },
        type: UPDATE_MEAL_NAME,
    };
}

export function updateMealFoodItemServings(mealId: string, foodItemId: string, servings: number) {
    return {
        payload: { mealId, foodItemId, servings },
        type: UPDATE_MEAL_FOOD_ITEM_SERVINGS,
    };
}
