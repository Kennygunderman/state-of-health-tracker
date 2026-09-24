import {CurrentMealPlans, MealPlan} from '@data/models/MealPlan'
import {Diet, MealPlanPreferences, MealSchedule, SetupStep} from '@data/models/MealPlanPreferences'
import {NutritionTargets} from '@data/models/NutritionTargets'
import {LimitingConstraint, LimitingConstraintKey, LimitingConstraintUnit} from '@data/models/PlanGenerationResult'
import {GenerationContext} from '@navigation/types'
import {buildPendingIntent, MealPlanStore, PENDING_INTENT_TTL_MS, PendingIntent} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {ONE_DAY_MS} from '@utility/DateUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'

import {StatusBadgeVariant} from '@components/StatusBadgeCircle'

import Screens from '@constants/screens'
import {
  MEAL_PLAN_ALLERGEN_LABELS,
  MEAL_PLAN_ALLERGIES_ROW_LABEL,
  MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT,
  MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE,
  MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR,
  MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES,
  MEAL_PLAN_COOKING_TIME_MAX_TEMPLATE,
  MEAL_PLAN_DIET_LABELS,
  MEAL_PLAN_DIET_ROW_LABEL,
  MEAL_PLAN_EDIT_LINK_TEXT,
  MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT,
  MEAL_PLAN_GENERATING_BODY,
  MEAL_PLAN_GENERATING_COOKING_TIME_LABEL,
  MEAL_PLAN_GENERATING_MEALS_PER_DAY_LABEL,
  MEAL_PLAN_GENERATING_SUMMARY_HEADER,
  MEAL_PLAN_GENERATING_TITLE,
  MEAL_PLAN_GENERATION_FAILED_BODY,
  MEAL_PLAN_GENERATION_FAILED_TITLE,
  MEAL_PLAN_GENERATION_TERMINAL_COPY,
  MEAL_PLAN_GENERATION_TERMINAL_FALLBACK_COPY,
  MEAL_PLAN_LIMITING_CONSTRAINT_LABELS,
  MEAL_PLAN_LOAD_ERROR_TITLE,
  MEAL_PLAN_MEALS_PER_DAY_VALUES,
  MEAL_PLAN_NO_MATCH_BODY,
  MEAL_PLAN_NO_MATCH_TITLE,
  MEAL_PLAN_SAVED_ANSWERS_HEADER,
  MEAL_PLAN_SELECTED_VALUE_TEMPLATE,
  MEAL_PLAN_STALE_PLAN_TOAST,
  MEAL_PLAN_TARGETS_KCAL_TEMPLATE,
  MEAL_PLAN_TARGETS_ROW_LABEL,
  MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
  MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_SLOT_LABELS,
  PLAN_SETTINGS_NOT_SET_VALUE,
  stringWithNamedParameters,
  TOAST_GENERIC_ERROR
} from '@constants/strings'

import {
  buildGenerationRequest,
  buildLimitingConstraintRows,
  extractLimitingConstraints,
  GenerationLaunchDecision,
  GenerationLaunchInput,
  GenerationRequestSnapshot,
  GenerationRequestStatus,
  GenerationViewKind,
  LimitingConstraintRow,
  resolveActionRoute,
  resolveConstraintEditRoute,
  resolveConstraintReturnTo,
  resolveGenerationLaunch,
  resolveGenerationSummary,
  resolveGenerationView,
  resolveIntentRefusal,
  resolveSettledGenerationPlanId,
  resolveTerminalRecovery,
  resolveUpcomingPlanId
} from '../index.util'

// `index.util` reaches the store module for the shared keyed-request rule, which pulls the persist adapter's
// AsyncStorage import in with it. Mocking the adapter — as `useMealPlanStore.test.ts` and the log screen's
// suite do — keeps this suite free of native modules; none of these decisions reads or writes persisted state.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

// The seven refusals that carry copy of their own, in the order the constant declares them. Declared here
// rather than imported so the suite pins the intended membership instead of restating the module's.
const TERMINAL_COPY_OWNER_CODES: readonly string[] = [
  API_ERROR_CODES.staleRevision,
  API_ERROR_CODES.planOverlap,
  API_ERROR_CODES.upcomingExists,
  API_ERROR_CODES.preferencesIncomplete,
  API_ERROR_CODES.targetsMissing,
  API_ERROR_CODES.targetsUnconfirmed,
  API_ERROR_CODES.idempotencyConflict
]

// The six of them that state their next move on a card the user reads and leaves through the footer.
const TERMINAL_CARD_CODES: readonly string[] = TERMINAL_COPY_OWNER_CODES.filter(
  code => code !== API_ERROR_CODES.upcomingExists
)

// The refusals whose recovery leaves the screen rather than drawing a card: the plan has moved on, the
// capability is off and the Macros tab says so, or the week asked for is a week the user already has.
const PLAN_STATE_TERMINAL_CODES: readonly string[] = [API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive]

const UNAVAILABLE_TERMINAL_CODES: readonly string[] = [API_ERROR_CODES.featureDisabled]

// The one family that owns copy AND leaves: its title is said once as a toast on the way to the plan it is
// about, rather than drawn on a card whose only move led back to the screen that earns the same refusal.
const UPCOMING_PLAN_TERMINAL_CODES: readonly string[] = [API_ERROR_CODES.upcomingExists]

const LEAVING_TERMINAL_CODES: readonly string[] = [
  ...PLAN_STATE_TERMINAL_CODES,
  ...UNAVAILABLE_TERMINAL_CODES,
  ...UPCOMING_PLAN_TERMINAL_CODES
]

// Confirmed refusals this release ships no copy for: a validation error the parser produced, and whatever a
// later server release introduces. They are terminal all the same — that is the point of stating retryability
// positively rather than listing terminal codes.
const GENERIC_TERMINAL_CODES: readonly string[] = [
  API_ERROR_CODES.invalidRequest,
  API_ERROR_CODES.invalidPayload,
  'some_future_refusal'
]

// The two confirmed answers a same-key retry or an in-place edit can still resolve, and the only non-terminal
// ones.
const RETRYABLE_CODES: readonly string[] = [API_ERROR_CODES.planGenerationFailed, API_ERROR_CODES.noMatchingMeals]

const TERMINAL_CODES: readonly string[] = [...TERMINAL_CARD_CODES, ...LEAVING_TERMINAL_CODES, ...GENERIC_TERMINAL_CODES]

const VIEW_KINDS: readonly GenerationViewKind[] = ['pending', 'failed', 'noMatch', 'unconfirmed', 'terminal']

const NON_ERROR_STATUSES: readonly GenerationRequestStatus[] = ['idle', 'pending', 'success']

const SETUP_STEPS: readonly SetupStep[] = [
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

// Every inherited Object.prototype member reachable by name. Each one answers a plain record[key] read with a
// function (or an object for '__proto__'), which is what F14's guards exist to stop.
const PROTOTYPE_KEYS: readonly string[] = ['constructor', 'toString', '__proto__', 'hasOwnProperty']

const SETUP: GenerationContext = {kind: 'setup'}

const NEXT_WEEK: GenerationContext = {kind: 'nextWeek', startDate: '2026-07-13'}

const REGENERATE: GenerationContext = {kind: 'regenerate', planId: 'plan-7c9f', planRevision: 3}

const TARGET_CALORIES = 1940

const COOKING_TIME_LIMIT_MIN = 30

const apiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const constraintPayload = (limitingConstraints: unknown): unknown => ({
  response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals, limitingConstraints}}
})

const preferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
  setupStatus: 'completed',
  setupStep: 'review',
  reviewStartDate: '2026-07-06',
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 7,
  goal: 'lose',
  goalWeightKg: 78,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 178,
  weightKg: 84,
  sexForEstimate: 'male',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'active',
  diet: 'none',
  allergens: ['none'],
  dislikedFoods: [],
  dislikedFoodGroups: [],
  mealSchedule: 'three',
  mealTimes: [],
  cookingTimeLimitMin: COOKING_TIME_LIMIT_MIN,
  budget: null,
  noBudgetPreference: true,
  budgetTier: null,
  hasActivePlan: false,
  ...overrides
})

const nutritionTargets = (calories: number | null): NutritionTargets => ({
  targets: {calories, protein: 150, carbs: 195, fat: 62},
  complete: calories !== null,
  source: 'estimated',
  stale: false,
  revision: 4
})

const constraint = (overrides: Partial<LimitingConstraint> = {}): LimitingConstraint => ({
  constraintKey: 'cooking_time',
  value: COOKING_TIME_LIMIT_MIN,
  unit: 'minutes',
  slots: [],
  editStep: 'cooking',
  ...overrides
})

const CURRENT_PLAN_ID = 'plan-current'

const UPCOMING_PLAN_ID = 'plan-upcoming'

// The generation key is attached structurally rather than declared in the literal below, and it is the one
// member these factories treat that way: AAP 0.5.2's `MealPlanResponse` never promised it, so these cases —
// and the settlement rule they exercise — have to hold whether the model declares it required, nullable, or
// not at all. `undefined` removes the member, which is the "no key on the plan" case.
const withGenerationKey = (
  plan: Omit<MealPlan, 'generationKey'>,
  generationKey: string | null | undefined
): MealPlan => {
  const bearer: Record<string, unknown> = {...plan}

  if (generationKey === undefined) {
    delete bearer.generationKey
  } else {
    bearer.generationKey = generationKey
  }

  return bearer as unknown as MealPlan
}

const makePlan = (overrides: Partial<Omit<MealPlan, 'generationKey'>> = {}): MealPlan =>
  withGenerationKey(
    {
      id: CURRENT_PLAN_ID,
      revision: 1,
      generationAttempt: 1,
      startDate: '2026-07-05',
      endDate: '2026-07-11',
      status: 'active',
      targets: {calories: TARGET_CALORIES, protein: 146, carbs: 194, fat: 65},
      generationTargets: {calories: TARGET_CALORIES, protein: 146, carbs: 194, fat: 65},
      targetsStale: false,
      preferencesRevision: 7,
      targetsRevision: 4,
      hasIncompatibilities: false,
      summary: {plannedMeals: 21, groceryItemCount: 14, loggedEntryCount: 0},
      days: [],
      ...overrides
    },
    'gen-key-current'
  )

const makeUpcomingPlan = (overrides: Partial<Omit<MealPlan, 'generationKey'>> = {}): MealPlan =>
  withGenerationKey(
    makePlan({id: UPCOMING_PLAN_ID, startDate: '2026-07-12', endDate: '2026-07-18', ...overrides}),
    'gen-key-upcoming'
  )

const makePlans = (current: MealPlan | null, upcoming: MealPlan | null): CurrentMealPlans => ({current, upcoming})

const kcalValue = (calories: number): string =>
  stringWithNamedParameters(MEAL_PLAN_TARGETS_KCAL_TEMPLATE, {calories: formatCalories(calories)})

// The smallest error that lands the router on each kind, so a chrome table can be read across all five.
const errorForKind = (kind: GenerationViewKind): unknown => {
  if (kind === 'noMatch') {
    return apiError(422, API_ERROR_CODES.noMatchingMeals)
  }

  if (kind === 'failed') {
    return apiError(502, API_ERROR_CODES.planGenerationFailed)
  }

  if (kind === 'terminal') {
    return apiError(409, API_ERROR_CODES.staleRevision)
  }

  return apiError(502)
}

