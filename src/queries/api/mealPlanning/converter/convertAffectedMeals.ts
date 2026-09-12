import {MealPlanFlag, MealPlanFlagCode} from '@data/models/MealPlan'
import {MealSlot} from '@data/models/Recipe'
import {AffectedMealsResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const KNOWN_FLAG_CODES: MealPlanFlagCode[] = ['diet', 'allergen', 'dislike', 'cooking_time']

export interface AffectedMeal {
  mealId: string
  date: string
  slot: MealSlot
  recipeName: string
  flags: MealPlanFlag[]
}

export function convertAffectedMeals(data: io.TypeOf<typeof AffectedMealsResponse>): AffectedMeal[] {
  return data.meals.map(meal => ({
    mealId: meal.mealId,
    date: meal.date,
    // slot is non-nullable and the server emits only these four, so an unrecognised value falls back.
    slot: KNOWN_MEAL_SLOTS.find(slot => slot === meal.slot) ?? 'breakfast',
    recipeName: meal.recipeName,
    // An unrecognised code is dropped, never remapped: that would assert a flag the server never reported.
    flags: meal.flags
      .filter((flag): flag is MealPlanFlag => KNOWN_FLAG_CODES.some(code => code === flag.code))
      .map(flag => ({code: flag.code, detail: flag.detail}))
  }))
}
