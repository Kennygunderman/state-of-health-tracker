import {SourcedNutritionProvenance} from '@data/models/NutritionProvenance'
import {MealSlot, RECIPE_BADGES, RECIPE_ICON_KEYS, RecipeBadge, RecipeIconKey, RecipeVersion} from '@data/models/Recipe'
import {RecipeVersionResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_ICON_KEYS = RECIPE_ICON_KEYS as string[]
const KNOWN_BADGES = RECIPE_BADGES as string[]
const KNOWN_STATUSES = ['current', 'retired'] as const satisfies readonly RecipeVersion['status'][]
const KNOWN_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const satisfies readonly MealSlot[]
const KNOWN_ALLERGEN_STATUSES = ['known', 'unknown'] as const satisfies readonly RecipeVersion['allergenStatus'][]
const KNOWN_BUDGET_TIERS = [1, 2, 3] as const satisfies readonly RecipeVersion['budgetTier'][]
const KNOWN_SOURCED_PROVENANCES = [
  'source_backed',
  'ingredient_derived',
  'ai_estimated'
] as const satisfies readonly SourcedNutritionProvenance[]

function resolveSourcedProvenance(value: string): SourcedNutritionProvenance {
  return (KNOWN_SOURCED_PROVENANCES as readonly string[]).includes(value)
    ? (value as SourcedNutritionProvenance)
    : 'ai_estimated'
}

export function convertRecipeVersion(data: io.TypeOf<typeof RecipeVersionResponse>): RecipeVersion {
  return {
    versionId: data.versionId,
    recipeId: data.recipeId,
    version: data.version,
    // The server's visibility rule already allowed this recipe, so an unknown status must not imply a retired one.
    status: (KNOWN_STATUSES as readonly string[]).includes(data.status)
      ? (data.status as RecipeVersion['status'])
      : 'current',
    name: data.name,
    description: data.description,
    // An unknown glyph code falls back to the generic bowl rather than failing the response.
    iconKey: KNOWN_ICON_KEYS.includes(data.iconKey) ? (data.iconKey as RecipeIconKey) : 'bowl',
    instructions: data.instructions,
    yieldServings: data.yieldServings,
    servingDescription: data.servingDescription,
    prepMinutes: data.prepMinutes,
    cookMinutes: data.cookMinutes,
    totalMinutes: data.totalMinutes,
    // Unknown slot and badge codes are dropped, never substituted, so a future code cannot mislabel a recipe.
    mealSlots: data.mealSlots.filter((slot): slot is MealSlot =>
      (KNOWN_MEAL_SLOTS as readonly string[]).includes(slot)
    ),
    badges: data.badges.filter((badge): badge is RecipeBadge => KNOWN_BADGES.includes(badge)),
    dietTags: data.dietTags,
    allergenTags: data.allergenTags,
    // Unrecognised safety, cost and provenance codes degrade to their weakest claim, never an unverified stronger one.
    allergenStatus: (KNOWN_ALLERGEN_STATUSES as readonly string[]).includes(data.allergenStatus)
      ? (data.allergenStatus as RecipeVersion['allergenStatus'])
      : 'unknown',
    budgetTier: (KNOWN_BUDGET_TIERS as readonly number[]).includes(data.budgetTier)
      ? (data.budgetTier as RecipeVersion['budgetTier'])
      : 3,
    nutritionProvenance: resolveSourcedProvenance(data.nutritionProvenance),
    perServing: data.perServing,
    ingredients: data.ingredients.map(ingredient => ({
      catalogFoodId: ingredient.catalogFoodId,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      gramWeight: ingredient.gramWeight,
      displayText: ingredient.displayText,
      nutritionProvenance: resolveSourcedProvenance(ingredient.nutritionProvenance),
      isOptional: ingredient.isOptional
    }))
  }
}
