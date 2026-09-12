import {HeightUnitPref, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {WeightUnit} from '@data/models/WeightUnit'

export interface FeetInches {
  feet: number
  inches: number
}

export const KG_PER_LB: number = 0.45359237

export const CM_PER_INCH: number = 2.54

export const KG_PER_STONE: number = 6.35029318

export const INCHES_PER_FOOT: number = 12

export const MIN_BODY_WEIGHT_KG: number = 30

export const MAX_BODY_WEIGHT_KG: number = 300

// A Record rather than a switch so a fourth WeightUnit member becomes a compile error here instead of a
// silent default; 'st' resolves to metric because the Figma unit control offers lb and kg only.
const WEIGHT_UNIT_PREFS: Record<WeightUnit, WeightUnitPref> = {
  lbs: 'lb',
  kg: 'kg',
  st: 'kg'
}

const HEIGHT_UNIT_PREFS: Record<WeightUnit, HeightUnitPref> = {
  lbs: 'ft_in',
  kg: 'cm',
  st: 'cm'
}

export const poundsToKilograms = (pounds: number): number => pounds * KG_PER_LB

export const kilogramsToPounds = (kilograms: number): number => kilograms / KG_PER_LB

// One-way by design: stone exists only to interpret an existing 'st' display preference, and no screen
// renders stone back, so there is deliberately no kilogramsToStone.
export const stoneToKilograms = (stone: number): number => stone * KG_PER_STONE

export const feetInchesToCentimeters = (feet: number, inches: number): number =>
  (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH

// Rounds the total inches before splitting so 182cm (71.65in) carries into 6'0"; rounding after the
// split would render the impossible 5'12". Truncating toward zero rather than flooring keeps
// feet * 12 + inches equal to the rounded total for a negative reading too.
export const centimetersToFeetInches = (centimeters: number): FeetInches => {
  const totalInches = Math.round(centimeters / CM_PER_INCH)

  return {feet: Math.trunc(totalInches / INCHES_PER_FOOT), inches: totalInches % INCHES_PER_FOOT}
}

export const formatHeightImperial = (feet: number, inches: number): string => `${feet}'${inches}"`

export const isSupportedBodyWeightKg = (kilograms: number): boolean =>
  Number.isFinite(kilograms) && kilograms >= MIN_BODY_WEIGHT_KG && kilograms <= MAX_BODY_WEIGHT_KG

// The gate is kilogram-canonical because the server validates weightKg against 30-300: a pound reading
// just under the kilogram floor has to be rejected here, or the About-you step would prefill a weight
// the server then refuses.
export const isSupportedBodyWeightInUnit = (value: number, unit: WeightUnitPref): boolean =>
  isSupportedBodyWeightKg(unit === 'lb' ? poundsToKilograms(value) : value)

export const weightUnitPrefFor = (unit: WeightUnit): WeightUnitPref => WEIGHT_UNIT_PREFS[unit]

export const heightUnitPrefFor = (unit: WeightUnit): HeightUnitPref => HEIGHT_UNIT_PREFS[unit]
