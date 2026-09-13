import {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {NutritionTargetEstimate, NutritionTargets} from '@data/models/NutritionTargets'

import {
  MEAL_PLAN_ANSWER_DIET_LABEL,
  MEAL_PLAN_ANSWER_MEALS_LABEL,
  MEAL_PLAN_CHOSEN_TARGETS_OVERLINE,
  MEAL_PLAN_DAILY_TARGETS_OVERLINE,
  MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
  MEAL_PLAN_EDIT_LINK_TEXT,
  MEAL_PLAN_GENERATE_BUTTON_TEXT,
  MEAL_PLAN_GOAL_ROW_LABEL,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MAX_COOKING_TIME_ROW_LABEL,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL,
  MEAL_PLAN_RECALCULATE_LINK_TEXT,
  MEAL_PLAN_START_DATE_TODAY_LABEL,
  MEAL_PLAN_START_DATE_TOMORROW_LABEL,
  MEAL_PLAN_TARGETS_CAPTION,
  MEAL_PLAN_VALUE_NONE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL
} from '@constants/strings'

import {
  buildAnswerRows,
  GenerateSequencePlan,
  NO_TARGETS_REVISION,
  planGenerateSequence,
  resolveDisplayedTargets,
  resolveGenerateCtaState,
  resolveInitialStartDate,
  resolveStartDateStepState,
  StartDateStepState
} from '../index.util'

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 2100, protein: 150, carbs: 220, fat: 70},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 4,
  ...overrides
})

const makeEstimate = (overrides: Partial<NutritionTargetEstimate> = {}): NutritionTargetEstimate => ({
  source: 'estimated',
  estimateRevision: 9,
  inputs: {
    age: 34,
    heightCm: 178,
    weightKg: 82,
    sexForEstimate: 'male',
    activityLevel: 'active',
    goal: 'lose',
    paceLbPerWeek: 1
  },
  bmr: 1780,
  tdee: 2760,
  adjustment: -500,
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  clamped: false,
  clampReason: null,
  ...overrides
})

const makePreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
  setupStatus: 'ready_for_review',
  setupStep: 'review',
  reviewStartDate: '2026-07-04',
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 7,
  goal: 'lose',
  goalWeightKg: 75,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 178,
  weightKg: 82,
  sexForEstimate: 'male',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'active',
  diet: 'none',
  allergens: ['none'],
  dislikedFoods: [{id: 'food-1', name: 'Olives', foodGroup: 'Vegetables'}],
  dislikedFoodGroups: [],
  mealSchedule: 'three',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: {amount: 120, currency: 'USD'},
  noBudgetPreference: false,
  budgetTier: 2,
  hasActivePlan: false,
  ...overrides
})

const makePlan = (overrides: Partial<GenerateSequencePlan> = {}): GenerateSequencePlan => ({
  requiresTargetConfirmation: false,
  requiresStartDateSave: false,
  estimateRevision: 9,
  expectedTargetsRevision: 4,
  expectedPreferencesRevision: 7,
  blockedReason: null,
  ...overrides
})

describe('NO_TARGETS_REVISION', () => {
  it('is the revision a user with no preferences row carries', () => {
    expect(NO_TARGETS_REVISION).toBe(0)
  })
})