describe('resolveGenerationView', () => {
  describe('while the request is still running (10)', () => {
    it('renders the spinner state for every status that is not an error', () => {
      expect(NON_ERROR_STATUSES.map(status => resolveGenerationView(status, null, SETUP).kind)).toEqual([
        'pending',
        'pending',
        'pending'
      ])
    })

    it('describes the pending state from the generating copy constants', () => {
      expect(resolveGenerationView('pending', null, SETUP)).toEqual({
        kind: 'pending',
        isCentered: true,
        showSpinner: true,
        badgeVariant: null,
        headline: MEAL_PLAN_GENERATING_TITLE,
        headlineSize: 'default',
        body: MEAL_PLAN_GENERATING_BODY,
        showAllergiesBanner: false,
        showUnavailableNotice: false,
        actions: null,
        terminalCode: null
      })
    })

    it('ignores a stale error while the status says the request has not failed', () => {
      const view = resolveGenerationView('pending', apiError(409, API_ERROR_CODES.stalePlan), SETUP)

      expect(view.kind).toBe('pending')
      expect(view.terminalCode).toBeNull()
    })
  })

  describe('an outcome the server never confirmed', () => {
    it('treats a request that produced no response as unconfirmed', () => {
      expect(resolveGenerationView('error', new Error('Network Error'), SETUP).kind).toBe('unconfirmed')
    })

    it('treats a gateway 502 carrying no code as unconfirmed', () => {
      expect(resolveGenerationView('error', apiError(502), SETUP).kind).toBe('unconfirmed')
    })

    it('treats a 500 whose code this release does not recognise as unconfirmed', () => {
      expect(resolveGenerationView('error', apiError(500, 'handler_exploded'), SETUP).kind).toBe('unconfirmed')
    })

    it('treats a body that does not decode to an error string as unconfirmed', () => {
      expect(resolveGenerationView('error', {response: {status: 502, data: '<html>gateway</html>'}}, SETUP).kind).toBe(
        'unconfirmed'
      )
    })

    it('treats a 4xx whose error field is not a string as unconfirmed', () => {
      expect(resolveGenerationView('error', {response: {status: 409, data: {error: 42}}}, SETUP).kind).toBe(
        'unconfirmed'
      )
    })

    it('renders the unconfirmed variant in the centred 10b layout with the neutral badge', () => {
      expect(resolveGenerationView('error', apiError(502), SETUP)).toEqual({
        kind: 'unconfirmed',
        isCentered: true,
        showSpinner: false,
        badgeVariant: 'unconfirmed',
        headline: MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
        headlineSize: 'default',
        body: MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
        showAllergiesBanner: false,
        showUnavailableNotice: false,
        actions: {
          primary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT},
          secondary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
        },
        terminalCode: null
      })
    })
  })

  describe('nothing matched the preferences (10c)', () => {
    it('renders the no-match state with the alternate headline and the allergies banner', () => {
      expect(resolveGenerationView('error', apiError(422, API_ERROR_CODES.noMatchingMeals), SETUP)).toEqual({
        kind: 'noMatch',
        isCentered: false,
        showSpinner: false,
        badgeVariant: 'noMatch',
        headline: MEAL_PLAN_NO_MATCH_TITLE,
        headlineSize: 'alternate',
        body: MEAL_PLAN_NO_MATCH_BODY,
        showAllergiesBanner: true,
        showUnavailableNotice: false,
        actions: {
          primary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT},
          secondary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        },
        terminalCode: null
      })
    })
  })

  describe('a confirmed failure (10b)', () => {
    it('renders the failure state for the recognised generation-failed code', () => {
      expect(resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), SETUP)).toEqual({
        kind: 'failed',
        isCentered: true,
        showSpinner: false,
        badgeVariant: 'failure',
        headline: MEAL_PLAN_GENERATION_FAILED_TITLE,
        headlineSize: 'default',
        body: MEAL_PLAN_GENERATION_FAILED_BODY,
        showAllergiesBanner: false,
        showUnavailableNotice: false,
        actions: {
          primary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT},
          secondary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
        },
        terminalCode: null
      })
    })

    it('reserves the failure state for that one code, and never reaches it by falling through', () => {
      const kinds = [
        resolveGenerationView('error', apiError(409, 'some_future_refusal'), SETUP).kind,
        resolveGenerationView('error', apiError(400, API_ERROR_CODES.invalidRequest), SETUP).kind,
        resolveGenerationView('error', apiError(503, API_ERROR_CODES.featureDisabled), SETUP).kind
      ]

      expect(kinds).toEqual(['terminal', 'terminal', 'terminal'])
    })
  })

  describe('a terminal refusal a same-key retry can never resolve', () => {
    TERMINAL_CODES.forEach(code => {
      it(`classifies ${code} as terminal and carries the code through`, () => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(view.kind).toBe('terminal')
        expect(view.terminalCode).toBe(code)
      })
    })

    it('offers no badge and no spinner for a terminal outcome', () => {
      const view = resolveGenerationView('error', apiError(409, API_ERROR_CODES.staleRevision), SETUP)

      expect(view.badgeVariant).toBeNull()
      expect(view.showSpinner).toBe(false)
    })

    // This screen draws no back button and the tab bar is hidden on it, so a card with no footer would be a
    // dead end. Retry is absent because the key has been retired: the same request would earn the same answer.
    it('offers the edit as the only way off a terminal card during setup', () => {
      TERMINAL_CARD_CODES.concat(GENERIC_TERMINAL_CODES).forEach(code => {
        expect(resolveGenerationView('error', apiError(409, code), SETUP).actions).toEqual({
          primary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT},
          secondary: null
        })
      })
    })

    it('adds the way back to the retained plan when a regeneration is refused', () => {
      TERMINAL_CARD_CODES.concat(GENERIC_TERMINAL_CODES).forEach(code => {
        expect(resolveGenerationView('error', apiError(409, code), REGENERATE).actions).toEqual({
          primary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT},
          secondary: {kind: 'backToPlan', label: MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT}
        })
      })
    })

    it('offers no footer for a refusal whose recovery leaves the screen at once', () => {
      LEAVING_TERMINAL_CODES.forEach(code => {
        expect(resolveGenerationView('error', apiError(409, code), SETUP).actions).toBeNull()
      })
    })

    it('falls back to the shared terminal copy for a refusal it has no wording for', () => {
      GENERIC_TERMINAL_CODES.forEach(code => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(view.headline).toBe(MEAL_PLAN_GENERATION_TERMINAL_FALLBACK_COPY.title)
        expect(view.body).toBe(MEAL_PLAN_GENERATION_TERMINAL_FALLBACK_COPY.body)
        expect(view.terminalCode).toBe(code)
      })
    })

    TERMINAL_CARD_CODES.forEach(code => {
      it(`reads the card copy of ${code} from the terminal copy constants`, () => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(view.headline).toBe(MEAL_PLAN_GENERATION_TERMINAL_COPY[code].title)
        expect(view.body).toBe(MEAL_PLAN_GENERATION_TERMINAL_COPY[code].body)
        expect(view.headline.length).toBeGreaterThan(0)
        expect(view.body.length).toBeGreaterThan(0)
      })
    })

    LEAVING_TERMINAL_CODES.forEach(code => {
      it(`leaves ${code} without card copy, because its recovery leaves the screen immediately`, () => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(view.headline).toBe('')
        expect(view.body).toBe('')
      })
    })

    // The three card-less families all render no badge, no copy and no footer, but two of them speak on their
    // way out: a plan-state refusal toasts, and the upcoming refusal toasts its own card title. The
    // capability refusal carries no toast, so it is the one family that would paint an entirely blank frame
    // until the navigator moved — which is the deploy-before-enable window AAP 0.7.5 prescribes. It states
    // the refusal instead, in the neutral banner every other gated surface uses (0.2.5).
    it('states the refusal on the one card-less family that would otherwise render nothing', () => {
      UNAVAILABLE_TERMINAL_CODES.forEach(code => {
        const view = resolveGenerationView('error', apiError(503, code), SETUP)

        expect(view.showUnavailableNotice).toBe(true)
        expect(view.headline).toBe('')
        expect(view.body).toBe('')
        expect(view.badgeVariant).toBeNull()
        expect(view.showSpinner).toBe(false)
        expect(view.actions).toBeNull()
      })
    })

    it('leaves every other terminal refusal to its own card or toast', () => {
      const others = TERMINAL_CODES.filter(code => !UNAVAILABLE_TERMINAL_CODES.includes(code))
      const notices = others.map(
        code => resolveGenerationView('error', apiError(409, code), SETUP).showUnavailableNotice
      )

      expect(others.length).toBeGreaterThan(0)
      expect(notices).toEqual(others.map(() => false))
    })

    it('states the refusal whichever launch earned it, because the flag is the server answer', () => {
      const contexts: readonly GenerationContext[] = [SETUP, NEXT_WEEK, REGENERATE]
      const notices = contexts.map(
        context =>
          resolveGenerationView('error', apiError(503, API_ERROR_CODES.featureDisabled), context).showUnavailableNotice
      )

      expect(notices).toEqual([true, true, true])
    })
  })

  describe('the chrome each state selects', () => {
    it('centres the pending, confirmed-failure and unconfirmed states and only those', () => {
      const centring = VIEW_KINDS.map(kind => {
        const error = kind === 'pending' ? null : errorForKind(kind)

        return [kind, resolveGenerationView(kind === 'pending' ? 'pending' : 'error', error, SETUP).isCentered]
      })

      expect(centring).toEqual([
        ['pending', true],
        ['failed', true],
        ['noMatch', false],
        ['unconfirmed', true],
        ['terminal', false]
      ])
    })

    it('keeps the confirmed-failure badge distinct from the unconfirmed one, which cannot claim a write landed', () => {
      const failed = resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), SETUP)
      const unconfirmed = resolveGenerationView('error', apiError(502), SETUP)

      expect(failed.badgeVariant).toBe('failure')
      expect(unconfirmed.badgeVariant).toBe('unconfirmed')
      expect(failed.badgeVariant).not.toBe(unconfirmed.badgeVariant)
    })

    // Disc fill and glyph ink co-vary as one semantic pair in StatusBadgeCircle, so borrowing either drawn
    // neutral-or-error badge would have this state assert something it was never told: 'failure' a confirmed
    // failure, 'noMatch' a search that returned too little. It asserts nothing, so it owns its own variant.
    it('borrows neither drawn badge for the outcome it could not confirm', () => {
      const unconfirmed = resolveGenerationView('error', apiError(502), SETUP)
      const noMatch = resolveGenerationView('error', apiError(422, API_ERROR_CODES.noMatchingMeals), SETUP)

      expect(unconfirmed.badgeVariant).not.toBe(noMatch.badgeVariant)
      expect(unconfirmed.badgeVariant).not.toBe('failure')
      expect(unconfirmed.badgeVariant).toBe('unconfirmed')
    })

    it('gives every state the badge its own variant names, and only the drawn failure the failure disc', () => {
      const expected: Record<GenerationViewKind, StatusBadgeVariant | null> = {
        pending: null,
        failed: 'failure',
        noMatch: 'noMatch',
        unconfirmed: 'unconfirmed',
        terminal: null
      }
      const resolved = VIEW_KINDS.map(
        kind => resolveGenerationView(kind === 'pending' ? 'pending' : 'error', errorForKind(kind), SETUP).badgeVariant
      )

      expect(resolved).toEqual(VIEW_KINDS.map(kind => expected[kind]))
      expect(resolved.filter(variant => variant === 'failure')).toHaveLength(1)
    })

    it('gives the alternate headline size and the allergies banner to the no-match state alone', () => {
      const alternates = VIEW_KINDS.map(kind => {
        const view = resolveGenerationView(kind === 'pending' ? 'pending' : 'error', errorForKind(kind), SETUP)

        return [kind, view.headlineSize, view.showAllergiesBanner]
      })

      expect(alternates).toEqual([
        ['pending', 'default', false],
        ['failed', 'default', false],
        ['noMatch', 'alternate', true],
        ['unconfirmed', 'default', false],
        ['terminal', 'default', false]
      ])
    })

    it('shows the spinner in the pending state alone', () => {
      const spinners = VIEW_KINDS.map(
        kind => resolveGenerationView(kind === 'pending' ? 'pending' : 'error', errorForKind(kind), SETUP).showSpinner
      )

      expect(spinners).toEqual([true, false, false, false, false])
    })

    // The notice answers a code rather than a kind, so no state earns it by its kind — including 'terminal',
    // which errorForKind reaches through a refusal that draws its own card.
    it('shows the unavailable notice for no state reached by its kind alone', () => {
      const notices = VIEW_KINDS.map(
        kind =>
          resolveGenerationView(kind === 'pending' ? 'pending' : 'error', errorForKind(kind), SETUP)
            .showUnavailableNotice
      )

      expect(notices).toEqual([false, false, false, false, false])
    })
  })

  describe('the footer actions each state offers', () => {
    it('leads with retry and offers an edit for a failure reached from setup', () => {
      expect(
        resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), SETUP).actions
      ).toEqual({
        primary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT},
        secondary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
      })
    })

    it('leads with retry and offers an edit for a failure reached from the next-week flow', () => {
      const view = resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), NEXT_WEEK)

      expect(view.actions?.primary.kind).toBe('retry')
      expect(view.actions?.secondary?.kind).toBe('editPreferences')
    })

    it('returns to the existing plan instead of setup when a regeneration fails', () => {
      expect(
        resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), REGENERATE).actions
      ).toEqual({
        primary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT},
        secondary: {kind: 'backToPlan', label: MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT}
      })
    })

    it('keeps the unconfirmed variant on the same pairing as the confirmed failure', () => {
      const unconfirmed = resolveGenerationView('error', apiError(502), REGENERATE)
      const failed = resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), REGENERATE)

      expect(unconfirmed.actions).toEqual(failed.actions)
    })

    it('inverts the pairing when nothing matched, so editing is the primary move', () => {
      expect(resolveGenerationView('error', apiError(422, API_ERROR_CODES.noMatchingMeals), NEXT_WEEK).actions).toEqual(
        {
          primary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT},
          secondary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT}
        }
      )
    })

    it('keeps the inverted no-match primary while returning a regeneration to its plan', () => {
      expect(
        resolveGenerationView('error', apiError(422, API_ERROR_CODES.noMatchingMeals), REGENERATE).actions
      ).toEqual({
        primary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT},
        secondary: {kind: 'backToPlan', label: MEAL_PLAN_BACK_TO_PLAN_BUTTON_TEXT}
      })
    })

    it('offers the two drawn failures opposite orders, never the same one', () => {
      const failed = resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), SETUP)
      const noMatch = resolveGenerationView('error', apiError(422, API_ERROR_CODES.noMatchingMeals), SETUP)
      const order = (view: ReturnType<typeof resolveGenerationView>): string[] => [
        view.actions?.primary.kind ?? '',
        view.actions?.secondary?.kind ?? ''
      ]

      expect(order(failed)).toEqual(['retry', 'editPreferences'])
      expect(order(noMatch)).toEqual(['editPreferences', 'retry'])
      expect(order(noMatch)).toEqual([...order(failed)].reverse())
      expect(noMatch.actions).not.toEqual(failed.actions)
    })

    it('offers nothing while the request is running or after a terminal refusal', () => {
      const pendingActions = resolveGenerationView('pending', null, REGENERATE).actions
      const terminalActions = resolveGenerationView(
        'error',
        apiError(409, API_ERROR_CODES.planNotActive),
        REGENERATE
      ).actions

      expect(pendingActions).toBeNull()
      expect(terminalActions).toBeNull()
    })
  })
})

