import {httpGet} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import {AxiosError, AxiosResponse} from 'axios'
import * as io from 'io-ts'

import {convertAffectedMeals} from '../converter/convertAffectedMeals'
import {convertGroceryItem, convertGroceryList} from '../converter/convertGroceryList'
import {convertMealPlan} from '../converter/convertMealPlan'
import {convertMealPlanDay, convertMealPlanMeal} from '../converter/convertMealPlanDay'
import {convertNutritionTargets, convertNutritionTargetsSaveResult} from '../converter/convertNutritionTargets'
import {convertPreferences, convertPreferencesSaveResult} from '../converter/convertPreferences'
import {convertRecipeVersion} from '../converter/convertRecipeVersion'
import {convertSwapAlternatives, convertSwapPreview} from '../converter/convertSwapAlternatives'
import {
  AffectedMealResponse,
  AffectedMealsResponse,
  GroceryItemResponse,
  GroceryListResponse,
  MealPlanDayResponse,
  MealPlanMealResponse,
  MealPlanResponse,
  PreferencesResponse,
  PreferencesSaveResponse,
  RecipeVersionResponse,
  SwapAlternativeResponse,
  SwapAlternativesResponse,
  SwapPreviewResponse,
  TargetsResponse,
  TargetsSaveResponse
} from '../decoder/MealPlanningDecoder'
import {fetchNutritionTargets} from '../fetchNutritionTargets'

jest.mock('@service/http/httpUtil', () => ({
  httpGet: jest.fn()
}))

jest.mock('@utility/CrashUtility', () => ({
  __esModule: true,
  default: {recordError: jest.fn()}
}))

type WirePreferences = io.TypeOf<typeof PreferencesResponse>
type WirePreferencesSave = io.TypeOf<typeof PreferencesSaveResponse>
type WireTargets = io.TypeOf<typeof TargetsResponse>
type WireTargetsSave = io.TypeOf<typeof TargetsSaveResponse>
type WireMeal = io.TypeOf<typeof MealPlanMealResponse>
type WireDay = io.TypeOf<typeof MealPlanDayResponse>
type WirePlan = io.TypeOf<typeof MealPlanResponse>
type WireRecipeVersion = io.TypeOf<typeof RecipeVersionResponse>
type WireAlternative = io.TypeOf<typeof SwapAlternativeResponse>
type WireAlternatives = io.TypeOf<typeof SwapAlternativesResponse>
type WireSwapPreview = io.TypeOf<typeof SwapPreviewResponse>
type WireGroceryItem = io.TypeOf<typeof GroceryItemResponse>
type WireGroceryList = io.TypeOf<typeof GroceryListResponse>
type WireAffectedMeal = io.TypeOf<typeof AffectedMealResponse>
type WireAffectedMeals = io.TypeOf<typeof AffectedMealsResponse>

type WireTotals = WireDay['plannedTotals']
type WireMacroTargets = NonNullable<WireTargets['targets']>
type WireRecipeSummary = WireMeal['recipe']
type WireLoggedEntry = WireMeal['loggedEntries'][number]
type WireIngredient = WireRecipeVersion['ingredients'][number]
type WireGroceryFlag = NonNullable<WireGroceryItem['flag']>

const RECOGNISED_ICON_KEYS = ['crosshair', 'fork_knife', 'bowl', 'wrap', 'dome', 'salad', 'bowl_dash', 'pot', 'cloche']

const RECOGNISED_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const

const RECOGNISED_FLAG_CODES = ['diet', 'allergen', 'dislike', 'cooking_time'] as const

const makeTotals = (overrides: Partial<WireTotals> = {}): WireTotals => ({
  calories: 610,
  protein: 45,
  carbs: 58,
  fat: 21,
  ...overrides
})

const makeMacroTargets = (overrides: Partial<WireMacroTargets> = {}): WireMacroTargets => ({
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  ...overrides
})

const makePreferences = (overrides: Partial<WirePreferences> = {}): WirePreferences => ({
  setupStatus: 'completed',
  setupStep: 'review',
  reviewStartDate: '2026-07-05',
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 4,
  goal: 'lose',
  goalWeightKg: 77.1,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 177.8,
  weightKg: 82.6,
  sexForEstimate: 'female',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'lightly_active',
  diet: 'none',
  allergens: ['peanuts', 'tree_nuts'],
  dislikedFoods: [
    {id: 'catalog-food-9', name: 'Mushrooms, white', foodGroup: 'mushroom'},
    {id: 'catalog-food-10', name: 'Olives', foodGroup: 'olive'}
  ],
  dislikedFoodGroups: ['mushroom', 'olive'],
  mealSchedule: 'three_plus_snack',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'},
    {slot: 'snack', time: '15:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: {amount: 90, currency: 'USD'},
  noBudgetPreference: false,
  budgetTier: 2,
  hasActivePlan: true,
  ...overrides
})

const makeFirstEntryPreferences = (): WirePreferences =>
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
    hasActivePlan: false
  })

const makePreferencesSave = (overrides: Partial<WirePreferencesSave> = {}): WirePreferencesSave => ({
  preferences: makePreferences(),
  affectedMealCount: 2,
  ...overrides
})

const makeTargets = (overrides: Partial<WireTargets> = {}): WireTargets => ({
  targets: makeMacroTargets(),
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 3,
  ...overrides
})

const makeTargetsSave = (overrides: Partial<WireTargetsSave> = {}): WireTargetsSave => ({
  targets: makeTargets(),
  feasibility: {ok: true, warnings: []},
  ...overrides
})

const makeRecipeSummary = (overrides: Partial<WireRecipeSummary> = {}): WireRecipeSummary => ({
  versionId: 'recipe-version-1',
  recipeId: 'recipe-1',
  name: 'Chicken burrito bowl',
  iconKey: 'bowl',
  totalMinutes: 25,
  badges: ['high_protein'],
  nutritionProvenance: 'source_backed',
  ...overrides
})

const makeLoggedEntry = (overrides: Partial<WireLoggedEntry> = {}): WireLoggedEntry => ({
  entryId: 'entry-1',
  date: '2026-07-05',
  mealName: 'Lunch',
  servings: 1,
  loggedAt: '2026-07-05T12:30:00.000Z',
  recipeVersionId: 'recipe-version-1',
  recipeName: 'Chicken burrito bowl',
  ...overrides
})

const makeMeal = (overrides: Partial<WireMeal> = {}): WireMeal => ({
  id: 'meal-lunch',
  revision: 1,
  slot: 'lunch',
  slotTime: '12:30',
  sortOrder: 1,
  recipe: makeRecipeSummary(),
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: makeTotals(),
  flags: [],
  loggedEntries: [],
  previousRecipe: null,
  ...overrides
})

const makeDay = (overrides: Partial<WireDay> = {}): WireDay => ({
  id: 'day-1',
  date: '2026-07-05',
  dayIndex: 0,
  plannedTotals: makeTotals({calories: 1905, protein: 142, carbs: 188, fat: 61}),
  isLastDay: false,
  meals: [makeMeal()],
  ...overrides
})

const makePlan = (overrides: Partial<WirePlan> = {}): WirePlan => ({
  id: 'plan-1',
  revision: 1,
  generationAttempt: 1,
  startDate: '2026-07-05',
  endDate: '2026-07-11',
  status: 'active',
  targets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65}),
  generationTargets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65}),
  targetsStale: false,
  preferencesRevision: 4,
  targetsRevision: 2,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 14, loggedEntryCount: 0},
  days: [makeDay()],
  ...overrides
})

