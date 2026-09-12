import {Food} from '@data/models/Food'
import {MealEntry} from '@data/models/MealEntry'
import {NavigatorScreenParams, RouteProp} from '@react-navigation/native'
import {NativeStackNavigationProp} from '@react-navigation/native-stack'

export type AuthStackParamList = {
  'Log In': undefined
  Register: undefined
  'Forgot Password': {email?: string} | undefined
}

export type RootStackParamList = {
  'Add Exercise': undefined
  'Previous Daily Exercise Entries': undefined
  'Create Exercise': undefined
  'Create Template': undefined
  Home: undefined
  Auth: NavigatorScreenParams<AuthStackParamList>
  'Add Food': {mealId: string; mealName: string}
  'Create Food': {prefillName?: string} | undefined
  'Food Detail': FoodDetailParams
  'Log with AI': {mealId?: string; initialText?: string} | undefined
  'Macros History': undefined
  Macros: undefined
  'Meal Plan Intro': undefined
  'Meal Plan Goal': StepMode
  'Meal Plan About You': StepMode
  'Meal Plan Activity': StepMode
  'Meal Plan Diet': StepMode
  'Meal Plan Food Preferences': StepMode
  'Meal Plan Food Search': {mode: StepMode['mode']}
  'Meal Plan Schedule': StepMode
  'Meal Plan Cooking Budget': StepMode
  'Meal Plan Targets': StepMode
  'Meal Plan Edit Targets': {mode: 'setup' | 'edit' | 'manual'; returnTo: TargetsReturn}
  'Meal Plan Generating': {
    context: GenerationContext
    idempotencyKey: string
    expectedPreferencesRevision: number
    expectedTargetsRevision: number
    startDate: string
  }
  'Recipe Detail': {recipeVersionId: string; context: RecipeDetailContext}
  'Swap Meal': {planId: string; mealId: string; date: string; planRevision: number}
  'Swap Preview': {planId: string; mealId: string; date: string; recipeVersionId: string; planRevision: number}
  'Grocery List': {planId: string | null}
  'Log Planned Meal': {planId: string; mealId: string; date: string; planRevision: number}
  'Plan Settings': {planId: string}
}

// 'add' shows "Add to {meal}" for a library/branded food; 'update' edits the
// servings of an entry that is already logged.
export type FoodDetailParams =
  | {path: 'add'; mealId: string; mealName: string; food: Food}
  | {path: 'update'; mealId: string; mealName: string; entry: MealEntry}

// returnTo names the route a step screen popTo()s after "Save changes" (v7
// navigate() would push a duplicate); origin 'noMatch' marks an edit reached
// from a failed generation, whose idempotency key must not be reused.
export type StepMode =
  | {mode: 'setup'}
  | {mode: 'nextWeek'; startDate: string}
  | {mode: 'edit'; returnTo: 'review' | 'settings'; origin: 'row' | 'noMatch'; scope?: 'pace'}

export type TargetsReturn =
  | {kind: 'stack'; route: 'review' | 'settings' | 'diet'}
  | {kind: 'tab'; tab: 'Account' | 'ProgressStack' | 'MacrosStack'}

export type GenerationContext =
  | {kind: 'setup'}
  | {kind: 'regenerate'; planId: string; planRevision: number}
  | {kind: 'nextWeek'; startDate: string}

export type RecipeDetailContext =
  | {kind: 'plan'; planId: string; mealId: string; date: string}
  | {
      kind: 'preview'
      planId: string
      mealId: string
      date: string
      candidateRecipeVersionId: string
      planRevision: number
    }

export type Navigation = NativeStackNavigationProp<RootStackParamList>

export type AddFoodRouteProp = RouteProp<RootStackParamList, 'Add Food'>

export type CreateFoodRouteProp = RouteProp<RootStackParamList, 'Create Food'>

export type FoodDetailRouteProp = RouteProp<RootStackParamList, 'Food Detail'>

export type LogWithAIRouteProp = RouteProp<RootStackParamList, 'Log with AI'>

export type MealPlanGoalRouteProp = RouteProp<RootStackParamList, 'Meal Plan Goal'>

export type MealPlanAboutYouRouteProp = RouteProp<RootStackParamList, 'Meal Plan About You'>

export type MealPlanActivityRouteProp = RouteProp<RootStackParamList, 'Meal Plan Activity'>

export type MealPlanDietRouteProp = RouteProp<RootStackParamList, 'Meal Plan Diet'>

export type MealPlanFoodPreferencesRouteProp = RouteProp<RootStackParamList, 'Meal Plan Food Preferences'>

export type MealPlanFoodSearchRouteProp = RouteProp<RootStackParamList, 'Meal Plan Food Search'>

export type MealPlanScheduleRouteProp = RouteProp<RootStackParamList, 'Meal Plan Schedule'>

export type MealPlanCookingBudgetRouteProp = RouteProp<RootStackParamList, 'Meal Plan Cooking Budget'>

export type MealPlanTargetsRouteProp = RouteProp<RootStackParamList, 'Meal Plan Targets'>

export type MealPlanEditTargetsRouteProp = RouteProp<RootStackParamList, 'Meal Plan Edit Targets'>

export type MealPlanGeneratingRouteProp = RouteProp<RootStackParamList, 'Meal Plan Generating'>

export type RecipeDetailRouteProp = RouteProp<RootStackParamList, 'Recipe Detail'>

export type SwapMealRouteProp = RouteProp<RootStackParamList, 'Swap Meal'>

export type SwapPreviewRouteProp = RouteProp<RootStackParamList, 'Swap Preview'>

export type GroceryListRouteProp = RouteProp<RootStackParamList, 'Grocery List'>

export type LogPlannedMealRouteProp = RouteProp<RootStackParamList, 'Log Planned Meal'>

export type PlanSettingsRouteProp = RouteProp<RootStackParamList, 'Plan Settings'>

export type ForgotPasswordRouteProp = RouteProp<AuthStackParamList, 'Forgot Password'>
