import {createEmptyMacroTotals} from '@data/models/Macros'
import {Meal} from '@data/models/Meal'
import {MealSlot} from '@data/models/Recipe'
import {buildPendingIntent, MealPlanStore, PENDING_INTENT_TTL_MS, PendingIntent} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {MIN_SERVINGS, PerServingMacros} from '@utility/ServingsUtility'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  LOG_WEIGHT_TODAY_LABEL,
  MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SERVING_FRACTION_NAMES,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_SLOT_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import {
  beginServingsDraft,
  buildDiaryBucketOptions,
  buildFractionChipStates,
  buildPlannedLogRequest,
  buildThisAddsItems,
  canChangeLogDate,
  canStepLogDate,
  classifyLogFailure,
  dateOverlineText,
  isLogFormEditable,
  isLogOutcomeUnconfirmed,
  isPlanStateReadFailure,
  isServingsDraftStale,
  LogAttempt,
  LogAttemptPlan,
  logDateStepperLabel,
  LogLaunchBlockReason,
  LogLaunchDecision,
  LogPlanDateRange,
  MAX_PLANNED_SERVINGS,
  nextLogDate,
  nextPlannedServings,
  nextServingsDraft,
  parsePlannedServingsInput,
  planDayQueryRecovery,
  planDayQueryScope,
  planLogAttempt,
  plannedPortionSnapshot,
  planStoredLogReplay,
  planUnconfirmedRefetch,
  resolveDiaryBucket,
  resolveLogCacheScope,
  resolveLogDiaryDestination,
  resolveLogFormValues,
  resolveLogLaunch,
  resolveLogSubmitAffordance,
  resolveRestoredLogDraft,
  resolveUnresolvedLogIntent,
  resolveViewTarget,
  servingsFieldText,
  shouldDiscardServingsDraft,
  stepLogDate,
  thisAddsTotals,
  UnresolvedLogIntent
} from '../index.util'

// `index.util` reaches the store module for the shared keyed-request rule, which pulls the persist adapter's
// AsyncStorage import in with it. Mocking the adapter — as `useMealPlanStore.test.ts` does — keeps this suite
// free of native modules; none of these decisions reads or writes persisted state.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

const makePlannedPortion = (overrides: Partial<PerServingMacros> = {}): PerServingMacros => ({
  calories: 420,
  protein: 32,
  carbs: 44,
  fat: 11,
  ...overrides
})

const CANONICAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

// Every canonical bucket name comes from the strings authority the screen matches against, so a rename there
// fails this suite instead of silently leaving the picker unable to find the bucket it preselects.
const slotLabel = (slot: MealSlot): string => MEAL_SLOT_LABELS[slot]

const makeDiaryMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: 'meal-lunch',
  name: slotLabel('lunch'),
  sortOrder: 2,
  entries: [],
  totals: createEmptyMacroTotals(),
  ...overrides
})

const makeDiaryDayMeals = (): Meal[] => [
  makeDiaryMeal({id: 'meal-dinner', name: slotLabel('dinner'), sortOrder: 3}),
  makeDiaryMeal({id: 'meal-breakfast', name: slotLabel('breakfast'), sortOrder: 1}),
  makeDiaryMeal({id: 'meal-snack', name: slotLabel('snack'), sortOrder: 4}),
  makeDiaryMeal({id: 'meal-lunch', name: slotLabel('lunch'), sortOrder: 2})
]

const makeRenamedDiaryMeals = (): Meal[] => [
  makeDiaryMeal({id: 'meal-second', name: 'Second Meal', sortOrder: 5}),
  makeDiaryMeal({id: 'meal-first', name: 'First Meal', sortOrder: 1})
]

const makePartlyRenamedDiaryMeals = (): Meal[] => [
  makeDiaryMeal({id: 'meal-dinner', name: slotLabel('dinner'), sortOrder: 3}),
  makeDiaryMeal({id: 'meal-brunch', name: 'Brunch', sortOrder: 1}),
  makeDiaryMeal({id: 'meal-lunch', name: slotLabel('lunch'), sortOrder: 2})
]

const fractionAccessibilityLabel = (glyph: string): string =>
  stringWithNamedParameters(MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE, {
    fraction: MEAL_PLAN_SERVING_FRACTION_NAMES[glyph]
  })

// A second planned meal of the same plan, which is what the single `pendingIntents.log` slot has to keep
// apart from the first: one unresolved key belongs to exactly one meal.
const OTHER_MEAL_ID = 'meal-dinner-thu'

const MINT_LAUNCH: LogLaunchDecision = {kind: 'mint'}

// `planLogAttempt` answers either the one attempt that may leave or the reason none may. Most cases are about
// the attempt, so the refusal is turned into a failure here rather than into `undefined` assertions.
const sentAttempt = (plan: LogAttemptPlan): LogAttempt => {
  if (plan.kind !== 'send') {
    throw new Error(`expected an attempt, but the launch was blocked: ${plan.reason}`)
  }

  return plan.attempt
}

// The unresolved intent as the screen resolves it before deriving anything else: the key an earlier attempt
// was sent under, and the body it was sent with.
const storedLogIntent = (
  overrides: Partial<Parameters<typeof buildPlannedLogRequest>[0]> = {}
): UnresolvedLogIntent => ({
  key: STORED_KEY,
  request: buildPlannedLogRequest({
    planId: PLAN_ID,
    mealId: MEAL_ID,
    servings: 1,
    date: PLANNED_DATE,
    diaryMealId: 'diary-lunch',
    planRevision: 4,
    ...overrides
  })
})

const replayLaunch = (intent: UnresolvedLogIntent = storedLogIntent()): LogLaunchDecision => ({
  kind: 'replay',
  intent
})

describe('plannedPortionSnapshot', () => {
  const fullPrecisionPortion = makePlannedPortion({calories: 420.4, protein: 32.5, carbs: 44.6, fat: 11.4})

  it('rounds every planned value once, half-up', () => {
    expect(plannedPortionSnapshot(fullPrecisionPortion)).toEqual({calories: 420, protein: 33, carbs: 45, fat: 11})
  })

  it('leaves an already whole portion untouched', () => {
    expect(plannedPortionSnapshot(makePlannedPortion())).toEqual(makePlannedPortion())
  })
})

describe('thisAddsTotals', () => {
  const fullPrecisionPortion = makePlannedPortion({calories: 420.4, protein: 32.5, carbs: 44.6, fat: 11.4})

  describe('a portion whose planned values are already whole', () => {
    it('scales by every servings value the stepper can reach', () => {
      const portion = makePlannedPortion()

      expect(thisAddsTotals(portion, 0.25)).toEqual({calories: 105, protein: 8, carbs: 11, fat: 3})
      expect(thisAddsTotals(portion, 0.33)).toEqual({calories: 139, protein: 11, carbs: 15, fat: 4})
      expect(thisAddsTotals(portion, 0.5)).toEqual({calories: 210, protein: 16, carbs: 22, fat: 6})
      expect(thisAddsTotals(portion, 0.66)).toEqual({calories: 277, protein: 21, carbs: 29, fat: 7})
      expect(thisAddsTotals(portion, 0.75)).toEqual({calories: 315, protein: 24, carbs: 33, fat: 8})
      expect(thisAddsTotals(portion, 1)).toEqual({calories: 420, protein: 32, carbs: 44, fat: 11})
      expect(thisAddsTotals(portion, 1.5)).toEqual({calories: 630, protein: 48, carbs: 66, fat: 17})
      expect(thisAddsTotals(portion, 2)).toEqual({calories: 840, protein: 64, carbs: 88, fat: 22})
    })
  })

  describe('a portion carrying full-precision planned values', () => {
    it('rounds the snapshot before scaling it', () => {
      expect(thisAddsTotals(fullPrecisionPortion, 0.5)).toEqual({calories: 210, protein: 17, carbs: 23, fat: 6})
      expect(thisAddsTotals(fullPrecisionPortion, 1.5)).toEqual({calories: 630, protein: 50, carbs: 68, fat: 17})
      expect(thisAddsTotals(fullPrecisionPortion, 2)).toEqual({calories: 840, protein: 66, carbs: 90, fat: 22})
    })

    it('never scales the raw planned floats', () => {
      expect(thisAddsTotals(fullPrecisionPortion, 1.5).calories).not.toBe(631)
      expect(thisAddsTotals(fullPrecisionPortion, 2).protein).not.toBe(65)
      expect(thisAddsTotals(fullPrecisionPortion, 0.5).carbs).not.toBe(22)
    })

    it('reaches the same totals when the snapshot is taken first', () => {
      const snapshot = plannedPortionSnapshot(fullPrecisionPortion)

      expect(thisAddsTotals(snapshot, 1.5)).toEqual(thisAddsTotals(fullPrecisionPortion, 1.5))
      expect(thisAddsTotals(snapshot, 0.5)).toEqual(thisAddsTotals(fullPrecisionPortion, 0.5))
    })

    it('returns whole numbers the diary entry can store', () => {
      expect(Object.values(thisAddsTotals(fullPrecisionPortion, 0.33)).every(Number.isInteger)).toBe(true)
      expect(Object.values(thisAddsTotals(fullPrecisionPortion, 1.5)).every(Number.isInteger)).toBe(true)
    })
  })
})

describe('buildThisAddsItems', () => {
  it('lists calories, protein, carbs and fat in that order with their captions', () => {
    expect(buildThisAddsItems(makePlannedPortion())).toEqual([
      {caption: CAL_LABEL, value: '420'},
      {caption: PROTEIN_LABEL, value: '32g'},
      {caption: CARBS_LABEL, value: '44g'},
      {caption: FAT_LABEL, value: '11g'}
    ])
  })

  it('groups a four-digit calorie total', () => {
    expect(buildThisAddsItems(thisAddsTotals(makePlannedPortion(), 3))).toEqual([
      {caption: CAL_LABEL, value: '1,260'},
      {caption: PROTEIN_LABEL, value: '96g'},
      {caption: CARBS_LABEL, value: '132g'},
      {caption: FAT_LABEL, value: '33g'}
    ])
  })
})

describe('nextPlannedServings', () => {
  it('walks up through the fraction chip stops', () => {
    expect(nextPlannedServings(0.25, 1)).toBe(0.33)
    expect(nextPlannedServings(0.33, 1)).toBe(0.5)
    expect(nextPlannedServings(0.5, 1)).toBe(0.66)
    expect(nextPlannedServings(0.66, 1)).toBe(0.75)
    expect(nextPlannedServings(0.75, 1)).toBe(1)
    expect(nextPlannedServings(1, 1)).toBe(1.25)
    expect(nextPlannedServings(1.25, 1)).toBe(1.33)
    expect(nextPlannedServings(1.33, 1)).toBe(1.5)
  })

  it('walks down through the fraction chip stops', () => {
    expect(nextPlannedServings(10, -1)).toBe(9.75)
    expect(nextPlannedServings(9.75, -1)).toBe(9.66)
    expect(nextPlannedServings(9.66, -1)).toBe(9.5)
    expect(nextPlannedServings(9.5, -1)).toBe(9.33)
  })

  it('clamps at the smallest serving', () => {
    expect(nextPlannedServings(MIN_SERVINGS, -1)).toBe(MIN_SERVINGS)
    expect(nextPlannedServings(0.25, -1)).toBe(0.25)
  })

  it('clamps at the largest serving the log endpoint accepts', () => {
    expect(MAX_PLANNED_SERVINGS).toBe(10)
    expect(nextPlannedServings(MAX_PLANNED_SERVINGS, 1)).toBe(MAX_PLANNED_SERVINGS)
    expect(nextPlannedServings(10, 1)).toBe(10)
  })
})

