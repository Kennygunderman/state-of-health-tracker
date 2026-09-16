import {MealPlanMeal} from '@data/models/MealPlan'
import {
  buildPendingIntent,
  MealPlanStore,
  PendingIntent,
  PendingIntentAction,
  PENDING_INTENT_TTL_MS,
  resolvePendingIntent
} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {matchesFingerprint, SwapRequestSnapshot} from '@utility/IdempotencyUtility'
import {AxiosError, AxiosResponse} from 'axios'

import {
  guardsForNewAttempt,
  KeyedMutationState,
  resolveAlternativesRevision,
  resolveReplayableSwap,
  resolveSwapRetryPlan,
  resolveUnconfirmedRefetch,
  selectSwapAttemptState,
  SwapAttemptGuards
} from '../index.orchestration'
import {resolveSwapView, retiresPendingIntent, SwapView} from '../index.util'

// Mocking the persist adapter keeps the suite free of native modules: `index.orchestration` imports the store
// module for its pure replay API, and importing that module creates the persisted store.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

const USER_ID = 'user-1'

const OTHER_USER_ID = 'user-2'

const PLAN_ID = 'plan-1'

const MEAL_ID = 'meal-1'

const NOW = 1_760_000_000_000

const STORED_KEY = 'idem-stored'

const FRESH_KEY = 'idem-fresh'

const OPENED_REVISION = 4

const swapSnapshot = (overrides: Partial<Omit<SwapRequestSnapshot, 'action'>> = {}): SwapRequestSnapshot => ({
  action: 'swap',
  planId: PLAN_ID,
  mealId: MEAL_ID,
  recipeVersionId: 'recipe-version-wrap',
  portionMultiplier: 1,
  expectedPlanRevision: OPENED_REVISION,
  ...overrides
})

const storedIntent = (snapshot: SwapRequestSnapshot = swapSnapshot(), userId: string = USER_ID): PendingIntent =>
  buildPendingIntent(snapshot, STORED_KEY, userId, NOW)

const stateWith = (intent: PendingIntent | null): Pick<MealPlanStore, 'pendingIntents'> => ({
  pendingIntents: intent === null ? {} : {swap: intent}
})

const axiosError = (status?: number, body?: unknown): AxiosError => {
  const response = status === undefined ? undefined : ({status, data: body} as AxiosResponse)

  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response)
}

const plannedMeal = (): MealPlanMeal => ({
  id: MEAL_ID,
  revision: 3,
  slot: 'lunch',
  slotTime: '12:30',
  sortOrder: 1,
  recipe: {
    versionId: 'recipe-version-bowl',
    recipeId: 'recipe-bowl',
    name: 'Chicken burrito bowl',
    iconKey: 'bowl',
    totalMinutes: 25,
    badges: ['high_protein'],
    nutritionProvenance: 'source_backed'
  },
  portionMultiplier: 1,
  portionText: '1 serving',
  planned: {calories: 610, protein: 45, carbs: 58, fat: 21},
  flags: [],
  previousRecipe: null,
  loggedEntries: []
})

// The view the screen is actually holding when a swap commit came back without an answer, derived rather than
// asserted so the classification stays the util's.
const unconfirmedView = (dayError: unknown = null): SwapView =>
  resolveSwapView({
    currentMeal: plannedMeal(),
    alternatives: undefined,
    isAlternativesPending: false,
    alternativesError: null,
    swapError: axiosError(),
    isDayPending: false,
    dayError
  })

interface ScreenPass {
  guards: SwapAttemptGuards
  planDayRefetches: number
  retiredIntents: PendingIntentAction[]
}

const freshPass = (): ScreenPass => ({
  guards: guardsForNewAttempt(),
  planDayRefetches: 0,
  retiredIntents: []
})

/**
 * The unconfirmed effect of `index.tsx`, step for step: read the guard, ask for the decision, write the guard
 * back, refetch the plan day. The retire branch is here on purpose — the screen has none — so that "the intent
 * survives" is an assertion about the decision rather than about this simulator: it would retire the intent the
 * moment the decision allowed it.
 */
const runUnconfirmedEffect = (viewKind: SwapView['kind'], pass: ScreenPass): ScreenPass => {
  const decision = resolveUnconfirmedRefetch({
    viewKind,
    hasRefetchedUnconfirmed: pass.guards.hasRefetchedUnconfirmed
  })

  if (!decision.refetchesPlanDay) {
    return pass
  }

  return {
    guards: {...pass.guards, hasRefetchedUnconfirmed: decision.hasRefetchedUnconfirmed},
    planDayRefetches: pass.planDayRefetches + 1,
    retiredIntents: decision.resolvesPendingIntent ? [...pass.retiredIntents, 'swap'] : pass.retiredIntents
  }
}

