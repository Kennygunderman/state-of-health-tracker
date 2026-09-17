import {MacroTotals} from '@data/models/Macros'
import {CurrentMealPlans, MealPlan, MealPlanDay, MealPlanDayEnvelope} from '@data/models/MealPlan'
import {fetchMealPlanDay} from '@queries/api/mealPlanning/fetchMealPlanDay'
import {queryKeys} from '@queries/keys'
import {DefaultError, QueryClient} from '@tanstack/react-query'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {isWriteAllowedByVerdict, resolveEnvelopeWriteability} from '@utility/MealPlanLifecycleUtility'

import {buildMealPlanDayQueryOptions, selectSeededMealPlanDay} from '../useMealPlanDayQuery.util'

// Replaced by a factory rather than jest's automock, which would still evaluate the real module and pull in
// the native Firebase auth chain behind httpUtil; the mock only records the arguments the request is checked
// against. Every QueryClient below is real, because the seed is read out of a real cache entry.
jest.mock('@queries/api/mealPlanning/fetchMealPlanDay', () => ({
  fetchMealPlanDay: jest.fn()
}))

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const DATE = '2026-07-06'
const OTHER_DATE = '2026-07-09'
const PLAN_END_DATE = '2026-07-12'

// No case injects a calendar day, because the seed does not take one: writeability is a server verdict and
// the seed reports it as unknown. PLAN_END_DATE above is the fixture week's last day.

const makeTotals = (): MacroTotals => ({calories: 2100, protein: 160, carbs: 205, fat: 70})

const makeDay = (overrides: Partial<MealPlanDay> = {}): MealPlanDay => ({
  id: 'day-1',
  date: DATE,
  dayIndex: 0,
  plannedTotals: makeTotals(),
  isLastDay: false,
  meals: [],
  ...overrides
})

const makePlan = (overrides: Partial<MealPlan> = {}): MealPlan => ({
  id: PLAN_ID,
  revision: 4,
  generationAttempt: 1,
  generationKey: 'gen-key-1',
  startDate: DATE,
  endDate: PLAN_END_DATE,
  status: 'active',
  targets: makeTotals(),
  generationTargets: makeTotals(),
  targetsStale: false,
  preferencesRevision: 2,
  targetsRevision: 3,
  hasIncompatibilities: false,
  summary: {plannedMeals: 21, groceryItemCount: 34, loggedEntryCount: 2},
  days: [makeDay()],
  ...overrides
})

const makePlans = (overrides: Partial<CurrentMealPlans> = {}): CurrentMealPlans => ({
  current: makePlan(),
  upcoming: null,
  ...overrides
})

type MealPlanDayOptions = ReturnType<typeof buildMealPlanDayQueryOptions>

// Narrowed because each of the three is declared optional and may be a plain value or a skip token; the
// factory always supplies a function, which the assertions below check before calling.
const requestOf = (options: MealPlanDayOptions): (() => Promise<MealPlanDayEnvelope>) =>
  options.queryFn as () => Promise<MealPlanDayEnvelope>

const seedOf = (options: MealPlanDayOptions): (() => MealPlanDayEnvelope | undefined) =>
  options.initialData as () => MealPlanDayEnvelope | undefined

const seedStampOf = (options: MealPlanDayOptions): (() => number | undefined) =>
  options.initialDataUpdatedAt as () => number | undefined