describe('parsePlannedServingsInput', () => {
  it('parses a serving count with up to two decimals', () => {
    expect(parsePlannedServingsInput('1.25')).toBe(1.25)
    expect(parsePlannedServingsInput('1')).toBe(1)
    expect(parsePlannedServingsInput('.5')).toBe(0.5)
  })

  it('accepts a comma as the decimal separator', () => {
    expect(parsePlannedServingsInput('1,5')).toBe(1.5)
  })

  it('accepts both ends of the accepted range', () => {
    expect(parsePlannedServingsInput('0.25')).toBe(MIN_SERVINGS)
    expect(parsePlannedServingsInput('10')).toBe(MAX_PLANNED_SERVINGS)
  })

  it('rejects empty and non-numeric input', () => {
    expect(parsePlannedServingsInput('')).toBeNull()
    expect(parsePlannedServingsInput('abc')).toBeNull()
    expect(parsePlannedServingsInput('12a')).toBeNull()
    expect(parsePlannedServingsInput('.')).toBeNull()
  })

  it('rejects servings below the minimum and above the maximum', () => {
    expect(parsePlannedServingsInput('0')).toBeNull()
    expect(parsePlannedServingsInput('0.1')).toBeNull()
    expect(parsePlannedServingsInput('10.5')).toBeNull()
    expect(parsePlannedServingsInput('11')).toBeNull()
  })

  it('rejects more than two decimals rather than rounding into a portion that was never typed', () => {
    expect(parsePlannedServingsInput('1.333')).toBeNull()
    expect(parsePlannedServingsInput('1.336')).toBeNull()
    expect(parsePlannedServingsInput('0.249')).toBeNull()
    expect(parsePlannedServingsInput('10.004')).toBeNull()
    expect(parsePlannedServingsInput('1.000')).toBeNull()
  })

  it('returns a two-decimal serving exactly as typed', () => {
    expect(parsePlannedServingsInput('1.25')).toBe(1.25)
    expect(parsePlannedServingsInput('1.5')).toBe(1.5)
    expect(parsePlannedServingsInput('1.50')).toBe(1.5)
    expect(parsePlannedServingsInput('0.25')).toBe(0.25)
    expect(parsePlannedServingsInput('10')).toBe(10)
  })

  it('only ever returns servings the log endpoint accepts', () => {
    const inputs = ['1.25', '1', '.5', '1,5', '0.25', '10', '1.333', '0.249', '10.004', '', 'abc', '0', '11', '10.5']
    const decimalDigits = (input: string): number => {
      const normalized = input.replace(',', '.')
      const separatorIndex = normalized.indexOf('.')

      return separatorIndex === -1 ? 0 : normalized.length - separatorIndex - 1
    }
    const accepted = inputs.filter(input => parsePlannedServingsInput(input) !== null)

    expect(accepted).toEqual(['1.25', '1', '.5', '1,5', '0.25', '10'])
    expect(accepted).toHaveLength(6)
    expect(accepted.every(input => decimalDigits(input) <= 2)).toBe(true)
    expect(
      accepted.every(input => {
        const value = parsePlannedServingsInput(input)

        return value !== null && value >= MIN_SERVINGS && value <= MAX_PLANNED_SERVINGS
      })
    ).toBe(true)
  })
})

describe('beginServingsDraft', () => {
  it('seeds the draft with the formatted authoritative value', () => {
    expect(beginServingsDraft(1.5)).toEqual({text: '1½', baseValue: 1.5})
    expect(beginServingsDraft(2)).toEqual({text: '2', baseValue: 2})
    expect(beginServingsDraft(MIN_SERVINGS)).toEqual({text: '¼', baseValue: MIN_SERVINGS})
  })
})

describe('nextServingsDraft', () => {
  it('bases a parseable keystroke on the value the screen adopts from it', () => {
    expect(nextServingsDraft('2', 1)).toEqual({text: '2', baseValue: 2})
    expect(nextServingsDraft('1,5', 1)).toEqual({text: '1,5', baseValue: 1.5})
    expect(nextServingsDraft('.5', 1)).toEqual({text: '.5', baseValue: 0.5})
  })

  it('bases partial and invalid text on the value already held, keeping the text as typed', () => {
    expect(nextServingsDraft('', 1)).toEqual({text: '', baseValue: 1})
    expect(nextServingsDraft('0.', 1)).toEqual({text: '0.', baseValue: 1})
    expect(nextServingsDraft('11', 1)).toEqual({text: '11', baseValue: 1})
  })

  it('leaves the servings alone for a third decimal, keeping the keystroke on screen', () => {
    expect(nextServingsDraft('1.333', 1)).toEqual({text: '1.333', baseValue: 1})
    expect(nextServingsDraft('0.249', 0.5)).toEqual({text: '0.249', baseValue: 0.5})
    expect(nextServingsDraft('10.004', 2)).toEqual({text: '10.004', baseValue: 2})
  })
})

describe('isServingsDraftStale', () => {
  it('has nothing to rebase without a draft', () => {
    expect(isServingsDraftStale(null, 1)).toBe(false)
  })

  it('leaves a draft alone when the value only echoes the keystroke it was typed against', () => {
    expect(isServingsDraftStale(nextServingsDraft('2', 1), 2)).toBe(false)
    expect(isServingsDraftStale(nextServingsDraft('0.', 1), 1)).toBe(false)
    expect(isServingsDraftStale(beginServingsDraft(1), 1)).toBe(false)
  })

  it('marks the draft stale once the value moves for a reason the field did not originate', () => {
    expect(isServingsDraftStale(beginServingsDraft(1), 1.25)).toBe(true)
    expect(isServingsDraftStale(nextServingsDraft('0.', 1), 0.5)).toBe(true)
    expect(isServingsDraftStale(nextServingsDraft('2', 1), 1)).toBe(true)
  })
})

describe('shouldDiscardServingsDraft', () => {
  it('has nothing to discard without a draft, locked or not', () => {
    expect(shouldDiscardServingsDraft(null, 1, false)).toBe(false)
    expect(shouldDiscardServingsDraft(null, 1, true)).toBe(false)
  })

  it('keeps a live draft that still matches the value', () => {
    expect(shouldDiscardServingsDraft(nextServingsDraft('0.', 1), 1, false)).toBe(false)
    expect(shouldDiscardServingsDraft(beginServingsDraft(1), 1, false)).toBe(false)
  })

  it('discards the draft the moment the field locks, whatever was being typed', () => {
    // The lock lands while the field may be focused — the persisted intent slice comes back mid-edit, or
    // another attempt takes the slot — and a kept draft would go on displaying a portion the replay will not
    // send under its stored key (0.7.2).
    expect(shouldDiscardServingsDraft(nextServingsDraft('0.', 1), 1, true)).toBe(true)
    expect(shouldDiscardServingsDraft(nextServingsDraft('3', 3), 3, true)).toBe(true)
    expect(shouldDiscardServingsDraft(beginServingsDraft(1), 1, true)).toBe(true)
  })

  it('still discards a stale draft while the field is open', () => {
    expect(shouldDiscardServingsDraft(beginServingsDraft(1), 1.25, false)).toBe(true)
    expect(shouldDiscardServingsDraft(nextServingsDraft('2', 1), 1, false)).toBe(true)
  })
})

describe('servingsFieldText', () => {
  it('formats the authoritative value when there is no draft', () => {
    expect(servingsFieldText(1.5, null)).toBe('1½')
    expect(servingsFieldText(MIN_SERVINGS, null)).toBe('¼')
    expect(servingsFieldText(MAX_PLANNED_SERVINGS, null)).toBe('10')
  })

  it('shows the text as typed while the draft still matches the value', () => {
    expect(servingsFieldText(2, nextServingsDraft('2', 1))).toBe('2')
    expect(servingsFieldText(1, nextServingsDraft('', 1))).toBe('')
    expect(servingsFieldText(1, nextServingsDraft('0.', 1))).toBe('0.')
  })

  it('shows the authoritative value the moment the draft goes stale', () => {
    expect(servingsFieldText(1.25, beginServingsDraft(1))).toBe('1¼')
    expect(servingsFieldText(0.5, nextServingsDraft('0.', 1))).toBe('½')
    expect(servingsFieldText(1, nextServingsDraft('2', 1))).toBe('1')
  })
})

describe('buildFractionChipStates', () => {
  it('returns one chip per serving fraction, in chip order', () => {
    expect(buildFractionChipStates(1).map(chip => chip.fraction.value)).toEqual([0.25, 0.33, 0.5, 0.66, 0.75])
  })

  it('selects the chip matching the fractional part', () => {
    expect(buildFractionChipStates(0.25).map(chip => chip.isSelected)).toEqual([true, false, false, false, false])
    expect(buildFractionChipStates(0.33).map(chip => chip.isSelected)).toEqual([false, true, false, false, false])
    expect(buildFractionChipStates(0.5).map(chip => chip.isSelected)).toEqual([false, false, true, false, false])
    expect(buildFractionChipStates(0.66).map(chip => chip.isSelected)).toEqual([false, false, false, true, false])
    expect(buildFractionChipStates(0.75).map(chip => chip.isSelected)).toEqual([false, false, false, false, true])
  })

  it('ignores the whole part when matching', () => {
    expect(buildFractionChipStates(1.33).map(chip => chip.isSelected)).toEqual([false, true, false, false, false])
  })

  it('leaves every chip unselected when no fraction matches', () => {
    expect(buildFractionChipStates(1.2).map(chip => chip.isSelected)).toEqual([false, false, false, false, false])
    expect(buildFractionChipStates(2).map(chip => chip.isSelected)).toEqual([false, false, false, false, false])
  })

  it('names every chip with its fraction spelled out rather than leaving the glyph to be pronounced', () => {
    expect(buildFractionChipStates(1).map(chip => chip.accessibilityLabel)).toEqual([
      fractionAccessibilityLabel('¼'),
      fractionAccessibilityLabel('⅓'),
      fractionAccessibilityLabel('½'),
      fractionAccessibilityLabel('⅔'),
      fractionAccessibilityLabel('¾')
    ])
  })

  it('has a spelled-out name for every serving fraction, so no chip falls back to its glyph', () => {
    const chips = buildFractionChipStates(1)

    expect(chips.every(chip => MEAL_PLAN_SERVING_FRACTION_NAMES[chip.fraction.glyph] !== undefined)).toBe(true)
    expect(chips.every(chip => !chip.accessibilityLabel.includes(chip.fraction.glyph))).toBe(true)
  })

  it('carries the same names whatever is selected', () => {
    expect(buildFractionChipStates(0.5).map(chip => chip.accessibilityLabel)).toEqual(
      buildFractionChipStates(2).map(chip => chip.accessibilityLabel)
    )
  })
})

