import {AffectedMeal, MealPlanFlag, MealPlanSummary} from '@data/models/MealPlan'
import {MealPlanPreferences, MealPlanPreferencesSaveResult} from '@data/models/MealPlanPreferences'
import {NutritionTargets} from '@data/models/NutritionTargets'
import {
  buildPendingIntent,
  IntentsHydration,
  MealPlanStore,
  PendingIntent,
  PENDING_INTENT_TTL_MS
} from '@store/mealPlan/useMealPlanStore'
import {Theme} from '@styles/theme'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {matchesFingerprint, RegenerateRequestSnapshot} from '@utility/IdempotencyUtility'
import {RoutesMissingError} from '@utility/MealPlanEntitlementUtility'

import Screens from '@constants/screens'

import {regenerateSummaryValueColor} from '../index.styled'
import {
  buildPlanSettingsRows,
  buildRegenerateDialogBody,
  buildRegenerateSummaryRows,
  canSubmitRegeneration,
  derivePlanSettingsBanner,
  deriveRegenerateConfirmState,
  earliestFlaggedDate,
  nextPlanAcknowledgementTarget,
  PlanSettingsRowKey,
  reconcilePreferencesTimeZone,
  RegenerateConfirmReason,
  RegenerateConfirmState,
  RegenerateLatchEvent,
  RegenerateLaunchInput,
  RegeneratePlanPin,
  resolvePlanSettingsReadState,
  resolveRegenerateLatch,
  resolveRegenerateLaunch,
  shouldRecalculateTargets,
  shouldShowUseForNextPlan,
  TimeZoneReconciliationRequest
} from '../index.util'

// Mocking the persist adapter keeps the suite free of native modules: `index.util` imports the store module
// for its pure replay API, and importing that module creates the persisted store.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

const PLAN_START_DATE = '2026-07-05'
const PLAN_END_DATE = '2026-07-11'
const FLAGGED_DINNER_DATE = '2026-07-07'
const FLAGGED_LUNCH_DATE = '2026-07-09'
const LATER_FLAGGED_DATE = '2026-07-11'
const NOT_SET = 'Not set'

const UNMAPPED_SLOT = 'brunch' as unknown as AffectedMeal['slot']
const UNMAPPED_FLAG_CODE = 'nutrition' as unknown as MealPlanFlag['code']
const UNMAPPED_GOAL = 'shrink' as unknown as MealPlanPreferences['goal']

