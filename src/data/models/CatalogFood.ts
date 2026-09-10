import {SourcedNutritionProvenance} from './NutritionProvenance'
import {Pagination} from './Pagination'

export type CatalogIdentitySource = 'usda' | 'ai_generated'

export type CatalogAllergenStatus = 'known' | 'unknown'

export interface CatalogFoodPortion {
  description: string
  amount: number
  unit: string
  gramWeight: number
}

export interface CatalogFood {
  id: string
  name: string
  category: string
  foodState: string
  identitySource: CatalogIdentitySource
  nutritionProvenance: SourcedNutritionProvenance
  nutritionBasis: string
  basisAmount: number
  calories: number
  protein: number
  carbs: number
  fat: number
  // null means unknown, never 0 — a 0 would under-report the food's fiber.
  fiber: number | null
  defaultPortion: CatalogFoodPortion
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