describe('resolveDiaryBucket', () => {
  describe('when a diary bucket matches the slot', () => {
    it('resolves every plan slot to its own bucket', () => {
      const meals = makeDiaryDayMeals()

      expect(resolveDiaryBucket(meals, 'breakfast').option?.mealId).toBe('meal-breakfast')
      expect(resolveDiaryBucket(meals, 'lunch').option?.mealId).toBe('meal-lunch')
      expect(resolveDiaryBucket(meals, 'dinner').option?.mealId).toBe('meal-dinner')
      expect(resolveDiaryBucket(meals, 'snack').option?.mealId).toBe('meal-snack')
    })

    it('carries the bucket label and sort order, and is not a fallback', () => {
      expect(resolveDiaryBucket(makeDiaryDayMeals(), 'dinner')).toEqual({
        option: {mealId: 'meal-dinner', label: slotLabel('dinner'), sortOrder: 3},
        isFallback: false
      })
    })

    it('matches a bucket named exactly as the strings authority names the slot', () => {
      CANONICAL_SLOTS.forEach(slot => {
        const meals = [
          makeDiaryMeal({id: 'meal-renamed', name: 'Late Supper', sortOrder: 1}),
          makeDiaryMeal({id: `meal-${slot}`, name: slotLabel(slot), sortOrder: 2})
        ]

        expect(resolveDiaryBucket(meals, slot)).toEqual({
          option: {mealId: `meal-${slot}`, label: slotLabel(slot), sortOrder: 2},
          isFallback: false
        })
      })
    })

    it('matches the bucket name case-insensitively and ignores surrounding space', () => {
      const meals = [
        makeDiaryMeal({id: 'meal-breakfast', name: slotLabel('breakfast').toUpperCase(), sortOrder: 1}),
        makeDiaryMeal({id: 'meal-lunch', name: `  ${slotLabel('lunch').toLowerCase()}  `, sortOrder: 2})
      ]

      expect(resolveDiaryBucket(meals, 'breakfast').option?.mealId).toBe('meal-breakfast')
      expect(resolveDiaryBucket(meals, 'lunch').option?.mealId).toBe('meal-lunch')
    })
  })

  describe('when no diary bucket matches the slot', () => {
    it('falls back to the bucket with the lowest sort order', () => {
      expect(resolveDiaryBucket(makeRenamedDiaryMeals(), 'lunch')).toEqual({
        option: {mealId: 'meal-first', label: 'First Meal', sortOrder: 1},
        isFallback: true
      })
    })

    it('leaves the meals it was given unchanged', () => {
      const meals = makeRenamedDiaryMeals()

      resolveDiaryBucket(meals, 'lunch')

      expect(meals).toEqual(makeRenamedDiaryMeals())
    })
  })

  describe('when the day has no diary buckets', () => {
    it('resolves to no bucket', () => {
      const resolution = resolveDiaryBucket([], 'breakfast')

      expect(resolution.option).toBeNull()
      expect(resolution.isFallback).toBe(true)
    })
  })
})

describe('buildDiaryBucketOptions', () => {
  it('offers one option per planned slot, ordered by sort order', () => {
    expect(buildDiaryBucketOptions(makeDiaryDayMeals(), ['breakfast', 'lunch', 'dinner'])).toEqual([
      {mealId: 'meal-breakfast', label: slotLabel('breakfast'), sortOrder: 1},
      {mealId: 'meal-lunch', label: slotLabel('lunch'), sortOrder: 2},
      {mealId: 'meal-dinner', label: slotLabel('dinner'), sortOrder: 3}
    ])
  })

  it('adds the snack bucket when the plan includes a snack', () => {
    expect(buildDiaryBucketOptions(makeDiaryDayMeals(), ['breakfast', 'lunch', 'dinner', 'snack'])).toEqual([
      {mealId: 'meal-breakfast', label: slotLabel('breakfast'), sortOrder: 1},
      {mealId: 'meal-lunch', label: slotLabel('lunch'), sortOrder: 2},
      {mealId: 'meal-dinner', label: slotLabel('dinner'), sortOrder: 3},
      {mealId: 'meal-snack', label: slotLabel('snack'), sortOrder: 4}
    ])
  })

  it('offers every diary bucket when none matches the planned slots', () => {
    expect(buildDiaryBucketOptions(makeRenamedDiaryMeals(), ['breakfast', 'lunch', 'dinner'])).toEqual([
      {mealId: 'meal-first', label: 'First Meal', sortOrder: 1},
      {mealId: 'meal-second', label: 'Second Meal', sortOrder: 5}
    ])
  })

  describe('when only some planned slots match a diary bucket', () => {
    const planSlots = ['breakfast', 'lunch', 'dinner'] as const

    it('keeps the fallback bucket the resolver preselects for the unmatched slot', () => {
      const meals = makePartlyRenamedDiaryMeals()
      const preselected = resolveDiaryBucket(meals, 'breakfast')

      expect(preselected).toEqual({
        option: {mealId: 'meal-brunch', label: 'Brunch', sortOrder: 1},
        isFallback: true
      })
      expect(buildDiaryBucketOptions(meals, planSlots)).toContainEqual(preselected.option)
    })

    it('still offers every canonical match, ordered by sort order', () => {
      expect(buildDiaryBucketOptions(makePartlyRenamedDiaryMeals(), planSlots)).toEqual([
        {mealId: 'meal-brunch', label: 'Brunch', sortOrder: 1},
        {mealId: 'meal-lunch', label: slotLabel('lunch'), sortOrder: 2},
        {mealId: 'meal-dinner', label: slotLabel('dinner'), sortOrder: 3}
      ])
    })

    it('offers a bucket the picker can show for every planned slot', () => {
      const meals = makePartlyRenamedDiaryMeals()
      const offeredIds = buildDiaryBucketOptions(meals, planSlots).map(option => option.mealId)

      planSlots.forEach(slot => {
        expect(offeredIds).toContain(resolveDiaryBucket(meals, slot).option?.mealId)
      })
    })

    it('leaves out a renamed bucket the resolver can never select', () => {
      const meals = [
        makeDiaryMeal({id: 'meal-lunch', name: slotLabel('lunch'), sortOrder: 2}),
        makeDiaryMeal({id: 'meal-dinner', name: slotLabel('dinner'), sortOrder: 3}),
        makeDiaryMeal({id: 'meal-supper', name: 'Late Supper', sortOrder: 4})
      ]

      expect(resolveDiaryBucket(meals, 'breakfast').option?.mealId).toBe('meal-lunch')
      expect(buildDiaryBucketOptions(meals, planSlots)).toEqual([
        {mealId: 'meal-lunch', label: slotLabel('lunch'), sortOrder: 2},
        {mealId: 'meal-dinner', label: slotLabel('dinner'), sortOrder: 3}
      ])
    })

    it('leaves the meals it was given unchanged', () => {
      const meals = makePartlyRenamedDiaryMeals()

      buildDiaryBucketOptions(meals, planSlots)

      expect(meals).toEqual(makePartlyRenamedDiaryMeals())
    })
  })

  it('leaves the meals it was given unchanged', () => {
    const meals = makeDiaryDayMeals()

    buildDiaryBucketOptions(meals, ['breakfast', 'lunch', 'dinner'])

    expect(meals).toEqual(makeDiaryDayMeals())
  })
})

describe('canStepLogDate', () => {
  const planStartDate = '2026-07-05'
  const planEndDate = '2026-07-11'

  it('refuses to step past either end of the plan week', () => {
    expect(canStepLogDate(planStartDate, -1, planStartDate, planEndDate)).toBe(false)
    expect(canStepLogDate(planEndDate, 1, planStartDate, planEndDate)).toBe(false)
  })

  it('allows every step that stays inside the plan week', () => {
    expect(canStepLogDate('2026-07-08', 1, planStartDate, planEndDate)).toBe(true)
    expect(canStepLogDate('2026-07-08', -1, planStartDate, planEndDate)).toBe(true)
    expect(canStepLogDate(planStartDate, 1, planStartDate, planEndDate)).toBe(true)
    expect(canStepLogDate(planEndDate, -1, planStartDate, planEndDate)).toBe(true)
  })
})

describe('stepLogDate', () => {
  const planStartDate = '2026-07-05'
  const planEndDate = '2026-07-11'

  it('moves to the adjacent day inside the plan week', () => {
    expect(stepLogDate('2026-07-08', 1, planStartDate, planEndDate)).toBe('2026-07-09')
    expect(stepLogDate('2026-07-08', -1, planStartDate, planEndDate)).toBe('2026-07-07')
    expect(stepLogDate(planStartDate, 1, planStartDate, planEndDate)).toBe('2026-07-06')
    expect(stepLogDate(planEndDate, -1, planStartDate, planEndDate)).toBe('2026-07-10')
  })

  it('clamps to the plan week at either end', () => {
    expect(stepLogDate(planStartDate, -1, planStartDate, planEndDate)).toBe(planStartDate)
    expect(stepLogDate(planEndDate, 1, planStartDate, planEndDate)).toBe(planEndDate)
  })
})

describe('dateOverlineText', () => {
  it('formats the day as a title-cased weekday and date', () => {
    expect(dateOverlineText('2026-07-04')).toBe('Saturday, July 4th')
    expect(dateOverlineText('2026-07-11')).toBe('Saturday, July 11th')
    expect(dateOverlineText('2026-07-05')).toBe('Sunday, July 5th')
  })

  it('leaves uppercasing to the style layer', () => {
    const overline = dateOverlineText('2026-07-04')

    expect(overline).not.toBe(overline.toUpperCase())
  })
})

describe('logDateStepperLabel', () => {
  const now = new Date(2026, 6, 8, 12, 0, 0)

  it('labels the current day as Today', () => {
    expect(logDateStepperLabel('2026-07-08', now)).toBe(LOG_WEIGHT_TODAY_LABEL)
  })

  it('labels any other day with its short plan date', () => {
    expect(logDateStepperLabel('2026-07-05', now)).toBe('Jul 5')
    expect(logDateStepperLabel('2026-07-11', now)).toBe('Jul 11')
  })
})

describe('resolveViewTarget', () => {
  const todayDayKey = '2026-07-08'

  it('opens the diary when the entry belongs to today', () => {
    expect(resolveViewTarget(todayDayKey, todayDayKey)).toBe('diary')
  })

  it('opens macros history for any other day', () => {
    expect(resolveViewTarget('2026-07-05', todayDayKey)).toBe('history')
    expect(resolveViewTarget('2026-07-11', todayDayKey)).toBe('history')
  })
})

