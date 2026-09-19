import {MacroTargets} from '@data/models/Macros'

import {
  calorieBalance,
  FALLBACK_CARBS_TARGET_G,
  FALLBACK_FAT_TARGET_G,
  FALLBACK_PROTEIN_TARGET_G,
  formatCalories,
  formatMacroPair,
  progressFraction,
  resolveMacroTargets,
  resolveMacrosBodyKey
} from '../index.util'

const makeTargets = (overrides: Partial<MacroTargets> = {}): MacroTargets => ({
  calories: null,
  protein: null,
  carbs: null,
  fat: null,
  ...overrides
})

// The device's `useUserData.targetCalories`, which is what an unset field falls back to (AAP 0.7.5).
const LOCAL_TARGET_CALORIES = 1800

describe('resolveMacroTargets', () => {
  it('uses server targets when every field is set', () => {
    const resolved = resolveMacroTargets(makeTargets({calories: 2200, protein: 180, carbs: 250, fat: 70}), 1800)

    expect(resolved).toEqual({calories: 2200, protein: 180, carbs: 250, fat: 70})
  })

  it('falls back to the local calorie target and default gram splits when unset', () => {
    const resolved = resolveMacroTargets(makeTargets(), 1800)

    expect(resolved).toEqual({
      calories: 1800,
      protein: FALLBACK_PROTEIN_TARGET_G,
      carbs: FALLBACK_CARBS_TARGET_G,
      fat: FALLBACK_FAT_TARGET_G
    })
  })

  it('falls back per-field, not all-or-nothing', () => {
    const resolved = resolveMacroTargets(makeTargets({protein: 160}), 2000)

    expect(resolved).toEqual({
      calories: 2000,
      protein: 160,
      carbs: FALLBACK_CARBS_TARGET_G,
      fat: FALLBACK_FAT_TARGET_G
    })
  })
})

describe("the Diary's target source", () => {
  // The finding's own case, at the resolver that produces the figure the ring renders. `GET /macros/:date`
  // answers with the user's targets embedded, and AAP 0.1.3 states verbatim that the Diary and Macros History
  // keep reading them: routing the display through the separately cached canonical targets read instead made
  // the ring show the device's number while the day's answer carried the confirmed one.
  it("renders the day's embedded target rather than the device value", () => {
    const resolved = resolveMacroTargets(makeTargets({calories: 2100}), 2000)

    expect(resolved.calories).toBe(2100)
  })

  // A target of zero is an answer, not an absence: `??` keeps it where `||` would have fallen through to the
  // device value, and the ring's "over" arithmetic is computed against it.
  it('keeps an embedded target of zero instead of falling back to the device value', () => {
    const resolved = resolveMacroTargets(makeTargets({calories: 0}), LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(0)
  })

  // The other half of AAP 0.1.3's claim: the two reads resolve the same `users.target_*` columns, so when the
  // embedded block carries a figure it is the server's, and only its absence reaches the never-opted-in
  // device value AAP 0.7.5 preserves.
  it('falls back to the device value only when the day carries no target', () => {
    expect(resolveMacroTargets(makeTargets({calories: null}), LOCAL_TARGET_CALORIES).calories).toBe(
      LOCAL_TARGET_CALORIES
    )

    expect(resolveMacroTargets(makeTargets({calories: 1940}), LOCAL_TARGET_CALORIES).calories).toBe(1940)
  })

  // Macros History reads the same embedded block through this same function and was never rerouted, so this is
  // also what keeps the two diary surfaces showing one figure for one day.
  it('resolves grams from the day and its own defaults, independently of the calorie figure', () => {
    const resolved = resolveMacroTargets(makeTargets({calories: 2100, protein: 160}), LOCAL_TARGET_CALORIES)

    expect(resolved).toEqual({
      calories: 2100,
      protein: 160,
      carbs: FALLBACK_CARBS_TARGET_G,
      fat: FALLBACK_FAT_TARGET_G
    })
  })
})

describe('progressFraction', () => {
  it('returns the consumed fraction of the target', () => {
    expect(progressFraction(683, 1800)).toBeCloseTo(683 / 1800)
  })

  it('caps at 1 when consumption exceeds the target', () => {
    expect(progressFraction(2500, 1800)).toBe(1)
  })

  it('returns 0 for a zero or negative target', () => {
    expect(progressFraction(100, 0)).toBe(0)
    expect(progressFraction(100, -5)).toBe(0)
  })

  it('returns 0 when nothing is consumed', () => {
    expect(progressFraction(0, 1800)).toBe(0)
  })
})

describe('calorieBalance', () => {
  it('returns the remaining amount when under target', () => {
    expect(calorieBalance(1317, 1800)).toEqual({amount: 483, isOver: false})
  })

  it('returns the overage when past the target', () => {
    expect(calorieBalance(2317, 1800)).toEqual({amount: 517, isOver: true})
  })

  it('treats hitting the target exactly as remaining, not over', () => {
    expect(calorieBalance(1800, 1800)).toEqual({amount: 0, isOver: false})
  })

  it('rounds before comparing so a sub-calorie overage reads as 0 remaining', () => {
    expect(calorieBalance(1800.4, 1800)).toEqual({amount: 0, isOver: false})
  })
})

describe('formatCalories', () => {
  it('adds thousands separators', () => {
    expect(formatCalories(1800)).toBe('1,800')
  })

  it('leaves small values untouched', () => {
    expect(formatCalories(683)).toBe('683')
  })

  it('rounds fractional values', () => {
    expect(formatCalories(1799.6)).toBe('1,800')
  })
})

describe('formatMacroPair', () => {
  it('suffixes only the target with grams', () => {
    expect(formatMacroPair(142, 146)).toBe('142 / 146g')
  })

  it('rounds fractional values on both sides', () => {
    expect(formatMacroPair(187.6, 193.7)).toBe('188 / 194g')
    expect(formatMacroPair(142.4, 146.2)).toBe('142 / 146g')
  })

  it('renders a zero target as 0g', () => {
    expect(formatMacroPair(32, 0)).toBe('32 / 0g')
  })

  it('renders a zero actual as 0', () => {
    expect(formatMacroPair(0, 146)).toBe('0 / 146g')
  })

  it('does not clamp an actual above the target', () => {
    expect(formatMacroPair(168, 146)).toBe('168 / 146g')
  })

  it('omits thousands separators for large values', () => {
    expect(formatMacroPair(1200, 1500)).toBe('1200 / 1500g')
  })
})

describe('resolveMacrosBodyKey', () => {
  it('keys the diary body', () => {
    expect(resolveMacrosBodyKey(true)).toBe('diary')
  })

  it('keys the meal plan body', () => {
    expect(resolveMacrosBodyKey(false)).toBe('mealPlan')
  })

  it('gives the two segments different keys so the container remounts and the offset resets', () => {
    expect(resolveMacrosBodyKey(true)).not.toBe(resolveMacrosBodyKey(false))
  })
})
