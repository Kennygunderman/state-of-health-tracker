import {MacroTargets} from '@data/models/Macros'
import {TargetAuthorityDecision} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
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

/**
 * The targets the Diary summary card displays: the gram figures exactly as `resolveMacroTargets` produced them,
 * and the calorie figure from `decision.serverCalories ?? fallbackCalories` — character for character the
 * expression Account (`Account/index.tsx`) and Progress Activity (`Progress/components/ActivityTab/index.tsx`)
 * apply. One expression in all three places is the whole point: AAP 0.1.4 requires the Diary, Account and
 * Progress to agree, and agreement that is argued per authority state rather than shared outright is agreement
 * that holds until one of the arguments turns out to be wrong.
 *
 * The Diary is the one surface with a second source for that figure — `GET /macros/:date` answers with
 * `users.target_calories` embedded — and it is that second source, never the policy, that is dropped here. The
 * embedded figure reads the same column as the canonical read, so it looks interchangeable, but the two are
 * separately cached and can disagree:
 *
 * - The canonical read can disown a target the macros answer still carries. A backend rolled back past
 *   `/meal-planning/targets*` yields `'local'` while a cached macros answer still holds a figure, and AAP
 *   0.7.5 requires this surface to degrade to the device's `useUserData.targetCalories` exactly as for a user
 *   who never opted in.
 * - The canonical read can report a server target with no calorie in it — `calories: null` with macros intact,
 *   which the preserved legacy `PUT /api/user/targets` still writes (it applies an explicit null and leaves
 *   omitted macro columns alone). Another client clearing calories therefore yields `'server'` with
 *   `serverCalories: null` while a stale macros answer retains the old figure. Preferring the embedded value
 *   there would show a cleared target as current, and show it on the Diary alone.
 * - While the read has not answered (`'unresolved'`), `serverCalories` is null and every surface shows the
 *   local figure. The Diary briefly showing the device target before the server one is the same first-paint
 *   behaviour Account and Progress already have, and is the price of the three never contradicting each other.
 *
 * The gram targets are deliberately untouched by the authority: the card renders no gram target (its three
 * macro rows show consumed totals), and neither Account nor Progress shows grams, so there is no cross-surface
 * disagreement to close there.
 */
export function resolveAuthoritativeMacroTargets(
  decision: TargetAuthorityDecision,
  targets: MacroTargets,
  fallbackCalories: number
): ResolvedMacroTargets {
  const resolved = resolveMacroTargets(targets, fallbackCalories)

  return {...resolved, calories: decision.serverCalories ?? fallbackCalories}
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
