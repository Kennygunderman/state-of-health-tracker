import {MacroTotals} from '@data/models/Macros'
import {CurrentMealPlans, MealPlan, MealPlanDay, MealPlanDayEnvelope} from '@data/models/MealPlan'
import {fetchMealPlanDay} from '@queries/api/mealPlanning/fetchMealPlanDay'
import {queryKeys} from '@queries/keys'
import {DefaultError, focusManager, QueryClient, QueryObserver} from '@tanstack/react-query'
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

// The app's own query staleTime, from `src/queries/queryClient.ts`. Restated rather than imported because that
// module builds the real client and its persister on import; the observer cases below configure a client with
// this value so what they observe is what the app observes, and the defect being fixed only appears inside it.
const STALE_TIME_MS = 60_000

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

// A number rather than a function, unlike the seed beside it: no cache reading can change the answer, because
// a seeded day always still needs the route for the verdict it cannot carry.
const seedStampOf = (options: MealPlanDayOptions): number => options.initialDataUpdatedAt as number

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

    it('keeps the seed a function, so it re-reads the live cache per render', () => {
      expect(typeof buildOptions().initialData).toBe('function')
    })

    it('keeps the stamp a plain value, because no cache reading can change what it says', () => {
      expect(typeof buildOptions().initialDataUpdatedAt).toBe('number')
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

  /**
   * The stamp is the whole of the fix for a seeded day that offered neither Swap nor Log: the seed carries the
   * cached week's content but reports writeability as unknown, and only `GET .../days/:date` can replace that.
   * Stamping the seed with its source entry's own `dataUpdatedAt` — which is what this read used to do — made a
   * week cached inside the app-wide 60s staleTime mount as already fresh, so the route was never asked and the
   * verdict stayed unknown for the whole visit.
   */
  describe('the seed timestamp', () => {
    it('stamps the seed as having no age at all, so the entry is stale the moment it is created', () => {
      seedCurrentPlans(makePlans())

      expect(seedStampOf(buildOptions())).toBe(0)
    })

    it('says the same thing with no source entry, where there is no seed to be fresh or stale', () => {
      expect(seedStampOf(buildOptions())).toBe(0)
      expect(seedOf(buildOptions())()).toBeUndefined()
    })

    it('ignores how recently the source entry was written, which was never the question', () => {
      seedCurrentPlans(makePlans())

      const sourceUpdatedAt = queryClient.getQueryState(queryKeys.mealPlanCurrent)?.dataUpdatedAt

      // The premise of the defect: the source really is fresh by the app's own staleTime.
      expect(typeof sourceUpdatedAt).toBe('number')
      expect(Date.now() - (sourceUpdatedAt ?? 0)).toBeLessThan(STALE_TIME_MS)

      // And the stamp still reports an incomplete entry, because a recently read week is not a verdict.
      expect(seedStampOf(buildOptions())).toBe(0)
      expect(seedStampOf(buildOptions())).not.toBe(sourceUpdatedAt)
    })

    it('stays zero when the source entry is written again, so a fresh week does not re-suppress the read', () => {
      seedCurrentPlans(makePlans())
      seedCurrentPlans(makePlans({current: makePlan({revision: 12})}))

      expect(seedStampOf(buildOptions())).toBe(0)
    })
  })
})

/**
 * What a real observer does with these options, against a client configured like the app's.
 *
 * The factory's shape is assertable on its own, but the behaviour these findings are about is not: "renders the
 * cached day and still asks the route" and "asks again for the day a chip tap selects" are decisions TanStack
 * makes from the stamp, the staleTime and the key, and the only way to pin them without a renderer is to drive
 * the observer that makes them. The requests are counted rather than described, so a regression that
 * reintroduces the suppressed read fails here rather than on a device.
 */
