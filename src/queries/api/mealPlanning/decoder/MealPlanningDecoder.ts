import {
  ClockTimeString,
  DayKeyString,
  MacroTargetsResponse,
  MacroTotalsResponse,
  NullableDayKeyString,
  NullableNumber,
  NullableString,
  NullableTimeZoneString,
  TimestampString
} from '@queries/api/macros/decoder/MacrosDecoder'
import * as io from 'io-ts'

// Mirrors state-of-health-be's src/types/mealPlanning.ts and src/types/recipe.ts response shapes.
//
// Lifecycle, status and slot members are literal unions rather than plain strings. The server narrows every
// one of these columns before it answers, so a value outside the set is a corrupt or mismatched response —
// and admitting one would let the client read "no setup" as a fresh start, or an ended plan as an active
// one, from data the server never sent. The sets the contract deliberately leaves open stay loose strings
// that the converters resolve with a named fallback instead: icon keys, badge codes and nutrition
// provenance, the open data lists (allergens, food groups, diet and allergen tags, flag details, food
// state), and the aisle and banner codes the grocery converter maps onto its own catch-all.
const mealFlag = io.type({code: io.string, detail: io.array(io.string)})

const nullable = <A>(codec: io.Type<A>): io.Type<A | null> => io.union([codec, io.null])

const setupStatusCode = io.union([
  io.literal('not_started'),
  io.literal('in_progress'),
  io.literal('ready_for_review'),
  io.literal('completed')
])

const setupStepCode = io.union([
  io.literal('goal'),
  io.literal('body'),
  io.literal('activity'),
  io.literal('diet'),
  io.literal('dislikes'),
  io.literal('schedule'),
  io.literal('cooking'),
  io.literal('review'),
  io.literal('targets_manual')
])

const targetRouteCode = io.union([io.literal('estimated'), io.literal('manual')])

const goalCode = io.union([io.literal('lose'), io.literal('maintain'), io.literal('gain')])

const paceLbPerWeekValue = io.union([io.literal(0.5), io.literal(1), io.literal(1.5)])

const sexForEstimateCode = io.union([io.literal('female'), io.literal('male'), io.literal('prefer_not_to_say')])

const heightUnitPrefCode = io.union([io.literal('ft_in'), io.literal('cm')])

const weightUnitPrefCode = io.union([io.literal('lb'), io.literal('kg')])

const activityLevelCode = io.union([
  io.literal('not_very_active'),
  io.literal('lightly_active'),
  io.literal('active'),
  io.literal('very_active')
])

const dietCode = io.union([
  io.literal('none'),
  io.literal('vegetarian'),
  io.literal('vegan'),
  io.literal('pescatarian')
])

const mealScheduleCode = io.union([io.literal('three'), io.literal('three_plus_snack')])

const cookingTimeLimitMinValue = io.union([io.literal(15), io.literal(30), io.literal(45), io.literal(60)])

const budgetTierValue = io.union([io.literal(1), io.literal(2), io.literal(3)])

const mealSlotCode = io.union([io.literal('breakfast'), io.literal('lunch'), io.literal('dinner'), io.literal('snack')])

const planStatusCode = io.union([io.literal('active'), io.literal('superseded')])

const recipeVersionStatusCode = io.union([io.literal('current'), io.literal('retired')])

const allergenStatusCode = io.union([io.literal('known'), io.literal('unknown')])

export const PreferencesResponse = io.type({
  setupStatus: setupStatusCode,
  setupStep: nullable(setupStepCode),
  reviewStartDate: NullableDayKeyString,
  timeZone: NullableTimeZoneString,
  targetRoute: nullable(targetRouteCode),
  revision: io.number,
  goal: nullable(goalCode),
  goalWeightKg: NullableNumber,
  paceLbPerWeek: nullable(paceLbPerWeekValue),
  age: NullableNumber,
  heightCm: NullableNumber,
  weightKg: NullableNumber,
  sexForEstimate: nullable(sexForEstimateCode),
  heightUnitPref: nullable(heightUnitPrefCode),
  weightUnitPref: nullable(weightUnitPrefCode),
  activityLevel: nullable(activityLevelCode),
  diet: nullable(dietCode),
  allergens: io.array(io.string),
  dislikedFoods: io.array(io.type({id: io.string, name: io.string, foodGroup: io.string})),
  dislikedFoodGroups: io.array(io.string),
  mealSchedule: nullable(mealScheduleCode),
  mealTimes: io.array(io.type({slot: mealSlotCode, time: ClockTimeString})),
  cookingTimeLimitMin: nullable(cookingTimeLimitMinValue),
  budget: io.union([io.type({amount: io.number, currency: io.string}), io.null]),
  noBudgetPreference: io.boolean,
  budgetTier: nullable(budgetTierValue),
  hasActivePlan: io.boolean
})

export const PreferencesSaveResponse = io.type({
  preferences: PreferencesResponse,
  affectedMealCount: io.number
})

export const TargetsResponse = io.type({
  targets: io.union([MacroTargetsResponse, io.null]),
  complete: io.boolean,
  source: NullableString,
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
  slot: mealSlotCode,
  slotTime: ClockTimeString,
  sortOrder: io.number,
  recipe: io.type({
    versionId: io.string,
    recipeId: io.string,
    name: io.string,
    iconKey: io.string,
    totalMinutes: io.number,
    badges: io.array(io.string),
    // The one literal in the file: planning admits recipes whose every ingredient is source-backed, so a
    // planned meal is never an estimate. A different value would mean labelling an estimate as sourced
    // nutrition, which is the one thing this response is not allowed to do.
    nutritionProvenance: io.literal('source_backed')
  }),
  portionMultiplier: io.number,
  portionText: io.string,
  planned: MacroTotalsResponse,
  flags: io.array(mealFlag),
  loggedEntries: io.array(
    io.type({
      entryId: io.string,
      date: DayKeyString,
      mealName: io.string,
      servings: io.number,
      loggedAt: TimestampString,
      recipeVersionId: io.string,
      recipeName: io.string
    })
  ),
  previousRecipe: io.union([io.type({versionId: io.string, name: io.string}), io.null])
})

export const MealPlanDayResponse = io.type({
  id: io.string,
  date: DayKeyString,
  dayIndex: io.number,
  plannedTotals: MacroTotalsResponse,
  isLastDay: io.boolean,
  meals: io.array(MealPlanMealResponse)
})

export const MealPlanResponse = io.type({
  id: io.string,
  revision: io.number,
  generationAttempt: io.number,
  startDate: DayKeyString,
  endDate: DayKeyString,
  status: planStatusCode,
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
  status: recipeVersionStatusCode,
  name: io.string,
  description: io.string,
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
  allergenStatus: allergenStatusCode,
  budgetTier: budgetTierValue,
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
      flaggedAt: TimestampString
    }),
    io.null
  ])
})

export const GroceryListResponse = io.type({
  planId: io.string,
  planRevision: io.number,
  startDate: DayKeyString,
  endDate: DayKeyString,
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
  date: DayKeyString,
  slot: mealSlotCode,
  recipeName: io.string,
  flags: io.array(mealFlag)
})

export const AffectedMealsResponse = io.type({
  meals: io.array(AffectedMealResponse)
})
