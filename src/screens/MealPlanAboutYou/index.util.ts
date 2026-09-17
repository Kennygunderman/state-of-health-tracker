import {HeightUnitPref, SexForEstimate, TargetRoute, WeightUnitPref} from '@data/models/MealPlanPreferences'
import {WeighIn} from '@data/models/WeighIn'
import {WeightUnit} from '@data/models/WeightUnit'
import {
  centimetersToFeetInches,
  feetInchesToCentimeters,
  formatMeasurementValue,
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

// The fields the user has supplied a value for, each one overriding the saved answer on its own. Held per
// field rather than as a whole snapshot so that editing one measurement neither freezes the others at the
// values they happened to show nor withdraws the weigh-in suggestion from a weight field left untouched.
export type AboutYouFieldOverrides = Partial<Record<keyof MealPlanAboutYouFields, string>>

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
  // The unit `value` was read in. A weigh-in stores no unit, so the number is meaningful only with the one
  // it was interpreted against, and the field it lands in may since have been switched to the other.
  unit: WeightUnitPref | null
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

const loggedAtMs = (weighIn: WeighIn): number => {
  const parsed = Date.parse(weighIn.loggedAt)

  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

// Two weigh-ins sharing a timestamp are ordinary and the API orders on logged_at alone, so the greatest
// id decides. Which side wins is arbitrary — a v4 id carries no creation order — but it is the same
// winner for every arrival order, which is the whole point.
const isNewerWeighIn = (candidate: WeighIn, incumbent: WeighIn): boolean => {
  const candidateMs = loggedAtMs(candidate)
  const incumbentMs = loggedAtMs(incumbent)

  return candidateMs === incumbentMs ? candidate.id > incumbent.id : candidateMs > incumbentMs
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
    (latest, weighIn) => (latest === null || isNewerWeighIn(weighIn, latest) ? weighIn : latest),
    null
  )

// A weigh-in stores no unit of its own, so the stored number can only be read in the unit selected
// today: it is offered as a suggestion the user confirms with Continue, never converted for them.
export const resolveWeighInPrefill = (latestWeighIn: WeighIn | null, weightUnit: WeightUnit): WeighInPrefill => {
  if (latestWeighIn === null || weightUnit === 'st') {
    return {value: '', unit: null, showCaption: false}
  }

  const readInUnit = weightUnitPrefFor(weightUnit)
  const isSuggestible = isSupportedBodyWeightInUnit(latestWeighIn.weight, readInUnit)

  return isSuggestible
    ? {value: String(latestWeighIn.weight), unit: readInUnit, showCaption: true}
    : {value: '', unit: null, showCaption: false}
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

// The suggestion is offered in the unit the field is showing, whichever way the toggle has been moved since
// the weigh-in was read: the same weight, never the same digits under a different label.
export const suggestedWeightField = (prefill: WeighInPrefill, weightUnit: WeightUnitPref): string => {
  const parsed = parseDecimalField(prefill.value)

  if (prefill.unit === null || parsed === null || prefill.unit === weightUnit) {
    return prefill.value
  }

  return formatMeasurementValue(weightUnit === 'kg' ? poundsToKilograms(parsed) : kilogramsToPounds(parsed))
}

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
    centimeters: isImperial || savedHeightCm === null ? '' : formatMeasurementValue(savedHeightCm),
    weight:
      savedWeightInUnit === null ? suggestedWeightField(prefill, weightUnit) : formatMeasurementValue(savedWeightInUnit)
  }
}

export const mergeAboutYouFields = (
  savedFields: MealPlanAboutYouFields,
  overrides: AboutYouFieldOverrides
): MealPlanAboutYouFields => ({
  age: overrides.age ?? savedFields.age,
  feet: overrides.feet ?? savedFields.feet,
  inches: overrides.inches ?? savedFields.inches,
  centimeters: overrides.centimeters ?? savedFields.centimeters,
  weight: overrides.weight ?? savedFields.weight
})

// Switching a unit re-reads an entered measurement in the unit now selected, because it was typed against
// the previous one: relabelling 182.2 lb as 182.2 kg would submit a weight nobody gave. Only entered text is
// carried across — a displayed suggestion is re-derived from the weigh-in instead (`suggestedWeightField`),
// so converting it here would freeze that number against a weigh-in arriving later. A field holding nothing
// parseable is left untouched, there being no measurement to carry.
export const convertWeightFieldToUnit = (
  weight: string,
  fromUnit: WeightUnitPref,
  toUnit: WeightUnitPref
): AboutYouFieldOverrides => {
  const parsed = parseDecimalField(weight)

  if (fromUnit === toUnit || parsed === null) {
    return {}
  }

  return {weight: formatMeasurementValue(toUnit === 'kg' ? poundsToKilograms(parsed) : kilogramsToPounds(parsed))}
}

export const convertHeightFieldsToUnit = (
  fields: MealPlanAboutYouFields,
  fromUnit: HeightUnitPref,
  toUnit: HeightUnitPref
): AboutYouFieldOverrides => {
  if (fromUnit === toUnit) {
    return {}
  }

  if (toUnit === 'cm') {
    const heightCm = imperialHeightCm(fields)

    return heightCm === null ? {} : {centimeters: formatMeasurementValue(heightCm)}
  }

  const heightCm = parseDecimalField(fields.centimeters)

  if (heightCm === null) {
    return {}
  }

  const imperialHeight = centimetersToFeetInches(heightCm)

  return {feet: String(imperialHeight.feet), inches: String(imperialHeight.inches)}
}
