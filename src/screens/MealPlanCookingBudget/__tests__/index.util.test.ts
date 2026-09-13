import {CookingTimeLimitMin} from '@data/models/MealPlanPreferences'

import {
  budgetFieldState,
  buildPlanSummaryRows,
  cookingBudgetWizardProgress,
  CookingTimeOption,
  COOKING_TIME_OPTIONS,
  MAX_WEEKLY_BUDGET_USD,
  MIN_WEEKLY_BUDGET_USD,
  parseWeeklyBudget,
  PlanSummaryDraft,
  PlanSummarySource,
  PlanSummaryStep,
  sanitizeBudgetInput,
  validateCookingBudgetStep,
  validateCookingTime,
  validateWeeklyBudget
} from '../index.util'

const COOKING_TIME_LIMITS: CookingTimeLimitMin[] = [15, 30, 45, 60]

// 77.1 kg is the 170 lb goal weight of Figma 08's summary card, held in the metric value the
// server stores; the row is what converts it back for a pound user.
const GOAL_WEIGHT_KG = 77.1

const makeSource = (overrides: Partial<PlanSummarySource> = {}): PlanSummarySource => ({
  goal: null,
  goalWeightKg: null,
  diet: null,
  mealSchedule: null,
  weightUnitPref: null,
  ...overrides
})

const makeDraft = (
  draft: Partial<PlanSummarySource> = {},
  seeded = false,
  editedSteps?: Partial<Record<PlanSummaryStep, boolean>>
): PlanSummaryDraft => ({draft: makeSource(draft), seeded, editedSteps})

const ANSWERED_DRAFT: Partial<PlanSummarySource> = {
  goal: 'lose',
  goalWeightKg: GOAL_WEIGHT_KG,
  diet: 'none',
  mealSchedule: 'three',
  weightUnitPref: 'lb'
}

const valuesOf = (rows: ReturnType<typeof buildPlanSummaryRows>): string[] => rows.map(row => row.value)

describe('COOKING_TIME_OPTIONS', () => {
  it('offers the four maximum cooking times frame 08 draws, in that order', () => {
    expect(COOKING_TIME_OPTIONS.map(option => option.value)).toEqual(COOKING_TIME_LIMITS)
  })

  // Total prep plus cooking time for one meal: the same number the planner compares with a
  // recipe's total_minutes, so the chip copy must not imply cooking alone.
  it('labels each chip with its minute count', () => {
    expect(COOKING_TIME_OPTIONS.map(option => option.label)).toEqual(['15 min', '30 min', '45 min', '60 min'])
  })

  it('freezes the table so a consumer cannot add, drop or reorder a limit', () => {
    expect(Object.isFrozen(COOKING_TIME_OPTIONS)).toBe(true)
    expect(() => (COOKING_TIME_OPTIONS as CookingTimeOption[]).push({value: 15, label: '90 min'})).toThrow(TypeError)
    expect(() => (COOKING_TIME_OPTIONS as CookingTimeOption[]).reverse()).toThrow(TypeError)
    expect(COOKING_TIME_OPTIONS.map(option => option.value)).toEqual(COOKING_TIME_LIMITS)
  })

  it('freezes each entry so a consumer cannot relabel a limit in place', () => {
    const [first] = COOKING_TIME_OPTIONS as CookingTimeOption[]
    const rewritten = first as {value: CookingTimeLimitMin; label: string}

    rewritten.label = '90 min'
    rewritten.value = 60

    expect(COOKING_TIME_OPTIONS.every(option => Object.isFrozen(option))).toBe(true)
    expect(COOKING_TIME_OPTIONS[0]).toEqual({value: 15, label: '15 min'})
  })
})

describe('the weekly budget bounds', () => {
  it('matches the whole-dollar integer range the server accepts', () => {
    expect(MIN_WEEKLY_BUDGET_USD).toBe(1)
    expect(MAX_WEEKLY_BUDGET_USD).toBe(10000)
  })
})

