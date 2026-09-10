import {NutritionProvenance} from '@data/models/NutritionProvenance'

import {CATALOG_PROVENANCE_BADGE_LABELS} from '@constants/strings'

export type MacroKey = 'protein' | 'carbs' | 'fat'

export interface MacroBreakdownSlice {
  key: MacroKey
  grams: number
  // This macro's share of total calories, 0..1
  calorieShare: number
  // calorieShare rounded to a whole percent, 0..100
  percent: number
}

export interface DonutSegment {
  key: MacroKey
  startFraction: number
  lengthFraction: number
}

export const MACRO_LABELS: Record<MacroKey, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat'
}

const DONUT_GAP_FRACTION = 0.02

export const buildMacroBreakdown = (protein: number, carbs: number, fat: number): MacroBreakdownSlice[] => {
  const slices: {key: MacroKey; grams: number; calories: number}[] = [
    {key: 'protein', grams: protein, calories: protein * 4},
    {key: 'carbs', grams: carbs, calories: carbs * 4},
    {key: 'fat', grams: fat, calories: fat * 9}
  ]

  const totalCalories = slices.reduce((sum, slice) => sum + slice.calories, 0)

  return slices.map(slice => {
    const calorieShare = totalCalories === 0 ? 0 : slice.calories / totalCalories

    return {
      key: slice.key,
      grams: slice.grams,
      calorieShare,
      percent: Math.round(calorieShare * 100)
    }
  })
}

export const dominantMacroKey = (slices: MacroBreakdownSlice[]): MacroKey =>
  slices.reduce((best, slice) => (slice.calorieShare > best.calorieShare ? slice : best), slices[0]).key

// Lays the visible slices around the ring, leaving a small gap between arcs.
// Fractions are of the full circumference; zero slices are dropped.
export const buildDonutSegments = (
  slices: MacroBreakdownSlice[],
  gapFraction: number = DONUT_GAP_FRACTION
): DonutSegment[] => {
  const visible = slices.filter(slice => slice.calorieShare > 0)

  if (visible.length === 0) {
    return []
  }

  const gap = visible.length > 1 ? gapFraction : 0
  const available = 1 - gap * visible.length
  let cursor = 0

  return visible.map(slice => {
    const segment: DonutSegment = {
      key: slice.key,
      startFraction: cursor,
      lengthFraction: slice.calorieShare * available
    }

    cursor += segment.lengthFraction + gap

    return segment
  })
}

// '2g P · 75g C · 5g F'
export const formatMacroSummary = (protein: number, carbs: number, fat: number): string =>
  `${Math.round(protein)}g P · ${Math.round(carbs)}g C · ${Math.round(fat)}g F`

// 'Chobani · 1 cup · 231 cal per serving' (brand and serving text omitted when missing)
export const formatDetailSubtitle = (
  brand: string | null,
  servingText: string | null,
  calories: number,
  calSuffix: string
): string => {
  const calText = `${Math.round(calories)} ${calSuffix}`

  return [brand, servingText, calText].filter(Boolean).join(' · ')
}

// Keyed by the full union so a new provenance value cannot compile without a caption decision
const CATALOG_PROVENANCE_CAPTIONS: Record<NutritionProvenance, string | null> = {
  source_backed: CATALOG_PROVENANCE_BADGE_LABELS.source_backed,
  ingredient_derived: CATALOG_PROVENANCE_BADGE_LABELS.ingredient_derived,
  ai_estimated: CATALOG_PROVENANCE_BADGE_LABELS.ai_estimated,
  user_entered: null
}

export const catalogProvenanceLabel = (provenance: NutritionProvenance | null | undefined): string | null =>
  provenance ? CATALOG_PROVENANCE_CAPTIONS[provenance] : null