describe('planGenerateSequence', () => {
  it('asks for no confirmation when the targets are complete, non-legacy and fresh', () => {
    const plan = planGenerateSequence({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.blockedReason).toBeNull()
  })

  it('asks for no confirmation for a complete, fresh manual set', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({source: 'manual'}),
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.blockedReason).toBeNull()
  })

  it('asks for confirmation for stale, legacy, incomplete and absent targets', () => {
    const sequenceFor = (targets: NutritionTargets | null): boolean =>
      planGenerateSequence({
        targets,
        estimate: makeEstimate(),
        preferences: makePreferences(),
        startDate: '2026-07-04'
      }).requiresTargetConfirmation

    expect(sequenceFor(makeTargets({stale: true}))).toBe(true)
    expect(sequenceFor(makeTargets({source: 'legacy'}))).toBe(true)
    expect(sequenceFor(makeTargets({complete: false}))).toBe(true)
    expect(sequenceFor(null)).toBe(true)
  })

  it('blocks on an absent estimate only when confirmation is required', () => {
    const blocked = planGenerateSequence({
      targets: makeTargets({stale: true}),
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const withEstimate = planGenerateSequence({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const confirmed = planGenerateSequence({
      targets: makeTargets(),
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(blocked.blockedReason).toBe('estimate_unavailable')
    expect(withEstimate.blockedReason).toBeNull()
    expect(confirmed.blockedReason).toBeNull()
  })

  it('threads the estimate and revision inputs the caller must send with each save', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({revision: 6}),
      estimate: makeEstimate({estimateRevision: 12}),
      preferences: makePreferences({revision: 11}),
      startDate: '2026-07-04'
    })

    expect(plan.estimateRevision).toBe(12)
    expect(plan.expectedTargetsRevision).toBe(6)
    expect(plan.expectedPreferencesRevision).toBe(11)
  })

  it('carries no estimate revision and the no-targets revision for a first-time account', () => {
    const plan = planGenerateSequence({
      targets: null,
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.estimateRevision).toBeNull()
    expect(plan.expectedTargetsRevision).toBe(NO_TARGETS_REVISION)
  })

  it('saves the start date only when it differs from the persisted review date', () => {
    const startDateSaveFor = (reviewStartDate: string | null, startDate: string): boolean =>
      planGenerateSequence({
        targets: makeTargets(),
        estimate: makeEstimate(),
        preferences: makePreferences({reviewStartDate}),
        startDate
      }).requiresStartDateSave

    expect(startDateSaveFor('2026-07-04', '2026-07-10')).toBe(true)
    expect(startDateSaveFor(null, '2026-07-04')).toBe(true)
    expect(startDateSaveFor('2026-07-04', '2026-07-04')).toBe(false)
  })
})

describe('resolveDisplayedTargets', () => {
  it('shows confirmed server targets with an edit link and no recalculation figure', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display).toEqual({
      source: 'confirmed',
      cardLabel: MEAL_PLAN_DAILY_TARGETS_OVERLINE,
      calories: '2,100',
      unitLabel: MEAL_PLAN_KCAL_UNIT,
      macros: [
        {key: 'protein', label: MEAL_PLAN_MACRO_LABELS.protein, valueText: '150g'},
        {key: 'carbs', label: MEAL_PLAN_MACRO_LABELS.carbs, valueText: '220g'},
        {key: 'fat', label: MEAL_PLAN_MACRO_LABELS.fat, valueText: '70g'}
      ],
      caption: MEAL_PLAN_TARGETS_CAPTION,
      editLabel: MEAL_PLAN_EDIT_LINK_TEXT,
      freshEstimateCalories: null,
      missingTargetKeys: []
    })
  })

  it("reviews a complete legacy set as the user's own figures rather than the estimate", () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({source: 'legacy'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('current')
    expect(display.calories).toBe('2,100')
    expect(display.calories).not.toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g', '220g', '70g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.freshEstimateCalories).toBe('1,940')
  })

  it('states the calories of a calories-only legacy account and names no macros', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('current')
    expect(display.calories).toBe('1,900')
    expect(display.calories).not.toBe('1,940')
    expect(display.macros).toEqual([])
    expect(display.missingTargetKeys).toEqual(['protein', 'carbs', 'fat'])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.freshEstimateCalories).toBe('1,940')
  })

  it('renders no empty or nil text for a calories-only legacy account', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const rendered = [
      display.cardLabel,
      display.calories,
      display.unitLabel,
      display.caption,
      display.editLabel,
      ...display.macros.map(macro => macro.valueText)
    ]

    rendered.forEach(text => {
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/null|undefined/)
    })
  })

  it('keeps every saved macro of an incomplete set and names only the one the server lacks', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 2100, protein: 150, carbs: null, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('current')
    expect(display.calories).toBe('2,100')
    expect(display.macros).toEqual([
      {key: 'protein', label: MEAL_PLAN_MACRO_LABELS.protein, valueText: '150g'},
      {key: 'fat', label: MEAL_PLAN_MACRO_LABELS.fat, valueText: '70g'}
    ])
    expect(display.missingTargetKeys).toEqual(['carbs'])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.freshEstimateCalories).toBe('1,940')
  })

  it('borrows no estimate figure for any field of a partially saved set', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 2100, protein: 150, carbs: null, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.macros.map(macro => macro.valueText)).not.toContain('194g')
    expect(display.macros).toHaveLength(2)
  })

  it('reviews a single saved macro on its own', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: null, protein: 150, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('current')
    expect(display.calories).toBe('')
    expect(display.macros).toEqual([{key: 'protein', label: MEAL_PLAN_MACRO_LABELS.protein, valueText: '150g'}])
    expect(display.missingTargetKeys).toEqual(['calories', 'carbs', 'fat'])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.freshEstimateCalories).toBe('1,940')
  })

  it('keeps a stale confirmed set as the reviewed figures with the fresh estimate beside', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe('2,100')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g', '220g', '70g'])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.freshEstimateCalories).toBe('1,940')
  })

  it('lets the estimate supply the card when the account has no targets at all', () => {
    const display = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    expect(display.freshEstimateCalories).toBeNull()
  })

  it('lets the estimate supply the card when every target column is unset', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({targets: null, complete: false, source: null}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    expect(display.freshEstimateCalories).toBeNull()
  })

  it('keeps saved macros and reports the absent calorie target rather than showing the estimate as the headline', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: null, protein: 150, carbs: 220, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('current')
    expect(display.calories).toBe('')
    expect(display.calories).not.toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g', '220g', '70g'])
    expect(display.missingTargetKeys).toEqual(['calories'])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.freshEstimateCalories).toBe('1,940')
  })

  it('reports no figures when neither targets nor an estimate exist', () => {
    const display = resolveDisplayedTargets({
      targets: null,
      estimate: null,
      preferences: makePreferences()
    })

    expect(display.source).toBe('unavailable')
    expect(display.calories).toBe('')
    expect(display.macros).toEqual([])
    expect(display.missingTargetKeys).toEqual(['calories', 'protein', 'carbs', 'fat'])
    expect(display.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    expect(display.freshEstimateCalories).toBeNull()
  })

  it('labels the manual route distinctly from the estimated one', () => {
    const manualTargets = resolveDisplayedTargets({
      targets: makeTargets({source: 'manual'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const manualRoute = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences({targetRoute: 'manual'})
    })
    const estimatedRoute = resolveDisplayedTargets({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(MEAL_PLAN_CHOSEN_TARGETS_OVERLINE).not.toBe(MEAL_PLAN_DAILY_TARGETS_OVERLINE)
    expect(manualTargets.cardLabel).toBe(MEAL_PLAN_CHOSEN_TARGETS_OVERLINE)
    expect(manualRoute.cardLabel).toBe(MEAL_PLAN_CHOSEN_TARGETS_OVERLINE)
    expect(estimatedRoute.cardLabel).toBe(MEAL_PLAN_DAILY_TARGETS_OVERLINE)
  })
})

describe('buildAnswerRows', () => {
  it('builds exactly the six review rows, in order, each routed to its own step', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows).toHaveLength(6)
    expect(rows.map(row => row.key)).toEqual(['goal', 'diet', 'dislikes', 'meals', 'cookingTime', 'budget'])
    expect(rows.map(row => row.label)).toEqual([
      MEAL_PLAN_GOAL_ROW_LABEL,
      MEAL_PLAN_ANSWER_DIET_LABEL,
      MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
      MEAL_PLAN_ANSWER_MEALS_LABEL,
      MEAL_PLAN_MAX_COOKING_TIME_ROW_LABEL,
      MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL
    ])
    expect(rows.map(row => row.editStep)).toEqual(['goal', 'diet', 'dislikes', 'schedule', 'cooking', 'cooking'])
  })

  it('reads a losing goal back with its goal weight in pounds and its pace', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows[0].value).toBe('Lose weight · 165 lb · 1 lb a week')
  })

  it('reads a gaining goal back with a metric goal weight', () => {
    const rows = buildAnswerRows(
      makePreferences({goal: 'gain', goalWeightKg: 90, paceLbPerWeek: 0.5, weightUnitPref: 'kg'})
    )

    expect(rows[0].value).toBe('Gain weight · 90 kg · 0.5 lb a week')
  })

  it('omits the goal weight and pace when maintaining', () => {
    const rows = buildAnswerRows(makePreferences({goal: 'maintain'}))

    expect(rows[0].value).toBe('Maintain weight')
  })

  it('reads the explicit no-allergies answer beside the diet', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows[1].value).toBe('No specific diet · None')
  })

  it('names every selected allergen beside the diet', () => {
    const rows = buildAnswerRows(makePreferences({diet: 'vegetarian', allergens: ['milk', 'peanuts', 'sesame']}))

    expect(rows[1].value).toBe('Vegetarian · Milk, Peanuts, Sesame')
  })

  it('lists the disliked foods and falls to the shared none value when there are none', () => {
    const named = buildAnswerRows(
      makePreferences({
        dislikedFoods: [
          {id: 'food-1', name: 'Olives', foodGroup: 'Vegetables'},
          {id: 'food-2', name: 'Anchovies', foodGroup: 'Seafood'}
        ]
      })
    )
    const empty = buildAnswerRows(makePreferences({dislikedFoods: []}))

    expect(named[2].value).toBe('Olives, Anchovies')
    expect(empty[2].value).toBe(MEAL_PLAN_VALUE_NONE)
  })

  it('lists three meal times in slot order', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows[3].value).toBe('8:00 AM · 12:30 PM · 6:30 PM')
  })

  it('lists a mid-afternoon snack last rather than at its time of day', () => {
    const rows = buildAnswerRows(
      makePreferences({
        mealSchedule: 'three_plus_snack',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'snack', time: '15:30'},
          {slot: 'dinner', time: '18:30'}
        ]
      })
    )

    expect(rows[3].value).toBe('8:00 AM · 12:30 PM · 6:30 PM · 3:30 PM')
  })

  it('reads the cooking limit and both budget answers back', () => {
    const amount = buildAnswerRows(makePreferences())
    const noPreference = buildAnswerRows(makePreferences({budget: null, noBudgetPreference: true}))

    expect(amount[4].value).toBe('30 minutes')
    expect(amount[5].value).toBe('$120 per week')
    expect(noPreference[5].value).toBe(MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL)
  })

  it('renders no empty or nil value for an account that answered nothing', () => {
    const rows = buildAnswerRows(
      makePreferences({
        goal: null,
        goalWeightKg: null,
        paceLbPerWeek: null,
        weightUnitPref: null,
        diet: null,
        allergens: [],
        dislikedFoods: [],
        mealSchedule: null,
        mealTimes: [],
        cookingTimeLimitMin: null,
        budget: null,
        noBudgetPreference: false
      })
    )

    expect(rows).toHaveLength(6)

    rows.forEach(row => {
      expect(row.value.length).toBeGreaterThan(0)
      expect(row.value).not.toMatch(/null|undefined/)
    })
  })
})

