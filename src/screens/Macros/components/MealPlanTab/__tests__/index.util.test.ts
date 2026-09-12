import {
  CurrentMealPlans,
  LoggedPlannedEntry,
  MealPlan,
  MealPlanDay,
  MealPlanFlag,
  MealPlanMeal
} from '@data/models/MealPlan'
import {MealPlanPreferences, SetupStep} from '@data/models/MealPlanPreferences'

import Screens from '@constants/screens'

import {
  flexItemWidth,
  latestLoggedEntry,
  MealPlanBodyInputs,
  resolveLastDayAction,
  resolveMealFlagReason,
  resolveMealLoggedState,
  resolveMealPlanBody,
  resolvePlanSwitchLink,
  resolveSelectedPlan,
  resolveSelectedPlanDate,
  resolveSetupStepRoute,
  resolveStalePlanSelection,
  resolveViewTarget
} from '../index.util'

const PLAN_START_DATE = '2026-07-05'
const PLAN_END_DATE = '2026-07-11'
const UPCOMING_START_DATE = '2026-07-12'
const UPCOMING_END_DATE = '2026-07-18'
const CURRENT_PLAN_ID = 'plan-current'
const UPCOMING_PLAN_ID = 'plan-upcoming'
const RECIPE_A_VERSION_ID = 'recipe-version-yogurt-bowl'
const RECIPE_C_VERSION_ID = 'recipe-version-turkey-wrap'

const makeFlag = (overrides: Partial<MealPlanFlag> = {}): MealPlanFlag => ({
  code: 'allergen',
  detail: ['milk'],
  ...overrides
})

const makeLoggedEntry = (overrides: Partial<LoggedPlannedEntry> = {}): LoggedPlannedEntry => ({
  entryId: 'entry-a',
  date: PLAN_START_DATE,
  mealName: 'Breakfast',
  servings: 1,
  loggedAt: '2026-07-05T08:12:00.000Z',
  recipeVersionId: RECIPE_C_VERSION_ID,
  recipeName: 'Turkey and hummus wrap',
  ...overrides
})

const makeMeal = (overrides: Partial<MealPlanMeal> = {}): MealPlanMeal => ({
  id: 'meal-breakfast',
  revision: 1,
  slot: 'breakfast',
  slotTime: '08:00',
  sortOrder: 0,
  recipe: {
    versionId: RECIPE_C_VERSION_ID,
    recipeId: 'recipe-turkey-wrap',
    name: 'Turkey and hummus wrap',
    iconKey: 'wrap',
    totalMinutes: 15,
    badges: ['high_protein'],
    nutritionProvenance: 'source_backed'
  },
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: {calories: 420, protein: 32, carbs: 44, fat: 11},
  flags: [],
  previousRecipe: null,
  loggedEntries: [],
  ...overrides
})

const makeDay = (overrides: Partial<MealPlanDay> = {}): MealPlanDay => ({
  id: 'day-1',
  date: PLAN_START_DATE,
  dayIndex: 0,
  plannedTotals: {calories: 1905, protein: 142, carbs: 188, fat: 61},
  isLastDay: false,
  meals: [makeMeal()],
  ...overrides
})

const makePlan = (overrides: Partial<MealPlan> = {}): MealPlan => ({
  id: CURRENT_PLAN_ID,
  revision: 1,
  generationAttempt: 1,
  startDate: PLAN_START_DATE,
  endDate: PLAN_END_DATE,
  status: 'active',
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  generationTargets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  targetsStale: false,
  preferencesRevision: 4,
  targetsRevision: 2,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 14, loggedEntryCount: 0},
  days: [makeDay()],
  ...overrides
})

const makeUpcomingPlan = (overrides: Partial<MealPlan> = {}): MealPlan =>
  makePlan({
    id: UPCOMING_PLAN_ID,
    startDate: UPCOMING_START_DATE,
    endDate: UPCOMING_END_DATE,
    days: [makeDay({id: 'day-8', date: UPCOMING_START_DATE})],
    ...overrides
  })

