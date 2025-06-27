import FoodItem from '@store/food/models/FoodItem'

import {
  ADD_MEAL,
  DELETE_MEAL_FOOD,
  UPDATE_MEAL_FOOD,
  UPDATE_MEAL_FOOD_ITEM_SERVINGS,
  UPDATE_MEAL_NAME
} from './MealsActions'
import MealsState from './MealsState'
import {Meal} from './models/Meal'

function addMeal(state: MealsState, action: Action<Meal>): MealsState {
  const meal = action.payload
  const id = meal?.id

  if (!meal || !id) {
    return state
  }

  return {
    ...state,
    map: {
      ...state.map,
      [id]: {
        id: meal.id,
        createdDate: meal.createdDate,
        name: meal.name,
        food: meal.food
      }
    }
  }
}

function updateMealFood(state: MealsState, action: Action<{mealId: string; foodItem: FoodItem}>): MealsState {
  const mealId = action.payload?.mealId
  const foodItem = action.payload?.foodItem

  if (!mealId || !foodItem) {
    return state
  }

  const meal = state.map[mealId]

  const foodItemIndex = meal.food.findIndex(food => food.id === foodItem.id)

  // If food exists, increment servings
  if (foodItemIndex !== -1) {
    const food = [...meal.food]
    const updateFoodItem = {...meal.food[foodItemIndex]}

    updateFoodItem.servings += foodItem.servings
    food[foodItemIndex] = updateFoodItem

    return {
      ...state,
      map: {
        ...state.map,
        [mealId]: {
          id: meal.id,
          createdDate: meal.createdDate,
          name: meal.name,
          food
        }
      }
    }
    // food doesn't exist, add it.
  }

  return {
    ...state,
    map: {
      ...state.map,
      [mealId]: {
        id: meal.id,
        createdDate: meal.createdDate,
        name: meal.name,
        food: [...meal.food, foodItem]
      }
    }
  }
}

function deleteMealFood(state: MealsState, action: Action<{mealId: string; foodItemId: string}>): MealsState {
  const mealId = action.payload?.mealId
  const foodItemId = action.payload?.foodItemId

  if (!mealId || !foodItemId) {
    return state
  }

  const meal = state.map[mealId]
  const indexToDelete = meal.food.findIndex(value => value.id === foodItemId)

  const updatedMeal: Meal = {...meal}
  const updatedFood: FoodItem[] = [...meal.food]

  updatedFood.splice(indexToDelete, 1)
  updatedMeal.food = updatedFood

  return {
    ...state,
    map: {
      ...state.map,
      [updatedMeal.id]: {
        id: updatedMeal.id,
        createdDate: updatedMeal.createdDate,
        name: updatedMeal.name,
        food: updatedFood
      }
    }
  }
}

function updateMealName(state: MealsState, action: Action<{mealId: string; mealName: string}>): MealsState {
  const mealId = action.payload?.mealId
  const mealName = action.payload?.mealName

  if (!mealId || !mealName) {
    return state
  }

  const meal = state.map[mealId]

  if (meal) {
    return {
      ...state,
      map: {
        ...state.map,
        [meal.id]: {
          id: meal.id,
          createdDate: meal.createdDate,
          name: mealName,
          food: meal.food
        }
      }
    }
  }

  return state
}

function updateMealFoodItemServings(
  state: MealsState,
  action: Action<{
    mealId: string
    foodItemId: string
    servings: number
  }>
): MealsState {
  const mealId = action.payload?.mealId
  const foodItemId = action.payload?.foodItemId
  const servings = action.payload?.servings

  if (!mealId || !foodItemId || servings === undefined) {
    return state
  }

  const meal = state.map[mealId]

  const foodItemIndex = meal.food.findIndex(food => food.id === foodItemId)

  // If food exists, update servings
  if (foodItemIndex !== -1) {
    const food = [...meal.food]
    const updatedFoodItem = {...meal.food[foodItemIndex]}

    updatedFoodItem.servings = servings
    food[foodItemIndex] = updatedFoodItem

    return {
      ...state,
      map: {
        ...state.map,
        [mealId]: {
          ...state.map[mealId],
          food
        }
      }
    }
  }

  return state
}

export const MEALS_INITIAL_STATE: MealsState = {
  map: {}
}

const mealsReducerMap = {
  [ADD_MEAL]: addMeal,
  [UPDATE_MEAL_FOOD]: updateMealFood,
  [DELETE_MEAL_FOOD]: deleteMealFood,
  [UPDATE_MEAL_FOOD_ITEM_SERVINGS]: updateMealFoodItemServings,
  [UPDATE_MEAL_NAME]: updateMealName
}

export function mealsReducer(state = MEALS_INITIAL_STATE, action: Action<any>): MealsState {
  const reducer = mealsReducerMap[action.type]

  if (!reducer) {
    return state
  }

  return reducer(state, action)
}