describe('buildPlannedLogRequest', () => {
  const INPUTS = {
    planId: 'plan-1',
    mealId: 'meal-1',
    servings: 0.66,
    date: '2026-07-05',
    diaryMealId: 'dm-1',
    planRevision: 3
  }

  it('names the planned meal, the portion eaten, the diary date and the bucket chosen', () => {
    expect(buildPlannedLogRequest(INPUTS)).toEqual({
      action: 'log',
      planId: 'plan-1',
      mealId: 'meal-1',
      servings: 0.66,
      date: '2026-07-05',
      diaryMealId: 'dm-1',
      expectedPlanRevision: 3
    })
  })

  // A diary entry is the keyed write whose duplicate the user sees directly, so a replay after a lost response
  // has to rebuild exactly this request rather than log the meal a second time under a new key.
  it('rebuilds an identical request from identical inputs', () => {
    expect(buildPlannedLogRequest(INPUTS)).toEqual(buildPlannedLogRequest({...INPUTS}))
  })

  it('differs when the servings, the date or the diary bucket differ', () => {
    expect(buildPlannedLogRequest({...INPUTS, servings: 1})).not.toEqual(buildPlannedLogRequest(INPUTS))
    expect(buildPlannedLogRequest({...INPUTS, date: '2026-07-06'})).not.toEqual(buildPlannedLogRequest(INPUTS))
    expect(buildPlannedLogRequest({...INPUTS, diaryMealId: 'dm-2'})).not.toEqual(buildPlannedLogRequest(INPUTS))
  })

  it('keeps the two-decimal fraction the servings control produces', () => {
    expect(buildPlannedLogRequest({...INPUTS, servings: 0.33}).servings).toBe(0.33)
  })
})

const PLAN_ID = 'plan-1'

const MEAL_ID = 'meal-lunch-tue'

const USER_ID = 'user-1'

// The plan's Monday-to-Sunday week, the meal planned for Tuesday, and Thursday as the day the user steps it
// onto: three distinct days, so a decision that confuses the planned day with the selected one cannot pass.
const PLAN_RANGE: LogPlanDateRange = {startDate: '2026-03-02', endDate: '2026-03-08'}

const PLANNED_DATE = '2026-03-03'

const STEPPED_DATE = '2026-03-05'

const ATTEMPTED_AT = Date.parse('2026-03-03T12:00:00.000Z')

const FRESH_KEY = 'fresh-key'

const STORED_KEY = 'stored-key'

const NO_PENDING_INTENTS: MealPlanStore['pendingIntents'] = {}

const diaryMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: 'diary-lunch',
  name: 'Lunch',
  sortOrder: 2,
  entries: [],
  totals: createEmptyMacroTotals(),
  ...overrides
})

const diaryDay = (): Meal[] => [
  diaryMeal({id: 'diary-dinner', name: 'Dinner', sortOrder: 3}),
  diaryMeal({id: 'diary-breakfast', name: 'Breakfast', sortOrder: 1}),
  diaryMeal({id: 'diary-lunch', name: 'Lunch', sortOrder: 2})
]

// A day whose rows were all renamed, so no row carries a canonical slot name and every slot has to fall back.
const renamedDiaryDay = (): Meal[] => [
  diaryMeal({id: 'diary-supper', name: 'Supper', sortOrder: 3}),
  diaryMeal({id: 'diary-brunch', name: 'Brunch', sortOrder: 1}),
  diaryMeal({id: 'diary-nibbles', name: 'Nibbles', sortOrder: 2})
]

const PLAN_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner']

const apiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const attemptInputs = (
  overrides: Partial<Parameters<typeof planLogAttempt>[0]> = {}
): Parameters<typeof planLogAttempt>[0] => ({
  planId: PLAN_ID,
  mealId: MEAL_ID,
  servings: 1,
  diaryDate: PLANNED_DATE,
  diaryMealId: 'diary-lunch',
  planRevision: 4,
  userId: USER_ID,
  launch: MINT_LAUNCH,
  attemptedAt: ATTEMPTED_AT,
  mintFreshKey: () => FRESH_KEY,
  ...overrides
})

// An intent recorded for one request, the way the screen records it before the request leaves: the fingerprint
// is derived from the snapshot, so only a byte-identical request can replay this key.
const pendingLogIntent = (
  overrides: Partial<Parameters<typeof buildPlannedLogRequest>[0]> = {}
): Partial<Record<'log', PendingIntent>> => ({
  log: buildPendingIntent(
    buildPlannedLogRequest({
      planId: PLAN_ID,
      mealId: MEAL_ID,
      servings: 1,
      date: PLANNED_DATE,
      diaryMealId: 'diary-lunch',
      planRevision: 4,
      ...overrides
    }),
    STORED_KEY,
    USER_ID,
    ATTEMPTED_AT
  )
})

describe('resolveLogCacheScope', () => {
  it('keeps the plan day on the route and scopes the diary day to the selection', () => {
    expect(resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: PLANNED_DATE})).toEqual({
      planId: PLAN_ID,
      plannedDate: PLANNED_DATE,
      diaryDate: PLANNED_DATE
    })
  })

  it('moves the diary day, and only the diary day, when the date is stepped', () => {
    const scope = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})

    // The diary day is the day the entry is written to, so it is the day whose cache the log mutation has to
    // invalidate (0.7.2). Scoping that write to the route's planned day is the bug this asserts against.
    expect(scope.diaryDate).toBe(STEPPED_DATE)
    expect(scope.diaryDate).not.toBe(scope.plannedDate)
    expect(scope.plannedDate).toBe(PLANNED_DATE)
  })

  it('sends the write to the selected day, so the invalidated day is the day written', () => {
    const scope = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})
    const attempt = sentAttempt(planLogAttempt(attemptInputs({diaryDate: scope.diaryDate})))

    // The mutation invalidates `dailyMacros(date)` for the date its own payload carries (0.7.2), so the
    // selected day reaching the payload is what keeps the written day and the dropped day the same day.
    expect(attempt.payload.date).toBe(scope.diaryDate)
    expect(attempt.payload.date).not.toBe(PLANNED_DATE)
  })

  it('keeps the meal the write addresses distinct from the day it is written to', () => {
    const scope = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})
    const attempt = sentAttempt(planLogAttempt(attemptInputs({diaryDate: scope.diaryDate})))

    // The route is `/plans/:planId/meals/:mealId/log`, and both path segments are strings: handing the diary
    // date where the meal id belongs type-checks and addresses a meal that cannot exist. The meal id is a fact
    // about the plan and never follows the stepper, so these two values are never interchangeable.
    expect(attempt.mealId).toBe(MEAL_ID)
    expect(attempt.mealId).not.toBe(scope.diaryDate)
    expect(attempt.mealId).not.toBe(scope.plannedDate)
    expect(planDayQueryScope(scope)).toEqual([PLAN_ID, PLANNED_DATE])
  })
})

describe('planDayQueryScope', () => {
  it('reads the planned day the route named, whatever the stepper has selected', () => {
    const stepped = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})

    // The meal is a fact about its planned day: following the stepper here would ask the plan for a day the
    // meal does not belong to.
    expect(planDayQueryScope(stepped)).toEqual([PLAN_ID, PLANNED_DATE])
  })
})

describe('nextLogDate', () => {
  it('steps one day in either direction inside the plan week', () => {
    expect(nextLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: PLAN_RANGE})).toBe('2026-03-04')
    expect(nextLogDate({selectedDate: PLANNED_DATE, direction: -1, planRange: PLAN_RANGE})).toBe('2026-03-02')
  })

  it('clamps at the plan week and holds still until the range is known', () => {
    expect(nextLogDate({selectedDate: PLAN_RANGE.endDate, direction: 1, planRange: PLAN_RANGE})).toBe(
      PLAN_RANGE.endDate
    )
    expect(nextLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: null})).toBe(PLANNED_DATE)
  })
})

describe('canChangeLogDate', () => {
  it('allows a step inside the plan week', () => {
    expect(
      canChangeLogDate({
        selectedDate: PLANNED_DATE,
        direction: 1,
        planRange: PLAN_RANGE,
        isCommitPending: false,
        isIntentUnresolved: false
      })
    ).toBe(true)
    expect(
      canChangeLogDate({
        selectedDate: PLANNED_DATE,
        direction: -1,
        planRange: PLAN_RANGE,
        isCommitPending: false,
        isIntentUnresolved: false
      })
    ).toBe(true)
  })

  it('refuses a step beyond either end of the plan week, and before the range is known', () => {
    expect(
      canChangeLogDate({
        selectedDate: PLAN_RANGE.startDate,
        direction: -1,
        planRange: PLAN_RANGE,
        isCommitPending: false,
        isIntentUnresolved: false
      })
    ).toBe(false)
    expect(
      canChangeLogDate({
        selectedDate: PLAN_RANGE.endDate,
        direction: 1,
        planRange: PLAN_RANGE,
        isCommitPending: false,
        isIntentUnresolved: false
      })
    ).toBe(false)
    expect(
      canChangeLogDate({
        selectedDate: PLANNED_DATE,
        direction: 1,
        planRange: null,
        isCommitPending: false,
        isIntentUnresolved: false
      })
    ).toBe(false)
  })

  it('refuses every step while a commit is in flight, wherever the date sits', () => {
    // The selected date is the write's cache scope, so moving it mid-commit would leave the request writing
    // one day and its invalidation dropping another.
    expect(
      canChangeLogDate({
        selectedDate: PLANNED_DATE,
        direction: 1,
        planRange: PLAN_RANGE,
        isCommitPending: true,
        isIntentUnresolved: false
      })
    ).toBe(false)
    expect(
      canChangeLogDate({
        selectedDate: PLANNED_DATE,
        direction: -1,
        planRange: PLAN_RANGE,
        isCommitPending: true,
        isIntentUnresolved: false
      })
    ).toBe(false)
  })

  it('refuses every step while a key is unresolved, so the stored day cannot be stepped away from', () => {
    // The date on screen is the unresolved request's own, and the next attempt has to re-send it unchanged: a
    // step could only offer a day no attempt from this screen may write (0.7.2).
    const directions: (1 | -1)[] = [1, -1]

    directions.forEach(direction => {
      expect(
        canChangeLogDate({
          selectedDate: PLANNED_DATE,
          direction,
          planRange: PLAN_RANGE,
          isCommitPending: false,
          isIntentUnresolved: true
        })
      ).toBe(false)
    })
  })
})

