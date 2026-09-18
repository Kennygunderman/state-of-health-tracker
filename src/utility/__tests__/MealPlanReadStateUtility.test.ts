import {isRoutesMissingError, RoutesMissingError} from '@utility/MealPlanEntitlementUtility'

import {API_ERROR_CODES, getApiErrorCode} from '../ApiErrorUtility'
import {classifyMealPlanRead, MealPlanReadState, worstMealPlanReadState} from '../MealPlanReadStateUtility'

type Row = {revision: number}

const ROW: Row = {revision: 4}

// The shapes the request functions actually produce: an axios rejection carrying the response the server sent,
// and — for the one read that classifies its own 404 — the typed routes-missing error.
const apiError = (status: number | null, code?: string): unknown => ({
  isAxiosError: true,
  response: {
    ...(status === null ? {} : {status}),
    data: code === undefined ? {} : {error: code}
  }
})

const NETWORK_ERROR = new Error('Network Error')

const loading = {isSuccess: false, isError: false, error: null}
const answered = {isSuccess: true, isError: false, error: null}

// A read whose refetch failed: TanStack has flipped the status to error and kept the last row.
const failedWithRetainedRow = (error: unknown): {isSuccess: boolean; isError: boolean; error: unknown; data: Row} => ({
  isSuccess: false,
  isError: true,
  error,
  data: ROW
})

describe('classifyMealPlanRead', () => {
  describe('a read that has not answered', () => {
    it('is loading while the first fetch is in flight', () => {
      expect(classifyMealPlanRead(loading)).toBe('loading')
    })

    it('is loading, not ready, while a gated query is held disabled', () => {
      // A disabled query is pending and not fetching, so `isLoading` is false — which is why this classifies
      // from isSuccess/isError instead.
      expect(classifyMealPlanRead({isSuccess: false, isError: false, error: undefined})).toBe('loading')
    })
  })

  describe('a read that answered', () => {
    it('is ready', () => {
      expect(classifyMealPlanRead(answered)).toBe('ready')
    })

    it('stays ready through a background refetch, which keeps the last answer on screen', () => {
      expect(classifyMealPlanRead({isSuccess: true, isError: false, error: null})).toBe('ready')
    })

    it('reports a stale error object on a now-successful read as ready', () => {
      // TanStack keeps the previous error on a result that has since succeeded, so the status decides.
      expect(classifyMealPlanRead({isSuccess: true, isError: false, error: apiError(500)})).toBe('ready')
    })
  })

  describe('a read that failed', () => {
    it('is failed even though the previous row is still retained', () => {
      expect(classifyMealPlanRead(failedWithRetainedRow(apiError(500)))).toBe('failed')
    })

    it('is failed for a lost connection', () => {
      expect(classifyMealPlanRead(failedWithRetainedRow(NETWORK_ERROR))).toBe('failed')
    })

    it('is failed for a resource 404, which names a missing or foreign resource rather than a missing route', () => {
      const error = apiError(404, 'Plan not found')

      expect(isRoutesMissingError(error)).toBe(false)
      expect(classifyMealPlanRead({isSuccess: false, isError: true, error})).toBe('failed')
    })

    it('is failed for an unconfirmed outcome that happens to carry the capability code', () => {
      // No status at all: the request may never have reached the server, so a second attempt may well answer.
      const error = apiError(null, API_ERROR_CODES.featureDisabled)

      expect(getApiErrorCode(error)).toBe(API_ERROR_CODES.featureDisabled)
      expect(classifyMealPlanRead({isSuccess: false, isError: true, error})).toBe('failed')
    })
  })

  describe('a capability refusal', () => {
    it('is unavailable for a confirmed 503 from a gated route', () => {
      const error = apiError(503, API_ERROR_CODES.featureDisabled)

      expect(classifyMealPlanRead({isSuccess: false, isError: true, error})).toBe('unavailable')
    })

    it('is unavailable for a bare 404 from a resource-less GET, the rolled-back-backend signal', () => {
      const error = apiError(404)

      expect(isRoutesMissingError(error)).toBe(true)
      expect(classifyMealPlanRead({isSuccess: false, isError: true, error})).toBe('unavailable')
    })

    it('is unavailable for the typed routes-missing error a request function throws', () => {
      const error = new RoutesMissingError('/meal-planning/targets')

      expect(classifyMealPlanRead({isSuccess: false, isError: true, error})).toBe('unavailable')
    })

    it('is unavailable even with a row retained from before the rollback', () => {
      expect(classifyMealPlanRead(failedWithRetainedRow(apiError(404)))).toBe('unavailable')
    })
  })

  describe('an error the read answers for itself', () => {
    it('is ready when the predicate claims it, so the targets read keeps rendering its local fallback', () => {
      const error = new RoutesMissingError('/meal-planning/targets')

      expect(classifyMealPlanRead({isSuccess: false, isError: true, error}, isRoutesMissingError)).toBe('ready')
    })

    it('is ready for a decided 409, so the estimate read shows its own card instead of a retry', () => {
      const error = apiError(409, API_ERROR_CODES.estimateUnavailable)
      const isEstimateUnavailable = (candidate: unknown): boolean =>
        getApiErrorCode(candidate) === API_ERROR_CODES.estimateUnavailable

      expect(classifyMealPlanRead({isSuccess: false, isError: true, error}, isEstimateUnavailable)).toBe('ready')
    })

    it('still reports every other error, so the predicate narrows rather than suppresses', () => {
      const isEstimateUnavailable = (candidate: unknown): boolean =>
        getApiErrorCode(candidate) === API_ERROR_CODES.estimateUnavailable

      expect(classifyMealPlanRead({isSuccess: false, isError: true, error: apiError(500)}, isEstimateUnavailable)).toBe(
        'failed'
      )
      expect(classifyMealPlanRead({isSuccess: false, isError: true, error: NETWORK_ERROR}, isEstimateUnavailable)).toBe(
        'failed'
      )
    })

    it('is not consulted for a read that succeeded or is still loading', () => {
      const always = (): boolean => true

      expect(classifyMealPlanRead(answered, always)).toBe('ready')
      expect(classifyMealPlanRead(loading, always)).toBe('loading')
    })
  })
})

describe('worstMealPlanReadState', () => {
  it('is ready only when every read is ready', () => {
    expect(worstMealPlanReadState(['ready', 'ready', 'ready'])).toBe('ready')
  })

  it('waits while any read is still loading', () => {
    expect(worstMealPlanReadState(['ready', 'loading'])).toBe('loading')
  })

  it('reports a failure over a read that has not answered, because waiting cannot fix it', () => {
    expect(worstMealPlanReadState(['loading', 'failed'])).toBe('failed')
    expect(worstMealPlanReadState(['failed', 'loading', 'ready'])).toBe('failed')
  })

  it('reports unavailability over a failure, so no dead retry is offered beside it', () => {
    expect(worstMealPlanReadState(['failed', 'unavailable'])).toBe('unavailable')
    expect(worstMealPlanReadState(['unavailable', 'loading', 'failed', 'ready'])).toBe('unavailable')
  })

  it('is order-independent', () => {
    const states: MealPlanReadState[] = ['ready', 'loading', 'failed']

    expect(worstMealPlanReadState(states)).toBe(worstMealPlanReadState([...states].reverse()))
  })

  it('is ready for no reads at all', () => {
    expect(worstMealPlanReadState([])).toBe('ready')
  })
})
