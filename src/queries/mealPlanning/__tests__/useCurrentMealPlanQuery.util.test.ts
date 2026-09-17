import {MacroTotals} from '@data/models/Macros'
import {CurrentMealPlans, MealPlan} from '@data/models/MealPlan'
import {fetchCurrentMealPlan} from '@queries/api/mealPlanning/fetchCurrentMealPlan'
import {queryKeys} from '@queries/keys'
import {QueryClient, QueryKey} from '@tanstack/react-query'

import {
  answerDayKeyFromUpdatedAt,
  applyCurrentMealPlanRollover,
  buildCurrentMealPlanQueryOptions,
  isAnswerBeforeSessionDay,
  shouldInvalidateForSessionDayChange,
  shouldRefetchCurrentMealPlan
} from '../useCurrentMealPlanQuery.util'

// Replaced by a factory rather than jest's automock, which would still evaluate the real module and pull in
// the native Firebase auth chain behind httpUtil; the mock only records that the query function was reached
// and with what. The injected QueryClient below stays real.
jest.mock('@queries/api/mealPlanning/fetchCurrentMealPlan', () => ({
  fetchCurrentMealPlan: jest.fn()
}))

const YESTERDAY = '2026-07-05'
const TODAY = '2026-07-06'

// Built from local parts, as day keys are: a fixed epoch value would name a different day in each zone the
// suite runs in, and Date.now() would make these cases drift into the next day at midnight.
const FETCHED_YESTERDAY_LATE = new Date(2026, 6, 5, 23, 58, 30).getTime()
const FETCHED_TODAY_EARLY = new Date(2026, 6, 6, 0, 1, 15).getTime()
const NEVER_FETCHED = 0

const PLAN_ID = 'plan-1'
const PLAN_END_DATE = '2026-07-11'

type CurrentMealPlanOptions = ReturnType<typeof buildCurrentMealPlanQueryOptions>

// Narrowed because queryFn is declared optional and may be a skip token; the factory always supplies it.
const requestOf = (options: CurrentMealPlanOptions): (() => Promise<CurrentMealPlans>) =>
  options.queryFn as () => Promise<CurrentMealPlans>

const makeTotals = (): MacroTotals => ({calories: 2100, protein: 160, carbs: 205, fat: 70})

const makePlan = (): MealPlan => ({
  id: PLAN_ID,
  revision: 4,
  // The key the generation that produced this plan was sent under: a required model field, because it is what
  // lets a client recognise its own committed generation after a lost response.
  generationKey: 'idem-generate-current',
  generationAttempt: 1,
  startDate: TODAY,
  endDate: PLAN_END_DATE,
  status: 'active',
  targets: makeTotals(),
  generationTargets: makeTotals(),
  targetsStale: false,
  preferencesRevision: 2,
  targetsRevision: 3,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 34, loggedEntryCount: 2},
  days: [{id: 'day-1', date: TODAY, dayIndex: 0, plannedTotals: makeTotals(), isLastDay: false, meals: []}]
})

const makePlans = (): CurrentMealPlans => ({current: makePlan(), upcoming: null})

const isQueryInvalidated = (client: QueryClient, queryKey: QueryKey): boolean | undefined =>
  client.getQueryState(queryKey)?.isInvalidated

let queryClient: QueryClient

