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

export interface RecipeIngredient {
  catalogFoodId: string
  // name and nutritionProvenance come from the frozen recipe_ingredients snapshot,
  // never the live catalog food, so a historical plan or diary entry keeps showing
  // the recipe as it was published even after the catalog is refreshed.
  name: string
  quantity: number
  unit: string
  gramWeight: number
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
  description: string | null
  iconKey: RecipeIconKey
  instructions: string[]
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
