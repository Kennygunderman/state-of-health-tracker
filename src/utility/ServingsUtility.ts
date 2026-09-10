export interface ServingFraction {
  glyph: string
  value: number
}

export interface PerServingMacros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

export const MIN_SERVINGS = 0.25

export const SERVING_FRACTIONS: ServingFraction[] = [
  {glyph: '¼', value: 0.25},
  {glyph: '⅓', value: 0.33},
  {glyph: '½', value: 0.5},
  {glyph: '⅔', value: 0.66},
  {glyph: '¾', value: 0.75}
]

const FRACTION_EPSILON = 0.001

// Keeps stepper/chip math away from floating point dust (0.30000000000000004)
const roundServings = (servings: number): number => Math.round(servings * 100) / 100

export const getFractionalPart = (servings: number): number => roundServings(servings - Math.floor(servings))

// 1 -> '1', 1.5 -> '1½', 0.25 -> '¼', 1.2 -> '1.2'
export const formatServingsDisplay = (servings: number): string => {
  const whole = Math.floor(servings)
  const fraction = getFractionalPart(servings)

  if (fraction === 0) {
    return String(whole)
  }

  const glyph = SERVING_FRACTIONS.find(f => Math.abs(f.value - fraction) < FRACTION_EPSILON)?.glyph

  if (!glyph) {
    return String(roundServings(servings))
  }

  return whole === 0 ? glyph : `${whole}${glyph}`
}

// Each whole number splits into the same stops as the fraction chips:
// 1 -> 1¼ -> 1⅓ -> 1½ -> 1⅔ -> 1¾ -> 2
const STEP_FRACTIONS = [0, ...SERVING_FRACTIONS.map(f => f.value)]

export const stepServings = (servings: number, direction: 1 | -1): number => {
  const whole = Math.floor(servings)
  const fraction = getFractionalPart(servings)

  if (direction === 1) {
    const next = STEP_FRACTIONS.find(f => f > fraction + FRACTION_EPSILON)

    return roundServings(next === undefined ? whole + 1 : whole + next)
  }

  const prev = [...STEP_FRACTIONS].reverse().find(f => f < fraction - FRACTION_EPSILON)
  const stepped = prev === undefined ? whole - 1 + 0.75 : whole + prev

  return Math.max(MIN_SERVINGS, roundServings(stepped))
}

// Replaces only the fractional part, keeping the whole part: 1.5 + ¼ -> 1.25
export const applyFractionPart = (servings: number, fraction: number): number =>
  roundServings(Math.floor(servings) + fraction)

export const isFractionSelected = (servings: number, fraction: number): boolean =>
  Math.abs(getFractionalPart(servings) - fraction) < FRACTION_EPSILON

export const scaleMacros = (perServing: PerServingMacros, servings: number): PerServingMacros => ({
  calories: Math.round(perServing.calories * servings),
  protein: Math.round(perServing.protein * servings),
  carbs: Math.round(perServing.carbs * servings),
  fat: Math.round(perServing.fat * servings)
})
