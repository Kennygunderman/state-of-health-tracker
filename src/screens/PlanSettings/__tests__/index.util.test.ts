import {AffectedMeal, MealPlanFlag, MealPlanSummary} from '@data/models/MealPlan'
import {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {NutritionTargets} from '@data/models/NutritionTargets'
import {Theme} from '@styles/theme'

import Screens from '@constants/screens'

import {regenerateSummaryValueColor} from '../index.styled'
import {
  buildPlanSettingsRows,
  buildRegenerateDialogBody,
  buildRegenerateSummaryRows,
  derivePlanSettingsBanner,
  earliestFlaggedDate,
  nextPlanAcknowledgementTarget,
  PlanSettingsRowKey,
  shouldRecalculateTargets,
  shouldShowUseForNextPlan
} from '../index.util'

const PLAN_START_DATE = '2026-07-05'
const PLAN_END_DATE = '2026-07-11'
const FLAGGED_DINNER_DATE = '2026-07-07'
const FLAGGED_LUNCH_DATE = '2026-07-09'
const LATER_FLAGGED_DATE = '2026-07-11'
const NOT_SET = 'Not set'

const UNMAPPED_SLOT = 'brunch' as unknown as AffectedMeal['slot']
const UNMAPPED_FLAG_CODE = 'nutrition' as unknown as MealPlanFlag['code']
const UNMAPPED_GOAL = 'shrink' as unknown as MealPlanPreferences['goal']

const makePreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
  setupStatus: 'completed',
  setupStep: 'review',
  reviewStartDate: PLAN_START_DATE,
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 4,
  goal: 'lose',
  goalWeightKg: 77,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 177.8,
  weightKg: 82.64,
  sexForEstimate: 'female',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'lightly_active',
  diet: 'vegetarian',
  allergens: ['milk', 'peanuts'],
  dislikedFoods: [
    {id: 'food-mushroom-white', name: 'Mushrooms', foodGroup: 'mushroom'},
    {id: 'food-olive-green', name: 'Olives', foodGroup: 'olive'}
  ],
  dislikedFoodGroups: ['mushroom', 'olive'],
  mealSchedule: 'three',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: null,
  noBudgetPreference: true,
  budgetTier: null,
  hasActivePlan: true,
  ...overrides
})

// Every answerable field unanswered: the seven rows still have to render, so this is the shape the
// 'Not set' assertions are written against.
const makeUnansweredPreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences =>
  makePreferences({
    setupStatus: 'not_started',
    setupStep: null,
    reviewStartDate: null,
    timeZone: null,
    targetRoute: null,
    revision: 0,
    goal: null,
    goalWeightKg: null,
    paceLbPerWeek: null,
    age: null,
    heightCm: null,
    weightKg: null,
    sexForEstimate: null,
    heightUnitPref: null,
    weightUnitPref: null,
    activityLevel: null,
    diet: null,
    allergens: [],
    dislikedFoods: [],
    dislikedFoodGroups: [],
    mealSchedule: null,
    mealTimes: [],
    cookingTimeLimitMin: null,
    budget: null,
    noBudgetPreference: false,
    budgetTier: null,
    hasActivePlan: false,
    ...overrides
  })

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 1,
  ...overrides
})

const makeAffectedMeal = (overrides: Partial<AffectedMeal> = {}): AffectedMeal => ({
  mealId: 'meal-1',
  date: FLAGGED_DINNER_DATE,
  slot: 'dinner',
  recipeName: 'Chicken burrito bowl',
  flags: [{code: 'allergen', detail: ['milk']}],
  ...overrides
})

const makeSummary = (overrides: Partial<MealPlanSummary> = {}): MealPlanSummary => ({
  plannedMeals: 21,
  groceryItemCount: 14,
  loggedEntryCount: 2,
  ...overrides
})

const rowValue = (
  preferences: MealPlanPreferences,
  key: PlanSettingsRowKey,
  targets: NutritionTargets | null = null
): string => {
  const row = buildPlanSettingsRows(preferences, targets).find(candidate => candidate.key === key)

  if (row === undefined) {
    throw new Error(`buildPlanSettingsRows rendered no '${key}' row`)
  }

  return row.value
}