const makePlans = (current: MealPlan | null, upcoming: MealPlan | null): CurrentMealPlans => ({current, upcoming})

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
  weightKg: 82.6,
  sexForEstimate: 'female',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'lightly_active',
  diet: 'none',
  allergens: ['peanuts'],
  dislikedFoods: [{id: 'food-mushroom-white', name: 'Mushrooms, white', foodGroup: 'mushroom'}],
  dislikedFoodGroups: ['mushroom'],
  mealSchedule: 'three',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: null,
  noBudgetPreference: true,
  budgetTier: 3,
  hasActivePlan: true,
  ...overrides
})

const makeBodyInputs = (overrides: Partial<MealPlanBodyInputs> = {}): MealPlanBodyInputs => ({
  availability: 'enabled',
  preferences: makePreferences(),
  preferencesError: null,
  plans: makePlans(null, null),
  currentPlanError: null,
  isLoading: false,
  selectedPlanId: null,
  ...overrides
})

const featureDisabledError = {response: {status: 503, data: {error: 'feature_disabled'}}}
const routesMissingError = {response: {status: 404, data: {}}}
const resourceNotFoundError = {response: {status: 404, data: {error: 'plan_not_active'}}}
const legacyNotFoundError = {response: {status: 404, data: {error: 'Meal plan not found'}}}
const stalePlanError = {response: {status: 409, data: {error: 'stale_plan'}}}
const planNotActiveError = {response: {status: 409, data: {error: 'plan_not_active'}}}
const networkError = {message: 'Network Error'}
const undecodableError = {response: {status: 502, data: {}}}

describe('resolveMealPlanBody', () => {
  describe('unavailability', () => {
    it('renders the unavailable card when a gated route answered 503 feature_disabled', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({availability: 'unavailable', preferencesError: featureDisabledError})
      )

      expect(outcome).toEqual({kind: 'unavailable'})
    })

    it('renders the unavailable card when a resource-less collection GET answered a bare 404', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({availability: 'unavailable', currentPlanError: routesMissingError})
      )

      expect(outcome).toEqual({kind: 'unavailable'})
    })

    it('renders the unavailable card ahead of a plan the cache still holds', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({availability: 'unavailable', plans: makePlans(makePlan(), null)})
      )

      expect(outcome).toEqual({kind: 'unavailable'})
    })

    it('renders no meal-plan body while the feature flag is off', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({availability: 'disabled'}))

      expect(outcome).toEqual({kind: 'unavailable'})
    })
  })

  describe('resource-route and stale-plan failures', () => {
    it('reports an error for a 404 from a resource route', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: resourceNotFoundError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('reports an error for a resource 404 whose body carries a human-readable message', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({preferencesError: legacyNotFoundError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('reports an error for a decoded stale_plan', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: stalePlanError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('reports an error for a decoded plan_not_active', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: planNotActiveError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('never reads a resource-route 404 as unavailability or as an absent plan', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: resourceNotFoundError}))

      expect(outcome.kind).not.toBe('unavailable')
      expect(outcome.kind).not.toBe('empty')
    })

    it('outranks an in-flight refetch so the failure is not hidden behind a spinner', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: stalePlanError, isLoading: true}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('outranks a plan the cache still holds', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: resourceNotFoundError, plans: makePlans(makePlan(), null)})
      )

      expect(outcome).toEqual({kind: 'error'})
    })
  })

  describe('the first fetch', () => {
    it('reports loading while the request is in flight with no plan to show', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({isLoading: true, plans: undefined}))

      expect(outcome).toEqual({kind: 'loading'})
    })

    it('keeps rendering a cached plan during a background refetch', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(makeBodyInputs({isLoading: true, plans: makePlans(plan, null)}))

      expect(outcome).toEqual({kind: 'plan', plan})
    })
  })

  describe('undecodable failures', () => {
    it('reports an error for a network failure carrying no response', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: networkError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('reports an error for a 5xx whose body decodes to no error code', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({preferencesError: undecodableError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('never claims the user has no plan when the request merely failed', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: networkError, preferences: makePreferences({setupStatus: 'not_started'})})
      )

      expect(outcome.kind).not.toBe('empty')
      expect(outcome.kind).not.toBe('unavailable')
    })
  })

  describe('a plan to show', () => {
    it('returns the selected plan', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(plan, makeUpcomingPlan())}))

      expect(outcome).toEqual({kind: 'plan', plan})
    })

    it('returns the upcoming plan when it is the only one', () => {
      const plan = makeUpcomingPlan()

      const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(null, plan)}))

      expect(outcome).toEqual({kind: 'plan', plan})
    })
  })

  describe('setup progress with no plan', () => {
    it('offers plan creation before setup has started', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({preferences: makePreferences({setupStatus: 'not_started'})}))

      expect(outcome).toEqual({kind: 'empty', cta: 'create'})
    })

    it('resumes an interrupted setup at its saved step', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({preferences: makePreferences({setupStatus: 'in_progress', setupStep: 'diet'})})
      )

      expect(outcome).toEqual({kind: 'empty', cta: 'continueSetupStep'})
    })

    it('opens review once every answer is in', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({preferences: makePreferences({setupStatus: 'ready_for_review'})})
      )

      expect(outcome).toEqual({kind: 'empty', cta: 'continueSetupReview'})
    })

    it('offers the next week to a completed user whose plans have all ended', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({preferences: makePreferences({setupStatus: 'completed'})}))

      expect(outcome).toEqual({kind: 'empty', cta: 'planNextWeek'})
    })

    it('treats absent preferences as setup never started', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({preferences: undefined}))

      expect(outcome).toEqual({kind: 'empty', cta: 'create'})
    })

    it('treats an unfetched plans response as no plan rather than as a failure', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({plans: undefined, preferences: makePreferences({setupStatus: 'not_started'})})
      )

      expect(outcome).toEqual({kind: 'empty', cta: 'create'})
    })
  })
})