// An ordinary unknown code and the Object.prototype member names beside it: a settings row has to read the two
// the same way. The casts model a server that sent a code the narrow union does not contain; allergens need no
// cast, since the model types them as plain strings.
const UNKNOWN_ALLERGEN_CODE = 'unobtainium'
const PROTOTYPE_ALLERGEN_CODES = ['constructor', 'toString', '__proto__', 'valueOf']
const PROTOTYPE_GOAL = 'toString' as unknown as MealPlanPreferences['goal']
const PROTOTYPE_DIET = 'constructor' as unknown as MealPlanPreferences['diet']
const PROTOTYPE_ACTIVITY_LEVEL = 'valueOf' as unknown as MealPlanPreferences['activityLevel']
const PROTOTYPE_MEAL_SCHEDULE = 'hasOwnProperty' as unknown as MealPlanPreferences['mealSchedule']
const PROTOTYPE_SLOT = 'valueOf' as unknown as AffectedMeal['slot']
const PROTOTYPE_FLAG_CODE = 'toString' as unknown as MealPlanFlag['code']
const INHERITED_MEMBER_TEXT = /function|\[object|native code/i

// The copy a banner degrades to when its details state nothing the user can act on.
const GENERIC_SINGULAR_TITLE = '1 meal no longer matches your preferences'
const GENERIC_SINGULAR_BODY = 'Tuesday dinner no longer matches your preferences. It stays flagged until you swap it.'

// Details an unguarded record lookup would resolve to an inherited function or object.
const PROTOTYPE_DETAIL_KEYS = ['constructor', '__proto__', 'toString']

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

  describe('a code named after an Object.prototype member', () => {
    it('treats prototype-named allergen codes exactly like a code it has no label for', () => {
      const prototypeNamed = rowValue(makePreferences({allergens: PROTOTYPE_ALLERGEN_CODES}), 'dietAndAllergies')
      const unknown = rowValue(makePreferences({allergens: [UNKNOWN_ALLERGEN_CODE]}), 'dietAndAllergies')

      expect(prototypeNamed).toBe(unknown)
      expect(prototypeNamed).toBe('Vegetarian')
      expect(prototypeNamed).not.toMatch(INHERITED_MEMBER_TEXT)
    })

    it('reads Not set in every row of a profile whose every mapped code is prototype-named', () => {
      const rows = buildPlanSettingsRows(
        makeUnansweredPreferences({
          goal: PROTOTYPE_GOAL,
          activityLevel: PROTOTYPE_ACTIVITY_LEVEL,
          diet: PROTOTYPE_DIET,
          mealSchedule: PROTOTYPE_MEAL_SCHEDULE,
          allergens: PROTOTYPE_ALLERGEN_CODES
        }),
        null
      )

      expect(rows).toHaveLength(7)

      rows.forEach(row => {
        expect(row.value).toBe(NOT_SET)
        expect(row.value).not.toMatch(INHERITED_MEMBER_TEXT)
      })
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

    // The server sends the allergen code from the user's saved list, so 'tree_nuts' is the payload and
    // 'tree nuts' is the only form a sentence can carry.
    it('states an allergen code as the words the sentence needs', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'allergen', detail: ['tree_nuts']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal no longer matches your diet')
      expect(banner?.body).toBe('Tuesday dinner contains tree nuts. It stays flagged until you swap it.')
      expect(banner?.body).not.toContain('tree_nuts')
      expect(banner?.body).not.toContain('_')
    })

    // 'diet' carries the user's own diet code, not an ingredient: the sentence names the diet the meal fails.
    it('states a diet exclusion as the diet copy rather than as something the meal contains', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'diet', detail: ['vegetarian']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'diet', detail: ['vegetarian']}]
          })
        ],
        false
      )

      expect(banner?.title).toBe('2 meals no longer match your diet')
      expect(banner?.body).toBe(
        "Tuesday dinner and Thursday lunch don't fit your vegetarian diet. They stay flagged until you swap them."
      )
      expect(banner?.body).not.toContain('contains vegetarian')
      expect(banner?.body).not.toContain('contain vegetarian')
    })

    it('states a single diet-flagged meal in the singular', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'diet', detail: ['pescatarian']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal no longer matches your diet')
      expect(banner?.body).toBe("Tuesday dinner doesn't fit your pescatarian diet. It stays flagged until you swap it.")
    })

    // 'dislike' is the one detail that arrives as display text: an ingredient name is stated as sent.
    it('states a skipped ingredient as the dislike copy', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'dislike', detail: ['Mushrooms']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal contains an ingredient you skip')
      expect(banner?.body).toBe(
        'Tuesday dinner contains Mushrooms, which you asked us to skip. It stays flagged until you swap it.'
      )
    })

    // 'cooking_time' carries the recipe's own duration as a bare number, so the sentence states that duration
    // rather than presenting it as the user's limit.
    it('states a cooking-time overrun as the meal duration the server sent', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'cooking_time', detail: ['45']}]})],
        false
      )

      expect(banner?.title).toBe('1 meal takes longer than your cooking time')
      expect(banner?.body).toBe(
        'Tuesday dinner takes 45 minutes, longer than your cooking time. It stays flagged until you swap it.'
      )
      expect(banner?.body).not.toContain('cooking_time')
      expect(banner?.body).not.toContain('your 45')
    })

    it('states the longest duration when several meals run over', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'cooking_time', detail: ['45']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'cooking_time', detail: ['60']}]
          })
        ],
        false
      )

      expect(banner?.title).toBe('2 meals take longer than your cooking time')
      expect(banner?.body).toBe(
        'Tuesday dinner and Thursday lunch take up to 60 minutes, longer than your cooking time. They stay flagged until you swap them.'
      )
      expect(banner?.body).not.toContain('45')
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

    it('falls back to the mixed copy for a prototype-named flag code rather than inheriting a member', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: PROTOTYPE_FLAG_CODE, detail: ['sodium']}]})],
        false
      )

      expect(typeof banner?.title).toBe('string')
      expect(typeof banner?.body).toBe('string')
      expect(banner?.title).toBe('1 meal no longer matches your preferences')
      expect(banner?.body).toBe(
        'Tuesday dinner no longer matches your preferences. It stays flagged until you swap it.'
      )
      expect(banner?.body).not.toMatch(INHERITED_MEMBER_TEXT)
    })

    // An allergen a newer server release names, which this app has no wording for: the generic copy claims
    // nothing about it, where the code itself would have named a machine token in the sentence.
    it('falls back to the mixed copy for an allergen code it has no wording for', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'allergen', detail: ['mustard']}]})],
        false
      )

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain('mustard')
    })

    // 'none' is the no-specific-diet answer, which excludes nothing: there is no true diet sentence to write.
    it('falls back to the mixed copy for a diet detail that excludes nothing', () => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal({flags: [{code: 'diet', detail: ['none']}]})], false)

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain("doesn't fit")
      expect(banner?.body).not.toContain('No specific diet')
    })

    it('falls back to the mixed copy for a cooking time that is not a number of minutes', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'cooking_time', detail: ['soon']}]})],
        false
      )

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain('soon')
      expect(banner?.body).not.toContain('minutes')
    })

    it.each(PROTOTYPE_DETAIL_KEYS)('never resolves the inherited member %s an allergen detail names', key => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal({flags: [{code: 'allergen', detail: [key]}]})], false)

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain(key)
      expect(banner?.body).not.toContain('function')
      expect(banner?.body).not.toContain('[object Object]')
    })

    it.each(PROTOTYPE_DETAIL_KEYS)('never resolves the inherited member %s a diet detail names', key => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal({flags: [{code: 'diet', detail: [key]}]})], false)

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain(key)
      expect(banner?.body).not.toContain('function')
      expect(banner?.body).not.toContain('[object Object]')
    })

    // The banner states one reason for every meal it lists, so a detail it cannot state is not a detail to
    // drop: naming only the recognised half would have the sentence claim to say what the meals contain while
    // saying less, and a user who swaps for the named allergen would meet the one that was discarded.
    it('falls back to the mixed copy when one of two same-reason meals names an allergen it has no wording for', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'allergen', detail: ['mustard']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'allergen', detail: ['milk']}]
          })
        ],
        false
      )

      expect(banner?.title).toBe('2 meals no longer match your preferences')
      expect(banner?.body).toBe(
        'Tuesday dinner and Thursday lunch no longer match your preferences. They stay flagged until you swap them.'
      )
      expect(banner?.body).not.toContain('milk')
      expect(banner?.body).not.toContain('mustard')
    })

    it('falls back to the mixed copy when one flag names a recognised allergen beside an unknown one', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'allergen', detail: ['milk', 'mustard']}]})],
        false
      )

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain('milk')
      expect(banner?.body).not.toContain('mustard')
    })

    it('falls back to the mixed copy when one of two same-reason meals states no detail at all', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'allergen', detail: ['milk']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'allergen', detail: []}]
          })
        ],
        false
      )

      expect(banner?.title).toBe('2 meals no longer match your preferences')
      expect(banner?.body).not.toContain('milk')
    })

    // 'up to 45 minutes' would understate a set whose other duration is unknown, so an unreadable one takes
    // the whole banner to the generic copy rather than the longest of what happened to parse.
    it('falls back to the mixed copy when a readable duration arrives beside an unreadable one', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({flags: [{code: 'cooking_time', detail: ['45']}]}),
          makeAffectedMeal({
            mealId: 'meal-2',
            date: FLAGGED_LUNCH_DATE,
            slot: 'lunch',
            flags: [{code: 'cooking_time', detail: ['soon']}]
          })
        ],
        false
      )

      expect(banner?.title).toBe('2 meals no longer match your preferences')
      expect(banner?.body).not.toContain('45')
      expect(banner?.body).not.toContain('minutes')
      expect(banner?.body).not.toContain('soon')
    })

    it('falls back to the mixed copy when a named ingredient arrives beside a blank one', () => {
      const banner = derivePlanSettingsBanner(
        [makeAffectedMeal({flags: [{code: 'dislike', detail: ['Mushrooms', '   ']}]})],
        false
      )

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain('Mushrooms')
    })

    // Two codes on one meal: neither detail reaches the sentence, because the generic copy that a set of
    // differing codes earns has no claim for either of them to fill.
    it('states no detail when one meal carries flags of two codes', () => {
      const banner = derivePlanSettingsBanner(
        [
          makeAffectedMeal({
            flags: [
              {code: 'allergen', detail: ['milk']},
              {code: 'cooking_time', detail: ['45']}
            ]
          })
        ],
        false
      )

      expect(banner?.title).toBe(GENERIC_SINGULAR_TITLE)
      expect(banner?.body).toBe(GENERIC_SINGULAR_BODY)
      expect(banner?.body).not.toContain('milk')
      expect(banner?.body).not.toContain('45')
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

    it('degrades a prototype-named slot to the weekday alone rather than naming an inherited member', () => {
      const banner = derivePlanSettingsBanner([makeAffectedMeal({slot: PROTOTYPE_SLOT})], false)

      expect(banner?.body).toBe('Tuesday contains milk. It stays flagged until you swap it.')
      expect(banner?.body).not.toMatch(INHERITED_MEMBER_TEXT)
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

const REGENERATE_USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'
const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const PLAN_REVISION = 3
const PREFERENCES_REVISION = 4
const TARGETS_REVISION = 2
const LAUNCHED_AT = 1_760_000_000_000
const STORED_KEY = 'key-of-the-unresolved-regeneration'
const FRESH_KEY = 'key-minted-by-this-press'

const REGENERATE_PLAN_PIN: RegeneratePlanPin = {
  id: PLAN_ID,
  revision: PLAN_REVISION,
  startDate: PLAN_START_DATE
}

const makeRegenerateRequest = (overrides: Partial<RegenerateRequestSnapshot> = {}): RegenerateRequestSnapshot => ({
  action: 'regenerate',
  planId: PLAN_ID,
  expectedPlanRevision: PLAN_REVISION,
  expectedPreferencesRevision: PREFERENCES_REVISION,
  expectedTargetsRevision: TARGETS_REVISION,
  ...overrides
})

const makeLaunchInput = (overrides: Partial<RegenerateLaunchInput> = {}): RegenerateLaunchInput => ({
  isLaunchLatched: false,
  hasHydratedIntents: true,
  state: {pendingIntents: {}},
  plan: REGENERATE_PLAN_PIN,
  expectedPreferencesRevision: PREFERENCES_REVISION,
  expectedTargetsRevision: TARGETS_REVISION,
  userId: REGENERATE_USER_ID,
  attemptedAt: LAUNCHED_AT,
  mintFreshKey: () => FRESH_KEY,
  ...overrides
})

const stateWith = (intent: PendingIntent): Pick<MealPlanStore, 'pendingIntents'> => ({
  pendingIntents: {regenerate: intent}
})

// The record an earlier confirmation left behind: minted a minute ago, for this account, and never answered.
const unresolvedIntent = (
  request: RegenerateRequestSnapshot = makeRegenerateRequest(),
  userId: string = REGENERATE_USER_ID,
  createdAt: number = LAUNCHED_AT - 60_000
): PendingIntent => buildPendingIntent(request, STORED_KEY, userId, createdAt)

describe('resolveRegenerateLaunch — which key a confirmed regeneration launches under', () => {
  it('mints and records a key when no regeneration is unresolved', () => {
    const decision = resolveRegenerateLaunch(makeLaunchInput())

    expect(decision).toMatchObject({kind: 'launch', idempotencyKey: FRESH_KEY, isReplay: false})
  })

  it('records the request it launches, so the stored fingerprint is the one the generating screen rebuilds', () => {
    const decision = resolveRegenerateLaunch(makeLaunchInput())

    if (decision.kind !== 'launch' || decision.intent === null) {
      throw new Error('expected a launch carrying a record')
    }

    expect(decision.intent.key).toBe(FRESH_KEY)
    expect(decision.intent.userId).toBe(REGENERATE_USER_ID)
    expect(decision.intent.createdAt).toBe(LAUNCHED_AT)
    expect(decision.intent.request).toEqual(decision.request)
    expect(matchesFingerprint(decision.request, decision.intent.fingerprint)).toBe(true)
  })

  it('pins the three revisions the plan and the two reads answered with', () => {
    const decision = resolveRegenerateLaunch(makeLaunchInput())

    expect(decision).toMatchObject({
      kind: 'launch',
      request: {
        action: 'regenerate',
        planId: PLAN_ID,
        expectedPlanRevision: PLAN_REVISION,
        expectedPreferencesRevision: PREFERENCES_REVISION,
        expectedTargetsRevision: TARGETS_REVISION
      }
    })
  })

  it('dispatches the generating screen with the launched key and the launched request', () => {
    const decision = resolveRegenerateLaunch(makeLaunchInput())

    if (decision.kind !== 'launch') {
      throw new Error('expected a launch')
    }

    expect(decision.params).toEqual({
      context: {kind: 'regenerate', planId: PLAN_ID, planRevision: PLAN_REVISION},
      idempotencyKey: FRESH_KEY,
      expectedPreferencesRevision: PREFERENCES_REVISION,
      expectedTargetsRevision: TARGETS_REVISION,
      startDate: PLAN_START_DATE
    })
  })

  it('replays the stored key rather than minting when the same regeneration is unresolved', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)

    const decision = resolveRegenerateLaunch(makeLaunchInput({state: stateWith(unresolvedIntent()), mintFreshKey}))

    expect(decision).toMatchObject({kind: 'launch', idempotencyKey: STORED_KEY, isReplay: true})
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it('keeps the stored key and the stored request when the plan revision has moved since it was minted', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)
    const stored = makeRegenerateRequest({expectedPlanRevision: PLAN_REVISION - 1})

    const decision = resolveRegenerateLaunch(
      makeLaunchInput({state: stateWith(unresolvedIntent(stored)), mintFreshKey})
    )

    if (decision.kind !== 'launch') {
      throw new Error('expected a launch')
    }

    expect(decision.idempotencyKey).toBe(STORED_KEY)
    expect(decision.isReplay).toBe(true)
    expect(decision.request).toEqual(stored)
    expect(decision.params.context).toEqual({
      kind: 'regenerate',
      planId: PLAN_ID,
      planRevision: PLAN_REVISION - 1
    })
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it('keeps the stored key and the stored request when the preference and target pins have moved', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)
    const stored = makeRegenerateRequest({
      expectedPreferencesRevision: PREFERENCES_REVISION - 1,
      expectedTargetsRevision: TARGETS_REVISION - 1
    })

    const decision = resolveRegenerateLaunch(
      makeLaunchInput({state: stateWith(unresolvedIntent(stored)), mintFreshKey})
    )

    if (decision.kind !== 'launch') {
      throw new Error('expected a launch')
    }

    expect(decision.idempotencyKey).toBe(STORED_KEY)
    expect(decision.request).toEqual(stored)
    expect(decision.params.expectedPreferencesRevision).toBe(PREFERENCES_REVISION - 1)
    expect(decision.params.expectedTargetsRevision).toBe(TARGETS_REVISION - 1)
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it('restates the unresolved record without extending the seven days it may be replayed for', () => {
    const intent = unresolvedIntent()

    const decision = resolveRegenerateLaunch(makeLaunchInput({state: stateWith(intent)}))

    if (decision.kind !== 'launch' || decision.intent === null) {
      throw new Error('expected a launch carrying a record')
    }

    expect(decision.intent).toEqual(intent)
    expect(decision.intent.createdAt).toBe(intent.createdAt)
  })

  it('hands an unresolved regeneration of another plan to the plan tab rather than recording over it', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)
    const intent = unresolvedIntent(makeRegenerateRequest({planId: OTHER_PLAN_ID}))

    const decision = resolveRegenerateLaunch(makeLaunchInput({state: stateWith(intent), mintFreshKey}))

    expect(decision).toEqual({kind: 'handOff', intent})
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it('mints again once the age guard has retired the unresolved record', () => {
    const expired = unresolvedIntent(makeRegenerateRequest(), REGENERATE_USER_ID, LAUNCHED_AT - PENDING_INTENT_TTL_MS)

    const decision = resolveRegenerateLaunch(makeLaunchInput({state: stateWith(expired)}))

    expect(decision).toMatchObject({kind: 'launch', idempotencyKey: FRESH_KEY, isReplay: false})
  })

  it('never replays a key minted by another account', () => {
    const decision = resolveRegenerateLaunch(
      makeLaunchInput({state: stateWith(unresolvedIntent(makeRegenerateRequest(), OTHER_USER_ID))})
    )

    expect(decision).toMatchObject({kind: 'launch', idempotencyKey: FRESH_KEY, isReplay: false})
  })

  it('mints rather than replaying a stored record that disagrees with its own request', () => {
    const corrupt: PendingIntent = {...unresolvedIntent(), fingerprint: 'a-fingerprint-of-another-request'}

    const decision = resolveRegenerateLaunch(makeLaunchInput({state: stateWith(corrupt)}))

    expect(decision).toMatchObject({kind: 'launch', idempotencyKey: FRESH_KEY, isReplay: false})
  })

  it('decides nothing while the persisted intents are still on their way out of storage', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)

    const decision = resolveRegenerateLaunch(makeLaunchInput({hasHydratedIntents: false, mintFreshKey}))

    expect(decision).toEqual({kind: 'ignored', reason: 'unhydratedIntents'})
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it.each([
    ['the plan has not loaded', {plan: null}],
    ['the preferences read has not answered', {expectedPreferencesRevision: null}],
    ['the targets read has not answered', {expectedTargetsRevision: null}]
  ])('decides nothing while %s', (_case, overrides: Partial<RegenerateLaunchInput>) => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)

    expect(resolveRegenerateLaunch(makeLaunchInput({...overrides, mintFreshKey}))).toEqual({
      kind: 'ignored',
      reason: 'incompletePins'
    })
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it('launches without a record when no account is signed in, since intents are scoped by one', () => {
    const decision = resolveRegenerateLaunch(makeLaunchInput({userId: null}))

    expect(decision).toMatchObject({kind: 'launch', idempotencyKey: FRESH_KEY, isReplay: false, intent: null})
  })
})

describe('resolveRegenerateLaunch — the launch latch', () => {
  it('decides nothing once a launch has been dispatched', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)

    const decision = resolveRegenerateLaunch(makeLaunchInput({isLaunchLatched: true, mintFreshKey}))

    expect(decision).toEqual({kind: 'ignored', reason: 'latched'})
    expect(mintFreshKey).not.toHaveBeenCalled()
  })

  it('files one key for two queued presses of the same confirmation', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)
    let isLaunchLatched = false

    const press = (): void => {
      const decision = resolveRegenerateLaunch(makeLaunchInput({isLaunchLatched, mintFreshKey}))

      if (decision.kind !== 'ignored') {
        isLaunchLatched = true
      }
    }

    press()
    press()

    expect(mintFreshKey).toHaveBeenCalledTimes(1)
  })

  it('declines a latched press even where a replay would otherwise be due', () => {
    const decision = resolveRegenerateLaunch(
      makeLaunchInput({isLaunchLatched: true, state: stateWith(unresolvedIntent())})
    )

    expect(decision).toEqual({kind: 'ignored', reason: 'latched'})
  })

  it('holds the latch from the dispatch itself', () => {
    expect(resolveRegenerateLatch('launchDispatched')).toBe(true)
  })

  it.each<RegenerateLatchEvent>(['confirmReopened', 'screenFocused'])(
    'releases the latch on %s, so the control does not die for the session',
    event => {
      expect(resolveRegenerateLatch(event)).toBe(false)
    }
  )

  it('releases on nothing but a reopened dialog and a returned-to screen', () => {
    const events: RegenerateLatchEvent[] = ['launchDispatched', 'confirmReopened', 'screenFocused']

    expect(events.filter(event => !resolveRegenerateLatch(event))).toEqual(['confirmReopened', 'screenFocused'])
  })

  it('launches again once a release has happened', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)
    let isLaunchLatched = resolveRegenerateLatch('launchDispatched')

    expect(resolveRegenerateLaunch(makeLaunchInput({isLaunchLatched, mintFreshKey}))).toEqual({
      kind: 'ignored',
      reason: 'latched'
    })

    isLaunchLatched = resolveRegenerateLatch('confirmReopened')

    expect(resolveRegenerateLaunch(makeLaunchInput({isLaunchLatched, mintFreshKey}))).toMatchObject({
      kind: 'launch',
      idempotencyKey: FRESH_KEY
    })
    expect(mintFreshKey).toHaveBeenCalledTimes(1)
  })
})