describe('buildPlanSettingsRows', () => {
  describe('the row set', () => {
    it('renders exactly seven rows', () => {
      expect(buildPlanSettingsRows(makePreferences(), makeTargets())).toHaveLength(7)
    })

    it('renders the seven keys in the order the settings card draws them', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())

      expect(rows.map(row => row.key)).toEqual([
        'goalAndBody',
        'activityAndPace',
        'nutritionTargets',
        'dietAndAllergies',
        'dislikedIngredients',
        'mealSchedule',
        'cookingAndBudget'
      ])
    })

    it('labels the seven rows as the settings card names them', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())

      expect(rows.map(row => row.label)).toEqual([
        'Goal and body',
        'Activity and pace',
        'Nutrition targets',
        'Diet and allergies',
        'Disliked ingredients',
        'Meal schedule',
        'Cooking time and budget'
      ])
    })

    it('states every part of a complete profile', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())

      expect(rows.map(row => row.value)).toEqual([
        'Lose weight · 182.2 lb · 5\'10"',
        'Lightly active · Gradual',
        '1,940 kcal · 146P / 194C / 65F',
        'Vegetarian · Milk, Peanuts',
        'Mushrooms, Olives',
        '3 meals · 8:00 AM, 12:30 PM, 6:30 PM',
        '30 minutes · No budget preference'
      ])
    })
  })

  describe('goal and body', () => {
    it('reads the weight in pounds when the profile prefers lb', () => {
      expect(rowValue(makePreferences({weightUnitPref: 'lb'}), 'goalAndBody')).toBe('Lose weight · 182.2 lb · 5\'10"')
    })

    it('reads the weight in kilograms when the profile prefers kg', () => {
      expect(rowValue(makePreferences({weightUnitPref: 'kg'}), 'goalAndBody')).toBe('Lose weight · 82.6 kg · 5\'10"')
    })

    it('reads the height in feet and inches when the profile prefers ft_in', () => {
      expect(rowValue(makePreferences({heightUnitPref: 'ft_in'}), 'goalAndBody')).toBe(
        'Lose weight · 182.2 lb · 5\'10"'
      )
    })

    it('reads the height in centimetres when the profile prefers cm', () => {
      expect(rowValue(makePreferences({heightUnitPref: 'cm'}), 'goalAndBody')).toBe('Lose weight · 182.2 lb · 178 cm')
    })

    it('names a maintain goal', () => {
      expect(rowValue(makePreferences({goal: 'maintain'}), 'goalAndBody')).toBe('Maintain weight · 182.2 lb · 5\'10"')
    })

    it('names a gain goal', () => {
      expect(rowValue(makePreferences({goal: 'gain'}), 'goalAndBody')).toBe('Gain weight · 182.2 lb · 5\'10"')
    })

    it('leaves out a body figure that is not a finite number', () => {
      const preferences = makePreferences({weightKg: Number.NaN, heightCm: Number.POSITIVE_INFINITY})

      expect(rowValue(preferences, 'goalAndBody')).toBe('Lose weight')
    })

    it('states the body figures alone when the goal is unanswered', () => {
      expect(rowValue(makePreferences({goal: null}), 'goalAndBody')).toBe('182.2 lb · 5\'10"')
    })

    it('leaves out a goal code it has no label for rather than rendering it raw', () => {
      const value = rowValue(makePreferences({goal: UNMAPPED_GOAL}), 'goalAndBody')

      expect(value).toBe('182.2 lb · 5\'10"')
      expect(value).not.toContain('shrink')
    })
  })

  describe('activity and pace', () => {
    it('names a gentle pace', () => {
      expect(rowValue(makePreferences({paceLbPerWeek: 0.5}), 'activityAndPace')).toBe('Lightly active · Gentle')
    })

    it('names a gradual pace', () => {
      expect(rowValue(makePreferences({paceLbPerWeek: 1}), 'activityAndPace')).toBe('Lightly active · Gradual')
    })

    it('names a fast pace', () => {
      expect(rowValue(makePreferences({paceLbPerWeek: 1.5}), 'activityAndPace')).toBe('Lightly active · Fast')
    })

    it('states the activity level alone when no pace is set', () => {
      expect(rowValue(makePreferences({paceLbPerWeek: null}), 'activityAndPace')).toBe('Lightly active')
    })

    it('states the pace alone when the activity level is unanswered', () => {
      expect(rowValue(makePreferences({activityLevel: null}), 'activityAndPace')).toBe('Gradual')
    })
  })

  describe('nutrition targets', () => {
    it('states the calories and the macro triple of a complete target set', () => {
      expect(rowValue(makePreferences(), 'nutritionTargets', makeTargets())).toBe('1,940 kcal · 146P / 194C / 65F')
    })

    it('states the calories alone when the macro triple is incomplete', () => {
      const targets = makeTargets({
        targets: {calories: 1940, protein: null, carbs: null, fat: null},
        complete: false
      })

      expect(rowValue(makePreferences(), 'nutritionTargets', targets)).toBe('1,940 kcal')
    })

    it('reads Not set when no targets record exists', () => {
      expect(rowValue(makePreferences(), 'nutritionTargets', null)).toBe(NOT_SET)
    })

    it('reads Not set when the targets record carries no figures', () => {
      expect(rowValue(makePreferences(), 'nutritionTargets', makeTargets({targets: null, complete: false}))).toBe(
        NOT_SET
      )
    })
  })

  describe('diet and allergies', () => {
    it('lists the named allergens after the diet', () => {
      expect(rowValue(makePreferences(), 'dietAndAllergies')).toBe('Vegetarian · Milk, Peanuts')
    })

    it('states the explicit no-allergies answer as its own label', () => {
      expect(rowValue(makePreferences({allergens: ['none']}), 'dietAndAllergies')).toBe('Vegetarian · None')
    })

    it('states the diet alone when allergies are unanswered', () => {
      expect(rowValue(makePreferences({allergens: []}), 'dietAndAllergies')).toBe('Vegetarian')
    })

    it('drops the none sentinel when a named allergen sits beside it', () => {
      expect(rowValue(makePreferences({allergens: ['none', 'milk']}), 'dietAndAllergies')).toBe('Vegetarian · Milk')
    })

    it('ignores an allergen code it has no label for rather than rendering it raw', () => {
      const value = rowValue(makePreferences({allergens: ['mustard']}), 'dietAndAllergies')

      expect(value).toBe('Vegetarian')
      expect(value).not.toContain('mustard')
    })
  })

  describe('disliked ingredients', () => {
    it('lists the disliked foods by name', () => {
      expect(rowValue(makePreferences(), 'dislikedIngredients')).toBe('Mushrooms, Olives')
    })

    it('reads Not set when nothing is disliked', () => {
      expect(rowValue(makePreferences({dislikedFoods: []}), 'dislikedIngredients')).toBe(NOT_SET)
    })
  })

  describe('meal schedule', () => {
    it('states the three-meal schedule and its times', () => {
      expect(rowValue(makePreferences(), 'mealSchedule')).toBe('3 meals · 8:00 AM, 12:30 PM, 6:30 PM')
    })

    it('states the snack schedule and all four times', () => {
      const preferences = makePreferences({
        mealSchedule: 'three_plus_snack',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'snack', time: '15:30'},
          {slot: 'dinner', time: '18:30'}
        ]
      })

      expect(rowValue(preferences, 'mealSchedule')).toBe('3 meals + 1 snack · 8:00 AM, 12:30 PM, 3:30 PM, 6:30 PM')
    })

    it('keeps the saved slot order rather than sorting the times by the clock', () => {
      const preferences = makePreferences({
        mealSchedule: 'three_plus_snack',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'dinner', time: '18:30'},
          {slot: 'snack', time: '15:30'}
        ]
      })

      expect(rowValue(preferences, 'mealSchedule')).toBe('3 meals + 1 snack · 8:00 AM, 12:30 PM, 6:30 PM, 3:30 PM')
    })

    it('states the schedule alone when no times are saved', () => {
      expect(rowValue(makePreferences({mealTimes: []}), 'mealSchedule')).toBe('3 meals')
    })
  })

  describe('cooking time and budget', () => {
    it('states the no-budget preference after the cooking time', () => {
      expect(rowValue(makePreferences(), 'cookingAndBudget')).toBe('30 minutes · No budget preference')
    })

    it('states a weekly budget amount when one is set', () => {
      const preferences = makePreferences({budget: {amount: 120, currency: 'USD'}, noBudgetPreference: false})

      expect(rowValue(preferences, 'cookingAndBudget')).toBe('30 minutes · $120 per week')
    })

    it('states the cooking time alone when the budget is unanswered', () => {
      expect(rowValue(makePreferences({budget: null, noBudgetPreference: false}), 'cookingAndBudget')).toBe(
        '30 minutes'
      )
    })

    it('states the budget answer alone when the cooking time is unanswered', () => {
      expect(rowValue(makePreferences({cookingTimeLimitMin: null}), 'cookingAndBudget')).toBe('No budget preference')
    })
  })

  describe('an unanswered profile', () => {
    it('still renders seven rows', () => {
      expect(buildPlanSettingsRows(makeUnansweredPreferences(), null)).toHaveLength(7)
    })

    it('reads Not set in every row', () => {
      const rows = buildPlanSettingsRows(makeUnansweredPreferences(), null)

      expect(rows.map(row => row.value)).toEqual([NOT_SET, NOT_SET, NOT_SET, NOT_SET, NOT_SET, NOT_SET, NOT_SET])
    })

    it('never surfaces undefined or NaN as a row value', () => {
      const rows = buildPlanSettingsRows(makeUnansweredPreferences(), null)

      rows.forEach(row => {
        expect(row.value).not.toMatch(/undefined|NaN/)
      })
    })
  })

  describe('navigation', () => {
    it('opens each step row in edit mode, returning to settings, from the row', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())
      const stepTargets = rows.filter(row => row.key !== 'nutritionTargets').map(row => row.target)

      expect(stepTargets).toEqual([
        {route: Screens.MEAL_PLAN_GOAL, params: {mode: 'edit', returnTo: 'settings', origin: 'row'}},
        {route: Screens.MEAL_PLAN_ACTIVITY, params: {mode: 'edit', returnTo: 'settings', origin: 'row'}},
        {route: Screens.MEAL_PLAN_DIET, params: {mode: 'edit', returnTo: 'settings', origin: 'row'}},
        {route: Screens.MEAL_PLAN_FOOD_PREFERENCES, params: {mode: 'edit', returnTo: 'settings', origin: 'row'}},
        {route: Screens.MEAL_PLAN_SCHEDULE, params: {mode: 'edit', returnTo: 'settings', origin: 'row'}},
        {route: Screens.MEAL_PLAN_COOKING_BUDGET, params: {mode: 'edit', returnTo: 'settings', origin: 'row'}}
      ])
    })

    it('opens the nutrition targets row on the edit-targets screen with a stack return', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())
      const targetsRow = rows[2]

      expect(targetsRow.target).toEqual({
        route: Screens.MEAL_PLAN_EDIT_TARGETS,
        params: {mode: 'edit', returnTo: {kind: 'stack', route: 'settings'}}
      })
    })

    it('carries the step each destination saves under, and none for nutrition targets', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())

      expect(rows.map(row => row.editStep)).toEqual([
        'goal',
        'activity',
        null,
        'diet',
        'dislikes',
        'schedule',
        'cooking'
      ])
    })

    it('hands every row its own params object rather than one shared reference', () => {
      const rows = buildPlanSettingsRows(makePreferences(), makeTargets())

      expect(rows[0].target.params).not.toBe(rows[1].target.params)
      expect(rows[0].target.params).toEqual(rows[1].target.params)
    })
  })
})