describe('resolveSetupStepRoute', () => {
  it('opens the saved step itself, so a returning user never meets the introduction again', () => {
    expect(resolveSetupStepRoute('goal')).toBe(Screens.MEAL_PLAN_GOAL)
    expect(resolveSetupStepRoute('body')).toBe(Screens.MEAL_PLAN_ABOUT_YOU)
    expect(resolveSetupStepRoute('activity')).toBe(Screens.MEAL_PLAN_ACTIVITY)
    expect(resolveSetupStepRoute('diet')).toBe(Screens.MEAL_PLAN_DIET)
    expect(resolveSetupStepRoute('dislikes')).toBe(Screens.MEAL_PLAN_FOOD_PREFERENCES)
    expect(resolveSetupStepRoute('schedule')).toBe(Screens.MEAL_PLAN_SCHEDULE)
    expect(resolveSetupStepRoute('cooking')).toBe(Screens.MEAL_PLAN_COOKING_BUDGET)
    expect(resolveSetupStepRoute('review')).toBe(Screens.MEAL_PLAN_TARGETS)
    expect(resolveSetupStepRoute('targets_manual')).toBe(Screens.MEAL_PLAN_EDIT_TARGETS)
  })

  it('starts at the goal step when no step is saved', () => {
    expect(resolveSetupStepRoute(null)).toBe(Screens.MEAL_PLAN_GOAL)
  })

  it('starts at the goal step for a step a newer server introduced', () => {
    const unrecognizedStep: string = 'onboarding_v2'

    expect(resolveSetupStepRoute(unrecognizedStep as SetupStep)).toBe(Screens.MEAL_PLAN_GOAL)
  })
})