describe('resolveTerminalRecovery', () => {
  it('has no recovery to describe when no terminal code was observed', () => {
    expect(resolveTerminalRecovery(null, SETUP)).toBeNull()
  })

  it('has no recovery for the no-match outcome, which stays on the screen', () => {
    expect(resolveTerminalRecovery(API_ERROR_CODES.noMatchingMeals, SETUP)).toBeNull()
  })

  it('has no recovery for a confirmed generation failure, which offers a retry instead', () => {
    expect(resolveTerminalRecovery(API_ERROR_CODES.planGenerationFailed, SETUP)).toBeNull()
  })

  it('retires the key for a confirmed refusal this release has never seen, rather than replaying it forever', () => {
    GENERIC_TERMINAL_CODES.forEach(code => {
      expect(resolveTerminalRecovery(code, REGENERATE)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: false,
        selectsUpcomingPlan: false,
        toast: null,
        route: null
      })
    })
  })

  it('leaves for the plan tab and refetches when meal planning itself is off', () => {
    UNAVAILABLE_TERMINAL_CODES.forEach(code => {
      ;[SETUP, NEXT_WEEK, REGENERATE].forEach(context => {
        expect(resolveTerminalRecovery(code, context)).toEqual({
          clearsPendingIntent: true,
          refetchesCurrentPlan: true,
          selectsUpcomingPlan: false,
          toast: null,
          route: Screens.MACROS
        })
      })
    })
  })

  PLAN_STATE_TERMINAL_CODES.forEach(code => {
    it(`clears the intent, refetches the plan and toasts on ${code} during setup`, () => {
      expect(resolveTerminalRecovery(code, SETUP)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: true,
        selectsUpcomingPlan: false,
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        route: Screens.MEAL_PLAN_TARGETS
      })
    })

    it(`sends a regeneration back to the plan tab on ${code}`, () => {
      expect(resolveTerminalRecovery(code, REGENERATE)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: true,
        selectsUpcomingPlan: false,
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        route: Screens.MACROS
      })
    })

    it(`sends the next-week flow to review on ${code}`, () => {
      expect(resolveTerminalRecovery(code, NEXT_WEEK)?.route).toBe(Screens.MEAL_PLAN_TARGETS)
    })
  })

  TERMINAL_CARD_CODES.forEach(code => {
    it(`resolves the intent for ${code} without a toast or a route, because the card carries the next move`, () => {
      expect(resolveTerminalRecovery(code, SETUP)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: false,
        selectsUpcomingPlan: false,
        toast: null,
        route: null
      })
    })
  })

  UPCOMING_PLAN_TERMINAL_CODES.forEach(code => {
    // AAP 0.7.4: an upcoming plan that already exists is OPENED. The generic card's only move was
    // "Edit preferences", which pops back to Review — the one screen from which every further Generate earns
    // this very refusal again.
    it(`opens the plan the user already has on ${code}, in every context`, () => {
      ;[SETUP, NEXT_WEEK, REGENERATE].forEach(context => {
        expect(resolveTerminalRecovery(code, context)).toEqual({
          clearsPendingIntent: true,
          refetchesCurrentPlan: true,
          selectsUpcomingPlan: true,
          toast: MEAL_PLAN_GENERATION_TERMINAL_COPY[code].title,
          route: Screens.MACROS
        })
      })
    })

    it(`never returns ${code} to the screen that would earn the same refusal`, () => {
      ;[SETUP, NEXT_WEEK, REGENERATE].forEach(context => {
        expect(resolveTerminalRecovery(code, context)?.route).not.toBe(Screens.MEAL_PLAN_TARGETS)
      })
    })

    // The selection is named by the refetch's answer, so the flag without the read would select nothing.
    it(`reads the plan list before selecting from it on ${code}`, () => {
      const recovery = resolveTerminalRecovery(code, SETUP)

      expect(recovery?.selectsUpcomingPlan).toBe(true)
      expect(recovery?.refetchesCurrentPlan).toBe(true)
    })

    it(`draws neither copy nor a footer for ${code}, because its recovery navigates away`, () => {
      const view = resolveGenerationView('error', apiError(409, code), SETUP)

      expect(view.headline).toBe('')
      expect(view.body).toBe('')
      expect(view.actions).toBeNull()
    })

    it(`says the refusal once, through the copy the code already owns on ${code}`, () => {
      expect(resolveTerminalRecovery(code, SETUP)?.toast).toBe(MEAL_PLAN_GENERATION_TERMINAL_COPY[code].title)
    })
  })

  describe('the invariant the two terminal families hold', () => {
    // Every terminal outcome is one of exactly two things, whether or not this release knows its code: a card
    // the user reads and leaves through the footer, or a destination it goes to at once. Neither is allowed to
    // be both, and none may be neither — which is what a blank card with no footer would be.
    it('gives every terminal code either a readable card with a way off it, or a destination', () => {
      const classified = TERMINAL_CODES.map(code => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)
        const recovery = resolveTerminalRecovery(code, SETUP)

        return {
          code,
          drawsCard: view.headline.length > 0 && view.body.length > 0 && view.actions !== null,
          leaves: recovery?.route !== null && recovery?.route !== undefined
        }
      })

      expect(classified).toHaveLength(TERMINAL_CARD_CODES.length + LEAVING_TERMINAL_CODES.length + 3)
      expect(classified.filter(entry => entry.drawsCard === entry.leaves)).toEqual([])
    })

    it('selects a plan on the one family whose refusal already has one, and on no other', () => {
      const selecting = TERMINAL_CODES.filter(
        code => resolveTerminalRecovery(code, SETUP)?.selectsUpcomingPlan === true
      )

      expect(selecting).toEqual([...UPCOMING_PLAN_TERMINAL_CODES])
    })

    it('retires the key for every terminal code, in every context', () => {
      const clears = TERMINAL_CODES.flatMap(code =>
        [SETUP, NEXT_WEEK, REGENERATE].map(context => resolveTerminalRecovery(code, context)?.clearsPendingIntent)
      )

      expect(clears).toHaveLength(TERMINAL_CODES.length * 3)
      expect(clears.every(clearsPendingIntent => clearsPendingIntent === true)).toBe(true)
    })

    it('keeps the key for the two codes whose own state can still resolve them', () => {
      RETRYABLE_CODES.forEach(code => {
        expect(resolveTerminalRecovery(code, SETUP)).toBeNull()
        expect(resolveGenerationView('error', apiError(422, code), SETUP).terminalCode).toBeNull()
      })
    })

    it('classifies every code that owns terminal card copy as terminal', () => {
      const copyCodes = Object.keys(MEAL_PLAN_GENERATION_TERMINAL_COPY)
      const kinds = copyCodes.map(code => resolveGenerationView('error', apiError(409, code), SETUP).kind)

      expect(copyCodes).toEqual(TERMINAL_COPY_OWNER_CODES)
      expect(kinds).toEqual(copyCodes.map(() => 'terminal'))
    })

    it('holds no copy at all for the two refusals that leave with nothing to say', () => {
      const copied = PLAN_STATE_TERMINAL_CODES.concat(UNAVAILABLE_TERMINAL_CODES).filter(code =>
        Object.prototype.hasOwnProperty.call(MEAL_PLAN_GENERATION_TERMINAL_COPY, code)
      )

      expect(copied).toEqual([])
    })

    // The one family that owns copy and still leaves. Its wording reaches the user as the toast the recovery
    // names, never as a card — which is what keeps a card from competing with the plan being opened.
    it('spends the upcoming-plan copy on the toast rather than on a card', () => {
      UPCOMING_PLAN_TERMINAL_CODES.forEach(code => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(Object.prototype.hasOwnProperty.call(MEAL_PLAN_GENERATION_TERMINAL_COPY, code)).toBe(true)
        expect(resolveTerminalRecovery(code, SETUP)?.toast).toBe(MEAL_PLAN_GENERATION_TERMINAL_COPY[code].title)
        expect(view.headline).toBe('')
      })
    })
  })
})

