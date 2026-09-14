import {createEmptyMacroTotals} from '@data/models/Macros'
import {Meal} from '@data/models/Meal'
import {MealSlot} from '@data/models/Recipe'
import {buildPendingIntent, MealPlanStore, PendingIntent} from '@store/mealPlan/useMealPlanStore'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'

import {MEAL_PLAN_STALE_PLAN_TOAST, TOAST_GENERIC_ERROR} from '@constants/strings'

import {
  canChangeLogDate,
  classifyLogFailure,
  isPlanStateReadFailure,
  LogPlanDateRange,
  logMutationScope,
  nextLogDate,
  planDayQueryRecovery,
  planDayQueryScope,
  planLogAttempt,
  planUnconfirmedRefetch,
  resolveLogCacheScope,
  resolveLogDiaryDestination
} from '../index.orchestration'
import {buildPlannedLogRequest} from '../index.util'

// The orchestration reaches the store module for the shared keyed-request rule, which pulls the persist
// adapter's AsyncStorage import in with it. Mocking the adapter — as `useMealPlanStore.test.ts` does — keeps
// this suite free of native modules; none of these decisions reads or writes persisted state.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

const PLAN_ID = 'plan-1'

const MEAL_ID = 'meal-lunch-tue'

const USER_ID = 'user-1'

// The plan's Monday-to-Sunday week, the meal planned for Tuesday, and Thursday as the day the user steps it
// onto: three distinct days, so a decision that confuses the planned day with the selected one cannot pass.
const PLAN_RANGE: LogPlanDateRange = {startDate: '2026-03-02', endDate: '2026-03-08'}

const PLANNED_DATE = '2026-03-03'

const STEPPED_DATE = '2026-03-05'

const ATTEMPTED_AT = Date.parse('2026-03-03T12:00:00.000Z')

const FRESH_KEY = 'fresh-key'

const STORED_KEY = 'stored-key'

const NO_PENDING_INTENTS: MealPlanStore['pendingIntents'] = {}

const diaryMeal = (overrides: Partial<Meal> = {}): Meal => ({
  id: 'diary-lunch',
  name: 'Lunch',
  sortOrder: 2,
  entries: [],
  totals: createEmptyMacroTotals(),
  ...overrides
})

const diaryDay = (): Meal[] => [
  diaryMeal({id: 'diary-dinner', name: 'Dinner', sortOrder: 3}),
  diaryMeal({id: 'diary-breakfast', name: 'Breakfast', sortOrder: 1}),
  diaryMeal({id: 'diary-lunch', name: 'Lunch', sortOrder: 2})
]

// A day whose rows were all renamed, so no row carries a canonical slot name and every slot has to fall back.
const renamedDiaryDay = (): Meal[] => [
  diaryMeal({id: 'diary-supper', name: 'Supper', sortOrder: 3}),
  diaryMeal({id: 'diary-brunch', name: 'Brunch', sortOrder: 1}),
  diaryMeal({id: 'diary-nibbles', name: 'Nibbles', sortOrder: 2})
]

const PLAN_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner']

const apiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const attemptInputs = (
  overrides: Partial<Parameters<typeof planLogAttempt>[0]> = {}
): Parameters<typeof planLogAttempt>[0] => ({
  planId: PLAN_ID,
  mealId: MEAL_ID,
  servings: 1,
  diaryDate: PLANNED_DATE,
  diaryMealId: 'diary-lunch',
  planRevision: 4,
  userId: USER_ID,
  pendingIntents: NO_PENDING_INTENTS,
  attemptedAt: ATTEMPTED_AT,
  freshKey: FRESH_KEY,
  ...overrides
})

// An intent recorded for one request, the way the screen records it before the request leaves: the fingerprint
// is derived from the snapshot, so only a byte-identical request can replay this key.
const pendingLogIntent = (
  overrides: Partial<Parameters<typeof buildPlannedLogRequest>[0]> = {}
): Partial<Record<'log', PendingIntent>> => ({
  log: buildPendingIntent(
    buildPlannedLogRequest({
      planId: PLAN_ID,
      mealId: MEAL_ID,
      servings: 1,
      date: PLANNED_DATE,
      diaryMealId: 'diary-lunch',
      planRevision: 4,
      ...overrides
    }),
    STORED_KEY,
    USER_ID,
    ATTEMPTED_AT
  )
})

