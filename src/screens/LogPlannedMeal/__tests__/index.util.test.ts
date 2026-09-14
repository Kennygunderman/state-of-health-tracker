import {createEmptyMacroTotals} from '@data/models/Macros'
import {Meal} from '@data/models/Meal'
import {MealSlot} from '@data/models/Recipe'
import {MIN_SERVINGS, PerServingMacros} from '@utility/ServingsUtility'

import {
  CAL_LABEL,
  CARBS_LABEL,
  FAT_LABEL,
  LOG_WEIGHT_TODAY_LABEL,
  MEAL_PLAN_SERVING_FRACTION_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_SERVING_FRACTION_NAMES,
  MEAL_SLOT_LABELS,
  PROTEIN_LABEL,
  stringWithNamedParameters
} from '@constants/strings'

import {
  beginServingsDraft,
  buildDiaryBucketOptions,
  buildFractionChipStates,
  buildPlannedLogRequest,
  buildThisAddsItems,
  canStepLogDate,
  dateOverlineText,
  isServingsDraftStale,
  logDateStepperLabel,
  MAX_PLANNED_SERVINGS,
  nextPlannedServings,
  nextServingsDraft,
  parsePlannedServingsInput,
  plannedPortionSnapshot,
  resolveDiaryBucket,
  resolveViewTarget,
  servingsFieldText,
  stepLogDate,
  thisAddsTotals
} from '../index.util'

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
