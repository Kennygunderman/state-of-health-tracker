import {MealPlanPreferences, SetupStep} from '@data/models/MealPlanPreferences'
import {NutritionTargets} from '@data/models/NutritionTargets'
import {LimitingConstraint} from '@data/models/PlanGenerationResult'
import {GenerationContext} from '@navigation/types'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {formatCalories} from '@utility/NutritionFormatUtility'

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
  MEAL_PLAN_LIMITING_CONSTRAINT_LABELS,
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
  MEAL_SLOT_LABELS,
  stringWithNamedParameters
} from '@constants/strings'

import {
  buildLimitingConstraintRows,
  extractLimitingConstraints,
  GenerationRequestStatus,
  GenerationViewKind,
  resolveActionRoute,
  resolveConstraintEditRoute,
  resolveConstraintReturnTo,
  resolveGenerationSummary,
  resolveGenerationView,
  resolveTerminalRecovery
} from '../index.util'

// The seven refusals that carry card copy and the two plan-state refusals that deliberately do not. Declared
// here rather than imported so the suite pins the intended membership instead of restating the module's.
const TERMINAL_COPY_CODES: readonly string[] = [
  API_ERROR_CODES.staleRevision,
  API_ERROR_CODES.planOverlap,
  API_ERROR_CODES.upcomingExists,
  API_ERROR_CODES.preferencesIncomplete,
  API_ERROR_CODES.targetsMissing,
  API_ERROR_CODES.targetsUnconfirmed,
  API_ERROR_CODES.idempotencyConflict
]

const PLAN_STATE_TERMINAL_CODES: readonly string[] = [API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive]

