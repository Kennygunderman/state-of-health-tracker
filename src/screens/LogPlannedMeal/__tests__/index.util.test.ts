import {createEmptyMacroTotals} from '@data/models/Macros'
import {Meal} from '@data/models/Meal'
import {MIN_SERVINGS, PerServingMacros} from '@utility/ServingsUtility'

import {CAL_LABEL, CARBS_LABEL, FAT_LABEL, LOG_WEIGHT_TODAY_LABEL, PROTEIN_LABEL} from '@constants/strings'

import {
  buildDiaryBucketOptions,
  buildFractionChipStates,
  buildThisAddsItems,
  canStepLogDate,
  dateOverlineText,
  logDateStepperLabel,
  MAX_PLANNED_SERVINGS,
  nextPlannedServings,
  parsePlannedServingsInput,
  plannedPortionSnapshot,
  resolveDiaryBucket,
  resolveViewTarget,
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

const makeDiaryMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: 'meal-lunch',
  name: 'Lunch',
  sortOrder: 2,
  entries: [],
  totals: createEmptyMacroTotals(),
  ...overrides
})

const makeDiaryDayMeals = (): Meal[] => [
  makeDiaryMeal({id: 'meal-dinner', name: 'Dinner', sortOrder: 3}),
  makeDiaryMeal({id: 'meal-breakfast', name: 'Breakfast', sortOrder: 1}),
  makeDiaryMeal({id: 'meal-snack', name: 'Snack', sortOrder: 4}),
  makeDiaryMeal({id: 'meal-lunch', name: 'Lunch', sortOrder: 2})
]

const makeRenamedDiaryMeals = (): Meal[] => [
  makeDiaryMeal({id: 'meal-second', name: 'Second Meal', sortOrder: 5}),
  makeDiaryMeal({id: 'meal-first', name: 'First Meal', sortOrder: 1})
]

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

  it('rounds to two decimals before checking the range', () => {
    expect(parsePlannedServingsInput('1.333')).toBe(1.33)
    expect(parsePlannedServingsInput('1.336')).toBe(1.34)
    expect(parsePlannedServingsInput('0.249')).toBe(MIN_SERVINGS)
    expect(parsePlannedServingsInput('10.004')).toBe(MAX_PLANNED_SERVINGS)
  })

  it('only ever returns servings the log endpoint accepts', () => {
    const inputs = ['1.25', '1', '.5', '1,5', '0.25', '10', '1.333', '0.249', '10.004', '', 'abc', '0', '11', '10.5']
    const accepted = inputs.map(parsePlannedServingsInput).filter((value): value is number => value !== null)

    expect(accepted).toHaveLength(9)
    expect(accepted.every(value => Math.round(value * 100) / 100 === value)).toBe(true)
    expect(accepted.every(value => value >= MIN_SERVINGS && value <= MAX_PLANNED_SERVINGS)).toBe(true)
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
        option: {mealId: 'meal-dinner', label: 'Dinner', sortOrder: 3},
        isFallback: false
      })
    })

    it('matches the bucket name case-insensitively and ignores surrounding space', () => {
      const meals = [
        makeDiaryMeal({id: 'meal-breakfast', name: 'BREAKFAST', sortOrder: 1}),
        makeDiaryMeal({id: 'meal-lunch', name: '  lunch  ', sortOrder: 2})
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
      {mealId: 'meal-breakfast', label: 'Breakfast', sortOrder: 1},
      {mealId: 'meal-lunch', label: 'Lunch', sortOrder: 2},
      {mealId: 'meal-dinner', label: 'Dinner', sortOrder: 3}
    ])
  })

  it('adds the snack bucket when the plan includes a snack', () => {
    expect(buildDiaryBucketOptions(makeDiaryDayMeals(), ['breakfast', 'lunch', 'dinner', 'snack'])).toEqual([
      {mealId: 'meal-breakfast', label: 'Breakfast', sortOrder: 1},
      {mealId: 'meal-lunch', label: 'Lunch', sortOrder: 2},
      {mealId: 'meal-dinner', label: 'Dinner', sortOrder: 3},
      {mealId: 'meal-snack', label: 'Snack', sortOrder: 4}
    ])
  })

  it('offers every diary bucket when none matches the planned slots', () => {
    expect(buildDiaryBucketOptions(makeRenamedDiaryMeals(), ['breakfast', 'lunch', 'dinner'])).toEqual([
      {mealId: 'meal-first', label: 'First Meal', sortOrder: 1},
      {mealId: 'meal-second', label: 'Second Meal', sortOrder: 5}
    ])
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