describe('resolveUnconfirmedRefetch', () => {
  describe('with an unconfirmed commit outcome', () => {
    it('refetches the plan day exactly once, however many times the effect re-runs', () => {
      const first = runUnconfirmedEffect('unconfirmed', freshPass())
      const second = runUnconfirmedEffect('unconfirmed', first)
      const third = runUnconfirmedEffect('unconfirmed', second)

      expect(first.planDayRefetches).toBe(1)
      expect(third.planDayRefetches).toBe(1)
      expect(third.guards.hasRefetchedUnconfirmed).toBe(true)
    })

    it('refetches not at all when the guard is already set', () => {
      const decision = resolveUnconfirmedRefetch({viewKind: 'unconfirmed', hasRefetchedUnconfirmed: true})
      const guarded: ScreenPass = {...freshPass(), guards: {recoveredTerminalCode: null, hasRefetchedUnconfirmed: true}}

      expect(decision.refetchesPlanDay).toBe(false)
      expect(decision.hasRefetchedUnconfirmed).toBe(true)
      expect(runUnconfirmedEffect('unconfirmed', guarded).planDayRefetches).toBe(0)
    })

    it('never resolves the pending intent, so the stored key survives the refetch', () => {
      const intent = storedIntent()
      const state = stateWith(intent)
      const pass = runUnconfirmedEffect(unconfirmedView().kind, freshPass())

      expect(pass.planDayRefetches).toBe(1)
      expect(pass.retiredIntents).toEqual([])
      expect(resolvePendingIntent(state, 'swap', USER_ID, NOW)).toEqual(intent)
    })

    it('leaves the intent and the state alone when the day query answers stale_plan at the same time', () => {
      const intent = storedIntent()
      const state = stateWith(intent)
      const view = unconfirmedView(axiosError(409, {error: API_ERROR_CODES.stalePlan}))

      const decision = resolveUnconfirmedRefetch({viewKind: view.kind, hasRefetchedUnconfirmed: false})
      const pass = runUnconfirmedEffect(view.kind, freshPass())

      expect(view.kind).toBe('unconfirmed')
      expect(retiresPendingIntent(view)).toBe(false)
      expect(decision.refetchesPlanDay).toBe(true)
      expect(decision.resolvesPendingIntent).toBe(false)
      expect(pass.retiredIntents).toEqual([])
      expect(resolvePendingIntent(state, 'swap', USER_ID, NOW)).toEqual(intent)
    })

    it('refetches again for the next outcome once a new attempt has reset the guard', () => {
      const refetched = runUnconfirmedEffect('unconfirmed', freshPass())
      const blocked = runUnconfirmedEffect('unconfirmed', refetched)

      const afterRetryPressed: ScreenPass = {...blocked, guards: guardsForNewAttempt()}
      const refetchedAgain = runUnconfirmedEffect('unconfirmed', afterRetryPressed)

      expect(blocked.planDayRefetches).toBe(1)
      expect(refetchedAgain.planDayRefetches).toBe(2)
    })
  })

  describe('with any other view', () => {
    const otherKinds: SwapView['kind'][] = ['loading', 'list', 'empty', 'error', 'failed', 'terminal']

    it.each(otherKinds)('does not refetch for the %s view and leaves the guard untouched', kind => {
      const decision = resolveUnconfirmedRefetch({viewKind: kind, hasRefetchedUnconfirmed: false})

      expect(decision.refetchesPlanDay).toBe(false)
      expect(decision.hasRefetchedUnconfirmed).toBe(false)
      expect(runUnconfirmedEffect(kind, freshPass()).planDayRefetches).toBe(0)
    })

    it('keeps a guard already earned by an unconfirmed outcome while the view is a terminal refusal', () => {
      expect(resolveUnconfirmedRefetch({viewKind: 'terminal', hasRefetchedUnconfirmed: true})).toEqual({
        refetchesPlanDay: false,
        resolvesPendingIntent: false,
        hasRefetchedUnconfirmed: true
      })
    })
  })
})

describe('guardsForNewAttempt', () => {
  it('clears both per-attempt guards so the new attempt earns its own recovery and refetch', () => {
    expect(guardsForNewAttempt()).toEqual({recoveredTerminalCode: null, hasRefetchedUnconfirmed: false})
  })
})

