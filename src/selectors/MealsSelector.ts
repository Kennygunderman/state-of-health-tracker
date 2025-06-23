import {DailyMealEntryMap} from '@store/dailyMealEntries/DailyMealEntriesState'
import {Macros} from '@store/food/models/FoodItem'
import LocalStore from '@store/LocalStore'
import {MealMap} from '@store/meals/MealsState'
import {Meal} from '@store/meals/models/Meal'
import {useSessionStore} from '@store/session/useSessionStore'
import {createSelector, ParametricSelector, Selector} from 'reselect'

import {formatDate} from '../utility/DateUtility'

export interface MealEntry {
  mealCalories: number
  mealMacros: Macros
  meal: Meal
}

export interface DailyMealEntry {
  day: string
  totalCalories: number
  meals: MealEntry[]
}

export interface Totals {
  calories: number
  macros: Macros
}

export interface DayTotals {
  day: string
  totals: Totals
}

function getMealsForDay(day: string, dailyMealEntriesMap: DailyMealEntryMap, mealMap: MealMap): Meal[] {
  const meals: Meal[] = []
  const mealIds = dailyMealEntriesMap[day]?.mealIds

  Object.keys(mealMap).forEach(key => {
    const meal = mealMap[key]

    if (mealIds && mealIds.includes(meal.id)) {
      meals.push(meal)
    }
  })

  return meals
}

export const getMealsForDaySelector: Selector<LocalStore, Meal[]> = createSelector(
  (_state: LocalStore) => useSessionStore.getState().sessionStartDate,
  (state: LocalStore) => state.dailyMealEntries.map,
  (state: LocalStore) => state.meals.map,
  getMealsForDay
)

function getPreviousDailyMealEntries(
  loadBatch: number,
  dailyMealEntriesMap: DailyMealEntryMap,
  mealMap: MealMap
): DailyMealEntry[] {
  const currentDay = useSessionStore.getState().sessionStartDate
  const entries: DailyMealEntry[] = []

  const days: string[] = []

  Object.keys(dailyMealEntriesMap).forEach(day => {
    days.push(day)
  })

  days
    .sort((a, b) => Date.parse(b) - Date.parse(a))
    .filter(day => day !== currentDay)
    .forEach(day => {
      const meals = getMealsForDay(day, dailyMealEntriesMap, mealMap)
      let totalCalories = 0
      const mealEntries: MealEntry[] = []

      meals.forEach(meal => {
        if (meal.food.length === 0) {
          return
        }

        let mealCalories = 0
        const mealMacros = {
          protein: 0,
          carbs: 0,
          fat: 0
        }

        meal.food.forEach(food => {
          mealMacros.protein += food.macros.protein * food.servings
          mealMacros.carbs += food.macros.carbs * food.servings
          mealMacros.fat += food.macros.fat * food.servings
          mealCalories += food.calories * food.servings
          totalCalories += food.calories * food.servings
        })

        const mealEntry: MealEntry = {
          mealCalories,
          mealMacros,
          meal
        }

        mealEntries.push(mealEntry)
      })

      if (totalCalories === 0) {
        return
      }

      const entry: DailyMealEntry = {
        day,
        totalCalories,
        meals: mealEntries
      }

      entries.push(entry)
    })

  return entries.slice(0, loadBatch)
}

export const getPreviousDailyMealEntriesSelector: ParametricSelector<LocalStore, number, DailyMealEntry[]> =
  createSelector(
    (_state: LocalStore, loadBatch: number) => loadBatch,
    (state: LocalStore, _: number) => state.dailyMealEntries.map,
    (state: LocalStore, _: number) => state.meals.map,
    getPreviousDailyMealEntries
  )

function getTotalsForMeals(meals: Meal[]): Totals {
  let calories = 0
  const macros = {
    protein: 0,
    carbs: 0,
    fat: 0
  }

  meals.forEach(meal => {
    if (meal.food.length === 0) {
      return
    }

    meal.food.forEach(food => {
      macros.protein += food.macros.protein * food.servings
      macros.carbs += food.macros.carbs * food.servings
      macros.fat += food.macros.fat * food.servings
      calories += food.calories * food.servings
    })
  })

  return {
    calories,
    macros
  }
}

export const getTotalsForDaySelector: Selector<LocalStore, Totals> = createSelector(
  (state: LocalStore) => getMealsForDaySelector(state),
  getTotalsForMeals
)

function getTotalsForWeek(dailyEntryMap: DailyMealEntryMap, mealMap: MealMap): DayTotals[] {
  const dayTotals: DayTotals[] = []

  for (let i = 7; i > 0; i--) {
    const day = formatDate(Date.now() - 1000 * 60 * 60 * 24 * (i - 1))
    const meals = getMealsForDay(day, dailyEntryMap, mealMap)

    dayTotals.push({
      day,
      totals: getTotalsForMeals(meals)
    })
  }

  return dayTotals
}

export const getTotalsForWeekSelector: Selector<LocalStore, DayTotals[]> = createSelector(
  (state: LocalStore) => state.dailyMealEntries.map,
  (state: LocalStore) => state.meals.map,
  getTotalsForWeek
)
