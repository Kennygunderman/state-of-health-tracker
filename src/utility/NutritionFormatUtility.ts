import type {ManualNutritionTargetValues, NutritionTargets} from '@data/models/NutritionTargets'

const CALORIE_LOCALE = 'en-US'
const GRAM_SUFFIX = 'g'
const MACRO_PAIR_SEPARATOR = ' / '
const PLUS_SIGN = '+'

// U+2212 MINUS SIGN, never an ASCII hyphen — the delta pill draws a true minus, which is also why the
// sign is applied here after Math.abs instead of being left to Intl (en-US emits '-' and even '-0')
const MINUS_SIGN = '\u2212'

// formatCalories and formatMacroGrams reproduce the shipped screens/Macros and MacroGramRow output byte
// for byte: the planner and the diary must never render the same confirmed figure two different ways
export function formatCalories(value: number): string {
  return Math.round(value).toLocaleString(CALORIE_LOCALE)
}

export function formatMacroGrams(value: number): string {
  return `${Math.round(value)}${GRAM_SUFFIX}`
}

export function formatMacroPair(actual: number, target: number): string {
  return `${Math.round(actual)}${MACRO_PAIR_SEPARATOR}${formatMacroGrams(target)}`
}

// Rounding the magnitude rather than the signed delta keeps the two directions symmetric: Math.round
// breaks negative halves toward positive infinity, which would render -69.5 as 69 and -0.5 as plain 0
export function formatSignedCalories(delta: number, unitSuffix: string): string {
  const rounded = Math.round(Math.abs(delta))
  const magnitude = formatCalories(rounded)

  if (rounded === 0) {
    return `${magnitude} ${unitSuffix}`
  }

  return `${delta < 0 ? MINUS_SIGN : PLUS_SIGN}${magnitude} ${unitSuffix}`
}

/**
 * Whether generation will accept these targets as they stand: it requires all four values and a source other
 * than 'legacy' (otherwise 422 targets_missing / 409 targets_unconfirmed).
 *
 * Staleness is deliberately no part of this — a confirmed estimate stays the value generation uses until the
 * user reconfirms it. A source this build cannot read decodes to null, so that one unknown value cannot reject
 * an otherwise valid response; an unreadable source is not a confirmed one, and is refused here rather than
 * assumed to be acceptable.
 */
export const isPlannerConfirmedTargets = (targets: NutritionTargets | null): targets is NutritionTargets =>
  targets !== null && targets.complete && (targets.source === 'estimated' || targets.source === 'manual')

/**
 * Whether the server holds any target figure at all. The four values are independently nullable, so a
 * calories-only account and a set with one saved macro both answer true: they are the user's own figures, and
 * the surfaces that review them lead with them rather than with a calculated estimate.
 */
export const hasAnyTargetValue = (targets: NutritionTargets | null): boolean => {
  if (targets === null || targets.targets === null) {
    return false
  }

  const {calories, protein, carbs, fat} = targets.targets

  return calories !== null || protein !== null || carbs !== null || fat !== null
}

/**
 * The four confirmed values when the server holds a complete, planner-confirmed set, and null otherwise.
 *
 * This is what an editor compares its fields against to tell "the user left the saved targets alone" from "the
 * user entered these numbers", so that neither answer rests on what the current estimate happens to be.
 */
export const confirmedTargetValues = (targets: NutritionTargets | null): ManualNutritionTargetValues | null => {
  if (!isPlannerConfirmedTargets(targets) || targets.targets === null) {
    return null
  }

  const {calories, protein, carbs, fat} = targets.targets

  if (calories === null || protein === null || carbs === null || fat === null) {
    return null
  }

  return {calories, protein, carbs, fat}
}
