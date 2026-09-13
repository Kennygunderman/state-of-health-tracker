import {
  MEAL_ENTRY_ESTIMATED_LABEL,
  MEAL_ENTRY_FROM_MEAL_PLAN_LABEL,
  MEAL_ENTRY_INGREDIENT_DERIVED_LABEL,
  MEAL_ENTRY_SOURCE_BACKED_LABEL
} from '@constants/strings'

import {NutritionProvenance} from './NutritionProvenance'

export enum InputMethodEnum {
  LIBRARY = 'library',
  SEARCH = 'search',
  AI_TEXT = 'ai_text',
  AI_PHOTO = 'ai_photo',
  MEAL_PLAN = 'meal_plan'
}

// What a request body may ask for, derived from the stored vocabulary so a
// member added to the enum cannot become requestable by omission. MEAL_PLAN is
// stamped only by the server's planned-log path and is the diary's 'From meal
// plan' origin label, so a request claiming it would assert a plan link the
// client cannot have.
export type ClientInputMethod = Exclude<InputMethodEnum, InputMethodEnum.MEAL_PLAN>

export interface MealEntry {
  id: string
  foodId: string | null
  name: string
  servingText: string | null
  servings: number
  // Per-serving snapshot values; displayed totals = value * servings.
  calories: number
  protein: number
  carbs: number
  fat: number
  inputMethod: InputMethodEnum
  loggedAt: string
  // Always present on new responses; explicitly null on entries the server
  // wrote before meal planning shipped.
  mealPlanMealId: string | null
  nutritionProvenance: NutritionProvenance | null
}

export interface LogMealEntryPayload {
  foodId?: string
  name: string
  servingText?: string
  servings?: number
  calories: number
  protein: number
  carbs: number
  fat: number
  inputMethod?: ClientInputMethod
  rawInput?: string
}

export interface LogCatalogMealEntryPayload {
  catalogFoodId: string
  servings: number
  servingText?: string
  inputMethod: InputMethodEnum.SEARCH
}

export interface UpdateMealEntryPayload {
  servings?: number
  name?: string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export function entryCalories(entry: MealEntry): number {
  return Math.round(entry.calories * entry.servings)
}

// Meal-row portion label. servingText snapshots the per-serving portion
// ('4 oz', '1 serving'), so its leading number is scaled by servings; text
// without a leading number gets an explicit multiplier suffix instead.
export function entryServingText(entry: MealEntry): string | null {
  if (!entry.servingText) {
    return null
  }

  if (entry.servings === 1) {
    return entry.servingText
  }

  const match = entry.servingText.match(/^(\d*\.?\d+)(.*)$/)

  if (!match) {
    return `${entry.servingText} × ${roundQuantity(entry.servings)}`
  }

  const scaled = roundQuantity(parseFloat(match[1]) * entry.servings)
  const unit = match[2].trim()

  if (unit === 'serving' || unit === 'servings') {
    return scaled === 1 ? '1 serving' : `${scaled} servings`
  }

  return `${scaled}${match[2]}`
}

function roundQuantity(value: number): number {
  return Math.round(value * 100) / 100
}

export function isEstimatedEntry(entry: MealEntry): boolean {
  return entry.inputMethod === InputMethodEnum.AI_TEXT || entry.inputMethod === InputMethodEnum.AI_PHOTO
}

export function isFromMealPlan(entry: MealEntry): boolean {
  return entry.inputMethod === InputMethodEnum.MEAL_PLAN
}

// Diary caption. Origin outranks provenance: a planned meal is built from
// source-backed ingredients, so it reads as its origin. 'user_entered' and the
// legacy null both carry no source claim and fall back to the AI-estimate rule.
export function entryProvenanceLabel(entry: MealEntry): string | null {
  if (isFromMealPlan(entry)) {
    return MEAL_ENTRY_FROM_MEAL_PLAN_LABEL
  }

  if (entry.nutritionProvenance === 'source_backed') {
    return MEAL_ENTRY_SOURCE_BACKED_LABEL
  }

  if (entry.nutritionProvenance === 'ingredient_derived') {
    return MEAL_ENTRY_INGREDIENT_DERIVED_LABEL
  }

  if (entry.nutritionProvenance === 'ai_estimated') {
    return MEAL_ENTRY_ESTIMATED_LABEL
  }

  return isEstimatedEntry(entry) ? MEAL_ENTRY_ESTIMATED_LABEL : null
}