describe('shouldRecalculateTargets', () => {
  it('invites no recalculation when there is no targets record', () => {
    expect(shouldRecalculateTargets(null)).toBe(false)
  })

  it('invites no recalculation when the targets record carries no figures', () => {
    expect(shouldRecalculateTargets(makeTargets({targets: null, complete: false, stale: true}))).toBe(false)
  })

  it('invites recalculation when the confirmed targets went stale', () => {
    expect(shouldRecalculateTargets(makeTargets({stale: true}))).toBe(true)
  })

  it('invites recalculation for targets written outside the planner', () => {
    expect(shouldRecalculateTargets(makeTargets({source: 'legacy'}))).toBe(true)
  })

  it('invites no recalculation for a fresh confirmed estimate', () => {
    expect(shouldRecalculateTargets(makeTargets())).toBe(false)
  })

  it('invites no recalculation for fresh manual targets', () => {
    expect(shouldRecalculateTargets(makeTargets({source: 'manual'}))).toBe(false)
  })
})

describe('shouldShowUseForNextPlan', () => {
  it('hides the control while the plan matches the saved preferences and targets', () => {
    expect(shouldShowUseForNextPlan({hasIncompatibilities: false, targetsStale: false})).toBe(false)
  })

  it('shows the control while the plan carries incompatibilities', () => {
    expect(shouldShowUseForNextPlan({hasIncompatibilities: true, targetsStale: false})).toBe(true)
  })

  it('shows the control while the plan outlived its targets', () => {
    expect(shouldShowUseForNextPlan({hasIncompatibilities: false, targetsStale: true})).toBe(true)
  })

  it('shows the control when both reasons hold at once', () => {
    expect(shouldShowUseForNextPlan({hasIncompatibilities: true, targetsStale: true})).toBe(true)
  })
})