describe('resolveLogCacheScope', () => {
  it('keeps the plan day on the route and scopes the diary day to the selection', () => {
    expect(resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: PLANNED_DATE})).toEqual({
      planId: PLAN_ID,
      plannedDate: PLANNED_DATE,
      diaryDate: PLANNED_DATE
    })
  })

  it('moves the diary day, and only the diary day, when the date is stepped', () => {
    const scope = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})

    // The diary day is the day the entry is written to, so it is the day whose cache the log mutation has to
    // invalidate (0.7.2). Scoping that write to the route's planned day is the bug this asserts against.
    expect(scope.diaryDate).toBe(STEPPED_DATE)
    expect(scope.diaryDate).not.toBe(scope.plannedDate)
    expect(scope.plannedDate).toBe(PLANNED_DATE)
  })

  it('sends the write to the selected day, so the invalidated day is the day written', () => {
    const scope = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})
    const attempt = planLogAttempt(attemptInputs({diaryDate: scope.diaryDate}))

    expect(attempt.payload.date).toBe(scope.diaryDate)
    expect(attempt.payload.date).not.toBe(PLANNED_DATE)
  })
})

describe('logMutationScope', () => {
  it('constructs the write on the selected day, which is the day whose diary cache it invalidates', () => {
    const scope = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})
    const attempt = planLogAttempt(attemptInputs({diaryDate: scope.diaryDate}))
    const [planId, invalidatedDate] = logMutationScope(scope)

    // The mutation hook invalidates `dailyMacros(date)` for this date (0.7.2). Handing it the route's planned
    // day is the defect: the entry would land on Thursday while Tuesday's Diary was the one dropped.
    expect(planId).toBe(PLAN_ID)
    expect(invalidatedDate).toBe(STEPPED_DATE)
    expect(invalidatedDate).toBe(attempt.payload.date)
    expect(invalidatedDate).not.toBe(PLANNED_DATE)
  })

  it('follows the stepper, unlike the plan-day read', () => {
    const opened = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: PLANNED_DATE})
    const stepped = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})

    expect(logMutationScope(opened)).toEqual([PLAN_ID, PLANNED_DATE])
    expect(logMutationScope(stepped)).toEqual([PLAN_ID, STEPPED_DATE])
    expect(planDayQueryScope(stepped)).toEqual([PLAN_ID, PLANNED_DATE])
  })
})

describe('planDayQueryScope', () => {
  it('reads the planned day the route named, whatever the stepper has selected', () => {
    const stepped = resolveLogCacheScope({planId: PLAN_ID, plannedDate: PLANNED_DATE, selectedDate: STEPPED_DATE})

    // The meal is a fact about its planned day: following the stepper here would ask the plan for a day the
    // meal does not belong to.
    expect(planDayQueryScope(stepped)).toEqual([PLAN_ID, PLANNED_DATE])
  })
})

describe('nextLogDate', () => {
  it('steps one day in either direction inside the plan week', () => {
    expect(nextLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: PLAN_RANGE})).toBe('2026-03-04')
    expect(nextLogDate({selectedDate: PLANNED_DATE, direction: -1, planRange: PLAN_RANGE})).toBe('2026-03-02')
  })

  it('clamps at the plan week and holds still until the range is known', () => {
    expect(nextLogDate({selectedDate: PLAN_RANGE.endDate, direction: 1, planRange: PLAN_RANGE})).toBe(
      PLAN_RANGE.endDate
    )
    expect(nextLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: null})).toBe(PLANNED_DATE)
  })
})