describe('resolveLogDiaryDestination', () => {
  it('targets the selected day and the bucket whose name matches the slot', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: STEPPED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: null
    })

    expect(destination.target).toEqual({
      diaryDate: STEPPED_DATE,
      diaryMealId: 'diary-lunch',
      bucketLabel: 'Lunch',
      isInferredBucket: false
    })
  })

  it('offers the plan day its own buckets in sort order', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: null
    })

    expect(destination.options.map(option => option.mealId)).toEqual(['diary-breakfast', 'diary-lunch', 'diary-dinner'])
  })

  it('falls back to the first bucket by sort order, and says so, when no name matches the slot', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: renamedDiaryDay(),
      chosenBucketId: null
    })

    expect(destination.target?.diaryMealId).toBe('diary-brunch')
    expect(destination.target?.isInferredBucket).toBe(true)
  })

  it('drops the fallback caption once the user has picked a bucket', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: renamedDiaryDay(),
      chosenBucketId: 'diary-nibbles'
    })

    expect(destination.target?.diaryMealId).toBe('diary-nibbles')
    expect(destination.target?.isInferredBucket).toBe(false)
  })

  it('never shows the caption for a canonical match, chosen or preselected', () => {
    const preselected = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'dinner',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: null
    })
    const chosen = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'dinner',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: 'diary-breakfast'
    })

    expect(preselected.target?.isInferredBucket).toBe(false)
    expect(chosen.target?.isInferredBucket).toBe(false)
  })

  it('has nothing to target before the meal or the diary day is known', () => {
    expect(
      resolveLogDiaryDestination({
        selectedDate: PLANNED_DATE,
        slot: null,
        planSlots: PLAN_SLOTS,
        diaryMeals: diaryDay(),
        chosenBucketId: null
      })
    ).toEqual({options: [], target: null})
    expect(
      resolveLogDiaryDestination({
        selectedDate: PLANNED_DATE,
        slot: 'lunch',
        planSlots: PLAN_SLOTS,
        diaryMeals: undefined,
        chosenBucketId: null
      })
    ).toEqual({options: [], target: null})
  })

  it('has nothing to target when the selected day carries no buckets at all', () => {
    expect(
      resolveLogDiaryDestination({
        selectedDate: PLANNED_DATE,
        slot: 'lunch',
        planSlots: PLAN_SLOTS,
        diaryMeals: [],
        chosenBucketId: null
      }).target
    ).toBeNull()
  })

  it('has nothing to target when the chosen bucket does not belong to the selected day', () => {
    // Stepping the date clears the chosen bucket for exactly this reason; a stale id must not be logged under
    // another day's label.
    expect(
      resolveLogDiaryDestination({
        selectedDate: STEPPED_DATE,
        slot: 'lunch',
        planSlots: PLAN_SLOTS,
        diaryMeals: diaryDay(),
        chosenBucketId: 'diary-of-another-day'
      }).target
    ).toBeNull()
  })
})

describe('planLogAttempt', () => {
  it('carries a freshly minted key when the slot is free, and records the intent it was minted for', () => {
    const attempt = sentAttempt(planLogAttempt(attemptInputs()))

    expect(attempt.isReplay).toBe(false)
    expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    expect(attempt.intent?.key).toBe(FRESH_KEY)
    expect(attempt.intent?.userId).toBe(USER_ID)
    expect(attempt.mealId).toBe(MEAL_ID)
  })

  it('sends the portion, day, bucket and revision the press was made with', () => {
    const attempt = sentAttempt(
      planLogAttempt(
        attemptInputs({servings: 1.5, diaryDate: STEPPED_DATE, diaryMealId: 'diary-dinner', planRevision: 7})
      )
    )

    expect(attempt.payload).toEqual({
      servings: 1.5,
      date: STEPPED_DATE,
      diaryMealId: 'diary-dinner',
      expectedPlanRevision: 7,
      idempotencyKey: FRESH_KEY
    })
  })

  it('replays the stored key and the stored body while an intent is unresolved', () => {
    const attempt = sentAttempt(planLogAttempt(attemptInputs({launch: replayLaunch()})))

    expect(attempt.isReplay).toBe(true)
    expect(attempt.payload).toEqual({
      servings: 1,
      date: PLANNED_DATE,
      diaryMealId: 'diary-lunch',
      expectedPlanRevision: 4,
      idempotencyKey: STORED_KEY
    })
  })

  it('re-sends the stored key after the plan revision has advanced, instead of minting a new one', () => {
    // The commit-then-response-loss case, and the whole point of resolving the intent before building the
    // body: the refetched plan revision has moved on because this very write committed, and a fresh key over
    // the unresolved one is a key the server has never seen — it would write a second diary entry for a meal
    // the user logged once (0.7.2).
    const attempt = sentAttempt(
      planLogAttempt(
        attemptInputs({
          launch: replayLaunch(),
          planRevision: 5,
          servings: 2,
          diaryDate: STEPPED_DATE,
          diaryMealId: 'diary-dinner',
          attemptedAt: ATTEMPTED_AT + 1_000
        })
      )
    )

    expect(attempt.payload.idempotencyKey).toBe(STORED_KEY)
    expect(attempt.payload.expectedPlanRevision).toBe(4)
    expect(attempt.payload.servings).toBe(1)
    expect(attempt.payload.date).toBe(PLANNED_DATE)
    expect(attempt.payload.diaryMealId).toBe('diary-lunch')
    expect(attempt.mealId).toBe(MEAL_ID)
  })

  it('records nothing for a replay, so a re-sent key keeps the life of the press that minted it', () => {
    const attempt = sentAttempt(
      planLogAttempt(attemptInputs({launch: replayLaunch(), attemptedAt: ATTEMPTED_AT + 1_000}))
    )

    expect(attempt.intent).toBeNull()
  })

  it('mints a fresh key and records it once nothing is unresolved', () => {
    // An intent is resolved only by a server answer to its own key, so a free slot is the only state in which
    // an edited portion, a stepped day or a different bucket may earn a key of its own.
    const attempt = sentAttempt(planLogAttempt(attemptInputs({servings: 2, diaryDate: STEPPED_DATE, planRevision: 5})))

    expect(attempt.isReplay).toBe(false)
    expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    expect(attempt.payload.servings).toBe(2)
    expect(attempt.payload.date).toBe(STEPPED_DATE)
    expect(attempt.payload.expectedPlanRevision).toBe(5)
    expect(attempt.intent?.key).toBe(FRESH_KEY)
    expect(attempt.intent?.request).toEqual(
      buildPlannedLogRequest({
        planId: PLAN_ID,
        mealId: MEAL_ID,
        servings: 2,
        date: STEPPED_DATE,
        diaryMealId: 'diary-lunch',
        planRevision: 5
      })
    )
  })

  it('sends the attempt but records nothing when no user is signed in', () => {
    const attempt = sentAttempt(planLogAttempt(attemptInputs({userId: null})))

    expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    expect(attempt.intent).toBeNull()
  })

  it('plans nothing at all for every blocked verdict, and mints no key', () => {
    // The three refusals of 0.7.2: the persisted slice unread, another meal's key unresolved, and an attempt
    // already on the wire. None of them may produce a payload or an intent — a payload would be a duplicate
    // write and an intent would overwrite the slot.
    const reasons: readonly LogLaunchBlockReason[] = ['hydrating', 'otherResource', 'inFlight']

    reasons.forEach(reason => {
      const mintFreshKey = jest.fn(() => FRESH_KEY)

      expect(planLogAttempt(attemptInputs({launch: {kind: 'blocked', reason}, mintFreshKey}))).toEqual({
        kind: 'blocked',
        reason
      })
      expect(mintFreshKey).not.toHaveBeenCalled()
    })
  })

  it('never reaches for a key on a replay, so the stored one is the only key in play', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)

    sentAttempt(planLogAttempt(attemptInputs({launch: replayLaunch(), mintFreshKey})))

    expect(mintFreshKey).not.toHaveBeenCalled()
  })
})

describe('classifyLogFailure', () => {
  it('retires the intent and names the plan on a confirmed plan-state refusal', () => {
    const codes = [API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive]

    codes.forEach(code => {
      // The plan moved on, so the tab's own plan is re-read; the diary is untouched, because nothing about it
      // is what the server refused.
      expect(classifyLogFailure(apiError(409, code))).toEqual({
        disposition: 'retire',
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        isUnconfirmed: false,
        refetchCurrentPlan: true,
        refetchDiary: false
      })
    })
  })

  it('retires the intent with the generic toast on any other confirmed refusal', () => {
    expect(classifyLogFailure(apiError(409, API_ERROR_CODES.idempotencyConflict))).toEqual({
      disposition: 'retire',
      toast: TOAST_GENERIC_ERROR,
      isUnconfirmed: false,
      refetchCurrentPlan: false,
      refetchDiary: false
    })
  })

  it('re-reads the day on a 404, so the next attempt can name a bucket the day has', () => {
    // The log route answers 404 when the diary meal in the body is not the caller's or not that day's (0.5.2),
    // and it discloses no code for it — so the status is what earns the diary re-read.
    expect(classifyLogFailure(apiError(404, 'Meal not found'))).toEqual({
      disposition: 'retire',
      toast: TOAST_GENERIC_ERROR,
      isUnconfirmed: false,
      refetchCurrentPlan: false,
      refetchDiary: true
    })
  })

  it('treats a 404 whose body does not decode as an unknown outcome, not a bucket refusal', () => {
    // A 404 carrying no `error` member is the signal that the routes are not mounted at all (0.2.5), so it
    // cannot be read as this day's diary refusing a bucket — and its write may still have committed.
    const undecodable = classifyLogFailure(apiError(404))

    expect(undecodable.isUnconfirmed).toBe(true)
    expect(undecodable.disposition).toBe('keep')
    expect(undecodable.refetchDiary).toBe(false)
  })

  it('keeps the intent pending and raises no toast on an unknown outcome', () => {
    // The request may have committed before the response was lost, so the key stays the only safe way to ask
    // again and the banner states the outcome in place (0.2.5).
    const unknown: unknown[] = [
      new Error('Network Error'),
      apiError(502),
      apiError(503),
      {response: {status: 500, data: '<html>gateway</html>'}}
    ]

    unknown.forEach(error => {
      // No refetch is decided here either: the display-only re-read that accompanies the banner is
      // `planUnconfirmedRefetch`'s, and it fires once rather than per failure.
      expect(classifyLogFailure(error)).toEqual({
        disposition: 'keep',
        toast: null,
        isUnconfirmed: true,
        refetchCurrentPlan: false,
        refetchDiary: false
      })
    })
  })
})

describe('planUnconfirmedRefetch', () => {
  it('refetches the plan day and the diary once, and not again', () => {
    const first = planUnconfirmedRefetch({isUnconfirmed: true, hasRefetched: false})
    const second = planUnconfirmedRefetch({isUnconfirmed: true, hasRefetched: true})

    expect(first.refetchPlanDay).toBe(true)
    expect(first.refetchDiary).toBe(true)
    expect(second.refetchPlanDay).toBe(false)
    expect(second.refetchDiary).toBe(false)
  })

  it('refetches nothing until the outcome is unconfirmed', () => {
    expect(planUnconfirmedRefetch({isUnconfirmed: false, hasRefetched: false})).toEqual({
      refetchPlanDay: false,
      refetchDiary: false,
      retiresIntent: false,
      resolvesOutcome: false
    })
  })

  it('is display only: it never resolves the outcome or retires the intent', () => {
    // Only a server answer to the same key resolves a keyed write — a refetch merely lets the screen show an
    // entry this attempt may already have written (0.2.5).
    const cases = [
      {isUnconfirmed: true, hasRefetched: false},
      {isUnconfirmed: true, hasRefetched: true},
      {isUnconfirmed: false, hasRefetched: false}
    ]

    cases.forEach(inputs => {
      const decision = planUnconfirmedRefetch(inputs)

      expect(decision.retiresIntent).toBe(false)
      expect(decision.resolvesOutcome).toBe(false)
    })
  })
})

