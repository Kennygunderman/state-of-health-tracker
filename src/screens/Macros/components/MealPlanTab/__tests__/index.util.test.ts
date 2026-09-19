import {
  CurrentMealPlans,
  LoggedPlannedEntry,
  MealPlan,
  MealPlanDay,
  MealPlanDayEnvelope,
  MealPlanFlag,
  MealPlanMeal
} from '@data/models/MealPlan'
import {MealPlanPreferences, SetupStep} from '@data/models/MealPlanPreferences'
import {
  buildPendingIntent,
  MealPlanStore,
  PENDING_INTENT_TTL_MS,
  PendingIntent,
  PendingIntentAction,
  PostLogResult
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {
  GenerateRequestSnapshot,
  LogRequestSnapshot,
  matchesFingerprint,
  MealPlanRequestSnapshot,
  RegenerateRequestSnapshot,
  requestBody,
  SwapRequestSnapshot
} from '@utility/IdempotencyUtility'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT,
  MEAL_PLAN_CREATE_BUTTON_TEXT,
  MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT,
  MEAL_PLAN_PLAN_NEXT_WEEK_BUTTON_TEXT,
  MEAL_SLOT_LABELS
} from '@constants/strings'

import {
  arePlanActionsOffered,
  buildMealCardModels,
  isKeyedWriteHeldByAnotherMeal,
  flexItemWidth,
  InPlaceWriteAction,
  InPlaceWriteInputs,
  InPlaceWriteIntent,
  formatPostLogBannerBody,
  isPostLogBannerVisible,
  isStalePlanError,
  latestLoggedEntry,
  mealCountUnitText,
  MealPlanBodyInputs,
  MealPlanBodyOutcome,
  MealPlanGeneratingParams,
  PendingGenerationInputs,
  planDayWeekdayName,
  PostLogBannerOrigin,
  resolveEmptyPlanCtaLabel,
  resolveFrameOutcome,
  resolveHandoffLatch,
  resolveLastDayAction,
  resolveLogOwnership,
  resolveMealFlagLine,
  resolveMealFlagReason,
  resolveMealLoggedState,
  resolveMealPlanBody,
  resolveMealPlanDaySection,
  resolvePendingGeneration,
  resolvePlanSwitchLink,
  resolvePostLogBannerOrigin,
  resolveRestoredWriteDisposition,
  resolveRestoredWriteRecovery,
  resolveSelectedPlan,
  resolveSelectedPlanDate,
  resolveSetupResumeTarget,
  resolveStalePlanSelection,
  resolveSwapOwnership,
  resolveTabFrame,
  resolveViewTarget,
  slotCopyFromBucketLabel
} from '../index.util'

// Mocking the persist adapter keeps the suite free of native modules: `index.util` imports the store module
// for its pure replay API, and importing that module creates the persisted store.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

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

// A fifth flag code, which the model's closed union cannot express and only an assertion can build: the codec
// decodes the code as an open string, so a newer server — or a plan rehydrated from a persisted cache another
// build wrote — can put one in front of the card. It is the value F08 crashed the render with.
const UNRECOGNISED_FLAG_CODE = 'something_new' as MealPlanFlag['code']

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
  generationKey: 'gen-key-1',
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

// Built as the logging screen builds it: `slotLabel` is the diary bucket's own name, which the server
// backfills capitalised, and `viewTarget` is the value that was current when the entry was written.
const makePostLogResult = (overrides: Partial<PostLogResult> = {}): PostLogResult => ({
  entryId: 'entry-a',
  dateIso: PLAN_START_DATE,
  slotLabel: MEAL_SLOT_LABELS.breakfast,
  recipeName: 'Greek yogurt bowl',
  viewTarget: 'diary',
  ...overrides
})

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

const USER_ID = 'user-8f21'
const OTHER_USER_ID = 'user-3c07'
const GENERATE_KEY = 'idem-generate-1'
const REGENERATE_KEY = 'idem-regenerate-1'
const INTENT_CREATED_AT = Date.parse('2026-07-04T10:15:00.000Z')
const NOW = INTENT_CREATED_AT + 60_000

const GENERATE_SNAPSHOT: GenerateRequestSnapshot = {
  action: 'generate',
  startDate: UPCOMING_START_DATE,
  expectedPreferencesRevision: 4,
  expectedTargetsRevision: 2
}

const REGENERATE_SNAPSHOT: RegenerateRequestSnapshot = {
  action: 'regenerate',
  planId: CURRENT_PLAN_ID,
  expectedPlanRevision: 1,
  expectedPreferencesRevision: 4,
  expectedTargetsRevision: 2
}

// The two in-place writes name a meal, and deliberately not the same one: a record is replayed for the meal
// it was minted against, not for whatever the tab happens to be showing.
const SWAP_KEY = 'idem-swap-1'
const LOG_KEY = 'idem-log-1'
const SWAP_MEAL_ID = 'meal-lunch'
const LOG_MEAL_ID = 'meal-breakfast'

const SWAP_SNAPSHOT: SwapRequestSnapshot = {
  action: 'swap',
  planId: CURRENT_PLAN_ID,
  mealId: SWAP_MEAL_ID,
  recipeVersionId: RECIPE_A_VERSION_ID,
  portionMultiplier: 1,
  expectedPlanRevision: 1
}

const LOG_SNAPSHOT: LogRequestSnapshot = {
  action: 'log',
  planId: CURRENT_PLAN_ID,
  mealId: LOG_MEAL_ID,
  servings: 1,
  date: PLAN_START_DATE,
  diaryMealId: 'diary-breakfast',
  expectedPlanRevision: 1
}

// Built through the store's own factory, so every record carries the fingerprint and the derived plan pair a
// restored one is validated against — a hand-written record would be refused as unreplayable.
const generateIntent = (createdAt: number = INTENT_CREATED_AT): PendingIntent =>
  buildPendingIntent(GENERATE_SNAPSHOT, GENERATE_KEY, USER_ID, createdAt)

const regenerateIntent = (createdAt: number = INTENT_CREATED_AT): PendingIntent =>
  buildPendingIntent(REGENERATE_SNAPSHOT, REGENERATE_KEY, USER_ID, createdAt)

const makeIntents = (intents: PendingIntent[]): Pick<MealPlanStore, 'pendingIntents'> => {
  const pendingIntents: Partial<Record<PendingIntentAction, PendingIntent>> = {}

  intents.forEach(intent => {
    pendingIntents[intent.request.action] = intent
  })

  return {pendingIntents}
}

// The request the Generating screen rebuilds from the params it is opened with, mirrored here because a
// screen's own util may not be imported across folders. What it asserts is the contract that matters: a route
// reconstructed from a stored snapshot asks for exactly what the stored key was minted for.
const rebuildStoredRequest = (params: MealPlanGeneratingParams): MealPlanRequestSnapshot => {
  if (params.context.kind === 'regenerate') {
    return {
      action: 'regenerate',
      planId: params.context.planId,
      expectedPlanRevision: params.context.planRevision,
      expectedPreferencesRevision: params.expectedPreferencesRevision,
      expectedTargetsRevision: params.expectedTargetsRevision
    }
  }

  return {
    action: 'generate',
    startDate: params.context.kind === 'nextWeek' ? params.context.startDate : params.startDate,
    expectedPreferencesRevision: params.expectedPreferencesRevision,
    expectedTargetsRevision: params.expectedTargetsRevision
  }
}

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
// The literal answer of every meal-planning resource route: `PlanNotFoundError` becomes
// `404 {error: 'Plan not found'}`, covering a plan that is absent or another user's AND a date outside the
// plan's own week. Prose, not a machine code — which is exactly why classifying on the code string alone
// missed it.
const resourceNotFoundError = {response: {status: 404, data: {error: 'Plan not found'}}}
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

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: false})
    })
  })

  describe('undecodable failures with nothing to show', () => {
    it('reports an error for a network failure carrying no response and no cached plan', () => {
      const outcome = resolveMealPlanBody(makeBodyInputs({currentPlanError: networkError}))

      expect(outcome).toEqual({kind: 'error'})
    })

    it('reports an error for a 5xx whose body decodes to no error code and leaves no plan', () => {
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

  describe('a saved plan the cache still holds', () => {
    it('keeps the saved week on screen when the refetch fails with no response at all', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: networkError, plans: makePlans(plan, null)})
      )

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: true})
    })

    it('keeps the saved week on screen when the refetch answers an undecodable 5xx', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: undecodableError, plans: makePlans(plan, null)})
      )

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: true})
    })

    it('keeps the saved week on screen when only the preferences request failed', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(
        makeBodyInputs({preferencesError: networkError, plans: makePlans(plan, null)})
      )

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: true})
    })

    it('keeps the saved week on screen when a failed refetch is still in flight', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: networkError, isLoading: true, plans: makePlans(plan, null)})
      )

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: true})
    })

    it('keeps the saved upcoming week on screen when it is the only plan held', () => {
      const plan = makeUpcomingPlan()

      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: networkError, plans: makePlans(null, plan)})
      )

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: true})
    })

    it('never replaces a readable saved week with the error card', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: networkError, plans: makePlans(makePlan(), null)})
      )

      expect(outcome.kind).not.toBe('error')
      expect(outcome.kind).not.toBe('loading')
      expect(outcome.kind).not.toBe('empty')
    })

    it('discards the cached week when a decoded stale_plan contradicts it', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: stalePlanError, plans: makePlans(makePlan(), null)})
      )

      expect(outcome).toEqual({kind: 'error'})
    })

    it('discards the cached week when a decoded plan_not_active contradicts it', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({currentPlanError: planNotActiveError, plans: makePlans(makePlan(), null)})
      )

      expect(outcome).toEqual({kind: 'error'})
    })

    it('discards the cached week when a resource route answered 404', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({preferencesError: legacyNotFoundError, plans: makePlans(makePlan(), null)})
      )

      expect(outcome).toEqual({kind: 'error'})
    })

    it('shows nothing at all rather than a saved week while the feature is unavailable', () => {
      const outcome = resolveMealPlanBody(
        makeBodyInputs({
          availability: 'unavailable',
          currentPlanError: routesMissingError,
          plans: makePlans(makePlan(), null)
        })
      )

      expect(outcome).toEqual({kind: 'unavailable'})
    })
  })

  describe('a plan to show', () => {
    it('returns the selected plan', () => {
      const plan = makePlan()

      const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(plan, makeUpcomingPlan())}))

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: false})
    })

    it('returns the upcoming plan when it is the only one', () => {
      const plan = makeUpcomingPlan()

      const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(null, plan)}))

      expect(outcome).toEqual({kind: 'plan', plan, isSavedCopy: false})
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

