import {MacroTargetsResponse, MacroTotalsResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import {isLeft, isRight} from 'fp-ts/lib/Either'
import * as io from 'io-ts'

import {
  AffectedMealResponse,
  AffectedMealsResponse,
  GroceryItemResponse,
  GroceryListResponse,
  GroceryToggleResponse,
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

const decodeRight = <A>(codec: io.Decoder<unknown, A>, input: unknown): A => {
  const decoded = codec.decode(input)

  if (isLeft(decoded)) {
    const failedPaths = decoded.left.map(failure => failure.context.map(entry => entry.key).join('.'))

    throw new Error(`expected a Right but decoding failed at: ${failedPaths.join(', ')}`)
  }

  return decoded.right
}

const withoutMember = <T extends object>(value: T, member: keyof T & string): Record<string, unknown> => {
  const payload = {...value} as Record<string, unknown>

  delete payload[member]

  return payload
}

const makeTotals = (
  overrides: Partial<io.TypeOf<typeof MacroTotalsResponse>> = {}
): io.TypeOf<typeof MacroTotalsResponse> => ({
  calories: 610,
  protein: 45,
  carbs: 58,
  fat: 21,
  ...overrides
})

const makeMacroTargets = (
  overrides: Partial<io.TypeOf<typeof MacroTargetsResponse>> = {}
): io.TypeOf<typeof MacroTargetsResponse> => ({
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  ...overrides
})

const makeTargets = (
  overrides: Partial<io.TypeOf<typeof TargetsResponse>> = {}
): io.TypeOf<typeof TargetsResponse> => ({
  targets: makeMacroTargets(),
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 3,
  ...overrides
})

const makePreferences = (
  overrides: Partial<io.TypeOf<typeof PreferencesResponse>> = {}
): io.TypeOf<typeof PreferencesResponse> => ({
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
  budget: {amount: 75, currency: 'USD'},
  noBudgetPreference: false,
  budgetTier: 2,
  hasActivePlan: true,
  ...overrides
})

const makeFirstEntryPreferences = (): io.TypeOf<typeof PreferencesResponse> =>
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

const makeLoggedEntry = (
  overrides: Partial<io.TypeOf<typeof MealPlanMealResponse>['loggedEntries'][number]> = {}
): io.TypeOf<typeof MealPlanMealResponse>['loggedEntries'][number] => ({
  entryId: 'entry-1',
  date: '2026-07-05',
  mealName: 'Lunch',
  servings: 1,
  loggedAt: '2026-07-05T12:30:00.000Z',
  recipeVersionId: 'recipe-version-1',
  recipeName: 'Chicken burrito bowl',
  ...overrides
})

const makeMeal = (
  overrides: Partial<io.TypeOf<typeof MealPlanMealResponse>> = {}
): io.TypeOf<typeof MealPlanMealResponse> => ({
  id: 'meal-lunch',
  revision: 1,
  slot: 'lunch',
  slotTime: '12:30',
  sortOrder: 1,
  recipe: {
    versionId: 'recipe-version-1',
    recipeId: 'recipe-1',
    name: 'Chicken burrito bowl',
    iconKey: 'bowl',
    totalMinutes: 25,
    badges: ['high_protein'],
    nutritionProvenance: 'source_backed'
  },
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: makeTotals(),
  flags: [],
  loggedEntries: [],
  previousRecipe: null,
  ...overrides
})

const makeBreakfastMeal = (): io.TypeOf<typeof MealPlanMealResponse> =>
  makeMeal({
    id: 'meal-breakfast',
    slot: 'breakfast',
    slotTime: '08:00',
    sortOrder: 0,
    recipe: {
      versionId: 'recipe-version-2',
      recipeId: 'recipe-2',
      name: 'Greek yogurt bowl',
      iconKey: 'crosshair',
      totalMinutes: 10,
      badges: ['high_protein', 'quick'],
      nutritionProvenance: 'source_backed'
    },
    planned: makeTotals({calories: 420, protein: 32, carbs: 44, fat: 11})
  })

const makeDay = (
  overrides: Partial<io.TypeOf<typeof MealPlanDayResponse>> = {}
): io.TypeOf<typeof MealPlanDayResponse> => ({
  id: 'day-1',
  date: '2026-07-05',
  dayIndex: 0,
  plannedTotals: makeTotals({calories: 1905, protein: 142, carbs: 188, fat: 61}),
  isLastDay: false,
  meals: [makeBreakfastMeal(), makeMeal()],
  ...overrides
})

const makePlan = (overrides: Partial<io.TypeOf<typeof MealPlanResponse>> = {}): io.TypeOf<typeof MealPlanResponse> => ({
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

const makeIngredient = (
  overrides: Partial<io.TypeOf<typeof RecipeVersionResponse>['ingredients'][number]> = {}
): io.TypeOf<typeof RecipeVersionResponse>['ingredients'][number] => ({
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

const makeRecipeVersion = (
  overrides: Partial<io.TypeOf<typeof RecipeVersionResponse>> = {}
): io.TypeOf<typeof RecipeVersionResponse> => ({
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
  ingredients: [
    makeIngredient(),
    makeIngredient({
      catalogFoodId: 'catalog-food-2',
      name: 'Avocado',
      quantity: 0.25,
      unit: 'fruit',
      gramWeight: 50,
      displayText: '¼',
      isOptional: true
    })
  ],
  ...overrides
})

const makeAlternative = (
  overrides: Partial<io.TypeOf<typeof SwapAlternativeResponse>> = {}
): io.TypeOf<typeof SwapAlternativeResponse> => ({
  recipeVersionId: 'recipe-version-3',
  name: 'Turkey and hummus wrap',
  iconKey: 'wrap',
  calories: 540,
  protein: 38,
  totalMinutes: 15,
  portionMultiplier: 1,
  ...overrides
})

const makeSwapPreview = (
  overrides: Partial<io.TypeOf<typeof SwapPreviewResponse>> = {}
): io.TypeOf<typeof SwapPreviewResponse> => ({
  alternative: {
    recipe: makeRecipeVersion({versionId: 'recipe-version-3', recipeId: 'recipe-3', name: 'Turkey and hummus wrap'}),
    portionMultiplier: 1,
    portionText: '1 serving',
    nutrition: makeTotals({calories: 540, protein: 38, carbs: 49, fat: 19})
  },
  dayTotalsIfSwapped: makeTotals({calories: 1835, protein: 135, carbs: 179, fat: 59}),
  targets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65}),
  calorieDelta: -70,
  planRevision: 4,
  ...overrides
})

const makeGroceryItem = (
  overrides: Partial<io.TypeOf<typeof GroceryItemResponse>> = {}
): io.TypeOf<typeof GroceryItemResponse> => ({
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

const makeGroceryList = (
  overrides: Partial<io.TypeOf<typeof GroceryListResponse>> = {}
): io.TypeOf<typeof GroceryListResponse> => ({
  planId: 'plan-1',
  planRevision: 4,
  startDate: '2026-07-05',
  endDate: '2026-07-11',
  totalCount: 14,
  checkedCount: 0,
  banner: null,
  sections: [
    {
      category: 'produce',
      items: [makeGroceryItem({id: 'grocery-item-2', name: 'Spinach', quantityGrams: 210, displayText: '7 cups'})]
    },
    {category: 'protein', items: [makeGroceryItem()]}
  ],
  checkedItems: [],
  ...overrides
})

const makeAffectedMeal = (
  overrides: Partial<io.TypeOf<typeof AffectedMealResponse>> = {}
): io.TypeOf<typeof AffectedMealResponse> => ({
  mealId: 'meal-dinner',
  date: '2026-07-07',
  slot: 'dinner',
  recipeName: 'Beef and rice bowl',
  flags: [{code: 'allergen', detail: ['milk']}],
  ...overrides
})

describe('PreferencesResponse', () => {
  describe('setup vocabulary the client does not recognise', () => {
    it('carries an unknown setup status and step through verbatim', () => {
      const preferences = decodeRight(
        PreferencesResponse,
        makePreferences({setupStatus: 'awaiting_review', setupStep: 'brand_new_step'})
      )

      expect(preferences.setupStatus).toBe('awaiting_review')
      expect(preferences.setupStep).toBe('brand_new_step')
    })
  })

  describe('a user who has not started setup', () => {
    it('decodes a payload whose every optional member is null', () => {
      const payload = makeFirstEntryPreferences()
      const decoded = PreferencesResponse.decode(payload)
      const preferences = decodeRight(PreferencesResponse, payload)

      expect(isRight(decoded)).toBe(true)
      expect(preferences.setupStep).toBeNull()
      expect(preferences.timeZone).toBeNull()
      expect(preferences.weightUnitPref).toBeNull()
      expect(preferences.cookingTimeLimitMin).toBeNull()
      expect(preferences.budget).toBeNull()
      expect(preferences.budgetTier).toBeNull()
      expect(preferences.revision).toBe(0)
      expect(preferences.allergens).toEqual([])
      expect(preferences.dislikedFoods).toEqual([])
      expect(preferences.mealTimes).toEqual([])
    })
  })

  describe('a completed setup', () => {
    it('preserves the budget, the disliked foods and the allergen list', () => {
      const preferences = decodeRight(PreferencesResponse, makePreferences())

      expect(preferences.budget).toEqual({amount: 75, currency: 'USD'})
      expect(preferences.allergens).toEqual(['peanuts', 'tree_nuts'])
      expect(preferences.dislikedFoods.map(food => food.name)).toEqual(['Mushrooms, white', 'Olives'])
      expect(preferences.dislikedFoods[0].foodGroup).toBe('mushroom')
    })

    it('preserves the meal times in wire order rather than chronological order', () => {
      const preferences = decodeRight(PreferencesResponse, makePreferences())

      expect(preferences.mealTimes.map(mealTime => mealTime.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
      expect(preferences.mealTimes.map(mealTime => mealTime.time)).toEqual(['08:00', '12:30', '18:30', '15:30'])
    })
  })
})

describe('PreferencesSaveResponse', () => {
  it('composes the preferences payload with an affected-meal count of zero', () => {
    const saved = decodeRight(PreferencesSaveResponse, {preferences: makePreferences(), affectedMealCount: 0})

    expect(saved.affectedMealCount).toBe(0)
    expect(saved.preferences.revision).toBe(4)
  })

  it('carries an unknown nested setup status through verbatim', () => {
    const payload = {preferences: makePreferences({setupStatus: 'awaiting_review'}), affectedMealCount: 2}
    const saved = decodeRight(PreferencesSaveResponse, payload)

    expect(saved.preferences.setupStatus).toBe('awaiting_review')
    expect(saved.affectedMealCount).toBe(2)
  })
})

describe('TargetsResponse', () => {
  describe('per-field nullability', () => {
    it('decodes an account with no server targets at all', () => {
      const payload = makeTargets({targets: null, complete: false, source: null, stale: false, revision: 0})
      const decoded = TargetsResponse.decode(payload)
      const targets = decodeRight(TargetsResponse, payload)

      expect(isRight(decoded)).toBe(true)
      expect(targets.targets).toBeNull()
      expect(targets.complete).toBe(false)
      expect(targets.source).toBeNull()
      expect(targets.revision).toBe(0)
    })

    it('decodes a legacy account that carries calories only', () => {
      const targets = decodeRight(
        TargetsResponse,
        makeTargets({
          targets: makeMacroTargets({calories: 1900, protein: null, carbs: null, fat: null}),
          complete: false,
          source: 'legacy'
        })
      )

      expect(targets.targets?.calories).toBe(1900)
      expect(targets.targets?.protein).toBeNull()
      expect(targets.targets?.carbs).toBeNull()
      expect(targets.targets?.fat).toBeNull()
      expect(targets.complete).toBe(false)
      expect(targets.source).toBe('legacy')
    })

    it('decodes a complete confirmed set', () => {
      const targets = decodeRight(TargetsResponse, makeTargets({complete: true, source: 'estimated', revision: 3}))

      expect(targets.targets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
      expect(targets.complete).toBe(true)
      expect(targets.stale).toBe(false)
      expect(targets.revision).toBe(3)
    })
  })

  describe('a source the client does not recognise', () => {
    it('carries the source through verbatim', () => {
      expect(decodeRight(TargetsResponse, makeTargets({source: 'imported'})).source).toBe('imported')
    })
  })
})

describe('TargetsSaveResponse', () => {
  it('composes the targets payload with an empty feasibility warning list', () => {
    const saved = decodeRight(TargetsSaveResponse, {targets: makeTargets(), feasibility: {ok: true, warnings: []}})

    expect(saved.feasibility.ok).toBe(true)
    expect(saved.feasibility.warnings).toEqual([])
    expect(saved.targets.revision).toBe(3)
  })

  it('preserves a feasibility warning it does not recognise', () => {
    const payload = {
      targets: makeTargets({source: 'manual'}),
      feasibility: {ok: false, warnings: ['macro_energy_mismatch', 'brand_new_warning']}
    }
    const saved = decodeRight(TargetsSaveResponse, payload)

    expect(saved.feasibility.warnings).toEqual(['macro_energy_mismatch', 'brand_new_warning'])
    expect(saved.feasibility.ok).toBe(false)
  })
})

describe('MealPlanMealResponse', () => {
  describe('vocabulary the client does not recognise', () => {
    it('carries an unknown slot through verbatim', () => {
      expect(decodeRight(MealPlanMealResponse, makeMeal({slot: 'brunch'})).slot).toBe('brunch')
    })

    it('carries an unknown flag code through verbatim', () => {
      const meal = decodeRight(MealPlanMealResponse, makeMeal({flags: [{code: 'weather', detail: ['storm']}]}))

      expect(meal.flags[0].code).toBe('weather')
      expect(meal.flags[0].detail).toEqual(['storm'])
    })

    it('carries an unknown recipe icon key and badge through verbatim', () => {
      const meal = decodeRight(
        MealPlanMealResponse,
        makeMeal({
          recipe: {
            versionId: 'recipe-version-1',
            recipeId: 'recipe-1',
            name: 'Chicken burrito bowl',
            iconKey: 'space_food',
            totalMinutes: 25,
            badges: ['not_a_badge'],
            nutritionProvenance: 'lab_measured'
          }
        })
      )

      expect(meal.recipe.iconKey).toBe('space_food')
      expect(meal.recipe.badges).toEqual(['not_a_badge'])
      expect(meal.recipe.nutritionProvenance).toBe('lab_measured')
    })
  })

  describe('flags', () => {
    it('decodes a meal that carries no flags', () => {
      const decoded = MealPlanMealResponse.decode(makeMeal())

      expect(isRight(decoded)).toBe(true)
      expect(decodeRight(MealPlanMealResponse, makeMeal()).flags).toEqual([])
    })

    it('preserves several details under one code', () => {
      const payload = makeMeal({flags: [{code: 'allergen', detail: ['milk', 'sesame']}]})
      const meal = decodeRight(MealPlanMealResponse, payload)

      expect(meal.flags).toHaveLength(1)
      expect(meal.flags[0].detail).toEqual(['milk', 'sesame'])
    })

    it('preserves two entries that share one code', () => {
      const meal = decodeRight(
        MealPlanMealResponse,
        makeMeal({
          flags: [
            {code: 'dislike', detail: ['mushroom']},
            {code: 'dislike', detail: ['olive']}
          ]
        })
      )

      expect(meal.flags).toHaveLength(2)
      expect(meal.flags.map(flag => flag.detail[0])).toEqual(['mushroom', 'olive'])
    })
  })

  describe('loggedEntries', () => {
    it('decodes a meal that has never been logged', () => {
      const decoded = MealPlanMealResponse.decode(makeMeal())

      expect(isRight(decoded)).toBe(true)
      expect(decodeRight(MealPlanMealResponse, makeMeal()).loggedEntries).toEqual([])
    })

    it('preserves every member of a single logged entry', () => {
      const meal = decodeRight(MealPlanMealResponse, makeMeal({loggedEntries: [makeLoggedEntry()]}))

      expect(meal.loggedEntries).toHaveLength(1)
      expect(meal.loggedEntries[0]).toEqual({
        entryId: 'entry-1',
        date: '2026-07-05',
        mealName: 'Lunch',
        servings: 1,
        loggedAt: '2026-07-05T12:30:00.000Z',
        recipeVersionId: 'recipe-version-1',
        recipeName: 'Chicken burrito bowl'
      })
    })

    it('preserves three entries in the order the server sent them', () => {
      const entries = [
        makeLoggedEntry({entryId: 'entry-3', loggedAt: '2026-07-05T19:05:00.000Z'}),
        makeLoggedEntry({entryId: 'entry-1', loggedAt: '2026-07-05T12:30:00.000Z'}),
        makeLoggedEntry({entryId: 'entry-2', loggedAt: '2026-07-05T15:45:00.000Z', servings: 0.5})
      ]
      const meal = decodeRight(MealPlanMealResponse, makeMeal({loggedEntries: entries}))

      expect(meal.loggedEntries).toHaveLength(3)
      expect(meal.loggedEntries.map(entry => entry.entryId)).toEqual(['entry-3', 'entry-1', 'entry-2'])
      expect(meal.loggedEntries.map(entry => entry.loggedAt)).toEqual([
        '2026-07-05T19:05:00.000Z',
        '2026-07-05T12:30:00.000Z',
        '2026-07-05T15:45:00.000Z'
      ])
      expect(meal.loggedEntries[2].servings).toBe(0.5)
    })
  })

  describe('previousRecipe', () => {
    it('decodes a meal that has never been swapped', () => {
      expect(decodeRight(MealPlanMealResponse, makeMeal()).previousRecipe).toBeNull()
    })

    it('carries the replaced recipe through after a swap', () => {
      const meal = decodeRight(
        MealPlanMealResponse,
        makeMeal({previousRecipe: {versionId: 'recipe-version-1', name: 'Chicken burrito bowl'}})
      )

      expect(meal.previousRecipe).toEqual({versionId: 'recipe-version-1', name: 'Chicken burrito bowl'})
    })
  })

  describe('forward compatibility', () => {
    it('decodes a payload that carries a member the client does not know', () => {
      const payload = {...makeMeal(), somethingTheServerAddedLater: {enabled: true}}
      const decoded = MealPlanMealResponse.decode(payload)
      const meal = decodeRight(MealPlanMealResponse, payload)

      expect(isRight(decoded)).toBe(true)
      expect(meal.id).toBe('meal-lunch')
      expect(meal.planned).toEqual({calories: 610, protein: 45, carbs: 58, fat: 21})
    })
  })
})

describe('MealPlanDayResponse', () => {
  it('composes its meals and preserves the planned totals and the last-day flag', () => {
    const day = decodeRight(MealPlanDayResponse, makeDay({isLastDay: true}))

    expect(day.meals.map(meal => meal.slot)).toEqual(['breakfast', 'lunch'])
    expect(day.meals[0].recipe.name).toBe('Greek yogurt bowl')
    expect(day.meals[0].planned).toEqual({calories: 420, protein: 32, carbs: 44, fat: 11})
    expect(day.plannedTotals).toEqual({calories: 1905, protein: 142, carbs: 188, fat: 61})
    expect(day.isLastDay).toBe(true)
    expect(day.dayIndex).toBe(0)
  })

  it('decodes a day that has no meals', () => {
    const decoded = MealPlanDayResponse.decode(makeDay({meals: []}))

    expect(isRight(decoded)).toBe(true)
    expect(decodeRight(MealPlanDayResponse, makeDay({meals: []})).meals).toEqual([])
  })
})

describe('MealPlanResponse', () => {
  describe('a status the client does not recognise', () => {
    it('carries the plan status through verbatim', () => {
      expect(decodeRight(MealPlanResponse, makePlan({status: 'draft'})).status).toBe('draft')
    })
  })

  describe('targets, generationTargets and targetsStale', () => {
    it('keeps the current targets, the generation snapshot and the stale flag distinct', () => {
      const plan = decodeRight(
        MealPlanResponse,
        makePlan({
          targets: makeTotals({calories: 2100, protein: 158, carbs: 210, fat: 70}),
          generationTargets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65}),
          targetsStale: true
        })
      )

      expect(plan.targets).toEqual({calories: 2100, protein: 158, carbs: 210, fat: 70})
      expect(plan.generationTargets).toEqual({calories: 1940, protein: 146, carbs: 194, fat: 65})
      expect(plan.targetsStale).toBe(true)
      expect(plan.targets).not.toEqual(plan.generationTargets)
    })
  })

  describe('composition', () => {
    it('preserves the nested days, meals and recipe names', () => {
      const plan = decodeRight(
        MealPlanResponse,
        makePlan({days: [makeDay(), makeDay({id: 'day-2', date: '2026-07-06', dayIndex: 1, isLastDay: true})]})
      )

      expect(plan.days).toHaveLength(2)
      expect(plan.days[0].meals[0].recipe.name).toBe('Greek yogurt bowl')
      expect(plan.days[0].meals[1].portionText).toBe('1 serving')
      expect(plan.days[0].isLastDay).toBe(false)
      expect(plan.days[1].date).toBe('2026-07-06')
      expect(plan.days[1].isLastDay).toBe(true)
    })

    it('preserves the summary counts including zero', () => {
      const plan = decodeRight(
        MealPlanResponse,
        makePlan({summary: {plannedMeals: 21, groceryItemCount: 0, loggedEntryCount: 0}})
      )

      expect(plan.summary).toEqual({plannedMeals: 21, groceryItemCount: 0, loggedEntryCount: 0})
      expect(plan.generationAttempt).toBe(1)
      expect(plan.hasIncompatibilities).toBe(false)
    })
  })
})

describe('the current-and-upcoming plan envelope', () => {
  const PlanEnvelope = io.type({
    current: io.union([MealPlanResponse, io.null]),
    upcoming: io.union([MealPlanResponse, io.null])
  })

  it('decodes the answer a user with no plan receives', () => {
    const decoded = PlanEnvelope.decode({current: null, upcoming: null})
    const envelope = decodeRight(PlanEnvelope, {current: null, upcoming: null})

    expect(isRight(decoded)).toBe(true)
    expect(envelope.current).toBeNull()
    expect(envelope.upcoming).toBeNull()
  })

  it('decodes a current plan alongside no upcoming plan', () => {
    const envelope = decodeRight(PlanEnvelope, {current: makePlan(), upcoming: null})

    expect(envelope.upcoming).toBeNull()
    expect(envelope.current?.id).toBe('plan-1')
    expect(envelope.current?.days[0].meals).toHaveLength(2)
    expect(envelope.current?.days[0].meals[0].recipe.iconKey).toBe('crosshair')
  })
})

describe('RecipeVersionResponse', () => {
  describe('vocabulary the client does not recognise', () => {
    it('carries an unknown icon key through verbatim', () => {
      expect(decodeRight(RecipeVersionResponse, makeRecipeVersion({iconKey: 'space_food'})).iconKey).toBe('space_food')
    })

    it('preserves a badge list that contains an unknown code', () => {
      const recipe = decodeRight(RecipeVersionResponse, makeRecipeVersion({badges: ['high_protein', 'not_a_badge']}))

      expect(recipe.badges).toHaveLength(2)
      expect(recipe.badges).toEqual(['high_protein', 'not_a_badge'])
    })

    it('carries an unknown provenance on the recipe and on an ingredient through verbatim', () => {
      const recipe = decodeRight(
        RecipeVersionResponse,
        makeRecipeVersion({
          nutritionProvenance: 'lab_measured',
          ingredients: [
            makeIngredient(),
            makeIngredient({catalogFoodId: 'catalog-food-3', nutritionProvenance: 'vendor_declared'})
          ]
        })
      )

      expect(recipe.nutritionProvenance).toBe('lab_measured')
      expect(recipe.ingredients[0].nutritionProvenance).toBe('source_backed')
      expect(recipe.ingredients[1].nutritionProvenance).toBe('vendor_declared')
    })

    it('carries an unknown recipe status through verbatim', () => {
      expect(decodeRight(RecipeVersionResponse, makeRecipeVersion({status: 'archived'})).status).toBe('archived')
    })
  })

  describe('optional and empty members', () => {
    it('decodes a recipe with no description, instructions or ingredients', () => {
      const payload = makeRecipeVersion({description: null, instructions: [], ingredients: []})
      const decoded = RecipeVersionResponse.decode(payload)
      const recipe = decodeRight(RecipeVersionResponse, payload)

      expect(isRight(decoded)).toBe(true)
      expect(recipe.description).toBeNull()
      expect(recipe.instructions).toEqual([])
      expect(recipe.ingredients).toEqual([])
    })

    it('preserves the ingredient order and the optional-ingredient flag', () => {
      const recipe = decodeRight(RecipeVersionResponse, makeRecipeVersion())

      expect(recipe.ingredients.map(ingredient => ingredient.name)).toEqual(['Chicken breast', 'Avocado'])
      expect(recipe.ingredients[0].isOptional).toBe(false)
      expect(recipe.ingredients[1].isOptional).toBe(true)
      expect(recipe.ingredients[1].gramWeight).toBe(50)
      expect(recipe.perServing).toEqual({calories: 610, protein: 45, carbs: 58, fat: 21})
    })
  })
})

describe('SwapAlternativesResponse', () => {
  it('decodes the no-results answer as an empty alternatives list', () => {
    const payload = {current: makeMeal(), alternatives: []}
    const decoded = SwapAlternativesResponse.decode(payload)

    expect(isRight(decoded)).toBe(true)
    expect(decodeRight(SwapAlternativesResponse, payload).alternatives).toEqual([])
  })

  it('preserves the alternatives in the order the server ranked them', () => {
    const payload = {
      current: makeMeal(),
      alternatives: [
        makeAlternative(),
        makeAlternative({
          recipeVersionId: 'recipe-version-4',
          name: 'Chipotle chicken salad',
          iconKey: 'salad',
          calories: 585
        }),
        makeAlternative({
          recipeVersionId: 'recipe-version-5',
          name: 'Beef and rice bowl',
          iconKey: 'space_food',
          portionMultiplier: 0.75
        })
      ]
    }
    const alternatives = decodeRight(SwapAlternativesResponse, payload).alternatives

    expect(alternatives.map(alternative => alternative.recipeVersionId)).toEqual([
      'recipe-version-3',
      'recipe-version-4',
      'recipe-version-5'
    ])
    expect(alternatives[2].iconKey).toBe('space_food')
    expect(alternatives[2].portionMultiplier).toBe(0.75)
  })

  it('preserves the current meal alongside its alternatives', () => {
    const swap = decodeRight(SwapAlternativesResponse, {current: makeMeal(), alternatives: [makeAlternative()]})

    expect(swap.current.slot).toBe('lunch')
    expect(swap.current.recipe.name).toBe('Chicken burrito bowl')
  })
})

describe('SwapAlternativeResponse', () => {
  it('preserves the nutrition members an alternative row renders', () => {
    const alternative = decodeRight(SwapAlternativeResponse, makeAlternative())

    expect(alternative.calories).toBe(540)
    expect(alternative.protein).toBe(38)
    expect(alternative.totalMinutes).toBe(15)
  })
})

describe('SwapPreviewResponse', () => {
  it('composes the candidate recipe, the swapped day totals and a negative calorie delta', () => {
    const preview = decodeRight(SwapPreviewResponse, makeSwapPreview())

    expect(preview.alternative.recipe.name).toBe('Turkey and hummus wrap')
    expect(preview.alternative.nutrition).toEqual({calories: 540, protein: 38, carbs: 49, fat: 19})
    expect(preview.alternative.portionText).toBe('1 serving')
    expect(preview.dayTotalsIfSwapped.calories).toBe(1835)
    expect(preview.targets.calories).toBe(1940)
    expect(preview.calorieDelta).toBe(-70)
    expect(preview.planRevision).toBe(4)
  })

  it('preserves a positive calorie delta', () => {
    expect(decodeRight(SwapPreviewResponse, makeSwapPreview({calorieDelta: 85})).calorieDelta).toBe(85)
  })
})

describe('GroceryItemResponse', () => {
  describe('flag', () => {
    it('decodes an item that is not flagged', () => {
      const decoded = GroceryItemResponse.decode(makeGroceryItem())

      expect(isRight(decoded)).toBe(true)
      expect(decodeRight(GroceryItemResponse, makeGroceryItem()).flag).toBeNull()
    })

    it('preserves every member of an increase flag', () => {
      const item = decodeRight(
        GroceryItemResponse,
        makeGroceryItem({
          isChecked: true,
          quantityGrams: 1406,
          displayText: '3.1 lb',
          flag: {
            previousDisplayText: '2.5 lb',
            newDisplayText: '3.1 lb',
            deltaDisplayText: '+0.6 lb',
            flaggedAt: '2026-07-05T10:00:00.000Z'
          }
        })
      )

      expect(item.flag?.previousDisplayText).toBe('2.5 lb')
      expect(item.flag?.newDisplayText).toBe('3.1 lb')
      expect(item.flag?.deltaDisplayText).toBe('+0.6 lb')
      expect(item.flag?.flaggedAt).toBe('2026-07-05T10:00:00.000Z')
      expect(item.isChecked).toBe(true)
    })
  })

  describe('food state', () => {
    it('carries an unknown food state through verbatim', () => {
      expect(decodeRight(GroceryItemResponse, makeGroceryItem({foodState: 'fermented'})).foodState).toBe('fermented')
    })
  })
})

describe('GroceryListResponse', () => {
  describe('vocabulary the client does not recognise', () => {
    it('carries an unknown section category through verbatim', () => {
      const list = decodeRight(
        GroceryListResponse,
        makeGroceryList({sections: [{category: 'frozen', items: [makeGroceryItem()]}]})
      )

      expect(list.sections[0].category).toBe('frozen')
      expect(list.sections[0].items[0].name).toBe('Chicken breast')
    })

    it('carries an unknown banner code through verbatim', () => {
      const list = decodeRight(GroceryListResponse, makeGroceryList({banner: {code: 'something_new'}}))

      expect(list.banner?.code).toBe('something_new')
    })
  })

  describe('banner', () => {
    it('decodes a list with no banner', () => {
      const decoded = GroceryListResponse.decode(makeGroceryList())

      expect(isRight(decoded)).toBe(true)
      expect(decodeRight(GroceryListResponse, makeGroceryList()).banner).toBeNull()
    })

    it('preserves the members the server sends beside each banner code', () => {
      const afterSwap = decodeRight(
        GroceryListResponse,
        makeGroceryList({banner: {code: 'updated_after_swap', mealSlot: 'lunch'}})
      )
      const increased = decodeRight(
        GroceryListResponse,
        makeGroceryList({banner: {code: 'amount_increased', itemNames: ['Chicken breast']}})
      )

      expect(afterSwap.banner?.code).toBe('updated_after_swap')
      expect(afterSwap.banner?.mealSlot).toBe('lunch')
      expect(afterSwap.banner?.itemNames).toBeUndefined()
      expect(increased.banner?.itemNames).toEqual(['Chicken breast'])
      expect(increased.banner?.mealSlot).toBeUndefined()
    })
  })

  describe('sections and counts', () => {
    it('preserves the sections, the checked items and the counts', () => {
      const list = decodeRight(
        GroceryListResponse,
        makeGroceryList({checkedCount: 1, checkedItems: [makeGroceryItem({isChecked: true})]})
      )

      expect(list.sections.map(section => section.category)).toEqual(['produce', 'protein'])
      expect(list.sections[0].items[0].displayText).toBe('7 cups')
      expect(list.checkedItems).toHaveLength(1)
      expect(list.checkedItems[0].isChecked).toBe(true)
      expect(list.totalCount).toBe(14)
      expect(list.checkedCount).toBe(1)
    })

    it('decodes a plan whose grocery list is empty', () => {
      const payload = makeGroceryList({totalCount: 0, checkedCount: 0, sections: [], checkedItems: []})
      const decoded = GroceryListResponse.decode(payload)
      const list = decodeRight(GroceryListResponse, payload)

      expect(isRight(decoded)).toBe(true)
      expect(list.sections).toEqual([])
      expect(list.checkedItems).toEqual([])
      expect(list.totalCount).toBe(0)
      expect(list.checkedCount).toBe(0)
    })
  })
})

describe('GroceryToggleResponse', () => {
  it('composes the toggled item with the new checked count', () => {
    const toggled = decodeRight(GroceryToggleResponse, {item: makeGroceryItem({isChecked: true}), checkedCount: 1})

    expect(toggled.item.isChecked).toBe(true)
    expect(toggled.item.flag).toBeNull()
    expect(toggled.checkedCount).toBe(1)
  })

  it('decodes the response that unchecks the last remaining item', () => {
    const toggled = decodeRight(GroceryToggleResponse, {item: makeGroceryItem(), checkedCount: 0})

    expect(toggled.item.isChecked).toBe(false)
    expect(toggled.checkedCount).toBe(0)
  })
})

describe('AffectedMealResponse', () => {
  it('carries an unknown slot and flag code through verbatim', () => {
    const meal = decodeRight(
      AffectedMealResponse,
      makeAffectedMeal({slot: 'brunch', flags: [{code: 'weather', detail: ['storm', 'flood']}]})
    )

    expect(meal.slot).toBe('brunch')
    expect(meal.flags[0].code).toBe('weather')
    expect(meal.flags[0].detail).toEqual(['storm', 'flood'])
  })
})

describe('AffectedMealsResponse', () => {
  it('decodes a plan with no affected meals', () => {
    const decoded = AffectedMealsResponse.decode({meals: []})

    expect(isRight(decoded)).toBe(true)
    expect(decodeRight(AffectedMealsResponse, {meals: []}).meals).toEqual([])
  })

  it('preserves each affected meal in the order the server sent them', () => {
    const payload = {
      meals: [
        makeAffectedMeal(),
        makeAffectedMeal({
          mealId: 'meal-lunch',
          date: '2026-07-09',
          slot: 'lunch',
          recipeName: 'Chicken burrito bowl',
          flags: [{code: 'dislike', detail: ['mushroom']}]
        })
      ]
    }
    const meals = decodeRight(AffectedMealsResponse, payload).meals

    expect(meals.map(meal => meal.mealId)).toEqual(['meal-dinner', 'meal-lunch'])
    expect(meals[0].flags[0].detail).toEqual(['milk'])
    expect(meals[1].date).toBe('2026-07-09')
    expect(meals[1].flags[0].code).toBe('dislike')
  })
})

describe('invalid payloads', () => {
  it('rejects a plan that is missing its identifier', () => {
    const decoded = MealPlanResponse.decode(withoutMember(makePlan(), 'id'))

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a plan that is missing its revision', () => {
    const decoded = MealPlanResponse.decode(withoutMember(makePlan(), 'revision'))

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a day whose meal is missing its planned totals', () => {
    const decoded = MealPlanDayResponse.decode({...makeDay(), meals: [withoutMember(makeMeal(), 'planned')]})

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a grocery list whose item is missing its display text', () => {
    const decoded = GroceryListResponse.decode({
      ...makeGroceryList(),
      sections: [{category: 'produce', items: [withoutMember(makeGroceryItem(), 'displayText')]}]
    })

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a save envelope whose nested preferences are missing a member', () => {
    const decoded = PreferencesSaveResponse.decode({
      preferences: withoutMember(makePreferences(), 'noBudgetPreference'),
      affectedMealCount: 0
    })

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a targets payload whose revision arrives as a string', () => {
    const decoded = TargetsResponse.decode({...makeTargets(), revision: '3'})

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects planned totals that arrive as strings', () => {
    const decoded = MealPlanResponse.decode({...makePlan(), targets: {...makeTotals(), calories: '1940'}})

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a meal whose planned totals are null', () => {
    const decoded = MealPlanMealResponse.decode({...makeMeal(), planned: null})

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a meal whose flag details are not a list', () => {
    const decoded = MealPlanMealResponse.decode({...makeMeal(), flags: [{code: 'allergen', detail: 'milk'}]})

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a grocery banner that arrives without a code', () => {
    const decoded = GroceryListResponse.decode({...makeGroceryList(), banner: {mealSlot: 'lunch'}})

    expect(isLeft(decoded)).toBe(true)
  })

  it('rejects a recipe whose ingredient list is a single object', () => {
    const decoded = RecipeVersionResponse.decode({...makeRecipeVersion(), ingredients: makeIngredient()})

    expect(isLeft(decoded)).toBe(true)
  })
})
