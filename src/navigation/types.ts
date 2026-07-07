import {CoachGoal, CoachSex} from '@data/models/CoachState'
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
  'Coach Intro': undefined
  'Coach Setup': undefined
  'Coach Profile': {goal: CoachGoal; ratePctBw: number}
  'Coach Reveal': CoachRevealParams
  'Coach Settings': undefined
}

export type CoachRevealParams = {
  goal: CoachGoal
  ratePctBw: number
  sex: CoachSex | null
  birthDate: string | null
  heightCm: number | null
}

// 'add' shows "Add to {meal}" for a library/branded food; 'update' edits the
// servings of an entry that is already logged.
export type FoodDetailParams =
  | {path: 'add'; mealId: string; mealName: string; food: Food}
  | {path: 'update'; mealId: string; mealName: string; entry: MealEntry}

export type Navigation = NativeStackNavigationProp<RootStackParamList>

export type AddFoodRouteProp = RouteProp<RootStackParamList, 'Add Food'>

export type CreateFoodRouteProp = RouteProp<RootStackParamList, 'Create Food'>

export type FoodDetailRouteProp = RouteProp<RootStackParamList, 'Food Detail'>

export type LogWithAIRouteProp = RouteProp<RootStackParamList, 'Log with AI'>

export type ForgotPasswordRouteProp = RouteProp<AuthStackParamList, 'Forgot Password'>