// The cold-start owner of a generation whose response was lost (AAP 0.7.2). Navigation state is not
// persisted, so these cases are the whole of what decides whether the Generating screen is ever reconstructed
// and which request it is reconstructed for.
describe('resolvePendingGeneration', () => {
  const makeGenerationInputs = (overrides: Partial<PendingGenerationInputs> = {}): PendingGenerationInputs => ({
    intents: {pendingIntents: {}},
    userId: USER_ID,
    now: NOW,
    intentsHydration: 'succeeded',
    isHandoffAllowed: true,
    isGenerationInFlight: false,
    navigatedKey: null,
    plans: makePlans(null, null),
    todayDayKey: PLAN_START_DATE,
    ...overrides
  })

  describe('nothing to hand over', () => {
    it('leaves the tab alone when no intent is stored', () => {
      expect(resolvePendingGeneration(makeGenerationInputs())).toEqual({outcome: {kind: 'idle'}, navigatedKey: null})
    })

    // 'idle' would be a claim that nothing is pending, which is exactly what an unread slice cannot support:
    // the tab has to withhold its normal state instead of exposing it over a key it has not seen yet.
    it('answers hydrating, not idle, while the persisted slice is still on its way back', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), intentsHydration: 'pending'})
      )

      expect(decision).toEqual({outcome: {kind: 'hydrating'}, navigatedKey: null})
    })

    it('answers hydrating even with nothing stored, because an unread slice is unknown rather than empty', () => {
      expect(resolvePendingGeneration(makeGenerationInputs({intentsHydration: 'pending'}))).toEqual({
        outcome: {kind: 'hydrating'},
        navigatedKey: null
      })
    })

    // A refused read is its own answer: the contents are unknown and only a retry can change that, so it must
    // not read as 'nothing pending' and must not be confused with waiting.
    it('answers unreadable when the persisted read was refused', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), intentsHydration: 'failed'})
      )

      expect(decision).toEqual({outcome: {kind: 'unreadable'}, navigatedKey: null})
    })

    it('keeps the latch untouched while the slice is unread, so nothing is spent on an undecided frame', () => {
      const hydrating = resolvePendingGeneration(
        makeGenerationInputs({intentsHydration: 'pending', navigatedKey: GENERATE_KEY})
      )
      const unreadable = resolvePendingGeneration(
        makeGenerationInputs({intentsHydration: 'failed', navigatedKey: GENERATE_KEY})
      )

      expect(hydrating.navigatedKey).toBe(GENERATE_KEY)
      expect(unreadable.navigatedKey).toBe(GENERATE_KEY)
    })

    it('never reconstructs a route for a record another account minted', () => {
      const foreign = buildPendingIntent(GENERATE_SNAPSHOT, GENERATE_KEY, OTHER_USER_ID, INTENT_CREATED_AT)

      expect(resolvePendingGeneration(makeGenerationInputs({intents: makeIntents([foreign])}))).toEqual({
        outcome: {kind: 'idle'},
        navigatedKey: null
      })
    })

    it('never reconstructs a route while no account is known', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), userId: null})
      )

      expect(decision.outcome).toEqual({kind: 'idle'})
    })

    it('lets an intent that has aged out stay unreplayed', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([generateIntent()]),
          now: INTENT_CREATED_AT + PENDING_INTENT_TTL_MS
        })
      )

      expect(decision.outcome).toEqual({kind: 'idle'})
    })

    it('opens no screen for a swap or log intent, which this tab replays in place', () => {
      const logIntent = buildPendingIntent(LOG_SNAPSHOT, LOG_KEY, USER_ID, INTENT_CREATED_AT)

      expect(resolvePendingGeneration(makeGenerationInputs({intents: makeIntents([logIntent])})).outcome).toEqual({
        kind: 'idle'
      })
    })
  })

  describe('a generation nobody owns', () => {
    it('reconstructs the setup generation from the stored snapshot and its stored key', () => {
      const decision = resolvePendingGeneration(makeGenerationInputs({intents: makeIntents([generateIntent()])}))

      expect(decision).toEqual({
        outcome: {
          kind: 'handoff',
          params: {
            context: {kind: 'setup'},
            idempotencyKey: GENERATE_KEY,
            expectedPreferencesRevision: 4,
            expectedTargetsRevision: 2,
            startDate: UPCOMING_START_DATE
          }
        },
        navigatedKey: GENERATE_KEY
      })
    })

    it('reads the generation as next week when the user already has a week', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), plans: makePlans(makePlan(), null)})
      )

      expect(decision.outcome).toEqual({
        kind: 'handoff',
        params: {
          context: {kind: 'nextWeek', startDate: UPCOMING_START_DATE},
          idempotencyKey: GENERATE_KEY,
          expectedPreferencesRevision: 4,
          expectedTargetsRevision: 2,
          startDate: UPCOMING_START_DATE
        }
      })
    })

    it('reconstructs the regeneration naming the plan and the revision the record holds', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([regenerateIntent()]), plans: makePlans(makePlan(), null)})
      )

      expect(decision).toEqual({
        outcome: {
          kind: 'handoff',
          params: {
            context: {kind: 'regenerate', planId: CURRENT_PLAN_ID, planRevision: 1},
            idempotencyKey: REGENERATE_KEY,
            expectedPreferencesRevision: 4,
            expectedTargetsRevision: 2,
            startDate: PLAN_START_DATE
          }
        },
        navigatedKey: REGENERATE_KEY
      })
    })

    // The regeneration's start date is card copy only — the request keeps the dates the plan already has — so
    // a plan the payload does not hold must not stop the replay.
    it('falls back to today for the week of a regeneration whose plan is not in hand', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: undefined,
          todayDayKey: UPCOMING_END_DATE
        })
      )

      expect(decision.outcome).toEqual({
        kind: 'handoff',
        params: {
          context: {kind: 'regenerate', planId: CURRENT_PLAN_ID, planRevision: 1},
          idempotencyKey: REGENERATE_KEY,
          expectedPreferencesRevision: 4,
          expectedTargetsRevision: 2,
          startDate: UPCOMING_END_DATE
        }
      })
    })

    /**
     * The point of reconstructing from the snapshot rather than from current query data: the screen rebuilds
     * its request from these params, so they have to rebuild the very request the stored key was minted for.
     * `rebuildStoredRequest` mirrors the Generating screen's own rebuild, which cannot be imported across
     * screen folders, and the fingerprint is the byte-identical-replay test the server enforces (0.5.1).
     */
    it('reconstructs params that rebuild the byte-identical generation the key was minted for', () => {
      const intent = generateIntent()
      const decision = resolvePendingGeneration(makeGenerationInputs({intents: makeIntents([intent])}))

      expect(decision.outcome.kind).toBe('handoff')
      expect(
        decision.outcome.kind === 'handoff' &&
          matchesFingerprint(rebuildStoredRequest(decision.outcome.params), intent.fingerprint)
      ).toBe(true)
    })

    it('reconstructs params that rebuild the byte-identical regeneration the key was minted for', () => {
      const intent = regenerateIntent()
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([intent]), plans: makePlans(makePlan(), null)})
      )

      expect(decision.outcome.kind).toBe('handoff')
      expect(
        decision.outcome.kind === 'handoff' &&
          matchesFingerprint(rebuildStoredRequest(decision.outcome.params), intent.fingerprint)
      ).toBe(true)
    })
  })

  // A READ NEVER SETTLES A KEYED WRITE (AAP 0.2.5): refetching the week is display-only, and a pending
  // generation is retired only by an answer to its own key — the stored replay the handoff goes and fetches, a
  // fresh commit, or a confirmed terminal error. So a week already carrying the pending key is handed over
  // exactly like any other, and the decision cannot be told apart from the one for a week that does not.
  describe('a plan already carrying the pending key', () => {
    it('hands the generation to its owner rather than concluding the key is answered', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([generateIntent()]),
          plans: makePlans(makePlan(), makeUpcomingPlan({generationKey: GENERATE_KEY}))
        })
      )

      expect(decision.outcome.kind).toBe('handoff')
      expect(decision.navigatedKey).toBe(GENERATE_KEY)
      expect(decision.outcome.kind === 'handoff' && decision.outcome.params.idempotencyKey).toBe(GENERATE_KEY)
    })

    it('hands the regeneration over under the key the stored record holds', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: makePlans(makePlan({generationKey: REGENERATE_KEY}), null)
        })
      )

      expect(decision.outcome.kind === 'handoff' && decision.outcome.params.idempotencyKey).toBe(REGENERATE_KEY)
    })

    // The proof that the refetch is display-only: the same stored record decides identically whether or not
    // the week in hand carries its key, so no branch reads a plan as an answer to a request.
    it('decides identically whether or not the week in hand carries the key', () => {
      const withMatch = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: makePlans(makePlan({generationKey: REGENERATE_KEY}), null)
        })
      )

      const withoutMatch = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: makePlans(makePlan({generationKey: 'gen-key-someone-else'}), null)
        })
      )

      expect(withMatch).toEqual(withoutMatch)
    })

    // A plan whose key is absent is the contract-conforming case: `generationKey` is an additive extra, so a
    // response without it is ordinary and may not change what this resolver does.
    it('decides identically when the plans carry no generation key at all', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: makePlans(makePlan({generationKey: null}), null)
        })
      )

      expect(decision.outcome.kind === 'handoff' && decision.outcome.params.idempotencyKey).toBe(REGENERATE_KEY)
    })

    it('still waits for the navigation gate, because a handoff is a navigation', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: makePlans(makePlan({generationKey: REGENERATE_KEY}), null),
          isHandoffAllowed: false
        })
      )

      expect(decision).toEqual({outcome: {kind: 'idle'}, navigatedKey: null})
    })

    it('does not reopen the screen for a key it already holds the latch for', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([regenerateIntent()]),
          plans: makePlans(makePlan({generationKey: REGENERATE_KEY}), null),
          navigatedKey: REGENERATE_KEY
        })
      )

      expect(decision).toEqual({outcome: {kind: 'idle'}, navigatedKey: REGENERATE_KEY})
    })

    it('owns nothing while no record is stored, however the plans are keyed', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({plans: makePlans(makePlan({generationKey: REGENERATE_KEY}), null)})
      )

      expect(decision).toEqual({outcome: {kind: 'idle'}, navigatedKey: null})
    })
  })

  describe('one handoff per key', () => {
    // The latch is held for the handoff the tab is currently holding, not for its lifetime: while it holds
    // that key the screen is not reopened, and `resolveHandoffLatch` releases it when focus is lost so the
    // same key can be reconstructed again on return. The pair below is that whole contract.
    it('does not reopen the screen while it still holds the latch for that key', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), navigatedKey: GENERATE_KEY})
      )

      expect(decision).toEqual({outcome: {kind: 'idle'}, navigatedKey: GENERATE_KEY})
    })

    it('reconstructs the same key again once the latch has been released on losing focus', () => {
      const released = resolveHandoffLatch(GENERATE_KEY, false)

      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), navigatedKey: released})
      )

      expect(decision).toEqual({
        outcome: {
          kind: 'handoff',
          params: {
            context: {kind: 'setup'},
            idempotencyKey: GENERATE_KEY,
            expectedPreferencesRevision: 4,
            expectedTargetsRevision: 2,
            startDate: UPCOMING_START_DATE
          }
        },
        navigatedKey: GENERATE_KEY
      })
    })

    it('hands over a different key even after one has been handed over', () => {
      const laterIntent = buildPendingIntent(
        {...GENERATE_SNAPSHOT, expectedTargetsRevision: 3},
        'idem-generate-2',
        USER_ID,
        INTENT_CREATED_AT
      )

      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([laterIntent]), navigatedKey: GENERATE_KEY})
      )

      expect(decision).toEqual({
        outcome: {
          kind: 'handoff',
          params: {
            context: {kind: 'setup'},
            idempotencyKey: 'idem-generate-2',
            expectedPreferencesRevision: 4,
            expectedTargetsRevision: 3,
            startDate: UPCOMING_START_DATE
          }
        },
        navigatedKey: 'idem-generate-2'
      })
    })

    it('waits while an attempt for the intent is already on the wire', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), isGenerationInFlight: true})
      )

      expect(decision).toEqual({outcome: {kind: 'idle'}, navigatedKey: null})
    })

    it('waits while the tab may not navigate — unfocused, unavailable, or the plan read unsettled', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), isHandoffAllowed: false})
      )

      expect(decision).toEqual({outcome: {kind: 'idle'}, navigatedKey: null})
    })
  })

  describe('two unresolved generations', () => {
    it('reconstructs the request the user is waiting on, which is the newer one', () => {
      const decision = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([generateIntent(), regenerateIntent(INTENT_CREATED_AT + 1000)]),
          plans: makePlans(makePlan(), null)
        })
      )

      expect(decision.navigatedKey).toBe(REGENERATE_KEY)
    })

    // A week already carrying the newer key changes nothing about which record is owned first: the newer one
    // is handed over, its replay answers it, and the render after its record is retired owns the older one.
    it('hands over the newer request even when its plan is already in hand, then the older one', () => {
      const published = makePlans(makePlan({generationKey: REGENERATE_KEY}), null)

      const first = resolvePendingGeneration(
        makeGenerationInputs({
          intents: makeIntents([generateIntent(), regenerateIntent(INTENT_CREATED_AT + 1000)]),
          plans: published
        })
      )

      expect(first.outcome.kind).toBe('handoff')
      expect(first.navigatedKey).toBe(REGENERATE_KEY)

      const afterSettlement = resolvePendingGeneration(
        makeGenerationInputs({intents: makeIntents([generateIntent()]), plans: published})
      )

      expect(afterSettlement.navigatedKey).toBe(GENERATE_KEY)
      expect(afterSettlement.outcome.kind).toBe('handoff')
    })
  })
})

