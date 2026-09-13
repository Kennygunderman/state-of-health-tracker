import {RecipeIngredient} from '@data/models/Recipe'

import {MEAL_PLAN_UNIT_VALUE_TEMPLATE, stringWithNamedParameters} from '@constants/strings'

import {formatServingsDisplay} from './ServingsUtility'

/**
 * The one rule for turning a stored recipe ingredient amount into the amount a screen shows.
 *
 * IT LIVES HERE BECAUSE TWO SCREENS NEED IT. Recipe detail (frame 12, 'Your portion' | 'Full recipe') and the
 * swap preview (frame 13b, 'Replacing lunch') both render ingredient rows beside nutrition for ONE portion,
 * and `RecipeIngredientResponse` carries WHOLE-RECIPE amounts — `quantity`, `gramWeight` and the pre-formatted
 * `displayText` are the recipe as published, which yields `yieldServings` servings, because a recipe response
 * carries no planned-meal context at all. Each screen therefore has to scale, and when each screen owned its
 * own copy of that arithmetic they disagreed: the preview showed whole-recipe amounts next to portion-scaled
 * nutrition, so a 2-serving recipe read '10 oz chicken · 610 cal' for a 305 cal portion. Rule
 * mobile-component-structure forbids one screen's util importing another's, so the shared rule belongs in
 * src/utility with its own tests rather than in either screen.
 */

const QUANTITY_PRECISION = 100

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

// Keeps a scaled amount away from floating point dust (0.30000000000000004) before it is formatted
const roundQuantity = (quantity: number): number => Math.round(quantity * QUANTITY_PRECISION) / QUANTITY_PRECISION

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
 * whole recipe's text, so preferring it would be the defect this module exists to remove, but for a non-finite
 * quantity ('a pinch') it is the only amount that exists.
 */
export function formatIngredientQuantity(ingredient: IngredientAmount, factor: number): string {
  if (!Number.isFinite(ingredient.quantity)) {
    return ingredient.displayText?.trim() ?? ''
  }

  const amount = formatServingsDisplay(roundQuantity(ingredient.quantity * factor))
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
