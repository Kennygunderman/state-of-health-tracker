import {RecipeIngredient} from '@data/models/Recipe'
import {SwapPreview, SwapPreviewAlternative} from '@data/models/SwapAlternative'
import {dayStripLabel, formatPlanDayLabel} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams, formatMacroPair, formatSignedCalories} from '@utility/NutritionFormatUtility'
import {DisplayedIngredient, plannedPortionFactor, scaleIngredientsForDisplay} from '@utility/ServingsUtility'

import type {MetricGridItem} from '@components/MetricGrid4'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE,
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

// Declared by @utility/ServingsUtility, which owns the scaling and formatting this screen shares with recipe
// detail, and re-exported so the screen takes its row shape from its own util
export type {DisplayedIngredient}

type PreviewNutrition = SwapPreviewAlternative['nutrition']

type PreviewDayTotals = SwapPreview['dayTotalsIfSwapped']

type PreviewTargets = SwapPreview['targets']

// A Map rather than an index into MEAL_SLOT_SENTENCE_LABELS: that object literal inherits Object.prototype, so
// indexing it with a slot code a future server release adds would resolve 'constructor' or 'hasOwnProperty' to an
// inherited function. A Map carries only its own string entries, so every code the app does not know reads as absent
const SLOT_SENTENCE_LABELS = new Map<string, string>(Object.entries(MEAL_SLOT_SENTENCE_LABELS))

const isPresent = (segment: string | undefined): segment is string => segment !== undefined && segment.length > 0

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
  const date = stringWithNamedParameters(MEAL_PLAN_WEEKDAY_DATE_COMPACT_TEMPLATE, {
    weekday,
    date: formatPlanDayLabel(dateKey)
  })
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
 * The ingredient rows of frame 13b — the amounts of the PORTION this preview describes.
 *
 * `SwapPreviewResponse` is asymmetric by design: `alternative.nutrition` is the candidate already scaled to
 * `portionMultiplier`, while `alternative.recipe` is the plain `RecipeVersionResponse`, whose `quantity`,
 * `gramWeight` and pre-formatted `displayText` are WHOLE-RECIPE amounts for `recipe.yieldServings` servings —
 * that DTO carries no planned-meal context, so it cannot know the portion. Rendering the stored `displayText`
 * here therefore put whole-recipe ingredients beside portion-scaled nutrition: '10 oz chicken' against a
 * 305 cal half of a 2-serving recipe.
 *
 * So the same two numbers the server scaled the nutrition by scale the amounts, through the same helper recipe
 * detail's 'Your portion' column uses. No second, pre-scaled ingredient collection is requested from the
 * server: both factors are already in this envelope, and a scaled copy would give one number two sources of
 * truth and put a display-rounding rule in a second place.
 */
export function resolvePreviewIngredients(
  ingredients: readonly RecipeIngredient[],
  portionMultiplier: number,
  yieldServings: number
): DisplayedIngredient[] {
  return scaleIngredientsForDisplay(ingredients, plannedPortionFactor(portionMultiplier, yieldServings))
}