// The tab as the cold-start owner of the two keyed writes that have no screen to reconstruct (AAP 0.7.2 —
// "the Meal Plan tab for swap/log"). Navigation state is not persisted, so a real cold start mounts this tab
// and not the log or preview route that made the request: if the replay does not happen here it happens
// nowhere, and the log screen's next attempt would rebuild a different request under a new key — a second
// diary entry for a meal the user logged once.
describe('resolveSwapOwnership and resolveLogOwnership', () => {
  const swapIntent = (createdAt: number = INTENT_CREATED_AT): PendingIntent =>
    buildPendingIntent(SWAP_SNAPSHOT, SWAP_KEY, USER_ID, createdAt)

  const logIntent = (createdAt: number = INTENT_CREATED_AT): PendingIntent =>
    buildPendingIntent(LOG_SNAPSHOT, LOG_KEY, USER_ID, createdAt)

  const makeWriteInputs = (overrides: Partial<InPlaceWriteInputs> = {}): InPlaceWriteInputs => ({
    intents: {pendingIntents: {}},
    userId: USER_ID,
    now: NOW,
    intentsHydration: 'succeeded',
    isReplayAllowed: true,
    isRequestInFlight: false,
    replayedKey: null,
    ...overrides
  })

  describe('the stored request, under the stored key', () => {
    it('replays the swap body the key was minted for, byte for byte', () => {
      const ownership = resolveSwapOwnership(makeWriteInputs({intents: makeIntents([swapIntent()])}))

      expect(ownership.intent).toEqual({planId: CURRENT_PLAN_ID, mealId: SWAP_MEAL_ID, key: SWAP_KEY})
      expect(ownership.payload).toEqual(requestBody(SWAP_SNAPSHOT, SWAP_KEY))
      expect(ownership.replayedKey).toBe(SWAP_KEY)
    })

    it('replays the log body the key was minted for, never one rebuilt from current data', () => {
      const ownership = resolveLogOwnership(makeWriteInputs({intents: makeIntents([logIntent()])}))

      expect(ownership.intent).toEqual({planId: CURRENT_PLAN_ID, mealId: LOG_MEAL_ID, key: LOG_KEY})
      expect(ownership.payload).toEqual(requestBody(LOG_SNAPSHOT, LOG_KEY))
      expect(ownership.replayedKey).toBe(LOG_KEY)
    })

    // Each resolver reads its own slot: the two writes are independent records and one must never be sent as
    // the other, whose endpoint and body differ entirely.
    it('reads only its own action', () => {
      const intents = makeIntents([swapIntent(), logIntent()])

      expect(resolveSwapOwnership(makeWriteInputs({intents})).payload).toEqual(requestBody(SWAP_SNAPSHOT, SWAP_KEY))
      expect(resolveLogOwnership(makeWriteInputs({intents})).payload).toEqual(requestBody(LOG_SNAPSHOT, LOG_KEY))
    })

    it('finds nothing to replay when the slot is empty', () => {
      expect(resolveSwapOwnership(makeWriteInputs())).toEqual({intent: null, payload: null, replayedKey: null})
      expect(resolveLogOwnership(makeWriteInputs())).toEqual({intent: null, payload: null, replayedKey: null})
    })
  })

  describe('nothing may be sent or concluded from an unread slice', () => {
    it('sends nothing while the persisted read is still out', () => {
      const ownership = resolveLogOwnership(
        makeWriteInputs({intents: makeIntents([logIntent()]), intentsHydration: 'pending'})
      )

      expect(ownership).toEqual({intent: null, payload: null, replayedKey: null})
    })

    it('sends nothing when the persisted read was refused, whose contents are unknown rather than empty', () => {
      const ownership = resolveSwapOwnership(
        makeWriteInputs({intents: makeIntents([swapIntent()]), intentsHydration: 'failed'})
      )

      expect(ownership).toEqual({intent: null, payload: null, replayedKey: null})
    })

    it('sends nothing while no account is known, since ownership cannot be judged', () => {
      const ownership = resolveLogOwnership(makeWriteInputs({intents: makeIntents([logIntent()]), userId: null}))

      expect(ownership).toEqual({intent: null, payload: null, replayedKey: null})
    })

    it('never replays a record another account minted', () => {
      const foreign = buildPendingIntent(LOG_SNAPSHOT, LOG_KEY, OTHER_USER_ID, INTENT_CREATED_AT)

      expect(resolveLogOwnership(makeWriteInputs({intents: makeIntents([foreign])})).payload).toBeNull()
    })

    it('never replays a record that has aged out', () => {
      const ownership = resolveSwapOwnership(
        makeWriteInputs({intents: makeIntents([swapIntent()]), now: INTENT_CREATED_AT + PENDING_INTENT_TTL_MS})
      )

      expect(ownership).toEqual({intent: null, payload: null, replayedKey: null})
    })
  })

  describe('one send per key', () => {
    it('does not send a key it has already sent', () => {
      const ownership = resolveSwapOwnership(
        makeWriteInputs({intents: makeIntents([swapIntent()]), replayedKey: SWAP_KEY})
      )

      expect(ownership.payload).toBeNull()
      expect(ownership.replayedKey).toBe(SWAP_KEY)
    })

    // The key still holds the slot, so the controls stay withheld until an answer retires the record — the
    // latch only stops a second send.
    it('keeps reporting the unresolved record after its one send', () => {
      const ownership = resolveLogOwnership(
        makeWriteInputs({intents: makeIntents([logIntent()]), replayedKey: LOG_KEY})
      )

      expect(ownership.intent).toEqual({planId: CURRENT_PLAN_ID, mealId: LOG_MEAL_ID, key: LOG_KEY})
    })

    it('waits while an attempt for that action is already on the wire, from here or from its own screen', () => {
      const ownership = resolveLogOwnership(
        makeWriteInputs({intents: makeIntents([logIntent()]), isRequestInFlight: true})
      )

      expect(ownership.payload).toBeNull()
      expect(ownership.replayedKey).toBeNull()
    })

    it('waits while the tab is not the route on screen or the feature is unavailable', () => {
      const ownership = resolveSwapOwnership(
        makeWriteInputs({intents: makeIntents([swapIntent()]), isReplayAllowed: false})
      )

      expect(ownership.payload).toBeNull()
      expect(ownership.intent).toEqual({planId: CURRENT_PLAN_ID, mealId: SWAP_MEAL_ID, key: SWAP_KEY})
    })
  })
})