describe('canChangeLogDate', () => {
  it('allows a step inside the plan week', () => {
    expect(
      canChangeLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: PLAN_RANGE, isCommitPending: false})
    ).toBe(true)
    expect(
      canChangeLogDate({selectedDate: PLANNED_DATE, direction: -1, planRange: PLAN_RANGE, isCommitPending: false})
    ).toBe(true)
  })

  it('refuses a step beyond either end of the plan week, and before the range is known', () => {
    expect(
      canChangeLogDate({
        selectedDate: PLAN_RANGE.startDate,
        direction: -1,
        planRange: PLAN_RANGE,
        isCommitPending: false
      })
    ).toBe(false)
    expect(
      canChangeLogDate({selectedDate: PLAN_RANGE.endDate, direction: 1, planRange: PLAN_RANGE, isCommitPending: false})
    ).toBe(false)
    expect(canChangeLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: null, isCommitPending: false})).toBe(
      false
    )
  })

  it('refuses every step while a commit is in flight, wherever the date sits', () => {
    // The selected date is the write's cache scope, so moving it mid-commit would leave the request writing
    // one day and its invalidation dropping another.
    expect(
      canChangeLogDate({selectedDate: PLANNED_DATE, direction: 1, planRange: PLAN_RANGE, isCommitPending: true})
    ).toBe(false)
    expect(
      canChangeLogDate({selectedDate: PLANNED_DATE, direction: -1, planRange: PLAN_RANGE, isCommitPending: true})
    ).toBe(false)
  })
})

describe('resolveLogDiaryDestination', () => {
  it('targets the selected day and the bucket whose name matches the slot', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: STEPPED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: null
    })

    expect(destination.target).toEqual({
      diaryDate: STEPPED_DATE,
      diaryMealId: 'diary-lunch',
      bucketLabel: 'Lunch',
      isInferredBucket: false
    })
  })

  it('offers the plan day its own buckets in sort order', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: null
    })

    expect(destination.options.map(option => option.mealId)).toEqual(['diary-breakfast', 'diary-lunch', 'diary-dinner'])
  })

  it('falls back to the first bucket by sort order, and says so, when no name matches the slot', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: renamedDiaryDay(),
      chosenBucketId: null
    })

    expect(destination.target?.diaryMealId).toBe('diary-brunch')
    expect(destination.target?.isInferredBucket).toBe(true)
  })

  it('drops the fallback caption once the user has picked a bucket', () => {
    const destination = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'lunch',
      planSlots: PLAN_SLOTS,
      diaryMeals: renamedDiaryDay(),
      chosenBucketId: 'diary-nibbles'
    })

    expect(destination.target?.diaryMealId).toBe('diary-nibbles')
    expect(destination.target?.isInferredBucket).toBe(false)
  })

  it('never shows the caption for a canonical match, chosen or preselected', () => {
    const preselected = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'dinner',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: null
    })
    const chosen = resolveLogDiaryDestination({
      selectedDate: PLANNED_DATE,
      slot: 'dinner',
      planSlots: PLAN_SLOTS,
      diaryMeals: diaryDay(),
      chosenBucketId: 'diary-breakfast'
    })

    expect(preselected.target?.isInferredBucket).toBe(false)
    expect(chosen.target?.isInferredBucket).toBe(false)
  })

  it('has nothing to target before the meal or the diary day is known', () => {
    expect(
      resolveLogDiaryDestination({
        selectedDate: PLANNED_DATE,
        slot: null,
        planSlots: PLAN_SLOTS,
        diaryMeals: diaryDay(),
        chosenBucketId: null
      })
    ).toEqual({options: [], target: null})
    expect(
      resolveLogDiaryDestination({
        selectedDate: PLANNED_DATE,
        slot: 'lunch',
        planSlots: PLAN_SLOTS,
        diaryMeals: undefined,
        chosenBucketId: null
      })
    ).toEqual({options: [], target: null})
  })

  it('has nothing to target when the selected day carries no buckets at all', () => {
    expect(
      resolveLogDiaryDestination({
        selectedDate: PLANNED_DATE,
        slot: 'lunch',
        planSlots: PLAN_SLOTS,
        diaryMeals: [],
        chosenBucketId: null
      }).target
    ).toBeNull()
  })

  it('has nothing to target when the chosen bucket does not belong to the selected day', () => {
    // Stepping the date clears the chosen bucket for exactly this reason; a stale id must not be logged under
    // another day's label.
    expect(
      resolveLogDiaryDestination({
        selectedDate: STEPPED_DATE,
        slot: 'lunch',
        planSlots: PLAN_SLOTS,
        diaryMeals: diaryDay(),
        chosenBucketId: 'diary-of-another-day'
      }).target
    ).toBeNull()
  })
})