const READY_CONFIRM: RegenerateConfirmState = {reason: 'ready', isPending: false, isDisabled: false}

const PENDING_CONFIRM_REASONS: RegenerateConfirmReason[] = ['launchDispatched', 'unhydratedIntents']

describe('deriveRegenerateConfirmState — what the confirm action says about a press', () => {
  it('reads as available while nothing has been dispatched and the persisted slice is in hand', () => {
    expect(deriveRegenerateConfirmState({isLaunchDispatched: false, intentsHydration: 'succeeded'})).toEqual(
      READY_CONFIRM
    )
  })

  it('reads as pending from the dispatch itself, so a second tap is refused visibly and not only silently', () => {
    expect(deriveRegenerateConfirmState({isLaunchDispatched: true, intentsHydration: 'succeeded'})).toEqual({
      reason: 'launchDispatched',
      isPending: true,
      isDisabled: false
    })
  })

  it('reads as pending while the persisted intents are still on their way out of storage', () => {
    expect(deriveRegenerateConfirmState({isLaunchDispatched: false, intentsHydration: 'pending'})).toEqual({
      reason: 'unhydratedIntents',
      isPending: true,
      isDisabled: false
    })
  })

  it('reads as disabled rather than busy once the persisted read has been refused', () => {
    expect(deriveRegenerateConfirmState({isLaunchDispatched: false, intentsHydration: 'failed'})).toEqual({
      reason: 'failedIntentsRead',
      isPending: false,
      isDisabled: true
    })
  })

  it('states the refused read even where a launch was dispatched, since no wait resolves it', () => {
    expect(deriveRegenerateConfirmState({isLaunchDispatched: true, intentsHydration: 'failed'})).toEqual({
      reason: 'failedIntentsRead',
      isPending: false,
      isDisabled: true
    })
  })

  it('never draws one state as busy and disabled at once, and leaves only the ready state pressable', () => {
    const hydrations: IntentsHydration[] = ['pending', 'succeeded', 'failed']
    const states = hydrations.flatMap(intentsHydration =>
      [false, true].map(isLaunchDispatched => deriveRegenerateConfirmState({isLaunchDispatched, intentsHydration}))
    )

    expect(states.filter(state => state.isPending && state.isDisabled)).toEqual([])
    expect(states.filter(state => !state.isPending && !state.isDisabled)).toEqual([READY_CONFIRM])
  })

  it('takes the pending state from the latch rule rather than from a second rule of its own', () => {
    const events: RegenerateLatchEvent[] = ['launchDispatched', 'confirmReopened', 'screenFocused']

    const pending = events.filter(
      event =>
        deriveRegenerateConfirmState({
          isLaunchDispatched: resolveRegenerateLatch(event),
          intentsHydration: 'succeeded'
        }).isPending
    )

    expect(pending).toEqual(['launchDispatched'])
  })

  it.each<RegenerateLatchEvent>(['confirmReopened', 'screenFocused'])(
    'clears the pending state on %s, the same moment the latch releases',
    event => {
      expect(
        deriveRegenerateConfirmState({
          isLaunchDispatched: resolveRegenerateLatch(event),
          intentsHydration: 'succeeded'
        })
      ).toEqual(READY_CONFIRM)
    }
  )

  it('turns the confirmation pending on the press that mints, and files one key for two queued presses', () => {
    const mintFreshKey = jest.fn(() => FRESH_KEY)
    let isLaunchLatched = false
    const drawn: RegenerateConfirmState[] = []

    const press = (): void => {
      const decision = resolveRegenerateLaunch(makeLaunchInput({isLaunchLatched, mintFreshKey}))

      if (decision.kind !== 'ignored') {
        isLaunchLatched = resolveRegenerateLatch('launchDispatched')
      }

      drawn.push(deriveRegenerateConfirmState({isLaunchDispatched: isLaunchLatched, intentsHydration: 'succeeded'}))
    }

    press()
    press()

    expect(mintFreshKey).toHaveBeenCalledTimes(1)
    expect(drawn.map(state => state.reason)).toEqual(['launchDispatched', 'launchDispatched'])
  })

  it('draws every press the launch declines as pending or disabled, never as available', () => {
    const declined = resolveRegenerateLaunch(makeLaunchInput({hasHydratedIntents: false}))

    expect(declined).toEqual({kind: 'ignored', reason: 'unhydratedIntents'})
    expect(PENDING_CONFIRM_REASONS).toContain(
      deriveRegenerateConfirmState({isLaunchDispatched: false, intentsHydration: 'pending'}).reason
    )
    expect(deriveRegenerateConfirmState({isLaunchDispatched: false, intentsHydration: 'pending'}).isPending).toBe(true)
  })
})