describe('resolveSelectedPlan', () => {
  it('selects the current plan by default when both plans exist', () => {
    const current = makePlan()

    expect(resolveSelectedPlan(makePlans(current, makeUpcomingPlan()), null)).toEqual(current)
  })

  it('selects the upcoming plan when there is no current plan', () => {
    const upcoming = makeUpcomingPlan()

    expect(resolveSelectedPlan(makePlans(null, upcoming), null)).toEqual(upcoming)
  })

  it('selects the plan the stored selection names', () => {
    const current = makePlan()
    const upcoming = makeUpcomingPlan()
    const plans = makePlans(current, upcoming)

    expect(resolveSelectedPlan(plans, CURRENT_PLAN_ID)).toEqual(current)
    expect(resolveSelectedPlan(plans, UPCOMING_PLAN_ID)).toEqual(upcoming)
    expect(resolveStalePlanSelection(plans, UPCOMING_PLAN_ID)).toBe(UPCOMING_PLAN_ID)
  })

  it('falls back to the current plan when the stored selection matches neither', () => {
    const current = makePlan()
    const plans = makePlans(current, makeUpcomingPlan())

    expect(resolveSelectedPlan(plans, 'plan-from-last-month')).toEqual(current)
    expect(resolveStalePlanSelection(plans, 'plan-from-last-month')).toBeNull()
  })

  it('selects the former upcoming plan once the server has rolled it into current', () => {
    const rolledOver = makeUpcomingPlan()

    expect(resolveSelectedPlan(makePlans(rolledOver, null), CURRENT_PLAN_ID)).toEqual(rolledOver)
  })

  it('selects nothing when the server returns no plans', () => {
    expect(resolveSelectedPlan(makePlans(null, null), null)).toBeNull()
    expect(resolveSelectedPlan(undefined, CURRENT_PLAN_ID)).toBeNull()
  })
})

describe('resolveStalePlanSelection', () => {
  it('keeps a selection that names a returned plan', () => {
    expect(resolveStalePlanSelection(makePlans(makePlan(), makeUpcomingPlan()), UPCOMING_PLAN_ID)).toBe(
      UPCOMING_PLAN_ID
    )
  })

  it('clears a selection that matches neither returned plan', () => {
    expect(resolveStalePlanSelection(makePlans(makePlan(), makeUpcomingPlan()), 'plan-from-last-month')).toBeNull()
  })

  it('clears a selection naming a plan the server stopped returning after rollover', () => {
    expect(resolveStalePlanSelection(makePlans(makeUpcomingPlan(), null), CURRENT_PLAN_ID)).toBeNull()
  })

  it('stores no selection when none is held', () => {
    expect(resolveStalePlanSelection(makePlans(makePlan(), null), null)).toBeNull()
  })
})

describe('resolvePlanSwitchLink', () => {
  it('offers the next week while the current plan is on screen', () => {
    expect(resolvePlanSwitchLink(makePlans(makePlan(), makeUpcomingPlan()), null)).toBe('next')
  })

  it('offers the way back while the upcoming plan is on screen', () => {
    expect(resolvePlanSwitchLink(makePlans(makePlan(), makeUpcomingPlan()), UPCOMING_PLAN_ID)).toBe('this')
  })

  it('offers no link when only the current plan exists', () => {
    expect(resolvePlanSwitchLink(makePlans(makePlan(), null), null)).toBeNull()
  })

  it('offers no link when only the upcoming plan exists', () => {
    expect(resolvePlanSwitchLink(makePlans(null, makeUpcomingPlan()), null)).toBeNull()
  })

  it('offers no link when the server returns no plans', () => {
    expect(resolvePlanSwitchLink(undefined, null)).toBeNull()
  })
})

describe('resolveLastDayAction', () => {
  it('offers a way to reach the upcoming plan on the last day of the current one', () => {
    expect(resolveLastDayAction(makePlans(makePlan(), makeUpcomingPlan()), null, PLAN_END_DATE)).toBe('viewNextWeek')
  })

  it('offers another week on the last day when nothing is upcoming', () => {
    expect(resolveLastDayAction(makePlans(makePlan(), null), null, PLAN_END_DATE)).toBe('planAnotherWeek')
  })

  it('offers nothing on a day that is not the plan last day', () => {
    expect(resolveLastDayAction(makePlans(makePlan(), null), null, '2026-07-08')).toBeNull()
  })

  it('offers nothing when no plan is selected', () => {
    expect(resolveLastDayAction(undefined, null, PLAN_END_DATE)).toBeNull()
  })
})