describe('isPlanStateReadFailure', () => {
  it('recognises a decoded plan-state code on a failed read', () => {
    expect(isPlanStateReadFailure(apiError(409, API_ERROR_CODES.stalePlan))).toBe(true)
    expect(isPlanStateReadFailure(apiError(409, API_ERROR_CODES.planNotActive))).toBe(true)
  })

  it('leaves every other failure, and no failure at all, to the generic card', () => {
    expect(isPlanStateReadFailure(apiError(404, 'Plan day not found'))).toBe(false)
    expect(isPlanStateReadFailure(apiError(502))).toBe(false)
    expect(isPlanStateReadFailure(new Error('Network Error'))).toBe(false)
    expect(isPlanStateReadFailure(null)).toBe(false)
    expect(isPlanStateReadFailure(undefined)).toBe(false)
  })
})

describe('planDayQueryRecovery', () => {
  it('gives a decoded plan-state code its own copy and refetches current-plan state', () => {
    expect(planDayQueryRecovery({error: apiError(409, API_ERROR_CODES.stalePlan), hasAnnounced: false})).toEqual({
      toast: MEAL_PLAN_STALE_PLAN_TOAST,
      refetchCurrentPlan: true,
      isPlanStateFailure: true
    })
    expect(planDayQueryRecovery({error: apiError(409, API_ERROR_CODES.planNotActive), hasAnnounced: false})).toEqual({
      toast: MEAL_PLAN_STALE_PLAN_TOAST,
      refetchCurrentPlan: true,
      isPlanStateFailure: true
    })
  })

  it('states it once: an already-announced failure raises no second toast and no second refetch', () => {
    // The day query's identity changes with every date step, so the classification runs again on a failure the
    // user has already been told about.
    expect(planDayQueryRecovery({error: apiError(409, API_ERROR_CODES.stalePlan), hasAnnounced: true})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: true
    })
  })

  it('leaves a network or undecodable failure to the inline card, with or without the guard', () => {
    const generic: unknown[] = [
      new Error('Network Error'),
      apiError(502),
      {response: {status: 500, data: '<html>gateway</html>'}},
      apiError(404, 'Plan day not found')
    ]

    generic.forEach(error => {
      expect(planDayQueryRecovery({error, hasAnnounced: false})).toEqual({
        toast: null,
        refetchCurrentPlan: false,
        isPlanStateFailure: false
      })
    })
  })

  it('does nothing at all while the read is healthy', () => {
    expect(planDayQueryRecovery({error: null, hasAnnounced: true})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: false
    })
  })
})

describe('resolveUnresolvedLogIntent', () => {
  const intentInputs = (overrides: Partial<Parameters<typeof resolveUnresolvedLogIntent>[0]> = {}) => ({
    pendingIntents: pendingLogIntent(),
    userId: USER_ID,
    planId: PLAN_ID,
    mealId: MEAL_ID,
    now: ATTEMPTED_AT,
    ...overrides
  })

  it('returns the key and the stored request, which is what the next attempt has to re-send', () => {
    // A boolean would have left the screen rebuilding the body from current form state — the defect this
    // resolver exists to remove (0.7.2).
    expect(resolveUnresolvedLogIntent(intentInputs())).toEqual({
      key: STORED_KEY,
      request: {
        action: 'log',
        planId: PLAN_ID,
        mealId: MEAL_ID,
        servings: 1,
        date: PLANNED_DATE,
        diaryMealId: 'diary-lunch',
        expectedPlanRevision: 4
      }
    })
  })

  it('returns nothing when no intent is stored', () => {
    expect(resolveUnresolvedLogIntent(intentInputs({pendingIntents: NO_PENDING_INTENTS}))).toBeNull()
  })

  it('ignores an intent recorded for another meal, or for another plan', () => {
    // That replay belongs to the screen opened on that meal; answering it here would commit its key against a
    // different meal's write.
    const recordedForAnotherMeal = intentInputs({pendingIntents: pendingLogIntent({mealId: 'meal-other'})})
    const recordedForAnotherPlan = intentInputs({pendingIntents: pendingLogIntent({planId: 'plan-2'})})

    expect(resolveUnresolvedLogIntent(intentInputs({mealId: 'meal-dinner-thu'}))).toBeNull()
    expect(resolveUnresolvedLogIntent(recordedForAnotherMeal)).toBeNull()
    expect(resolveUnresolvedLogIntent(recordedForAnotherPlan)).toBeNull()
  })

  it('ignores an intent belonging to another user, and one nobody is signed in to own', () => {
    expect(resolveUnresolvedLogIntent(intentInputs({userId: 'user-2'}))).toBeNull()
    expect(resolveUnresolvedLogIntent(intentInputs({userId: null}))).toBeNull()
  })

  it('ignores an intent past its life, so a long-abandoned key is never offered again', () => {
    const eightDaysOn = ATTEMPTED_AT + 8 * 24 * 60 * 60 * 1000

    expect(resolveUnresolvedLogIntent(intentInputs({now: eightDaysOn}))).toBeNull()
  })
})

describe('isLogFormEditable', () => {
  it('opens the form only for a launch that would mint', () => {
    expect(isLogFormEditable(MINT_LAUNCH)).toBe(true)
  })

  it('holds the form still for every other verdict', () => {
    // A stored key is re-sent unchanged, another meal's key means nothing may be sent from here, an attempt on
    // the wire is the request being answered, and an unread slice may hold a key nobody has seen yet — so an
    // edit accepted in any of these states could never become the request that is sent (0.7.2).
    expect(isLogFormEditable(replayLaunch())).toBe(false)
    expect(isLogFormEditable({kind: 'blocked', reason: 'hydrating'})).toBe(false)
    expect(isLogFormEditable({kind: 'blocked', reason: 'inFlight'})).toBe(false)
    expect(isLogFormEditable({kind: 'blocked', reason: 'otherResource'})).toBe(false)
  })
})

describe('resolveLogFormValues', () => {
  const formInputs = (overrides: Partial<Parameters<typeof resolveLogFormValues>[0]> = {}) => ({
    intent: null,
    isEditable: true,
    servings: 2,
    selectedDate: STEPPED_DATE,
    chosenBucketId: 'diary-dinner',
    ...overrides
  })

  it('shows what the user entered, unlocked, while nothing is unresolved', () => {
    expect(resolveLogFormValues(formInputs())).toEqual({
      servings: 2,
      selectedDate: STEPPED_DATE,
      chosenBucketId: 'diary-dinner',
      isLocked: false
    })
  })

  it('locks what the user entered when no edit could reach a request, holding no intent of its own', () => {
    // The pre-hydration and foreign-slot states: this screen has nothing stored, so the entered values stay
    // on screen, but they are read-only because no attempt from here may carry them yet (0.7.2).
    expect(resolveLogFormValues(formInputs({isEditable: false}))).toEqual({
      servings: 2,
      selectedDate: STEPPED_DATE,
      chosenBucketId: 'diary-dinner',
      isLocked: true
    })
  })

  it('hydrates the portion, day and bucket from the stored request and locks them', () => {
    // The visible values are then exactly the request the next attempt carries under the stored key, so the
    // write that may already have committed is the write being described (0.7.2).
    expect(resolveLogFormValues(formInputs({intent: storedLogIntent(), isEditable: false}))).toEqual({
      servings: 1,
      selectedDate: PLANNED_DATE,
      chosenBucketId: 'diary-lunch',
      isLocked: true
    })
  })

  it('keeps the stored values whatever the local state has moved to', () => {
    const stored = storedLogIntent({servings: 1.5, date: STEPPED_DATE, diaryMealId: 'diary-breakfast'})
    // `isEditable` cannot unlock a stored request: the values on screen are that key's body, and the lock is
    // what keeps them so.
    const values = resolveLogFormValues(formInputs({intent: stored, servings: 10, selectedDate: PLANNED_DATE}))

    expect(values).toEqual({
      servings: 1.5,
      selectedDate: STEPPED_DATE,
      chosenBucketId: 'diary-breakfast',
      isLocked: true
    })
  })
})

// The draft the screen keeps in its own state, as opposed to the values it derives. Without this adoption the
// derived form was the only thing the stored request reached, so the frame after a confirmed refusal retired
// the intent fell back to one serving, the route's date and no bucket — losing the restored request the user
// was looking at and about to retry (0.2.5 keeps a failed attempt on screen with its values intact).
describe('resolveRestoredLogDraft', () => {
  const draftInputs = (overrides: Partial<Parameters<typeof resolveRestoredLogDraft>[0]> = {}) => ({
    intent: storedLogIntent(),
    servings: MIN_SERVINGS,
    selectedDate: PLANNED_DATE,
    chosenBucketId: null,
    ...overrides
  })

  it('adopts the portion, day and bucket the stored request carries', () => {
    const stored = storedLogIntent({servings: 2.5, date: STEPPED_DATE, diaryMealId: 'diary-dinner'})

    expect(resolveRestoredLogDraft(draftInputs({intent: stored}))).toEqual({
      servings: 2.5,
      selectedDate: STEPPED_DATE,
      chosenBucketId: 'diary-dinner'
    })
  })

  // The adoption has to be idempotent, because the caller applies it from an effect that re-runs on the state
  // it just wrote: equal values must answer "nothing to do" rather than set them again.
  it('answers nothing once the draft already equals the stored request', () => {
    const adopted = draftInputs({
      intent: storedLogIntent({servings: 2.5, date: STEPPED_DATE, diaryMealId: 'diary-dinner'}),
      servings: 2.5,
      selectedDate: STEPPED_DATE,
      chosenBucketId: 'diary-dinner'
    })

    expect(resolveRestoredLogDraft(adopted)).toBeNull()
  })

  it('adopts again while any single member still differs', () => {
    const storedBucketOnly = draftInputs({
      intent: storedLogIntent({servings: 1, date: PLANNED_DATE, diaryMealId: 'diary-lunch'}),
      servings: 1,
      selectedDate: PLANNED_DATE,
      chosenBucketId: null
    })

    expect(resolveRestoredLogDraft(storedBucketOnly)).toEqual({
      servings: 1,
      selectedDate: PLANNED_DATE,
      chosenBucketId: 'diary-lunch'
    })
  })

  it('answers nothing when no intent is on record, leaving the draft the user is editing alone', () => {
    const edited = draftInputs({intent: null, servings: 3, selectedDate: STEPPED_DATE, chosenBucketId: 'diary-dinner'})

    expect(resolveRestoredLogDraft(edited)).toBeNull()
  })

  // The stored request's date is the DIARY date the user stepped to, which the route's own planned day may not
  // be: the restored draft has to show that date, or the next attempt would describe a different request.
  it('adopts a stored diary date that differs from the route date', () => {
    const steppedIntent = storedLogIntent({date: STEPPED_DATE})

    expect(resolveRestoredLogDraft(draftInputs({intent: steppedIntent}))?.selectedDate).toBe(STEPPED_DATE)
  })
})

