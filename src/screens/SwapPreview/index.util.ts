import {RecipeIngredient} from '@data/models/Recipe'
import {SwapPreview, SwapPreviewAlternative} from '@data/models/SwapAlternative'
import {dayStripLabel, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams, formatMacroPair, formatSignedCalories} from '@utility/NutritionFormatUtility'

import type {MetricGridItem} from '@components/MetricGrid4'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_SLOT_SENTENCE_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters,
  SWAP_PREVIEW_REPLACING_TEMPLATE,
  SWAP_PREVIEW_SUBTITLE_SEPARATOR,
  SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE
} from '@constants/strings'

export interface SwapCalorieDelta {
  text: string
  tone: 'negative' | 'positive'
}

export interface SwapMacroLegendItem {
  key: 'protein' | 'carbs' | 'fat'
  valueText: string
}

/**
 * The quantity fields of a previewed ingredient. Declared as a subset of `RecipeIngredient` rather than the
 * model itself so a row whose pre-formatted `displayText` never arrived still has a type to travel in.
 */
export type IngredientQuantitySource = Pick<RecipeIngredient, 'quantity'> & {
  unit?: string | null
  displayText?: string | null
}

type PreviewNutrition = SwapPreviewAlternative['nutrition']

type PreviewDayTotals = SwapPreview['dayTotalsIfSwapped']

type PreviewTargets = SwapPreview['targets']

const QUANTITY_PRECISION = 100

// A Map rather than an index into MEAL_SLOT_SENTENCE_LABELS: that object literal inherits Object.prototype, so
// indexing it with a slot code a future server release adds would resolve 'constructor' or 'hasOwnProperty' to an
// inherited function. A Map carries only its own string entries, so every code the app does not know reads as absent
const SLOT_SENTENCE_LABELS = new Map<string, string>(Object.entries(MEAL_SLOT_SENTENCE_LABELS))

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

// Keeps a quantity away from floating point dust (0.30000000000000004) before it is rendered
const roundQuantity = (quantity: number): number => Math.round(quantity * QUANTITY_PRECISION) / QUANTITY_PRECISION

const isUsableTarget = (target: number | null | undefined): target is number =>
  typeof target === 'number' && Number.isFinite(target)

// A target the server left unset has nothing to pair the actual against, so the row degrades to the actual
// alone rather than pairing it with an invented zero
const macroValueText = (actual: number, target: number | null | undefined): string =>
  isUsableTarget(target) ? formatMacroPair(actual, target) : formatMacroGrams(actual)

export function deriveCalorieDelta(calorieDelta: number): SwapCalorieDelta | null {
  if (!Number.isFinite(calorieDelta)) {
    return null
  }

  // Rounded exactly as formatSignedCalories rounds it, so a sub-calorie delta resolves to no pill at all: the
  // design has no unchanged state, and the unsigned '0 cal' that formatter returns at zero is not one
  const rounded = Math.round(Math.abs(calorieDelta))

  if (rounded === 0) {
    return null
  }

  return {text: formatSignedCalories(calorieDelta, CAL_LABEL), tone: calorieDelta < 0 ? 'negative' : 'positive'}
}

/** Fraction of the target the day would reach, clamped to 0–1 so the bar's fill can neither overflow nor invert. */
export function calorieProgressRatio(total: number, target: number | null | undefined): number {
  if (!isUsableTarget(target) || target <= 0) {
    return 0
  }

  if (!Number.isFinite(total)) {
    return 0
  }

  return Math.max(0, Math.min(total / target, 1))
}

export function buildSwapMacroLegend(
  dayTotalsIfSwapped: PreviewDayTotals,
  targets: PreviewTargets
): SwapMacroLegendItem[] {
  return [
    {key: 'protein', valueText: macroValueText(dayTotalsIfSwapped.protein, targets.protein)},
    {key: 'carbs', valueText: macroValueText(dayTotalsIfSwapped.carbs, targets.carbs)},
    {key: 'fat', valueText: macroValueText(dayTotalsIfSwapped.fat, targets.fat)}
  ]
}

export function buildThisMealMetrics(
  nutrition: PreviewNutrition
): readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] {
  return [
    {caption: CAL_LABEL, value: formatCalories(nutrition.calories)},
    {caption: PROTEIN_LABEL, value: formatMacroGrams(nutrition.protein)},
    {caption: CARBS_LABEL, value: formatMacroGrams(nutrition.carbs)},
    {caption: FAT_LABEL, value: formatMacroGrams(nutrition.fat)}
  ]
}

/** Natural case ('Replacing lunch · Sat Jul 5'); RecipeHero's context pill applies the uppercase itself. */
export function formatReplacingContext(slot: string, dateKey: string): string {
  const {weekday} = dayStripLabel(dateKey)
  const date = `${weekday} ${formatPlanDayLabel(dateKey)}`
  const label = SLOT_SENTENCE_LABELS.get(slot)

  if (!isPresent(label)) {
    return date
  }

  return stringWithNamedParameters(SWAP_PREVIEW_REPLACING_TEMPLATE, {slot: label, date})
}

export function formatPreviewSubtitle(portionText: string, totalMinutes: number): string {
  const minutesText =
    Number.isFinite(totalMinutes) && totalMinutes > 0
      ? stringWithNamedParameters(SWAP_PREVIEW_TOTAL_MINUTES_TEMPLATE, {minutes: Math.round(totalMinutes)})
      : undefined

  return [portionText.trim(), minutesText].filter(isPresent).join(SWAP_PREVIEW_SUBTITLE_SEPARATOR)
}

/**
 * The server's `displayText` is the authoritative amount for the portion it already chose, so it wins whenever
 * it arrived; the composed fallback neither converts a unit nor rescales by the portion multiplier.
 */
export function formatIngredientQuantity(ingredient: IngredientQuantitySource): string {
  const displayText = ingredient.displayText?.trim() ?? ''

  if (displayText.length > 0) {
    return displayText
  }

  if (!Number.isFinite(ingredient.quantity)) {
    return ''
  }

  const amount = String(roundQuantity(ingredient.quantity))
  const unit = ingredient.unit?.trim() ?? ''

  return unit.length > 0 ? `${amount} ${unit}` : amount
}
