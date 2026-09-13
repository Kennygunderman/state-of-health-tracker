import {MacroTotals} from './Macros'
import {SourcedNutritionProvenance} from './NutritionProvenance'

export type RecipeIconKey =
  | 'crosshair'
  | 'fork_knife'
  | 'bowl'
  | 'wrap'
  | 'dome'
  | 'salad'
  | 'bowl_dash'
  | 'pot'
  | 'cloche'

export type RecipeBadge = 'high_protein' | 'gluten_free' | 'dairy_free' | 'vegan' | 'quick'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const RECIPE_ICON_KEYS: RecipeIconKey[] = [
  'crosshair',
  'fork_knife',
  'bowl',
  'wrap',
  'dome',
  'salad',
  'bowl_dash',
  'pot',
  'cloche'
]

export const RECIPE_BADGES: RecipeBadge[] = ['high_protein', 'gluten_free', 'dairy_free', 'vegan', 'quick']

// EVERY AMOUNT HERE IS A WHOLE-RECIPE AMOUNT — quantity, gramWeight and the pre-formatted
// displayText alike. They are the recipe as published, which makes RecipeVersion.yieldServings
// servings, because a recipe response carries no planned-meal context and so cannot know the
// portion. A screen showing ONE portion scales:
//
//     portion amount = quantity × portionMultiplier / yieldServings
//
// where the multiplier comes from whatever carries the recipe — MealPlanMeal.portionMultiplier on
// a plan card, SwapPreviewAlternative.portionMultiplier on the preview. Recipe detail's 'Your
// portion' column and the swap preview's ingredient rows both apply it through
// @utility/RecipeIngredientUtility rather than each keeping a copy of the arithmetic; reading
// displayText as if it were already the portion's amount is how the preview came to print
// whole-recipe ingredients beside portion-scaled nutrition.
export interface RecipeIngredient {
  catalogFoodId: string
  // name and nutritionProvenance come from the frozen recipe_ingredients snapshot,
  // never the live catalog food, so a historical plan or diary entry keeps showing
  // the recipe as it was published even after the catalog is refreshed.
  name: string
  // The whole recipe's amount of this ingredient, in `unit`.
  quantity: number
  unit: string
  // The whole recipe's grams of this ingredient.
  gramWeight: number
  // The whole recipe's amount, pre-formatted ('¾ cup') — not a portion amount.
  displayText: string
  nutritionProvenance: SourcedNutritionProvenance
  isOptional: boolean
}

export interface RecipeVersion {
  versionId: string
  recipeId: string
  version: number
  status: 'current' | 'retired'
  name: string
  description: string
  iconKey: RecipeIconKey
  // Never empty: the server fails a recipe whose stored steps are absent rather than sending an
  // empty list, so a rendered recipe always has something to cook from.
  instructions: string[]
  // How many servings the whole recipe makes, and the divisor every per-portion ingredient amount
  // is derived with.
  yieldServings: number
  servingDescription: string
  prepMinutes: number
  cookMinutes: number
  totalMinutes: number
  mealSlots: MealSlot[]
  badges: RecipeBadge[]
  dietTags: string[]
  allergenTags: string[]
  allergenStatus: 'known' | 'unknown'
  budgetTier: 1 | 2 | 3
  nutritionProvenance: SourcedNutritionProvenance
  perServing: MacroTotals
  ingredients: RecipeIngredient[]
}
