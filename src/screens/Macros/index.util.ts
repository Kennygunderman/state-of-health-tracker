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

/**
 * The targets the Diary renders, read from the `MacroTargets` block `GET /macros/:date` answers with.
 *
 * That embedded block is the Diary's source, and this feature does not change it: AAP 0.1.3 states that the
 * Diary and Macros History keep reading the targets embedded in the existing macros responses and that
 * `resolveMacroTargets` is unchanged, because both that block and `GET /meal-planning/targets` resolve to the
 * same `users.target_*` columns and agree once `dailyMacros` is invalidated — which every target save does
 * (`useSaveNutritionTargetsMutation` invalidates `queryKeys.dailyMacrosAll`). Routing the Diary's *display*
 * through the separately cached canonical read instead made the ring disagree with the day's own answer, so
 * the day's answer is what it reads.
 *
 * Server targets are nullable per field, so each unset field falls back: calories to the device's
 * `useUserData.targetCalories` (the never-opted-in value AAP 0.7.5 keeps), grams to the default splits.
 */
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

export type MacrosBodyKey = 'diary' | 'mealPlan'

// The Diary and Meal Plan bodies occupy the same position in the same ScrollView element, so React
// reuses one native scroll view for both and the incoming segment inherits the outgoing segment's
// scroll offset. Keying the container by this value is what remounts it on a segment change, so each
// segment opens at its own header; the two keys must therefore never collide.
export function resolveMacrosBodyKey(isDiarySegment: boolean): MacrosBodyKey {
  return isDiarySegment ? 'diary' : 'mealPlan'
}