describe('selectSeededMealPlanDay', () => {
  describe('when the cached current-plan entry cannot answer the request', () => {
    it('returns undefined when nothing is cached under mealPlanCurrent', () => {
      expect(selectSeededMealPlanDay(undefined, PLAN_ID, DATE)).toBeUndefined()
    })

    it('returns undefined when neither cached plan is the requested one', () => {
      const plans = makePlans({current: makePlan({id: OTHER_PLAN_ID})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toBeUndefined()
    })

    it('returns undefined when the requested date falls outside the matched plan\u2019s days', () => {
      const plans = makePlans()

      expect(selectSeededMealPlanDay(plans, PLAN_ID, OTHER_DATE)).toBeUndefined()
    })

    it('returns undefined for the no-plan answer, where both members are null', () => {
      const plans = makePlans({current: null, upcoming: null})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toBeUndefined()
    })
  })

  describe('when a cached plan holds the requested day', () => {
    it('seeds the envelope from the current plan with that plan\u2019s own id, revision and status', () => {
      const day = makeDay({id: 'day-3', date: DATE, dayIndex: 2})
      const plans = makePlans({
        current: makePlan({revision: 7, status: 'superseded', days: [makeDay({id: 'day-1', date: OTHER_DATE}), day]})
      })

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 7,
        planStatus: 'superseded',
        // Carried as unknown even here, where the stored status alone looks conclusive: the seed reports no
        // verdict at all rather than the subset of verdicts it could guess at.
        planLifecycle: null,
        isWritable: null,
        day
      })
    })

    it('carries the cached day object through untouched', () => {
      const day = makeDay()
      const plans = makePlans({current: makePlan({days: [day]})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)?.day).toBe(day)
    })

    it('seeds from the upcoming plan when no current plan exists', () => {
      const day = makeDay({id: 'upcoming-day-1'})
      const plans = makePlans({current: null, upcoming: makePlan({revision: 1, days: [day]})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 1,
        planStatus: 'active',
        planLifecycle: null,
        isWritable: null,
        day
      })
    })

    it('seeds from the upcoming plan when the current plan is a different one', () => {
      const day = makeDay({id: 'upcoming-day-1'})
      const plans = makePlans({
        current: makePlan({id: OTHER_PLAN_ID, revision: 9}),
        upcoming: makePlan({revision: 2, days: [day]})
      })

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 2,
        planStatus: 'active',
        planLifecycle: null,
        isWritable: null,
        day
      })
    })
  })

  /**
   * The seed CANNOT state writeability, so it states that it does not know.
   *
   * Whether a week has ended is judged against the calendar day of the user's saved IANA zone, and nothing in
   * `mealPlanCurrent` carries that zone. The device's own day is not a stand-in for it — after travel the two
   * disagree — and the cached status is not one either, because `mealPlanCurrent` is persisted and a week
   * whose last day passed overnight is still in the cache the next morning reading `status: 'active'`. An
   * affirmative seed would therefore offer a Swap and a Log that the server refuses with
   * `409 plan_not_active {reason: 'ended'}`, which is the defect the verdict exists to close.
   */
  describe('writeability of the seeded envelope', () => {
    it('reports an unknown verdict for a live week', () => {
      const plans = makePlans()

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toMatchObject({
        planStatus: 'active',
        planLifecycle: null,
        isWritable: null
      })
    })

    it('reports an unknown verdict for a replaced plan too, rather than guessing from the status', () => {
      const plans = makePlans({current: makePlan({status: 'superseded'})})

      expect(selectSeededMealPlanDay(plans, PLAN_ID, DATE)).toMatchObject({
        planStatus: 'superseded',
        planLifecycle: null,
        isWritable: null
      })
    })

    it('never reports a writable verdict, whatever the cached week says', () => {
      // Unconditional, because the seed takes nothing that could make it affirmative.
      const cases: MealPlan[] = [
        makePlan(),
        makePlan({status: 'superseded'}),
        makePlan({endDate: '2020-01-01'}),
        makePlan({endDate: '2099-12-31'})
      ]

      cases.forEach(plan => {
        const seeded = selectSeededMealPlanDay(makePlans({current: plan}), PLAN_ID, DATE)

        expect(seeded?.isWritable).toBeNull()
        expect(isWriteAllowedByVerdict(seeded?.isWritable)).toBe(false)
      })
    })

    /**
     * The regression for the zone the verdict must be judged in.
     *
     * At 2026-06-15T02:00Z a device in America/New_York reads 2026-06-14 while the user's saved
     * Pacific/Auckland zone reads 2026-06-15. For a plan whose last day is the device's own day, the device
     * would call the week live and the saved zone calls it finished — and the saved zone is the one every
     * writer judges in. The seed must therefore be read-only before the day response arrives, and only the
     * server's verdict may enable writes.
     */
    describe('at an instant the device day and the saved zone disagree about', () => {
      const INSTANT = new Date('2026-06-15T02:00:00.000Z')
      const DAY_KEY_PARTS = {year: 'numeric', month: '2-digit', day: '2-digit'} as const
      const dayKeyIn = (timeZone: string): string =>
        new Intl.DateTimeFormat('en-CA', {timeZone, ...DAY_KEY_PARTS}).format(INSTANT)

      // The plan's last day is whatever day the RUNNER's own zone reads at that instant, so "the device day
      // does not consider this week over" holds wherever these tests execute.
      const deviceDayKey = (): string => {
        jest.useFakeTimers().setSystemTime(INSTANT)

        try {
          return new Intl.DateTimeFormat('en-CA', DAY_KEY_PARTS).format(new Date())
        } finally {
          jest.useRealTimers()
        }
      }

      it('is an instant the two named zones genuinely disagree about', () => {
        expect(dayKeyIn('America/New_York')).toBe('2026-06-14')
        expect(dayKeyIn('Pacific/Auckland')).toBe('2026-06-15')
      })

      it('seeds read-only for a week the device day would still call live', () => {
        const endDate = deviceDayKey()
        const plans = makePlans({current: makePlan({endDate})})

        // The premise: by the device's day this week is not over.
        expect(endDate < deviceDayKey()).toBe(false)

        const seeded = selectSeededMealPlanDay(plans, PLAN_ID, DATE)

        expect(seeded?.day).toBeDefined()
        expect(seeded?.planLifecycle).toBeNull()
        expect(seeded?.isWritable).toBeNull()
        expect(isWriteAllowedByVerdict(seeded?.isWritable)).toBe(false)
      })

      it('only the server verdict enables the write, and in the saved zone that week has ended', () => {
        // What GET .../days/:date answers for this plan at this instant, judged in Pacific/Auckland.
        expect(isWriteAllowedByVerdict(resolveEnvelopeWriteability('ended', false).isWritable)).toBe(false)
        // And the same route on a week the saved zone still considers live is what opens them.
        expect(isWriteAllowedByVerdict(resolveEnvelopeWriteability('active', true).isWritable)).toBe(true)
      })
    })
  })
})