describe('nextPlanAcknowledgementTarget', () => {
  it('resolves to the Meal Plan tab with no params', () => {
    expect(nextPlanAcknowledgementTarget()).toStrictEqual({route: Screens.MACROS, params: undefined})
  })

  it('carries a route and params and nothing else', () => {
    const target = nextPlanAcknowledgementTarget()

    expect(Object.keys(target).sort()).toEqual(['params', 'route'])
  })

  it('carries nothing resembling a mutation, a payload, a request or a revision', () => {
    const target = nextPlanAcknowledgementTarget()

    Object.keys(target).forEach(key => {
      expect(key).not.toMatch(/mutation|mutate|payload|request|revision|idempotenc|body/i)
    })
  })

  it('returns the same descriptor on every call, so it reads no state', () => {
    expect(nextPlanAcknowledgementTarget()).toStrictEqual(nextPlanAcknowledgementTarget())
  })
})

describe('derivePlanSettingsBanner', () => {
  describe('nothing to say', () => {
    it('omits the banner on a failed affected-meals query, flagged meals or not, leaving the rows to render', () => {
      expect(derivePlanSettingsBanner([makeAffectedMeal()], true)).toBeNull()
    })

    it('omits the banner while the affected meals are still unknown', () => {
      expect(derivePlanSettingsBanner(undefined, false)).toBeNull()
    })

    it('omits the banner when no meal is affected', () => {
      expect(derivePlanSettingsBanner([], false)).toBeNull()
    })

    it('omits the banner when the affected meals carry no flags', () => {
      expect(derivePlanSettingsBanner([makeAffectedMeal({flags: []})], false)).toBeNull()
    })
  })

  describe('a flagged set naming one reason', () => {
    it('names two allergen-flagged meals in one sentence', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal(),
          makeAffectedMeal({mealId: 'meal-2', date: FLAGGED_LUNCH_DATE, slot: 'lunch', recipeName: 'Cobb salad'})
        ],
        false
      )

      expect(banner).toEqual({
        title: '2 meals no longer match your diet',
        body: 'Tuesday dinner and Thursday lunch contain milk. They stay flagged until you swap them.',
        actionLabel: 'Review affected meals'
      })
    })

    it('joins three flagged meals with commas and one conjunction', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal(),
          makeAffectedMeal({mealId: 'meal-2', date: FLAGGED_LUNCH_DATE, slot: 'lunch', recipeName: 'Cobb salad'}),
          makeAffectedMeal({mealId: 'meal-3', date: LATER_FLAGGED_DATE, slot: 'breakfast', recipeName: 'Oat bowl'})
        ],
        false
      )

      expect(banner?.title).toBe('3 meals no longer match your diet')
      expect(banner?.body).toBe(
        'Tuesday dinner, Thursday lunch and Saturday breakfast contain milk. They stay flagged until you swap them.'
      )
    })

    it('names a single allergen-flagged meal in the singular', () => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal()], false)

      expect(banner).toEqual({
        title: '1 meal no longer matches your diet',
        body: 'Tuesday dinner contains milk. It stays flagged until you swap it.',
        actionLabel: 'Review affected meals'
      })
    })

    it('states a diet exclusion as the diet copy rather than the allergen copy', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'diet', detail: ['milk']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'diet', detail: ['milk']}]
          })
        ],
        false
      )

      expect(banner?.title).toBe('2 meals no longer match your diet')
      expect(banner?.body).toBe(
        'Tuesday dinner and Thursday lunch contain milk, which your diet excludes. They stay flagged until you swap them.'
      )
    })

    it('states a skipped ingredient as the dislike copy', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'dislike', detail: ['mushrooms']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal contains an ingredient you skip')
      expect(banner?.body).toBe(
        'Tuesday dinner contains mushrooms, which you asked us to skip. It stays flagged until you swap it.'
      )
    })

    it('states a cooking-time overrun as the cooking-time copy without naming the code', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'cooking_time', detail: ['30 minute']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal takes longer than your cooking time')
      expect(banner?.body).toBe(
        'Tuesday dinner takes longer than your 30 minute cooking time. It stays flagged until you swap it.'
      )
      expect(banner?.body).not.toContain('cooking_time')
    })

    it('never names the flag code in the sentence it renders', () => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal()], false)

      expect(banner?.body).not.toContain('allergen')
      expect(banner?.title).not.toContain('allergen')
    })
  })

  describe('a flagged set that can only be stated generically', () => {
    it('falls back to the mixed copy when the codes differ across meals', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal(),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'dislike', detail: ['mushrooms']}]
          })
        ],
        false
      )

      expect(banner).toEqual({
        title: '2 meals no longer match your preferences',
        body: 'Tuesday dinner and Thursday lunch no longer match your preferences. They stay flagged until you swap them.',
        actionLabel: 'Review affected meals'
      })
    })

    it('falls back to the mixed copy when a flag states no detail', () => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal({flags: [{code: 'allergen', detail: []}]})], false)

      expect(banner).toEqual({
        title: '1 meal no longer matches your preferences',
        body: 'Tuesday dinner no longer matches your preferences. It stays flagged until you swap it.',
        actionLabel: 'Review affected meals'
      })
    })

    it('falls back to the mixed copy for a flag code it has no copy for', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: UNMAPPED_FLAG_CODE, detail: ['sodium']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal no longer matches your preferences')
      expect(banner?.body).toBe(
        'Tuesday dinner no longer matches your preferences. It stays flagged until you swap it.'
      )
      expect(banner?.body).not.toContain('nutrition')
      expect(banner?.body).not.toContain('sodium')
    })
  })

  describe('the details it states', () => {
    it('states a detail shared by two meals once', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'allergen', detail: ['milk']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'allergen', detail: ['milk']}]
          })
        ],
        false
      )

      expect(banner?.body).toBe(
        'Tuesday dinner and Thursday lunch contain milk. They stay flagged until you swap them.'
      )
    })

    it('joins several distinct details in the order they were flagged', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'allergen', detail: ['milk', 'eggs']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'allergen', detail: ['milk']}]
          })
        ],
        false
      )

      expect(banner?.body).toBe(
        'Tuesday dinner and Thursday lunch contain milk, eggs. They stay flagged until you swap them.'
      )
    })
  })

  describe('a slot the sentence map does not name', () => {
    it('degrades the description to the weekday alone rather than naming the raw slot', () => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal({slot: UNMAPPED_SLOT})], false)

      expect(banner?.body).toBe('Tuesday contains milk. It stays flagged until you swap it.')
      expect(banner?.body).not.toContain('brunch')
    })
  })
})

