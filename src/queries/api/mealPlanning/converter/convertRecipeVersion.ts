import {SourcedNutritionProvenance} from '@data/models/NutritionProvenance'
import {MealSlot, RECIPE_BADGES, RECIPE_ICON_KEYS, RecipeBadge, RecipeIconKey, RecipeVersion} from '@data/models/Recipe'
import {RecipeVersionResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

const KNOWN_ICON_KEYS = RECIPE_ICON_KEYS as string[]
const KNOWN_BADGES = RECIPE_BADGES as string[]
const KNOWN_MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const satisfies readonly MealSlot[]
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
    // Carried, never defaulted: 'current' is what the plan and the swap list are built from, so reading an
    // unrecognised status as current would offer a version the server does not plan with. The codec admits
    // only the two the contract defines.
    status: data.status,
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
    // Both are closed sets the codec enforces, so they are carried as sent: an allergen status defaulted to
    // 'unknown' would hide a known one, and a cost band defaulted to 3 would misprice a cheap recipe.
    allergenStatus: data.allergenStatus,
    budgetTier: data.budgetTier,
    // Provenance is the one code that still degrades rather than rejects: it appears on a recipe and on every
    // ingredient, and an unrecognised value must read as the weakest claim, never as an unverified stronger one.
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