const DEVICE_ZONE = 'Pacific/Auckland'
const STORED_ZONE = 'Europe/London'
const READ_REVISION = 7
const FRESH_REVISION = 9

/**
 * The `{error}` body the backend answers a refused revision with, which is the field `getApiErrorCode` reads.
 * Shaped as the axios-style error the http layer surfaces so the orchestration is exercised against the real
 * classification rather than a stand-in for it.
 */
const apiError = (code: string, status = 409): unknown => ({
  isAxiosError: true,
  response: {status, data: {error: code}}
})

const preferencesWith = (timeZone: string | null, revision: number): MealPlanPreferences =>
  ({timeZone, revision}) as MealPlanPreferences

const saveResult = (): MealPlanPreferencesSaveResult =>
  ({
    preferences: preferencesWith(DEVICE_ZONE, FRESH_REVISION + 1),
    affectedMealCount: 0
  }) as MealPlanPreferencesSaveResult

interface Collaborators {
  savePreferences: jest.Mock<Promise<MealPlanPreferencesSaveResult>, [TimeZoneReconciliationRequest]>
  refetchPreferences: jest.Mock<Promise<MealPlanPreferences | null>, []>
}

const collaborators = (): Collaborators => ({
  savePreferences: jest.fn<Promise<MealPlanPreferencesSaveResult>, [TimeZoneReconciliationRequest]>(() =>
    Promise.resolve(saveResult())
  ),
  refetchPreferences: jest.fn<Promise<MealPlanPreferences | null>, []>(() =>
    Promise.resolve(preferencesWith(STORED_ZONE, FRESH_REVISION))
  )
})

