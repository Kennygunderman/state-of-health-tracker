import {DailyMacros} from '@data/models/DailyMacros'
import {InputMethodEnum, MealEntry} from '@data/models/MealEntry'
import {NutritionProvenance} from '@data/models/NutritionProvenance'
import {DailyMacrosResponse, MealEntryResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import * as io from 'io-ts'

const KNOWN_INPUT_METHODS = Object.values(InputMethodEnum) as string[]

const KNOWN_NUTRITION_PROVENANCES: NutritionProvenance[] = [
  'source_backed',
  'ingredient_derived',
  'ai_estimated',
  'user_entered'
]

// Unknown or absent values become null so a future server provenance renders no
// caption rather than breaking the diary row.
function convertNutritionProvenance(value: string | null | undefined): NutritionProvenance | null {
  return KNOWN_NUTRITION_PROVENANCES.includes(value as NutritionProvenance) ? (value as NutritionProvenance) : null
}

export function convertMealEntry(data: io.TypeOf<typeof MealEntryResponse>): MealEntry {
  return {
    id: data.id,
    foodId: data.foodId ?? null,
    name: data.name,
    servingText: data.servingText ?? null,
    servings: data.servings,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    inputMethod: KNOWN_INPUT_METHODS.includes(data.inputMethod)
      ? (data.inputMethod as InputMethodEnum)
      : InputMethodEnum.LIBRARY,
    loggedAt: data.loggedAt,
    mealPlanMealId: data.mealPlanMealId ?? null,
    nutritionProvenance: convertNutritionProvenance(data.nutritionProvenance)
  }
}

export function convertDailyMacros(data: io.TypeOf<typeof DailyMacrosResponse>): DailyMacros {
  return {
    date: data.date,
    meals: data.meals.map(meal => ({
      id: meal.id,
      name: meal.name,
      sortOrder: meal.sortOrder,
      entries: meal.entries.map(convertMealEntry),
      totals: meal.totals
    })),
    totals: data.totals,
    targets: data.targets
  }
}
