import {SourcedNutritionProvenance} from './NutritionProvenance'
import {Pagination} from './Pagination'

export type CatalogIdentitySource = 'usda' | 'ai_generated'

export type CatalogAllergenStatus = 'known' | 'unknown'

// foodState and nutritionBasis are closed because the app branches on them, which obliges convertCatalogFood to
// resolve or reject an unknown wire value instead of passing a raw string through; category and foodGroup stay
// strings because they are data (coverage-plan.v1.json), so adding one must not be a code change.
export type CatalogFoodState = 'raw' | 'cooked' | 'prepared' | 'dry' | 'as_purchased'

export type CatalogNutritionBasis = 'per_100g' | 'per_100ml' | 'per_serving'

export interface CatalogFoodPortion {
  description: string
  amount: number
  unit: string
  gramWeight: number
}

// The server's nutrition for ONE defaultPortion, already rounded to integers because it is what the diary stores
// per serving if this food is logged at that portion. The per-basis macros below cannot be converted client-side —
// a per_100ml food needs a density no response carries — so these are the only per-portion figures to display.
// Fiber is absent because the diary stores none, so no stored value could match a fiber projection.
export interface CatalogPortionNutrition {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export interface CatalogFood {
  id: string
  name: string
  category: string
  foodState: CatalogFoodState
  identitySource: CatalogIdentitySource
  nutritionProvenance: SourcedNutritionProvenance
  nutritionBasis: CatalogNutritionBasis
  basisAmount: number
  calories: number
  protein: number
  carbs: number
  fat: number
  // null means unknown, never 0 — a 0 would under-report the food's fiber.
  fiber: number | null
  defaultPortion: CatalogFoodPortion
  defaultPortionNutrition: CatalogPortionNutrition
  allergenTags: string[]
  allergenStatus: CatalogAllergenStatus
  foodGroup: string
}

export interface CatalogFoodSearchResult {
  items: CatalogFood[]
  pagination: Pagination
}

export interface CatalogFoodSuggestion {
  id: string
  name: string
  foodGroup: string
}