const run = (overrides: Partial<Parameters<typeof reconcilePreferencesTimeZone>[0]> & Collaborators) =>
  reconcilePreferencesTimeZone({
    storedTimeZone: STORED_ZONE,
    deviceTimeZone: DEVICE_ZONE,
    expectedRevision: READ_REVISION,
    ...overrides
  })

describe('reconcilePreferencesTimeZone', () => {
  describe('when there is nothing to correct', () => {
    it('issues no request for a stored zone the device already matches', async () => {
      const deps = collaborators()

      await expect(run({...deps, storedTimeZone: DEVICE_ZONE})).resolves.toBe('not_needed')

      expect(deps.savePreferences).not.toHaveBeenCalled()
      expect(deps.refetchPreferences).not.toHaveBeenCalled()
    })

    it('issues no request for a user who has never stored a zone', async () => {
      const deps = collaborators()

      await expect(run({...deps, storedTimeZone: null})).resolves.toBe('not_needed')

      expect(deps.savePreferences).not.toHaveBeenCalled()
    })
  })

  describe('when the zones differ', () => {
    it('saves the device zone against the revision it read', async () => {
      const deps = collaborators()

      await expect(run(deps)).resolves.toBe('saved')

      expect(deps.savePreferences).toHaveBeenCalledTimes(1)
      expect(deps.savePreferences).toHaveBeenCalledWith({timeZone: DEVICE_ZONE, expectedRevision: READ_REVISION})
      expect(deps.refetchPreferences).not.toHaveBeenCalled()
    })

    it('sends the zone and the pin and nothing else, so it cannot alter an answer of the user’s', async () => {
      const deps = collaborators()

      await run(deps)

      expect(Object.keys(deps.savePreferences.mock.calls[0][0]).sort()).toEqual(['expectedRevision', 'timeZone'])
    })

    it('sends only for a name that differs, which is the client half of the endpoint’s edit rule', async () => {
      // The contract this helper depends on: `PUT /meal-planning/preferences` reads a body carrying only the
      // envelope as an edit of `time_zone` when the zone DIFFERS from the stored one, and refuses it as
      // `{field: 'body', code: 'required'}` when it does not. The guard above is the client half of that rule
      // rather than a local shortcut, and this pins the half the client can establish: the request goes out
      // only when the two NAMES differ. It is not a guarantee the server will agree — that case is below.
      // Pinned because nothing else in this module states which bodies the endpoint accepts, and a guard
      // removed as redundant would start earning 400s on every screen open.
      const deps = collaborators()

      await run(deps)

      const [sent] = deps.savePreferences.mock.calls[0]

      expect(sent.timeZone).toBe(DEVICE_ZONE)
      expect(sent.timeZone).not.toBe(STORED_ZONE)
    })

    it('reports a refusal of an alias-equivalent zone as failed, leaving the stored zone alone', async () => {
      // The residual case the string comparison cannot see: a stored name that is an ALIAS of the device's
      // canonicalises to the same zone on the server, so the names differ here, the body is sent, and the
      // endpoint answers `400 invalid_request` — its "this edits nothing" refusal. That is not
      // `stale_revision`, so no refetch is attempted and the outcome is `failed`: the zone was not written,
      // which is the truth this helper can state. It is NOT reported as `already_current`, because
      // `getApiErrorCode` yields only the machine code and an `invalid_request` answer to this body could
      // equally be `timeZone: invalid_time_zone` — a real problem that must not be swallowed.
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('invalid_request'))

      await expect(run(deps)).resolves.toBe('failed')

      expect(deps.savePreferences).toHaveBeenCalledTimes(1)
      expect(deps.refetchPreferences).not.toHaveBeenCalled()
    })
  })

  describe('when the revision is refused', () => {
    it('resolves silently once the refetch shows the zone already applied, without writing again', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('stale_revision'))
      deps.refetchPreferences.mockResolvedValueOnce(preferencesWith(DEVICE_ZONE, FRESH_REVISION))

      await expect(run(deps)).resolves.toBe('already_current')

      expect(deps.refetchPreferences).toHaveBeenCalledTimes(1)
      expect(deps.savePreferences).toHaveBeenCalledTimes(1)
    })

    it('re-sends the zone against the refetched revision when it is still not applied', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('stale_revision'))

      await expect(run(deps)).resolves.toBe('resubmitted')

      expect(deps.refetchPreferences).toHaveBeenCalledTimes(1)
      expect(deps.savePreferences).toHaveBeenCalledTimes(2)
      expect(deps.savePreferences).toHaveBeenLastCalledWith({
        timeZone: DEVICE_ZONE,
        expectedRevision: FRESH_REVISION
      })
    })

    it('never re-sends the revision the server already refused', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('stale_revision'))

      await run(deps)

      expect(deps.savePreferences.mock.calls.map(([payload]) => payload.expectedRevision)).toEqual([
        READ_REVISION,
        FRESH_REVISION
      ])
    })

    it('gives up when the refetch cannot answer, leaving the stored zone alone', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('stale_revision'))
      deps.refetchPreferences.mockResolvedValueOnce(null)

      await expect(run(deps)).resolves.toBe('failed')

      expect(deps.savePreferences).toHaveBeenCalledTimes(1)
    })

    it('gives up when the refetch itself rejects, rather than propagating', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('stale_revision'))
      deps.refetchPreferences.mockRejectedValueOnce(new Error('offline'))

      await expect(run(deps)).resolves.toBe('failed')
    })

    it('gives up after one re-submission, so a third writer cannot start a loop', async () => {
      const deps = collaborators()

      deps.savePreferences
        .mockRejectedValueOnce(apiError('stale_revision'))
        .mockRejectedValueOnce(apiError('stale_revision'))

      await expect(run(deps)).resolves.toBe('failed')

      expect(deps.savePreferences).toHaveBeenCalledTimes(2)
    })
  })

  describe('when the save fails for any other reason', () => {
    it('reports failure without refetching, because the pin it sent is not obsolete', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(new Error('Network Error'))

      await expect(run(deps)).resolves.toBe('failed')

      expect(deps.refetchPreferences).not.toHaveBeenCalled()
      expect(deps.savePreferences).toHaveBeenCalledTimes(1)
    })

    it('treats a refusal that is not a stale revision as an ordinary failure', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(apiError('read_only_field', 400))

      await expect(run(deps)).resolves.toBe('failed')

      expect(deps.refetchPreferences).not.toHaveBeenCalled()
    })

    it('is retryable: a second run after a failure sends the zone again', async () => {
      const deps = collaborators()

      deps.savePreferences.mockRejectedValueOnce(new Error('Network Error'))

      await expect(run(deps)).resolves.toBe('failed')
      await expect(run(deps)).resolves.toBe('saved')

      expect(deps.savePreferences).toHaveBeenCalledTimes(2)
    })
  })
})

