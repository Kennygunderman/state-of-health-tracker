import {addMealToDailyEntry, SET_DAILY_MEALS_HAS_SYNCED_FALSE} from '@store/dailyMealEntries/DailyMealEntriesActions'
import FoodItem from '@store/food/models/FoodItem'
import LocalStore from '@store/LocalStore'
import {useSessionStore} from '@store/session/useSessionStore'

import {Meal} from './models/Meal'

export const ADD_MEAL: string = 'ADD_MEAL'

export const UPDATE_MEAL_FOOD: string = 'UPDATE_MEAL_FOOD'

export const DELETE_MEAL_FOOD: string = 'DELETE_MEAL_FOOD'

export const UPDATE_MEAL_NAME: string = 'UPDATE_MEAL_NAME'

export const UPDATE_MEAL_FOOD_ITEM_SERVINGS: string = 'UPDATE_MEAL_FOOD_ITEM_SERVINGS'

export function addMeal(meal: Meal) {
  return async (dispatch: any, getState: () => LocalStore) => {
    dispatch({
      payload: meal,
      type: ADD_MEAL
    })
    dispatch(addMealToDailyEntry(useSessionStore.getState().sessionStartDate, meal.id))
  }
}

export function updateMealFood(mealId: string, foodItem: FoodItem) {
  return async (dispatch: any) => {
    dispatch({
      payload: {
        mealId,
        foodItem
      },
      type: UPDATE_MEAL_FOOD
    })

    dispatch({
      payload: useSessionStore.getState().sessionStartDate,
      type: SET_DAILY_MEALS_HAS_SYNCED_FALSE
    })
  }
}

export function deleteMealFood(mealId: string, foodItemId: string) {
  return async (dispatch: any) => {
    dispatch({
      payload: {
        mealId,
        foodItemId
      },
      type: DELETE_MEAL_FOOD
    })

    dispatch({
      payload: useSessionStore.getState().sessionStartDate,
      type: SET_DAILY_MEALS_HAS_SYNCED_FALSE
    })
  }
}

export function updateMealName(mealId: string, mealName: string) {
  return async (dispatch: any) => {
    dispatch({
      payload: {
        mealId,
        mealName
      },
      type: UPDATE_MEAL_NAME
    })

    dispatch({
      payload: useSessionStore.getState().sessionStartDate,
      type: SET_DAILY_MEALS_HAS_SYNCED_FALSE
    })
  }
}

export function updateMealFoodItemServings(mealId: string, foodItemId: string, servings: number) {
  return async (dispatch: any) => {
    dispatch({
      payload: {
        mealId,
        foodItemId,
        servings
      },
      type: UPDATE_MEAL_FOOD_ITEM_SERVINGS
    })

    dispatch({
      payload: useSessionStore.getState().sessionStartDate,
      type: SET_DAILY_MEALS_HAS_SYNCED_FALSE
    })
  }
}
