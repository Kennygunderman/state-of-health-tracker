import {
  CatalogAllergenStatus,
  CatalogFood,
  CatalogFoodState,
  CatalogIdentitySource,
  CatalogNutritionBasis
} from '@data/models/CatalogFood'
import {SourcedNutritionProvenance} from '@data/models/NutritionProvenance'
import {CatalogFoodResponse} from '@queries/api/catalog/decoder/CatalogDecoder'
import * as io from 'io-ts'

const KNOWN_FOOD_STATES: CatalogFoodState[] = ['raw', 'cooked', 'prepared', 'dry', 'as_purchased']
const KNOWN_IDENTITY_SOURCES: CatalogIdentitySource[] = ['usda', 'ai_generated']
const KNOWN_PROVENANCES: SourcedNutritionProvenance[] = ['source_backed', 'ingredient_derived', 'ai_estimated']
const KNOWN_NUTRITION_BASES: CatalogNutritionBasis[] = ['per_100g', 'per_100ml', 'per_serving']
const KNOWN_ALLERGEN_STATUSES: CatalogAllergenStatus[] = ['known', 'unknown']

// An unrecognised code degrades to the least-verified member of its union instead of throwing: one odd row must
// not fail a whole page of results, and nothing unverified may be shown as verified — so 'usda', 'source_backed'
// and 'known' are never a fallback. 'per_100g' is the basis every publishable food carries, so a 100g reference
// can never be restated as one serving, and 'as_purchased' claims no preparation the server did not report.
export function convertCatalogFood(data: io.TypeOf<typeof CatalogFoodResponse>): CatalogFood {
  return {
    id: data.id,
    name: data.name,
    category: data.category,
    foodState: (KNOWN_FOOD_STATES as string[]).includes(data.foodState)
      ? (data.foodState as CatalogFoodState)
      : 'as_purchased',
    identitySource: (KNOWN_IDENTITY_SOURCES as string[]).includes(data.identitySource)
      ? (data.identitySource as CatalogIdentitySource)
      : 'ai_generated',
    nutritionProvenance: (KNOWN_PROVENANCES as string[]).includes(data.nutritionProvenance)
      ? (data.nutritionProvenance as SourcedNutritionProvenance)
      : 'ai_estimated',
    nutritionBasis: (KNOWN_NUTRITION_BASES as string[]).includes(data.nutritionBasis)
      ? (data.nutritionBasis as CatalogNutritionBasis)
      : 'per_100g',
    basisAmount: data.basisAmount,
    calories: data.calories,
    protein: data.protein,
    carbs: data.carbs,
    fat: data.fat,
    fiber: data.fiber ?? null,
    defaultPortion: {
      description: data.defaultPortion.description,
      amount: data.defaultPortion.amount,
      unit: data.defaultPortion.unit,
      gramWeight: data.defaultPortion.gramWeight
    },
    allergenTags: data.allergenTags,
    allergenStatus: (KNOWN_ALLERGEN_STATUSES as string[]).includes(data.allergenStatus)
      ? (data.allergenStatus as CatalogAllergenStatus)
      : 'unknown',
    foodGroup: data.foodGroup
  }
}
