import type {ManualNutritionTargetValues, NutritionTargets} from '@data/models/NutritionTargets'
import {formatServingsDisplay} from '@utility/ServingsUtility'

import {MEAL_PLAN_UNIT_VALUE_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

const NUMBER_LOCALE = 'en-US'
const GRAM_SUFFIX = 'g'
const MACRO_PAIR_SEPARATOR = ' / '
const PLUS_SIGN = '+'

// U+2212 MINUS SIGN, never an ASCII hyphen — the delta pill draws a true minus, which is also why the
// sign is applied here after Math.abs instead of being left to Intl (en-US emits '-' and even '-0')
const MINUS_SIGN = '\u2212'

/**
 * A whole figure grouped for display: 1940 reads as '1,940'.
 *
 * The one grouped presentation every target surface shares, which is why it is named for the notation rather
 * than for calories: the editor's gram fields are grouped by the same rule as its calorie field, and a second
 * implementation is how a target comes to read '1,940' on one screen and '1940' on another.
 */
export function formatWholeNumber(value: number): string {
  return Math.round(value).toLocaleString(NUMBER_LOCALE)
}

// formatCalories and formatMacroGrams reproduce the shipped screens/Macros and MacroGramRow output byte
// for byte: the planner and the diary must never render the same confirmed figure two different ways
export function formatCalories(value: number): string {
  return formatWholeNumber(value)
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
 * Count units that name no measure, only that the thing is counted: the design writes '¼' for a quarter of
 * an avocado, not '¼ each'. The same five keys the server suppresses (`GENERIC_COUNT_UNIT_KEYS` in
 * `services/recipe.logic.ts`), so a counted catalog portion and a counted recipe ingredient drop the same
 * words.
 */
const GENERIC_COUNT_UNITS: ReadonlySet<string> = new Set(['each', 'whole', 'piece', 'pieces', 'count'])

/**
 * Measurement abbreviations, which never inflect: '2 tbsp' and '3 oz', never '2 tbsps'. Mirrors `unitWord`
 * in the server's `utils/units.ts`, where only a spelled-out unit carries a plural form at all.
 */
const INVARIANT_UNITS: ReadonlySet<string> = new Set([
  'g',
  'kg',
  'mg',
  'mcg',
  'ml',
  'l',
  'oz',
  'fl oz',
  'lb',
  'lbs',
  'tbsp',
  'tsp'
])

const UNIT_SPACE_PATTERN = /\s+/g

// The counted noun of the unit and the English rules that inflect it, transcribed from `pluralizeCount` in
// the server's `utils/units.ts` — the function that WROTE these stored labels, which is why agreeing with it
// is the point. A stored unit is a unit word, never a qualified portion description, so the irregular-noun
// table that function carries for portion descriptions ('leaf', 'tomato') has nothing to match here: the
// whole shipped vocabulary (cup, slice, clove, head, bunch, liter, milliliter, tablespoon, teaspoon, gram)
// is regular under these rules. The head segment still stops at a comma or parenthesis so a unit
// that arrives qualified inflects its noun rather than the qualifier, and neither pattern carries a 'g'
// flag, so exec() keeps no lastIndex state between calls.
const HEAD_SEGMENT_PATTERN = /^[^,(]*/
const LAST_WORD_PATTERN = /[a-z]+(?=[^a-z]*$)/i
const ES_SUFFIX_PATTERN = /(?:s|x|z|ch|sh)$/
const CONSONANT_Y_PATTERN = /[^aeiou]y$/
const ES_PLURAL_PATTERN = /(?:s|x|z|ch|sh)es$/
const IES_PLURAL_PATTERN = /[^aeiou]ies$/
// An -s that ends a SINGULAR word ('glass', 'hummus', 'iris'): a unit already written in the plural
// ('slices') must not be inflected a second time into 'sliceses', and a trailing -s alone cannot tell the
// two apart.
const SINGULAR_S_ENDING_PATTERN = /(?:ss|us|is)$/

/** Takes an already lower-cased word; `matchCase` restores the stored word's own casing afterwards. */
const pluralizeWord = (lower: string): string => {
  if (ES_SUFFIX_PATTERN.test(lower)) {
    return `${lower}es`
  }

  if (CONSONANT_Y_PATTERN.test(lower)) {
    return `${lower.slice(0, -1)}ies`
  }

  return `${lower}s`
}

/** The inverse, for a unit the catalog already wrote in the plural ('slices'): one of them reads '1 slice'. */
const singularizeWord = (lower: string): string => {
  if (ES_PLURAL_PATTERN.test(lower)) {
    return lower.slice(0, -2)
  }

  if (IES_PLURAL_PATTERN.test(lower)) {
    return `${lower.slice(0, -3)}y`
  }

  return lower.slice(0, -1)
}

const isPluralWord = (lower: string): boolean => lower.endsWith('s') && !SINGULAR_S_ENDING_PATTERN.test(lower)

// The two functions above work in lower case, so the stored unit's own casing is restored afterwards:
// 'Cup' stays capitalised, 'CUP' stays shouted.
const matchCase = (original: string, replacement: string): string => {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase()
  }

  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1)
  }

  return replacement
}

