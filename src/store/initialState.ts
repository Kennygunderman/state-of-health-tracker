import {BREAKFAST_MEAL_NAME, DINNER_MEAL_NAME, LUNCH_MEAL_NAME} from '@constants/Strings'

import {getCurrentDate} from '../utility/DateUtility'

import {createDailyMealEntry} from './dailyMealEntries/models/DailyMealEntry'
import {createFood} from './food/models/FoodItem'
import LocalStore from './LocalStore'
import {createMeal} from './meals/models/Meal'

const initialMealBreakfast = createMeal(BREAKFAST_MEAL_NAME, [])
const initialMealLunch = createMeal(LUNCH_MEAL_NAME, [])
const initialMealDinner = createMeal(DINNER_MEAL_NAME, [])
const localStore: LocalStore = {
  user: {lastDataSync: 0},
  food: {
    foods: [
      createFood('Chicken Breast (4oz)', 1, '176', {
        protein: 35,
        carbs: 0,
        fat: 4
      }),
      createFood('Egg (Large)', 1, '78', {
        protein: 6,
        carbs: 0,
        fat: 6
      }),
      createFood('Peanut Butter (2 tbsp)', 1, '180', {
        protein: 7,
        carbs: 4,
        fat: 16
      }),
      createFood('Apple (Medium)', 1, '96', {
        protein: 0,
        carbs: 24,
        fat: 0
      })
    ]
  },
  meals: {
    map: {
      [initialMealBreakfast.id]: initialMealBreakfast,
      [initialMealLunch.id]: initialMealLunch,
      [initialMealDinner.id]: initialMealDinner
    }
  },
  dailyMealEntries: {
    map: {
      [getCurrentDate()]: createDailyMealEntry([initialMealBreakfast.id, initialMealLunch.id, initialMealDinner.id])
    }
  }
}

export default localStore