const makeIngredient = (overrides: Partial<WireIngredient> = {}): WireIngredient => ({
  catalogFoodId: 'catalog-food-1',
  name: 'Chicken breast',
  quantity: 5,
  unit: 'oz',
  gramWeight: 142,
  displayText: '5 oz',
  nutritionProvenance: 'source_backed',
  isOptional: false,
  ...overrides
})

const makeRecipeVersion = (overrides: Partial<WireRecipeVersion> = {}): WireRecipeVersion => ({
  versionId: 'recipe-version-1',
  recipeId: 'recipe-1',
  version: 1,
  status: 'current',
  name: 'Chicken burrito bowl',
  description: 'Seared chicken over brown rice with black beans.',
  iconKey: 'bowl',
  instructions: [
    'Season the chicken with chili powder, cumin, and salt.',
    'Sear 6 to 7 minutes per side, then rest and slice.'
  ],
  yieldServings: 2,
  servingDescription: '1 bowl',
  prepMinutes: 10,
  cookMinutes: 15,
  totalMinutes: 25,
  mealSlots: ['lunch', 'dinner'],
  badges: ['high_protein', 'gluten_free'],
  dietTags: ['none'],
  allergenTags: [],
  allergenStatus: 'known',
  budgetTier: 2,
  nutritionProvenance: 'source_backed',
  perServing: makeTotals(),
  ingredients: [makeIngredient()],
  ...overrides
})

const makeAlternative = (overrides: Partial<WireAlternative> = {}): WireAlternative => ({
  recipeVersionId: 'recipe-version-2',
  name: 'Turkey and hummus wrap',
  iconKey: 'wrap',
  calories: 540,
  protein: 38,
  totalMinutes: 15,
  portionMultiplier: 1,
  ...overrides
})

const makeAlternatives = (overrides: Partial<WireAlternatives> = {}): WireAlternatives => ({
  current: makeMeal(),
  alternatives: [makeAlternative()],
  ...overrides
})

const makeSwapPreview = (overrides: Partial<WireSwapPreview> = {}): WireSwapPreview => ({
  alternative: {
    recipe: makeRecipeVersion(),
    portionMultiplier: 1.25,
    portionText: '1¼ servings',
    nutrition: makeTotals({calories: 540, protein: 38, carbs: 49, fat: 19})
  },
  dayTotalsIfSwapped: makeTotals({calories: 1835, protein: 135, carbs: 179, fat: 59}),
  targets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65}),
  calorieDelta: -70,
  planRevision: 3,
  ...overrides
})

const makeGroceryFlag = (overrides: Partial<WireGroceryFlag> = {}): WireGroceryFlag => ({
  previousDisplayText: '2.5 lb',
  newDisplayText: '3.1 lb',
  deltaDisplayText: '+0.6 lb',
  flaggedAt: '2026-07-06T09:15:00.000Z',
  ...overrides
})

const makeGroceryItem = (overrides: Partial<WireGroceryItem> = {}): WireGroceryItem => ({
  id: 'grocery-item-1',
  catalogFoodId: 'catalog-food-1',
  foodState: 'raw',
  name: 'Chicken breast',
  quantityGrams: 1134,
  displayText: '2.5 lb',
  isChecked: false,
  flag: null,
  ...overrides
})

const makeGroceryList = (overrides: Partial<WireGroceryList> = {}): WireGroceryList => ({
  planId: 'plan-1',
  planRevision: 3,
  startDate: '2026-07-05',
  endDate: '2026-07-11',
  totalCount: 14,
  checkedCount: 6,
  banner: null,
  sections: [{category: 'produce', items: [makeGroceryItem()]}],
  checkedItems: [],
  ...overrides
})

const makeAffectedMeal = (overrides: Partial<WireAffectedMeal> = {}): WireAffectedMeal => ({
  mealId: 'meal-dinner',
  date: '2026-07-07',
  slot: 'dinner',
  recipeName: 'Creamy tomato pasta',
  flags: [{code: 'allergen', detail: ['milk']}],
  ...overrides
})

const makeAffectedMeals = (meals: WireAffectedMeal[]): WireAffectedMeals => ({meals})

