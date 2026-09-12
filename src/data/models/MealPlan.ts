import {MacroTotals} from './Macros'
import {MealSlot, RecipeBadge, RecipeIconKey} from './Recipe'

export type MealPlanStatus = 'active' | 'superseded'

export type MealPlanFlagCode = 'diet' | 'allergen' | 'dislike' | 'cooking_time'

export interface MealPlanFlag {
  code: MealPlanFlagCode
  detail: string[]
}

export interface LoggedPlannedEntry {
  entryId: string
  date: string
  mealName: string
  servings: number
  loggedAt: string
  recipeVersionId: string
  recipeName: string
}

export interface PlannedRecipeSummary {
  versionId: string
  recipeId: string
  name: string
  iconKey: RecipeIconKey
  totalMinutes: number
  badges: RecipeBadge[]
  nutritionProvenance: 'source_backed'
}

export interface PreviousRecipeSummary {
  versionId: string
  name: string
}

export interface MealPlanSummary {
  plannedMeals: number
  groceryItemCount: number
  loggedEntryCount: number
}

export interface MealPlanMeal {
  id: string
  revision: number
  slot: MealSlot
  slotTime: string
  sortOrder: number
  recipe: PlannedRecipeSummary
  portionMultiplier: number
  portionText: string
  planned: MacroTotals
  flags: MealPlanFlag[]
  previousRecipe: PreviousRecipeSummary | null
  // A list, not one nullable link: a deliberate second serving of the same meal is its own diary entry. Ordered
  // by loggedAt (a timestamp, unlike each entry's day-key date) ascending, so the latest entry is the last one.
  loggedEntries: LoggedPlannedEntry[]
}

export interface MealPlanDay {
  id: string
  date: string
  dayIndex: number
  plannedTotals: MacroTotals
  isLastDay: boolean
  meals: MealPlanMeal[]
}

export interface MealPlan {
  id: string
  revision: number
  generationAttempt: number
  startDate: string
  endDate: string
  status: MealPlanStatus
  // Three members rather than one: targets is what the user's targets are now, generationTargets is the snapshot
  // this plan was built against, and targetsStale is their inequality. Nothing regenerates on its own, so a plan
  // outliving its targets has to stay both readable and captionable.
  targets: MacroTotals
  generationTargets: MacroTotals
  targetsStale: boolean
  preferencesRevision: number
  targetsRevision: number
  hasIncompatibilities: boolean
  summary: MealPlanSummary
  days: MealPlanDay[]
}

export interface CurrentMealPlans {
  current: MealPlan | null
  upcoming: MealPlan | null
}

export interface MealPlanDayEnvelope {
  planId: string
  planRevision: number
  planStatus: MealPlanStatus
  day: MealPlanDay
}
