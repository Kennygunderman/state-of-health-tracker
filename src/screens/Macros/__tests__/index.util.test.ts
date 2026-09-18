import {MacroTargets} from '@data/models/Macros'
import {NutritionTargets} from '@data/models/NutritionTargets'
import {
  NutritionTargetsReadResult,
  resolveTargetAuthority,
  TargetAuthorityDecision
} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {RoutesMissingError} from '@utility/MealPlanEntitlementUtility'

import {
  calorieBalance,
  FALLBACK_CARBS_TARGET_G,
  FALLBACK_FAT_TARGET_G,
  FALLBACK_PROTEIN_TARGET_G,
  formatCalories,
  formatMacroPair,
  progressFraction,
  resolveAuthoritativeMacroTargets,
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

const LOCAL_TARGET_CALORIES = 1800

const CONFIRMED_SERVER_TARGETS: NutritionTargets = {
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  complete: true,
  source: 'manual',
  stale: false,
  revision: 3
}

// An account the server holds targets for but no calorie figure: the four columns are independently nullable
// (AAP 0.5.2), so this is `'server'` authority with `serverCalories: null`.
const MACRO_ONLY_SERVER_TARGETS: NutritionTargets = {
  targets: {calories: null, protein: 150, carbs: null, fat: null},
  complete: false,
  source: 'legacy',
  stale: false,
  revision: 0
}

// Every decision below is built by `resolveTargetAuthority` from a read, not hand-assembled, so these cases
// prove the Diary agrees with the authority Account and Progress Activity read rather than with a fixture.
const authedDecision = (read: NutritionTargetsReadResult): TargetAuthorityDecision =>
  resolveTargetAuthority({read, isAuthed: true})

const succeededRead = (data: NutritionTargets | undefined): NutritionTargetsReadResult => ({
  data,
  isError: false,
  error: null
})

// The state TanStack leaves behind when the targets route disappears under a read that had already succeeded:
// the error channel carries the routes-missing signal while the last figures are retained.
const routeMissingReadWithRetainedData = (): NutritionTargetsReadResult => ({
  data: CONFIRMED_SERVER_TARGETS,
  isError: true,
  error: new RoutesMissingError('/meal-planning/targets')
})

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

describe('resolveAuthoritativeMacroTargets', () => {
  // The finding's own case: the backend has been rolled back past `/meal-planning/targets*`, so there is no
  // server target at all, while `GET /macros/:date` still answers with a calorie figure. AAP 0.7.5 requires
  // this surface to degrade to the device's target exactly as for a user who never opted in, which is what
  // Account and Progress Activity already do from the same decision.
  it('takes the local figure over a retained macros target when the targets route is missing', () => {
    const decision = authedDecision(routeMissingReadWithRetainedData())

    expect(decision.authority).toBe('local')

    const macrosTargets = makeTargets({calories: 1940})
    const resolved = resolveAuthoritativeMacroTargets(decision, macrosTargets, LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(LOCAL_TARGET_CALORIES)
    // The per-field resolution on its own is what the card displayed before, and it is deliberately unchanged:
    // this is the disagreement the authority layer closes, not a bug in `resolveMacroTargets`.
    expect(resolveMacroTargets(macrosTargets, LOCAL_TARGET_CALORIES).calories).toBe(1940)
  })

  it('takes the local figure for a signed-out device that still holds a macros target', () => {
    const decision = resolveTargetAuthority({read: succeededRead(CONFIRMED_SERVER_TARGETS), isAuthed: false})

    expect(decision.authority).toBe('local')

    const resolved = resolveAuthoritativeMacroTargets(decision, makeTargets({calories: 1940}), LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(LOCAL_TARGET_CALORIES)
  })

  it('takes the canonical read figure under server authority, not the macros answer', () => {
    const decision = authedDecision(succeededRead(CONFIRMED_SERVER_TARGETS))

    expect(decision.authority).toBe('server')

    const resolved = resolveAuthoritativeMacroTargets(decision, makeTargets({calories: 1750}), LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(1940)
  })

  // A macro-only server target, which the preserved legacy `PUT /api/user/targets` still writes: it applies an
  // explicit `calories: null` and leaves the omitted macro columns alone. Another client clearing calories
  // therefore produces server authority with no calorie in it, while this date's cached macros answer may
  // still hold the figure from before that write. Preferring the embedded figure here would show a cleared
  // target as current, on the Diary alone.
  it('takes the local figure for a macro-only server target, never the retained macros figure', () => {
    const decision = authedDecision(succeededRead(MACRO_ONLY_SERVER_TARGETS))

    expect(decision.authority).toBe('server')
    expect(decision.serverCalories).toBeNull()

    const macrosTargets = makeTargets({calories: 2050})
    const resolved = resolveAuthoritativeMacroTargets(decision, macrosTargets, LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(LOCAL_TARGET_CALORIES)
    // Account and Progress show exactly this for the same decision, and the retained figure is what the Diary
    // used to show instead — the divergence AAP 0.1.4 forbids.
    expect(decision.serverCalories ?? LOCAL_TARGET_CALORIES).toBe(LOCAL_TARGET_CALORIES)
    expect(resolveMacroTargets(macrosTargets, LOCAL_TARGET_CALORIES).calories).toBe(2050)
  })

  it('takes the local figure for a macro-only server account with no calorie figure anywhere', () => {
    const decision = authedDecision(succeededRead(MACRO_ONLY_SERVER_TARGETS))

    const resolved = resolveAuthoritativeMacroTargets(decision, makeTargets(), LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(LOCAL_TARGET_CALORIES)
  })

  // Nobody owns the target yet, so `serverCalories` is null and every surface shows the local figure. Showing
  // the device target for that first paint and the server one after is the behaviour Account and Progress
  // already have; keeping the embedded figure here instead would make the Diary the one surface that reports a
  // number the canonical read has not confirmed.
  it('takes the local figure over a retained macros figure while the authority is unresolved', () => {
    const decision = authedDecision(succeededRead(undefined))

    expect(decision.authority).toBe('unresolved')

    const macrosTargets = makeTargets({calories: 2200})
    const resolved = resolveAuthoritativeMacroTargets(decision, macrosTargets, LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(LOCAL_TARGET_CALORIES)
    expect(resolveMacroTargets(macrosTargets, LOCAL_TARGET_CALORIES).calories).toBe(2200)
  })

  it('takes the local figure while the authority is unresolved and the macros answer carries none', () => {
    const decision = authedDecision(succeededRead(undefined))

    const resolved = resolveAuthoritativeMacroTargets(decision, makeTargets(), LOCAL_TARGET_CALORIES)

    expect(resolved.calories).toBe(LOCAL_TARGET_CALORIES)
  })

  // The convergence the finding asks for, stated as one property rather than case by case: whatever the
  // decision and whatever the macros answer carries, the Diary figure equals the expression Account
  // (`Account/index.tsx`) and Progress (`Progress/components/ActivityTab/index.tsx`) render.
  it.each<[string, TargetAuthorityDecision]>([
    ['route-missing rollback', authedDecision(routeMissingReadWithRetainedData())],
    ['signed out', resolveTargetAuthority({read: succeededRead(CONFIRMED_SERVER_TARGETS), isAuthed: false})],
    ['confirmed server targets', authedDecision(succeededRead(CONFIRMED_SERVER_TARGETS))],
    ['macro-only server targets', authedDecision(succeededRead(MACRO_ONLY_SERVER_TARGETS))],
    ['unresolved', authedDecision(succeededRead(undefined))]
  ])('agrees with Account and Progress under %s', (_label, decision) => {
    const accountAndProgress = decision.serverCalories ?? LOCAL_TARGET_CALORIES

    for (const macrosTargets of [makeTargets(), makeTargets({calories: 2050}), makeTargets({calories: 1940})]) {
      expect(resolveAuthoritativeMacroTargets(decision, macrosTargets, LOCAL_TARGET_CALORIES).calories).toBe(
        accountAndProgress
      )
    }
  })

  // The card renders no gram target, so the authority decides the calorie figure alone and the grams stay
  // exactly as the Diary's own per-field resolution produced them.
  it.each<[string, TargetAuthorityDecision]>([
    ['local', authedDecision(routeMissingReadWithRetainedData())],
    ['server', authedDecision(succeededRead(CONFIRMED_SERVER_TARGETS))],
    ['unresolved', authedDecision(succeededRead(undefined))]
  ])('leaves the gram targets as resolveMacroTargets produced them under %s authority', (_authority, decision) => {
    const targets = makeTargets({calories: 1940, protein: 160})
    const resolved = resolveAuthoritativeMacroTargets(decision, targets, LOCAL_TARGET_CALORIES)
    const perField = resolveMacroTargets(targets, LOCAL_TARGET_CALORIES)

    expect(resolved.protein).toBe(perField.protein)
    expect(resolved.carbs).toBe(perField.carbs)
    expect(resolved.fat).toBe(perField.fat)
    expect(resolved.protein).toBe(160)
    expect(resolved.carbs).toBe(FALLBACK_CARBS_TARGET_G)
    expect(resolved.fat).toBe(FALLBACK_FAT_TARGET_G)
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