describe('resolveSelectedPlanDate', () => {
  const insideWeek = new Date(2026, 6, 8, 12, 0, 0)
  const outsideWeek = new Date(2026, 7, 1, 12, 0, 0)

  it('selects today when today falls inside the plan week', () => {
    expect(resolveSelectedPlanDate(makePlan(), null, insideWeek)).toBe('2026-07-08')
  })

  it('selects the first plan day when today falls outside the plan week', () => {
    expect(resolveSelectedPlanDate(makePlan(), null, outsideWeek)).toBe(PLAN_START_DATE)
  })

  it('keeps a stored day that falls inside the plan week', () => {
    expect(resolveSelectedPlanDate(makePlan(), '2026-07-09', insideWeek)).toBe('2026-07-09')
  })

  it('clamps a stored day before the plan to its first day', () => {
    expect(resolveSelectedPlanDate(makePlan(), '2026-06-30', insideWeek)).toBe(PLAN_START_DATE)
  })

  it('clamps a stored day after the plan to its last day', () => {
    expect(resolveSelectedPlanDate(makePlan(), '2026-07-20', insideWeek)).toBe(PLAN_END_DATE)
  })
})

describe('latestLoggedEntry', () => {
  it('returns the entry logged last', () => {
    const first = makeLoggedEntry({entryId: 'entry-first', loggedAt: '2026-07-05T08:12:00.000Z'})
    const second = makeLoggedEntry({entryId: 'entry-second', loggedAt: '2026-07-05T19:41:00.000Z'})

    expect(latestLoggedEntry([first, second])).toEqual(second)
    expect(latestLoggedEntry([second, first])).toEqual(second)
  })

  it('breaks a tie on the logged timestamp by entry id, whatever the input order', () => {
    const entryA = makeLoggedEntry({entryId: 'entry-a'})
    const entryB = makeLoggedEntry({entryId: 'entry-b'})

    expect(latestLoggedEntry([entryA, entryB])).toEqual(entryB)
    expect(latestLoggedEntry([entryB, entryA])).toEqual(entryB)
  })

  it('returns the only entry of a slot logged once', () => {
    const entry = makeLoggedEntry()

    expect(latestLoggedEntry([entry])).toEqual(entry)
  })

  it('returns null for a slot with no logged entries', () => {
    expect(latestLoggedEntry([])).toBeNull()
  })

  it('leaves the caller list untouched', () => {
    const first = makeLoggedEntry({entryId: 'entry-first', loggedAt: '2026-07-05T19:41:00.000Z'})
    const second = makeLoggedEntry({entryId: 'entry-second', loggedAt: '2026-07-05T08:12:00.000Z'})
    const entries = [first, second]

    latestLoggedEntry(entries)

    expect(entries).toEqual([first, second])
  })
})