describe('sanitizeBudgetInput', () => {
  it('keeps a plain whole-dollar amount as typed', () => {
    expect(sanitizeBudgetInput('120')).toBe('120')
  })

  it('drops the currency sign, separators and spaces the field never stores', () => {
    expect(sanitizeBudgetInput('$1,250 ')).toBe('1250')
  })

  it('drops letters and symbols from a pasted value', () => {
    expect(sanitizeBudgetInput('about 90 dollars')).toBe('90')
  })

  // Whole dollars only: a cent typed here would be rejected by the server, so the decimal point
  // never survives the field rather than failing later.
  it('removes a decimal point instead of keeping a fractional amount', () => {
    expect(sanitizeBudgetInput('12.50')).toBe('1250')
  })

  it('drops a redundant leading zero', () => {
    expect(sanitizeBudgetInput('007')).toBe('7')
  })

  it('keeps a lone zero, which the user is still typing', () => {
    expect(sanitizeBudgetInput('0')).toBe('0')
  })

  it('leaves an empty field empty rather than inventing a zero', () => {
    expect(sanitizeBudgetInput('')).toBe('')
    expect(sanitizeBudgetInput('$')).toBe('')
  })

  it('is idempotent, so re-sanitising its own output changes nothing', () => {
    expect(sanitizeBudgetInput(sanitizeBudgetInput('$0,012.34'))).toBe(sanitizeBudgetInput('$0,012.34'))
  })
})

describe('parseWeeklyBudget', () => {
  it('accepts the lowest amount the server takes', () => {
    expect(parseWeeklyBudget('1')).toBe(MIN_WEEKLY_BUDGET_USD)
  })

  it('accepts the highest amount the server takes', () => {
    expect(parseWeeklyBudget('10000')).toBe(MAX_WEEKLY_BUDGET_USD)
  })

  it('accepts an amount inside the range', () => {
    expect(parseWeeklyBudget('120')).toBe(120)
  })

  it('rejects zero, which is not a budget', () => {
    expect(parseWeeklyBudget('0')).toBeNull()
  })

  it('rejects an amount above the range', () => {
    expect(parseWeeklyBudget('10001')).toBeNull()
  })

  it('rejects a fractional amount', () => {
    expect(parseWeeklyBudget('12.50')).toBeNull()
  })

  it('rejects a signed amount', () => {
    expect(parseWeeklyBudget('-120')).toBeNull()
    expect(parseWeeklyBudget('+120')).toBeNull()
  })

  it('rejects an empty or blank field', () => {
    expect(parseWeeklyBudget('')).toBeNull()
    expect(parseWeeklyBudget('   ')).toBeNull()
  })

  it('rejects a value that is not a number at all', () => {
    expect(parseWeeklyBudget('one hundred')).toBeNull()
    expect(parseWeeklyBudget('1e3')).toBeNull()
    expect(parseWeeklyBudget('NaN')).toBeNull()
  })

  it('tolerates the whitespace a keyboard leaves around an amount', () => {
    expect(parseWeeklyBudget(' 120 ')).toBe(120)
  })
})

describe('validateCookingTime', () => {
  it('reports an unanswered chip row, because nothing is preselected on first entry', () => {
    expect(validateCookingTime(null)).toBe('option_required')
  })

  it('passes every limit the chip row offers', () => {
    expect(COOKING_TIME_LIMITS.map(limit => validateCookingTime(limit))).toEqual([null, null, null, null])
  })
})

describe('validateWeeklyBudget', () => {
  it('treats the no-preference checkbox as the answer, whatever the field holds', () => {
    expect(validateWeeklyBudget(true, '')).toBeNull()
    expect(validateWeeklyBudget(true, '0')).toBeNull()
    expect(validateWeeklyBudget(true, 'nonsense')).toBeNull()
  })

  // Frame 08 draws the box checked and the input dimmed, but that is the state after the choice:
  // on first entry the box is unchecked and the field empty, which is unanswered rather than
  // optional, so the user must either check the box or type an amount.
  it('reports an unchecked box with an empty field as unanswered', () => {
    expect(validateWeeklyBudget(false, '')).toBe('option_required')
    expect(validateWeeklyBudget(false, '   ')).toBe('option_required')
  })

  it('reports an amount outside the accepted range', () => {
    expect(validateWeeklyBudget(false, '0')).toBe('budget_range')
    expect(validateWeeklyBudget(false, '10001')).toBe('budget_range')
    expect(validateWeeklyBudget(false, '12.50')).toBe('budget_range')
  })

  it('passes an amount inside the accepted range', () => {
    expect(validateWeeklyBudget(false, '120')).toBeNull()
  })
})

