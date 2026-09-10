import {SOH_API_BASE_URL} from '@env'

// Host comes from the environment: local .env for `expo run`, EAS environment
// variables for builds (development/preview → dev API, production → prod).
// Fallback keeps release builds safe if the var is ever missing — it survives
// only there, because the preflight below rejects it under __DEV__ and Jest so
// a debug build or a test run can never silently reach production data.
const resolvedApiOrigin = SOH_API_BASE_URL || 'https://stateofhealthapi.com'

const baseApiUrl = `${resolvedApiOrigin}/api`

// react-native-dotenv only exposes the names allowlisted in babel.config.js, so
// an extra development host is added here rather than to the environment.
const SOH_DEV_API_HOSTS: string[] = []

// Compared on a label boundary, so a host that merely contains "ngrok" fails.
const NGROK_HOST_SUFFIXES = ['.ngrok.io', '.ngrok-free.app', '.ngrok.app', '.ngrok.dev']

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1']

const PRIVATE_IPV4_HOST = /^(?:10(?:\.\d{1,3}){3}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|192\.168(?:\.\d{1,3}){2})$/

const ORIGIN_AUTHORITY = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]*)/i

const hostOf = (origin: string): string => {
  const authority = ORIGIN_AUTHORITY.exec(origin.trim())?.[1]

  if (!authority) {
    return ''
  }

  const withoutUserInfo = authority.slice(authority.lastIndexOf('@') + 1)

  return withoutUserInfo.replace(/:\d*$/, '').toLowerCase().replace(/\.$/, '')
}

export const isNonProductionApiOrigin = (origin: string): boolean => {
  const host = hostOf(origin)

  if (!host) {
    return false
  }

  if (LOOPBACK_HOSTS.includes(host) || PRIVATE_IPV4_HOST.test(host)) {
    return true
  }

  if (NGROK_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    return true
  }

  return SOH_DEV_API_HOSTS.includes(host)
}

export const assertNonProductionApi = (): void => {
  if (!SOH_API_BASE_URL || SOH_API_BASE_URL.trim() === '') {
    throw new Error('SOH_API_BASE_URL is not set')
  }

  if (!isNonProductionApiOrigin(resolvedApiOrigin)) {
    throw new Error(
      `SOH_API_BASE_URL must point at a non-production API in development and tests, got ${resolvedApiOrigin}`
    )
  }
}

if (__DEV__ || typeof jest !== 'undefined') {
  assertNonProductionApi()
}

const Endpoints = {
  Exercises: `${baseApiUrl}/exercises`,
  Exercise: `${baseApiUrl}/exercise/`,
  Template: `${baseApiUrl}/template/`,
  Workout: `${baseApiUrl}/workout/`,
  WorkoutSummaries: `${baseApiUrl}/workouts/summary`,
  WeeklyWorkoutSummary: `${baseApiUrl}/workouts/weekly-summary/7`,
  ExerciseTemplates: `${baseApiUrl}/templates`,
  User: `${baseApiUrl}/user`,
  UserAvatar: `${baseApiUrl}/user/avatar`,
  Records: `${baseApiUrl}/records`,
  ExerciseHistory: (exerciseId: string) => `${baseApiUrl}/exercises/${exerciseId}/history`,
  Run: `${baseApiUrl}/run/`,
  Runs: `${baseApiUrl}/runs`,
  WeighIn: `${baseApiUrl}/weigh-in/`,
  WeighIns: `${baseApiUrl}/weigh-ins`,
  DailyMacros: (date: string) => `${baseApiUrl}/macros/${date}`,
  MacrosHistory: `${baseApiUrl}/macros/history`,
  MacroMealEntries: (mealId: string) => `${baseApiUrl}/macros/meal/${mealId}/entries`,
  MacroEntry: (entryId: string) => `${baseApiUrl}/macros/entry/${entryId}`,
  MacroEstimate: `${baseApiUrl}/macros/estimate`,
  AiUsage: `${baseApiUrl}/macros/ai-usage`,
  MacroLabelScan: `${baseApiUrl}/macros/label-scan`,
  MacroTargets: `${baseApiUrl}/user/targets`,
  Foods: `${baseApiUrl}/foods`,
  Food: (foodId: string) => `${baseApiUrl}/foods/${foodId}`,
  BrandedFoodSearch: (query: string) => `${baseApiUrl}/macros/search-branded-foods?q=${encodeURIComponent(query)}`,
  MealPlanPreferences: `${baseApiUrl}/meal-planning/preferences`,
  MealPlanPreferenceStep: (step: string) => `${baseApiUrl}/meal-planning/preferences/steps/${step}`,
  MealPlanTargets: `${baseApiUrl}/meal-planning/targets`,
  MealPlanTargetEstimate: `${baseApiUrl}/meal-planning/targets/estimate`,
  MealPlans: `${baseApiUrl}/meal-planning/plans`,
  CurrentMealPlan: `${baseApiUrl}/meal-planning/plans/current`,
  MealPlanDay: (planId: string, date: string) => `${baseApiUrl}/meal-planning/plans/${planId}/days/${date}`,
  RegenerateMealPlan: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/regenerate`,
  MealPlanAffectedMeals: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/affected-meals`,
  MealPlanSwapAlternatives: (planId: string, mealId: string) =>
    `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/alternatives`,
  MealPlanSwapPreview: (planId: string, mealId: string, recipeVersionId: string) =>
    `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/alternatives/${recipeVersionId}/preview`,
  MealPlanSwap: (planId: string, mealId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/swap`,
  MealPlanGroceries: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/groceries`,
  MealPlanGroceryItem: (planId: string, itemId: string) =>
    `${baseApiUrl}/meal-planning/plans/${planId}/groceries/${itemId}`,
  MealPlanGroceriesUncheckAll: (planId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/groceries/uncheck-all`,
  LogPlannedMeal: (planId: string, mealId: string) => `${baseApiUrl}/meal-planning/plans/${planId}/meals/${mealId}/log`,
  RecipeVersion: (recipeVersionId: string) => `${baseApiUrl}/recipes/${recipeVersionId}`,
  CatalogFoodSearch: (query: string, page: number, limit: number) =>
    `${baseApiUrl}/catalog/foods?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
  CatalogFoodSuggestions: (kind: 'dislike', limit: number) =>
    `${baseApiUrl}/catalog/foods/suggestions?kind=${encodeURIComponent(kind)}&limit=${limit}`,
  CatalogStatus: `${baseApiUrl}/catalog/status`
}

export default Endpoints