describe('resolveInitialStartDate', () => {
  const now = new Date(2026, 6, 3, 12, 0, 0)

  const initialStartDate = (
    reviewStartDate: string | null,
    paramStartDate: string | null,
    activePlanEndDate: string | null = null
  ): string => resolveInitialStartDate({reviewStartDate, paramStartDate, now, activePlanEndDate})

  it('prefers the route param over the persisted review date', () => {
    expect(initialStartDate('2026-07-06', '2026-07-10')).toBe('2026-07-10')
  })

  it('falls back to the persisted review date when no param was passed', () => {
    expect(initialStartDate('2026-07-06', null)).toBe('2026-07-06')
  })

  it('defaults to tomorrow when neither a param nor a persisted date exists', () => {
    expect(initialStartDate(null, null)).toBe('2026-07-04')
  })

  it('clamps a persisted date that has since passed forward to today', () => {
    expect(initialStartDate('2026-06-20', null)).toBe('2026-07-03')
  })

  it('clamps a param beyond the horizon back to the last selectable day', () => {
    expect(initialStartDate(null, '2026-09-01')).toBe('2026-08-02')
  })

  it('admits the successor week of an active plan that ends past the horizon', () => {
    expect(initialStartDate(null, '2026-08-21', '2026-08-20')).toBe('2026-08-21')
  })
})

