import {MacroTargetsResponse, MacroTotalsResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import CrashUtility, {describeDecodeFailure} from '@utility/CrashUtility'
import {isLeft, isRight} from 'fp-ts/lib/Either'
import * as io from 'io-ts'

import {
  AffectedMealResponse,
  AffectedMealsResponse,
  CurrentMealPlanResponse,
  GroceryItemResponse,
  GroceryListResponse,
  GroceryToggleResponse,
  MealPlanDayEnvelopeResponse,
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

// The native Crashlytics module does not exist under Jest, and the canary below reaches the real reporting
// boundary rather than a copy of it. `jest.mock` is hoisted above every import here, so CrashUtility loads
// against the fake.
jest.mock('@react-native-firebase/crashlytics', () => ({__esModule: true, default: () => ({recordError: jest.fn()})}))

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

// A payload carrying a value the codec's type no longer admits. The fixture builders are typed against the
// codecs, so an out-of-vocabulary or malformed value cannot be passed through them — and refusing it is the
// behaviour under test, which is exactly why it has to be written as untyped wire data.
const withMembers = <T extends object>(value: T, members: Record<string, unknown>): Record<string, unknown> => ({
  ...value,
  ...members
})

const expectRefused = (codec: io.Decoder<unknown, unknown>, input: unknown): void => {
  expect(isLeft(codec.decode(input))).toBe(true)
}

const expectAccepted = (codec: io.Decoder<unknown, unknown>, input: unknown): void => {
  expect(isRight(codec.decode(input))).toBe(true)
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
  generationKey: 'gen-key-1',
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

// Every code set on this response is closed, and the decoder is where that closure is enforced: the member
// the client reads as "this user has not started setup" must not be satisfiable by a value the server never
// defined, or a completed setup reads as a fresh one.
const PREFERENCE_VOCABULARIES: {member: string; accepted: unknown[]; refused: unknown[]}[] = [
  {
    member: 'setupStatus',
    accepted: ['not_started', 'in_progress', 'ready_for_review', 'completed'],
    refused: ['awaiting_review', 'NOT_STARTED', 'not started', '', null, 1]
  },
  {
    member: 'setupStep',
    accepted: ['goal', 'body', 'activity', 'diet', 'dislikes', 'schedule', 'cooking', 'review', 'targets_manual', null],
    refused: ['brand_new_step', 'targets', '', 3]
  },
  {member: 'targetRoute', accepted: ['estimated', 'manual', null], refused: ['calculated', '']},
  {member: 'goal', accepted: ['lose', 'maintain', 'gain', null], refused: ['recomposition', 'Lose', '']},
  {member: 'paceLbPerWeek', accepted: [0.5, 1, 1.5, null], refused: [2, 0, 0.75, '1']},
  {
    member: 'sexForEstimate',
    accepted: ['female', 'male', 'prefer_not_to_say', null],
    refused: ['unspecified', 'Female', '']
  },
  {member: 'heightUnitPref', accepted: ['ft_in', 'cm', null], refused: ['inches', 'm', '']},
  {member: 'weightUnitPref', accepted: ['lb', 'kg', null], refused: ['st', 'lbs', '']},
  {
    member: 'activityLevel',
    accepted: ['not_very_active', 'lightly_active', 'active', 'very_active', null],
    refused: ['extremely_active', 'sedentary', '']
  },
  {
    member: 'diet',
    accepted: ['none', 'vegetarian', 'vegan', 'pescatarian', null],
    refused: ['keto', 'no_specific_diet', '']
  },
  {member: 'mealSchedule', accepted: ['three', 'three_plus_snack', null], refused: ['four', 'three_plus_two', '']},
  {member: 'cookingTimeLimitMin', accepted: [15, 30, 45, 60, null], refused: [90, 20, 0, '30']},
  {member: 'budgetTier', accepted: [1, 2, 3, null], refused: [0, 4, '2']}
]

describe('PreferencesResponse', () => {
  describe('closed setup and preference vocabularies', () => {
    it.each(PREFERENCE_VOCABULARIES)('accepts every $member the contract defines', ({member, accepted}) => {
      accepted.forEach(value => expectAccepted(PreferencesResponse, withMembers(makePreferences(), {[member]: value})))
    })

    it.each(PREFERENCE_VOCABULARIES)('refuses a $member the contract does not define', ({member, refused}) => {
      refused.forEach(value => expectRefused(PreferencesResponse, withMembers(makePreferences(), {[member]: value})))
    })

    it('refuses a meal time whose slot is not one of the four', () => {
      expectRefused(PreferencesResponse, withMembers(makePreferences(), {mealTimes: [{slot: 'brunch', time: '10:30'}]}))
    })

    it('accepts a meal time for each of the four slots', () => {
      expectAccepted(
        PreferencesResponse,
        withMembers(makePreferences(), {
          mealTimes: [
            {slot: 'breakfast', time: '08:00'},
            {slot: 'lunch', time: '12:30'},
            {slot: 'dinner', time: '18:30'},
            {slot: 'snack', time: '15:30'}
          ]
        })
      )
    })

    it('keeps the open data lists open, because their values are catalog data rather than contract codes', () => {
      const preferences = decodeRight(
        PreferencesResponse,
        withMembers(makePreferences(), {
          allergens: ['sesame', 'a_new_allergen_code'],
          dislikedFoodGroups: ['mushroom', 'a_new_food_group'],
          dislikedFoods: [{id: 'catalog-food-11', name: 'Natto', foodGroup: 'a_new_food_group'}]
        })
      )

      expect(preferences.allergens).toEqual(['sesame', 'a_new_allergen_code'])
      expect(preferences.dislikedFoodGroups).toEqual(['mushroom', 'a_new_food_group'])
      expect(preferences.dislikedFoods[0].foodGroup).toBe('a_new_food_group')
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

  it('refuses a nested setup status the contract does not define', () => {
    const payload = {
      preferences: withMembers(makePreferences(), {setupStatus: 'awaiting_review'}),
      affectedMealCount: 2
    }

    expectRefused(PreferencesSaveResponse, payload)
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
  describe('the closed slot and provenance members', () => {
    it('accepts each of the four slots', () => {
      ;['breakfast', 'lunch', 'dinner', 'snack'].forEach(slot =>
        expectAccepted(MealPlanMealResponse, withMembers(makeMeal(), {slot}))
      )
    })

    it('refuses a slot that is not one of the four', () => {
      ;['brunch', 'Breakfast', 'second_dinner', '', null].forEach(slot =>
        expectRefused(MealPlanMealResponse, withMembers(makeMeal(), {slot}))
      )
    })

    it('refuses a planned recipe that claims any provenance other than source-backed', () => {
      const meal = makeMeal()

      ;['ingredient_derived', 'ai_estimated', 'user_entered', 'lab_measured'].forEach(nutritionProvenance =>
        expectRefused(MealPlanMealResponse, {...meal, recipe: {...meal.recipe, nutritionProvenance}})
      )
    })
  })

  describe('vocabulary the client does not recognise', () => {
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
            nutritionProvenance: 'source_backed'
          }
        })
      )

      expect(meal.recipe.iconKey).toBe('space_food')
      expect(meal.recipe.badges).toEqual(['not_a_badge'])
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
  describe('the closed status member', () => {
    it('accepts both statuses the contract defines', () => {
      expect(decodeRight(MealPlanResponse, makePlan({status: 'active'})).status).toBe('active')
      expect(decodeRight(MealPlanResponse, makePlan({status: 'superseded'})).status).toBe('superseded')
    })

    // The status is what decides whether Swap and Log are offered, so an unrecognised one must not read as
    // an active plan: that would enable writes the server answers with 409 plan_not_active.
    it('refuses a status the contract does not define', () => {
      ;['draft', 'ended', 'ACTIVE', '', null].forEach(status =>
        expectRefused(MealPlanResponse, withMembers(makePlan(), {status}))
      )
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

  // `generationKey` is not one of the members the contract declares (0.5.2), so requiring it would refuse a
  // conforming plan response — a whole week of meals lost over a member nothing promised. It is decoded as an
  // extra instead: present when this server sends it, and simply absent otherwise.
  describe('the additive generation key', () => {
    it('accepts a plan that carries no generation key, and every other member with it', () => {
      const contractOnly = withoutMember(makePlan(), 'generationKey')

      expectAccepted(MealPlanResponse, contractOnly)

      const plan = decodeRight(MealPlanResponse, contractOnly)

      expect(plan.generationKey).toBeUndefined()
      expect(plan.id).toBe('plan-1')
      expect(plan.days[0].meals).toHaveLength(2)
    })

    it('carries the key through when it is sent, and admits an explicit null', () => {
      expect(decodeRight(MealPlanResponse, makePlan()).generationKey).toBe('gen-key-1')
      expect(decodeRight(MealPlanResponse, withMembers(makePlan(), {generationKey: null})).generationKey).toBeNull()
    })

    // A non-string key could only ever compare false, silently, against the key a screen is holding.
    it('refuses a key of the wrong type', () => {
      expectRefused(MealPlanResponse, withMembers(makePlan(), {generationKey: 7}))
    })

    it('accepts the whole current-plan envelope with neither plan carrying a key', () => {
      expectAccepted(CurrentMealPlanResponse, {
        current: withoutMember(makePlan(), 'generationKey'),
        upcoming: null
      })
    })
  })
})

// The codec under test here is the one `fetchCurrentMealPlan` passes to httpGet, imported rather than
// re-declared: a second definition would keep this suite green while production validated something else.
/**
 * THE MALFORMED-PLAN CANARY, on the production codec.
 *
 * The finding this guards was not that one hand-written codec could leak: it was that ANY response failing
 * `MealPlanResponse` went through a boundary that serialised io-ts failures, and a plan response is the largest
 * body this app decodes — a week of meal names, calorie and macro targets, dates, recipe and entry ids. So the
 * canary drives the real codec with a realistic plan and asserts that nothing in it survives into what the
 * shared boundary reports (CWE-532). A codec change that tightens a member cannot reintroduce the leak without
 * failing here.
 */
describe('MealPlanResponse decode failures reaching telemetry', () => {
  // Every value in the fixture that identifies a person's week, flattened. Member NAMES are schema and may be
  // reported; these are the values.
  const PLAN_VALUES = [
    'plan-1',
    'gen-key-1',
    'Greek yogurt bowl',
    'Chicken burrito bowl',
    'recipe-version-1',
    'recipe-version-2',
    'entry-1',
    '2026-07-05',
    '2026-07-11',
    '1940',
    '146',
    '194',
    '1905',
    '420',
    'four hundred and twenty'
  ]

  // A plan that fails deep inside the real codec, the way a server drift would: one nutrition number arrives as
  // prose, and one target as a string. Everything else is the ordinary fixture.
  const malformedPlan = (): unknown => {
    // Narrowed to exactly the two members being corrupted rather than widened to `any`: the fixture stays a
    // real plan everywhere else, which is the whole point of decoding it through the production codec.
    const plan = makePlan({
      days: [makeDay({meals: [makeBreakfastMeal(), makeMeal()]})],
      targets: makeTotals({calories: 1940, protein: 146, carbs: 194, fat: 65})
    }) as unknown as {
      days: {meals: {planned: {calories: unknown}}[]}[]
      targets: {protein: unknown}
    }

    plan.days[0].meals[0].planned.calories = 'four hundred and twenty'
    plan.targets.protein = '146'

    return plan
  }

  const planFailures = (): io.Errors => {
    const decoded = MealPlanResponse.decode(malformedPlan())

    if (isRight(decoded)) {
      throw new Error('expected the malformed plan to fail MealPlanResponse')
    }

    return decoded.left
  }

  it('names where the real codec failed, so the report is still actionable', () => {
    const description = describeDecodeFailure(planFailures())

    expect(description).toContain('days.0.meals.0.planned.calories')
    expect(description).toContain('expected number')
  })

  it('reports no value from the plan, at any depth', () => {
    const description = describeDecodeFailure(planFailures())

    PLAN_VALUES.forEach(value => expect(description).not.toContain(value))
    expect(description).not.toContain('actual')
  })

  it('leaks nothing through the shared boundary message — neither the body nor the requested URL', () => {
    const error = CrashUtility.recordDecodeFailure(
      'GET',
      'https://api.example.com/api/meal-planning/plans/3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b/days/2026-07-05',
      planFailures()
    )

    expect(error.message).toContain('GET')
    expect(error.message).toContain('/api/meal-planning/plans/:id/days/:date')
    expect(error.message).toContain('days.0.meals.0.planned.calories')
    PLAN_VALUES.forEach(value => expect(error.message).not.toContain(value))
    expect(error.message).not.toContain('3f2a1b4c')
  })
})

describe('CurrentMealPlanResponse', () => {
  const makeUpcomingPlan = (): io.TypeOf<typeof MealPlanResponse> =>
    makePlan({
      id: 'plan-2',
      startDate: '2026-07-12',
      endDate: '2026-07-18',
      days: [makeDay({id: 'day-8', date: '2026-07-12'})]
    })

  it('decodes the answer a user with no plan receives', () => {
    const decoded = CurrentMealPlanResponse.decode({current: null, upcoming: null})
    const envelope = decodeRight(CurrentMealPlanResponse, {current: null, upcoming: null})

    expect(isRight(decoded)).toBe(true)
    expect(envelope.current).toBeNull()
    expect(envelope.upcoming).toBeNull()
  })

  it('decodes a current plan alongside no upcoming plan', () => {
    const envelope = decodeRight(CurrentMealPlanResponse, {current: makePlan(), upcoming: null})

    expect(envelope.upcoming).toBeNull()
    expect(envelope.current?.id).toBe('plan-1')
    expect(envelope.current?.days[0].meals).toHaveLength(2)
    expect(envelope.current?.days[0].meals[0].recipe.iconKey).toBe('crosshair')
  })

  it('decodes an upcoming plan alongside no current plan, which is the week after this one ends', () => {
    const envelope = decodeRight(CurrentMealPlanResponse, {current: null, upcoming: makeUpcomingPlan()})

    expect(envelope.current).toBeNull()
    expect(envelope.upcoming?.id).toBe('plan-2')
    expect(envelope.upcoming?.startDate).toBe('2026-07-12')
  })

  it('decodes both plans and keeps each on its own member', () => {
    const envelope = decodeRight(CurrentMealPlanResponse, {current: makePlan(), upcoming: makeUpcomingPlan()})

    expect(envelope.current?.id).toBe('plan-1')
    expect(envelope.current?.startDate).toBe('2026-07-05')
    expect(envelope.upcoming?.id).toBe('plan-2')
    expect(envelope.upcoming?.startDate).toBe('2026-07-12')
  })

  // Both members are always sent, so an absent one is a contract break rather than "no plan": admitting it
  // would let a response that carries only `current` read as a user with no upcoming week.
  it('refuses an envelope missing either member', () => {
    expectRefused(CurrentMealPlanResponse, withoutMember({current: null, upcoming: null}, 'current'))
    expectRefused(CurrentMealPlanResponse, withoutMember({current: makePlan(), upcoming: null}, 'upcoming'))
  })

  it('refuses an undefined member, which is not the explicit null the contract sends', () => {
    expectRefused(CurrentMealPlanResponse, {current: undefined, upcoming: null})
    expectRefused(CurrentMealPlanResponse, {current: null, upcoming: undefined})
  })

  it('refuses an envelope whose plan is malformed rather than admitting a partial plan', () => {
    expectRefused(CurrentMealPlanResponse, {current: withoutMember(makePlan(), 'days'), upcoming: null})
    expectRefused(CurrentMealPlanResponse, {current: null, upcoming: withMembers(makePlan(), {status: 'draft'})})
  })

  it('refuses a body that is not the envelope at all', () => {
    expectRefused(CurrentMealPlanResponse, makePlan())
    expectRefused(CurrentMealPlanResponse, null)
    expectRefused(CurrentMealPlanResponse, [])
  })
})

// The codec `fetchMealPlanDay` passes to httpGet, imported for the reason the envelope above states.
describe('MealPlanDayEnvelopeResponse', () => {
  const makeEnvelope = (
    overrides: Partial<io.TypeOf<typeof MealPlanDayEnvelopeResponse>> = {}
  ): io.TypeOf<typeof MealPlanDayEnvelopeResponse> => ({
    planId: 'plan-1',
    planRevision: 3,
    planStatus: 'active',
    planLifecycle: 'active',
    isWritable: true,
    day: makeDay(),
    ...overrides
  })

  it('decodes a live plan’s day with its writeability verdict', () => {
    const envelope = decodeRight(MealPlanDayEnvelopeResponse, makeEnvelope())

    expect(envelope.planRevision).toBe(3)
    expect(envelope.planLifecycle).toBe('active')
    expect(envelope.isWritable).toBe(true)
    expect(envelope.day.meals).toHaveLength(2)
  })

  it('decodes a finished week, whose stored status is still active', () => {
    const envelope = decodeRight(
      MealPlanDayEnvelopeResponse,
      makeEnvelope({planStatus: 'active', planLifecycle: 'ended', isWritable: false})
    )

    expect(envelope.planStatus).toBe('active')
    expect(envelope.planLifecycle).toBe('ended')
    expect(envelope.isWritable).toBe(false)
  })

  // Loose on purpose, unlike MealPlanResponse.status: a lifecycle a newer server introduces should leave the
  // day read-only (the converter's conservative fallback) rather than fail the whole read.
  it('carries a lifecycle this build does not recognise through verbatim', () => {
    expect(decodeRight(MealPlanDayEnvelopeResponse, makeEnvelope({planLifecycle: 'frozen'})).planLifecycle).toBe(
      'frozen'
    )
  })

  // The contract is `{planId, planRevision, planStatus, day}` (0.5.2) and the two lifecycle members are
  // additive extras, so a response carrying only the contract has to decode: refusing it would reject a
  // conforming server outright and leave the screen with no day at all. The verdict is then resolved from
  // `planStatus` by `convertMealPlanDayEnvelope`, whose own tests cover that fallback.
  it('accepts an envelope that carries only the four members the contract declares', () => {
    const contractOnly = withoutMember(withoutMember(makeEnvelope(), 'isWritable'), 'planLifecycle')

    expectAccepted(MealPlanDayEnvelopeResponse, contractOnly)

    const envelope = decodeRight(MealPlanDayEnvelopeResponse, contractOnly)

    expect(envelope.planStatus).toBe('active')
    expect(envelope.isWritable).toBeUndefined()
    expect(envelope.planLifecycle).toBeUndefined()
    expect(envelope.day.meals).toHaveLength(2)
  })

  it('accepts either extra on its own, and an explicit null for either', () => {
    expectAccepted(MealPlanDayEnvelopeResponse, withoutMember(makeEnvelope(), 'planLifecycle'))
    expectAccepted(MealPlanDayEnvelopeResponse, withoutMember(makeEnvelope(), 'isWritable'))
    expectAccepted(MealPlanDayEnvelopeResponse, withMembers(makeEnvelope(), {isWritable: null, planLifecycle: null}))
  })

  // Absent is "no verdict sent"; the wrong type is a malformed one, and admitting it would let a non-boolean
  // decide a write gate by truthiness.
  it('refuses an extra of the wrong type', () => {
    expectRefused(MealPlanDayEnvelopeResponse, withMembers(makeEnvelope(), {isWritable: 'true'}))
    expectRefused(MealPlanDayEnvelopeResponse, withMembers(makeEnvelope(), {planLifecycle: 3}))
  })

  it('refuses an envelope missing the plan facts a write pins itself to', () => {
    expectRefused(MealPlanDayEnvelopeResponse, withoutMember(makeEnvelope(), 'planId'))
    expectRefused(MealPlanDayEnvelopeResponse, withoutMember(makeEnvelope(), 'planRevision'))
    expectRefused(MealPlanDayEnvelopeResponse, withoutMember(makeEnvelope(), 'planStatus'))
    expectRefused(MealPlanDayEnvelopeResponse, withoutMember(makeEnvelope(), 'day'))
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

    it('preserves a meal-slot list that contains an unknown code', () => {
      const recipe = decodeRight(RecipeVersionResponse, makeRecipeVersion({mealSlots: ['lunch', 'brunch']}))

      expect(recipe.mealSlots).toEqual(['lunch', 'brunch'])
    })
  })

  describe('the closed status, allergen-status and budget-tier members', () => {
    it('accepts the values the contract defines', () => {
      expect(decodeRight(RecipeVersionResponse, makeRecipeVersion({status: 'current'})).status).toBe('current')
      expect(decodeRight(RecipeVersionResponse, makeRecipeVersion({status: 'retired'})).status).toBe('retired')
      expect(decodeRight(RecipeVersionResponse, makeRecipeVersion({allergenStatus: 'unknown'})).allergenStatus).toBe(
        'unknown'
      )
      ;[1, 2, 3].forEach(budgetTier =>
        expectAccepted(RecipeVersionResponse, withMembers(makeRecipeVersion(), {budgetTier}))
      )
    })

    it('refuses a status outside current and retired', () => {
      ;['archived', 'candidate', 'published', '', null].forEach(status =>
        expectRefused(RecipeVersionResponse, withMembers(makeRecipeVersion(), {status}))
      )
    })

    it('refuses an allergen status outside known and unknown', () => {
      ;['partial', 'Known', '', null].forEach(allergenStatus =>
        expectRefused(RecipeVersionResponse, withMembers(makeRecipeVersion(), {allergenStatus}))
      )
    })

    it('refuses a budget tier outside the three bands', () => {
      ;[0, 4, 1.5, '2', null].forEach(budgetTier =>
        expectRefused(RecipeVersionResponse, withMembers(makeRecipeVersion(), {budgetTier}))
      )
    })
  })

  describe('optional and empty members', () => {
    it('decodes a recipe with an empty description, no instructions and no ingredients', () => {
      const payload = makeRecipeVersion({description: '', instructions: [], ingredients: []})
      const decoded = RecipeVersionResponse.decode(payload)
      const recipe = decodeRight(RecipeVersionResponse, payload)

      expect(isRight(decoded)).toBe(true)
      expect(recipe.description).toBe('')
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
  it('carries an unknown flag code through verbatim', () => {
    const meal = decodeRight(
      AffectedMealResponse,
      makeAffectedMeal({flags: [{code: 'weather', detail: ['storm', 'flood']}]})
    )

    expect(meal.flags[0].code).toBe('weather')
    expect(meal.flags[0].detail).toEqual(['storm', 'flood'])
  })

  // This row navigates the user to one meal of one day to swap it, so an unrecognised slot read as breakfast
  // would point them at a meal that is not the flagged one.
  it('refuses a slot that is not one of the four', () => {
    ;['brunch', 'Dinner', '', null].forEach(slot =>
      expectRefused(AffectedMealResponse, withMembers(makeAffectedMeal(), {slot}))
    )
  })

  it('accepts each of the four slots', () => {
    ;['breakfast', 'lunch', 'dinner', 'snack'].forEach(slot =>
      expectAccepted(AffectedMealResponse, withMembers(makeAffectedMeal(), {slot}))
    )
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

// Dates, times, instants and zone names are the members the app compares lexicographically, parses, orders
// and passes as route parameters. A bare string member would let a malformed one through as trusted domain
// data, so each format is validated at the decoder — once per member, on every codec that carries one.
type FormatField = {label: string; codec: io.Decoder<unknown, unknown>; build: (value: unknown) => unknown}

const DAY_KEY_FIELDS: FormatField[] = [
  {
    label: 'PreferencesResponse.reviewStartDate',
    codec: PreferencesResponse,
    build: value => withMembers(makePreferences(), {reviewStartDate: value})
  },
  {
    label: 'MealPlanResponse.startDate',
    codec: MealPlanResponse,
    build: value => withMembers(makePlan(), {startDate: value})
  },
  {
    label: 'MealPlanResponse.endDate',
    codec: MealPlanResponse,
    build: value => withMembers(makePlan(), {endDate: value})
  },
  {
    label: 'MealPlanDayResponse.date',
    codec: MealPlanDayResponse,
    build: value => withMembers(makeDay(), {date: value})
  },
  {
    label: 'MealPlanMealResponse.loggedEntries[].date',
    codec: MealPlanMealResponse,
    build: value => withMembers(makeMeal(), {loggedEntries: [{...makeLoggedEntry(), date: value}]})
  },
  {
    label: 'GroceryListResponse.startDate',
    codec: GroceryListResponse,
    build: value => withMembers(makeGroceryList(), {startDate: value})
  },
  {
    label: 'GroceryListResponse.endDate',
    codec: GroceryListResponse,
    build: value => withMembers(makeGroceryList(), {endDate: value})
  },
  {
    label: 'AffectedMealResponse.date',
    codec: AffectedMealResponse,
    build: value => withMembers(makeAffectedMeal(), {date: value})
  }
]

const CLOCK_TIME_FIELDS: FormatField[] = [
  {
    label: 'PreferencesResponse.mealTimes[].time',
    codec: PreferencesResponse,
    build: value => withMembers(makePreferences(), {mealTimes: [{slot: 'breakfast', time: value}]})
  },
  {
    label: 'MealPlanMealResponse.slotTime',
    codec: MealPlanMealResponse,
    build: value => withMembers(makeMeal(), {slotTime: value})
  }
]

const TIMESTAMP_FIELDS: FormatField[] = [
  {
    label: 'MealPlanMealResponse.loggedEntries[].loggedAt',
    codec: MealPlanMealResponse,
    build: value => withMembers(makeMeal(), {loggedEntries: [{...makeLoggedEntry(), loggedAt: value}]})
  },
  {
    label: 'GroceryItemResponse.flag.flaggedAt',
    codec: GroceryItemResponse,
    build: value =>
      withMembers(makeGroceryItem(), {
        isChecked: true,
        flag: {
          previousDisplayText: '2.5 lb',
          newDisplayText: '3.1 lb',
          deltaDisplayText: '+0.6 lb',
          flaggedAt: value
        }
      })
  }
]

const VALID_DAY_KEYS = ['2026-07-05', '2026-01-01', '2026-12-31', '2024-02-29']
const INVALID_DAY_KEYS = [
  '2026-02-30',
  '2023-02-29',
  '2026-13-01',
  '2026-00-10',
  '2026-07-32',
  '2026-07-00',
  '2026-07-5',
  '26-07-05',
  '2026/07/05',
  '2026-07-05T00:00:00.000Z',
  'yesterday',
  '',
  ' 2026-07-05',
  20260705
]

const VALID_CLOCK_TIMES = ['00:00', '08:00', '12:30', '15:30', '23:59']
const INVALID_CLOCK_TIMES = ['24:00', '8:00', '07:60', '25:15', '12:3', '12:30:00', '12.30', '', '1230', 830]

const VALID_TIMESTAMPS = [
  '2026-07-05T12:30:00.000Z',
  '2026-07-05T12:30:00Z',
  '2026-07-05T08:30:00+02:00',
  '2026-07-05T23:59:59.999Z',
  '2024-02-29T00:00:00.000Z'
]
const INVALID_TIMESTAMPS = [
  '2026-07-05T08:30:00',
  '2026-07-05 08:30:00Z',
  '2026-07-05',
  '2026-02-30T08:30:00.000Z',
  '2026-07-05T24:00:00.000Z',
  '2026-07-05T12:60:00.000Z',
  '2026-13-05T12:30:00.000Z',
  '2026-07-05T12:30:00+25:00',
  'not-a-date',
  '',
  1783254600000
]

describe('wire formats', () => {
  describe('calendar day keys', () => {
    it.each(DAY_KEY_FIELDS)('accepts a real calendar day on $label', ({codec, build}) => {
      VALID_DAY_KEYS.forEach(value => expectAccepted(codec, build(value)))
    })

    it.each(DAY_KEY_FIELDS)('refuses a malformed or impossible day on $label', ({codec, build}) => {
      INVALID_DAY_KEYS.forEach(value => expectRefused(codec, build(value)))
    })

    it('refuses February 30th while accepting a leap-year February 29th', () => {
      expectRefused(MealPlanDayResponse, withMembers(makeDay(), {date: '2026-02-30'}))
      expectAccepted(MealPlanDayResponse, withMembers(makeDay(), {date: '2024-02-29'}))
      expectRefused(MealPlanDayResponse, withMembers(makeDay(), {date: '2100-02-29'}))
      expectAccepted(MealPlanDayResponse, withMembers(makeDay(), {date: '2000-02-29'}))
    })

    it('still accepts null on the one day key the contract makes nullable', () => {
      const preferences = decodeRight(PreferencesResponse, withMembers(makePreferences(), {reviewStartDate: null}))

      expect(preferences.reviewStartDate).toBeNull()
    })
  })

  describe('wall-clock times', () => {
    it.each(CLOCK_TIME_FIELDS)('accepts a zero-padded 24-hour time on $label', ({codec, build}) => {
      VALID_CLOCK_TIMES.forEach(value => expectAccepted(codec, build(value)))
    })

    it.each(CLOCK_TIME_FIELDS)('refuses a malformed time on $label', ({codec, build}) => {
      INVALID_CLOCK_TIMES.forEach(value => expectRefused(codec, build(value)))
    })
  })

  describe('instants', () => {
    it.each(TIMESTAMP_FIELDS)('accepts an ISO instant on $label', ({codec, build}) => {
      VALID_TIMESTAMPS.forEach(value => expectAccepted(codec, build(value)))
    })

    // A zone-less date-time names no point in time, and these values are ordered against each other.
    it.each(TIMESTAMP_FIELDS)('refuses a malformed or zone-less timestamp on $label', ({codec, build}) => {
      INVALID_TIMESTAMPS.forEach(value => expectRefused(codec, build(value)))
    })
  })

  describe('time zone names', () => {
    it('accepts the IANA names a device reports', () => {
      ;['America/New_York', 'Europe/London', 'Pacific/Auckland', 'Australia/Adelaide', 'UTC'].forEach(timeZone =>
        expectAccepted(PreferencesResponse, withMembers(makePreferences(), {timeZone}))
      )
    })

    it('accepts the null a user who has never saved a step carries', () => {
      expect(decodeRight(PreferencesResponse, withMembers(makePreferences(), {timeZone: null})).timeZone).toBeNull()
    })

    it('refuses a name no time-zone database recognises', () => {
      expectRefused(PreferencesResponse, withMembers(makePreferences(), {timeZone: 'Mars/Phobos'}))
      expectRefused(PreferencesResponse, withMembers(makePreferences(), {timeZone: 'America/Atlantis'}))
    })

    it('refuses a value that is not shaped like a zone name at all', () => {
      ;['', ' ', 'not a zone', 'America//New_York', '/New_York', 'America/New_York/', '-08:00', 42].forEach(timeZone =>
        expectRefused(PreferencesResponse, withMembers(makePreferences(), {timeZone}))
      )
    })
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

  it('rejects a recipe whose description arrives as null', () => {
    const decoded = RecipeVersionResponse.decode({...makeRecipeVersion(), description: null})

    expect(isLeft(decoded)).toBe(true)
  })
})
