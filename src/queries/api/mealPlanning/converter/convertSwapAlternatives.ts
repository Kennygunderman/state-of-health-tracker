import {RECIPE_ICON_KEYS, RecipeIconKey} from '@data/models/Recipe'
import {SwapAlternative, SwapAlternatives, SwapPreview} from '@data/models/SwapAlternative'
import {SwapAlternativesResponse, SwapPreviewResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

import {convertMealPlanMeal} from './convertMealPlanDay'
import {convertRecipeVersion} from './convertRecipeVersion'

const KNOWN_ICON_KEYS = RECIPE_ICON_KEYS as string[]

export function convertSwapAlternatives(data: io.TypeOf<typeof SwapAlternativesResponse>): SwapAlternatives {
  return {
    current: convertMealPlanMeal(data.current),
    // An empty list is a legitimate answer — it is what the no-alternatives state is drawn for — and the server's
    // ranking is kept exactly as sent, so the list stays stable across refetches.
    alternatives: data.alternatives.map(
      (alternative): SwapAlternative => ({
        recipeVersionId: alternative.recipeVersionId,
        name: alternative.name,
        // An unknown glyph code falls back to the generic bowl rather than failing the response.
        iconKey: KNOWN_ICON_KEYS.includes(alternative.iconKey) ? (alternative.iconKey as RecipeIconKey) : 'bowl',
        calories: alternative.calories,
        protein: alternative.protein,
        totalMinutes: alternative.totalMinutes,
        portionMultiplier: alternative.portionMultiplier
      })
    )
  }
}

export function convertSwapPreview(data: io.TypeOf<typeof SwapPreviewResponse>): SwapPreview {
  return {
    alternative: {
      recipe: convertRecipeVersion(data.alternative.recipe),
      // Unrounded: the commit sends this exact number back and the server recomputes the portion with the same
      // function, so rounding it here would answer 409 preview_stale on a swap the user could otherwise complete.
      portionMultiplier: data.alternative.portionMultiplier,
      portionText: data.alternative.portionText,
      nutrition: data.alternative.nutrition
    },
    dayTotalsIfSwapped: data.dayTotalsIfSwapped,
    targets: data.targets,
    calorieDelta: data.calorieDelta,
    planRevision: data.planRevision
  }
}