describe('resolveGenerationSummary', () => {
  describe('while the plan is being built', () => {
    it('recaps the preferences the request was built from', () => {
      expect(resolveGenerationSummary('pending', preferences(), null)).toEqual({
        overline: MEAL_PLAN_GENERATING_SUMMARY_HEADER,
        rows: [
          {label: MEAL_PLAN_DIET_ROW_LABEL, value: MEAL_PLAN_DIET_LABELS.none},
          {label: MEAL_PLAN_GENERATING_MEALS_PER_DAY_LABEL, value: MEAL_PLAN_MEALS_PER_DAY_VALUES.three},
          {
            label: MEAL_PLAN_GENERATING_COOKING_TIME_LABEL,
            value: stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_MAX_TEMPLATE, {minutes: COOKING_TIME_LIMIT_MIN})
          }
        ]
      })
    })

    it('leaves an unanswered row empty rather than printing a missing value', () => {
      const summary = resolveGenerationSummary(
        'pending',
        preferences({diet: null, mealSchedule: null, cookingTimeLimitMin: null}),
        null
      )

      expect(summary?.rows.map(row => row.value)).toEqual(['', '', ''])
    })
  })

  describe('after a confirmed failure', () => {
    it('recaps the answers the server confirmed it had saved', () => {
      const named = preferences({allergens: ['milk', 'eggs', 'sesame']})

      expect(resolveGenerationSummary('failed', named, nutritionTargets(TARGET_CALORIES))).toEqual({
        overline: MEAL_PLAN_SAVED_ANSWERS_HEADER,
        rows: [
          {label: MEAL_PLAN_TARGETS_ROW_LABEL, value: kcalValue(TARGET_CALORIES)},
          {label: MEAL_PLAN_DIET_ROW_LABEL, value: MEAL_PLAN_DIET_LABELS.none},
          {
            label: MEAL_PLAN_ALLERGIES_ROW_LABEL,
            value: stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 3})
          }
        ]
      })
    })

    it('leaves the targets row empty until targets have been loaded', () => {
      const summary = resolveGenerationSummary('failed', preferences(), null)

      expect(summary?.rows[0]).toEqual({label: MEAL_PLAN_TARGETS_ROW_LABEL, value: ''})
    })

    it('leaves the targets row empty when the record carries no calorie target', () => {
      const summary = resolveGenerationSummary('failed', preferences(), nutritionTargets(null))

      expect(summary?.rows[0].value).toBe('')
    })

    it('reads the allergies row as None when only the sentinel is selected', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: ['none']}), null)

      expect(summary?.rows[2].value).toBe(MEAL_PLAN_ALLERGEN_LABELS.none)
    })

    // 'None' is an answer the 05 chip cloud records, so an empty list is the row nobody answered yet, not a
    // user who declared they have no allergies. Showing None for it would recap an answer that was never
    // given, which is the one thing a saved-answers card must not do.
    it('leaves the allergies row empty when the question has not been answered at all', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: []}), null)

      expect(summary?.rows[2].value).toBe('')
    })

    it('excludes the sentinel from the count of named allergies', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: ['none', 'peanuts']}), null)

      expect(summary?.rows[2].value).toBe(stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 1}))
    })

    it('counts a repeated allergy once, however often the payload names it', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: ['milk', 'milk']}), null)

      expect(summary?.rows[2].value).toBe(stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 1}))
    })

    it('leaves the allergies row empty when every code it was sent is one this release cannot name', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: ['mustard']}), null)

      expect(summary?.rows[2].value).toBe('')
    })

    it('counts only the nameable allergies when an unknown code arrives beside them', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: ['milk', 'mustard']}), null)

      expect(summary?.rows[2].value).toBe(stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 1}))
    })

    it('never renders an allergen code, whatever the payload carried', () => {
      const values = [['milk', 'tree_nuts'], ['mustard'], ['none', 'milk', 'milk'], []].map(
        allergens => resolveGenerationSummary('failed', preferences({allergens}), null)?.rows[2].value ?? ''
      )

      expect(values).toEqual([
        stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 2}),
        '',
        stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 1}),
        ''
      ])
      expect(values.some(value => /_|milk|tree_nuts|mustard/.test(value))).toBe(false)
    })

    it('never prints a placeholder for an absent answer', () => {
      const summary = resolveGenerationSummary(
        'failed',
        preferences({diet: null, allergens: []}),
        nutritionTargets(null)
      )
      const values = summary?.rows.map(row => row.value) ?? []

      expect(values.some(value => ['undefined', 'null', 'NaN'].includes(value))).toBe(false)
      expect(values.every(value => typeof value === 'string')).toBe(true)
    })
  })

  describe('the states that show no summary card', () => {
    it('shows no card for the no-match, unconfirmed and terminal states', () => {
      const summaries = (['noMatch', 'unconfirmed', 'terminal'] as GenerationViewKind[]).map(kind =>
        resolveGenerationSummary(kind, preferences(), nutritionTargets(TARGET_CALORIES))
      )

      expect(summaries).toEqual([null, null, null])
    })

    it('shows no card in any state before the preferences have resolved', () => {
      const summaries = VIEW_KINDS.map(kind => resolveGenerationSummary(kind, null, nutritionTargets(TARGET_CALORIES)))

      expect(summaries).toEqual([null, null, null, null, null])
    })
  })

  // Diet and mealSchedule reach this module typed as closed unions because MealPlanningDecoder spells them as
  // io.union literals, so no server can send these values today — the cast is how the test says so. The rows
  // are typed string and rendered as React children all the same: an inherited member would render as its own
  // source, '__proto__' would throw ("Objects are not valid as a React child"), and AAP 0.5.2's lenient
  // decoding direction is exactly what would make either reachable.
  describe('preference codes that are inherited Object members', () => {
    PROTOTYPE_KEYS.forEach(key => {
      it(`renders nothing for the diet code ${key}`, () => {
        const summary = resolveGenerationSummary('pending', preferences({diet: key as Diet}), null)
        const value = summary?.rows[0].value

        expect(typeof value).toBe('string')
        expect(value).toBe('')
      })

      it(`renders nothing for the meal schedule ${key}`, () => {
        const summary = resolveGenerationSummary('pending', preferences({mealSchedule: key as MealSchedule}), null)
        const value = summary?.rows[1].value

        expect(typeof value).toBe('string')
        expect(value).toBe('')
      })
    })

    it('renders nothing for a diet code a later release introduces', () => {
      const summary = resolveGenerationSummary('pending', preferences({diet: 'keto_new_release' as Diet}), null)

      expect(summary?.rows[0].value).toBe('')
    })

    it('renders nothing for a meal schedule a later release introduces', () => {
      const summary = resolveGenerationSummary(
        'pending',
        preferences({mealSchedule: 'four_plus_snack' as MealSchedule}),
        null
      )

      expect(summary?.rows[1].value).toBe('')
    })

    it('renders no function source and no object cast for any inherited code, in either summary', () => {
      const values = (['pending', 'failed'] as GenerationViewKind[]).flatMap(kind =>
        PROTOTYPE_KEYS.flatMap(key => {
          const dietRows = resolveGenerationSummary(kind, preferences({diet: key as Diet}), null)?.rows ?? []
          const scheduleRows =
            resolveGenerationSummary(kind, preferences({mealSchedule: key as MealSchedule}), null)?.rows ?? []

          return [...dietRows, ...scheduleRows].map(row => row.value)
        })
      )

      expect(values.every(value => typeof value === 'string')).toBe(true)
      expect(values.some(value => value.includes('function'))).toBe(false)
      expect(values.some(value => value.includes('[object'))).toBe(false)
      expect(values.some(value => ['undefined', 'null'].includes(value))).toBe(false)
    })

    it('still names every diet code this release ships', () => {
      const codes: readonly Diet[] = ['none', 'vegetarian', 'vegan', 'pescatarian']

      expect(codes.map(diet => resolveGenerationSummary('pending', preferences({diet}), null)?.rows[0].value)).toEqual(
        codes.map(diet => MEAL_PLAN_DIET_LABELS[diet])
      )
    })

    it('still names every meal schedule this release ships', () => {
      const schedules: readonly MealSchedule[] = ['three', 'three_plus_snack']

      expect(
        schedules.map(
          mealSchedule => resolveGenerationSummary('pending', preferences({mealSchedule}), null)?.rows[1].value
        )
      ).toEqual(schedules.map(mealSchedule => MEAL_PLAN_MEALS_PER_DAY_VALUES[mealSchedule]))
    })
  })
})

describe('extractLimitingConstraints', () => {
  describe('payloads that carry no analysis', () => {
    it('returns nothing for an absent error', () => {
      expect(extractLimitingConstraints(undefined)).toEqual([])
    })

    it('returns nothing for a null error', () => {
      expect(extractLimitingConstraints(null)).toEqual([])
    })

    it('returns nothing for an error with no response', () => {
      expect(extractLimitingConstraints(new Error('Network Error'))).toEqual([])
    })

    it('returns nothing when the analysis is not an array', () => {
      expect(extractLimitingConstraints(constraintPayload({cooking_time: 30}))).toEqual([])
    })

    it('returns nothing when the analysis is a string', () => {
      expect(extractLimitingConstraints(constraintPayload('cooking_time'))).toEqual([])
    })

    it('returns nothing when the analysis is absent from a decoded body', () => {
      expect(extractLimitingConstraints(apiError(422, API_ERROR_CODES.noMatchingMeals))).toEqual([])
    })
  })

  describe('entries that cannot be rendered at all', () => {
    it('drops an entry that is not an object', () => {
      expect(extractLimitingConstraints(constraintPayload(['cooking_time', 7, null]))).toEqual([])
    })

    it('drops an entry whose constraint key this release cannot label', () => {
      expect(extractLimitingConstraints(constraintPayload([{constraintKey: 'moon_phase', editStep: 'diet'}]))).toEqual(
        []
      )
    })

    it('drops an entry with no edit step, because its row could not be edited', () => {
      expect(extractLimitingConstraints(constraintPayload([{constraintKey: 'diet'}]))).toEqual([])
    })

    it('drops an entry whose edit step is not a string', () => {
      expect(extractLimitingConstraints(constraintPayload([{constraintKey: 'diet', editStep: 7}]))).toEqual([])
    })
  })

  describe('values that are normalized rather than dropped', () => {
    it('keeps an unrecognised edit step as the review fallback', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([{constraintKey: 'diet', editStep: 'macro_tuning'}])
      )

      expect(constraints.map(entry => entry.editStep)).toEqual(['review'])
    })

    PROTOTYPE_KEYS.forEach(key => {
      it(`normalizes the inherited name ${key} to the review fallback`, () => {
        const constraints = extractLimitingConstraints(constraintPayload([{constraintKey: 'diet', editStep: key}]))

        expect(constraints[0].editStep).toBe('review')
      })
    })

    it('drops a value that is not a number', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([{constraintKey: 'cooking_time', value: '30', unit: 'minutes', editStep: 'cooking'}])
      )

      expect(constraints[0].value).toBeNull()
    })

    it('drops a value that is not finite', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([
          {constraintKey: 'cooking_time', value: Number.NaN, unit: 'minutes', editStep: 'cooking'},
          {constraintKey: 'dislikes', value: Number.POSITIVE_INFINITY, unit: 'foods', editStep: 'dislikes'}
        ])
      )

      expect(constraints.map(entry => entry.value)).toEqual([null, null])
    })

    it('drops a unit this release has no template for', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([{constraintKey: 'portion_limits', value: 4, unit: 'servings', editStep: 'cooking'}])
      )

      expect(constraints[0].unit).toBeNull()
      expect(constraints[0].value).toBe(4)
    })

    it('filters the slot list down to the strings the server sent', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([
          {constraintKey: 'slot_coverage', slots: ['breakfast', 7, null, 'dinner'], editStep: 'schedule'}
        ])
      )

      expect(constraints[0].slots).toEqual(['breakfast', 'dinner'])
    })

    it('reads an absent slot list as an empty one', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([{constraintKey: 'slot_coverage', editStep: 'schedule'}])
      )

      expect(constraints[0].slots).toEqual([])
    })

    it('reads a slot list that is not an array as an empty one', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([{constraintKey: 'slot_coverage', slots: 'breakfast', editStep: 'schedule'}])
      )

      expect(constraints[0].slots).toEqual([])
    })
  })

  describe('the order the analysis arrived in', () => {
    it('preserves the server order and drops only the unusable entries', () => {
      const constraints = extractLimitingConstraints(
        constraintPayload([
          {constraintKey: 'cooking_time', value: 30, unit: 'minutes', editStep: 'cooking'},
          {constraintKey: 'moon_phase', editStep: 'diet'},
          {constraintKey: 'dislikes', value: 9, unit: 'foods', editStep: 'dislikes'},
          {constraintKey: 'diet', editStep: 'diet'}
        ])
      )

      expect(constraints.map(entry => entry.constraintKey)).toEqual(['cooking_time', 'dislikes', 'diet'])
    })

    it('leaves the payload it read untouched', () => {
      const entries: unknown[] = [
        {constraintKey: 'cooking_time', value: 30, unit: 'minutes', slots: ['lunch'], editStep: 'cooking'},
        {constraintKey: 'moon_phase', editStep: 'diet'}
      ]
      const snapshot = JSON.stringify(entries)
      const constraints = extractLimitingConstraints(constraintPayload(entries))

      constraints[0].slots.push('dinner')

      expect(entries).toHaveLength(2)
      expect(JSON.stringify(entries)).toBe(snapshot)
    })
  })
})