describe('resolveStartDateStepState', () => {
  const now = new Date(2026, 6, 3, 12, 0, 0)

  const stepState = (startDate: string, activePlanEndDate: string | null = null): StartDateStepState =>
    resolveStartDateStepState({startDate, now, activePlanEndDate})

  it('bounds the stepper at today, tomorrow and thirty days ahead', () => {
    expect(stepState('2026-07-04').bounds).toEqual({min: '2026-07-03', default: '2026-07-04', max: '2026-08-02'})
  })

  it('refuses to step back from the first reachable day', () => {
    expect(stepState('2026-07-03').canStepBack).toBe(false)
    expect(stepState('2026-07-04').canStepBack).toBe(true)
  })

  it('refuses to step forward from the last reachable day', () => {
    expect(stepState('2026-08-02').canStepForward).toBe(false)
    expect(stepState('2026-08-01').canStepForward).toBe(true)
  })

  it('extends the forward bound to the day after an active plan ends', () => {
    expect(stepState('2026-08-02', '2026-08-20').bounds.max).toBe('2026-08-21')
    expect(stepState('2026-08-02', '2026-08-20').canStepForward).toBe(true)
    expect(stepState('2026-08-21', '2026-08-20').canStepForward).toBe(false)
  })

  it('names the first two reachable days and dates every later one', () => {
    expect(stepState('2026-07-03').dayLabel).toBe(MEAL_PLAN_START_DATE_TODAY_LABEL)
    expect(stepState('2026-07-04').dayLabel).toBe(MEAL_PLAN_START_DATE_TOMORROW_LABEL)
    expect(stepState('2026-08-02').dayLabel).toBe('Aug 2')
  })

  it('reads the chosen day beside the week it plans', () => {
    const state = stepState('2026-07-04')

    expect(state.rangeText).toBe(
      `${MEAL_PLAN_START_DATE_TOMORROW_LABEL}${MEAL_PLAN_VALUE_SEPARATOR}Jul 4 \u2013 Jul 10`
    )
  })
})