/**
 * The unit word in the number `amount` calls for, inflected in whichever direction it needs — the stored
 * form may already be either ('2 tablespoon' and '2 tablespoons' are both real stored labels) — and left
 * alone when it is already right.
 */
const inflectUnit = (unit: string, amount: number): string => {
  const head = HEAD_SEGMENT_PATTERN.exec(unit)
  const match = (head ? LAST_WORD_PATTERN.exec(head[0]) : null) ?? LAST_WORD_PATTERN.exec(unit)

  if (!match) {
    return unit
  }

  const word = match[0]
  const lower = word.toLowerCase()
  const wantsPlural = amount > 1

  if (wantsPlural === isPluralWord(lower)) {
    return unit
  }

  const inflected = wantsPlural ? pluralizeWord(lower) : singularizeWord(lower)

  // A one-letter unit singularizes to nothing; the stored word is kept rather than erased.
  if (inflected.length === 0) {
    return unit
  }

  return unit.slice(0, match.index) + matchCase(word, inflected) + unit.slice(match.index + word.length)
}

/**
 * A machine-generated catalog portion label: '¼ cup', '⅓', '2 tablespoons', '3 oz', '10'.
 *
 * The catalog's `catalog_food_portions` rows are generated, not typed by a user — an amount is a raw number
 * ('0.25', '0.33') and a unit is whatever the source dataset called it, in either number ('tablespoon' and
 * 'tablespoons' both occur) — so the three rules of the display contract have to be applied here rather than
 * assumed of the data: the amount takes the app's fraction glyphs, a unit that names nothing but counting is
 * dropped, and any other unit word agrees with the amount.
 *
 * It extends the convention `ServingsUtility.formatIngredientQuantity` writes rather than competing with it:
 * the amount comes from the same `formatServingsDisplay` and the pair is joined by the same template, so a
 * catalog row and an ingredient row state an amount identically. The two extra rules are what separates a
 * generated label from an AUTHORED one — a recipe's unit is written by the recipe's author and the server
 * deliberately does not pluralise it (inflecting an authored 'cups' is how '2 cupses' happens), whereas the
 * server does pluralise a portion label it generates, so the catalog must agree with what it generated.
 *
 * Amounts are never snapped to a quarter: '0.33 cup' reads '⅓ cup' because ⅓ is a glyph, but a 0.2 amount
 * stays '0.2' — rounding it to '¼' would misstate the portion by 25 % while its gram weight, and therefore
 * the macros shown beside it, stay pinned to the stored value.
 *
 * Degenerate input states less rather than stating something false: an amount that is not a finite number
 * yields the empty string, so a row shows the name and calories it can vouch for instead of 'NaN cup', and a
 * blank or whitespace-only unit yields the amount alone instead of a label with a trailing space.
 */
export function formatCatalogPortionText(amount: number, unit: string | null): string {
  if (!Number.isFinite(amount)) {
    return ''
  }

  const amountText = formatServingsDisplay(amount)
  const label = (unit ?? '').trim().replace(UNIT_SPACE_PATTERN, ' ')
  const key = label.toLowerCase()

  if (label.length === 0 || GENERIC_COUNT_UNITS.has(key)) {
    return amountText
  }

  const rendered = INVARIANT_UNITS.has(key) ? label : inflectUnit(label, amount)

  return stringWithNamedParameters(MEAL_PLAN_UNIT_VALUE_TEMPLATE, {value: amountText, unit: rendered})
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