describe('buildLimitingConstraintRows', () => {
  describe('how a row picks its value', () => {
    it('formats a unit and value through that unit template', () => {
      const [row] = buildLimitingConstraintRows([constraint()], preferences())

      expect(row.value).toBe(
        stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.minutes, {value: COOKING_TIME_LIMIT_MIN})
      )
    })

    it('falls back to the labelled slots when the analysis gave no measurement', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'slot_coverage', value: null, unit: null, slots: ['breakfast', 'dinner']})],
        preferences()
      )

      expect(row.value).toBe(
        [MEAL_SLOT_LABELS.breakfast, MEAL_SLOT_LABELS.dinner].join(MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR)
      )
    })

    it("reads the diet row from the user's own answer, which the payload never carries", () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})],
        preferences({diet: 'vegan'})
      )

      expect(row.value).toBe(MEAL_PLAN_DIET_LABELS.vegan)
    })

    it('reads the diet row as Not set while the preferences are unknown', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})],
        null
      )

      expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
    })

    it('reads the diet row as Not set when the user answered no diet question', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})],
        preferences({diet: null})
      )

      expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
    })

    it('keeps a row with nothing to show rather than printing its machine code', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'catalog_coverage', value: null, unit: null, editStep: 'review'})],
        preferences()
      )

      expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
      expect(row.label).toBe(MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.catalog_coverage)
      expect(row.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    })

    // The payload the backend actually sends for a slot with no eligible recipes: the count AND the slots it
    // was counted in. The count alone would read '0 recipes' and drop the slot the analysis is about, which
    // 0.7.3 requires it to name, so both are asserted — and the slot labels separately, so a regression that
    // keeps the count and loses the slot fails on its own.
    it('names the slots of a slot_coverage analysis ahead of the count it found there', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({
            constraintKey: 'slot_coverage',
            value: 0,
            unit: 'recipes',
            slots: ['breakfast', 'dinner'],
            editStep: 'schedule'
          })
        ],
        preferences()
      )

      expect(row.value).toBe(
        [
          [MEAL_SLOT_LABELS.breakfast, MEAL_SLOT_LABELS.dinner].join(MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR),
          stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.recipes, {value: 0})
        ].join(MEAL_PLAN_VALUE_SEPARATOR)
      )
      expect(row.value).toContain(MEAL_SLOT_LABELS.breakfast)
      expect(row.value).toContain(MEAL_SLOT_LABELS.dinner)
    })

    it('keeps the slot context of a catalog_coverage analysis beside its thinnest count', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({constraintKey: 'catalog_coverage', value: 2, unit: 'recipes', slots: ['lunch'], editStep: 'diet'})
        ],
        preferences()
      )

      expect(row.value).toBe(
        [
          MEAL_SLOT_LABELS.lunch,
          stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.recipes, {value: 2})
        ].join(MEAL_PLAN_VALUE_SEPARATOR)
      )
      expect(row.value).toContain(MEAL_SLOT_LABELS.lunch)
      expect(row.value).toContain(stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.recipes, {value: 2}))
    })

    it('reads a coverage analysis as its count alone when no slot it named can be labelled', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({
            constraintKey: 'slot_coverage',
            value: 0,
            unit: 'recipes',
            slots: ['brunch'],
            editStep: 'schedule'
          })
        ],
        preferences()
      )

      expect(row.value).toBe(stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.recipes, {value: 0}))
      expect(row.value).not.toContain('brunch')
      expect(row.value).not.toContain(MEAL_PLAN_VALUE_SEPARATOR)
    })

    it('leaves no separator behind when the analysis named no slots at all', () => {
      const rows = buildLimitingConstraintRows(
        [
          constraint({constraintKey: 'cooking_time', value: 30, unit: 'minutes', slots: [], editStep: 'cooking'}),
          constraint({constraintKey: 'slot_coverage', value: 0, unit: 'recipes', slots: [], editStep: 'schedule'})
        ],
        preferences()
      )

      expect(rows.map(row => row.value)).toEqual([
        stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.minutes, {value: 30}),
        stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.recipes, {value: 0})
      ])
      expect(rows.every(row => !row.value.includes(MEAL_PLAN_VALUE_SEPARATOR))).toBe(true)
    })
  })

  // The 422 body types `value` and `unit` nullable (0.5.2) and the two coverage keys carry no figure at all, so
  // a row with no measurement to phrase is a state the card renders rather than a branch it defends against.
  // The value line has to stay drawn for it — a row that collapses to its name says nothing about the missing
  // measurement — so these cases pin the placeholder rather than the empty string that removed the line.
  describe('a measurement the analysis withheld', () => {
    const MEASUREMENTLESS_PAIRS: ReadonlyArray<[LimitingConstraintUnit | null, number | null]> = [
      ['minutes', null],
      [null, 30],
      [null, null]
    ]

    const CONSTRAINT_KEYS: readonly LimitingConstraintKey[] = [
      'cooking_time',
      'dislikes',
      'diet',
      'nutrition_tolerance',
      'portion_limits',
      'slot_coverage',
      'catalog_coverage'
    ]

    it('states the placeholder in the copy Plan Settings and the summary rows already use', () => {
      expect(PLAN_SETTINGS_NOT_SET_VALUE).toBe('Not set')
    })

    MEASUREMENTLESS_PAIRS.forEach(([unit, value]) => {
      it(`reads a cooking_time row of unit ${String(unit)} and value ${String(value)} as the placeholder`, () => {
        const [row] = buildLimitingConstraintRows(
          [constraint({constraintKey: 'cooking_time', value, unit, slots: [], editStep: 'cooking'})],
          preferences()
        )

        expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
        expect(row.label).toBe(MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.cooking_time)
        expect(row.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
      })
    })

    // The keys whose analysis is a coverage verdict rather than a figure: their measurement half is routinely
    // absent even when the payload is complete, so they are the state a real 422 reaches this card in.
    const VALUE_LESS_KEYS: readonly LimitingConstraintKey[] = ['slot_coverage', 'catalog_coverage']

    VALUE_LESS_KEYS.forEach(constraintKey => {
      MEASUREMENTLESS_PAIRS.forEach(([unit, value]) => {
        it(`reads a ${constraintKey} row of unit ${String(unit)} and value ${String(value)} as the placeholder`, () => {
          const [row] = buildLimitingConstraintRows(
            [constraint({constraintKey, value, unit, slots: [], editStep: 'review'})],
            preferences()
          )

          expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
          expect(row.label).toBe(MEAL_PLAN_LIMITING_CONSTRAINT_LABELS[constraintKey])
        })
      })
    })

    // The invariant the card relies on, asserted over every key and every half-answered pair: no row value is
    // blank, whatever the analysis withheld, so the value line can never be dropped for want of text.
    it('gives every key a value line to draw, whichever half of the measurement is missing', () => {
      const rows = buildLimitingConstraintRows(
        CONSTRAINT_KEYS.flatMap(constraintKey =>
          MEASUREMENTLESS_PAIRS.map(([unit, value]) =>
            constraint({constraintKey, value, unit, slots: [], editStep: 'review'})
          )
        ),
        preferences({diet: null})
      )

      expect(rows).toHaveLength(CONSTRAINT_KEYS.length * MEASUREMENTLESS_PAIRS.length)
      expect(rows.every(row => row.value.trim().length > 0)).toBe(true)
    })

    // The placeholder must not become the answer for a row that has one: a populated measurement, and a
    // coverage row carrying both its slots and its count, still read exactly as they did.
    it('leaves a fully populated measurement untouched', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'cooking_time', value: 30, unit: 'minutes', slots: [], editStep: 'cooking'})],
        preferences()
      )

      expect(row.value).toBe(stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.minutes, {value: 30}))
      expect(row.value).not.toBe(PLAN_SETTINGS_NOT_SET_VALUE)
    })

    it('leaves a populated coverage analysis reading as its slots and its count', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({
            constraintKey: 'slot_coverage',
            value: 0,
            unit: 'recipes',
            slots: ['breakfast'],
            editStep: 'schedule'
          })
        ],
        preferences()
      )

      expect(row.value).toBe(
        [
          MEAL_SLOT_LABELS.breakfast,
          stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.recipes, {value: 0})
        ].join(MEAL_PLAN_VALUE_SEPARATOR)
      )
      expect(row.value).not.toContain(PLAN_SETTINGS_NOT_SET_VALUE)
    })

    // A half-answered measurement must not cost the slots the analysis did name — the placeholder answers only
    // a row with nothing at all to say.
    it('still names the slots of a coverage row whose count is missing', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({
            constraintKey: 'slot_coverage',
            value: null,
            unit: null,
            slots: ['breakfast', 'dinner'],
            editStep: 'schedule'
          })
        ],
        preferences()
      )

      expect(row.value).toBe(
        [MEAL_SLOT_LABELS.breakfast, MEAL_SLOT_LABELS.dinner].join(MEAL_PLAN_CONSTRAINT_SLOT_SEPARATOR)
      )
      expect(row.value).not.toContain(PLAN_SETTINGS_NOT_SET_VALUE)
    })
  })

  describe('the row the constraint card renders', () => {
    it('labels the row and its Edit pill from the copy constants', () => {
      const [row] = buildLimitingConstraintRows([constraint({constraintKey: 'dislikes', editStep: 'dislikes'})], null)

      expect(row).toEqual({
        constraintKey: 'dislikes',
        label: MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.dislikes,
        value: stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.minutes, {
          value: COOKING_TIME_LIMIT_MIN
        }),
        editStep: 'dislikes',
        editLabel: MEAL_PLAN_EDIT_LINK_TEXT,
        editAccessibilityLabel: stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_EDIT_ACCESSIBILITY_TEMPLATE, {
          label: MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.dislikes
        })
      })
    })

    it('builds one row per constraint in the order the analysis gave them', () => {
      const rows = buildLimitingConstraintRows(
        [
          constraint(),
          constraint({constraintKey: 'dislikes', value: 9, unit: 'foods', editStep: 'dislikes'}),
          constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})
        ],
        preferences({diet: 'vegan'})
      )

      expect(rows.map(row => row.constraintKey)).toEqual(['cooking_time', 'dislikes', 'diet'])
    })

    it('builds nothing from an empty analysis', () => {
      expect(buildLimitingConstraintRows([], preferences())).toEqual([])
    })

    it('resolves each row Edit pill to the screen that owns the step it names', () => {
      const rows = buildLimitingConstraintRows(
        [
          constraint({constraintKey: 'cooking_time', editStep: 'cooking'}),
          constraint({constraintKey: 'dislikes', editStep: 'dislikes'}),
          constraint({constraintKey: 'diet', editStep: 'diet'}),
          constraint({constraintKey: 'nutrition_tolerance', editStep: 'review'}),
          constraint({constraintKey: 'slot_coverage', editStep: 'schedule'}),
          constraint({constraintKey: 'portion_limits', editStep: 'goal'})
        ],
        preferences()
      )

      expect(rows.map(row => resolveConstraintEditRoute(row.editStep))).toEqual([
        Screens.MEAL_PLAN_COOKING_BUDGET,
        Screens.MEAL_PLAN_FOOD_PREFERENCES,
        Screens.MEAL_PLAN_DIET,
        Screens.MEAL_PLAN_TARGETS,
        Screens.MEAL_PLAN_SCHEDULE,
        Screens.MEAL_PLAN_GOAL
      ])
    })
  })

  describe('every constraint key the analysis can name', () => {
    const CONSTRAINT_UNITS_BY_KEY: ReadonlyArray<[LimitingConstraintKey, LimitingConstraintUnit, number]> = [
      ['cooking_time', 'minutes', 30],
      ['dislikes', 'foods', 9],
      ['diet', 'foods', 2],
      ['nutrition_tolerance', 'percent', 12],
      ['portion_limits', 'recipes', 3],
      ['slot_coverage', 'recipes', 4],
      ['catalog_coverage', 'recipes', 2]
    ]

    CONSTRAINT_UNITS_BY_KEY.forEach(([constraintKey, unit, value]) => {
      it(`labels the ${constraintKey} row and formats its measurement from the copy constants`, () => {
        const [row] = buildLimitingConstraintRows([constraint({constraintKey, unit, value})], preferences())

        expect(row.label).toBe(MEAL_PLAN_LIMITING_CONSTRAINT_LABELS[constraintKey])
        expect(row.value).toBe(stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES[unit], {value}))
        expect(row.constraintKey).toBe(constraintKey)
      })
    })

    it('gives all seven keys a label of their own', () => {
      const rows = buildLimitingConstraintRows(
        CONSTRAINT_UNITS_BY_KEY.map(([constraintKey]) => constraint({constraintKey})),
        preferences()
      )
      const labels = rows.map(row => row.label)

      expect(labels).toEqual(CONSTRAINT_UNITS_BY_KEY.map(([key]) => MEAL_PLAN_LIMITING_CONSTRAINT_LABELS[key]))
      expect(new Set(labels).size).toBe(CONSTRAINT_UNITS_BY_KEY.length)
    })

    // A renamed template parameter leaves its brace behind, which would reach the card as literal text.
    it('substitutes every template parameter it renders, whatever the analysis withheld', () => {
      const rows = buildLimitingConstraintRows(
        CONSTRAINT_UNITS_BY_KEY.flatMap(([constraintKey, unit, value]) => [
          constraint({constraintKey, unit, value}),
          constraint({constraintKey, unit: null, value: null, slots: ['lunch']}),
          constraint({constraintKey, unit: null, value: null, slots: []})
        ]),
        preferences()
      )

      rows.forEach(row => {
        expect(row.value).not.toMatch(/[{}]/)
        expect(row.label).not.toMatch(/[{}]/)
        expect(row.editAccessibilityLabel).not.toMatch(/[{}]/)
      })
    })

    it('keeps the label and the Edit pill of a row whose measurement, unit and slots are all absent', () => {
      const rows = buildLimitingConstraintRows(
        CONSTRAINT_UNITS_BY_KEY.map(([constraintKey]) =>
          constraint({constraintKey, value: null, unit: null, slots: [], editStep: 'review'})
        ),
        preferences({diet: null})
      )

      expect(rows.map(row => row.value)).toEqual(CONSTRAINT_UNITS_BY_KEY.map(() => PLAN_SETTINGS_NOT_SET_VALUE))
      expect(rows.every(row => row.editLabel === MEAL_PLAN_EDIT_LINK_TEXT)).toBe(true)
      expect(rows.every(row => row.label.length > 0)).toBe(true)
    })
  })

  describe('slot names that are inherited Object members', () => {
    PROTOTYPE_KEYS.forEach(key => {
      it(`names no slot for the inherited slot name ${key}`, () => {
        const [row] = buildLimitingConstraintRows(
          [constraint({constraintKey: 'slot_coverage', value: null, unit: null, slots: [key], editStep: 'schedule'})],
          preferences()
        )

        expect(typeof row.value).toBe('string')
        expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
      })
    })

    it('names no slot for a slot list made entirely of inherited names', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({
            constraintKey: 'slot_coverage',
            value: null,
            unit: null,
            slots: [...PROTOTYPE_KEYS],
            editStep: 'schedule'
          })
        ],
        preferences()
      )

      expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
      expect(row.value).not.toContain('function')
      expect(row.value).not.toContain('[object')
    })

    it('labels the real slots and ignores the inherited names beside them', () => {
      const [row] = buildLimitingConstraintRows(
        [
          constraint({
            constraintKey: 'slot_coverage',
            value: null,
            unit: null,
            slots: ['constructor', 'lunch', '__proto__'],
            editStep: 'schedule'
          })
        ],
        preferences()
      )

      expect(row.value).toBe(MEAL_SLOT_LABELS.lunch)
    })

    it('keeps every rendered value a string whatever the payload named', () => {
      const rows = buildLimitingConstraintRows(
        PROTOTYPE_KEYS.map(key =>
          constraint({constraintKey: 'slot_coverage', value: null, unit: null, slots: [key], editStep: 'schedule'})
        ),
        preferences()
      )

      expect(rows.every(row => typeof row.value === 'string')).toBe(true)
    })
  })

  // The 10c diet row reads the stored answer rather than the payload, so it is the second place a diet code
  // becomes text and it needs the same guard the summary card's row does. The row keeps its label and its
  // Edit pill either way, which is the point: an unnameable code costs the value, never the way to fix it.
  describe('diet codes that are inherited Object members', () => {
    const dietRow = (diet: string): LimitingConstraintRow => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})],
        preferences({diet: diet as Diet})
      )

      return row
    }

    PROTOTYPE_KEYS.forEach(key => {
      it(`names no diet for the inherited code ${key}`, () => {
        const row = dietRow(key)

        expect(typeof row.value).toBe('string')
        expect(row.value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
      })
    })

    it('names no diet for a code a later release introduces', () => {
      expect(dietRow('keto_new_release').value).toBe(PLAN_SETTINGS_NOT_SET_VALUE)
    })

    it('renders no function source and no object cast for any inherited code', () => {
      const values = PROTOTYPE_KEYS.map(key => dietRow(key).value)

      expect(values.some(value => value.includes('function'))).toBe(false)
      expect(values.some(value => value.includes('[object'))).toBe(false)
      expect(values.some(value => ['undefined', 'null'].includes(value))).toBe(false)
    })

    it('keeps the row labelled and editable when its code cannot be named', () => {
      const row = dietRow('constructor')

      expect(row.label).toBe(MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.diet)
      expect(row.editStep).toBe('diet')
      expect(row.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    })

    it('still names every diet code this release ships', () => {
      const codes: readonly Diet[] = ['none', 'vegetarian', 'vegan', 'pescatarian']

      expect(codes.map(diet => dietRow(diet).value)).toEqual(codes.map(diet => MEAL_PLAN_DIET_LABELS[diet]))
    })
  })
})