describe('the seeded day read under a real observer', () => {
  let queryClient: QueryClient

  const ROUTE_ENVELOPE: MealPlanDayEnvelope = {
    planId: PLAN_ID,
    planRevision: 4,
    planStatus: 'active',
    // What only `GET .../days/:date` can answer, and the whole reason the read has to happen.
    planLifecycle: 'active',
    isWritable: true,
    day: makeDay({meals: []})
  }

  const buildOptions = (planId = PLAN_ID, date = DATE, enabled = true): MealPlanDayOptions =>
    buildMealPlanDayQueryOptions(queryClient, planId, date, enabled)

  const mount = (options: MealPlanDayOptions): QueryObserver<MealPlanDayEnvelope> => {
    const observer = new QueryObserver(queryClient, options)

    observer.subscribe(() => undefined)
    observers.push(observer)

    return observer
  }

  let observers: QueryObserver<MealPlanDayEnvelope>[] = []

  const settle = async (): Promise<void> => {
    await Promise.resolve()
    await Promise.resolve()
  }

  const requestCount = (): number => jest.mocked(fetchMealPlanDay).mock.calls.length

  beforeEach(() => {
    jest.mocked(fetchMealPlanDay).mockReset()
    jest.mocked(fetchMealPlanDay).mockResolvedValue(ROUTE_ENVELOPE)
    observers = []
    // staleTime is the app's, and retry is off so a case asserts one request rather than one plus its retries.
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false, gcTime: Infinity, staleTime: STALE_TIME_MS}}
    })
    // The premise of both findings: the week is already cached, and cached recently enough to be fresh.
    queryClient.setQueryData(queryKeys.mealPlanCurrent, makePlans())
  })

  afterEach(() => {
    observers.forEach(observer => observer.destroy())
    queryClient.clear()
  })

  it('renders the cached day straight away, with no request having answered yet', () => {
    const result = mount(buildOptions()).getCurrentResult()

    expect(result.status).toBe('success')
    expect(result.data?.day).toStrictEqual(makeDay())
    expect(result.isPending).toBe(false)
  })

  it('asks the day route exactly once on mount, which is the only thing that can resolve the verdict', async () => {
    const observer = mount(buildOptions())

    // Unknown at the instant the day appears, which is what withheld Swap and Log for the whole visit.
    expect(isWriteAllowedByVerdict(observer.getCurrentResult().data?.isWritable)).toBe(false)
    expect(requestCount()).toBe(1)
    expect(jest.mocked(fetchMealPlanDay).mock.calls[0]).toStrictEqual([PLAN_ID, DATE])

    await settle()

    expect(observer.getCurrentResult().data?.isWritable).toBe(true)
    expect(isWriteAllowedByVerdict(observer.getCurrentResult().data?.isWritable)).toBe(true)
    expect(requestCount()).toBe(1)
  })

  it('asks for the day a chip tap selects, which a fresh seed used to suppress', async () => {
    const day = makeDay({id: 'day-4', date: OTHER_DATE, dayIndex: 3})

    queryClient.setQueryData(queryKeys.mealPlanCurrent, makePlans({current: makePlan({days: [makeDay(), day]})}))

    const observer = mount(buildOptions())

    await settle()
    expect(requestCount()).toBe(1)

    // The tap: same plan, new date, so a new key with a seed of its own.
    observer.setOptions(buildOptions(PLAN_ID, OTHER_DATE))

    expect(observer.getCurrentResult().data?.day).toStrictEqual(day)
    expect(requestCount()).toBe(2)
    expect(jest.mocked(fetchMealPlanDay).mock.calls[1]).toStrictEqual([PLAN_ID, OTHER_DATE])
  })

  it('suppresses the read when stamped the way it used to be, which is the defect this stamp removes', () => {
    // The options as they were: the seed carried its source entry's own dataUpdatedAt, so a week cached inside
    // the staleTime mounted already fresh.
    mount({...buildOptions(), initialDataUpdatedAt: Date.now()})

    expect(requestCount()).toBe(0)
  })

  it('asks once per plan and date per staleTime window, and nothing on a remount inside it', async () => {
    mount(buildOptions())
    await settle()

    mount(buildOptions())
    await settle()

    // The second mount finds the route's answer, verdict and all, and has no reason to ask again.
    expect(requestCount()).toBe(1)
  })

  it('issues nothing at all once the capability gate refuses the read, and still renders the cached day', () => {
    const result = mount(buildOptions(PLAN_ID, DATE, false)).getCurrentResult()

    expect(requestCount()).toBe(0)
    expect(result.data?.day).toStrictEqual(makeDay())
    // Inert rather than wrong: nothing may be swapped or logged on a session a gated route has refused.
    expect(isWriteAllowedByVerdict(result.data?.isWritable)).toBe(false)
  })

  // The client's focus subscriber resumes paused mutations before it notifies the cache, so a focus-driven
  // refetch lands at least a microtask after the event. Draining is what makes the assertion about the round
  // rather than about its timing.
  const focus = async (): Promise<void> => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
    await new Promise<void>(resolve => setImmediate(resolve))
  }

  // `queryClient.mount()` is what subscribes the cache to focus at all, and both cases need it: without it the
  // refused case would report zero requests whether or not the gate did anything, and the control below is what
  // proves the round is real.
  const staleFocusRounds = async (options: MealPlanDayOptions): Promise<void> => {
    queryClient.mount()
    mount(options)
    await settle()

    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + STALE_TIME_MS * 2)
    await focus()
  }

  afterEach(() => {
    jest.restoreAllMocks()
    queryClient.unmount()
    focusManager.setFocused(undefined)
  })

  it('asks nothing on a stale focus event while the gate refuses it', async () => {
    await staleFocusRounds(buildOptions(PLAN_ID, DATE, false))

    expect(requestCount()).toBe(0)
  })

  it('re-reads the day on that same event while the gate allows it, which is the control', async () => {
    await staleFocusRounds(buildOptions())

    // One for the mount the seed no longer suppresses, one for the focus that found the answer stale.
    expect(requestCount()).toBe(2)
  })
})
