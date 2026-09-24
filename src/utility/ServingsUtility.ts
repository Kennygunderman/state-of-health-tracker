import type {RecipeIngredient} from '@data/models/Recipe'

import {MEAL_PLAN_UNIT_VALUE_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

export interface ServingFraction {
  glyph: string
  value: number
}

export interface PerServingMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export const MIN_SERVINGS = 0.25

export const SERVING_FRACTIONS: ServingFraction[] = [
  {glyph: '¼', value: 0.25},
  {glyph: '⅓', value: 0.33},
  {glyph: '½', value: 0.5},
  {glyph: '⅔', value: 0.66},
  {glyph: '¾', value: 0.75}
]

const FRACTION_EPSILON = 0.001

// Keeps stepper/chip and scaled-ingredient math away from floating point dust (0.30000000000000004).
// One rounding rule for both: a servings figure and an ingredient amount are formatted by the same
// `formatServingsDisplay`, so rounding them to different precisions would print the same number two ways.
const roundServings = (servings: number): number => Math.round(servings * 100) / 100

export const getFractionalPart = (servings: number): number => roundServings(servings - Math.floor(servings))

// 1 -> '1', 1.5 -> '1½', 0.25 -> '¼', 1.2 -> '1.2'
export const formatServingsDisplay = (servings: number): string => {
  const whole = Math.floor(servings)
  const fraction = getFractionalPart(servings)

  if (fraction === 0) {
    return String(whole)
  }

  const glyph = SERVING_FRACTIONS.find(f => Math.abs(f.value - fraction) < FRACTION_EPSILON)?.glyph

  if (!glyph) {
    return String(roundServings(servings))
  }

  return whole === 0 ? glyph : `${whole}${glyph}`
}

// Each whole number splits into the same stops as the fraction chips:
// 1 -> 1¼ -> 1⅓ -> 1½ -> 1⅔ -> 1¾ -> 2
const STEP_FRACTIONS = [0, ...SERVING_FRACTIONS.map(f => f.value)]

export const stepServings = (servings: number, direction: 1 | -1): number => {
  const whole = Math.floor(servings)
  const fraction = getFractionalPart(servings)

  if (direction === 1) {
    const next = STEP_FRACTIONS.find(f => f > fraction + FRACTION_EPSILON)

    return roundServings(next === undefined ? whole + 1 : whole + next)
  }

  const prev = [...STEP_FRACTIONS].reverse().find(f => f < fraction - FRACTION_EPSILON)
  const stepped = prev === undefined ? whole - 1 + 0.75 : whole + prev

  return Math.max(MIN_SERVINGS, roundServings(stepped))
}

// Replaces only the fractional part, keeping the whole part: 1.5 + ¼ -> 1.25
export const applyFractionPart = (servings: number, fraction: number): number =>
  roundServings(Math.floor(servings) + fraction)

export const isFractionSelected = (servings: number, fraction: number): boolean =>
  Math.abs(getFractionalPart(servings) - fraction) < FRACTION_EPSILON

export const scaleMacros = (perServing: PerServingMacros, servings: number): PerServingMacros => ({
  calories: Math.round(perServing.calories * servings),
  protein: Math.round(perServing.protein * servings),
  carbs: Math.round(perServing.carbs * servings),
  fat: Math.round(perServing.fat * servings)
})

/**
 * The one rule for turning a stored recipe ingredient amount into the amount a screen shows.
 *
 * IT LIVES HERE BECAUSE TWO SCREEN TREES NEED IT. Recipe detail (frame 12, 'Your portion' | 'Full recipe') and the
 * swap preview (frame 13b, 'Replacing lunch') both render ingredient rows beside nutrition for ONE portion, and
 * `RecipeIngredient` carries WHOLE-RECIPE amounts — `quantity`, `gramWeight` and the pre-formatted `displayText` are
 * the recipe as published, which yields `yieldServings` servings, because a recipe response carries no planned-meal
 * context at all. Each screen therefore has to scale, and when each screen owned its own copy of that arithmetic they
 * disagreed: the preview showed whole-recipe amounts next to portion-scaled nutrition, so a 2-serving recipe read
 * '10 oz chicken · 610 cal' for a 305 cal portion. Rule mobile-component-structure forbids one screen's util
 * importing another's, so a helper crossing component trees is global and belongs in `src/utility/` — and it belongs
 * in THIS module because an ingredient amount is formatted by `formatServingsDisplay` above, the same way the
 * servings stepper writes its fractions.
 */

/** The whole recipe as published — 'Full recipe' on frame 12, and the amount every stored quantity already is. */
export const WHOLE_RECIPE_FACTOR = 1

/**
 * The quantity fields a displayed amount is composed from, declared as a subset of `RecipeIngredient` rather
 * than the model itself so a row whose pre-formatted `displayText` never arrived still has a type to travel in.
 */
export type IngredientAmount = Pick<RecipeIngredient, 'quantity'> & {
  unit?: string | null
  displayText?: string | null
}

/** A rendered ingredient row: what it is, how much of it, and whether the recipe merely allows it. */
export interface DisplayedIngredient {
  name: string
  quantityText: string
  isOptional: boolean
}

/**
 * The factor that turns a whole-recipe amount into the amount for one planned portion.
 *
 * `portionMultiplier / yieldServings`: the recipe makes `yieldServings` servings, and the plan portions it at
 * `portionMultiplier` of one serving — the same two numbers the server scaled the portion's nutrition by, which
 * is what keeps the amounts and the calories beside them describing the same plate.
 *
 * A yield that cannot divide (zero, negative or non-finite) and a non-finite multiplier both fall back to the
 * whole-recipe amount rather than to `Infinity` or `NaN`, because a visible stored amount is recoverable by a
 * user and 'NaN cup' is not. Neither is reachable for a published recipe (`yield_servings` is positive and the
 * multiplier comes from the plan's own closed set), so this is the degenerate-input guard, not a routine path.
 */
export function plannedPortionFactor(portionMultiplier: number, yieldServings: number): number {
  if (!Number.isFinite(portionMultiplier) || !Number.isFinite(yieldServings) || yieldServings <= 0) {
    return WHOLE_RECIPE_FACTOR
  }

  return portionMultiplier / yieldServings
}

/* ---------------------------------------------------------------------------
 * Ingredient display — the recipe card's own convention
 *
 * A SECOND formatting rule, deliberately separate from `formatServingsDisplay` above, because the two numbers are
 * different kinds of thing.
 *
 * A servings figure is the user's OWN input: it is typed into the stepper on frame 15 and POSTed as the portion
 * eaten, so it is echoed back losslessly — 1.2 servings has to read '1.2', or the diary would report a portion
 * nobody chose. An ingredient amount is a MEASUREMENT this app derived by dividing a published recipe, so it is
 * written the way a recipe is written: in the fractions a cook measures, in whole grams, with the unit inflected,
 * and with a placeholder unit that names nothing left off. '0.31 cup', '1.88 clove' and '187½ g' are not amounts
 * anyone can act on, and '1 each' names nothing at all.
 *
 * The convention is the server's, not this module's invention: `backend/src/utils/units.ts` holds the same ladder,
 * the same precision sets and the same plural rule, and every recipe row arrives carrying the `displayText` that
 * rendered. The client re-derives only because the portion toggle scales in the app — so at the whole-recipe factor
 * the authored text is preferred outright, and every other factor is rendered by the rules that produced it.
 * ------------------------------------------------------------------------- */

// The fraction chips' five glyphs, measured exactly. A chip stores ⅓ as the two-decimal 0.33 the stepper
// round-trips, but an ingredient amount is SNAPPED to its nearest stop rather than compared with a typed one, so
// the stop itself has to be the true third: a third of a 2-cup recipe is 0.666…, which 0.66 would place nearer ½.
const EXACT_FRACTION_VALUES: Record<string, number> = {
  '¼': 0.25,
  '⅓': 1 / 3,
  '½': 0.5,
  '⅔': 2 / 3,
  '¾': 0.75
}

// The stops an ingredient amount may land on, smallest first: the chip set, plus the two bounds a snap needs — 0,
// which renders as the whole number alone, and 1, which carries into it. Derived from SERVING_FRACTIONS so the two
// surfaces cannot come to disagree about which glyphs exist; a glyph with no exact value declared above keeps the
// chip's own.
const INGREDIENT_FRACTION_LADDER: ServingFraction[] = [
  {glyph: '', value: 0},
  ...SERVING_FRACTIONS.map(fraction => ({
    glyph: fraction.glyph,
    value: EXACT_FRACTION_VALUES[fraction.glyph] ?? fraction.value
  })),
  {glyph: '', value: 1}
]

const SMALLEST_FRACTION_INDEX = 1
const CARRY_FRACTION_INDEX = INGREDIENT_FRACTION_LADDER.length - 1
const TENTHS_PER_UNIT = 10

// Two stops count as equidistant when their distances differ by less than this.
//
// An exact comparison would make the tie rule below depend on binary representation rather than on arithmetic: a
// third of 1¼ cups is exactly 5/12, the true midpoint between ⅓ and ½, but the nearest double to it sits a hair
// BELOW that midpoint, so `1.25 * (1 / 3)` would take ⅓ while `1.25 / 3` takes ½ — the same amount rendered two
// ways by two call sites that agree. The closest two real stops are ¼ and ⅓, 0.083 apart, so a tolerance eight
// orders of magnitude smaller separates genuine ties from genuine differences and nothing else. The server's own
// ladder carries the same tolerance, which is what makes the two renderings the same rendering.
const FRACTION_TIE_EPSILON = 1e-9

/** A snapped or rounded ingredient amount: what to print, and the number it now stands for. */
export interface SnappedAmount {
  /** The rendered amount, with no unit: '2', '¾', '1¼', '188', '6.2'. */
  text: string
  /**
   * The number `text` stands for, which is what decides the unit's plural. Snapped, not the input: '¾' of a cup is
   * one cup, and '1¼' is two.
   */
  value: number
}

// An amount that is not a number has no rendering at all. The zero value keeps a caller's plural decision from
// reading NaN, and the empty text is what makes `formatIngredientQuantity` fall back to the stored row.
const NO_AMOUNT: SnappedAmount = {text: '', value: 0}

const normaliseUnit = (unit: string): string => unit.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * An ingredient amount on the fraction ladder: 0.31 -> '¼', 0.67 -> '⅔', 1.9 -> '2', 2.5 -> '2½'.
 *
 * The fractional part takes the NEAREST stop, and a tie takes the larger one — a cook measuring an eighth of a cup
 * reaches for the quarter, not for nothing. A snap to 1 carries into the whole, so 1.9 cups reads '2' and never
 * '1'. A positive amount that would round away to nothing renders as the smallest stop instead: a row the recipe
 * needs must not read as none of it.
 */
export const snapToIngredientFraction = (value: number): SnappedAmount => {
  if (!Number.isFinite(value)) {
    return NO_AMOUNT
  }

  const negative = value < 0
  const sign = negative ? '-' : ''
  const magnitude = Math.abs(value)
  const wholeOfInput = Math.floor(magnitude)
  const fraction = magnitude - wholeOfInput

  let stop = 0
  let bestDistance = Math.abs(fraction - INGREDIENT_FRACTION_LADDER[0].value)

  for (let index = 1; index < INGREDIENT_FRACTION_LADDER.length; index += 1) {
    // Within the tie tolerance of the best so far counts as equal, and the later — larger — stop wins it: a cook
    // measuring midway between an eighth and a quarter of a cup reaches for the quarter.
    const distance = Math.abs(fraction - INGREDIENT_FRACTION_LADDER[index].value)

    if (distance <= bestDistance + FRACTION_TIE_EPSILON) {
      stop = index
      bestDistance = distance
    }
  }

  const carries = stop === CARRY_FRACTION_INDEX
  const whole = carries ? wholeOfInput + 1 : wholeOfInput

  let glyph = carries ? '' : INGREDIENT_FRACTION_LADDER[stop].glyph

  if (whole === 0 && glyph === '' && magnitude > 0) {
    stop = SMALLEST_FRACTION_INDEX
    glyph = INGREDIENT_FRACTION_LADDER[stop].glyph
  }

  // A true zero prints as '0', the way the servings formatter prints it.
  if (whole === 0 && glyph === '') {
    return {text: `${sign}0`, value: 0}
  }

  const snapped = whole + (glyph === '' ? 0 : INGREDIENT_FRACTION_LADDER[stop].value)
  const wholeText = whole === 0 ? '' : String(whole)

  return {text: `${sign}${wholeText}${glyph}`, value: (negative ? -1 : 1) * snapped}
}

/** How precisely an ingredient amount in a given unit is written. */
export type IngredientUnitPrecision = 'integer' | 'tenth' | 'fraction'

// Base units, where a fraction of one sits below what any kitchen scale reads: grams and millilitres are written
// whole. '187½ g' is a measurement nobody takes; '188 g' is.
const INTEGER_PRECISION_UNITS = new Set([
  'g',
  'gram',
  'grams',
  'mg',
  'milligram',
  'milligrams',
  'ml',
  'milliliter',
  'milliliters',
  'millilitre',
  'millilitres'
])

// Larger and derived measures, read off a scale or a jug rather than measured in spoons: a tenth is the precision
// such a number is worth.
const TENTH_PRECISION_UNITS = new Set([
  'kg',
  'kilogram',
  'kilograms',
  'oz',
  'ounce',
  'ounces',
  'lb',
  'lbs',
  'pound',
  'pounds',
  'l',
  'liter',
  'liters',
  'litre',
  'litres',
  'fl oz',
  'fluid ounce',
  'fluid ounces'
])

/**
 * The precision an ingredient amount in `unit` is written to.
 *
 * Kitchen measures (cups, spoons) and counted things (cloves, slices, an unrecognised token, no unit at all) take
 * fraction glyphs, because that is how the measure itself works and how frame 12 draws it. Weights and volumes
 * read off an instrument take numbers.
 */
export const ingredientUnitPrecision = (unit: string): IngredientUnitPrecision => {
  const key = normaliseUnit(unit)

  if (INTEGER_PRECISION_UNITS.has(key)) {
    return 'integer'
  }

  if (TENTH_PRECISION_UNITS.has(key)) {
    return 'tenth'
  }

  return 'fraction'
}

const roundToInteger = (value: number): number => Math.round(value)

const roundToTenth = (value: number): number => Math.round(value * TENTHS_PER_UNIT) / TENTHS_PER_UNIT

/**
 * An ingredient amount written to its unit's numeric precision: 187.5 g -> '188', 6.25 oz -> '6.3'.
 *
 * Clamped away from zero at a tenth, so an ingredient the recipe needs never reads as '0 g' because a portion
 * divided it below a gram.
 */
export const roundIngredientAmount = (value: number, precision: 'integer' | 'tenth'): SnappedAmount => {
  if (!Number.isFinite(value)) {
    return NO_AMOUNT
  }

  const rounded = precision === 'integer' ? roundToInteger(value) : roundToTenth(value)

  if (rounded !== 0 || value === 0) {
    return {text: String(rounded), value: rounded}
  }

  const tenth = roundToTenth(value)
  const floored = tenth !== 0 ? tenth : Math.sign(value) / TENTHS_PER_UNIT

  return {text: String(floored), value: floored}
}

// Count units that name nothing: the design shows '¼' for a quarter of an avocado, never '¼ each'. The catalog
// stores such a row with an explicit placeholder unit — 57 of the 269 seeded ingredient rows carry one — so the
// placeholder is dropped at the point of display rather than wished out of the data.
const GENERIC_COUNT_UNITS = new Set(['each', 'whole', 'piece', 'pieces', 'count'])

/** Whether `unit` is a count placeholder that names nothing and is therefore not printed. */
export const isGenericCountUnit = (unit: string): boolean => GENERIC_COUNT_UNITS.has(normaliseUnit(unit))

// Symbols, not words: '8 tbsp' and '24 oz' are already correct at any amount, and '8 tbsps' is not a form anyone
// writes. Everything else a recipe puts in its unit column is an English noun and inflects.
const INVARIANT_UNIT_ABBREVIATIONS = new Set(['g', 'kg', 'mg', 'ml', 'l', 'oz', 'lb', 'lbs', 'tsp', 'tbsp', 'fl oz'])

/** Whether `unit` is an abbreviation, which is written the same at every amount. */
export const isInvariantUnitAbbreviation = (unit: string): boolean =>
  INVARIANT_UNIT_ABBREVIATIONS.has(normaliseUnit(unit))

// The irregular nouns this table exists for, read BOTH ways — SINGULAR_EXCEPTIONS below is its inverse — so one
// entry fixes one noun in both directions: '-o' and '-f' singulars whose plural is not a plain s, the two -ies
// plurals the rules below cannot spell backwards ('cookies' becomes 'cooky'), and one invariant plural the -sh
// rule would otherwise inflect. The same table the server keeps, so a unit either side renders the same word.
// Every unit noun in the seeded corpus — cup, clove, slice — is regular and needs no entry.
const PLURAL_EXCEPTIONS: Record<string, string> = {
  egg: 'eggs',
  tomato: 'tomatoes',
  potato: 'potatoes',
  leaf: 'leaves',
  loaf: 'loaves',
  half: 'halves',
  cookie: 'cookies',
  pierogi: 'pierogies',
  goldfish: 'goldfish'
}

const ES_SUFFIX_PATTERN = /(?:s|x|z|ch|sh)$/
const CONSONANT_Y_PATTERN = /[^aeiou]y$/
// An -s that ends a SINGULAR word: 'glass', 'hummus', 'iris'. A unit already written in the plural ('cups') must
// not be inflected a second time into 'cupses', and a trailing 's' alone cannot tell the two apart.
const SINGULAR_S_ENDING_PATTERN = /(?:ss|us|is)$/
const ES_PLURAL_PATTERN = /(?:s|x|z|ch|sh)es$/
const IES_PLURAL_PATTERN = /[^aeiou]ies$/
// The unit's own noun. A unit qualified after a comma or a parenthesis ('cup, packed') names the measure first, so
// inflecting the last word would pluralise the qualifier ('packeds') instead of the measure. Neither pattern
// carries a 'g' flag, so exec() keeps no lastIndex state between calls.
const HEAD_SEGMENT_PATTERN = /^[^,(]*/
const LAST_WORD_PATTERN = /[a-z]+(?=[^a-z]*$)/i

// A head segment with no letters of its own ('(6 oz) tub') falls back to the whole unit, which is where the noun
// then has to be. The head is a prefix either way, so `match.index` addresses both.
const headNounMatch = (unit: string): RegExpExecArray | null => {
  const head = HEAD_SEGMENT_PATTERN.exec(unit)
  const withinHead = head ? LAST_WORD_PATTERN.exec(head[0]) : null

  return withinHead ?? LAST_WORD_PATTERN.exec(unit)
}

const invertTable = (table: Record<string, string>): Record<string, string> => {
  const inverted: Record<string, string> = {}

  for (const key of Object.keys(table)) {
    inverted[table[key]] = key
  }

  return inverted
}

// The same irregulars read the other way, built from the table above so the pair cannot drift apart.
const SINGULAR_EXCEPTIONS: Record<string, string> = invertTable(PLURAL_EXCEPTIONS)

const pluralizeWord = (word: string): string => {
  const lower = word.toLowerCase()
  const exception = PLURAL_EXCEPTIONS[lower]

  if (exception) {
    return exception
  }

  if (ES_SUFFIX_PATTERN.test(lower)) {
    return `${lower}es`
  }

  if (CONSONANT_Y_PATTERN.test(lower)) {
    return `${lower.slice(0, -1)}ies`
  }

  return `${lower}s`
}

const singularizeWord = (word: string): string => {
  const lower = word.toLowerCase()
  const exception = SINGULAR_EXCEPTIONS[lower]

  if (exception) {
    return exception
  }

  if (ES_PLURAL_PATTERN.test(lower)) {
    return lower.slice(0, -2)
  }

  if (IES_PLURAL_PATTERN.test(lower)) {
    return `${lower.slice(0, -3)}y`
  }

  return lower.slice(0, -1)
}

const alreadyPlural = (word: string): boolean => {
  const lower = word.toLowerCase()

  return lower.endsWith('s') && !SINGULAR_S_ENDING_PATTERN.test(lower)
}

// The exception tables are keyed in lower case, so the unit's own casing is restored afterwards: 'Cup' stays
// capitalised, 'CUP' stays shouted.
const matchCase = (original: string, replacement: string): string => {
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase()
  }

  if (original.charAt(0) === original.charAt(0).toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  }

  return replacement
}

/**
 * A unit word in the number `amount` calls for: '2 cups', '1 cup', '½ cup', '4 cloves'.
 *
 * Separate from the count pluralisation a grocery row uses, because the two answer 'how many' differently: a
 * grocery count row is a whole number of items, while an ingredient amount is continuous — half a cup, one and a
 * quarter cups — so the plural turns on `amount > 1`. Without it, halving an authored '3 cloves' reads '½ cloves'.
 *
 * A unit the recipe wrote in the plural is inflected in whichever direction it needs, because the seeded corpus
 * spells both 'cup' and 'cups' (79 rows against 4) and both 'clove' and 'cloves'.
 */
export const pluralizeUnit = (amount: number, unit: string): string => {
  const word = unit.trim()

  if (word.length === 0 || isInvariantUnitAbbreviation(word) || !Number.isFinite(amount)) {
    return word
  }

  const match = headNounMatch(word)

  if (!match) {
    return word
  }

  const noun = match[0]
  const wantsSingular = !(Math.abs(amount) > 1)

  // Nothing to do when the unit is already written in the number asked for.
  if (wantsSingular !== alreadyPlural(noun)) {
    return word
  }

  const inflected = matchCase(noun, wantsSingular ? singularizeWord(noun) : pluralizeWord(noun))

  return word.slice(0, match.index) + inflected + word.slice(match.index + noun.length)
}

/**
 * One ingredient amount as the recipe card renders it: '6.2 oz', '1¼ cups', '⅓ cup', '188 g', '2 cloves', '¼'.
 *
 * The ingredient's OWN unit is kept — a recipe that says 5 oz of chicken must not start saying 0.3 lb — and the
 * unit is printed only when it names something.
 */
export const formatIngredientAmount = (value: number, unit: string): string => {
  if (!Number.isFinite(value)) {
    return ''
  }

  const label = unit.trim()
  const precision = ingredientUnitPrecision(label)
  const amount = precision === 'fraction' ? snapToIngredientFraction(value) : roundIngredientAmount(value, precision)

  if (label.length === 0 || isGenericCountUnit(label)) {
    return amount.text
  }

  return stringWithNamedParameters(MEAL_PLAN_UNIT_VALUE_TEMPLATE, {
    value: amount.text,
    unit: pluralizeUnit(amount.value, label)
  })
}

const QUALIFIER_BOUNDARY_PATTERN = /^[\s,(]/
const CONTAINS_DIGIT_PATTERN = /\d/

/**
 * The phrasing an authored `displayText` carries beyond its own amount and unit: ', chopped', ' leaves',
 * ' banana', ' medium'.
 *
 * Recomputing an amount for a portion would otherwise throw this away, and it is the part of the row a cook acts
 * on — '¼ cup' and '¼ cup, chopped' send you to different places. 13 of the 269 seeded rows carry one.
 *
 * SELF-VERIFYING, which is what makes it safe to append to a recomputed amount: the qualifier is whatever remains
 * after THIS module's own rendering of the row's stored amount, and it is returned only when that rendering is
 * genuinely the authored text's prefix. A row whose text disagrees with its own columns — 320 g labelled
 * '2 cups, drained' — therefore contributes no qualifier rather than a mangled one, and a remainder carrying
 * digits is treated as bound to the amount it was written for ('(4 medium)') and dropped once that amount changes.
 * The boundary check keeps a bare numeric prefix from splitting a number in half.
 */
export const authoredAmountQualifier = (
  displayText: string | null | undefined,
  value: number,
  unit: string
): string => {
  if (displayText === null || displayText === undefined || !Number.isFinite(value)) {
    return ''
  }

  const authored = displayText.trim()
  const rendered = formatIngredientAmount(value, unit)

  if (authored.length === 0 || rendered.length === 0 || !authored.startsWith(rendered)) {
    return ''
  }

  const qualifier = authored.slice(rendered.length)

  if (qualifier.length === 0) {
    return ''
  }

  return QUALIFIER_BOUNDARY_PATTERN.test(qualifier) && !CONTAINS_DIGIT_PATTERN.test(qualifier) ? qualifier : ''
}

/**
 * One ingredient amount at `factor`, as frames 12 and 13b write it: '6.2 oz', '1¼ cups', '⅓ cup', '188 g', '¼'.
 *
 * AT THE WHOLE-RECIPE FACTOR THE AUTHORED TEXT WINS. `displayText` is the amount the recipe publishes, written by
 * a human and rendered by the same convention this module applies, so no derivation can improve on it — and it is
 * the one row a client and the server can be checked against each other on. Only a factor that actually divides
 * the recipe needs an amount computed, and then it is computed by that convention rather than by the servings
 * stepper's: the stepper echoes a typed number back losslessly, which is right for a portion the user chose and
 * wrong for a measurement, where it produced '0.31 cup', '1.88 clove' and '1¼ each'.
 *
 * The authored row's own qualifier is carried across every other factor, so '1¼ cups, chopped' halves to
 * '⅔ cup, chopped' rather than losing the instruction along with the number.
 *
 * A non-finite quantity ('a pinch') has no amount to scale, so the stored text is the only amount that exists. A
 * non-finite factor is the degenerate input `plannedPortionFactor` already guards, and falls back the same way it
 * does — to the whole recipe — because 'NaN cup' is recoverable by nobody.
 */
export function formatIngredientQuantity(ingredient: IngredientAmount, factor: number): string {
  const authored = ingredient.displayText?.trim() ?? ''
  const unit = ingredient.unit?.trim() ?? ''
  const scale = Number.isFinite(factor) ? factor : WHOLE_RECIPE_FACTOR

  if (!Number.isFinite(ingredient.quantity)) {
    return authored
  }

  if (scale === WHOLE_RECIPE_FACTOR && authored.length > 0) {
    return authored
  }

  const recomputed = formatIngredientAmount(ingredient.quantity * scale, unit)

  if (recomputed.length === 0) {
    return authored
  }

  return recomputed + authoredAmountQualifier(ingredient.displayText, ingredient.quantity, unit)
}

/**
 * Every ingredient of a recipe at one factor, in the order the server sent them.
 *
 * The row carries three fields because a rendered ingredient row shows three things, and the preparation a
 * `displayText` qualifies (', chopped', ' leaves') travels INSIDE `quantityText` where the recipe wrote it —
 * beside the amount it qualifies — rather than as a fourth field every consumer would have to place.
 */
export function scaleIngredientsForDisplay(
  ingredients: readonly RecipeIngredient[],
  factor: number
): DisplayedIngredient[] {
  return ingredients.map(ingredient => ({
    name: ingredient.name,
    quantityText: formatIngredientQuantity(ingredient, factor),
    isOptional: ingredient.isOptional
  }))
}
