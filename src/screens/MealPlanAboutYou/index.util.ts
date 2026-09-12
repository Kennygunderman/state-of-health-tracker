import {HeightUnitPref, SexForEstimate, TargetRoute, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {WeighIn} from '@data/models/WeighIn'
import {WeightUnit} from '@data/models/WeightUnit'
import {
  centimetersToFeetInches,
  feetInchesToCentimeters,
  isSupportedBodyWeightInUnit,
  kilogramsToPounds,
  poundsToKilograms,
  weightUnitPrefFor
} from '@utility/UnitConversionUtility'

export interface MealPlanAboutYouFields {
  age: string
  feet: string
  inches: string
  centimeters: string
  weight: string
}

export type AboutYouErrorCode =
  | 'age_required'
  | 'age_range'
  | 'feet_required'
  | 'feet_range'
  | 'inches_range'
  | 'height_cm_required'
  | 'height_cm_range'
  | 'weight_required'
  | 'weight_range'
  | 'sex_required'

export interface AboutYouErrors {
  age: AboutYouErrorCode | null
  feet: AboutYouErrorCode | null
  inches: AboutYouErrorCode | null
  centimeters: AboutYouErrorCode | null
  weight: AboutYouErrorCode | null
  sex: AboutYouErrorCode | null
}

export interface AboutYouValidation {
  errors: AboutYouErrors
  isValid: boolean
}

export interface WeighInPrefill {
  value: string
  showCaption: boolean
}

export interface BodyStepValues {
  age: number
  heightCm: number
  weightKg: number
}

export interface AboutYouInitialInput {
  savedAge: number | null
  savedHeightCm: number | null
  savedWeightKg: number | null
  heightUnit: HeightUnitPref
  weightUnit: WeightUnitPref
  prefill: WeighInPrefill
}

export const ABOUT_YOU_STEP = 2

export const WIZARD_TOTAL_STEPS_ESTIMATED = 7

export const WIZARD_TOTAL_STEPS_MANUAL = 6

export const MIN_AGE = 18

export const MAX_AGE = 100

export const MIN_HEIGHT_CM = 120

export const MAX_HEIGHT_CM = 250

export const MAX_INCHES = 11

type HeightErrors = Pick<AboutYouErrors, 'feet' | 'inches' | 'centimeters'>

const INTEGER_PATTERN = /^\d+$/

const DECIMAL_PATTERN = /^(\d+(\.\d*)?|\.\d+)$/

const DISPLAY_ROUNDING_FACTOR = 10

const isBlank = (text: string): boolean => text.trim() === ''

const parseIntegerField = (text: string): number | null => {
  const trimmed = text.trim()

  if (!INTEGER_PATTERN.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

const parseDecimalField = (text: string): number | null => {
  const trimmed = text.trim()

  if (!DECIMAL_PATTERN.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

const isSupportedHeightCm = (centimeters: number): boolean =>
  Number.isFinite(centimeters) && centimeters >= MIN_HEIGHT_CM && centimeters <= MAX_HEIGHT_CM

const formatMeasurement = (value: number): string =>
  String(Math.round(value * DISPLAY_ROUNDING_FACTOR) / DISPLAY_ROUNDING_FACTOR)

const loggedAtMs = (weighIn: WeighIn): number => {
  const parsed = Date.parse(weighIn.loggedAt)

  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

const imperialHeightCm = (fields: MealPlanAboutYouFields): number | null => {
  const feet = parseIntegerField(fields.feet)
  const inches = isBlank(fields.inches) ? 0 : parseIntegerField(fields.inches)

  return feet === null || inches === null ? null : feetInchesToCentimeters(feet, inches)
}

const validateAge = (age: string): AboutYouErrorCode | null => {
  if (isBlank(age)) {
    return 'age_required'
  }

  const parsed = parseIntegerField(age)

  return parsed === null || parsed < MIN_AGE || parsed > MAX_AGE ? 'age_range' : null
}

const validateImperialHeight = (fields: MealPlanAboutYouFields): HeightErrors => {
  const inches = isBlank(fields.inches) ? 0 : parseIntegerField(fields.inches)
  const inchesError: AboutYouErrorCode | null = inches === null || inches > MAX_INCHES ? 'inches_range' : null

  if (isBlank(fields.feet)) {
    return {feet: 'feet_required', inches: inchesError, centimeters: null}
  }

  const feet = parseIntegerField(fields.feet)

  if (feet === null) {
    return {feet: 'feet_range', inches: inchesError, centimeters: null}
  }

  if (inchesError !== null || inches === null) {
    return {feet: null, inches: inchesError, centimeters: null}
  }

  const heightCm = feetInchesToCentimeters(feet, inches)

  return {feet: isSupportedHeightCm(heightCm) ? null : 'feet_range', inches: null, centimeters: null}
}

const validateMetricHeight = (fields: MealPlanAboutYouFields): HeightErrors => {
  if (isBlank(fields.centimeters)) {
    return {feet: null, inches: null, centimeters: 'height_cm_required'}
  }

  const parsed = parseDecimalField(fields.centimeters)
  const isSupported = parsed !== null && isSupportedHeightCm(parsed)

  return {feet: null, inches: null, centimeters: isSupported ? null : 'height_cm_range'}
}

const validateWeight = (weight: string, weightUnit: WeightUnitPref): AboutYouErrorCode | null => {
  if (isBlank(weight)) {
    return 'weight_required'
  }

  const parsed = parseDecimalField(weight)

  return parsed !== null && isSupportedBodyWeightInUnit(parsed, weightUnit) ? null : 'weight_range'
}

export const selectLatestWeighIn = (weighIns: WeighIn[]): WeighIn | null =>
  weighIns.reduce<WeighIn | null>(
    (latest, weighIn) => (latest === null || loggedAtMs(weighIn) > loggedAtMs(latest) ? weighIn : latest),
    null
  )

// A weigh-in stores no unit of its own, so the stored number can only be read in the unit selected
// today: it is offered as a suggestion the user confirms with Continue, never converted for them.
export const resolveWeighInPrefill = (latestWeighIn: WeighIn | null, weightUnit: WeightUnit): WeighInPrefill => {
  if (latestWeighIn === null || weightUnit === 'st') {
    return {value: '', showCaption: false}
  }

  const isSuggestible = isSupportedBodyWeightInUnit(latestWeighIn.weight, weightUnitPrefFor(weightUnit))

  return isSuggestible ? {value: String(latestWeighIn.weight), showCaption: true} : {value: '', showCaption: false}
}

export const validateAboutYou = (
  fields: MealPlanAboutYouFields,
  heightUnit: HeightUnitPref,
  weightUnit: WeightUnitPref,
  sex: SexForEstimate | null
): AboutYouValidation => {
  const heightErrors = heightUnit === 'ft_in' ? validateImperialHeight(fields) : validateMetricHeight(fields)

  const errors: AboutYouErrors = {
    age: validateAge(fields.age),
    feet: heightErrors.feet,
    inches: heightErrors.inches,
    centimeters: heightErrors.centimeters,
    weight: validateWeight(fields.weight, weightUnit),
    sex: sex === null ? 'sex_required' : null
  }

  return {errors, isValid: Object.values(errors).every(code => code === null)}
}

export const buildBodyStepValues = (
  fields: MealPlanAboutYouFields,
  heightUnit: HeightUnitPref,
  weightUnit: WeightUnitPref
): BodyStepValues | null => {
  const age = parseIntegerField(fields.age)
  const heightCm = heightUnit === 'ft_in' ? imperialHeightCm(fields) : parseDecimalField(fields.centimeters)
  const weight = parseDecimalField(fields.weight)

  if (age === null || heightCm === null || weight === null) {
    return null
  }

  return {age, heightCm, weightKg: weightUnit === 'lb' ? poundsToKilograms(weight) : weight}
}

export const wizardTotalSteps = (targetRoute: TargetRoute | null): number =>
  targetRoute === 'manual' ? WIZARD_TOTAL_STEPS_MANUAL : WIZARD_TOTAL_STEPS_ESTIMATED

export const initialFieldsFor = ({
  savedAge,
  savedHeightCm,
  savedWeightKg,
  heightUnit,
  weightUnit,
  prefill
}: AboutYouInitialInput): MealPlanAboutYouFields => {
  const isImperial = heightUnit === 'ft_in'
  const imperialHeight = isImperial && savedHeightCm !== null ? centimetersToFeetInches(savedHeightCm) : null
  const savedWeightInUnit =
    savedWeightKg !== null && weightUnit === 'lb' ? kilogramsToPounds(savedWeightKg) : savedWeightKg

  return {
    age: savedAge === null ? '' : String(savedAge),
    feet: imperialHeight === null ? '' : String(imperialHeight.feet),
    inches: imperialHeight === null ? '' : String(imperialHeight.inches),
    centimeters: isImperial || savedHeightCm === null ? '' : formatMeasurement(savedHeightCm),
    weight: savedWeightInUnit === null ? prefill.value : formatMeasurement(savedWeightInUnit)
  }
}
