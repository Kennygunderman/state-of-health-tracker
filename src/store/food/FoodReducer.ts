import {ADD_FOOD, DELETE_FOOD} from './FoodActions'
import FoodState from './FoodState'
import FoodItem from './models/FoodItem'

function addFood(state: FoodState, action: Action<FoodItem>): FoodState {
  const foodItem = action.payload

  if (!foodItem) {
    return state
  }

  const foods = [...state.foods]

  foods.push(foodItem)

  return {
    ...state,
    foods
  }
}

function deleteFood(state: FoodState, action: Action<string>): FoodState {
  const foodItemId = action.payload

  if (!foodItemId) {
    return state
  }

  const foods = [...state.foods]
  const indexToDelete = foods.findIndex(value => value.id === foodItemId)

  foods.splice(indexToDelete, 1)

  return {
    ...state,
    foods
  }
}

export const FOOD_INITIAL_STATE: FoodState = {
  foods: []
}

const foodReducerMap = {
  [ADD_FOOD]: addFood,
  [DELETE_FOOD]: deleteFood
}

export function foodReducer(state = FOOD_INITIAL_STATE, action: Action<any>): FoodState {
  const reducer = foodReducerMap[action.type]

  if (!reducer) {
    return state
  }

  return reducer(state, action)
}
