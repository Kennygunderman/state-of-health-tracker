import {MealPlanPreferences, MealPlanPreferencesSaveResult} from '@data/models/MealPlanPreferences'
import {PreferencesResponse, PreferencesSaveResponse} from '@queries/api/mealPlanning/decoder/MealPlanningDecoder'
import * as io from 'io-ts'

// Every code set on this response is a literal union in the codec, so an unanswered preference arrives as
// null and an answered one arrives as a value this app already knows. Nothing is resolved or defaulted
// here: a fallback would have to invent an answer the user never gave, and the one that mattered most —
// reading an unrecognised setupStatus as 'not_started' — restarted onboarding for a user who had finished
// it. A response carrying a value outside a set is refused at the decoder instead, which the screens show
// as an error rather than as a fresh start.
export function convertPreferences(data: io.TypeOf<typeof PreferencesResponse>): MealPlanPreferences {
  return {
    setupStatus: data.setupStatus,
    setupStep: data.setupStep,
    reviewStartDate: data.reviewStartDate,
    timeZone: data.timeZone,
    // Also the record that the body step was answered (see MealPlanPreferences), which is why it fails
    // closed: a route this version cannot read is refused at the decoder rather than carried through as
    // null, so the step is re-asked instead of being counted as answered on a value nothing could read.
    targetRoute: data.targetRoute,
    revision: data.revision,
    goal: data.goal,
    goalWeightKg: data.goalWeightKg,
    paceLbPerWeek: data.paceLbPerWeek,
    age: data.age,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    sexForEstimate: data.sexForEstimate,
    heightUnitPref: data.heightUnitPref,
    weightUnitPref: data.weightUnitPref,
    activityLevel: data.activityLevel,
    diet: data.diet,
    allergens: data.allergens,
    dislikedFoods: data.dislikedFoods.map(food => ({id: food.id, name: food.name, foodGroup: food.foodGroup})),
    dislikedFoodGroups: data.dislikedFoodGroups,
    mealSchedule: data.mealSchedule,
    // Wire order is kept as sent (breakfast, lunch, dinner, then snack) rather than sorted by time: a snack
    // may legitimately fall between lunch and dinner, and the day view is what orders meals chronologically.
    mealTimes: data.mealTimes.map(entry => ({slot: entry.slot, time: entry.time})),
    cookingTimeLimitMin: data.cookingTimeLimitMin,
    budget: data.budget !== null ? {amount: data.budget.amount, currency: data.budget.currency} : null,
    noBudgetPreference: data.noBudgetPreference,
    budgetTier: data.budgetTier,
    hasActivePlan: data.hasActivePlan
  }
}

export function convertPreferencesSaveResult(
  data: io.TypeOf<typeof PreferencesSaveResponse>
): MealPlanPreferencesSaveResult {
  return {
    preferences: convertPreferences(data.preferences),
    affectedMealCount: data.affectedMealCount
  }
}
