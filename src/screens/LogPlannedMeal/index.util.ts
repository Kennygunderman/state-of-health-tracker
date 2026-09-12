import {Meal} from '@data/models/Meal'
import {MealSlot} from '@data/models/Recipe'
import type {PostLogViewTarget} from '@store/mealPlan/useMealPlanStore'
import {formatIsoDayMonthDay} from '@utility/DateUtility'
import {
  addDaysToDayKey,
  clampDayKeyToPlan,
  formatDayKey,
  formatPlanDayLabel,
  isDayKeyWithin
} from '@utility/MealPlanDateUtility'
import {formatCalories, formatMacroGrams} from '@utility/NutritionFormatUtility'
import {
  isFractionSelected,
  MIN_SERVINGS,
  PerServingMacros,
  scaleMacros,
  SERVING_FRACTIONS,
  ServingFraction,
  stepServings
} from '@utility/ServingsUtility'

import type {MetricGridItem} from '@components/MetricGrid4'

import {CAL_LABEL, CARBS_LABEL, FAT_LABEL, LOG_WEIGHT_TODAY_LABEL, PROTEIN_LABEL} from '@constants/strings'

export const MAX_PLANNED_SERVINGS = 10

const SERVINGS_PRECISION_FACTOR = 100

const PLAIN_DECIMAL = /^\d+(\.\d*)?$|^\.\d+$/

const CANONICAL_DIARY_BUCKET_NAMES: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack'
}

export interface FractionChipState {
  fraction: ServingFraction
  isSelected: boolean
}

export interface DiaryBucketOption {
  mealId: string
  label: string
  sortOrder: number
}

export interface DiaryBucketResolution {
  option: DiaryBucketOption | null
  isFallback: boolean
}

const bucketName = (slot: MealSlot): string => CANONICAL_DIARY_BUCKET_NAMES[slot].toLowerCase()

const matchesBucketName = (meal: Meal, name: string): boolean => meal.name.trim().toLowerCase() === name

const toBucketOption = (meal: Meal): DiaryBucketOption => ({
  mealId: meal.id,
  label: meal.name,
  sortOrder: meal.sortOrder
})

const bySortOrder = (meals: Meal[]): Meal[] => [...meals].sort((first, second) => first.sortOrder - second.sortOrder)

// The diary stores one rounded per-serving snapshot and renders value * servings, so the planned portion has to
// be rounded to that snapshot before it is scaled. Scaling the raw planned floats instead would leave the card
// disagreeing with the entry the server writes by up to a whole unit per macro.
export function plannedPortionSnapshot(planned: PerServingMacros): PerServingMacros {
  return {
    calories: Math.round(planned.calories),
    protein: Math.round(planned.protein),
    carbs: Math.round(planned.carbs),
    fat: Math.round(planned.fat)
  }
}

export function thisAddsTotals(planned: PerServingMacros, servings: number): PerServingMacros {
  return scaleMacros(plannedPortionSnapshot(planned), servings)
}

export function buildThisAddsItems(
  totals: PerServingMacros
): readonly [MetricGridItem, MetricGridItem, MetricGridItem, MetricGridItem] {
  return [
    {caption: CAL_LABEL, value: formatCalories(totals.calories)},
    {caption: PROTEIN_LABEL, value: formatMacroGrams(totals.protein)},
    {caption: CARBS_LABEL, value: formatMacroGrams(totals.carbs)},
    {caption: FAT_LABEL, value: formatMacroGrams(totals.fat)}
  ]
}

export function nextPlannedServings(servings: number, direction: 1 | -1): number {
  const stepped = stepServings(servings, direction)

  return Math.min(Math.max(stepped, MIN_SERVINGS), MAX_PLANNED_SERVINGS)
}

export function parsePlannedServingsInput(text: string): number | null {
  const normalized = text.replace(',', '.').trim()

  if (!PLAIN_DECIMAL.test(normalized)) return null

  const parsed = parseFloat(normalized)

  if (!Number.isFinite(parsed)) return null

  const rounded = Math.round(parsed * SERVINGS_PRECISION_FACTOR) / SERVINGS_PRECISION_FACTOR

  if (rounded < MIN_SERVINGS || rounded > MAX_PLANNED_SERVINGS) return null

  return rounded
}

export function buildFractionChipStates(servings: number): readonly FractionChipState[] {
  return SERVING_FRACTIONS.map(fraction => ({fraction, isSelected: isFractionSelected(servings, fraction.value)}))
}

export function resolveDiaryBucket(meals: Meal[], slot: MealSlot): DiaryBucketResolution {
  const canonical = bucketName(slot)
  const sorted = bySortOrder(meals)
  const matched = sorted.find(meal => matchesBucketName(meal, canonical))

  if (matched) return {option: toBucketOption(matched), isFallback: false}

  const [lowestSortOrder] = sorted

  return {option: lowestSortOrder === undefined ? null : toBucketOption(lowestSortOrder), isFallback: true}
}

export function buildDiaryBucketOptions(meals: Meal[], planSlots: readonly MealSlot[]): readonly DiaryBucketOption[] {
  const plannedNames = planSlots.map(bucketName)
  const planBuckets = meals.filter(meal => plannedNames.some(name => matchesBucketName(meal, name)))

  return bySortOrder(planBuckets.length > 0 ? planBuckets : meals).map(toBucketOption)
}

export function canStepLogDate(dayKey: string, direction: 1 | -1, planStartDate: string, planEndDate: string): boolean {
  return isDayKeyWithin(addDaysToDayKey(dayKey, direction), planStartDate, planEndDate)
}

export function stepLogDate(dayKey: string, direction: 1 | -1, planStartDate: string, planEndDate: string): string {
  return clampDayKeyToPlan(addDaysToDayKey(dayKey, direction), planStartDate, planEndDate)
}

export function dateOverlineText(dayKey: string): string {
  return formatIsoDayMonthDay(dayKey)
}

export function logDateStepperLabel(dayKey: string, now: Date): string {
  return dayKey === formatDayKey(now) ? LOG_WEIGHT_TODAY_LABEL : formatPlanDayLabel(dayKey)
}

export function resolveViewTarget(entryDayKey: string, todayDayKey: string): PostLogViewTarget {
  return entryDayKey === todayDayKey ? 'diary' : 'history'
}