// What the tab does with the outcome of its own silent replay. The defect this resolver removes: an unknown
// outcome returned silently, leaving the ordinary plan tab over a key nobody owned, and every other confirmed
// refusal cleared the record without a word — neither reached the action-specific state AAP 0.2.5 draws.
describe('resolveRestoredWriteDisposition', () => {
  const swapFailedError = {response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}}
  const recipeIneligibleError = {response: {status: 422, data: {error: API_ERROR_CODES.recipeIneligible}}}
  const idempotencyConflictError = {response: {status: 409, data: {error: API_ERROR_CODES.idempotencyConflict}}}
  const invalidRequestError = {response: {status: 400, data: {error: API_ERROR_CODES.invalidRequest}}}

  const disposition = (error: unknown, action: InPlaceWriteAction = 'swap') =>
    resolveRestoredWriteDisposition({action, key: action === 'swap' ? SWAP_KEY : LOG_KEY, error})

  describe('an outcome nothing has answered', () => {
    // The write may have committed before the response was lost, so the key stays the only safe way to ask
    // again — and the state is reported, because the plan tab alone says nothing about it (0.2.5, 0.7.2).
    it('keeps the record and reports the unknown outcome for its key', () => {
      expect(disposition(networkError)).toEqual({
        clearsIntent: false,
        recoversStalePlan: false,
        refetchesCurrentPlan: false,
        report: {action: 'swap', key: SWAP_KEY, outcome: 'unknown'}
      })
    })

    it('treats an undecodable body and a 5xx without a known code as the same unknown', () => {
      expect(disposition(undecodableError, 'log').report).toEqual({
        action: 'log',
        key: LOG_KEY,
        outcome: 'unknown'
      })
    })
  })

  describe('the capability verdict', () => {
    // The segment's unavailable card explains this once; routing into the write's own screen would bounce
    // straight back out through that screen's own recovery, so nothing is reported.
    it('retires the record silently and re-reads the plan', () => {
      expect(disposition(featureDisabledError)).toEqual({
        clearsIntent: true,
        recoversStalePlan: false,
        refetchesCurrentPlan: true,
        report: null
      })
    })
  })

  describe('a plan the server will no longer write', () => {
    // AAP 0.7.2's named behaviour, and it must not change: the plan the write named is gone, so there is no
    // meal, day or revision left to route to.
    it('retires the record and takes the stale-plan recovery, with nothing to hand off', () => {
      const expected = {
        clearsIntent: true,
        recoversStalePlan: true,
        refetchesCurrentPlan: false,
        report: null
      }

      expect(disposition(stalePlanError)).toEqual(expected)
      expect(disposition(planNotActiveError, 'log')).toEqual(expected)
    })

    // The recovery already refetches, so asking for a second read would double it.
    it('never asks for the silent refetch beside the recovery that carries one', () => {
      const decided = disposition(stalePlanError)

      expect(decided.recoversStalePlan && decided.refetchesCurrentPlan).toBe(false)
    })
  })

  describe('a confirmed refusal of this key', () => {
    // Kept rather than cleared: the owning screen re-sends the same stored key, receives the same confirmed
    // answer and retires the key through its own mapping, which is where 0.2.5 draws the state.
    it('keeps the record and reports the confirmed failure', () => {
      expect(disposition(swapFailedError)).toEqual({
        clearsIntent: false,
        recoversStalePlan: false,
        refetchesCurrentPlan: false,
        report: {action: 'swap', key: SWAP_KEY, outcome: 'failed'}
      })
    })

    it('reports every other confirmed code the same way, whatever its status', () => {
      expect(disposition(recipeIneligibleError).report?.outcome).toBe('failed')
      expect(disposition(idempotencyConflictError).report?.outcome).toBe('failed')
      expect(disposition(invalidRequestError).report?.outcome).toBe('failed')
      expect(disposition(legacyNotFoundError, 'log').report).toEqual({
        action: 'log',
        key: LOG_KEY,
        outcome: 'failed'
      })
    })
  })
})

// Where a reported state is owned: the action's own screen, opened with the ids it needs to reconstruct the
// write. The screens already own every mapped outcome — SwapMeal finds the attempt by its idempotency key in
// the shared mutation cache and replays the stored key once on open, LogPlannedMeal replays through
// `planStoredLogReplay` and maps confirmed failures through `classifyLogFailure` — so nothing about the
// outcome travels with the handoff (0.2.5).
describe('resolveRestoredWriteRecovery', () => {
  const SWAP_DAY_KEY = '2026-07-07'
  const CURRENT_REVISION = 6
  const UPCOMING_REVISION = 3

  const swapRecord: InPlaceWriteIntent = {planId: CURRENT_PLAN_ID, mealId: SWAP_MEAL_ID, key: SWAP_KEY}
  const logRecord: InPlaceWriteIntent = {planId: CURRENT_PLAN_ID, mealId: LOG_MEAL_ID, key: LOG_KEY}

  // The swap meal sits on a LATER day than the plan's first, so a resolver that answered with the plan's start
  // date — or with the day the tab happens to be showing — cannot pass.
  const planWithBothMeals = (overrides: Partial<MealPlan> = {}): MealPlan =>
    makePlan({
      revision: CURRENT_REVISION,
      days: [
        makeDay({id: 'day-1', date: PLAN_START_DATE, meals: [makeMeal({id: LOG_MEAL_ID})]}),
        makeDay({id: 'day-3', date: SWAP_DAY_KEY, meals: [makeMeal({id: SWAP_MEAL_ID, slot: 'lunch'})]})
      ],
      ...overrides
    })

  const makeRecoveryInputs = (
    overrides: Partial<Parameters<typeof resolveRestoredWriteRecovery>[0]> = {}
  ): Parameters<typeof resolveRestoredWriteRecovery>[0] => ({
    report: {action: 'swap', key: SWAP_KEY, outcome: 'failed'},
    swapIntent: swapRecord,
    logIntent: null,
    plans: makePlans(planWithBothMeals(), null),
    isHandoffAllowed: true,
    handedOffKey: null,
    ...overrides
  })

  describe('the route a reported state is owned on', () => {
    it('opens the swap screen on the planned day of the meal the record names', () => {
      expect(resolveRestoredWriteRecovery(makeRecoveryInputs())).toEqual({
        kind: 'handoff',
        action: 'swap',
        key: SWAP_KEY,
        target: {
          screen: 'swap',
          params: {
            planId: CURRENT_PLAN_ID,
            mealId: SWAP_MEAL_ID,
            date: SWAP_DAY_KEY,
            planRevision: CURRENT_REVISION
          }
        }
      })
    })

    it('finds the meal in the upcoming plan as readily as in the current one', () => {
      const upcoming = makeUpcomingPlan({
        revision: UPCOMING_REVISION,
        days: [makeDay({id: 'day-8', date: UPCOMING_START_DATE, meals: [makeMeal({id: SWAP_MEAL_ID})]})]
      })
      const recovery = resolveRestoredWriteRecovery(
        makeRecoveryInputs({
          swapIntent: {planId: UPCOMING_PLAN_ID, mealId: SWAP_MEAL_ID, key: SWAP_KEY},
          plans: makePlans(planWithBothMeals(), upcoming)
        })
      )

      expect(recovery).toEqual({
        kind: 'handoff',
        action: 'swap',
        key: SWAP_KEY,
        target: {
          screen: 'swap',
          params: {
            planId: UPCOMING_PLAN_ID,
            mealId: SWAP_MEAL_ID,
            date: UPCOMING_START_DATE,
            planRevision: UPCOMING_REVISION
          }
        }
      })
    })

    // The stored log snapshot carries the DIARY date the entry was written to, which frame 15's stepper may
    // have moved off the planned day. The route is the planned day the meal sits on, never that date.
    it('opens the log screen on the planned day, not on the diary date the request carried', () => {
      const recovery = resolveRestoredWriteRecovery(
        makeRecoveryInputs({
          report: {action: 'log', key: LOG_KEY, outcome: 'unknown'},
          swapIntent: null,
          logIntent: logRecord
        })
      )

      expect(recovery).toEqual({
        kind: 'handoff',
        action: 'log',
        key: LOG_KEY,
        target: {
          screen: 'log',
          params: {
            planId: CURRENT_PLAN_ID,
            mealId: LOG_MEAL_ID,
            date: PLAN_START_DATE,
            planRevision: CURRENT_REVISION
          }
        }
      })
    })

    it('reads the record of the action the report names, never the other slot', () => {
      const bothOnFile = makeRecoveryInputs({
        report: {action: 'log', key: LOG_KEY, outcome: 'failed'},
        swapIntent: swapRecord,
        logIntent: logRecord
      })

      expect(resolveRestoredWriteRecovery(bothOnFile)).toMatchObject({action: 'log', key: LOG_KEY})
    })
  })

  describe('nothing to hand off', () => {
    it('stays idle while there is no reported state', () => {
      expect(resolveRestoredWriteRecovery(makeRecoveryInputs({report: null}))).toEqual({kind: 'idle'})
    })

    // Withheld rather than dropped: the caller keeps the report, so the handoff fires when this tab is the
    // route on screen again and the feature is available.
    it('withholds the handoff while the tab may not navigate', () => {
      expect(resolveRestoredWriteRecovery(makeRecoveryInputs({isHandoffAllowed: false}))).toEqual({kind: 'idle'})
    })

    it('stays idle once that key has already been handed over', () => {
      expect(resolveRestoredWriteRecovery(makeRecoveryInputs({handedOffKey: SWAP_KEY}))).toEqual({kind: 'idle'})
    })

    it('answers settled when the record is no longer on file, or has moved on to another key', () => {
      const gone = makeRecoveryInputs({swapIntent: null})
      const laterKey = makeRecoveryInputs({
        swapIntent: {planId: CURRENT_PLAN_ID, mealId: SWAP_MEAL_ID, key: 'idem-swap-2'}
      })

      expect(resolveRestoredWriteRecovery(gone)).toEqual({kind: 'settled', action: 'swap', key: SWAP_KEY})
      expect(resolveRestoredWriteRecovery(laterKey)).toEqual({kind: 'settled', action: 'swap', key: SWAP_KEY})
    })
  })

  describe('a plan no route can be built for', () => {
    // A superseded or ended week is not in `{current, upcoming}`, so there is no screen to open the write on.
    it('retires and states a confirmed refusal whose plan is gone', () => {
      const supersededPlan = makeRecoveryInputs({plans: makePlans(null, null)})

      expect(resolveRestoredWriteRecovery(supersededPlan)).toEqual({
        kind: 'unreachable',
        action: 'swap',
        key: SWAP_KEY,
        clearsIntent: true,
        reportsError: true
      })
    })

    // The key stays the only safe way to ask again, so an unknown outcome is neither retired nor announced —
    // the next open owns it (0.7.2).
    it('keeps an unknown outcome silently when its plan is gone', () => {
      const supersededPlan = makeRecoveryInputs({
        report: {action: 'swap', key: SWAP_KEY, outcome: 'unknown'},
        plans: makePlans(null, null)
      })

      expect(resolveRestoredWriteRecovery(supersededPlan)).toEqual({
        kind: 'unreachable',
        action: 'swap',
        key: SWAP_KEY,
        clearsIntent: false,
        reportsError: false
      })
    })

    it('treats a plan whose days no longer hold that meal as unreachable too', () => {
      const mealRemoved = makeRecoveryInputs({
        plans: makePlans(makePlan({revision: CURRENT_REVISION, days: [makeDay({meals: [makeMeal()]})]}), null),
        swapIntent: {planId: CURRENT_PLAN_ID, mealId: 'meal-dinner', key: SWAP_KEY}
      })

      expect(resolveRestoredWriteRecovery(mealRemoved)).toMatchObject({kind: 'unreachable', clearsIntent: true})
    })
  })

  // The opposite fact, which looks identical at the call site: no plan data yet. The replay fires as soon as
  // the persisted slice is read and races the current-plan query, so a refusal arriving before that read
  // answers is ordinary — and reading it as "no route exists" would retire a confirmed refusal with nothing
  // but a toast, or drop an unknown outcome's report, leaving the state the tab was supposed to hand over
  // stranded until a later remount.
  describe('a plan read that has not answered yet', () => {
    it('holds a confirmed refusal instead of judging it unreachable', () => {
      expect(resolveRestoredWriteRecovery(makeRecoveryInputs({plans: undefined}))).toEqual({
        kind: 'pending',
        action: 'swap',
        key: SWAP_KEY
      })
    })

    it('holds an unknown outcome the same way', () => {
      const unresolvedRead = makeRecoveryInputs({
        report: {action: 'swap', key: SWAP_KEY, outcome: 'unknown'},
        plans: undefined
      })

      expect(resolveRestoredWriteRecovery(unresolvedRead)).toEqual({
        kind: 'pending',
        action: 'swap',
        key: SWAP_KEY
      })
    })

    it('holds a reported log the same way', () => {
      const unresolvedRead = makeRecoveryInputs({
        report: {action: 'log', key: LOG_KEY, outcome: 'failed'},
        swapIntent: null,
        logIntent: logRecord,
        plans: undefined
      })

      expect(resolveRestoredWriteRecovery(unresolvedRead)).toEqual({
        kind: 'pending',
        action: 'log',
        key: LOG_KEY
      })
    })

    // The sequence the race actually produces: the same report, resolved twice. Held while the read is out,
    // then routed the frame it lands — which is why the report is kept rather than cleared, and why the
    // caller acts on nothing for `pending`.
    it('routes the same report once the read answers', () => {
      const report = {action: 'swap', key: SWAP_KEY, outcome: 'failed'} as const

      expect(resolveRestoredWriteRecovery(makeRecoveryInputs({report, plans: undefined}))).toMatchObject({
        kind: 'pending'
      })
      expect(
        resolveRestoredWriteRecovery(makeRecoveryInputs({report, plans: makePlans(planWithBothMeals(), null)}))
      ).toMatchObject({
        kind: 'handoff',
        target: {screen: 'swap', params: {planId: CURRENT_PLAN_ID, date: SWAP_DAY_KEY}}
      })
    })

    // A read that answered and holds no such plan is still unreachable: the distinction is the answer, not
    // the absence of a route.
    it('still judges a record unreachable once the read answers without its plan', () => {
      const report = {action: 'swap', key: SWAP_KEY, outcome: 'failed'} as const

      expect(resolveRestoredWriteRecovery(makeRecoveryInputs({report, plans: makePlans(null, null)}))).toMatchObject({
        kind: 'unreachable',
        clearsIntent: true,
        reportsError: true
      })
    })
  })
})