describe('earliestFlaggedDate', () => {
  it('returns the earliest day key whatever order the meals arrive in', () => {
    const meals = [
      makeAffectedMeal({mealId: 'meal-2', date: FLAGGED_LUNCH_DATE}),
      makeAffectedMeal({mealId: 'meal-1', date: FLAGGED_DINNER_DATE}),
      makeAffectedMeal({mealId: 'meal-3', date: LATER_FLAGGED_DATE})
    ]

    expect(earliestFlaggedDate(meals)).toBe(FLAGGED_DINNER_DATE)
  })

  it('returns null when no meal is flagged', () => {
    expect(earliestFlaggedDate([])).toBeNull()
  })

  it('leaves the meals it was handed in their original order', () => {
    const meals = [
      makeAffectedMeal({mealId: 'meal-2', date: FLAGGED_LUNCH_DATE}),
      makeAffectedMeal({mealId: 'meal-1', date: FLAGGED_DINNER_DATE}),
      makeAffectedMeal({mealId: 'meal-3', date: LATER_FLAGGED_DATE})
    ]
    const order = meals.map(meal => meal.date)

    earliestFlaggedDate(meals)

    expect(meals.map(meal => meal.date)).toEqual(order)
  })
})

describe('buildRegenerateSummaryRows', () => {
  it('renders the three dialog rows in the order the dialog draws them', () => {
    const rows = buildRegenerateSummaryRows(makeSummary())

    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.label)).toEqual(['Planned meals', 'Grocery list', 'Logged food'])
  })

  it('binds every value to the plan summary', () => {
    const rows = buildRegenerateSummaryRows(makeSummary())

    expect(rows.map(row => row.value)).toEqual(['21 replaced', 'Rebuilt', '2 entries kept'])
  })

  it('reads an empty grocery list as no items rather than as rebuilt', () => {
    const rows = buildRegenerateSummaryRows(makeSummary({groceryItemCount: 0}))

    expect(rows.map(row => row.value)).toEqual(['21 replaced', 'No items', '2 entries kept'])
  })

  it('reads an empty diary as nothing logged yet', () => {
    const rows = buildRegenerateSummaryRows(makeSummary({loggedEntryCount: 0}))

    expect(rows[2].value).toBe('Nothing logged yet')
  })

  it('reads a single logged entry in the singular', () => {
    const rows = buildRegenerateSummaryRows(makeSummary({loggedEntryCount: 1}))

    expect(rows[2].value).toBe('1 entry kept')
  })

  it('reads an impossible negative count as nothing logged yet', () => {
    const rows = buildRegenerateSummaryRows(makeSummary({loggedEntryCount: -3}))

    expect(rows[2].value).toBe('Nothing logged yet')
  })

  it('accents the logged-food row alone', () => {
    const rows = buildRegenerateSummaryRows(makeSummary())

    expect(rows.map(row => row.tone)).toEqual(['default', 'default', 'accent'])
  })

  it('emits a tone and never a colour of its own', () => {
    const rows = buildRegenerateSummaryRows(makeSummary())

    expect(rows.every(row => !('valueColor' in row))).toBe(true)
    expect(JSON.stringify(rows)).not.toContain('#')
  })
})

describe('buildRegenerateDialogBody', () => {
  it('states the week the regeneration replaces', () => {
    expect(buildRegenerateDialogBody(PLAN_START_DATE, PLAN_END_DATE)).toBe(
      "Your planned meals and grocery list for Jul 5 to Jul 11 will change. Food you've already logged stays in your diary."
    )
  })

  it('spells the range out rather than abbreviating it with the plan header en dash', () => {
    const body = buildRegenerateDialogBody(PLAN_START_DATE, PLAN_END_DATE)

    expect(body).toContain('Jul 5 to Jul 11')
    expect(body).not.toContain('\u2013')
  })
})

describe('regenerateSummaryValueColor — the styled layer applying the tone the util emits', () => {
  it('resolves the accent tone to the accent-green token', () => {
    expect(regenerateSummaryValueColor('accent')).toBe(Theme.colors.accentGreen)
  })

  it('resolves the default tone to no colour, leaving SummaryRows its own', () => {
    expect(regenerateSummaryValueColor('default')).toBeUndefined()
  })
})