describe('resolveGenerateCtaState', () => {
  it('offers a live Generate when nothing is pending or loading', () => {
    const cta = resolveGenerateCtaState({plan: makePlan(), isEstimateLoading: false, isPending: false})

    expect(cta).toEqual({label: MEAL_PLAN_GENERATE_BUTTON_TEXT, isEnabled: true, action: 'generate'})
  })

  it('disables the CTA while the press is pending', () => {
    const cta = resolveGenerateCtaState({plan: makePlan(), isEstimateLoading: false, isPending: true})

    expect(cta.isEnabled).toBe(false)
  })

  it('waits for a loading estimate only when the targets still need confirming', () => {
    const unconfirmed = resolveGenerateCtaState({
      plan: makePlan({requiresTargetConfirmation: true}),
      isEstimateLoading: true,
      isPending: false
    })
    const confirmed = resolveGenerateCtaState({plan: makePlan(), isEstimateLoading: true, isPending: false})

    expect(unconfirmed.isEnabled).toBe(false)
    expect(confirmed.isEnabled).toBe(true)
  })

  it('stays live once the estimate settles unavailable and carries the press to manual targets', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({stale: true}),
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const cta = resolveGenerateCtaState({plan, isEstimateLoading: false, isPending: false})

    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(cta.isEnabled).toBe(true)
    expect(cta.action).toBe('manual_targets')
    expect(cta.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('generates when the sequence is not blocked', () => {
    const cta = resolveGenerateCtaState({
      plan: makePlan({requiresTargetConfirmation: true}),
      isEstimateLoading: false,
      isPending: false
    })

    expect(cta.action).toBe('generate')
    expect(cta.isEnabled).toBe(true)
  })
})