// The gate that decides whether the tab may draw its ordinary surfaces at all. Those surfaces carry Swap, Log
// and the routes that generate a plan, so exposing them while the existence of an unresolved keyed write is
// unknown is what lets a press mint a second key over one the server may already have committed (0.7.2).
describe('resolveTabFrame', () => {
  const planBody: MealPlanBodyOutcome = {kind: 'plan', plan: makePlan(), isSavedCopy: false}
  const emptyBody: MealPlanBodyOutcome = {kind: 'empty', cta: 'create'}
  const unavailableBody: MealPlanBodyOutcome = {kind: 'unavailable'}

  it('draws the plan only once the persisted slice has been read and nothing is pending', () => {
    expect(resolveTabFrame(planBody, {kind: 'idle'})).toEqual({kind: 'body', outcome: planBody})
  })

  it('withholds the plan while the persisted read is still out', () => {
    expect(resolveTabFrame(planBody, {kind: 'hydrating'})).toEqual({kind: 'withheld'})
  })

  it('withholds the setup call to action while the persisted read is still out', () => {
    expect(resolveTabFrame(emptyBody, {kind: 'hydrating'})).toEqual({kind: 'withheld'})
  })

  it('offers the retry rather than the plan when the persisted read was refused', () => {
    expect(resolveTabFrame(planBody, {kind: 'unreadable'})).toEqual({kind: 'intentsUnreadable'})
  })

  it('withholds the plan for the frame that hands a generation to its owner', () => {
    expect(
      resolveTabFrame(planBody, {
        kind: 'handoff',
        params: {
          context: {kind: 'setup'},
          idempotencyKey: GENERATE_KEY,
          expectedPreferencesRevision: 4,
          expectedTargetsRevision: 2,
          startDate: UPCOMING_START_DATE
        }
      })
    ).toEqual({kind: 'withheld'})
  })

  it('withholds the plan while the persisted record has not been read yet', () => {
    expect(resolveTabFrame(planBody, {kind: 'hydrating'})).toEqual({kind: 'withheld'})
  })

  // The unavailable card offers nothing to press, and no keyed write can be owned while the feature is off, so
  // replacing it with a placeholder that can never resolve would be strictly worse.
  it('keeps the unavailable card whatever the persisted read is doing', () => {
    expect(resolveTabFrame(unavailableBody, {kind: 'hydrating'})).toEqual({kind: 'body', outcome: unavailableBody})
    expect(resolveTabFrame(unavailableBody, {kind: 'unreadable'})).toEqual({kind: 'body', outcome: unavailableBody})
  })
})

describe('resolveFrameOutcome', () => {
  it('passes an ordinary body through untouched', () => {
    const outcome: MealPlanBodyOutcome = {kind: 'plan', plan: makePlan(), isSavedCopy: true}

    expect(resolveFrameOutcome({kind: 'body', outcome})).toBe(outcome)
  })

  it('draws a withheld frame as the first-load placeholder, never as a plan or an empty state', () => {
    expect(resolveFrameOutcome({kind: 'withheld'})).toEqual({kind: 'loading'})
  })

  it('draws a refused persisted read as the inline retry card', () => {
    expect(resolveFrameOutcome({kind: 'intentsUnreadable'})).toEqual({kind: 'error'})
  })
})

// The latch is scoped to the handoff the tab is holding. Holding it for the process is what let a popped
// Generating screen leave an unresolved key with no owner and normal state on screen.
describe('resolveHandoffLatch', () => {
  it('keeps the latch while the tab is the route on screen', () => {
    expect(resolveHandoffLatch(GENERATE_KEY, true)).toBe(GENERATE_KEY)
  })

  it('releases the latch when focus is lost, which is when the handoff has been taken', () => {
    expect(resolveHandoffLatch(GENERATE_KEY, false)).toBeNull()
  })

  it('has nothing to release when no handoff is held', () => {
    expect(resolveHandoffLatch(null, true)).toBeNull()
    expect(resolveHandoffLatch(null, false)).toBeNull()
  })
})