describe('isLogOutcomeUnconfirmed', () => {
  it('states the outcome for the key that answered with an unknown one', () => {
    expect(isLogOutcomeUnconfirmed({intent: storedLogIntent(), unconfirmedKey: STORED_KEY})).toBe(true)
  })

  it('says nothing about a stored intent whose replay has not been answered yet', () => {
    // The screen replays it silently first (AAP 0.7.2); a banner here would hand the user a manual retry for
    // a request the screen is about to finish on its own.
    expect(isLogOutcomeUnconfirmed({intent: storedLogIntent(), unconfirmedKey: null})).toBe(false)
  })

  it('says nothing once a later key is the one on record', () => {
    expect(isLogOutcomeUnconfirmed({intent: storedLogIntent(), unconfirmedKey: FRESH_KEY})).toBe(false)
  })

  it('still states an unknown outcome for an attempt nothing could record', () => {
    // Nobody signed in records no intent, and a failure the user is told nothing about would be worse than
    // one they cannot resolve.
    expect(isLogOutcomeUnconfirmed({intent: null, unconfirmedKey: FRESH_KEY})).toBe(true)
    expect(isLogOutcomeUnconfirmed({intent: null, unconfirmedKey: null})).toBe(false)
  })
})

describe('resolveLogLaunch', () => {
  const launchInputs = (overrides: Partial<Parameters<typeof resolveLogLaunch>[0]> = {}) => ({
    pendingIntents: NO_PENDING_INTENTS,
    userId: USER_ID,
    planId: PLAN_ID,
    mealId: MEAL_ID,
    now: ATTEMPTED_AT + 1_000,
    hasHydratedIntents: true,
    isRequestInFlight: false,
    ...overrides
  })

  it('mints when the action slot is genuinely free', () => {
    expect(resolveLogLaunch(launchInputs())).toEqual({kind: 'mint'})
  })

  it("replays this screen's own unresolved key, handing back the stored request to re-send", () => {
    expect(resolveLogLaunch(launchInputs({pendingIntents: pendingLogIntent()}))).toEqual({
      kind: 'replay',
      intent: storedLogIntent()
    })
  })

  it("blocks on another meal's unresolved key instead of reading the slot as empty", () => {
    // The duplicate-entry sequence the finding prohibits: `pendingIntents.log` holds exactly one record, so a
    // screen that only asked about ITS meal saw a free slot, minted, and filed the fresh key over the key
    // that could still have reconciled the other meal's write (0.7.2).
    expect(resolveLogLaunch(launchInputs({pendingIntents: pendingLogIntent({mealId: OTHER_MEAL_ID})}))).toEqual({
      kind: 'blocked',
      reason: 'otherResource'
    })
  })

  it("blocks on another plan's unresolved key for the same reason", () => {
    expect(resolveLogLaunch(launchInputs({pendingIntents: pendingLogIntent({planId: 'plan-2'})}))).toEqual({
      kind: 'blocked',
      reason: 'otherResource'
    })
  })

  it('blocks until the persisted read has SUCCEEDED, whatever the slot appears to hold', () => {
    // A pending read and a refused one are both `false` here, and both must block: an unread slice may already
    // hold a key, and minting beside it is the duplicate write this contract exists to prevent.
    expect(resolveLogLaunch(launchInputs({hasHydratedIntents: false}))).toEqual({
      kind: 'blocked',
      reason: 'hydrating'
    })
    expect(resolveLogLaunch(launchInputs({hasHydratedIntents: false, pendingIntents: pendingLogIntent()}))).toEqual({
      kind: 'blocked',
      reason: 'hydrating'
    })
  })

  it('blocks while a log request is on the wire anywhere in the app, before any other consideration', () => {
    // The Meal Plan tab owns the same cold-start replay and sends the same mutation key, so the count is
    // app-wide: two senders for one key would race two answers for it.
    expect(resolveLogLaunch(launchInputs({isRequestInFlight: true}))).toEqual({
      kind: 'blocked',
      reason: 'inFlight'
    })
    expect(resolveLogLaunch(launchInputs({isRequestInFlight: true, pendingIntents: pendingLogIntent()}))).toEqual({
      kind: 'blocked',
      reason: 'inFlight'
    })
  })

  it("treats an expired record, another account's record and no account as a free slot", () => {
    const expired = launchInputs({
      pendingIntents: pendingLogIntent(),
      now: ATTEMPTED_AT + PENDING_INTENT_TTL_MS
    })

    expect(resolveLogLaunch(expired)).toEqual({kind: 'mint'})
    expect(resolveLogLaunch(launchInputs({pendingIntents: pendingLogIntent(), userId: 'user-2'}))).toEqual({
      kind: 'mint'
    })
    expect(resolveLogLaunch(launchInputs({pendingIntents: pendingLogIntent(), userId: null}))).toEqual({kind: 'mint'})
  })
})

describe('resolveLogSubmitAffordance', () => {
  const affordanceInputs = (overrides: Partial<Parameters<typeof resolveLogSubmitAffordance>[0]> = {}) => ({
    launch: MINT_LAUNCH,
    isCommitReady: true,
    intentsHydration: 'succeeded' as const,
    ...overrides
  })

  it('offers the submit once there is something to log and the slot is free', () => {
    expect(resolveLogSubmitAffordance(affordanceInputs())).toEqual({
      canSubmit: true,
      isPending: false,
      offersHydrationRetry: false,
      isBlockedByOtherMeal: false
    })
  })

  it('offers the same-key replay as the submit, because that is the request it sends', () => {
    expect(resolveLogSubmitAffordance(affordanceInputs({launch: replayLaunch()})).canSubmit).toBe(true)
  })

  it('offers nothing before the day and the diary bucket are known', () => {
    expect(resolveLogSubmitAffordance(affordanceInputs({isCommitReady: false})).canSubmit).toBe(false)
  })

  it('shows the pending treatment while the persisted read is still out', () => {
    expect(
      resolveLogSubmitAffordance(
        affordanceInputs({launch: {kind: 'blocked', reason: 'hydrating'}, intentsHydration: 'pending'})
      )
    ).toEqual({canSubmit: false, isPending: true, offersHydrationRetry: false, isBlockedByOtherMeal: false})
  })

  it('offers the read again, not the write, once the persisted read has been refused', () => {
    // `retryIntentsHydration` is the only way out of 'failed', and the write stays refused until it succeeds.
    expect(
      resolveLogSubmitAffordance(
        affordanceInputs({launch: {kind: 'blocked', reason: 'hydrating'}, intentsHydration: 'failed'})
      )
    ).toEqual({canSubmit: false, isPending: false, offersHydrationRetry: true, isBlockedByOtherMeal: false})
  })

  it('shows the pending treatment, and no submit, while an attempt is on the wire', () => {
    expect(resolveLogSubmitAffordance(affordanceInputs({launch: {kind: 'blocked', reason: 'inFlight'}}))).toEqual({
      canSubmit: false,
      isPending: true,
      offersHydrationRetry: false,
      isBlockedByOtherMeal: false
    })
  })

  it('says another meal holds the slot, and offers no fresh submit', () => {
    expect(resolveLogSubmitAffordance(affordanceInputs({launch: {kind: 'blocked', reason: 'otherResource'}}))).toEqual({
      canSubmit: false,
      isPending: false,
      offersHydrationRetry: false,
      isBlockedByOtherMeal: true
    })
  })
})

describe('planStoredLogReplay', () => {
  const replayInputs = (overrides: Partial<Parameters<typeof planStoredLogReplay>[0]> = {}) => ({
    launch: replayLaunch(),
    isCommitReady: true,
    isRequestInFlight: false,
    replayedKey: null,
    ...overrides
  })

  it('replays the stored key once as the screen opens', () => {
    expect(planStoredLogReplay(replayInputs())).toEqual({replays: true, replayedKey: STORED_KEY})
  })

  it('never replays a key it has already sent, however that key was sent', () => {
    // The latch covers the user's own press as well as this replay: the press records the key it minted, so
    // the open replay cannot send it a second time.
    expect(planStoredLogReplay(replayInputs({replayedKey: STORED_KEY}))).toEqual({
      replays: false,
      replayedKey: STORED_KEY
    })
  })

  it('waits for the persisted slice rather than concluding nothing is pending', () => {
    // A first frame reads an empty slice, so deciding then would leave the intent unreplayed for the rest of
    // the session — and the next press would mint a second key for a request the server may already hold. The
    // verdict carries that wait, which is why a 'hydrating' block replays nothing.
    expect(planStoredLogReplay(replayInputs({launch: {kind: 'blocked', reason: 'hydrating'}}))).toEqual({
      replays: false,
      replayedKey: null
    })
  })

  it('waits for a commit-ready day before replaying', () => {
    expect(planStoredLogReplay(replayInputs({isCommitReady: false})).replays).toBe(false)
  })

  it('never replays while a request is in flight, by the verdict or by the count', () => {
    expect(planStoredLogReplay(replayInputs({isRequestInFlight: true})).replays).toBe(false)
    expect(planStoredLogReplay(replayInputs({launch: {kind: 'blocked', reason: 'inFlight'}})).replays).toBe(false)
  })

  it("never replays another meal's key from this screen", () => {
    expect(planStoredLogReplay(replayInputs({launch: {kind: 'blocked', reason: 'otherResource'}}))).toEqual({
      replays: false,
      replayedKey: null
    })
  })

  it('has nothing to replay when no intent is unresolved', () => {
    expect(planStoredLogReplay(replayInputs({launch: MINT_LAUNCH}))).toEqual({replays: false, replayedKey: null})
  })
})