describe('convertPreferences', () => {
  describe('a fully answered profile', () => {
    it('maps every member of the response', () => {
      const result = convertPreferences(makePreferences())

      expect(result).toEqual({
        setupStatus: 'completed',
        setupStep: 'review',
        reviewStartDate: '2026-07-05',
        timeZone: 'America/New_York',
        targetRoute: 'estimated',
        revision: 4,
        goal: 'lose',
        goalWeightKg: 77.1,
        paceLbPerWeek: 1,
        age: 34,
        heightCm: 177.8,
        weightKg: 82.6,
        sexForEstimate: 'female',
        heightUnitPref: 'ft_in',
        weightUnitPref: 'lb',
        activityLevel: 'lightly_active',
        diet: 'none',
        allergens: ['peanuts', 'tree_nuts'],
        dislikedFoods: [
          {id: 'catalog-food-9', name: 'Mushrooms, white', foodGroup: 'mushroom'},
          {id: 'catalog-food-10', name: 'Olives', foodGroup: 'olive'}
        ],
        dislikedFoodGroups: ['mushroom', 'olive'],
        mealSchedule: 'three_plus_snack',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'dinner', time: '18:30'},
          {slot: 'snack', time: '15:30'}
        ],
        cookingTimeLimitMin: 30,
        budget: {amount: 90, currency: 'USD'},
        noBudgetPreference: false,
        budgetTier: 2,
        hasActivePlan: true
      })
    })
  })

  describe('a user with no preferences row', () => {
    it('leaves every unanswered member null', () => {
      const result = convertPreferences(makeFirstEntryPreferences())

      expect(result.setupStep).toBeNull()
      expect(result.reviewStartDate).toBeNull()
      expect(result.timeZone).toBeNull()
      expect(result.targetRoute).toBeNull()
      expect(result.goal).toBeNull()
      expect(result.goalWeightKg).toBeNull()
      expect(result.paceLbPerWeek).toBeNull()
      expect(result.age).toBeNull()
      expect(result.heightCm).toBeNull()
      expect(result.weightKg).toBeNull()
      expect(result.sexForEstimate).toBeNull()
      expect(result.activityLevel).toBeNull()
      expect(result.diet).toBeNull()
      expect(result.mealSchedule).toBeNull()
      expect(result.cookingTimeLimitMin).toBeNull()
      expect(result.budgetTier).toBeNull()
    })

    it('invents no unit preference of its own', () => {
      const result = convertPreferences(makeFirstEntryPreferences())

      expect(result.heightUnitPref).toBeNull()
      expect(result.weightUnitPref).toBeNull()
    })

    it('keeps the unanswered collections empty', () => {
      const result = convertPreferences(makeFirstEntryPreferences())

      expect(result.allergens).toEqual([])
      expect(result.dislikedFoods).toEqual([])
      expect(result.dislikedFoodGroups).toEqual([])
      expect(result.mealTimes).toEqual([])
    })

    it('reports the not-started status at revision zero', () => {
      const result = convertPreferences(makeFirstEntryPreferences())

      expect(result.setupStatus).toBe('not_started')
      expect(result.revision).toBe(0)
      expect(result.hasActivePlan).toBe(false)
    })
  })

  describe('answered code sets', () => {
    it('carries each setup status through rather than defaulting it', () => {
      const statuses = ['not_started', 'in_progress', 'ready_for_review', 'completed'] as const

      statuses.forEach(setupStatus => {
        expect(convertPreferences(makePreferences({setupStatus})).setupStatus).toBe(setupStatus)
      })
    })

    it('carries each setup step through', () => {
      const steps = [
        'goal',
        'body',
        'activity',
        'diet',
        'dislikes',
        'schedule',
        'cooking',
        'review',
        'targets_manual'
      ] as const

      steps.forEach(setupStep => {
        expect(convertPreferences(makePreferences({setupStep})).setupStep).toBe(setupStep)
      })
    })

    it('carries each supported pace through', () => {
      const paces = [0.5, 1, 1.5] as const

      paces.forEach(paceLbPerWeek => {
        expect(convertPreferences(makePreferences({paceLbPerWeek})).paceLbPerWeek).toBe(paceLbPerWeek)
      })
    })

    it('carries each supported cooking-time limit through', () => {
      const limits = [15, 30, 45, 60] as const

      limits.forEach(cookingTimeLimitMin => {
        expect(convertPreferences(makePreferences({cookingTimeLimitMin})).cookingTimeLimitMin).toBe(cookingTimeLimitMin)
      })
    })

    it('carries each budget tier through', () => {
      const tiers = [1, 2, 3] as const

      tiers.forEach(budgetTier => {
        expect(convertPreferences(makePreferences({budgetTier})).budgetTier).toBe(budgetTier)
      })
    })

    it('carries the goal, sex, activity level, diet, schedule and target route through', () => {
      const result = convertPreferences(
        makePreferences({
          goal: 'gain',
          sexForEstimate: 'prefer_not_to_say',
          activityLevel: 'very_active',
          diet: 'pescatarian',
          mealSchedule: 'three',
          targetRoute: 'manual',
          heightUnitPref: 'cm',
          weightUnitPref: 'kg'
        })
      )

      expect(result.goal).toBe('gain')
      expect(result.sexForEstimate).toBe('prefer_not_to_say')
      expect(result.activityLevel).toBe('very_active')
      expect(result.diet).toBe('pescatarian')
      expect(result.mealSchedule).toBe('three')
      expect(result.targetRoute).toBe('manual')
      expect(result.heightUnitPref).toBe('cm')
      expect(result.weightUnitPref).toBe('kg')
    })
  })

  describe('collections', () => {
    it('maps the disliked foods in the order sent', () => {
      const result = convertPreferences(
        makePreferences({
          dislikedFoods: [
            {id: 'catalog-food-3', name: 'Cilantro', foodGroup: 'herb'},
            {id: 'catalog-food-1', name: 'Blue cheese', foodGroup: 'cheese'},
            {id: 'catalog-food-2', name: 'Onions', foodGroup: 'onion'}
          ]
        })
      )

      expect(result.dislikedFoods.map(food => food.id)).toEqual(['catalog-food-3', 'catalog-food-1', 'catalog-food-2'])
      expect(result.dislikedFoods[1]).toEqual({id: 'catalog-food-1', name: 'Blue cheese', foodGroup: 'cheese'})
    })

    it('keeps the meal times in wire order rather than sorting them by time', () => {
      const result = convertPreferences(makePreferences())

      expect(result.mealTimes.map(entry => entry.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
      expect(result.mealTimes.map(entry => entry.time)).toEqual(['08:00', '12:30', '18:30', '15:30'])
    })
  })

  describe('budget', () => {
    it('preserves an entered weekly budget', () => {
      const result = convertPreferences(makePreferences({budget: {amount: 125, currency: 'USD'}}))

      expect(result.budget).toEqual({amount: 125, currency: 'USD'})
    })

    it('returns null when no budget was entered', () => {
      const result = convertPreferences(makePreferences({budget: null, noBudgetPreference: true}))

      expect(result.budget).toBeNull()
      expect(result.noBudgetPreference).toBe(true)
    })
  })
})

describe('convertPreferencesSaveResult', () => {
  it('composes the preferences converter for the saved row', () => {
    const response = makePreferencesSave({preferences: makeFirstEntryPreferences()})

    expect(convertPreferencesSaveResult(response).preferences).toEqual(convertPreferences(response.preferences))
  })

  it('preserves a zero affected-meal count', () => {
    const result = convertPreferencesSaveResult(makePreferencesSave({affectedMealCount: 0}))

    expect(result.affectedMealCount).toBe(0)
  })

  it('preserves a positive affected-meal count', () => {
    const result = convertPreferencesSaveResult(makePreferencesSave({affectedMealCount: 2}))

    expect(result.affectedMealCount).toBe(2)
  })
})

