import {MacroTargets, MacroTotals} from './Macros'
import {MealPlanDay, MealPlanMeal} from './MealPlan'
import {RecipeIconKey, RecipeVersion} from './Recipe'

export interface SwapAlternative {
  recipeVersionId: string
  name: string
  iconKey: RecipeIconKey
  calories: number
  protein: number
  totalMinutes: number
  portionMultiplier: number
}

export interface SwapAlternatives {
  current: MealPlanMeal
  alternatives: SwapAlternative[]
}

export interface SwapPreviewAlternative {
  recipe: RecipeVersion
  portionMultiplier: number
  portionText: string
  nutrition: MacroTotals
}

export interface SwapPreview {
  alternative: SwapPreviewAlternative
  dayTotalsIfSwapped: MacroTotals
  targets: MacroTargets
  // Signed: negative when the swap lowers the day's calories, positive when it raises them.
  calorieDelta: number
  planRevision: number
}

export interface SwapMealPayload {
  recipeVersionId: string
  portionMultiplier: number
  expectedPlanRevision: number
  idempotencyKey: string
}

export interface GroceryChangeSummary {
  added: number
  removed: number
  increased: number
}

export interface SwapMealResult {
  meal: MealPlanMeal
  day: MealPlanDay
  planRevision: number
  groceryChangeSummary: GroceryChangeSummary
}