describe('buildMealPlanDayQueryOptions', () => {
  let queryClient: QueryClient

  const seedCurrentPlans = (plans: CurrentMealPlans): void => {
    queryClient.setQueryData(queryKeys.mealPlanCurrent, plans)
  }

  const buildOptions = (planId = PLAN_ID, date = DATE, enabled = true): MealPlanDayOptions =>
    buildMealPlanDayQueryOptions(queryClient, planId, date, enabled)

  // Narrowed because `retry` is declared as a union of a count, a boolean and this predicate; the factory
  // always supplies the predicate.
  const retryOf = (options: MealPlanDayOptions): ((failureCount: number, error: DefaultError) => boolean) =>
    options.retry as (failureCount: number, error: DefaultError) => boolean

  const planReadInvalidated = (code: string): DefaultError =>
    ({isAxiosError: true, response: {status: 409, data: {error: code}}}) as unknown as DefaultError

  // A 404 the server explained: `isResourceNotFoundError` reads the body's code, so a bare 404 with nothing
  // in it stays a retryable unknown rather than a disowned resource.
  const notFound = (): DefaultError =>
    ({isAxiosError: true, response: {status: 404, data: {error: 'Plan not found'}}}) as unknown as DefaultError

  beforeEach(() => {
    jest.mocked(fetchMealPlanDay).mockClear()
    // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
    // otherwise hold the Node event loop open long after the assertions are done.
    queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
  })

  describe('the returned options', () => {
    it('keys the day through queryKeys.mealPlanDay, never a literal of the same shape', () => {
      expect(buildOptions().queryKey).toStrictEqual(queryKeys.mealPlanDay(PLAN_ID, DATE))
    })

    it('gives each plan and each date its own identity, so both inputs reach the key', () => {
      expect(buildOptions().queryKey).not.toStrictEqual(queryKeys.mealPlanDay(OTHER_PLAN_ID, DATE))
      expect(buildOptions().queryKey).not.toStrictEqual(queryKeys.mealPlanDay(PLAN_ID, OTHER_DATE))
      expect(buildOptions(OTHER_PLAN_ID, OTHER_DATE).queryKey).toStrictEqual(
        queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE)
      )
    })

    it('passes enabled through as given, so the caller decides whether the gated request may run', () => {
      expect(buildOptions(PLAN_ID, DATE, true).enabled).toBe(true)
      expect(buildOptions(PLAN_ID, DATE, false).enabled).toBe(false)
    })

    it('requests the day through fetchMealPlanDay with the plan id and date, in that order and nothing else', async () => {
      await requestOf(buildOptions())()

      expect(fetchMealPlanDay).toHaveBeenCalledTimes(1)
      expect(jest.mocked(fetchMealPlanDay).mock.calls[0]).toStrictEqual([PLAN_ID, DATE])
    })

    it('declares nothing beyond the key, the request, the gate, the seed pair and the retry rule', () => {
      expect(Object.keys(buildOptions()).sort()).toStrictEqual([
        'enabled',
        'initialData',
        'initialDataUpdatedAt',
        'queryFn',
        'queryKey',
        'retry'
      ])
    })

    /**
     * The retry rule belongs to these options rather than to the hook, because the hook now declares nothing of
     * its own: a read whose answer disowns the plan earns a current-plan refetch, not another read of this day.
     */
    it('retries a lost or unexplained answer exactly once', () => {
      const retry = retryOf(buildOptions())

      expect(retry(0, new Error('Network Error'))).toBe(true)
      expect(retry(1, new Error('Network Error'))).toBe(false)
    })

    it('never retries an answer that disowns the plan, however few attempts have been made', () => {
      const retry = retryOf(buildOptions())

      // A replaced or ended plan and a resource 404 return the same refusal however many times they are asked.
      expect(retry(0, planReadInvalidated(API_ERROR_CODES.stalePlan))).toBe(false)
      expect(retry(0, planReadInvalidated(API_ERROR_CODES.planNotActive))).toBe(false)
      expect(retry(0, notFound())).toBe(false)
    })

    it('still retries a 404 the server did not explain, which is an unknown outcome rather than a refusal', () => {
      const bareNotFound = {isAxiosError: true, response: {status: 404, data: {}}} as unknown as DefaultError

      expect(retryOf(buildOptions())(0, bareNotFound)).toBe(true)
    })

    it('keeps the seed and its timestamp as functions, so both re-read the live cache per render', () => {
      const options = buildOptions()

      expect(typeof options.initialData).toBe('function')
      expect(typeof options.initialDataUpdatedAt).toBe('function')
    })
  })

  describe('the seed read out of the cached current-plan entry', () => {
    it('finds no seed when nothing is cached under mealPlanCurrent', () => {
      expect(seedOf(buildOptions())()).toBeUndefined()
    })

    it('finds no seed when the cached entry holds a different plan', () => {
      seedCurrentPlans(makePlans({current: makePlan({id: OTHER_PLAN_ID})}))

      expect(seedOf(buildOptions())()).toBeUndefined()
    })

    it('finds no seed when the requested date falls outside the cached plan\u2019s days', () => {
      seedCurrentPlans(makePlans())

      expect(seedOf(buildOptions(PLAN_ID, OTHER_DATE))()).toBeUndefined()
    })

    it('seeds the day envelope with the cached plan\u2019s own revision and status', () => {
      const day = makeDay({id: 'day-3', dayIndex: 2})

      seedCurrentPlans(makePlans({current: makePlan({revision: 11, status: 'superseded', days: [day]})}))

      expect(seedOf(buildOptions())()).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 11,
        planStatus: 'superseded',
        planLifecycle: null,
        isWritable: null,
        day
      })
    })

    it('seeds from the upcoming plan too, because next week is a legitimate target', () => {
      const day = makeDay({id: 'upcoming-day-1'})

      seedCurrentPlans(makePlans({current: null, upcoming: makePlan({revision: 2, days: [day]})}))

      expect(seedOf(buildOptions())()).toStrictEqual({
        planId: PLAN_ID,
        planRevision: 2,
        planStatus: 'active',
        planLifecycle: null,
        isWritable: null,
        day
      })
    })

    it('picks up a seed that arrives after the options were built, which is why it is a function', () => {
      const seed = seedOf(buildOptions())

      expect(seed()).toBeUndefined()

      seedCurrentPlans(makePlans())

      expect(seed()?.day).toStrictEqual(makeDay())
    })
  })

  describe('the seed timestamp', () => {
    it('reports the source entry\u2019s own dataUpdatedAt, so the normal staleTime still decides the refetch', () => {
      seedCurrentPlans(makePlans())

      const sourceUpdatedAt = queryClient.getQueryState(queryKeys.mealPlanCurrent)?.dataUpdatedAt

      expect(typeof sourceUpdatedAt).toBe('number')
      expect(seedStampOf(buildOptions())()).toBe(sourceUpdatedAt)
    })

    it('reports no timestamp when there is no source entry, matching the absent seed', () => {
      const options = buildOptions()

      expect(seedStampOf(options)()).toBeUndefined()
      expect(seedOf(options)()).toBeUndefined()
    })

    it('follows the source entry when it is written again, rather than freezing at build time', () => {
      seedCurrentPlans(makePlans())

      const stamp = seedStampOf(buildOptions())
      const firstUpdatedAt = stamp()

      jest.spyOn(Date, 'now').mockReturnValue((firstUpdatedAt ?? 0) + 60_000)
      seedCurrentPlans(makePlans({current: makePlan({revision: 12})}))

      const secondUpdatedAt = queryClient.getQueryState(queryKeys.mealPlanCurrent)?.dataUpdatedAt

      expect(secondUpdatedAt).toBe((firstUpdatedAt ?? 0) + 60_000)
      expect(stamp()).toBe(secondUpdatedAt)

      jest.restoreAllMocks()
    })
  })
})
