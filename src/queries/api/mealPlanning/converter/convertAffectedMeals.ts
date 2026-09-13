import {AffectedMeal, MealPlanFlag, MealPlanFlagCode} from '@data/models/MealPlan'
import {AffectedMealsResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_FLAG_CODES: MealPlanFlagCode[] = ['diet', 'allergen', 'dislike', 'cooking_time']

export function convertAffectedMeals(data: io.TypeOf<typeof AffectedMealsResponse>): AffectedMeal[] {
  return data.meals.map(meal => ({
    mealId: meal.mealId,
    date: meal.date,
    // Carried, never defaulted: this row sends the user to one meal of one day to swap it, so naming the
    // wrong slot would point them at a meal that is not the flagged one. The codec admits only the four.
    slot: meal.slot,
    recipeName: meal.recipeName,
    // An unrecognised code is dropped, never remapped: that would assert a flag the server never reported.
    flags: meal.flags
      .filter((flag): flag is MealPlanFlag => KNOWN_FLAG_CODES.some(code => code === flag.code))
      .map(flag => ({code: flag.code, detail: flag.detail}))
  }))
}