describe('resolveSetupResumeTarget', () => {
  it('opens the saved step itself, so a returning user never meets the introduction again', () => {
    expect(resolveSetupResumeTarget('goal')).toEqual({route: Screens.MEAL_PLAN_GOAL, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('body')).toEqual({route: Screens.MEAL_PLAN_ABOUT_YOU, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('activity')).toEqual({route: Screens.MEAL_PLAN_ACTIVITY, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('diet')).toEqual({route: Screens.MEAL_PLAN_DIET, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('dislikes')).toEqual({
      route: Screens.MEAL_PLAN_FOOD_PREFERENCES,
      params: {mode: 'setup'}
    })
    expect(resolveSetupResumeTarget('schedule')).toEqual({route: Screens.MEAL_PLAN_SCHEDULE, params: {mode: 'setup'}})
    expect(resolveSetupResumeTarget('cooking')).toEqual({
      route: Screens.MEAL_PLAN_COOKING_BUDGET,
      params: {mode: 'setup'}
    })
  })

  it('opens review in setup mode once every answer is in', () => {
    expect(resolveSetupResumeTarget('review')).toEqual({route: Screens.MEAL_PLAN_TARGETS, params: {mode: 'setup'}})
  })

  it('resumes the manual-target route in the blank editor that carries on into diet', () => {
    expect(resolveSetupResumeTarget('targets_manual')).toEqual({
      route: Screens.MEAL_PLAN_EDIT_TARGETS,
      params: {mode: 'manual', returnTo: {kind: 'stack', route: 'diet'}}
    })
  })

  it('carries params for every step, so no resume target can be navigated to without them', () => {
    const steps: SetupStep[] = [
      'goal',
      'body',
      'activity',
      'diet',
      'dislikes',
      'schedule',
      'cooking',
      'review',
      'targets_manual'
    ]

    steps.forEach(step => expect(resolveSetupResumeTarget(step).params).toBeDefined())
  })

  it('hands out its own params object each time, so an edited target cannot leak into the next resume', () => {
    const first = resolveSetupResumeTarget('goal')
    const second = resolveSetupResumeTarget('goal')

    expect(first.params).not.toBe(second.params)
    expect(first.params).toEqual(second.params)
  })

  it('starts at the goal step when no step is saved', () => {
    expect(resolveSetupResumeTarget(null)).toEqual({route: Screens.MEAL_PLAN_GOAL, params: {mode: 'setup'}})
  })

  it('starts at the goal step for a step a newer server introduced', () => {
    const unrecognizedStep: string = 'onboarding_v2'

    expect(resolveSetupResumeTarget(unrecognizedStep as SetupStep)).toEqual({
      route: Screens.MEAL_PLAN_GOAL,
      params: {mode: 'setup'}
    })
  })
})

/**
 * The gate the day's Swap and Log pills are drawn from.
 *
 * Two things cannot answer it. `MealPlan.status` cannot: §0.5.1 leaves a finished week stored 'active' so its
 * rows stay readable, and every write against it is refused `409 plan_not_active {reason: 'ended'}`. Neither
 * can the plan's dates read against the device's calendar day: endedness is judged in the user's saved IANA
 * zone, which the AAP keeps as a home zone until their next preferences save, so after travel the two days
 * disagree and the device's answer offers writes the server refuses. The only input that opens these controls
 * is the day envelope's own `isWritable` for the selected day.
 */
describe('arePlanActionsOffered', () => {
  const WRITABLE = true
  const REFUSED = false
  // What the display-only seeded envelope carries, and what a pending day query has answered so far.
  const UNKNOWN = null
  // Whether a swap or log key is still unanswered — the single slot per action that a new write would
  // overwrite (0.7.2).
  const NO_PENDING_WRITE = false
  const PENDING_WRITE = true

  it('offers the actions when the day route says the plan accepts writes', () => {
    const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(makePlan(), null)}))

    expect(arePlanActionsOffered(outcome, WRITABLE, NO_PENDING_WRITE)).toBe(true)
  })

  // The same reason the swap screen withholds its alternatives: one unresolved record per action, and a new
  // swap or log would mint over the only key that can reconcile a write the server may already hold.
  it('withholds them while a swap or log key is still unanswered, against a writable verdict', () => {
    const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(makePlan(), null)}))

    expect(arePlanActionsOffered(outcome, WRITABLE, PENDING_WRITE)).toBe(false)
  })

  it('withholds them when the day route refuses writes, though the plan is still stored active', () => {
    const plan = makePlan()
    const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(plan, null)}))

    expect(plan.status).toBe('active')
    expect(arePlanActionsOffered(outcome, REFUSED, NO_PENDING_WRITE)).toBe(false)
  })

  it('withholds them while no verdict has arrived, so the seeded day renders read-only', () => {
    const outcome = resolveMealPlanBody(makeBodyInputs({plans: makePlans(makePlan(), null)}))

    expect(arePlanActionsOffered(outcome, UNKNOWN, NO_PENDING_WRITE)).toBe(false)
    expect(arePlanActionsOffered(outcome, undefined, NO_PENDING_WRITE)).toBe(false)
  })

  it('never derives a verdict from the plan on screen: a live-looking week alone offers nothing', () => {
    // The week is current, stored active and inside its own dates — and still nothing is offered, because
    // only the server may judge that in the user's saved zone.
    const outcome = resolveMealPlanBody(
      makeBodyInputs({plans: makePlans(makePlan({status: 'active', endDate: '2099-12-31'}), null)})
    )

    expect(arePlanActionsOffered(outcome, UNKNOWN, NO_PENDING_WRITE)).toBe(false)
  })

  it('withholds them while the week is a saved copy, even against a writable verdict', () => {
    const outcome = resolveMealPlanBody(
      makeBodyInputs({plans: makePlans(makePlan(), null), currentPlanError: networkError})
    )

    expect(outcome).toEqual({kind: 'plan', plan: expect.anything(), isSavedCopy: true})
    // The revision of a persisted copy cannot be trusted as expectedPlanRevision, so a stale 409 is traded
    // for a control that was never offered.
    expect(arePlanActionsOffered(outcome, WRITABLE, NO_PENDING_WRITE)).toBe(false)
  })

  it('offers nothing for every body that is not a plan', () => {
    const notPlans = [
      resolveMealPlanBody(makeBodyInputs({availability: 'disabled'})),
      resolveMealPlanBody(makeBodyInputs({currentPlanError: stalePlanError})),
      resolveMealPlanBody(makeBodyInputs({isLoading: true, plans: undefined})),
      resolveMealPlanBody(makeBodyInputs())
    ]

    notPlans.forEach(outcome => expect(arePlanActionsOffered(outcome, WRITABLE, NO_PENDING_WRITE)).toBe(false))
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

  it('keeps the chosen week while the plans response has not arrived yet', () => {
    expect(resolveStalePlanSelection(undefined, UPCOMING_PLAN_ID)).toBe(UPCOMING_PLAN_ID)
  })

  it('clears the chosen week only once a response has proved it stale', () => {
    expect(resolveStalePlanSelection(undefined, 'plan-from-last-month')).toBe('plan-from-last-month')
    expect(resolveStalePlanSelection(makePlans(makePlan(), null), 'plan-from-last-month')).toBeNull()
  })

  it('clears a selection against a response that returns no plan at all', () => {
    expect(resolveStalePlanSelection(makePlans(null, null), UPCOMING_PLAN_ID)).toBeNull()
  })

  it('stores no selection when none is held', () => {
    expect(resolveStalePlanSelection(makePlans(makePlan(), null), null)).toBeNull()
    expect(resolveStalePlanSelection(undefined, null)).toBeNull()
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

  it('offers nothing that reopens the upcoming plan already on screen', () => {
    expect(resolveLastDayAction(makePlans(makePlan(), makeUpcomingPlan()), UPCOMING_PLAN_ID, UPCOMING_END_DATE)).toBe(
      null
    )
  })

  it('offers nothing on the last day of an upcoming plan that is the only one held', () => {
    expect(resolveLastDayAction(makePlans(null, makeUpcomingPlan()), null, UPCOMING_END_DATE)).toBeNull()
  })

  it('offers nothing on the last day of an upcoming plan selected by id with no current plan', () => {
    expect(resolveLastDayAction(makePlans(null, makeUpcomingPlan()), UPCOMING_PLAN_ID, UPCOMING_END_DATE)).toBeNull()
  })

  it('still offers the upcoming week from the current plan while the upcoming one exists', () => {
    expect(resolveLastDayAction(makePlans(makePlan(), makeUpcomingPlan()), CURRENT_PLAN_ID, PLAN_END_DATE)).toBe(
      'viewNextWeek'
    )
  })

  it('offers nothing on the current plan last day while the upcoming plan is the one on screen', () => {
    expect(resolveLastDayAction(makePlans(makePlan(), makeUpcomingPlan()), UPCOMING_PLAN_ID, PLAN_END_DATE)).toBeNull()
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

  // A deliberate behaviour change, not a test bent to fit the code: the reason is only ever read to look copy
  // up, so a code this build has no copy for resolves to the generic reason here rather than being carried
  // through to a lookup that answers nothing — which is the TypeError the card's render threw.
  it('resolves a code this build has no copy for to the generic reason instead of carrying it through', () => {
    const reason = resolveMealFlagReason([makeFlag({code: UNRECOGNISED_FLAG_CODE, detail: ['x']})])

    expect(reason).not.toBe(UNRECOGNISED_FLAG_CODE)
    expect(reason).toBe(resolveMealFlagReason([makeFlag({code: 'allergen'}), makeFlag({code: 'dislike'})]))
  })
})

// The line a flagged card states, asserted whole rather than as the template it came from: the detail means
// something different per code — the user's own allergen or diet code, the offending ingredients' display
// names, the recipe's own minutes — and it is the rendered sentence that was wrong.
describe('resolveMealFlagLine', () => {
  // The generic sentence, aliased for the table below only: most of the matrix is a way for a specific
  // sentence to be impossible, and each of those rows answers with this one.
  const GENERIC_LINE = MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT

  const lineCases: [string, MealPlanFlag[], string | null][] = [
    ['a diet flag', [makeFlag({code: 'diet', detail: ['vegan']})], "Doesn't fit your vegan diet"],
    ['an allergen flag', [makeFlag({detail: ['tree_nuts']})], 'Contains tree nuts'],
    [
      'a dislike flag',
      [makeFlag({code: 'dislike', detail: ['Mushrooms, white']})],
      'Contains Mushrooms, white · an ingredient you skip'
    ],
    [
      'a cooking-time flag',
      [makeFlag({code: 'cooking_time', detail: ['30']})],
      'Takes 30 minutes · longer than your cooking time'
    ],
    [
      'two flags of one code, each detail stated once',
      [makeFlag(), makeFlag({detail: ['milk', 'soy']})],
      'Contains milk, soy'
    ],
    [
      'two cooking-time flags, stated by the longer',
      [makeFlag({code: 'cooking_time', detail: ['20']}), makeFlag({code: 'cooking_time', detail: ['45']})],
      'Takes 45 minutes · longer than your cooking time'
    ],
    [
      'a padded cooking-time detail',
      [makeFlag({code: 'cooking_time', detail: [' 30 ']})],
      'Takes 30 minutes · longer than your cooking time'
    ],
    ['flags whose codes differ', [makeFlag(), makeFlag({code: 'dislike'})], GENERIC_LINE],
    ['an unrecognised code', [makeFlag({code: UNRECOGNISED_FLAG_CODE, detail: ['x']})], GENERIC_LINE],
    ['an unrecognised code carrying no detail', [makeFlag({code: UNRECOGNISED_FLAG_CODE, detail: []})], GENERIC_LINE],
    ['an allergen flag carrying no detail', [makeFlag({detail: []})], GENERIC_LINE],
    ['a blank allergen detail', [makeFlag({detail: ['']})], GENERIC_LINE],
    ['the allergen sentinel, which names nothing a meal contains', [makeFlag({detail: ['none']})], GENERIC_LINE],
    ['one unstateable allergen among stateable ones', [makeFlag({detail: ['milk', 'none']})], GENERIC_LINE],
    ['a diet that excludes nothing', [makeFlag({code: 'diet', detail: ['none']})], GENERIC_LINE],
    ['a diet code this build has no sentence for', [makeFlag({code: 'diet', detail: ['carnivore']})], GENERIC_LINE],
    ['a whitespace-only dislike name', [makeFlag({code: 'dislike', detail: ['   ']})], GENERIC_LINE],
    ['a fractional cooking time', [makeFlag({code: 'cooking_time', detail: ['30.5']})], GENERIC_LINE],
    ['a zero cooking time', [makeFlag({code: 'cooking_time', detail: ['0']})], GENERIC_LINE],
    ['a negative cooking time', [makeFlag({code: 'cooking_time', detail: ['-30']})], GENERIC_LINE],
    ['a non-numeric cooking time', [makeFlag({code: 'cooking_time', detail: ['soon']})], GENERIC_LINE],
    [
      'a cooking time alongside one that cannot be read',
      [makeFlag({code: 'cooking_time', detail: ['45']}), makeFlag({code: 'cooking_time', detail: ['soon']})],
      GENERIC_LINE
    ],
    ['a meal with no flags', [], null]
  ]

  it.each(lineCases)('states the line for %s', (_name, flags, expected) => {
    expect(resolveMealFlagLine(flags)).toBe(expected)
  })

  // The consequence of the substitution helper dropping an unsupplied value: a template whose detail could not
  // be formatted must never be substituted, or the card reads "Contains " with a gap where the detail belongs.
  it('leaves no placeholder and no trailing gap in any line of the matrix', () => {
    const lines = lineCases
      .map(([, flags]) => resolveMealFlagLine(flags))
      .filter((line): line is string => line !== null)

    expect(lines).toHaveLength(lineCases.length - 1)

    lines.forEach(line => {
      expect(line).not.toContain('{')
      expect(line).not.toMatch(/\s$/)
      expect(line.length).toBeGreaterThan(0)
    })
  })

  // The crash F08 reported, at the function that now owns the lookup.
  it('does not throw for a code this build has no copy for', () => {
    expect(() => resolveMealFlagLine([makeFlag({code: UNRECOGNISED_FLAG_CODE, detail: ['x']})])).not.toThrow()
  })

  // The card keys its flagged stroke on this answer, so a meal whose reason can only be stated generically has
  // to keep a line: null is "not flagged", never "flagged but unstateable".
  it('answers null only for a meal carrying no flags', () => {
    expect(resolveMealFlagLine([makeFlag({code: UNRECOGNISED_FLAG_CODE, detail: []})])).not.toBeNull()
    expect(resolveMealFlagLine([makeFlag({detail: []})])).not.toBeNull()
    expect(resolveMealFlagLine([])).toBeNull()
  })
})

describe('mealCountUnitText', () => {
  it.each([
    [0, 'kcal across 0 meals'],
    [1, 'kcal across 1 meal'],
    [2, 'kcal across 2 meals'],
    [3, 'kcal across 3 meals']
  ])('states the unit line for a day of %p meals', (count, expected) => {
    expect(mealCountUnitText(count)).toBe(expected)
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

  it('collapses to zero when the gaps exceed the available width', () => {
    expect(flexItemWidth(20, 6, 7)).toBe(0)
    expect(flexItemWidth(8, 8, 2)).toBe(0)
  })

  it('collapses to zero on the exact boundary, where the gaps consume the whole width', () => {
    expect(flexItemWidth(36, 6, 7)).toBe(0)
  })

  it('never returns a negative width for the skeleton it sizes', () => {
    ;[4, 12, 20, 30, 36, 40].forEach(availableWidth => {
      expect(flexItemWidth(availableWidth, 6, 7)).toBeGreaterThanOrEqual(0)
    })
  })
})

describe('isStalePlanError', () => {
  it('recognises a 4xx whose decoded body says the plan has been replaced or closed to writes', () => {
    expect(isStalePlanError(stalePlanError)).toBe(true)
    expect(isStalePlanError(planNotActiveError)).toBe(true)
  })

  // The resource route never returns a plan-state code: a plan that is gone, foreign, or asked for a date
  // outside its week is one 404 carrying prose. It invalidates the plan the screen holds just as the codes
  // do, so it earns the same recovery and must not be left to an inline retry of the dead resource.
  it("recognises the resource route's 404 {error: 'Plan not found'}", () => {
    expect(isStalePlanError(resourceNotFoundError)).toBe(true)
    expect(isStalePlanError(legacyNotFoundError)).toBe(true)
  })

  // The bare 404 of a resource-less GET means the backend was rolled back; that is the entitlement's verdict
  // to draw, not a plan to recover.
  it('refuses the routes-missing 404, which says nothing about this plan', () => {
    expect(isStalePlanError(routesMissingError)).toBe(false)
  })

  // The status is part of the answer: a gateway body that merely echoes the code described nothing about the
  // request, so recovering on it would replace a live plan and abandon a read a retry would have completed.
  it('refuses a 5xx carrying a plan-state code, whose outcome is unknown', () => {
    expect(isStalePlanError({response: {status: 502, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(false)
    expect(isStalePlanError({response: {status: 500, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(false)
    expect(isStalePlanError({response: {status: 504, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(false)
  })

  it('refuses an undecodable, bodiless or transport failure', () => {
    expect(isStalePlanError(undecodableError)).toBe(false)
    expect(isStalePlanError({response: {status: 409}})).toBe(false)
    expect(isStalePlanError(networkError)).toBe(false)
    expect(isStalePlanError(null)).toBe(false)
    expect(isStalePlanError(undefined)).toBe(false)
  })

  it('leaves every other decoded code to its own handling', () => {
    expect(isStalePlanError(featureDisabledError)).toBe(false)
    expect(isStalePlanError({response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}})).toBe(false)
    expect(isStalePlanError({response: {status: 409, data: {error: API_ERROR_CODES.staleRevision}}})).toBe(false)
  })
})

describe('resolveMealPlanDaySection', () => {
  const makeEnvelope = (overrides: Partial<MealPlanDayEnvelope> = {}): MealPlanDayEnvelope => ({
    planId: CURRENT_PLAN_ID,
    planRevision: 1,
    planStatus: 'active',
    planLifecycle: 'active',
    isWritable: true,
    day: makeDay({id: 'day-1-live'}),
    ...overrides
  })

  const makeDayInputs = (overrides: Partial<Parameters<typeof resolveMealPlanDaySection>[0]> = {}) => ({
    plan: makePlan(),
    selectedDayKey: PLAN_START_DATE,
    envelope: null,
    dayError: null,
    ...overrides
  })

  it('renders the day the route answered with', () => {
    const envelope = makeEnvelope()

    const section = resolveMealPlanDaySection(makeDayInputs({envelope}))

    expect(section).toEqual({kind: 'day', day: envelope.day, hasFailedRead: false})
  })

  it("falls back to the week's own day until the route answers, so switching days never empties the screen", () => {
    const plan = makePlan()

    const section = resolveMealPlanDaySection(makeDayInputs({plan}))

    expect(section).toEqual({kind: 'day', day: plan.days[0], hasFailedRead: false})
  })

  // The seed the day query starts from reads the very plan on screen, so a day the week does not carry is also
  // a day nothing has cached: there is genuinely nothing to render.
  it('reports loading when neither the route nor the week holds the selected day', () => {
    expect(resolveMealPlanDaySection(makeDayInputs({selectedDayKey: '2026-07-09'}))).toEqual({kind: 'loading'})
  })

  it('discloses a failed read over the day the week still holds', () => {
    const plan = makePlan()

    expect(resolveMealPlanDaySection(makeDayInputs({plan, dayError: networkError}))).toEqual({
      kind: 'day',
      day: plan.days[0],
      hasFailedRead: true
    })
    expect(resolveMealPlanDaySection(makeDayInputs({plan, dayError: undecodableError}))).toEqual({
      kind: 'day',
      day: plan.days[0],
      hasFailedRead: true
    })
  })

  it('reports the failure itself when there is no day to show', () => {
    expect(resolveMealPlanDaySection(makeDayInputs({selectedDayKey: '2026-07-09', dayError: networkError}))).toEqual({
      kind: 'error'
    })
  })

  // The day route's own 404 is the case classifying on the code string missed: `{error: 'Plan not found'}` is
  // prose, so it fell through to a retry pill that could only ask the dead resource again. Both shapes of the
  // finding are pinned — seeded content present, and nothing cached at all.
  it("leaves the day route's 404 to the plan-level recovery, with the week's day still shown", () => {
    const plan = makePlan()

    expect(resolveMealPlanDaySection(makeDayInputs({plan, dayError: resourceNotFoundError}))).toEqual({
      kind: 'day',
      day: plan.days[0],
      hasFailedRead: false
    })
  })

  it('reports loading rather than a retry when the day route 404s and nothing is cached', () => {
    expect(
      resolveMealPlanDaySection(makeDayInputs({selectedDayKey: '2026-07-09', dayError: resourceNotFoundError}))
    ).toEqual({kind: 'loading'})
  })

  // The bare 404 of a rolled-back backend is not a plan answer, so it stays an ordinary failed read and keeps
  // its retry.
  it('still discloses a routes-missing 404 as a failed read', () => {
    const plan = makePlan()

    expect(resolveMealPlanDaySection(makeDayInputs({plan, dayError: routesMissingError}))).toEqual({
      kind: 'day',
      day: plan.days[0],
      hasFailedRead: true
    })
  })

  // A replaced plan is recovered by the stale-plan toast and a current-plan refetch, so an inline retry would
  // re-request a day of a plan the server no longer holds.
  it('leaves a confirmed stale-plan answer to the plan-level recovery', () => {
    const plan = makePlan()

    expect(resolveMealPlanDaySection(makeDayInputs({plan, dayError: stalePlanError}))).toEqual({
      kind: 'day',
      day: plan.days[0],
      hasFailedRead: false
    })
    expect(
      resolveMealPlanDaySection(makeDayInputs({selectedDayKey: '2026-07-09', dayError: planNotActiveError}))
    ).toEqual({kind: 'loading'})
  })

  it('prefers the answered day over the week copy for the same date', () => {
    const envelope = makeEnvelope({day: makeDay({id: 'day-1-live', meals: []})})

    const section = resolveMealPlanDaySection(makeDayInputs({envelope}))

    expect(section.kind === 'day' && section.day.id).toBe('day-1-live')
  })
})

describe('buildMealCardModels', () => {
  it('resolves every meal of the day once, in order', () => {
    const logged = makeMeal({id: 'meal-logged', loggedEntries: [makeLoggedEntry()]})
    const unlogged = makeMeal({id: 'meal-unlogged'})

    const models = buildMealCardModels(makeDay({meals: [logged, unlogged]}))

    expect(models).toEqual([
      {meal: logged, loggedState: {kind: 'logged', entry: logged.loggedEntries[0]}},
      {meal: unlogged, loggedState: {kind: 'unlogged'}}
    ])
  })

  it('returns an empty list for a day with no meals', () => {
    expect(buildMealCardModels(makeDay({meals: []}))).toEqual([])
  })
})

describe('slotCopyFromBucketLabel', () => {
  // The producer is the diary bucket's own name, which the server backfills capitalised.
  it('lower-cases a canonical diary bucket name for the banner sentence', () => {
    expect(slotCopyFromBucketLabel(MEAL_SLOT_LABELS.breakfast)).toBe('breakfast')
    expect(slotCopyFromBucketLabel(MEAL_SLOT_LABELS.lunch)).toBe('lunch')
    expect(slotCopyFromBucketLabel(MEAL_SLOT_LABELS.dinner)).toBe('dinner')
    expect(slotCopyFromBucketLabel(MEAL_SLOT_LABELS.snack)).toBe('snack')
  })

  it('accepts a bucket name however it was cased or padded', () => {
    expect(slotCopyFromBucketLabel('  BREAKFAST ')).toBe('breakfast')
    expect(slotCopyFromBucketLabel('lunch')).toBe('lunch')
  })

  it('leaves a name the app did not choose exactly as it is', () => {
    expect(slotCopyFromBucketLabel('Pre-workout')).toBe('Pre-workout')
    expect(slotCopyFromBucketLabel('')).toBe('')
  })
})

describe('resolvePostLogBannerOrigin', () => {
  const result = makePostLogResult()
  // The swap watermark at the moment of logging: a fixed, non-zero submittedAt, so a later swap is a larger
  // number and the cache dropping this one is a smaller number.
  const SWAPPED_AT = 1_700_000_000_000

  const makeOrigin = (overrides: Partial<PostLogBannerOrigin> = {}): PostLogBannerOrigin => ({
    entryId: result.entryId,
    planId: CURRENT_PLAN_ID,
    dayKey: PLAN_START_DATE,
    lastSwapSucceededAt: SWAPPED_AT,
    ...overrides
  })

  it('captures the entry, the plan and day it was logged on, and the swap history behind it', () => {
    expect(resolvePostLogBannerOrigin(null, result, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT)).toEqual({
      entryId: result.entryId,
      planId: CURRENT_PLAN_ID,
      dayKey: PLAN_START_DATE,
      lastSwapSucceededAt: SWAPPED_AT
    })
  })

  // The banner stands on the PLAN day the tab returns to, which the entry's diary date may differ from: the
  // date stepper on frame 15 moves the entry within the plan week without moving the card it was logged from.
  it('captures the plan day the tab is on, not the diary date the entry landed on', () => {
    const steppedToThursday = makePostLogResult({dateIso: PLAN_END_DATE})

    expect(resolvePostLogBannerOrigin(null, steppedToThursday, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT)).toEqual({
      entryId: steppedToThursday.entryId,
      planId: CURRENT_PLAN_ID,
      dayKey: PLAN_START_DATE,
      lastSwapSucceededAt: SWAPPED_AT
    })
  })

  it('forgets the origin once the banner is gone', () => {
    expect(resolvePostLogBannerOrigin(makeOrigin(), null, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT)).toBe(null)
  })

  it('re-captures for a different entry, which is a second log', () => {
    const second = makePostLogResult({entryId: 'entry-b'})

    expect(
      resolvePostLogBannerOrigin(makeOrigin(), second, UPCOMING_PLAN_ID, UPCOMING_START_DATE, SWAPPED_AT + 1)
    ).toEqual({
      entryId: 'entry-b',
      planId: UPCOMING_PLAN_ID,
      dayKey: UPCOMING_START_DATE,
      lastSwapSucceededAt: SWAPPED_AT + 1
    })
  })

  // Identity is the signal a caller adjusting state during render uses to stop, so an unchanged origin must be
  // the very same object.
  it('returns the same origin when nothing has changed', () => {
    const origin = makeOrigin()

    expect(resolvePostLogBannerOrigin(origin, result, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT)).toBe(origin)
  })

  // A swap that lands after the banner must not be absorbed into its origin, or the comparison that retires
  // the banner would never see it.
  it('returns the same origin when a swap has since succeeded, leaving the watermark behind it', () => {
    const origin = makeOrigin()

    expect(resolvePostLogBannerOrigin(origin, result, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT + 5_000)).toBe(
      origin
    )
  })

  it('takes the plan and its day as soon as a plan exists, rather than freezing the absence of one', () => {
    const unbound = makeOrigin({planId: null, dayKey: null})

    expect(resolvePostLogBannerOrigin(unbound, result, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT)).toEqual({
      entryId: result.entryId,
      planId: CURRENT_PLAN_ID,
      dayKey: PLAN_START_DATE,
      lastSwapSucceededAt: SWAPPED_AT
    })
    expect(resolvePostLogBannerOrigin(unbound, result, null, PLAN_START_DATE, SWAPPED_AT)).toBe(unbound)
  })

  // Without a plan on screen the selected day is the session's own day, not a day of any plan, so binding it
  // then would attribute the banner to a day the plan does not contain.
  it('leaves the day unbound while no plan is on screen, exactly as it leaves the plan unbound', () => {
    expect(resolvePostLogBannerOrigin(null, result, null, PLAN_START_DATE, SWAPPED_AT)).toEqual({
      entryId: result.entryId,
      planId: null,
      dayKey: null,
      lastSwapSucceededAt: SWAPPED_AT
    })
  })

  it('carries the original watermark when it adopts a plan id, rather than restamping it', () => {
    const unbound = makeOrigin({planId: null, dayKey: null})

    expect(resolvePostLogBannerOrigin(unbound, result, CURRENT_PLAN_ID, PLAN_START_DATE, SWAPPED_AT + 9_000)).toEqual({
      entryId: result.entryId,
      planId: CURRENT_PLAN_ID,
      dayKey: PLAN_START_DATE,
      lastSwapSucceededAt: SWAPPED_AT
    })
  })

  it('keeps the plan and day it captured rather than following the plan on screen', () => {
    const origin = makeOrigin()

    expect(resolvePostLogBannerOrigin(origin, result, UPCOMING_PLAN_ID, UPCOMING_START_DATE, SWAPPED_AT)).toBe(origin)
  })
})

describe('isPostLogBannerVisible', () => {
  const SWAPPED_AT = 1_700_000_000_000

  const makeBannerInputs = (overrides: Partial<Parameters<typeof isPostLogBannerVisible>[0]> = {}) => ({
    result: makePostLogResult(),
    origin: {entryId: 'entry-a', planId: CURRENT_PLAN_ID, dayKey: PLAN_START_DATE, lastSwapSucceededAt: SWAPPED_AT},
    dismissedEntryId: null,
    planId: CURRENT_PLAN_ID,
    selectedDayKey: PLAN_START_DATE,
    lastSwapSucceededAt: SWAPPED_AT,
    ...overrides
  })

  it('shows the banner on the day and plan the entry was logged into', () => {
    expect(isPostLogBannerVisible(makeBannerInputs())).toBe(true)
  })

  it('hides it when there is nothing logged, or the user has read it', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({result: null}))).toBe(false)
    expect(isPostLogBannerVisible(makeBannerInputs({dismissedEntryId: 'entry-a'}))).toBe(false)
  })

  // Decided at render rather than after it: the banner stands where the totals card does, so one frame of it
  // on another day would misreport what was logged.
  it('hides it on another day of the same week', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({selectedDayKey: PLAN_END_DATE}))).toBe(false)
  })

  // The defect this comparison exists to remove: an entry logged onto another diary date of the plan week is
  // still the confirmation of the PLAN day the tab returned to (0.1.4 iii). Comparing the diary date against
  // the selected day cleared the required banner on the frame it was raised.
  it('shows it on the captured plan day even when the entry landed on another diary date', () => {
    const steppedToThursday = makeBannerInputs({result: makePostLogResult({dateIso: PLAN_END_DATE})})

    expect(isPostLogBannerVisible(steppedToThursday)).toBe(true)
    expect(isPostLogBannerVisible({...steppedToThursday, selectedDayKey: PLAN_END_DATE})).toBe(false)
  })

  it('hides it on another plan, including a replacement covering the same dates', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({planId: UPCOMING_PLAN_ID}))).toBe(false)
    expect(isPostLogBannerVisible(makeBannerInputs({planId: 'plan-regenerated'}))).toBe(false)
  })

  it('hides it while no origin has been captured, and for an origin from an earlier log', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({origin: null}))).toBe(false)
    expect(
      isPostLogBannerVisible(
        makeBannerInputs({
          origin: {
            entryId: 'entry-z',
            planId: CURRENT_PLAN_ID,
            dayKey: PLAN_START_DATE,
            lastSwapSucceededAt: SWAPPED_AT
          }
        })
      )
    ).toBe(false)
  })

  // An origin captured before any plan was on screen names no day, so there is nothing to place the banner
  // against yet; the caller keeps the payload until the plan read answers.
  it('hides it while the origin has no plan day bound', () => {
    expect(
      isPostLogBannerVisible(
        makeBannerInputs({
          origin: {entryId: 'entry-a', planId: null, dayKey: null, lastSwapSucceededAt: SWAPPED_AT},
          planId: null
        })
      )
    ).toBe(false)
  })

  // The lifecycle retires the confirmation when another swap COMPLETES: the day it described has changed.
  it('hides it once a swap has succeeded since the meal was logged', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({lastSwapSucceededAt: SWAPPED_AT + 1}))).toBe(false)
  })

  // A pending or failed swap is not a completed one. Both leave the observed watermark where it was, so the
  // confirmation the user is still reading survives an attempt that changed nothing.
  it('keeps it through a swap that is pending, failed, or lost its answer', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({lastSwapSucceededAt: SWAPPED_AT}))).toBe(true)
  })

  // Mutations are garbage-collected, so the newest success can disappear from the cache. A smaller observed
  // value must read as "no further swap", never as one.
  it('keeps it when the cache has dropped the swap it was stamped against', () => {
    expect(isPostLogBannerVisible(makeBannerInputs({lastSwapSucceededAt: 0}))).toBe(true)
    expect(isPostLogBannerVisible(makeBannerInputs({lastSwapSucceededAt: SWAPPED_AT - 5_000}))).toBe(true)
  })

  it('shows a banner logged before any swap had ever succeeded', () => {
    expect(
      isPostLogBannerVisible(
        makeBannerInputs({
          origin: {entryId: 'entry-a', planId: CURRENT_PLAN_ID, dayKey: PLAN_START_DATE, lastSwapSucceededAt: 0},
          lastSwapSucceededAt: 0
        })
      )
    ).toBe(true)
  })
})