describe('validateCookingBudgetStep', () => {
  it('reports both controls on a first-entry press, with no value chosen anywhere', () => {
    expect(validateCookingBudgetStep(null, false, '')).toEqual({
      cookingTimeError: 'option_required',
      budgetError: 'option_required',
      isValid: false
    })
  })

  it('reports the budget and the cooking time together rather than stopping at the first', () => {
    expect(validateCookingBudgetStep(null, false, '99999')).toEqual({
      cookingTimeError: 'option_required',
      budgetError: 'budget_range',
      isValid: false
    })
  })

  it('reports only the missing chip when the amount is fine', () => {
    expect(validateCookingBudgetStep(null, false, '120')).toEqual({
      cookingTimeError: 'option_required',
      budgetError: null,
      isValid: false
    })
  })

  it('reports only the amount when the chip is chosen', () => {
    expect(validateCookingBudgetStep(30, false, '0')).toEqual({
      cookingTimeError: null,
      budgetError: 'budget_range',
      isValid: false
    })
  })

  it('passes a chip plus an amount', () => {
    expect(validateCookingBudgetStep(30, false, '120')).toEqual({
      cookingTimeError: null,
      budgetError: null,
      isValid: true
    })
  })

  it('passes a chip plus the explicit no-budget answer', () => {
    expect(validateCookingBudgetStep(15, true, '')).toEqual({
      cookingTimeError: null,
      budgetError: null,
      isValid: true
    })
  })
})

describe('budgetFieldState', () => {
  it('dims the field once the no-preference box settles the answer', () => {
    expect(budgetFieldState(true, null)).toBe('disabled')
    expect(budgetFieldState(true, validateCookingBudgetStep(30, true, ''))).toBe('disabled')
  })

  it('errors the field for an amount outside the range', () => {
    expect(budgetFieldState(false, validateCookingBudgetStep(30, false, '0'))).toBe('error')
  })

  it('leaves the field plain before the first press', () => {
    expect(budgetFieldState(false, null)).toBe('default')
  })

  // An unanswered budget is reported on the option group, not by reddening an empty field.
  it('leaves an untouched field plain when the press reported it unanswered', () => {
    expect(budgetFieldState(false, validateCookingBudgetStep(30, false, ''))).toBe('default')
  })

  it('leaves the field plain once the amount is accepted', () => {
    expect(budgetFieldState(false, validateCookingBudgetStep(30, false, '120'))).toBe('default')
  })
})