describe('planLogAttempt', () => {
  it('carries a freshly minted key when nothing is pending, and records the intent it was minted for', () => {
    const attempt = planLogAttempt(attemptInputs())

    expect(attempt.isReplay).toBe(false)
    expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    expect(attempt.intent?.key).toBe(FRESH_KEY)
    expect(attempt.intent?.userId).toBe(USER_ID)
    expect(attempt.mealId).toBe(MEAL_ID)
  })

  it('sends the portion, day, bucket and revision the press was made with', () => {
    const attempt = planLogAttempt(
      attemptInputs({servings: 1.5, diaryDate: STEPPED_DATE, diaryMealId: 'diary-dinner', planRevision: 7})
    )

    expect(attempt.payload).toEqual({
      servings: 1.5,
      date: STEPPED_DATE,
      diaryMealId: 'diary-dinner',
      expectedPlanRevision: 7,
      idempotencyKey: FRESH_KEY
    })
  })

  it('replays the stored key when the request still matches the pending intent', () => {
    const attempt = planLogAttempt(attemptInputs({pendingIntents: pendingLogIntent()}))

    expect(attempt.isReplay).toBe(true)
    expect(attempt.payload.idempotencyKey).toBe(STORED_KEY)
    expect(attempt.intent?.key).toBe(STORED_KEY)
  })

  it('mints a fresh key once the portion, the day, the bucket or the revision has moved', () => {
    const moved = [
      attemptInputs({servings: 2, pendingIntents: pendingLogIntent()}),
      attemptInputs({diaryDate: STEPPED_DATE, pendingIntents: pendingLogIntent()}),
      attemptInputs({diaryMealId: 'diary-dinner', pendingIntents: pendingLogIntent()}),
      attemptInputs({planRevision: 5, pendingIntents: pendingLogIntent()})
    ]

    // A key held for a changed body is what the server answers with 409 idempotency_conflict (0.7.2).
    moved.forEach(inputs => {
      const attempt = planLogAttempt(inputs)

      expect(attempt.isReplay).toBe(false)
      expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    })
  })

  it('replays the stored request rather than the fields it was handed', () => {
    const attempt = planLogAttempt({
      ...attemptInputs({pendingIntents: pendingLogIntent()}),
      attemptedAt: ATTEMPTED_AT + 1_000
    })

    expect(attempt.payload.date).toBe(PLANNED_DATE)
    expect(attempt.payload.servings).toBe(1)
    expect(attempt.intent?.fingerprint).toBe(pendingLogIntent().log?.fingerprint)
  })

  it('ignores an intent minted by another account and mints a key of its own', () => {
    const attempt = planLogAttempt(attemptInputs({pendingIntents: pendingLogIntent(), userId: 'user-2'}))

    expect(attempt.isReplay).toBe(false)
    expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    expect(attempt.intent?.userId).toBe('user-2')
  })

  it('sends the attempt but records nothing when no user is signed in', () => {
    const attempt = planLogAttempt(attemptInputs({userId: null, pendingIntents: pendingLogIntent()}))

    expect(attempt.payload.idempotencyKey).toBe(FRESH_KEY)
    expect(attempt.intent).toBeNull()
  })
})

describe('classifyLogFailure', () => {
  it('retires the intent and names the plan on a confirmed plan-state refusal', () => {
    const codes = [API_ERROR_CODES.stalePlan, API_ERROR_CODES.planNotActive]

    codes.forEach(code => {
      expect(classifyLogFailure(apiError(409, code))).toEqual({
        disposition: 'retire',
        toast: MEAL_PLAN_STALE_PLAN_TOAST,
        isUnconfirmed: false
      })
    })
  })

  it('retires the intent with the generic toast on any other confirmed refusal', () => {
    expect(classifyLogFailure(apiError(409, API_ERROR_CODES.idempotencyConflict))).toEqual({
      disposition: 'retire',
      toast: TOAST_GENERIC_ERROR,
      isUnconfirmed: false
    })
    expect(classifyLogFailure(apiError(404, 'Meal not found')).disposition).toBe('retire')
  })

  it('keeps the intent pending and raises no toast on an unknown outcome', () => {
    // The request may have committed before the response was lost, so the key stays the only safe way to ask
    // again and the banner states the outcome in place (0.2.5).
    const unknown: unknown[] = [
      new Error('Network Error'),
      apiError(502),
      apiError(503),
      {response: {status: 500, data: '<html>gateway</html>'}}
    ]

    unknown.forEach(error => {
      expect(classifyLogFailure(error)).toEqual({disposition: 'keep', toast: null, isUnconfirmed: true})
    })
  })
})

