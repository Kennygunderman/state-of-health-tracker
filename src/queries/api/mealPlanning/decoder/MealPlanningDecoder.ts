import {MacroTargetsResponse, MacroTotalsResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import * as io from 'io-ts'

// Mirrors state-of-health-be's src/types/mealPlanning.ts and src/types/recipe.ts response shapes.
const nullableString = io.union([io.string, io.null])
const nullableNumber = io.union([io.number, io.null])
const mealFlag = io.type({code: io.string, detail: io.array(io.string)})

export const PreferencesResponse = io.type({
  setupStatus: io.string,
  setupStep: nullableString,
  reviewStartDate: nullableString,
  timeZone: nullableString,
  targetRoute: nullableString,
  revision: io.number,
  goal: nullableString,
  goalWeightKg: nullableNumber,
  paceLbPerWeek: nullableNumber,
  age: nullableNumber,
  heightCm: nullableNumber,
  weightKg: nullableNumber,
  sexForEstimate: nullableString,
  heightUnitPref: nullableString,
  weightUnitPref: nullableString,
  activityLevel: nullableString,
  diet: nullableString,
  allergens: io.array(io.string),
  dislikedFoods: io.array(io.type({id: io.string, name: io.string, foodGroup: io.string})),
  dislikedFoodGroups: io.array(io.string),
  mealSchedule: nullableString,
  mealTimes: io.array(io.type({slot: io.string, time: io.string})),
  cookingTimeLimitMin: nullableNumber,
  budget: io.union([io.type({amount: io.number, currency: io.string}), io.null]),
  noBudgetPreference: io.boolean,
  budgetTier: nullableNumber,
  hasActivePlan: io.boolean
})

export const PreferencesSaveResponse = io.type({
  preferences: PreferencesResponse,
  affectedMealCount: io.number
})

export const TargetsResponse = io.type({
  targets: io.union([MacroTargetsResponse, io.null]),
  complete: io.boolean,
  source: nullableString,
  stale: io.boolean,
  revision: io.number
})

export const TargetsSaveResponse = io.type({
  targets: TargetsResponse,
  feasibility: io.type({ok: io.boolean, warnings: io.array(io.string)})
})

export const MealPlanMealResponse = io.type({
  id: io.string,
  revision: io.number,
  slot: io.string,
  slotTime: io.string,
  sortOrder: io.number,
  recipe: io.type({
    versionId: io.string,
    recipeId: io.string,
    name: io.string,
    iconKey: io.string,
    totalMinutes: io.number,
    badges: io.array(io.string),
    nutritionProvenance: io.string
  }),
  portionMultiplier: io.number,
  portionText: io.string,
  planned: MacroTotalsResponse,
  flags: io.array(mealFlag),
  loggedEntries: io.array(
    io.type({
      entryId: io.string,
      date: io.string,
      mealName: io.string,
      servings: io.number,
      loggedAt: io.string,
      recipeVersionId: io.string,
      recipeName: io.string
    })
  ),
  previousRecipe: io.union([io.type({versionId: io.string, name: io.string}), io.null])
})

export const MealPlanDayResponse = io.type({
  id: io.string,
  date: io.string,
  dayIndex: io.number,
  plannedTotals: MacroTotalsResponse,
  isLastDay: io.boolean,
  meals: io.array(MealPlanMealResponse)
})

export const MealPlanResponse = io.type({
  id: io.string,
  revision: io.number,
  generationAttempt: io.number,
  startDate: io.string,
  endDate: io.string,
  status: io.string,
  targets: MacroTotalsResponse,
  generationTargets: MacroTotalsResponse,
  targetsStale: io.boolean,
  preferencesRevision: io.number,
  targetsRevision: io.number,
  hasIncompatibilities: io.boolean,
  summary: io.type({plannedMeals: io.number, groceryItemCount: io.number, loggedEntryCount: io.number}),
  days: io.array(MealPlanDayResponse)
})

export const RecipeVersionResponse = io.type({
  versionId: io.string,
  recipeId: io.string,
  version: io.number,
  status: io.string,
  name: io.string,
  description: nullableString,
  iconKey: io.string,
  instructions: io.array(io.string),
  yieldServings: io.number,
  servingDescription: io.string,
  prepMinutes: io.number,
  cookMinutes: io.number,
  totalMinutes: io.number,
  mealSlots: io.array(io.string),
  badges: io.array(io.string),
  dietTags: io.array(io.string),
  allergenTags: io.array(io.string),
  allergenStatus: io.string,
  budgetTier: io.number,
  nutritionProvenance: io.string,
  perServing: MacroTotalsResponse,
  ingredients: io.array(
    io.type({
      catalogFoodId: io.string,
      name: io.string,
      quantity: io.number,
      unit: io.string,
      gramWeight: io.number,
      displayText: io.string,
      nutritionProvenance: io.string,
      isOptional: io.boolean
    })
  )
})

export const SwapAlternativeResponse = io.type({
  recipeVersionId: io.string,
  name: io.string,
  iconKey: io.string,
  calories: io.number,
  protein: io.number,
  totalMinutes: io.number,
  portionMultiplier: io.number
})

export const SwapAlternativesResponse = io.type({
  current: MealPlanMealResponse,
  alternatives: io.array(SwapAlternativeResponse)
})

export const SwapPreviewResponse = io.type({
  alternative: io.type({
    recipe: RecipeVersionResponse,
    portionMultiplier: io.number,
    portionText: io.string,
    nutrition: MacroTotalsResponse
  }),
  dayTotalsIfSwapped: MacroTotalsResponse,
  targets: MacroTotalsResponse,
  calorieDelta: io.number,
  planRevision: io.number
})

export const GroceryItemResponse = io.type({
  id: io.string,
  catalogFoodId: io.string,
  foodState: io.string,
  name: io.string,
  quantityGrams: io.number,
  displayText: io.string,
  isChecked: io.boolean,
  flag: io.union([
    io.type({
      previousDisplayText: io.string,
      newDisplayText: io.string,
      deltaDisplayText: io.string,
      flaggedAt: io.string
    }),
    io.null
  ])
})

export const GroceryListResponse = io.type({
  planId: io.string,
  planRevision: io.number,
  startDate: io.string,
  endDate: io.string,
  totalCount: io.number,
  checkedCount: io.number,
  // `mealSlot` accompanies only the `updated_after_swap` code, `itemNames` only `amount_increased`.
  banner: io.union([
    io.intersection([io.type({code: io.string}), io.partial({mealSlot: io.string, itemNames: io.array(io.string)})]),
    io.null
  ]),
  sections: io.array(io.type({category: io.string, items: io.array(GroceryItemResponse)})),
  checkedItems: io.array(GroceryItemResponse)
})

export const GroceryToggleResponse = io.type({
  item: GroceryItemResponse,
  checkedCount: io.number
})

export const AffectedMealResponse = io.type({
  mealId: io.string,
  date: io.string,
  slot: io.string,
  recipeName: io.string,
  flags: io.array(mealFlag)
})

export const AffectedMealsResponse = io.type({
  meals: io.array(AffectedMealResponse)
})