describe('canSubmitRegeneration', () => {
  const ready = {hasPlan: true, hasPreferences: true, hasTargetsRevision: true, isReconcilingTimeZone: false}

  it('offers regeneration once all three reads have answered and nothing is reconciling', () => {
    expect(canSubmitRegeneration(ready)).toBe(true)
  })

  it('withholds it while the zone reconciliation is in flight, because that save moves the pins it sends', () => {
    expect(canSubmitRegeneration({...ready, isReconcilingTimeZone: true})).toBe(false)
  })

  it.each([
    ['the plan', {hasPlan: false}],
    ['the preferences', {hasPreferences: false}],
    ['the targets revision', {hasTargetsRevision: false}]
  ])('withholds it while %s has not answered', (_label, missing) => {
    expect(canSubmitRegeneration({...ready, ...missing})).toBe(false)
  })

  it('withholds it for every combination that is not fully ready', () => {
    const flags = [true, false]
    const combinations = flags.flatMap(hasPlan =>
      flags.flatMap(hasPreferences =>
        flags.flatMap(hasTargetsRevision =>
          flags.map(isReconcilingTimeZone => ({
            hasPlan,
            hasPreferences,
            hasTargetsRevision,
            isReconcilingTimeZone
          }))
        )
      )
    )

    expect(combinations).toHaveLength(16)
    expect(combinations.filter(canSubmitRegeneration)).toEqual([ready])
  })
})