describe('resolveConstraintEditRoute', () => {
  it('opens the screen that owns each setup step', () => {
    expect(SETUP_STEPS.map(resolveConstraintEditRoute)).toEqual([
      Screens.MEAL_PLAN_GOAL,
      Screens.MEAL_PLAN_TARGETS,
      Screens.MEAL_PLAN_TARGETS,
      Screens.MEAL_PLAN_DIET,
      Screens.MEAL_PLAN_FOOD_PREFERENCES,
      Screens.MEAL_PLAN_SCHEDULE,
      Screens.MEAL_PLAN_COOKING_BUDGET,
      Screens.MEAL_PLAN_TARGETS,
      Screens.MEAL_PLAN_TARGETS
    ])
  })

  it('falls back to review for a step this release does not know', () => {
    expect(resolveConstraintEditRoute('macro_tuning' as SetupStep)).toBe(Screens.MEAL_PLAN_TARGETS)
  })

  PROTOTYPE_KEYS.forEach(key => {
    it(`returns the review route as a string for the inherited name ${key}`, () => {
      const route = resolveConstraintEditRoute(key as SetupStep)

      expect(typeof route).toBe('string')
      expect(route).toBe(Screens.MEAL_PLAN_TARGETS)
    })
  })

  it('gives an inherited name exactly the route review itself resolves to', () => {
    expect(resolveConstraintEditRoute('constructor' as SetupStep)).toBe(resolveConstraintEditRoute('review'))
  })
})

describe('resolveConstraintReturnTo', () => {
  it('returns a regeneration edit to plan settings', () => {
    expect(resolveConstraintReturnTo(REGENERATE)).toBe('settings')
  })

  it('returns a setup edit to the review screen', () => {
    expect(resolveConstraintReturnTo(SETUP)).toBe('review')
  })

  it('returns a next-week edit to the review screen', () => {
    expect(resolveConstraintReturnTo(NEXT_WEEK)).toBe('review')
  })
})

describe('resolveActionRoute', () => {
  it('names no route for a retry, which stays on this screen and replays the same key', () => {
    const routes = [SETUP, NEXT_WEEK, REGENERATE].map(context => resolveActionRoute('retry', context))

    expect(routes).toEqual([null, null, null])
  })

  it('sends back-to-plan to the plan tab from any context', () => {
    const routes = [SETUP, NEXT_WEEK, REGENERATE].map(context => resolveActionRoute('backToPlan', context))

    expect(routes).toEqual([Screens.MACROS, Screens.MACROS, Screens.MACROS])
  })

  it('sends a regeneration edit to plan settings', () => {
    expect(resolveActionRoute('editPreferences', REGENERATE)).toBe(Screens.PLAN_SETTINGS)
  })

  it('sends a setup edit to the review screen', () => {
    expect(resolveActionRoute('editPreferences', SETUP)).toBe(Screens.MEAL_PLAN_TARGETS)
  })

  it('sends a next-week edit to the review screen', () => {
    expect(resolveActionRoute('editPreferences', NEXT_WEEK)).toBe(Screens.MEAL_PLAN_TARGETS)
  })
})