describe('one lost response, from cold start to resolution', () => {
  /**
   * The screen's own loop, assembled from the pure decisions it is built out of: what an open does, what one
   * attempt sends, and what an answer settles. No renderer is installed (0.9.2), so this is where the
   * sequence the findings describe is held — a diary entry whose response was lost is replayed silently under
   * its own key and written once, never twice.
   */
  interface Screen {
    pendingIntents: MealPlanStore['pendingIntents']
    sentKey: string | null
    unconfirmedKey: string | null
    sent: LogAttempt['payload'][]
    /** Every refusal the screen answered a press with, in order — a press that sent nothing at all. */
    blocked: LogLaunchBlockReason[]
    /** How many keys were minted, which is the number this whole contract exists to hold down. */
    mints: number
  }

  /** The world the screen opens in: which meal it is showing, and what the device and the wire are doing. */
  interface Environment {
    mealId: string
    hasHydratedIntents: boolean
    isRequestInFlight: boolean
    freshKey: string
  }

  // Deliberately none of the values the intent was minted with. After a commit whose response was lost the
  // day has been refetched and its revision has advanced, and the user reopens the screen with the defaults:
  // building the request from these is what minted a second key and wrote a second entry.
  const CURRENT_REVISION = 9

  const REOPENED_AT = ATTEMPTED_AT + 60_000

  const OTHER_MEAL_KEY = 'other-meal-key'

  const environment = (overrides: Partial<Environment> = {}): Environment => ({
    mealId: MEAL_ID,
    hasHydratedIntents: true,
    isRequestInFlight: false,
    freshKey: FRESH_KEY,
    ...overrides
  })

  const newScreen = (pendingIntents: MealPlanStore['pendingIntents']): Screen => ({
    pendingIntents,
    sentKey: null,
    unconfirmedKey: null,
    sent: [],
    blocked: [],
    mints: 0
  })

  const storedIntentOf = (screen: Screen, where: Environment = environment()): UnresolvedLogIntent | null =>
    resolveUnresolvedLogIntent({
      pendingIntents: screen.pendingIntents,
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: where.mealId,
      now: REOPENED_AT
    })

  const launchOf = (screen: Screen, where: Environment): LogLaunchDecision =>
    resolveLogLaunch({
      pendingIntents: screen.pendingIntents,
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: where.mealId,
      now: REOPENED_AT,
      hasHydratedIntents: where.hasHydratedIntents,
      isRequestInFlight: where.isRequestInFlight
    })

  const attempt = (screen: Screen, where: Environment = environment()): void => {
    const planned = planLogAttempt({
      planId: PLAN_ID,
      mealId: where.mealId,
      servings: 2,
      diaryDate: STEPPED_DATE,
      diaryMealId: 'diary-dinner',
      planRevision: CURRENT_REVISION,
      userId: USER_ID,
      launch: launchOf(screen, where),
      attemptedAt: REOPENED_AT,
      mintFreshKey: () => {
        screen.mints += 1

        return where.freshKey
      }
    })

    if (planned.kind === 'blocked') {
      screen.blocked.push(planned.reason)

      return
    }

    if (planned.attempt.intent !== null) {
      screen.pendingIntents = {log: planned.attempt.intent}
    }

    screen.sentKey = planned.attempt.payload.idempotencyKey
    screen.sent.push(planned.attempt.payload)
  }

  const open = (screen: Screen, where: Environment, isCommitReady: boolean): void => {
    const replay = planStoredLogReplay({
      launch: launchOf(screen, where),
      isCommitReady,
      isRequestInFlight: where.isRequestInFlight,
      replayedKey: screen.sentKey
    })

    screen.sentKey = replay.replayedKey

    if (replay.replays) {
      attempt(screen, where)
    }
  }

  const answer = (screen: Screen, error: unknown): void => {
    const decision = classifyLogFailure(error)

    if (decision.disposition === 'retire') {
      screen.pendingIntents = {}
    }

    screen.unconfirmedKey = decision.isUnconfirmed ? screen.sentKey : null
  }

  const banner = (screen: Screen): boolean =>
    isLogOutcomeUnconfirmed({intent: storedIntentOf(screen), unconfirmedKey: screen.unconfirmedKey})

  const STORED_PAYLOAD = {
    servings: 1,
    date: PLANNED_DATE,
    diaryMealId: 'diary-lunch',
    expectedPlanRevision: 4,
    idempotencyKey: STORED_KEY
  }

  const coldStart = (): Screen => {
    const screen = newScreen(pendingLogIntent())

    open(screen, environment({hasHydratedIntents: false}), false)
    open(screen, environment(), false)
    open(screen, environment(), true)

    return screen
  }

  it('waits for the persisted slice and the day, then replays the stored request under its own key', () => {
    const screen = newScreen(pendingLogIntent())

    open(screen, environment({hasHydratedIntents: false}), false)
    expect(screen.sent).toEqual([])

    open(screen, environment(), false)
    expect(screen.sent).toEqual([])

    open(screen, environment(), true)
    expect(screen.sent).toEqual([STORED_PAYLOAD])
  })

  it('replays silently: nothing is stated until that key has answered', () => {
    const screen = coldStart()

    expect(banner(screen)).toBe(false)
  })

  it('replays once, however often the open is reconsidered', () => {
    const screen = coldStart()

    open(screen, environment(), true)
    open(screen, environment(), true)

    expect(screen.sent).toEqual([STORED_PAYLOAD])
  })

  it('states the unconfirmed outcome only when the replay is also answered with an unknown one', () => {
    const screen = coldStart()

    answer(screen, new Error('Network Error'))

    expect(banner(screen)).toBe(true)
    expect(storedIntentOf(screen)?.key).toBe(STORED_KEY)
  })

  it('re-sends the very same request on "Try again", so the entry is written once', () => {
    const screen = coldStart()

    answer(screen, new Error('Network Error'))
    attempt(screen)

    expect(screen.sent).toEqual([STORED_PAYLOAD, STORED_PAYLOAD])
    expect(storedIntentOf(screen)?.key).toBe(STORED_KEY)
  })

  it('keeps the banner and the intent through the display-only refetch that accompanies it', () => {
    const screen = coldStart()

    answer(screen, new Error('Network Error'))

    const refetch = planUnconfirmedRefetch({isUnconfirmed: banner(screen), hasRefetched: false})

    expect(refetch).toEqual({refetchPlanDay: true, refetchDiary: true, retiresIntent: false, resolvesOutcome: false})
    expect(banner(screen)).toBe(true)
    expect(storedIntentOf(screen)).not.toBeNull()
  })

  it('retires the key on a confirmed refusal, and only then mints one of its own', () => {
    const screen = coldStart()

    answer(screen, apiError(409, API_ERROR_CODES.stalePlan))

    expect(banner(screen)).toBe(false)
    expect(storedIntentOf(screen)).toBeNull()

    attempt(screen)

    expect(screen.sent[screen.sent.length - 1]).toEqual({
      servings: 2,
      date: STEPPED_DATE,
      diaryMealId: 'diary-dinner',
      expectedPlanRevision: CURRENT_REVISION,
      idempotencyKey: FRESH_KEY
    })
  })

  it('has nothing to replay, and states nothing, when no earlier attempt was left unresolved', () => {
    const screen = newScreen(NO_PENDING_INTENTS)

    open(screen, environment(), true)

    expect(screen.sent).toEqual([])
    expect(banner(screen)).toBe(false)
  })

  it("opens and submits meal B while meal A's key is unresolved, and leaves that key exactly as it was", () => {
    // The sequence the finding prohibits, end to end: an unresolved log on meal A, the user opens meal B and
    // presses Add to diary. Meal B must send nothing, mint nothing and — above all — file nothing over the one
    // `pendingIntents.log` record, which is still the only thing that can reconcile meal A's write (0.7.2).
    const screen = newScreen(pendingLogIntent())
    const mealA = screen.pendingIntents.log
    const mealB = environment({mealId: OTHER_MEAL_ID, freshKey: OTHER_MEAL_KEY})

    open(screen, mealB, true)
    attempt(screen, mealB)

    expect(screen.sent).toEqual([])
    expect(screen.mints).toBe(0)
    expect(screen.blocked).toEqual(['otherResource'])
    expect(screen.pendingIntents.log).toBe(mealA)
    expect(storedIntentOf(screen)?.key).toBe(STORED_KEY)
    expect(storedIntentOf(screen, mealB)).toBeNull()
  })

  it("shows meal B its own values, read-only, while meal A's key is unresolved", () => {
    const screen = newScreen(pendingLogIntent())
    const mealB = environment({mealId: OTHER_MEAL_ID, freshKey: OTHER_MEAL_KEY})
    const launch = launchOf(screen, mealB)

    expect(isLogFormEditable(launch)).toBe(false)
    expect(
      resolveLogFormValues({
        intent: storedIntentOf(screen, mealB),
        isEditable: isLogFormEditable(launch),
        servings: 2,
        selectedDate: STEPPED_DATE,
        chosenBucketId: 'diary-dinner'
      })
    ).toEqual({servings: 2, selectedDate: STEPPED_DATE, chosenBucketId: 'diary-dinner', isLocked: true})
    expect(resolveLogSubmitAffordance({launch, isCommitReady: true, intentsHydration: 'succeeded'})).toEqual({
      canSubmit: false,
      isPending: false,
      offersHydrationRetry: false,
      isBlockedByOtherMeal: true
    })
  })

  it("lets meal B mint its own key only once meal A's key has been answered", () => {
    const screen = newScreen(pendingLogIntent())
    const mealB = environment({mealId: OTHER_MEAL_ID, freshKey: OTHER_MEAL_KEY})

    open(screen, environment(), true)
    answer(screen, apiError(409, API_ERROR_CODES.stalePlan))

    attempt(screen, mealB)

    expect(screen.mints).toBe(1)
    expect(screen.sent[screen.sent.length - 1]?.idempotencyKey).toBe(OTHER_MEAL_KEY)
    expect(screen.pendingIntents.log?.key).toBe(OTHER_MEAL_KEY)
    expect(screen.blocked).toEqual([])
  })

  it('sends and mints nothing on a press taken before the persisted read has come back', () => {
    // The delayed-hydration read: the slice is on its way out of AsyncStorage and already holds a key. A press
    // during that window used to mint a second key for a request the server may already have committed.
    const screen = newScreen(pendingLogIntent())
    const starting = environment({hasHydratedIntents: false})

    open(screen, starting, true)
    attempt(screen, starting)

    expect(screen.sent).toEqual([])
    expect(screen.mints).toBe(0)
    expect(screen.blocked).toEqual(['hydrating'])
    expect(storedIntentOf(screen)?.key).toBe(STORED_KEY)

    // And the same press, once the read has succeeded, replays that very key instead of minting.
    attempt(screen, environment())

    expect(screen.sent).toEqual([STORED_PAYLOAD])
    expect(screen.mints).toBe(0)
  })

  it('mints on a first log only after the read has succeeded, never during it', () => {
    const screen = newScreen(NO_PENDING_INTENTS)

    attempt(screen, environment({hasHydratedIntents: false}))

    expect(screen.sent).toEqual([])
    expect(screen.mints).toBe(0)
    expect(screen.pendingIntents.log).toBeUndefined()

    attempt(screen, environment())

    expect(screen.mints).toBe(1)
    expect(screen.sent).toEqual([
      {
        servings: 2,
        date: STEPPED_DATE,
        diaryMealId: 'diary-dinner',
        expectedPlanRevision: CURRENT_REVISION,
        idempotencyKey: FRESH_KEY
      }
    ])
  })

  it('sends nothing of its own while the Meal Plan tab has a log on the wire', () => {
    // The two owners of this action's cold-start replay share one in-flight count precisely so that one key is
    // never on the wire twice (0.7.2).
    const screen = newScreen(pendingLogIntent())
    const sending = environment({isRequestInFlight: true})

    open(screen, sending, true)
    attempt(screen, sending)

    expect(screen.sent).toEqual([])
    expect(screen.blocked).toEqual(['inFlight'])
    expect(storedIntentOf(screen)?.key).toBe(STORED_KEY)
  })
})