describe('planDayWeekdayName', () => {
  it('spells the weekday out for a plan day', () => {
    expect(planDayWeekdayName(PLAN_START_DATE)).toBe('Sunday')
  })

  it('reads the day key as a local date rather than a UTC instant', () => {
    expect(planDayWeekdayName(PLAN_END_DATE)).toBe('Saturday')
  })
})

describe('resolveEmptyPlanCtaLabel', () => {
  it('offers a first plan to a user who has not started', () => {
    expect(resolveEmptyPlanCtaLabel('create')).toBe(MEAL_PLAN_CREATE_BUTTON_TEXT)
  })

  it('offers the following week to a user whose setup is finished', () => {
    expect(resolveEmptyPlanCtaLabel('planNextWeek')).toBe(MEAL_PLAN_PLAN_NEXT_WEEK_BUTTON_TEXT)
  })

  it('offers to continue an unfinished setup from either resume point', () => {
    expect(resolveEmptyPlanCtaLabel('continueSetupStep')).toBe(MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT)
    expect(resolveEmptyPlanCtaLabel('continueSetupReview')).toBe(MEAL_PLAN_CONTINUE_SETUP_BUTTON_TEXT)
  })
})

describe('formatPostLogBannerBody', () => {
  // The label is taken from the real producer — the diary bucket name the logging screen captured — rather
  // than a lowercase string the sentence would already fit.
  const breakfastBucket = makePostLogResult().slotLabel
  const lunchBucket = MEAL_SLOT_LABELS.lunch

  it('names only the slot for a meal logged on today', () => {
    expect(formatPostLogBannerBody(PLAN_START_DATE, breakfastBucket, PLAN_START_DATE)).toBe('Added to breakfast')
  })

  it('names the weekday as well when the entry sits on another day', () => {
    expect(formatPostLogBannerBody(PLAN_END_DATE, lunchBucket, PLAN_START_DATE)).toBe("Added to Saturday's lunch")
  })

  it('reads the capitalised bucket name as the lowercase slot copy the sentence uses', () => {
    expect(breakfastBucket).toBe('Breakfast')
    expect(formatPostLogBannerBody(PLAN_START_DATE, breakfastBucket, PLAN_START_DATE)).not.toContain('Breakfast')
  })

  it('leaves a bucket name the app did not choose exactly as it is', () => {
    expect(formatPostLogBannerBody(PLAN_START_DATE, 'Pre-workout', PLAN_START_DATE)).toBe('Added to Pre-workout')
  })
})