describe('buildPlanSummaryRows', () => {
  describe('the card itself', () => {
    it('lists goal, diet and meals in the order frame 08 draws them', () => {
      const rows = buildPlanSummaryRows(makeDraft(ANSWERED_DRAFT, true))

      expect(rows.map(row => row.label)).toEqual(['Goal', 'Diet', 'Meals'])
      expect(valuesOf(rows)).toEqual(['Lose weight · 170 lb', 'No specific diet', '3 meals'])
    })

    it('renders the snack schedule as its own answer', () => {
      const rows = buildPlanSummaryRows(makeDraft({...ANSWERED_DRAFT, mealSchedule: 'three_plus_snack'}, true))

      expect(valuesOf(rows)).toContain('3 meals + 1 snack')
    })

    it('omits a row the user has not answered instead of inventing a value', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'gain', diet: 'vegan'}, true))

      expect(rows.map(row => row.label)).toEqual(['Goal', 'Diet'])
    })

    it('renders no rows at all before any question is answered', () => {
      expect(buildPlanSummaryRows(makeDraft())).toEqual([])
    })
  })

  describe('the goal row', () => {
    it('converts the stored kilograms for a pound user', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', goalWeightKg: GOAL_WEIGHT_KG, weightUnitPref: 'lb'}))

      expect(valuesOf(rows)).toEqual(['Lose weight · 170 lb'])
    })

    it('shows the stored kilograms to a kilogram user', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'gain', goalWeightKg: 82.6, weightUnitPref: 'kg'}))

      expect(valuesOf(rows)).toEqual(['Gain weight · 82.6 kg'])
    })

    it('rounds the converted weight to one decimal', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', goalWeightKg: 80, weightUnitPref: 'lb'}))

      expect(valuesOf(rows)).toEqual(['Lose weight · 176.4 lb'])
    })

    it('falls back to pounds when no unit preference has been recorded', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', goalWeightKg: GOAL_WEIGHT_KG}))

      expect(valuesOf(rows)).toEqual(['Lose weight · 170 lb'])
    })

    it('shows the goal alone when no goal weight was given, which is optional', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', weightUnitPref: 'lb'}))

      expect(valuesOf(rows)).toEqual(['Lose weight'])
    })

    // Maintain hides goal weight and pace on frame 02, so a weight left over from another goal
    // must not reappear here.
    it('shows maintain without a goal weight', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'maintain', goalWeightKg: GOAL_WEIGHT_KG}))

      expect(valuesOf(rows)).toEqual(['Maintain weight'])
    })

    it('shows the goal alone when the stored weight is not a finite number', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', goalWeightKg: Number.NaN}))

      expect(valuesOf(rows)).toEqual(['Lose weight'])
    })
  })

  describe('draft precedence over the saved preferences', () => {
    const saved = makeSource({
      goal: 'gain',
      goalWeightKg: 90,
      diet: 'vegetarian',
      mealSchedule: 'three_plus_snack',
      weightUnitPref: 'kg'
    })

    it('reads a saved answer for a step the draft has neither been seeded with nor edited', () => {
      const rows = buildPlanSummaryRows(makeDraft(), saved)

      expect(valuesOf(rows)).toEqual(['Gain weight · 90 kg', 'Vegetarian', '3 meals + 1 snack'])
    })

    it('prefers the draft answer over the saved one', () => {
      const rows = buildPlanSummaryRows(makeDraft({diet: 'vegan'}, false, {diet: true}), saved)

      expect(valuesOf(rows)).toContain('Vegan')
      expect(valuesOf(rows)).not.toContain('Vegetarian')
    })

    // The finding this test exists for: a goal weight the user cleared on frame 02 is an answer,
    // so a seeded draft's null must not be topped up from the value it replaced.
    it('keeps a goal weight cleared on a seeded draft cleared', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', goalWeightKg: null}, true), saved)

      expect(valuesOf(rows)).toEqual(['Lose weight'])
    })

    it('keeps a goal weight cleared on an edited goal step cleared, even before seeding', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose', goalWeightKg: null}, false, {goal: true}), saved)

      expect(rows[0]).toEqual({label: 'Goal', value: 'Lose weight'})
      expect(valuesOf(rows)).not.toContain('Lose weight · 90 kg')
    })

    it('treats every step of a seeded draft as answered, so no saved value can reappear', () => {
      expect(buildPlanSummaryRows(makeDraft({}, true), saved)).toEqual([])
    })

    it('resolves each step on its own rather than by whether any step was edited', () => {
      const rows = buildPlanSummaryRows(makeDraft({goal: 'lose'}, false, {goal: true}), saved)

      expect(valuesOf(rows)).toEqual(['Lose weight', 'Vegetarian', '3 meals + 1 snack'])
    })

    it('reads the saved unit for a weight the draft carries before the body step is answered', () => {
      const state = makeDraft({goal: 'lose', goalWeightKg: GOAL_WEIGHT_KG}, false, {goal: true})

      expect(buildPlanSummaryRows(state, saved)[0].value).toBe('Lose weight · 77.1 kg')
    })

    it('uses the draft unit once the body step has been edited', () => {
      const state = makeDraft({goal: 'lose', goalWeightKg: GOAL_WEIGHT_KG, weightUnitPref: 'lb'}, false, {
        goal: true,
        body: true
      })

      expect(buildPlanSummaryRows(state, saved)[0].value).toBe('Lose weight · 170 lb')
    })

    it('treats an absent edited-step map as nothing edited', () => {
      const rows = buildPlanSummaryRows({draft: makeSource(), seeded: false}, saved)

      expect(valuesOf(rows)).toEqual(['Gain weight · 90 kg', 'Vegetarian', '3 meals + 1 snack'])
    })

    it('mutates neither the draft nor the saved preferences it reads', () => {
      const state = makeDraft(ANSWERED_DRAFT, true, {goal: true})
      const savedSnapshot = {...saved}

      buildPlanSummaryRows(state, saved)

      expect(state.draft).toEqual(makeSource(ANSWERED_DRAFT))
      expect(saved).toEqual(savedSnapshot)
    })

    it('derives the same rows from the same input', () => {
      const state = makeDraft(ANSWERED_DRAFT, true)

      expect(buildPlanSummaryRows(state, saved)).toEqual(buildPlanSummaryRows(state, saved))
    })
  })
})

describe('cookingBudgetWizardProgress', () => {
  it('counts cooking and budget as the seventh of seven steps on the estimated route', () => {
    expect(cookingBudgetWizardProgress('estimated')).toEqual({step: 7, totalSteps: 7})
  })

  it('counts it as the sixth of six on the manual route, which skips the calculation-only activity step', () => {
    expect(cookingBudgetWizardProgress('manual')).toEqual({step: 6, totalSteps: 6})
  })

  it('counts the seven-step route before a target route has been chosen', () => {
    expect(cookingBudgetWizardProgress(null)).toEqual({step: 7, totalSteps: 7})
  })
})