describe('resolvePlanSettingsReadState', () => {
  const PLAN_ROW = {id: 'plan-1'}

  // The read results TanStack actually hands the screen. `retained` is the shape the findings are about: the
  // status has flipped to error while the last successful row is still in `data`.
  const pending = {isSuccess: false, isError: false, error: null}
  const settled = {isSuccess: true, isError: false, error: null}
  const failing = (error: unknown): {isSuccess: boolean; isError: boolean; error: unknown} => ({
    isSuccess: false,
    isError: true,
    error
  })
  const retained = (error: unknown): {isSuccess: boolean; isError: boolean; error: unknown; data: unknown} => ({
    ...failing(error),
    data: PLAN_ROW
  })

  const TRANSPORT_FAILURE = new Error('Network Error')

  // A gated, resource-less GET answering a bare 404: the route is not mounted, so the backend was rolled back.
  const ROUTES_MISSING = {isAxiosError: true, response: {status: 404, data: {}}}

  const allSettled = {
    preferences: settled,
    targets: settled,
    currentPlan: settled,
    hasRoutedPlan: true
  }

  describe('a read that failed but kept its last row', () => {
    it('refuses the preferences revision as a pin, retained row and all', () => {
      // The finding: `preferences === null` was the only test, so this state — a read that has stopped working
      // with its pre-failure row still in the cache — reported a row, skipped the retry card, rendered the
      // seven rows as settled answers and left "Regenerate this week" pinning a revision nothing stood behind.
      const failed = retained(TRANSPORT_FAILURE)

      // The row really is still there, which is exactly why data nullity could not decide this.
      expect(failed.data).toBe(PLAN_ROW)

      const state = resolvePlanSettingsReadState({...allSettled, preferences: failed})

      expect(state.status).toBe('failed')
      expect(state.isPreferencesAuthoritative).toBe(false)
      expect(state.retryPreferences).toBe(true)
    })

    it('refuses a retained current plan too, so the plan id and revision are never sent unconfirmed', () => {
      const state = resolvePlanSettingsReadState({...allSettled, currentPlan: retained(TRANSPORT_FAILURE)})

      expect(state.status).toBe('failed')
      expect(state.retryCurrentPlan).toBe(true)
    })

    it('refuses a retained targets row, whose revision the regeneration also pins', () => {
      const state = resolvePlanSettingsReadState({...allSettled, targets: retained(TRANSPORT_FAILURE)})

      expect(state.status).toBe('failed')
      expect(state.retryTargets).toBe(true)
    })
  })

  describe('the current-plan read, which was omitted from this composition', () => {
    it('holds the body at loading while it is still in flight', () => {
      // The finding: plan identity, revision, dates and the 16b counts all come from this read alone, so its
      // absence used to disable regeneration silently beside rows that looked authoritative.
      expect(resolvePlanSettingsReadState({...allSettled, currentPlan: pending}).status).toBe('loading')
    })

    it('puts the body in the retry state when it fails, so the disabled control is explained', () => {
      const state = resolvePlanSettingsReadState({...allSettled, currentPlan: failing(TRANSPORT_FAILURE)})

      expect(state.status).toBe('failed')
      expect(state.retryCurrentPlan).toBe(true)
    })
  })

  describe('the routed plan itself', () => {
    it('reports it gone for a successful envelope that omits it', () => {
      // A `{current, upcoming}` answer that holds neither slot for `params.planId`: it was superseded by a
      // regeneration, it ended, or the week rolled over. The read succeeded, so this is not a failure and no
      // retry could bring the plan back — the screen leaves with the stale-plan toast instead of keeping a
      // Regenerate action that can never be pressed.
      const state = resolvePlanSettingsReadState({...allSettled, hasRoutedPlan: false})

      expect(state.status).toBe('ready')
      expect(state.isRoutedPlanMissing).toBe(true)
      // Not offered as a retry: the answer was correct, so re-requesting it would change nothing.
      expect(state.retryCurrentPlan).toBe(false)
    })

    it('reports it present for an envelope that holds it', () => {
      expect(resolvePlanSettingsReadState(allSettled).isRoutedPlanMissing).toBe(false)
    })

    it('never reports it gone before the read has answered', () => {
      // A read in flight carries no plan either, and calling that "your plan changed" would be a claim the
      // read has not made — and it would navigate the user off a screen that is merely still loading.
      const state = resolvePlanSettingsReadState({...allSettled, currentPlan: pending, hasRoutedPlan: false})

      expect(state.status).toBe('loading')
      expect(state.isRoutedPlanMissing).toBe(false)
    })

    it('never reports it gone on a read that failed while keeping its last row', () => {
      const state = resolvePlanSettingsReadState({
        ...allSettled,
        currentPlan: retained(TRANSPORT_FAILURE),
        hasRoutedPlan: false
      })

      expect(state.status).toBe('failed')
      expect(state.isRoutedPlanMissing).toBe(false)
      expect(state.retryCurrentPlan).toBe(true)
    })

    it('never reports it gone on a capability refusal', () => {
      const state = resolvePlanSettingsReadState({
        ...allSettled,
        currentPlan: failing(ROUTES_MISSING as unknown),
        hasRoutedPlan: false
      })

      expect(state.status).toBe('unavailable')
      expect(state.isRoutedPlanMissing).toBe(false)
    })

    it('reports it gone independently of another read failing, since that read says nothing about the plan', () => {
      const state = resolvePlanSettingsReadState({
        ...allSettled,
        preferences: failing(TRANSPORT_FAILURE),
        hasRoutedPlan: false
      })

      expect(state.status).toBe('failed')
      expect(state.isRoutedPlanMissing).toBe(true)
    })
  })

  describe('answers that are not failures', () => {
    it.each([
      ['the typed routes-missing error', new RoutesMissingError('/meal-planning/targets') as unknown],
      ['a bare 404 from the targets route', ROUTES_MISSING as unknown]
    ])('keeps the rows rendering when the targets read answers with %s', (_label, error) => {
      // AAP 0.7.5: a rolled-back targets route means the rows fall back to the local target exactly as they do
      // for a user who never opted in — and a retry could not change that answer, so none is offered.
      const state = resolvePlanSettingsReadState({...allSettled, targets: failing(error)})

      expect(state.status).toBe('ready')
      expect(state.retryTargets).toBe(false)
    })

    it('still withholds nothing from the preferences pin when only the targets route is gone', () => {
      const state = resolvePlanSettingsReadState({...allSettled, targets: failing(ROUTES_MISSING as unknown)})

      expect(state.isPreferencesAuthoritative).toBe(true)
    })
  })

  describe('capability refusals, which no retry can change', () => {
    it.each([
      ['a bare 404, meaning the routes are not mounted', ROUTES_MISSING as unknown],
      ['a confirmed 503 feature_disabled', apiError(API_ERROR_CODES.featureDisabled, 503)]
    ])('reports the preferences read answering %s as unavailable', (_label, error) => {
      const state = resolvePlanSettingsReadState({...allSettled, preferences: failing(error)})

      expect(state.status).toBe('unavailable')
      expect(state.retryPreferences).toBe(false)
      expect(state.isPreferencesAuthoritative).toBe(false)
    })

    it('reports the same for the current-plan read', () => {
      const state = resolvePlanSettingsReadState({...allSettled, currentPlan: failing(ROUTES_MISSING as unknown)})

      expect(state.status).toBe('unavailable')
      expect(state.retryCurrentPlan).toBe(false)
    })

    it('outranks a retryable failure elsewhere, because the retry could not restore the feature', () => {
      const state = resolvePlanSettingsReadState({
        ...allSettled,
        preferences: failing(ROUTES_MISSING as unknown),
        currentPlan: failing(TRANSPORT_FAILURE)
      })

      expect(state.status).toBe('unavailable')
    })
  })

  describe('a retry', () => {
    it('names exactly the reads that failed', () => {
      const state = resolvePlanSettingsReadState({
        preferences: failing(TRANSPORT_FAILURE),
        targets: settled,
        currentPlan: failing(TRANSPORT_FAILURE),
        hasRoutedPlan: true
      })

      expect(state.retryPreferences).toBe(true)
      expect(state.retryTargets).toBe(false)
      expect(state.retryCurrentPlan).toBe(true)
    })

    it('names nothing once every read has answered', () => {
      const state = resolvePlanSettingsReadState(allSettled)

      expect([state.retryPreferences, state.retryTargets, state.retryCurrentPlan]).toEqual([false, false, false])
    })

    it('names nothing while the reads are still in flight', () => {
      const state = resolvePlanSettingsReadState({
        preferences: pending,
        targets: pending,
        currentPlan: pending,
        hasRoutedPlan: false
      })

      expect(state.status).toBe('loading')
      expect([state.retryPreferences, state.retryTargets, state.retryCurrentPlan]).toEqual([false, false, false])
    })
  })

  describe('the preferences pin, reported separately from the body status', () => {
    it('survives a current-plan failure, which says nothing about the preferences revision', () => {
      const state = resolvePlanSettingsReadState({...allSettled, currentPlan: failing(TRANSPORT_FAILURE)})

      expect(state.status).toBe('failed')
      expect(state.isPreferencesAuthoritative).toBe(true)
    })

    it('is withheld while the preferences read is still in flight', () => {
      const state = resolvePlanSettingsReadState({...allSettled, preferences: pending})

      expect(state.isPreferencesAuthoritative).toBe(false)
    })
  })

  it('offers the rows once all three reads have answered and the routed plan is there', () => {
    expect(resolvePlanSettingsReadState(allSettled)).toEqual({
      status: 'ready',
      isPreferencesAuthoritative: true,
      isRoutedPlanMissing: false,
      retryPreferences: false,
      retryTargets: false,
      retryCurrentPlan: false
    })
  })
})