describe('resolveMealLoggedState', () => {
  it('reports a slot with no entries as unlogged', () => {
    expect(resolveMealLoggedState(makeMeal())).toEqual({kind: 'unlogged'})
  })

  it('reports a slot logged against its current recipe as logged', () => {
    const entry = makeLoggedEntry({recipeVersionId: RECIPE_C_VERSION_ID})

    expect(resolveMealLoggedState(makeMeal({loggedEntries: [entry]}))).toEqual({kind: 'logged', entry})
  })

  it('names the meal actually eaten after two successive swaps', () => {
    const entry = makeLoggedEntry({recipeVersionId: RECIPE_A_VERSION_ID, recipeName: 'Greek yogurt bowl'})

    const state = resolveMealLoggedState(makeMeal({loggedEntries: [entry]}))

    expect(state).toEqual({kind: 'loggedThenSwapped', entry})
  })

  it('ignores previousRecipe when the slot was logged before being swapped', () => {
    const entry = makeLoggedEntry({recipeVersionId: RECIPE_A_VERSION_ID, recipeName: 'Greek yogurt bowl'})
    const withoutPrevious = makeMeal({loggedEntries: [entry], previousRecipe: null})
    const withUnrelatedPrevious = makeMeal({
      loggedEntries: [entry],
      previousRecipe: {versionId: 'recipe-version-chicken-bowl', name: 'Chicken burrito bowl'}
    })

    expect(resolveMealLoggedState(withoutPrevious)).toEqual({kind: 'loggedThenSwapped', entry})
    expect(resolveMealLoggedState(withUnrelatedPrevious)).toEqual({kind: 'loggedThenSwapped', entry})
  })

  it('ignores previousRecipe when the slot was logged against its current recipe', () => {
    const entry = makeLoggedEntry({recipeVersionId: RECIPE_C_VERSION_ID})
    const meal = makeMeal({
      loggedEntries: [entry],
      previousRecipe: {versionId: RECIPE_A_VERSION_ID, name: 'Greek yogurt bowl'}
    })

    expect(resolveMealLoggedState(meal)).toEqual({kind: 'logged', entry})
  })

  it('stays logged when an entry for the current recipe sits beside an older one', () => {
    const swappedAwayEntry = makeLoggedEntry({
      entryId: 'entry-first',
      loggedAt: '2026-07-05T08:12:00.000Z',
      recipeVersionId: RECIPE_A_VERSION_ID,
      recipeName: 'Greek yogurt bowl'
    })
    const currentEntry = makeLoggedEntry({entryId: 'entry-second', loggedAt: '2026-07-05T19:41:00.000Z'})

    const state = resolveMealLoggedState(makeMeal({loggedEntries: [swappedAwayEntry, currentEntry]}))

    expect(state).toEqual({kind: 'logged', entry: currentEntry})
  })
})

describe('resolveMealFlagReason', () => {
  it('states the shared code when every flag carries the same one', () => {
    const flags = [makeFlag({detail: ['milk']}), makeFlag({detail: ['soy']})]

    expect(resolveMealFlagReason(flags)).toBe('allergen')
  })

  it('states a generic reason rather than borrowing one of the differing codes', () => {
    const reason = resolveMealFlagReason([makeFlag({code: 'allergen'}), makeFlag({code: 'dislike'})])

    expect(reason).not.toBeNull()
    expect(reason).not.toBe('allergen')
    expect(reason).not.toBe('dislike')
    expect(reason).toBe(resolveMealFlagReason([makeFlag({code: 'diet'}), makeFlag({code: 'cooking_time'})]))
  })

  it('states no reason for a meal with no flags', () => {
    expect(resolveMealFlagReason([])).toBeNull()
  })
})

describe('resolveViewTarget', () => {
  it('opens the diary for an entry logged today', () => {
    expect(resolveViewTarget('2026-07-05', '2026-07-05')).toBe('diary')
  })

  it('opens macros history for an entry logged on an earlier day', () => {
    expect(resolveViewTarget('2026-07-05', '2026-07-08')).toBe('history')
  })

  it('opens macros history for an entry dated after today', () => {
    expect(resolveViewTarget('2026-07-09', '2026-07-08')).toBe('history')
  })
})

describe('flexItemWidth', () => {
  it('derives the day-chip width at the 393px reference', () => {
    expect(flexItemWidth(353, 6, 7)).toBeCloseTo(45.2857, 4)
  })

  it('derives the day-chip width on a 375px device', () => {
    expect(flexItemWidth(335, 6, 7)).toBeCloseTo(42.7143, 4)
  })

  it('derives the meal-card action pill width', () => {
    expect(flexItemWidth(321, 8, 2)).toBe(156.5)
  })

  it('returns 0 before the row has been measured', () => {
    expect(flexItemWidth(0, 6, 7)).toBe(0)
    expect(flexItemWidth(-320, 6, 7)).toBe(0)
  })

  it('returns 0 for a non-positive item count', () => {
    expect(flexItemWidth(353, 6, 0)).toBe(0)
    expect(flexItemWidth(353, 6, -2)).toBe(0)
  })
})