beforeEach(() => {
  jest.mocked(fetchCurrentMealPlan).mockClear()
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('shouldInvalidateForSessionDayChange', () => {
  it('invalidates when the session crosses into a new day, which is what promotes an upcoming plan', () => {
    expect(shouldInvalidateForSessionDayChange(YESTERDAY, TODAY)).toBe(true)
  })

  it('invalidates when the day key moves backwards, because the current plan still has to be re-resolved', () => {
    expect(shouldInvalidateForSessionDayChange(TODAY, YESTERDAY)).toBe(true)
  })

  it('does not invalidate while the day key is unchanged, so a re-render never refetches', () => {
    expect(shouldInvalidateForSessionDayChange(TODAY, TODAY)).toBe(false)
  })

  it('does not invalidate on the first key a caller supplies, which the query was already fetched against', () => {
    expect(shouldInvalidateForSessionDayChange(undefined, TODAY)).toBe(false)
  })

  it('does not invalidate when a caller stops supplying a key, since no rollover has been observed', () => {
    expect(shouldInvalidateForSessionDayChange(TODAY, undefined)).toBe(false)
  })

  it('does not invalidate for a caller that never supplies a key, so the mount stays request-free', () => {
    expect(shouldInvalidateForSessionDayChange(undefined, undefined)).toBe(false)
  })
})

describe('answerDayKeyFromUpdatedAt', () => {
  it('reads the day a pre-midnight answer was fetched on, which is the day it describes', () => {
    expect(answerDayKeyFromUpdatedAt(FETCHED_YESTERDAY_LATE)).toBe(YESTERDAY)
  })

  it('reads the day a post-midnight answer was fetched on', () => {
    expect(answerDayKeyFromUpdatedAt(FETCHED_TODAY_EARLY)).toBe(TODAY)
  })

  it('reports no day for an entry that has never resolved, which TanStack timestamps as 0', () => {
    expect(answerDayKeyFromUpdatedAt(NEVER_FETCHED)).toBeUndefined()
  })

  it('reports no day when there is no cache entry at all', () => {
    expect(answerDayKeyFromUpdatedAt(undefined)).toBeUndefined()
  })
})

describe('isAnswerBeforeSessionDay', () => {
  it('is true for an answer fetched before the session day, which is what a rollover leaves behind', () => {
    expect(isAnswerBeforeSessionDay(YESTERDAY, TODAY)).toBe(true)
  })

  it('is false for an answer fetched on the session day', () => {
    expect(isAnswerBeforeSessionDay(TODAY, TODAY)).toBe(false)
  })

  it('is false for an answer newer than the session day, so the comparison stays monotone', () => {
    expect(isAnswerBeforeSessionDay(TODAY, YESTERDAY)).toBe(false)
  })

  it('is false when either side is unknown, so an unfetched or unkeyed read decides nothing', () => {
    expect(isAnswerBeforeSessionDay(undefined, TODAY)).toBe(false)
    expect(isAnswerBeforeSessionDay(YESTERDAY, undefined)).toBe(false)
    expect(isAnswerBeforeSessionDay(undefined, undefined)).toBe(false)
  })
})

describe('shouldRefetchCurrentMealPlan', () => {
  it('refetches on a remount after midnight, where the fresh ref has no rollover to observe', () => {
    expect(shouldRefetchCurrentMealPlan({previousDayKey: TODAY, sessionDayKey: TODAY, answerDayKey: YESTERDAY})).toBe(
      true
    )
  })

  it('refetches on a persisted cold start after midnight, judged from the restored fetch timestamp', () => {
    expect(
      shouldRefetchCurrentMealPlan({
        previousDayKey: TODAY,
        sessionDayKey: TODAY,
        answerDayKey: answerDayKeyFromUpdatedAt(FETCHED_YESTERDAY_LATE)
      })
    ).toBe(true)
  })

  it('does not refetch on a same-day remount, so a tab switch never re-requests the plan', () => {
    expect(shouldRefetchCurrentMealPlan({previousDayKey: TODAY, sessionDayKey: TODAY, answerDayKey: TODAY})).toBe(false)
  })

  it('still refetches when the session day moves while mounted, which is what promotes an upcoming plan', () => {
    expect(
      shouldRefetchCurrentMealPlan({previousDayKey: YESTERDAY, sessionDayKey: TODAY, answerDayKey: YESTERDAY})
    ).toBe(true)
  })

  it('does not refetch when there is no cached answer, so a first mount stays request-free', () => {
    expect(shouldRefetchCurrentMealPlan({previousDayKey: TODAY, sessionDayKey: TODAY, answerDayKey: undefined})).toBe(
      false
    )
    expect(
      shouldRefetchCurrentMealPlan({
        previousDayKey: TODAY,
        sessionDayKey: TODAY,
        answerDayKey: answerDayKeyFromUpdatedAt(NEVER_FETCHED)
      })
    ).toBe(false)
  })

  it('does not refetch an answer newer than the session day, the case that would otherwise loop forever', () => {
    expect(
      shouldRefetchCurrentMealPlan({
        previousDayKey: YESTERDAY,
        sessionDayKey: YESTERDAY,
        answerDayKey: answerDayKeyFromUpdatedAt(FETCHED_TODAY_EARLY)
      })
    ).toBe(false)
  })
})

describe('buildCurrentMealPlanQueryOptions', () => {
  it('keys the read through queryKeys.mealPlanCurrent itself, never a matching literal', () => {
    // Identity, not equality: this is the persisted read, the entry useMealPlanDayQuery seeds from by exact
    // key and the root every plan mutation invalidates by prefix, so a hand-written twin would not do.
    expect(buildCurrentMealPlanQueryOptions(true).queryKey).toBe(queryKeys.mealPlanCurrent)
  })

  it('passes enabled through as given, so the caller decides whether the gated request may run', () => {
    expect(buildCurrentMealPlanQueryOptions(true).enabled).toBe(true)
    expect(buildCurrentMealPlanQueryOptions(false).enabled).toBe(false)
  })

  it('requests the current plan through fetchCurrentMealPlan and passes it nothing', async () => {
    const options = buildCurrentMealPlanQueryOptions(true)

    expect(options.queryFn).toBe(fetchCurrentMealPlan)

    await requestOf(options)()

    expect(fetchCurrentMealPlan).toHaveBeenCalledTimes(1)
    // The route takes no inputs: which plan is current is the server's answer, not a parameter.
    expect(jest.mocked(fetchCurrentMealPlan).mock.calls[0]).toStrictEqual([])
  })

  it('declares nothing beyond the key, the request and the gate', () => {
    // No initialData here: this entry is the source the day reads seed from, so it has nothing to seed from.
    expect(Object.keys(buildCurrentMealPlanQueryOptions(true)).sort()).toStrictEqual(['enabled', 'queryFn', 'queryKey'])
  })
})

describe('applyCurrentMealPlanRollover', () => {
  const seedPlanAndDayEntries = (client: QueryClient): CurrentMealPlans => {
    const plans = makePlans()

    client.setQueryData(queryKeys.mealPlanCurrent, plans)
    client.setQueryData(queryKeys.mealPlanDay(PLAN_ID, TODAY), {seeded: true})

    return plans
  }

  it('invalidates the current-plan entry when the session day moved while mounted', () => {
    seedPlanAndDayEntries(queryClient)
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    applyCurrentMealPlanRollover(queryClient, true, {
      previousDayKey: YESTERDAY,
      sessionDayKey: TODAY,
      answerDayKey: YESTERDAY
    })

    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({queryKey: queryKeys.mealPlanCurrent})
    expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
  })

  it('invalidates a cached answer fetched on an earlier day, which is the persisted cold start', () => {
    seedPlanAndDayEntries(queryClient)

    applyCurrentMealPlanRollover(queryClient, true, {
      previousDayKey: TODAY,
      sessionDayKey: TODAY,
      answerDayKey: answerDayKeyFromUpdatedAt(FETCHED_YESTERDAY_LATE)
    })

    expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(true)
  })

  it('keeps the stale plan as data, which is what leaves an offline session its read-only week', () => {
    const plans = seedPlanAndDayEntries(queryClient)

    applyCurrentMealPlanRollover(queryClient, true, {
      previousDayKey: YESTERDAY,
      sessionDayKey: TODAY,
      answerDayKey: YESTERDAY
    })

    // Invalidation, not a refetch or a reset: the entry is marked stale and its data survives, so a failing
    // refetch renders the last saved plan rather than the no-plan state.
    expect(queryClient.getQueryData(queryKeys.mealPlanCurrent)).toStrictEqual(plans)
  })

  it('touches only the current-plan key, not the day reads built on it', () => {
    seedPlanAndDayEntries(queryClient)

    applyCurrentMealPlanRollover(queryClient, true, {
      previousDayKey: YESTERDAY,
      sessionDayKey: TODAY,
      answerDayKey: YESTERDAY
    })

    expect(isQueryInvalidated(queryClient, queryKeys.mealPlanDay(PLAN_ID, TODAY))).toBe(false)
  })

  it('invalidates nothing on a same-day remount, so a tab switch never re-requests the plan', () => {
    seedPlanAndDayEntries(queryClient)
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    applyCurrentMealPlanRollover(queryClient, true, {
      previousDayKey: TODAY,
      sessionDayKey: TODAY,
      answerDayKey: TODAY
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(false)
  })

  it('invalidates nothing when there is no cached answer to judge, so a first mount stays request-free', () => {
    seedPlanAndDayEntries(queryClient)
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    applyCurrentMealPlanRollover(queryClient, true, {
      previousDayKey: TODAY,
      sessionDayKey: TODAY,
      answerDayKey: answerDayKeyFromUpdatedAt(NEVER_FETCHED)
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(false)
  })

  it('invalidates nothing while the meal-planning kill switch is off, rollover or not', () => {
    seedPlanAndDayEntries(queryClient)
    const invalidateQueries = jest.spyOn(queryClient, 'invalidateQueries')

    applyCurrentMealPlanRollover(queryClient, false, {
      previousDayKey: YESTERDAY,
      sessionDayKey: TODAY,
      answerDayKey: YESTERDAY
    })

    expect(invalidateQueries).not.toHaveBeenCalled()
    expect(isQueryInvalidated(queryClient, queryKeys.mealPlanCurrent)).toBe(false)
  })
})