describe('planUnconfirmedRefetch', () => {
  it('refetches the plan day and the diary once, and not again', () => {
    const first = planUnconfirmedRefetch({isUnconfirmed: true, hasRefetched: false})
    const second = planUnconfirmedRefetch({isUnconfirmed: true, hasRefetched: true})

    expect(first.refetchPlanDay).toBe(true)
    expect(first.refetchDiary).toBe(true)
    expect(second.refetchPlanDay).toBe(false)
    expect(second.refetchDiary).toBe(false)
  })

  it('refetches nothing until the outcome is unconfirmed', () => {
    expect(planUnconfirmedRefetch({isUnconfirmed: false, hasRefetched: false})).toEqual({
      refetchPlanDay: false,
      refetchDiary: false,
      retiresIntent: false,
      resolvesOutcome: false
    })
  })

  it('is display only: it never resolves the outcome or retires the intent', () => {
    // Only a server answer to the same key resolves a keyed write — a refetch merely lets the screen show an
    // entry this attempt may already have written (0.2.5).
    const cases = [
      {isUnconfirmed: true, hasRefetched: false},
      {isUnconfirmed: true, hasRefetched: true},
      {isUnconfirmed: false, hasRefetched: false}
    ]

    cases.forEach(inputs => {
      const decision = planUnconfirmedRefetch(inputs)

      expect(decision.retiresIntent).toBe(false)
      expect(decision.resolvesOutcome).toBe(false)
    })
  })
})

describe('isPlanStateReadFailure', () => {
  it('recognises a decoded plan-state code on a failed read', () => {
    expect(isPlanStateReadFailure(apiError(409, API_ERROR_CODES.stalePlan))).toBe(true)
    expect(isPlanStateReadFailure(apiError(409, API_ERROR_CODES.planNotActive))).toBe(true)
  })

  it('leaves every other failure, and no failure at all, to the generic card', () => {
    expect(isPlanStateReadFailure(apiError(404, 'Plan day not found'))).toBe(false)
    expect(isPlanStateReadFailure(apiError(502))).toBe(false)
    expect(isPlanStateReadFailure(new Error('Network Error'))).toBe(false)
    expect(isPlanStateReadFailure(null)).toBe(false)
    expect(isPlanStateReadFailure(undefined)).toBe(false)
  })
})

describe('planDayQueryRecovery', () => {
  it('gives a decoded plan-state code its own copy and refetches current-plan state', () => {
    expect(planDayQueryRecovery({error: apiError(409, API_ERROR_CODES.stalePlan), hasAnnounced: false})).toEqual({
      toast: MEAL_PLAN_STALE_PLAN_TOAST,
      refetchCurrentPlan: true,
      isPlanStateFailure: true
    })
    expect(planDayQueryRecovery({error: apiError(409, API_ERROR_CODES.planNotActive), hasAnnounced: false})).toEqual({
      toast: MEAL_PLAN_STALE_PLAN_TOAST,
      refetchCurrentPlan: true,
      isPlanStateFailure: true
    })
  })

  it('states it once: an already-announced failure raises no second toast and no second refetch', () => {
    // The day query's identity changes with every date step, so the classification runs again on a failure the
    // user has already been told about.
    expect(planDayQueryRecovery({error: apiError(409, API_ERROR_CODES.stalePlan), hasAnnounced: true})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: true
    })
  })

  it('leaves a network or undecodable failure to the inline card, with or without the guard', () => {
    const generic: unknown[] = [
      new Error('Network Error'),
      apiError(502),
      {response: {status: 500, data: '<html>gateway</html>'}},
      apiError(404, 'Plan day not found')
    ]

    generic.forEach(error => {
      expect(planDayQueryRecovery({error, hasAnnounced: false})).toEqual({
        toast: null,
        refetchCurrentPlan: false,
        isPlanStateFailure: false
      })
    })
  })

  it('does nothing at all while the read is healthy', () => {
    expect(planDayQueryRecovery({error: null, hasAnnounced: true})).toEqual({
      toast: null,
      refetchCurrentPlan: false,
      isPlanStateFailure: false
    })
  })
})