describe('resolveSwapRetryPlan', () => {
  it('replays the stored key while the request still fingerprints to the stored intent', () => {
    const intent = storedIntent()

    const plan = resolveSwapRetryPlan({
      state: stateWith(intent),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW + 5_000,
      freshKey: FRESH_KEY
    })

    expect(plan.isReplay).toBe(true)
    expect(plan.idempotencyKey).toBe(STORED_KEY)
    expect(plan.request).toEqual(intent.request)
    expect(plan.variables).toEqual({
      mealId: MEAL_ID,
      payload: {
        recipeVersionId: 'recipe-version-wrap',
        portionMultiplier: 1,
        expectedPlanRevision: OPENED_REVISION,
        idempotencyKey: STORED_KEY
      }
    })
  })

  it('mints the fresh key when the stored intent describes a different request', () => {
    const plan = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot({recipeVersionId: 'recipe-version-salad'}))),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW + 5_000,
      freshKey: FRESH_KEY
    })

    expect(plan.isReplay).toBe(false)
    expect(plan.idempotencyKey).toBe(FRESH_KEY)
    expect(plan.variables.payload).toEqual({
      recipeVersionId: 'recipe-version-wrap',
      portionMultiplier: 1,
      expectedPlanRevision: OPENED_REVISION,
      idempotencyKey: FRESH_KEY
    })
  })

  it('mints the fresh key when the portion or the revision the preview bound has moved', () => {
    const movedRevision = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot({expectedPlanRevision: OPENED_REVISION + 1}))),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    const movedPortion = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot({portionMultiplier: 1.5}))),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    expect(movedRevision.idempotencyKey).toBe(FRESH_KEY)
    expect(movedPortion.idempotencyKey).toBe(FRESH_KEY)
  })

  it('mints the fresh key when nothing is on record, and when the record has expired or belongs to another user', () => {
    const nothingStored = resolveSwapRetryPlan({
      state: stateWith(null),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    const expired = resolveSwapRetryPlan({
      state: stateWith(storedIntent()),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW + PENDING_INTENT_TTL_MS,
      freshKey: FRESH_KEY
    })

    const anotherUser = resolveSwapRetryPlan({
      state: stateWith(storedIntent(swapSnapshot(), OTHER_USER_ID)),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt: NOW,
      freshKey: FRESH_KEY
    })

    expect(nothingStored.idempotencyKey).toBe(FRESH_KEY)
    expect(expired.idempotencyKey).toBe(FRESH_KEY)
    expect(anotherUser.idempotencyKey).toBe(FRESH_KEY)
  })

  it('returns an intent that describes the request actually in flight', () => {
    const attemptedAt = NOW + 9_000

    const plan = resolveSwapRetryPlan({
      state: stateWith(storedIntent()),
      snapshot: swapSnapshot(),
      userId: USER_ID,
      attemptedAt,
      freshKey: FRESH_KEY
    })

    expect(plan.intent.key).toBe(plan.idempotencyKey)
    expect(plan.intent.userId).toBe(USER_ID)
    expect(plan.intent.createdAt).toBe(attemptedAt)
    expect(plan.intent.request).toEqual(plan.request)
    expect(matchesFingerprint(plan.request, plan.intent.fingerprint)).toBe(true)
  })
})

describe('resolveReplayableSwap', () => {
  it('answers with the stored request for this user, plan and meal, and the key it was minted for', () => {
    const intent = storedIntent()

    const attempt = resolveReplayableSwap({
      state: stateWith(intent),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    // The key travels with the request because it is what identifies the attempt in the shared mutation cache:
    // without it the screen has no way to match the outcome of a commit the preview screen fired.
    expect(attempt).toEqual({key: intent.key, request: intent.request})
    expect(attempt?.key).toBe(STORED_KEY)
  })

  it('answers null when there is no signed-in user to scope the record to', () => {
    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent()),
        userId: null,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW
      })
    ).toBeNull()
  })

  it('answers null for a record about another meal or another plan', () => {
    const otherMeal = resolveReplayableSwap({
      state: stateWith(storedIntent(swapSnapshot({mealId: 'meal-9'}))),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    const otherPlan = resolveReplayableSwap({
      state: stateWith(storedIntent(swapSnapshot({planId: 'plan-9'}))),
      userId: USER_ID,
      planId: PLAN_ID,
      mealId: MEAL_ID,
      now: NOW
    })

    expect(otherMeal).toBeNull()
    expect(otherPlan).toBeNull()
  })

  it('answers null for an expired record, for another user and for an empty slice', () => {
    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent()),
        userId: USER_ID,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW + PENDING_INTENT_TTL_MS
      })
    ).toBeNull()

    expect(
      resolveReplayableSwap({
        state: stateWith(storedIntent(swapSnapshot(), OTHER_USER_ID)),
        userId: USER_ID,
        planId: PLAN_ID,
        mealId: MEAL_ID,
        now: NOW
      })
    ).toBeNull()

    expect(
      resolveReplayableSwap({state: stateWith(null), userId: USER_ID, planId: PLAN_ID, mealId: MEAL_ID, now: NOW})
    ).toBeNull()
  })
})

