export const ADD_DAILY_MEAL_ENTRY: string = 'ADD_DAILY_MEAL_ENTRY'

export const ADD_MEAL_TO_DAILY_ENTRY: string = 'ADD_MEAL_TO_DAILY_ENTRY'

export const SET_DAILY_MEALS_HAS_SYNCED_FALSE: string = 'SET_DAILY_MEALS_HAS_SYNCED_FALSE'

export const SET_MEAL_ENTRIES_SYNCED: string = 'SET_MEAL_ENTRIES_SYNCED'

export function addDailyMealEntry(date: string) {
  return {
    payload: date,
    type: ADD_DAILY_MEAL_ENTRY
  }
}

export function addMealToDailyEntry(entryDate: string, mealId: string) {
  return {
    payload: {
      entryDate,
      mealId
    },
    type: ADD_MEAL_TO_DAILY_ENTRY
  }
}

export function setMealEntriesSynced() {
  return {
    payload: true,
    type: SET_MEAL_ENTRIES_SYNCED
  }
}
