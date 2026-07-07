import {format, subYears} from 'date-fns'

const CM_PER_INCH = 2.54
const MIN_HEIGHT_CM = 90
const MAX_HEIGHT_CM = 250
const MIN_AGE = 18
const MAX_AGE = 100

export const feetInchesToCm = (feetText: string, inchesText: string): number | null => {
  const feet = parseInt(feetText, 10)
  const inches = inchesText.length > 0 ? parseInt(inchesText, 10) : 0

  if (isNaN(feet) || isNaN(inches)) return null

  const cm = (feet * 12 + inches) * CM_PER_INCH

  return cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM ? Math.round(cm * 10) / 10 : null
}

export const parseCm = (cmText: string): number | null => {
  const cm = parseFloat(cmText)

  return !isNaN(cm) && cm >= MIN_HEIGHT_CM && cm <= MAX_HEIGHT_CM ? cm : null
}

/** Approximate birth date from an age in years (Coach only needs year-level precision). */
export const birthDateFromAge = (ageText: string): string | null => {
  const age = parseInt(ageText, 10)

  if (isNaN(age) || age < MIN_AGE || age > MAX_AGE) return null

  return format(subYears(new Date(), age), 'yyyy-MM-dd')
}
