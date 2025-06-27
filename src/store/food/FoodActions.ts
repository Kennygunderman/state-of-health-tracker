import FoodItem from './models/FoodItem'

export const ADD_FOOD: string = 'ADD_FOOD'

export const DELETE_FOOD: string = 'DELETE_FOOD'

export function addFood(food: FoodItem) {
  return {
    payload: food,
    type: ADD_FOOD
  }
}

export function deleteFood(foodItemId: string) {
  return {
    payload: foodItemId,
    type: DELETE_FOOD
  }
}