describe('selectSwapAttemptState', () => {
  // The shape a swap commit's mutation-cache entry really has: `useSwapMealMutation(planId, mealId)` closes
  // over both ids, so the variables are a bare payload and the idempotency key is the only field that can tie
  // an entry back to the pending intent recorded beside it.
  type TestState = KeyedMutationState & {status: string; error: Error | null}

  const entry = (idempotencyKey: string | null, submittedAt: number, status = 'error'): TestState => ({
    submittedAt,
    status,
    error: status === 'error' ? new Error('swap_failed') : null,
    variables:
      idempotencyKey === null
        ? {recipeVersionId: 'recipe-1', portionMultiplier: 1, expectedPlanRevision: 3}
        : {recipeVersionId: 'recipe-1', portionMultiplier: 1, expectedPlanRevision: 3, idempotencyKey}
  })

  it('answers with the entry whose variables carry the attempt key', () => {
    const mine = entry(STORED_KEY, 10)

    expect(selectSwapAttemptState([entry('idem-other', 5), mine, entry('idem-later', 20)], STORED_KEY)).toBe(mine)
  })

  it('answers null when there is no unresolved attempt to match', () => {
    // A null key is the resolved case — the intent was retired by a server answer — and draws no banner even
    // while the cache still holds the entry that resolved it.
    expect(selectSwapAttemptState([entry(STORED_KEY, 10)], null)).toBeNull()
  })

  it('answers null when no entry carries the key, and for an empty cache', () => {
    expect(selectSwapAttemptState([entry('idem-other', 10)], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([], STORED_KEY)).toBeNull()
  })

  it('answers with the latest submission when a replay re-sends the same key', () => {
    const replay = entry(STORED_KEY, 30)

    // A replay sends the identical key, so the cache holds two entries for one attempt and the newer one is the
    // outcome now on screen. Order in the array must not decide it.
    expect(selectSwapAttemptState([replay, entry(STORED_KEY, 10)], STORED_KEY)).toBe(replay)
    expect(selectSwapAttemptState([entry(STORED_KEY, 10), replay], STORED_KEY)).toBe(replay)
  })

  it('ignores entries whose variables carry no usable key', () => {
    // Nothing may be inferred from an entry that cannot be attributed: variables are typed `unknown` at the
    // cache boundary, so a missing or non-string key is skipped rather than matched loosely.
    expect(selectSwapAttemptState([entry(null, 10)], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([{submittedAt: 10, variables: undefined}], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([{submittedAt: 10, variables: {idempotencyKey: 7}}], STORED_KEY)).toBeNull()
    expect(selectSwapAttemptState([{submittedAt: 10, variables: 'idem-stored'}], STORED_KEY)).toBeNull()
  })

  it('preserves the entry type so the caller keeps its own status and error', () => {
    const pending = entry(STORED_KEY, 10, 'pending')

    expect(selectSwapAttemptState([pending], STORED_KEY)?.status).toBe('pending')
    expect(selectSwapAttemptState([entry(STORED_KEY, 10)], STORED_KEY)?.error).toBeInstanceOf(Error)
  })
})

describe('resolveAlternativesRevision', () => {
  it('selects the revision the day query reports when it is newer than the one the screen opened on', () => {
    expect(
      resolveAlternativesRevision({dayPlanRevision: OPENED_REVISION + 1, openedPlanRevision: OPENED_REVISION})
    ).toBe(OPENED_REVISION + 1)
  })

  it('selects the day revision even when it is older, because the list must match the plan the day describes', () => {
    expect(
      resolveAlternativesRevision({dayPlanRevision: OPENED_REVISION - 1, openedPlanRevision: OPENED_REVISION})
    ).toBe(OPENED_REVISION - 1)
  })

  it('keeps the opened revision while the day query agrees or has not answered', () => {
    expect(resolveAlternativesRevision({dayPlanRevision: OPENED_REVISION, openedPlanRevision: OPENED_REVISION})).toBe(
      OPENED_REVISION
    )
    expect(resolveAlternativesRevision({dayPlanRevision: undefined, openedPlanRevision: OPENED_REVISION})).toBe(
      OPENED_REVISION
    )
    expect(resolveAlternativesRevision({dayPlanRevision: null, openedPlanRevision: OPENED_REVISION})).toBe(
      OPENED_REVISION
    )
  })
})
