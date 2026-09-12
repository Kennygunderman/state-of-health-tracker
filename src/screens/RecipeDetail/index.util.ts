import {MacroTotals} from '@data/models/Macros'
import {MealPlanStatus} from '@data/models/MealPlan'
import {MealSlot, RecipeBadge, RecipeIngredient} from '@data/models/Recipe'
import {RecipeDetailContext} from '@navigation/types'
import {dayStripLabel, formatPlanDayLabel, formatSlotTime} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'
import {formatServingsDisplay} from '@utility/ServingsUtility'

import {MetricGridItem} from '@components/MetricGrid4'

export type IngredientDisplayMode = 'portion' | 'full'

export type RecipeDetailErrorBranch = 'not_found' | 'inline'

export type PlannedNutritionSource = {planned: MacroTotals} | {perServing: MacroTotals; portionMultiplier: number}

export interface DisplayedIngredient {
  name: string
  quantityText: string
  isOptional: boolean
}

export interface MetricGridCaptions {
  calories: string
  protein: string
  carbs: string
  fat: string
}

export interface ActionBarState {
  isVisible: boolean
  isEnabled: boolean
}

const CONTEXT_PILL_SEPARATOR = ' \u00b7 '
const QUANTITY_PRECISION = 100
const UNSCALED_FACTOR = 1
const NOT_FOUND_STATUS = 404

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

// Keeps a scaled amount away from floating point dust (0.30000000000000004) before it is formatted
const roundQuantity = (quantity: number): number => Math.round(quantity * QUANTITY_PRECISION) / QUANTITY_PRECISION

/**
 * Stored ingredient quantities are whole-recipe amounts, so 'Your portion' divides the recipe by its yield
 * before applying the planned multiplier while 'Full recipe' leaves the stored amount alone. A yield that
 * cannot divide (zero, negative or non-finite) falls back to the unscaled amount rather than to Infinity.
 */
const displayFactor = (mode: IngredientDisplayMode, portionMultiplier: number, yieldServings: number): number => {
  if (mode === 'full') {
    return UNSCALED_FACTOR
  }

  if (!Number.isFinite(portionMultiplier) || !Number.isFinite(yieldServings) || yieldServings <= 0) {
    return UNSCALED_FACTOR
  }

  return portionMultiplier / yieldServings
}

const formatIngredientQuantity = (ingredient: RecipeIngredient, factor: number): string => {
  if (!Number.isFinite(ingredient.quantity)) {
    return ingredient.displayText
  }

  const amount = formatServingsDisplay(roundQuantity(ingredient.quantity * factor))
  const unit = ingredient.unit.trim()

  return unit.length > 0 ? `${amount} ${unit}` : amount
}

// One Math.round per value, applied once to the scaled figure: rounding an already-rounded value or summing
// rounded parts would drift from the totals the server planned the day against
const roundMacroTotals = (totals: MacroTotals, factor: number): MacroTotals => ({
  calories: Math.round(totals.calories * factor),
  protein: Math.round(totals.protein * factor),
  carbs: Math.round(totals.carbs * factor),
  fat: Math.round(totals.fat * factor)
})

export function resolveDisplayedIngredients(
  ingredients: readonly RecipeIngredient[],
  mode: IngredientDisplayMode,
  portionMultiplier: number,
  yieldServings: number
): DisplayedIngredient[] {
  const factor = displayFactor(mode, portionMultiplier, yieldServings)

  return ingredients.map(ingredient => ({
    name: ingredient.name,
    quantityText: formatIngredientQuantity(ingredient, factor),
    isOptional: ingredient.isOptional
  }))
}

export function resolvePlannedNutrition(source: PlannedNutritionSource): MacroTotals {
  if ('planned' in source) {
    return roundMacroTotals(source.planned, UNSCALED_FACTOR)
  }

  return roundMacroTotals(source.perServing, source.portionMultiplier)
}

export function buildMetricGridItems(
  nutrition: MacroTotals,
  captions: MetricGridCaptions
): readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] {
  return [
    {caption: captions.calories, value: formatCalories(nutrition.calories)},
    {caption: captions.protein, value: formatMacroGrams(nutrition.protein)},
    {caption: captions.carbs, value: formatMacroGrams(nutrition.carbs)},
    {caption: captions.fat, value: formatMacroGrams(nutrition.fat)}
  ]
}

export function buildContextPillText(
  slot: MealSlot,
  dayKey: string,
  slotTime: string,
  slotLabels: Record<string, string | undefined>
): string {
  const {weekday} = dayStripLabel(dayKey)
  const segments = [slotLabels[slot], `${weekday} ${formatPlanDayLabel(dayKey)}`, formatSlotTime(slotTime)]

  return segments.filter(isPresent).join(CONTEXT_PILL_SEPARATOR)
}

// A code the converter could not map to copy is dropped rather than rendered raw, so a badge the server
// adds after this release simply does not appear
export function resolveBadgeLabels(
  badges: readonly RecipeBadge[],
  labels: Record<string, string | undefined>
): string[] {
  return badges.map(badge => labels[badge]).filter(isPresent)
}

export function shouldShowBadgeCaption(labels: readonly string[]): boolean {
  return labels.length > 0
}

export function resolveActionBarState(
  contextKind: RecipeDetailContext['kind'],
  planStatus: MealPlanStatus | null | undefined
): ActionBarState {
  return {isVisible: contextKind !== 'preview', isEnabled: planStatus === 'active'}
}

/**
 * The decoded error code is accepted so the call site can hand over its whole error shape, but it never moves
 * the branch: on a resource route a 404 is the combined not-found/ownership answer whatever the body carried,
 * and every other outcome — no response, an undecodable body, a 5xx — is the inline retry card.
 */
export function resolveRecipeDetailErrorBranch(
  status: number | null | undefined,
  _code: string | null | undefined
): RecipeDetailErrorBranch {
  return status === NOT_FOUND_STATUS ? 'not_found' : 'inline'
}
