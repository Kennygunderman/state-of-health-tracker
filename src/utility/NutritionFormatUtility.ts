const CALORIE_LOCALE = 'en-US'
const GRAM_SUFFIX = 'g'
const MACRO_PAIR_SEPARATOR = ' / '
const PLUS_SIGN = '+'

// U+2212 MINUS SIGN, never an ASCII hyphen — the delta pill draws a true minus, which is also why the
// sign is applied here after Math.abs instead of being left to Intl (en-US emits '-' and even '-0')
const MINUS_SIGN = '\u2212'

// formatCalories and formatMacroGrams reproduce the shipped screens/Macros and MacroGramRow output byte
// for byte: the planner and the diary must never render the same confirmed figure two different ways
export function formatCalories(value: number): string {
  return Math.round(value).toLocaleString(CALORIE_LOCALE)
}

export function formatMacroGrams(value: number): string {
  return `${Math.round(value)}${GRAM_SUFFIX}`
}

export function formatMacroPair(actual: number, target: number): string {
  return `${Math.round(actual)}${MACRO_PAIR_SEPARATOR}${formatMacroGrams(target)}`
}

export function formatSignedCalories(delta: number, unitSuffix: string): string {
  const rounded = Math.round(delta)
  const magnitude = formatCalories(Math.abs(rounded))

  if (rounded === 0) {
    return `${magnitude} ${unitSuffix}`
  }

  return `${rounded < 0 ? MINUS_SIGN : PLUS_SIGN}${magnitude} ${unitSuffix}`
}