describe('buildGenerationRequest', () => {
  const REVISIONS = {expectedPreferencesRevision: 4, expectedTargetsRevision: 2}

  it('builds a generation for setup from the start date the route carries', () => {
    expect(buildGenerationRequest({context: SETUP, startDate: '2026-07-05', ...REVISIONS})).toEqual({
      action: 'generate',
      startDate: '2026-07-05',
      expectedPreferencesRevision: 4,
      expectedTargetsRevision: 2
    })
  })

  it('prefers the next-week context own start date, so the two can never disagree', () => {
    const context: GenerationContext = {kind: 'nextWeek', startDate: '2026-07-12'}

    expect(buildGenerationRequest({context, startDate: '2026-07-05', ...REVISIONS})).toMatchObject({
      action: 'generate',
      startDate: '2026-07-12'
    })
  })

  it('builds a regeneration naming the plan it replaces and the revision it expects', () => {
    expect(buildGenerationRequest({context: REGENERATE, startDate: '2026-07-05', ...REVISIONS})).toEqual({
      action: 'regenerate',
      planId: 'plan-7c9f',
      expectedPlanRevision: 3,
      expectedPreferencesRevision: 4,
      expectedTargetsRevision: 2
    })
  })

  it('leaves a start date out of a regeneration, which keeps the dates it already has', () => {
    const request = buildGenerationRequest({context: REGENERATE, startDate: '2026-07-05', ...REVISIONS})

    expect(Object.keys(request)).not.toContain('startDate')
  })

  // The same inputs after a restart have to rebuild the same request, or the stored key could not be replayed.
  it('rebuilds an identical request from identical inputs', () => {
    const inputs = {context: SETUP, startDate: '2026-07-05', ...REVISIONS}

    expect(buildGenerationRequest(inputs)).toEqual(buildGenerationRequest({...inputs}))
  })

  it('changes when a revision the attempt was built against moves', () => {
    const inputs = {context: SETUP, startDate: '2026-07-05', ...REVISIONS}

    expect(buildGenerationRequest({...inputs, expectedTargetsRevision: 3})).not.toEqual(buildGenerationRequest(inputs))
  })
})

// The gate the screen's mount attempt passes through: what may be sent, under which key, once the persisted
// intent slice has actually been read. Every case fixes its own clock, because the 7-day life of a stored
// record and the boundary cases around it must not depend on when the suite runs (AAP 0.7.2).
describe('resolveGenerationLaunch', () => {
  const USER_ID = 'user-3f2a'
  const OTHER_USER_ID = 'user-9b1c'
  const ROUTE_KEY = 'idem-route-9f31'
  const STORED_KEY = 'idem-stored-41ba'
  const ATTEMPTED_AT = Date.UTC(2026, 6, 5, 12, 0, 0)
  const AN_HOUR_MS = ONE_DAY_MS / 24
  const RECORDED_AT = ATTEMPTED_AT - AN_HOUR_MS
  const REVISIONS = {expectedPreferencesRevision: 4, expectedTargetsRevision: 2}

  const setupRequest = (startDate = '2026-07-06'): GenerationRequestSnapshot =>
    buildGenerationRequest({context: SETUP, startDate, ...REVISIONS})

  const regenerateRequest = (context: GenerationContext = REGENERATE): GenerationRequestSnapshot =>
    buildGenerationRequest({context, startDate: '2026-07-06', ...REVISIONS})

  const storedIntent = (
    request: GenerationRequestSnapshot,
    overrides: {key?: string; userId?: string; createdAt?: number} = {}
  ): PendingIntent =>
    buildPendingIntent(
      request,
      overrides.key ?? STORED_KEY,
      overrides.userId ?? USER_ID,
      overrides.createdAt ?? RECORDED_AT
    )

  const sliceHolding = (intent: PendingIntent): MealPlanStore['pendingIntents'] => ({[intent.request.action]: intent})

  const launchInput = (overrides: Partial<GenerationLaunchInput> = {}): GenerationLaunchInput => ({
    pendingIntents: {},
    userId: USER_ID,
    request: setupRequest(),
    hasHydratedIntents: true,
    intentsHydration: 'succeeded',
    idempotencyKey: ROUTE_KEY,
    attemptedAt: ATTEMPTED_AT,
    ...overrides
  })

  describe('the persisted read, which precedes every other answer', () => {
    it('sends nothing while the read is still out', () => {
      const decision = resolveGenerationLaunch(launchInput({hasHydratedIntents: false, intentsHydration: 'pending'}))

      expect(decision).toEqual({kind: 'waiting'})
    })

    // The whole point of keeping the third state: a read that rejected leaves the slot's contents unknown,
    // which is not the same as empty, so the screen refuses rather than minting beside a key it cannot see.
    it('refuses to send when the read failed, rather than reading an unread slice as an empty one', () => {
      const decision = resolveGenerationLaunch(launchInput({hasHydratedIntents: false, intentsHydration: 'failed'}))

      expect(decision).toEqual({kind: 'unreadable'})
    })

    it('answers a failed read as refused even if the boolean disagrees, because the refusal is the stricter fact', () => {
      expect(resolveGenerationLaunch(launchInput({intentsHydration: 'failed'}))).toEqual({kind: 'unreadable'})
    })

    it('never answers with a key until the read has succeeded', () => {
      const answers = [
        resolveGenerationLaunch(launchInput({hasHydratedIntents: false, intentsHydration: 'pending'})),
        resolveGenerationLaunch(launchInput({hasHydratedIntents: false, intentsHydration: 'failed'}))
      ]

      expect(answers.map(answer => answer.kind)).toEqual(['waiting', 'unreadable'])
      expect(answers.filter(answer => answer.kind === 'send')).toEqual([])
    })
  })

  describe('a slot nothing holds', () => {
    it('sends the route key and records the intent the attempt is about to rely on', () => {
      const request = setupRequest()

      expect(resolveGenerationLaunch(launchInput({request}))).toEqual({
        kind: 'send',
        idempotencyKey: ROUTE_KEY,
        isReplay: false,
        request,
        intent: buildPendingIntent(request, ROUTE_KEY, USER_ID, ATTEMPTED_AT)
      })
    })

    it('is not blocked by the other generation slot, which answers a different write', () => {
      const decision = resolveGenerationLaunch(
        launchInput({pendingIntents: sliceHolding(storedIntent(regenerateRequest()))})
      )

      expect(decision).toMatchObject({kind: 'send', idempotencyKey: ROUTE_KEY, isReplay: false})
    })

    it('is not blocked by another account own record, which this session may never replay', () => {
      const foreign = storedIntent(setupRequest(), {userId: OTHER_USER_ID})

      expect(resolveGenerationLaunch(launchInput({pendingIntents: sliceHolding(foreign)}))).toMatchObject({
        kind: 'send',
        idempotencyKey: ROUTE_KEY,
        isReplay: false
      })
    })

    it('is not blocked by a record that has aged out of its replayable life', () => {
      const expired = storedIntent(setupRequest(), {createdAt: ATTEMPTED_AT - PENDING_INTENT_TTL_MS})

      expect(resolveGenerationLaunch(launchInput({pendingIntents: sliceHolding(expired)}))).toMatchObject({
        kind: 'send',
        idempotencyKey: ROUTE_KEY,
        isReplay: false
      })
    })

    // A record this release cannot parse can never be replayed, so it is not a key worth protecting — which
    // is the store's own rule (`parsePendingIntent`), applied here rather than restated.
    it('is not blocked by a stored value this release cannot read as an intent', () => {
      const corrupt = {generate: {key: STORED_KEY}} as unknown as MealPlanStore['pendingIntents']

      expect(resolveGenerationLaunch(launchInput({pendingIntents: corrupt}))).toMatchObject({
        kind: 'send',
        idempotencyKey: ROUTE_KEY,
        isReplay: false
      })
    })
  })

  describe('this screen own unresolved generation', () => {
    it('replays the stored key carrying the stored request, and re-records it at its own age', () => {
      const request = setupRequest()
      const intent = storedIntent(request)

      expect(resolveGenerationLaunch(launchInput({request, pendingIntents: sliceHolding(intent)}))).toEqual({
        kind: 'send',
        idempotencyKey: STORED_KEY,
        isReplay: true,
        request,
        intent: buildPendingIntent(request, STORED_KEY, USER_ID, RECORDED_AT)
      })
    })

    // The re-record restates the record rather than renewing it: a key minted six days ago must still expire
    // on its seventh day rather than living another week because the screen was reopened.
    it('never extends the life of the key it replays', () => {
      const intent = storedIntent(setupRequest(), {createdAt: ATTEMPTED_AT - PENDING_INTENT_TTL_MS + AN_HOUR_MS})
      const decision = resolveGenerationLaunch(launchInput({pendingIntents: sliceHolding(intent)}))

      expect(decision.kind === 'send' ? decision.intent?.createdAt : null).toBe(intent.createdAt)
      expect(decision.kind === 'send' ? decision.intent?.createdAt : null).not.toBe(ATTEMPTED_AT)
    })

    // A moved preferences or targets revision is the same user intent under a key the server may already have
    // answered, so the STORED body is what goes out — a reused key carrying a changed body is answered
    // `409 idempotency_conflict`, and that refusal is what retires the key and frees the slot.
    it('sends the stored body, not the freshly built one, when a revision has moved since', () => {
      const stored = buildGenerationRequest({
        context: SETUP,
        startDate: '2026-07-06',
        expectedPreferencesRevision: 4,
        expectedTargetsRevision: 2
      })
      const rebuilt = buildGenerationRequest({
        context: SETUP,
        startDate: '2026-07-06',
        expectedPreferencesRevision: 5,
        expectedTargetsRevision: 3
      })

      expect(
        resolveGenerationLaunch(launchInput({request: rebuilt, pendingIntents: sliceHolding(storedIntent(stored))}))
      ).toMatchObject({kind: 'send', idempotencyKey: STORED_KEY, isReplay: true, request: stored})
    })

    it('replays a regeneration of the plan this screen was opened for, at the revision it was recorded with', () => {
      const stored = regenerateRequest({kind: 'regenerate', planId: 'plan-7c9f', planRevision: 2})
      const rebuilt = regenerateRequest()

      expect(
        resolveGenerationLaunch(launchInput({request: rebuilt, pendingIntents: sliceHolding(storedIntent(stored))}))
      ).toMatchObject({kind: 'send', idempotencyKey: STORED_KEY, isReplay: true, request: stored})
    })
  })

  describe('an unresolved generation that belongs elsewhere', () => {
    // The single slot per action is what forces this: the record cannot be replayed from here (this screen
    // describes another week) and cannot be written over either, because its write may have committed.
    it('hands off a generation of another week rather than minting over it', () => {
      const intent = storedIntent(setupRequest('2026-07-13'))

      expect(
        resolveGenerationLaunch(launchInput({request: setupRequest(), pendingIntents: sliceHolding(intent)}))
      ).toEqual({kind: 'handOff', intent})
    })

    it('hands off a regeneration of another plan rather than minting over it', () => {
      const intent = storedIntent(regenerateRequest({kind: 'regenerate', planId: 'plan-other', planRevision: 1}))

      expect(
        resolveGenerationLaunch(launchInput({request: regenerateRequest(), pendingIntents: sliceHolding(intent)}))
      ).toEqual({kind: 'handOff', intent})
    })

    it('carries the record itself, so the hand-off names the key it is passing on', () => {
      const intent = storedIntent(setupRequest('2026-07-20'), {key: 'idem-stranded-77c2'})
      const decision = resolveGenerationLaunch(launchInput({pendingIntents: sliceHolding(intent)}))

      expect(decision.kind === 'handOff' ? decision.intent.key : null).toBe('idem-stranded-77c2')
    })
  })

  describe('no signed-in account', () => {
    // Intents are scoped by account, so there is nothing to replay and nothing that could be overwritten: the
    // attempt leaves under the route key with no record to write.
    it('sends the route key and records nothing', () => {
      const request = setupRequest()

      expect(resolveGenerationLaunch(launchInput({request, userId: null}))).toEqual({
        kind: 'send',
        idempotencyKey: ROUTE_KEY,
        isReplay: false,
        request,
        intent: null
      })
    })

    it('is unaffected by the persisted read, which can hold nothing this session owns', () => {
      const decision = resolveGenerationLaunch(
        launchInput({userId: null, hasHydratedIntents: false, intentsHydration: 'pending'})
      )

      expect(decision).toMatchObject({kind: 'send', intent: null})
    })
  })
})