describe('isKeyedWriteHeldByAnotherMeal', () => {
  const held = (planId: string, mealId: string) => ({planId, mealId, key: `key-${planId}-${mealId}`})

  it('holds nothing back when no record is unresolved', () => {
    expect(isKeyedWriteHeldByAnotherMeal([null, null], 'plan-1', 'meal-1')).toBe(false)
  })

  // The exemption the AAP requires: the unconfirmed outcome of a swap or a log is drawn on that meal's own
  // screen, and "Try again" there replays the very key (0.2.5). Closing that screen would leave the write
  // unresolvable until a new process.
  it('lets the meal a record names keep its own controls', () => {
    expect(isKeyedWriteHeldByAnotherMeal([held('plan-1', 'meal-1'), null], 'plan-1', 'meal-1')).toBe(false)
    expect(isKeyedWriteHeldByAnotherMeal([null, held('plan-1', 'meal-1')], 'plan-1', 'meal-1')).toBe(false)
  })

  it('withholds the controls of every other meal in the week', () => {
    expect(isKeyedWriteHeldByAnotherMeal([held('plan-1', 'meal-other'), null], 'plan-1', 'meal-1')).toBe(true)
  })

  // The key names a plan as well as a meal, so a record from another week is another meal's record.
  it('withholds them when the record belongs to another plan, even at the same meal id', () => {
    expect(isKeyedWriteHeldByAnotherMeal([held('plan-other', 'meal-1'), null], 'plan-1', 'meal-1')).toBe(true)
  })

  // One unresolved record is enough, whichever action holds it: a swap on this meal does not license a log on
  // a different one.
  it('withholds them when either action holds a record for a different meal', () => {
    expect(
      isKeyedWriteHeldByAnotherMeal([held('plan-1', 'meal-1'), held('plan-1', 'meal-other')], 'plan-1', 'meal-1')
    ).toBe(true)
  })
})