const TERMINAL_CODES: readonly string[] = [...TERMINAL_COPY_CODES, ...PLAN_STATE_TERMINAL_CODES]

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
        badgeVariant: 'noMatch',
        headline: MEAL_PLAN_UNCONFIRMED_OUTCOME_TITLE,
        headlineSize: 'default',
        body: MEAL_PLAN_UNCONFIRMED_OUTCOME_BODY,
        showAllergiesBanner: false,
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
        actions: {
          primary: {kind: 'retry', label: MEAL_PLAN_TRY_AGAIN_BUTTON_TEXT},
          secondary: {kind: 'editPreferences', label: MEAL_PLAN_EDIT_PREFERENCES_BUTTON_TEXT}
        },
        terminalCode: null
      })
    })

    it('renders the failure state for a confirmed 4xx code this release does not recognise', () => {
      const view = resolveGenerationView('error', apiError(409, 'some_future_refusal'), SETUP)

      expect(view.kind).toBe('failed')
      expect(view.terminalCode).toBeNull()
    })

    it('renders the failure state for a validation code that is not one of the generation outcomes', () => {
      expect(resolveGenerationView('error', apiError(400, API_ERROR_CODES.invalidRequest), SETUP).kind).toBe('failed')
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

    it('offers no action and no badge for a terminal outcome', () => {
      const view = resolveGenerationView('error', apiError(409, API_ERROR_CODES.staleRevision), SETUP)

      expect(view.actions).toBeNull()
      expect(view.badgeVariant).toBeNull()
      expect(view.showSpinner).toBe(false)
    })

    TERMINAL_COPY_CODES.forEach(code => {
      it(`reads the card copy of ${code} from the terminal copy constants`, () => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(view.headline).toBe(MEAL_PLAN_GENERATION_TERMINAL_COPY[code].title)
        expect(view.body).toBe(MEAL_PLAN_GENERATION_TERMINAL_COPY[code].body)
        expect(view.headline.length).toBeGreaterThan(0)
        expect(view.body.length).toBeGreaterThan(0)
      })
    })

    PLAN_STATE_TERMINAL_CODES.forEach(code => {
      it(`leaves ${code} without card copy, because its recovery leaves the screen immediately`, () => {
        const view = resolveGenerationView('error', apiError(409, code), SETUP)

        expect(view.headline).toBe('')
        expect(view.body).toBe('')
      })
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

    it('keeps the confirmed-failure badge distinct from the unconfirmed one', () => {
      const failed = resolveGenerationView('error', apiError(502, API_ERROR_CODES.planGenerationFailed), SETUP)
      const unconfirmed = resolveGenerationView('error', apiError(502), SETUP)

      expect(failed.badgeVariant).toBe('failure')
      expect(unconfirmed.badgeVariant).toBe('noMatch')
      expect(failed.badgeVariant).not.toBe(unconfirmed.badgeVariant)
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
      expect(view.actions?.secondary.kind).toBe('editPreferences')
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

  it('has no recovery for a code this release does not classify as terminal', () => {
    expect(resolveTerminalRecovery('some_future_refusal', REGENERATE)).toBeNull()
  })

  PLAN_STATE_TERMINAL_CODES.forEach(code => {
    it(`clears the intent, refetches the plan and toasts on ${code} during setup`, () => {
      expect(resolveTerminalRecovery(code, SETUP)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: true,
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        route: Screens.MEAL_PLAN_TARGETS
      })
    })

    it(`sends a regeneration back to the plan tab on ${code}`, () => {
      expect(resolveTerminalRecovery(code, REGENERATE)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: true,
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        route: Screens.MACROS
      })
    })

    it(`sends the next-week flow to review on ${code}`, () => {
      expect(resolveTerminalRecovery(code, NEXT_WEEK)?.route).toBe(Screens.MEAL_PLAN_TARGETS)
    })
  })

  TERMINAL_COPY_CODES.forEach(code => {
    it(`resolves the intent for ${code} without a toast or a route, because the card carries the next move`, () => {
      expect(resolveTerminalRecovery(code, SETUP)).toEqual({
        clearsPendingIntent: true,
        refetchesCurrentPlan: false,
        toast: null,
        route: null
      })
    })
  })

  it('resolves the pending intent for every terminal code, whatever the context', () => {
    const clears = TERMINAL_CODES.flatMap(code =>
      [SETUP, NEXT_WEEK, REGENERATE].map(context => resolveTerminalRecovery(code, context)?.clearsPendingIntent)
    )

    expect(clears).toHaveLength(TERMINAL_CODES.length * 3)
    expect(clears.every(clearsPendingIntent => clearsPendingIntent === true)).toBe(true)
  })

  describe('the structural invariant behind the two code sets', () => {
    it('gives every terminal code either card copy or a plan-state recovery, never neither and never both', () => {
      const classified = TERMINAL_CODES.map(code => {
        const hasCopy = Object.prototype.hasOwnProperty.call(MEAL_PLAN_GENERATION_TERMINAL_COPY, code)
        const recovery = resolveTerminalRecovery(code, SETUP)

        return {code, hasCopy, isPlanState: recovery?.refetchesCurrentPlan === true}
      })

      expect(classified).toHaveLength(9)
      expect(classified.filter(entry => entry.hasCopy === entry.isPlanState)).toEqual([])
    })

    it('classifies every code that owns terminal card copy as terminal', () => {
      const kinds = Object.keys(MEAL_PLAN_GENERATION_TERMINAL_COPY).map(
        code => resolveGenerationView('error', apiError(409, code), SETUP).kind
      )

      expect(kinds).toEqual(TERMINAL_COPY_CODES.map(() => 'terminal'))
    })

    it('holds no card copy for either plan-state code, so their recovery is the only answer', () => {
      const copied = PLAN_STATE_TERMINAL_CODES.filter(code =>
        Object.prototype.hasOwnProperty.call(MEAL_PLAN_GENERATION_TERMINAL_COPY, code)
      )

      expect(copied).toEqual([])
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

    it('reads the allergies row as None when nothing at all is selected', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: []}), null)

      expect(summary?.rows[2].value).toBe(MEAL_PLAN_ALLERGEN_LABELS.none)
    })

    it('excludes the sentinel from the count of named allergies', () => {
      const summary = resolveGenerationSummary('failed', preferences({allergens: ['none', 'peanuts']}), null)

      expect(summary?.rows[2].value).toBe(stringWithNamedParameters(MEAL_PLAN_SELECTED_VALUE_TEMPLATE, {count: 1}))
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

    it('leaves the diet row empty while the preferences are unknown', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})],
        null
      )

      expect(row.value).toBe('')
    })

    it('leaves the diet row empty when the user answered no diet question', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'diet', value: null, unit: null, editStep: 'diet'})],
        preferences({diet: null})
      )

      expect(row.value).toBe('')
    })

    it('keeps a row with nothing to show rather than printing its machine code', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'catalog_coverage', value: null, unit: null, editStep: 'review'})],
        preferences()
      )

      expect(row.value).toBe('')
      expect(row.label).toBe(MEAL_PLAN_LIMITING_CONSTRAINT_LABELS.catalog_coverage)
      expect(row.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    })

    it('prefers the measurement over the slots when the analysis gave both', () => {
      const [row] = buildLimitingConstraintRows(
        [constraint({constraintKey: 'slot_coverage', value: 40, unit: 'percent', slots: ['lunch']})],
        preferences()
      )

      expect(row.value).toBe(stringWithNamedParameters(MEAL_PLAN_CONSTRAINT_VALUE_TEMPLATES.percent, {value: 40}))
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
  })

  describe('slot names that are inherited Object members', () => {
    PROTOTYPE_KEYS.forEach(key => {
      it(`renders nothing for the slot name ${key}`, () => {
        const [row] = buildLimitingConstraintRows(
          [constraint({constraintKey: 'slot_coverage', value: null, unit: null, slots: [key], editStep: 'schedule'})],
          preferences()
        )

        expect(typeof row.value).toBe('string')
        expect(row.value).toBe('')
      })
    })

    it('renders nothing for a slot list made entirely of inherited names', () => {
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

      expect(row.value).toBe('')
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