// The two ways the persisted intent layer can refuse before a request leaves, as the screen draws them. Both
// mean the same thing — the record that makes a lost response replayable is not on the device — so the suite
// pins that neither is ever drawn as progress and that each retries the call that actually failed (0.7.2).
describe('resolveIntentRefusal', () => {
  const LAUNCH_KINDS: readonly GenerationLaunchDecision['kind'][] = ['waiting', 'unreadable', 'handOff', 'send']

  describe('a rehydration that rejected', () => {
    it('is drawn as a refusal the read itself is asked again for', () => {
      expect(resolveIntentRefusal('unreadable', false)).toEqual({
        kind: 'read',
        body: MEAL_PLAN_LOAD_ERROR_TITLE,
        actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
      })
    })

    // The stricter state wins: a launch that never reached 'send' reserved nothing, so a write refusal left
    // over from an earlier attempt must not be what the screen says while the slot is unreadable.
    it('outranks a reservation refusal, because an unreadable slot cannot have been reserved against', () => {
      expect(resolveIntentRefusal('unreadable', true)).toMatchObject({kind: 'read'})
    })
  })

  describe('a reservation the device would not confirm', () => {
    it('is drawn as a refusal of the attempt that was permitted', () => {
      expect(resolveIntentRefusal('send', true)).toEqual({
        kind: 'write',
        body: TOAST_GENERIC_ERROR,
        actionLabel: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT
      })
    })

    // 'waiting' and 'handOff' send nothing and reserve nothing, so a refusal flag surviving from an earlier
    // attempt cannot describe them — each is already showing its own state.
    it('says nothing for a launch that never reached the reservation', () => {
      const refusals = LAUNCH_KINDS.filter(kind => kind !== 'unreadable' && kind !== 'send').map(kind =>
        resolveIntentRefusal(kind, true)
      )

      expect(refusals).toEqual([null, null])
    })
  })

  describe('nothing about the layer refusing', () => {
    it('answers null for a permitted attempt whose record is on the device', () => {
      expect(resolveIntentRefusal('send', false)).toBeNull()
    })

    it('answers only the unreadable read when no reservation has been refused', () => {
      const answered = LAUNCH_KINDS.filter(kind => resolveIntentRefusal(kind, false) !== null)

      expect(answered).toEqual(['unreadable'])
    })
  })

  // One way out of both: neither the read nor the reservation changed anything, so repeating the call is the
  // whole recovery and the label says the same thing in each case.
  it('offers the same retry for either refusal', () => {
    const labels = [resolveIntentRefusal('unreadable', false), resolveIntentRefusal('send', true)].map(
      refusal => refusal?.actionLabel ?? null
    )

    expect(labels).toEqual([MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT, MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT])
  })
})

// The seam between the request a key was minted for and the outcomes that end its life. A refusal the screen
// classifies as terminal has to retire the intent, or the next cold start rebuilds the same request, finds the
// key still pending and replays a request the server has already refused — for as long as the record survives.
describe('the keyed intent lifecycle', () => {
  const REVISIONS = {expectedPreferencesRevision: 4, expectedTargetsRevision: 2}
  const INPUTS = {context: SETUP, startDate: '2026-07-05', ...REVISIONS}

  it('keeps the key alive while the outcome is one the screen may retry', () => {
    const view = resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), SETUP)

    expect(view.terminalCode).toBeNull()
    expect(resolveTerminalRecovery(view.terminalCode, SETUP)).toBeNull()
  })

  it('keeps the key alive for an outcome the server never confirmed, which may have committed', () => {
    const view = resolveGenerationView('error', new Error('Network Error'), SETUP)

    expect(view.kind).toBe('unconfirmed')
    expect(resolveTerminalRecovery(view.terminalCode, SETUP)).toBeNull()
  })

  it.each([
    ['a validation refusal', 400, API_ERROR_CODES.invalidRequest],
    ['the capability being off', 503, API_ERROR_CODES.featureDisabled],
    ['a refusal from a later server release', 409, 'some_future_refusal']
  ])('retires the key after %s, so the next launch mints a new one', (_case, status, code) => {
    const view = resolveGenerationView('error', apiError(status, code), SETUP)

    expect(view.kind).toBe('terminal')
    expect(resolveTerminalRecovery(view.terminalCode, SETUP)?.clearsPendingIntent).toBe(true)
  })

  it('rebuilds the byte-identical request a surviving key may be replayed against', () => {
    expect(buildGenerationRequest(INPUTS)).toEqual(buildGenerationRequest({...INPUTS, context: {kind: 'setup'}}))
  })

  it('fingerprints a different request once an edit has changed what the attempt asks for', () => {
    const edited = buildGenerationRequest({...INPUTS, expectedPreferencesRevision: 5})

    expect(edited).not.toEqual(buildGenerationRequest(INPUTS))
  })
})

// The plan an `upcoming_exists` refusal is answered by. A refusal names no id, so the answer has to come from
// the read that follows it — and a read that carries no upcoming week is a real answer, not a failure: the
// recovery still leaves for the Meal Plan tab (AAP 0.7.4).
describe('resolveUpcomingPlanId', () => {
  it('names the upcoming plan the read reported', () => {
    expect(resolveUpcomingPlanId(makePlans(makePlan(), makeUpcomingPlan()))).toBe(UPCOMING_PLAN_ID)
  })

  it('names it even when it is the only plan in hand', () => {
    expect(resolveUpcomingPlanId(makePlans(null, makeUpcomingPlan()))).toBe(UPCOMING_PLAN_ID)
  })

  // The week that rolled over is not the week the refusal was about, and selecting it would open a plan the
  // user was not asking for. The tab resolves `current ?? upcoming` for itself.
  it('never falls back to the current plan', () => {
    const answer = resolveUpcomingPlanId(makePlans(makePlan(), null))

    expect(answer).toBeNull()
    expect(answer).not.toBe(CURRENT_PLAN_ID)
  })

  it('answers nothing when the read carried no plan at all', () => {
    expect(resolveUpcomingPlanId(makePlans(null, null))).toBeNull()
  })

  it('answers nothing when the read could not answer', () => {
    expect(resolveUpcomingPlanId(null)).toBeNull()
    expect(resolveUpcomingPlanId(undefined)).toBeNull()
  })

  // An empty id is not an identity: selecting it would put the tab into a selection nothing matches.
  it('answers nothing for a plan carrying no id', () => {
    expect(resolveUpcomingPlanId(makePlans(null, makeUpcomingPlan({id: ''})))).toBeNull()
  })
})

// The identity that settles a generation, which is the only thing that may resolve its key: the plan a
// confirmed commit returned, or a refetched plan carrying that very key. Everything else about a refetch is
// display-only (AAP 0.2.5, 0.7.2).
describe('resolveSettledGenerationPlanId', () => {
  const SENT_KEY = 'idem-generate-1'

  describe('a confirmed commit', () => {
    it('selects the plan the server returned', () => {
      const plan = makePlan()

      expect(resolveSettledGenerationPlanId({kind: 'committed', plan})).toBe(CURRENT_PLAN_ID)
    })

    // The regression behind a next-week generation and an upcoming-plan regeneration: the settled plan is the
    // new week, so leaving the selection on the week that was on screen reopens the wrong plan.
    it('selects the newly generated week rather than the week that was on screen', () => {
      const generated = makeUpcomingPlan()

      expect(resolveSettledGenerationPlanId({kind: 'committed', plan: generated})).toBe(UPCOMING_PLAN_ID)
      expect(resolveSettledGenerationPlanId({kind: 'committed', plan: generated})).not.toBe(CURRENT_PLAN_ID)
    })
  })

  describe('a refetch after a lost response', () => {
    it('settles on the current plan carrying the key this attempt sent', () => {
      const plans = makePlans(withGenerationKey(makePlan(), SENT_KEY), null)

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: SENT_KEY})).toBe(CURRENT_PLAN_ID)
    })

    it('settles on the upcoming plan carrying the key, with the current week still in hand', () => {
      const plans = makePlans(makePlan(), withGenerationKey(makeUpcomingPlan(), SENT_KEY))

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: SENT_KEY})).toBe(UPCOMING_PLAN_ID)
    })

    it('settles nothing when neither plan carries the key', () => {
      const plans = makePlans(makePlan(), makeUpcomingPlan())

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: SENT_KEY})).toBeNull()
    })

    it('settles nothing when the refetch answered with no plan at all', () => {
      expect(
        resolveSettledGenerationPlanId({kind: 'refetched', plans: makePlans(null, null), sentKey: SENT_KEY})
      ).toBeNull()
    })

    it('settles nothing when the refetch could not answer', () => {
      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans: undefined, sentKey: SENT_KEY})).toBeNull()
      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans: null, sentKey: SENT_KEY})).toBeNull()
    })

    it('settles nothing while no key has been sent', () => {
      const plans = makePlans(withGenerationKey(makePlan(), SENT_KEY), null)

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: null})).toBeNull()
    })

    // The member the wire contract never promised (AAP 0.5.2). A plan that carries no key proves nothing about
    // a lost response, so the refetch stays display-only and the intent stays pending.
    it('settles nothing when neither plan carries a generation key at all', () => {
      const plans = makePlans(
        withGenerationKey(makePlan(), undefined),
        withGenerationKey(makeUpcomingPlan(), undefined)
      )

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: SENT_KEY})).toBeNull()
    })

    it('settles nothing when a plan carries a null generation key', () => {
      const plans = makePlans(withGenerationKey(makePlan(), null), null)

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: SENT_KEY})).toBeNull()
    })

    // One plan without the member must not hide the other: the scan reads past it rather than stopping there.
    it('reads past a plan with no key to the week that carries the key sent', () => {
      const plans = makePlans(withGenerationKey(makePlan(), undefined), withGenerationKey(makeUpcomingPlan(), SENT_KEY))

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: SENT_KEY})).toBe(UPCOMING_PLAN_ID)
    })

    // A plan whose own key failed to decode to anything must never be matched by an attempt that has none.
    it('never matches an empty key against an empty generation key', () => {
      const plans = makePlans(withGenerationKey(makePlan(), ''), null)

      expect(resolveSettledGenerationPlanId({kind: 'refetched', plans, sentKey: ''})).toBeNull()
    })
  })
})
