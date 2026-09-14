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

/**
 * One ingredient amount at `factor`, formatted the way the app writes servings ('¾ cup', '1½ tbsp', '2').
 *
 * `formatServingsDisplay` is reused rather than reimplemented so an ingredient amount and the servings stepper
 * render the same fraction glyphs. The unit is appended through the shared template; an ingredient counted
 * rather than measured ('2' avocados) carries no unit and renders the amount alone.
 *
 * The server's pre-formatted `displayText` is used ONLY when the quantity cannot be scaled at all — it is the
 * whole recipe's text, so preferring it would be the defect these helpers exist to remove, but for a non-finite
 * quantity ('a pinch') it is the only amount that exists.
 */
export function formatIngredientQuantity(ingredient: IngredientAmount, factor: number): string {
  if (!Number.isFinite(ingredient.quantity)) {
    return ingredient.displayText?.trim() ?? ''
  }

  const amount = formatServingsDisplay(roundServings(ingredient.quantity * factor))
  const unit = ingredient.unit?.trim() ?? ''

  return unit.length > 0 ? stringWithNamedParameters(MEAL_PLAN_UNIT_VALUE_TEMPLATE, {value: amount, unit}) : amount
}

/** Every ingredient of a recipe at one factor, in the order the server sent them. */
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
