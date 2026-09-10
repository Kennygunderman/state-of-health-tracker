import {MacroTargets} from '@data/models/Macros'
import {formatMacroPair as formatMacroPairValue} from '@utility/NutritionFormatUtility'

export const FALLBACK_PROTEIN_TARGET_G = 150

export const FALLBACK_CARBS_TARGET_G = 200

export const FALLBACK_FAT_TARGET_G = 65

export interface ResolvedMacroTargets {
  calories: number
  protein: number
  carbs: number
  fat: number
}

// Server targets are nullable per-field; unset fields fall back to the local
// target-calories setting and the default gram splits
export function resolveMacroTargets(targets: MacroTargets, fallbackCalories: number): ResolvedMacroTargets {
  return {
    calories: targets.calories ?? fallbackCalories,
    protein: targets.protein ?? FALLBACK_PROTEIN_TARGET_G,
    carbs: targets.carbs ?? FALLBACK_CARBS_TARGET_G,
    fat: targets.fat ?? FALLBACK_FAT_TARGET_G
  }
}

// Fraction of the target consumed, capped at 1 so progress visuals never
// overflow their track
export function progressFraction(consumed: number, target: number): number {
  if (target <= 0) {
    return 0
  }

  return Math.min(consumed / target, 1)
}

export function formatCalories(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

export function formatMacroPair(actual: number, target: number): string {
  return formatMacroPairValue(actual, target)
}

export interface CalorieBalance {
  amount: number
  isOver: boolean
}

// Rounds before comparing so a sub-calorie overage doesn't display as "0 Over"
export function calorieBalance(consumed: number, target: number): CalorieBalance {
  const diff = Math.round(target - consumed)

  return {amount: Math.abs(diff), isOver: diff < 0}
}