describe('convertNutritionTargets', () => {
  describe('the targets block', () => {
    it('returns null when the server holds no targets', () => {
      const result = convertNutritionTargets(makeTargets({targets: null, complete: false, source: null, revision: 0}))

      expect(result.targets).toBeNull()
    })

    it('keeps the missing macros of a calories-only account null rather than zero', () => {
      const legacyTargets = makeMacroTargets({calories: 1900, protein: null, carbs: null, fat: null})

      const result = convertNutritionTargets(makeTargets({targets: legacyTargets, complete: false, source: 'legacy'}))

      expect(result.targets).toEqual({calories: 1900, protein: null, carbs: null, fat: null})
      expect(result.targets?.protein).toBeNull()
      expect(result.targets?.carbs).toBeNull()
      expect(result.targets?.fat).toBeNull()
    })

    it('preserves a complete set', () => {
      const result = convertNutritionTargets(makeTargets())

      expect(result.targets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
    })
  })

  describe('completeness and staleness', () => {
    it('carries the server verdicts through', () => {
      const result = convertNutritionTargets(makeTargets({complete: true, stale: false}))

      expect(result.complete).toBe(true)
      expect(result.stale).toBe(false)
    })

    it('reports an incomplete set even when all four values are present', () => {
      const result = convertNutritionTargets(makeTargets({targets: makeMacroTargets(), complete: false}))

      expect(result.complete).toBe(false)
      expect(result.targets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
    })

    it('reports a stale estimate without changing its values', () => {
      const result = convertNutritionTargets(makeTargets({stale: true}))

      expect(result.stale).toBe(true)
      expect(result.targets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
    })
  })

  describe('source', () => {
    it('preserves each recognised source', () => {
      const sources = ['estimated', 'manual', 'legacy'] as const

      sources.forEach(source => {
        expect(convertNutritionTargets(makeTargets({source})).source).toBe(source)
      })
    })

    it('resolves an unrecognised source to null', () => {
      const result = convertNutritionTargets(makeTargets({source: 'imported_from_partner'}))

      expect(result.source).toBeNull()
    })

    it('leaves an absent source null', () => {
      const result = convertNutritionTargets(makeTargets({source: null}))

      expect(result.source).toBeNull()
    })
  })

  describe('revision', () => {
    it('passes a zero revision through', () => {
      expect(convertNutritionTargets(makeTargets({revision: 0})).revision).toBe(0)
    })

    it('passes a positive revision through', () => {
      expect(convertNutritionTargets(makeTargets({revision: 7})).revision).toBe(7)
    })
  })
})

describe('convertNutritionTargetsSaveResult', () => {
  it('composes the targets converter for the saved targets', () => {
    const response = makeTargetsSave({targets: makeTargets({source: 'not_a_source'})})

    expect(convertNutritionTargetsSaveResult(response).targets).toEqual(convertNutritionTargets(response.targets))
  })

  it('preserves a feasible verdict', () => {
    const result = convertNutritionTargetsSaveResult(makeTargetsSave({feasibility: {ok: true, warnings: []}}))

    expect(result.feasibility.ok).toBe(true)
  })

  it('preserves an infeasible verdict', () => {
    const result = convertNutritionTargetsSaveResult(
      makeTargetsSave({feasibility: {ok: false, warnings: ['macro_energy_mismatch']}})
    )

    expect(result.feasibility.ok).toBe(false)
  })

  it('keeps the recognised warnings as codes in the order sent', () => {
    const result = convertNutritionTargetsSaveResult(
      makeTargetsSave({
        feasibility: {ok: false, warnings: ['macro_energy_mismatch', 'below_catalog_min', 'above_catalog_max']}
      })
    )

    expect(result.feasibility.warnings).toEqual(['macro_energy_mismatch', 'below_catalog_min', 'above_catalog_max'])
  })

  it('drops an unrecognised warning code', () => {
    const result = convertNutritionTargetsSaveResult(
      makeTargetsSave({feasibility: {ok: false, warnings: ['macro_energy_mismatch', 'protein_above_renal_limit']}})
    )

    expect(result.feasibility.warnings).toEqual(['macro_energy_mismatch'])
  })

  it('returns an empty list when there are no warnings', () => {
    const result = convertNutritionTargetsSaveResult(makeTargetsSave({feasibility: {ok: true, warnings: []}}))

    expect(result.feasibility.warnings).toEqual([])
  })
})

describe('convertMealPlanMeal', () => {
  describe('the recipe glyph', () => {
    it('preserves every recognised icon key', () => {
      RECOGNISED_ICON_KEYS.forEach(iconKey => {
        const meal = makeMeal({recipe: makeRecipeSummary({iconKey})})

        expect(convertMealPlanMeal(meal).recipe.iconKey).toBe(iconKey)
      })
    })

    it('falls back to the generic bowl for an unrecognised icon key', () => {
      const meal = makeMeal({recipe: makeRecipeSummary({iconKey: 'skillet'})})

      expect(convertMealPlanMeal(meal).recipe.iconKey).toBe('bowl')
    })
  })

  describe('recipe badges', () => {
    it('preserves the recognised codes in the order sent', () => {
      const meal = makeMeal({recipe: makeRecipeSummary({badges: ['quick', 'high_protein', 'dairy_free']})})

      expect(convertMealPlanMeal(meal).recipe.badges).toEqual(['quick', 'high_protein', 'dairy_free'])
    })

    it('drops an unrecognised badge code', () => {
      const meal = makeMeal({recipe: makeRecipeSummary({badges: ['high_protein', 'low_fodmap']})})

      expect(convertMealPlanMeal(meal).recipe.badges).toEqual(['high_protein'])
    })

    it('returns an empty list for a recipe without badges', () => {
      const meal = makeMeal({recipe: makeRecipeSummary({badges: []})})

      expect(convertMealPlanMeal(meal).recipe.badges).toEqual([])
    })
  })

  describe('flags', () => {
    it('preserves every recognised flag code with its detail', () => {
      RECOGNISED_FLAG_CODES.forEach(code => {
        const meal = makeMeal({flags: [{code, detail: ['milk']}]})

        expect(convertMealPlanMeal(meal).flags).toEqual([{code, detail: ['milk']}])
      })
    })

    it('drops a flag carrying an unrecognised code', () => {
      const meal = makeMeal({
        flags: [
          {code: 'allergen', detail: ['milk']},
          {code: 'seasonal_unavailable', detail: ['asparagus']}
        ]
      })

      expect(convertMealPlanMeal(meal).flags).toEqual([{code: 'allergen', detail: ['milk']}])
    })

    it('keeps both details of a flag that carries two', () => {
      const meal = makeMeal({flags: [{code: 'allergen', detail: ['milk', 'sesame']}]})

      expect(convertMealPlanMeal(meal).flags[0].detail).toEqual(['milk', 'sesame'])
    })

    it('keeps two flags that share one code', () => {
      const meal = makeMeal({
        flags: [
          {code: 'dislike', detail: ['mushroom']},
          {code: 'dislike', detail: ['olive']}
        ]
      })

      expect(convertMealPlanMeal(meal).flags).toEqual([
        {code: 'dislike', detail: ['mushroom']},
        {code: 'dislike', detail: ['olive']}
      ])
    })

    it('returns an empty list for an unflagged meal', () => {
      expect(convertMealPlanMeal(makeMeal()).flags).toEqual([])
    })
  })

  describe('logged entries', () => {
    it('returns an empty list for a meal that was never logged', () => {
      expect(convertMealPlanMeal(makeMeal()).loggedEntries).toEqual([])
    })

    it('maps every member of a single logged entry', () => {
      const meal = makeMeal({loggedEntries: [makeLoggedEntry()]})

      expect(convertMealPlanMeal(meal).loggedEntries).toEqual([
        {
          entryId: 'entry-1',
          date: '2026-07-05',
          mealName: 'Lunch',
          servings: 1,
          loggedAt: '2026-07-05T12:30:00.000Z',
          recipeVersionId: 'recipe-version-1',
          recipeName: 'Chicken burrito bowl'
        }
      ])
    })

    it('keeps three entries in the order sent, without sorting, deduping or truncating', () => {
      const meal = makeMeal({
        loggedEntries: [
          makeLoggedEntry({entryId: 'entry-3', loggedAt: '2026-07-05T19:05:00.000Z'}),
          makeLoggedEntry({entryId: 'entry-1', loggedAt: '2026-07-05T08:15:00.000Z'}),
          makeLoggedEntry({entryId: 'entry-2', loggedAt: '2026-07-05T12:30:00.000Z'})
        ]
      })

      const result = convertMealPlanMeal(meal)

      expect(result.loggedEntries.map(entry => entry.entryId)).toEqual(['entry-3', 'entry-1', 'entry-2'])
      expect(result.loggedEntries).toHaveLength(3)
    })

    it('keeps the recipe a swapped slot was logged against', () => {
      const meal = makeMeal({
        recipe: makeRecipeSummary({versionId: 'recipe-version-3', name: 'Beef and rice bowl'}),
        loggedEntries: [makeLoggedEntry({recipeVersionId: 'recipe-version-1', recipeName: 'Chicken burrito bowl'})]
      })

      const result = convertMealPlanMeal(meal)

      expect(result.loggedEntries[0].recipeVersionId).toBe('recipe-version-1')
      expect(result.loggedEntries[0].recipeName).toBe('Chicken burrito bowl')
      expect(result.recipe.versionId).toBe('recipe-version-3')
    })
  })

  describe('the previous recipe', () => {
    it('returns null for a meal that was never swapped', () => {
      expect(convertMealPlanMeal(makeMeal()).previousRecipe).toBeNull()
    })

    it('maps the previous recipe of a swapped meal', () => {
      const meal = makeMeal({previousRecipe: {versionId: 'recipe-version-1', name: 'Chicken burrito bowl'}})

      expect(convertMealPlanMeal(meal).previousRecipe).toEqual({
        versionId: 'recipe-version-1',
        name: 'Chicken burrito bowl'
      })
    })
  })

  describe('carried members', () => {
    it('maps the identity, schedule and planned nutrition of a meal', () => {
      const result = convertMealPlanMeal(makeMeal())

      expect(result.id).toBe('meal-lunch')
      expect(result.revision).toBe(1)
      expect(result.slot).toBe('lunch')
      expect(result.slotTime).toBe('12:30')
      expect(result.sortOrder).toBe(1)
      expect(result.portionText).toBe('1 serving')
      expect(result.planned).toEqual({calories: 610, protein: 45, carbs: 58, fat: 21})
      expect(result.recipe.versionId).toBe('recipe-version-1')
      expect(result.recipe.recipeId).toBe('recipe-1')
      expect(result.recipe.name).toBe('Chicken burrito bowl')
      expect(result.recipe.totalMinutes).toBe(25)
    })

    it('preserves each slot', () => {
      RECOGNISED_SLOTS.forEach(slot => {
        expect(convertMealPlanMeal(makeMeal({slot})).slot).toBe(slot)
      })
    })

    it('passes the portion multiplier through unrounded', () => {
      const multipliers = [0.75, 1.25, 1.75]

      multipliers.forEach(portionMultiplier => {
        expect(convertMealPlanMeal(makeMeal({portionMultiplier})).portionMultiplier).toBe(portionMultiplier)
      })
    })

    it('reports the source-backed provenance the server sent', () => {
      expect(convertMealPlanMeal(makeMeal()).recipe.nutritionProvenance).toBe('source_backed')
    })

    it('keeps zero planned nutrition as zero', () => {
      const meal = makeMeal({planned: makeTotals({calories: 0, protein: 0, carbs: 0, fat: 0})})

      expect(convertMealPlanMeal(meal).planned).toEqual({calories: 0, protein: 0, carbs: 0, fat: 0})
    })
  })
})

describe('convertMealPlanDay', () => {
  it('maps every member of the day', () => {
    const result = convertMealPlanDay(makeDay())

    expect(result.id).toBe('day-1')
    expect(result.date).toBe('2026-07-05')
    expect(result.dayIndex).toBe(0)
    expect(result.plannedTotals).toEqual({calories: 1905, protein: 142, carbs: 188, fat: 61})
    expect(result.isLastDay).toBe(false)
    expect(result.meals).toHaveLength(1)
  })

  it('maps the meals through the meal converter', () => {
    const day = makeDay({
      meals: [makeMeal({recipe: makeRecipeSummary({iconKey: 'skillet', badges: ['high_protein', 'low_fodmap']})})]
    })

    const result = convertMealPlanDay(day)

    expect(result.meals[0].recipe.iconKey).toBe('bowl')
    expect(result.meals[0].recipe.badges).toEqual(['high_protein'])
  })

  it('keeps the meals in the order sent', () => {
    const day = makeDay({
      meals: [
        makeMeal({id: 'meal-breakfast', slot: 'breakfast', slotTime: '08:00', sortOrder: 0}),
        makeMeal({id: 'meal-lunch', slot: 'lunch', slotTime: '12:30', sortOrder: 1}),
        makeMeal({id: 'meal-snack', slot: 'snack', slotTime: '15:30', sortOrder: 2}),
        makeMeal({id: 'meal-dinner', slot: 'dinner', slotTime: '18:30', sortOrder: 3})
      ]
    })

    expect(convertMealPlanDay(day).meals.map(meal => meal.id)).toEqual([
      'meal-breakfast',
      'meal-lunch',
      'meal-snack',
      'meal-dinner'
    ])
  })

  it('returns an empty meal list for a day with no meals', () => {
    expect(convertMealPlanDay(makeDay({meals: []})).meals).toEqual([])
  })

  it('marks the last day of the plan', () => {
    expect(convertMealPlanDay(makeDay({isLastDay: true})).isLastDay).toBe(true)
    expect(convertMealPlanDay(makeDay({isLastDay: false})).isLastDay).toBe(false)
  })

  it('keeps zero planned totals as zero', () => {
    const day = makeDay({plannedTotals: makeTotals({calories: 0, protein: 0, carbs: 0, fat: 0})})

    expect(convertMealPlanDay(day).plannedTotals).toEqual({calories: 0, protein: 0, carbs: 0, fat: 0})
  })
})

describe('convertMealPlan', () => {
  it('keeps the current targets, the generation snapshot and the stale verdict as three members', () => {
    const plan = makePlan({
      targets: makeTotals({calories: 2100, protein: 158, carbs: 210, fat: 70}),
      generationTargets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65}),
      targetsStale: true
    })

    const result = convertMealPlan(plan)

    expect(result.targets).toEqual({calories: 2100, protein: 158, carbs: 210, fat: 70})
    expect(result.generationTargets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
    expect(result.targetsStale).toBe(true)
  })

  it('maps the days through the day converter', () => {
    const plan = makePlan({
      days: [
        makeDay({
          meals: [makeMeal({recipe: makeRecipeSummary({iconKey: 'skillet', badges: ['low_fodmap', 'vegan']})})]
        })
      ]
    })

    const result = convertMealPlan(plan)

    expect(result.days[0].meals[0].recipe.iconKey).toBe('bowl')
    expect(result.days[0].meals[0].recipe.badges).toEqual(['vegan'])
  })

  it('keeps the days in the order sent', () => {
    const plan = makePlan({
      days: [
        makeDay({id: 'day-1', date: '2026-07-05', dayIndex: 0}),
        makeDay({id: 'day-2', date: '2026-07-06', dayIndex: 1}),
        makeDay({id: 'day-3', date: '2026-07-07', dayIndex: 2})
      ]
    })

    expect(convertMealPlan(plan).days.map(day => day.date)).toEqual(['2026-07-05', '2026-07-06', '2026-07-07'])
  })

  it('preserves the summary counts', () => {
    const plan = makePlan({summary: {plannedMeals: 28, groceryItemCount: 19, loggedEntryCount: 3}})

    expect(convertMealPlan(plan).summary).toEqual({plannedMeals: 28, groceryItemCount: 19, loggedEntryCount: 3})
  })

  it('preserves zero summary counts', () => {
    const plan = makePlan({summary: {plannedMeals: 0, groceryItemCount: 0, loggedEntryCount: 0}})

    expect(convertMealPlan(plan).summary).toEqual({plannedMeals: 0, groceryItemCount: 0, loggedEntryCount: 0})
  })

  it('passes the identity, dates, revisions and generation attempt through untouched', () => {
    const plan = makePlan({revision: 5, generationAttempt: 3, preferencesRevision: 9, targetsRevision: 4})

    const result = convertMealPlan(plan)

    expect(result.id).toBe('plan-1')
    expect(result.revision).toBe(5)
    expect(result.generationAttempt).toBe(3)
    expect(result.startDate).toBe('2026-07-05')
    expect(result.endDate).toBe('2026-07-11')
    expect(result.preferencesRevision).toBe(9)
    expect(result.targetsRevision).toBe(4)
  })

  it('carries each plan status through', () => {
    const statuses = ['active', 'superseded'] as const

    statuses.forEach(status => {
      expect(convertMealPlan(makePlan({status})).status).toBe(status)
    })
  })

  it('carries the incompatibility verdict through', () => {
    expect(convertMealPlan(makePlan({hasIncompatibilities: true})).hasIncompatibilities).toBe(true)
    expect(convertMealPlan(makePlan({hasIncompatibilities: false})).hasIncompatibilities).toBe(false)
  })

  it('returns an empty day list for a plan with no days', () => {
    expect(convertMealPlan(makePlan({days: []})).days).toEqual([])
  })
})

describe('convertRecipeVersion', () => {
  describe('the glyph and badges', () => {
    it('preserves every recognised icon key', () => {
      RECOGNISED_ICON_KEYS.forEach(iconKey => {
        expect(convertRecipeVersion(makeRecipeVersion({iconKey})).iconKey).toBe(iconKey)
      })
    })

    it('falls back to the generic bowl for an unrecognised icon key', () => {
      expect(convertRecipeVersion(makeRecipeVersion({iconKey: 'skillet'})).iconKey).toBe('bowl')
    })

    it('drops an unrecognised badge and keeps the recognised ones in order', () => {
      const recipe = makeRecipeVersion({badges: ['quick', 'low_fodmap', 'vegan']})

      expect(convertRecipeVersion(recipe).badges).toEqual(['quick', 'vegan'])
    })

    it('returns an empty badge list for a recipe without badges', () => {
      expect(convertRecipeVersion(makeRecipeVersion({badges: []})).badges).toEqual([])
    })
  })

  describe('meal slots', () => {
    it('preserves the recognised slots in the order sent', () => {
      const recipe = makeRecipeVersion({mealSlots: ['dinner', 'breakfast', 'snack', 'lunch']})

      expect(convertRecipeVersion(recipe).mealSlots).toEqual(['dinner', 'breakfast', 'snack', 'lunch'])
    })

    it('drops an unrecognised slot code', () => {
      const recipe = makeRecipeVersion({mealSlots: ['lunch', 'brunch', 'dinner']})

      expect(convertRecipeVersion(recipe).mealSlots).toEqual(['lunch', 'dinner'])
    })
  })

  describe('nutrition provenance', () => {
    it('preserves each recognised sourced provenance', () => {
      const provenances = ['source_backed', 'ingredient_derived', 'ai_estimated']

      provenances.forEach(nutritionProvenance => {
        const result = convertRecipeVersion(makeRecipeVersion({nutritionProvenance}))

        expect(result.nutritionProvenance).toBe(nutritionProvenance)
      })
    })

    it('resolves an unrecognised provenance to the weakest claim', () => {
      const result = convertRecipeVersion(makeRecipeVersion({nutritionProvenance: 'lab_measured'}))

      expect(result.nutritionProvenance).toBe('ai_estimated')
    })

    it('resolves a user-entered provenance to the weakest claim', () => {
      const result = convertRecipeVersion(makeRecipeVersion({nutritionProvenance: 'user_entered'}))

      expect(result.nutritionProvenance).toBe('ai_estimated')
    })
  })

  describe('ingredients', () => {
    it('maps every member of an ingredient', () => {
      const result = convertRecipeVersion(makeRecipeVersion())

      expect(result.ingredients[0]).toEqual({
        catalogFoodId: 'catalog-food-1',
        name: 'Chicken breast',
        quantity: 5,
        unit: 'oz',
        gramWeight: 142,
        displayText: '5 oz',
        nutritionProvenance: 'source_backed',
        isOptional: false
      })
    })

    it('maps the ingredients in the order sent', () => {
      const recipe = makeRecipeVersion({
        ingredients: [
          makeIngredient({catalogFoodId: 'catalog-food-3', name: 'Black beans'}),
          makeIngredient({catalogFoodId: 'catalog-food-1', name: 'Chicken breast'}),
          makeIngredient({catalogFoodId: 'catalog-food-2', name: 'Avocado'})
        ]
      })

      expect(convertRecipeVersion(recipe).ingredients.map(ingredient => ingredient.name)).toEqual([
        'Black beans',
        'Chicken breast',
        'Avocado'
      ])
    })

    it('carries the optional marker both ways', () => {
      const recipe = makeRecipeVersion({
        ingredients: [makeIngredient({isOptional: false}), makeIngredient({isOptional: true})]
      })

      const result = convertRecipeVersion(recipe)

      expect(result.ingredients[0].isOptional).toBe(false)
      expect(result.ingredients[1].isOptional).toBe(true)
    })

    it('resolves an unrecognised ingredient provenance to the weakest claim', () => {
      const recipe = makeRecipeVersion({
        ingredients: [
          makeIngredient({nutritionProvenance: 'ingredient_derived'}),
          makeIngredient({
            nutritionProvenance: 'chef_estimate'
          })
        ]
      })

      const result = convertRecipeVersion(recipe)

      expect(result.ingredients[0].nutritionProvenance).toBe('ingredient_derived')
      expect(result.ingredients[1].nutritionProvenance).toBe('ai_estimated')
    })

    it('returns an empty list for a recipe with no ingredients', () => {
      expect(convertRecipeVersion(makeRecipeVersion({ingredients: []})).ingredients).toEqual([])
    })
  })

  describe('instructions', () => {
    it('keeps the steps in the order sent', () => {
      const recipe = makeRecipeVersion({instructions: ['Warm the tortilla.', 'Spread the hummus.', 'Roll it up.']})

      expect(convertRecipeVersion(recipe).instructions).toEqual([
        'Warm the tortilla.',
        'Spread the hummus.',
        'Roll it up.'
      ])
    })

    it('returns an empty list when the response carries no steps', () => {
      expect(convertRecipeVersion(makeRecipeVersion({instructions: []})).instructions).toEqual([])
    })
  })

  describe('carried members', () => {
    it('maps the identity, description, tags and per-serving nutrition', () => {
      const result = convertRecipeVersion(makeRecipeVersion())

      expect(result.versionId).toBe('recipe-version-1')
      expect(result.recipeId).toBe('recipe-1')
      expect(result.version).toBe(1)
      expect(result.name).toBe('Chicken burrito bowl')
      expect(result.description).toBe('Seared chicken over brown rice with black beans.')
      expect(result.servingDescription).toBe('1 bowl')
      expect(result.dietTags).toEqual(['none'])
      expect(result.allergenTags).toEqual([])
      expect(result.perServing).toEqual({calories: 610, protein: 45, carbs: 58, fat: 21})
    })

    it('carries each recipe status through', () => {
      const statuses = ['current', 'retired'] as const

      statuses.forEach(status => {
        expect(convertRecipeVersion(makeRecipeVersion({status})).status).toBe(status)
      })
    })

    it('carries each allergen status through rather than defaulting it', () => {
      const allergenStatuses = ['known', 'unknown'] as const

      allergenStatuses.forEach(allergenStatus => {
        expect(convertRecipeVersion(makeRecipeVersion({allergenStatus})).allergenStatus).toBe(allergenStatus)
      })
    })

    it('carries each budget tier through rather than defaulting it', () => {
      const tiers = [1, 2, 3] as const

      tiers.forEach(budgetTier => {
        expect(convertRecipeVersion(makeRecipeVersion({budgetTier})).budgetTier).toBe(budgetTier)
      })
    })

    it('carries a no-prep recipe and a single-serving yield', () => {
      const recipe = makeRecipeVersion({prepMinutes: 0, cookMinutes: 15, totalMinutes: 15, yieldServings: 1})

      const result = convertRecipeVersion(recipe)

      expect(result.prepMinutes).toBe(0)
      expect(result.cookMinutes).toBe(15)
      expect(result.totalMinutes).toBe(15)
      expect(result.yieldServings).toBe(1)
    })

    it('carries a multi-serving yield', () => {
      expect(convertRecipeVersion(makeRecipeVersion({yieldServings: 4})).yieldServings).toBe(4)
    })
  })
})

describe('convertSwapAlternatives', () => {
  it('returns an empty list when nothing matches the slot', () => {
    const result = convertSwapAlternatives(makeAlternatives({alternatives: []}))

    expect(result.alternatives).toEqual([])
  })

  it('keeps the alternatives in the order sent', () => {
    const response = makeAlternatives({
      alternatives: [
        makeAlternative({recipeVersionId: 'recipe-version-2', name: 'Turkey and hummus wrap'}),
        makeAlternative({recipeVersionId: 'recipe-version-5', name: 'Chipotle chicken salad'}),
        makeAlternative({recipeVersionId: 'recipe-version-3', name: 'Beef and rice bowl'})
      ]
    })

    expect(convertSwapAlternatives(response).alternatives.map(alternative => alternative.recipeVersionId)).toEqual([
      'recipe-version-2',
      'recipe-version-5',
      'recipe-version-3'
    ])
  })

  it('maps every member of an alternative', () => {
    const result = convertSwapAlternatives(makeAlternatives())

    expect(result.alternatives[0]).toEqual({
      recipeVersionId: 'recipe-version-2',
      name: 'Turkey and hummus wrap',
      iconKey: 'wrap',
      calories: 540,
      protein: 38,
      totalMinutes: 15,
      portionMultiplier: 1
    })
  })

  it('falls back to the generic bowl for an unrecognised icon key on a row', () => {
    const response = makeAlternatives({alternatives: [makeAlternative({iconKey: 'skillet'})]})

    expect(convertSwapAlternatives(response).alternatives[0].iconKey).toBe('bowl')
  })

  it('passes an alternative portion multiplier through unrounded', () => {
    const response = makeAlternatives({alternatives: [makeAlternative({portionMultiplier: 1.75})]})

    expect(convertSwapAlternatives(response).alternatives[0].portionMultiplier).toBe(1.75)
  })

  it('maps the current meal through the meal converter', () => {
    const response = makeAlternatives({
      current: makeMeal({
        recipe: makeRecipeSummary({iconKey: 'skillet'}),
        flags: [{code: 'seasonal_unavailable', detail: ['asparagus']}]
      })
    })

    const result = convertSwapAlternatives(response)

    expect(result.current.recipe.iconKey).toBe('bowl')
    expect(result.current.flags).toEqual([])
  })
})

describe('convertSwapPreview', () => {
  it('maps the embedded recipe through the recipe converter', () => {
    const response = makeSwapPreview({
      alternative: {
        ...makeSwapPreview().alternative,
        recipe: makeRecipeVersion({iconKey: 'skillet', badges: ['low_fodmap', 'quick']})
      }
    })

    const result = convertSwapPreview(response)

    expect(result.alternative.recipe.iconKey).toBe('bowl')
    expect(result.alternative.recipe.badges).toEqual(['quick'])
  })

  it('passes the portion multiplier through unformatted', () => {
    expect(convertSwapPreview(makeSwapPreview()).alternative.portionMultiplier).toBe(1.25)
  })

  describe('the calorie delta', () => {
    it('keeps a negative delta as a signed number', () => {
      const result = convertSwapPreview(makeSwapPreview({calorieDelta: -70}))

      expect(result.calorieDelta).toBe(-70)
      expect(typeof result.calorieDelta).toBe('number')
    })

    it('keeps a positive delta as a number without a sign prefix', () => {
      const result = convertSwapPreview(makeSwapPreview({calorieDelta: 45}))

      expect(result.calorieDelta).toBe(45)
      expect(typeof result.calorieDelta).toBe('number')
    })

    it('keeps a zero delta', () => {
      expect(convertSwapPreview(makeSwapPreview({calorieDelta: 0})).calorieDelta).toBe(0)
    })
  })

  it('preserves the day totals, targets, portion text, nutrition and plan revision', () => {
    const result = convertSwapPreview(makeSwapPreview())

    expect(result.dayTotalsIfSwapped).toEqual({calories: 1835, protein: 135, carbs: 179, fat: 59})
    expect(result.targets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
    expect(result.alternative.portionText).toBe('1¼ servings')
    expect(result.alternative.nutrition).toEqual({calories: 540, protein: 38, carbs: 49, fat: 19})
    expect(result.planRevision).toBe(3)
  })
})

describe('convertGroceryItem', () => {
  it('returns a null flag for an item whose amount never went up', () => {
    expect(convertGroceryItem(makeGroceryItem()).flag).toBeNull()
  })

  it('maps all four members of a flag', () => {
    const result = convertGroceryItem(makeGroceryItem({isChecked: true, flag: makeGroceryFlag()}))

    expect(result.flag).toEqual({
      previousDisplayText: '2.5 lb',
      newDisplayText: '3.1 lb',
      deltaDisplayText: '+0.6 lb',
      flaggedAt: '2026-07-06T09:15:00.000Z'
    })
    expect(result.flag?.previousDisplayText).toBe('2.5 lb')
    expect(result.flag?.newDisplayText).toBe('3.1 lb')
    expect(result.flag?.deltaDisplayText).toBe('+0.6 lb')
    expect(result.flag?.flaggedAt).toBe('2026-07-06T09:15:00.000Z')
  })

  it('maps every member of the item', () => {
    const result = convertGroceryItem(makeGroceryItem())

    expect(result).toEqual({
      id: 'grocery-item-1',
      catalogFoodId: 'catalog-food-1',
      foodState: 'raw',
      name: 'Chicken breast',
      quantityGrams: 1134,
      displayText: '2.5 lb',
      isChecked: false,
      flag: null
    })
  })

  it('preserves a fractional gram quantity', () => {
    expect(convertGroceryItem(makeGroceryItem({quantityGrams: 2.51})).quantityGrams).toBe(2.51)
  })

  it('carries the checked state both ways', () => {
    expect(convertGroceryItem(makeGroceryItem({isChecked: true})).isChecked).toBe(true)
    expect(convertGroceryItem(makeGroceryItem({isChecked: false})).isChecked).toBe(false)
  })

  it('passes the server-rendered display text through verbatim', () => {
    const result = convertGroceryItem(makeGroceryItem({displayText: '6 tbsp', foodState: 'cooked'}))

    expect(result.displayText).toBe('6 tbsp')
    expect(result.foodState).toBe('cooked')
  })
})

describe('convertGroceryList', () => {
  it('keeps the sections and the items within each section in the order sent', () => {
    const response = makeGroceryList({
      sections: [
        {
          category: 'produce',
          items: [
            makeGroceryItem({id: 'item-spinach', name: 'Spinach'}),
            makeGroceryItem({id: 'item-avocado', name: 'Avocado'})
          ]
        },
        {category: 'protein', items: [makeGroceryItem({id: 'item-salmon', name: 'Salmon fillet'})]},
        {category: 'pantry_other', items: [makeGroceryItem({id: 'item-olive-oil', name: 'Olive oil'})]}
      ]
    })

    const result = convertGroceryList(response)

    expect(result.sections.map(section => section.category)).toEqual(['produce', 'protein', 'pantry_other'])
    expect(result.sections[0].items.map(item => item.id)).toEqual(['item-spinach', 'item-avocado'])
  })

  it('preserves every recognised aisle category', () => {
    const categories = ['produce', 'protein', 'dairy_alternatives', 'grains_bread', 'pantry_other']

    categories.forEach(category => {
      const response = makeGroceryList({sections: [{category, items: [makeGroceryItem()]}]})

      expect(convertGroceryList(response).sections[0].category).toBe(category)
    })
  })

  it('files an unrecognised aisle under the catch-all rather than dropping it', () => {
    const response = makeGroceryList({sections: [{category: 'frozen_foods', items: [makeGroceryItem()]}]})

    const result = convertGroceryList(response)

    expect(result.sections).toHaveLength(1)
    expect(result.sections[0].category).toBe('pantry_other')
    expect(result.sections[0].items).toHaveLength(1)
  })

  describe('the banner', () => {
    it('returns null when the response carries no banner', () => {
      expect(convertGroceryList(makeGroceryList({banner: null})).banner).toBeNull()
    })

    it('preserves the swap banner with its meal slot', () => {
      const response = makeGroceryList({banner: {code: 'updated_after_swap', mealSlot: 'lunch'}})

      const result = convertGroceryList(response)

      expect(result.banner?.code).toBe('updated_after_swap')
      expect(result.banner?.mealSlot).toBe('lunch')
      expect(result.banner?.itemNames).toBeUndefined()
    })

    it('preserves the increase banner with its item names', () => {
      const response = makeGroceryList({banner: {code: 'amount_increased', itemNames: ['Chicken breast']}})

      const result = convertGroceryList(response)

      expect(result.banner?.code).toBe('amount_increased')
      expect(result.banner?.itemNames).toEqual(['Chicken breast'])
    })

    it('drops the whole banner when the code is unrecognised', () => {
      const response = makeGroceryList({banner: {code: 'price_changed', mealSlot: 'dinner'}})

      expect(convertGroceryList(response).banner).toBeNull()
    })
  })

  it('maps the checked items through the item converter', () => {
    const response = makeGroceryList({
      checkedItems: [
        makeGroceryItem({id: 'item-chicken', isChecked: true, flag: makeGroceryFlag()}),
        makeGroceryItem({id: 'item-spinach', name: 'Spinach', isChecked: true, displayText: '7 cups'})
      ]
    })

    const result = convertGroceryList(response)

    expect(result.checkedItems.map(item => item.id)).toEqual(['item-chicken', 'item-spinach'])
    expect(result.checkedItems[0].flag).toEqual({
      previousDisplayText: '2.5 lb',
      newDisplayText: '3.1 lb',
      deltaDisplayText: '+0.6 lb',
      flaggedAt: '2026-07-06T09:15:00.000Z'
    })
    expect(result.checkedItems[1].flag).toBeNull()
  })

  it('carries the plan identity, dates and counts through', () => {
    const result = convertGroceryList(makeGroceryList())

    expect(result.planId).toBe('plan-1')
    expect(result.planRevision).toBe(3)
    expect(result.startDate).toBe('2026-07-05')
    expect(result.endDate).toBe('2026-07-11')
    expect(result.totalCount).toBe(14)
    expect(result.checkedCount).toBe(6)
  })

  it('preserves zero counts', () => {
    const result = convertGroceryList(makeGroceryList({totalCount: 0, checkedCount: 0}))

    expect(result.totalCount).toBe(0)
    expect(result.checkedCount).toBe(0)
  })

  it('returns an empty section list for a plan that needs no ingredients', () => {
    const result = convertGroceryList(makeGroceryList({sections: [], checkedItems: [], totalCount: 0}))

    expect(result.sections).toEqual([])
    expect(result.checkedItems).toEqual([])
  })
})

describe('convertAffectedMeals', () => {
  it('returns an empty list when no meal is flagged', () => {
    expect(convertAffectedMeals(makeAffectedMeals([]))).toEqual([])
  })

  it('keeps the rows in the order sent', () => {
    const response = makeAffectedMeals([
      makeAffectedMeal({mealId: 'meal-tuesday-dinner', date: '2026-07-07'}),
      makeAffectedMeal({mealId: 'meal-thursday-lunch', date: '2026-07-09', slot: 'lunch'}),
      makeAffectedMeal({mealId: 'meal-monday-breakfast', date: '2026-07-06', slot: 'breakfast'})
    ])

    expect(convertAffectedMeals(response).map(meal => meal.mealId)).toEqual([
      'meal-tuesday-dinner',
      'meal-thursday-lunch',
      'meal-monday-breakfast'
    ])
  })

  it('maps every member of a row', () => {
    expect(convertAffectedMeals(makeAffectedMeals([makeAffectedMeal()]))).toEqual([
      {
        mealId: 'meal-dinner',
        date: '2026-07-07',
        slot: 'dinner',
        recipeName: 'Creamy tomato pasta',
        flags: [{code: 'allergen', detail: ['milk']}]
      }
    ])
  })

  it('keeps a recognised flag code with its detail verbatim', () => {
    const response = makeAffectedMeals([
      makeAffectedMeal({flags: [{code: 'diet', detail: ['contains fish', 'contains milk']}]})
    ])

    expect(convertAffectedMeals(response)[0].flags).toEqual([
      {code: 'diet', detail: ['contains fish', 'contains milk']}
    ])
  })

  it('drops a flag carrying an unrecognised code', () => {
    const response = makeAffectedMeals([
      makeAffectedMeal({
        flags: [
          {code: 'cooking_time', detail: ['45 minutes']},
          {code: 'seasonal_unavailable', detail: ['asparagus']}
        ]
      })
    ])

    expect(convertAffectedMeals(response)[0].flags).toEqual([{code: 'cooking_time', detail: ['45 minutes']}])
  })

  it('returns an empty flag list when every code is unrecognised', () => {
    const response = makeAffectedMeals([makeAffectedMeal({flags: [{code: 'price_changed', detail: ['beef']}]})])

    expect(convertAffectedMeals(response)[0].flags).toEqual([])
  })

  it('carries each slot through', () => {
    RECOGNISED_SLOTS.forEach(slot => {
      expect(convertAffectedMeals(makeAffectedMeals([makeAffectedMeal({slot})]))[0].slot).toBe(slot)
    })
  })
})

const mockHttpGet = jest.mocked(httpGet)
const mockRecordError = jest.mocked(CrashUtility.recordError)

const makeAxiosError = (status: number, data: unknown): AxiosError =>
  new AxiosError('Request failed', 'ERR_BAD_REQUEST', undefined, undefined, {status, data} as AxiosResponse)

describe('fetchNutritionTargets', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('a 404 with no error code in the body', () => {
    it('resolves to null, because a backend without the route means no server targets', async () => {
      mockHttpGet.mockRejectedValue(makeAxiosError(404, {}))

      await expect(fetchNutritionTargets()).resolves.toBeNull()
    })

    it('records nothing, so a rolled-back backend does not report a crash per request', async () => {
      mockHttpGet.mockRejectedValue(makeAxiosError(404, {}))

      await fetchNutritionTargets()

      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe('a 404 carrying an error code', () => {
    it('rethrows the error unchanged', async () => {
      const error = makeAxiosError(404, {error: 'not_found'})

      mockHttpGet.mockRejectedValue(error)

      await expect(fetchNutritionTargets()).rejects.toBe(error)
    })

    it('records the error', async () => {
      const error = makeAxiosError(404, {error: 'not_found'})

      mockHttpGet.mockRejectedValue(error)

      await expect(fetchNutritionTargets()).rejects.toBe(error)
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(error)
    })
  })

  describe('a rejection that is not a bare 404', () => {
    it('rethrows and records a server failure', async () => {
      const error = makeAxiosError(500, {error: 'plan_generation_failed'})

      mockHttpGet.mockRejectedValue(error)

      await expect(fetchNutritionTargets()).rejects.toBe(error)
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(error)
    })

    it('rethrows and records a network error that carries no response', async () => {
      const error = new Error('network down')

      mockHttpGet.mockRejectedValue(error)

      await expect(fetchNutritionTargets()).rejects.toBe(error)
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(error)
    })
  })
})
