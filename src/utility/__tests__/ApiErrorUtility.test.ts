import {AxiosError, AxiosResponse} from 'axios'

import {API_ERROR_CODES, classifyOutcome, getApiErrorCode, isUnknownOutcome} from '../ApiErrorUtility'

const makeAxiosError = (status?: number, body?: unknown): AxiosError => {
  const response = status === undefined ? undefined : ({status, data: body} as AxiosResponse)

  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response)
}

describe('getApiErrorCode', () => {
  it('extracts the code from an axios-shaped error', () => {
    const error = {response: {data: {error: 'quota_exceeded'}}}

    expect(getApiErrorCode(error)).toBe('quota_exceeded')
  })

  it('returns null when the error has no response payload', () => {
    expect(getApiErrorCode(new Error('network down'))).toBeNull()
  })

  it('returns null for null and undefined', () => {
    expect(getApiErrorCode(null)).toBeNull()
    expect(getApiErrorCode(undefined)).toBeNull()
  })

  it('returns null when the error field is not a string', () => {
    const error = {response: {data: {error: 42}}}

    expect(getApiErrorCode(error)).toBeNull()
  })
})

describe('classifyOutcome', () => {
  describe('confirmed outcomes', () => {
    it('classifies a 409 carrying a machine code as confirmed', () => {
      const error = {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 422 carrying a machine code as confirmed', () => {
      const error = {response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 400 validation rejection as confirmed', () => {
      const error = {response: {status: 400, data: {error: API_ERROR_CODES.invalidRequest}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 404 with a human message as confirmed, not as a feature-unavailability signal', () => {
      const error = {response: {status: 404, data: {error: 'Plan not found'}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 503 carrying feature_disabled as confirmed', () => {
      const error = {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 502 swap_failed as confirmed', () => {
      const error = {response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 502 plan_generation_failed as confirmed', () => {
      const error = {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies the estimate and branded-search failure codes as confirmed', () => {
      const estimateFailure = {response: {status: 502, data: {error: API_ERROR_CODES.estimationFailed}}}
      const searchFailure = {response: {status: 502, data: {error: API_ERROR_CODES.brandedSearchFailed}}}

      expect(classifyOutcome(estimateFailure)).toBe('confirmed')
      expect(classifyOutcome(searchFailure)).toBe('confirmed')
    })
  })

  describe('unknown outcomes', () => {
    it('classifies a 5xx whose message is not a recognised machine code as unknown', () => {
      const error = {response: {status: 502, data: {error: 'Failed to swap meal'}}}

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies a 504 with no body as unknown', () => {
      const error = {response: {status: 504}}

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies a 503 with no body as unknown, so the status alone never decides', () => {
      const error = {response: {status: 503}}

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies a 5xx whose body does not decode to an object as unknown', () => {
      const error = {response: {status: 500, data: '<html>502 Bad Gateway</html>'}}

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies a 4xx with no decodable error field as unknown', () => {
      const emptyBody = {response: {status: 409, data: {}}}
      const numericCode = {response: {status: 409, data: {error: 42}}}

      expect(classifyOutcome(emptyBody)).toBe('unknown')
      expect(classifyOutcome(numericCode)).toBe('unknown')
    })

    it('classifies a status below 400 as unknown even when the body carries a code', () => {
      const success = {response: {status: 200, data: {error: API_ERROR_CODES.stalePlan}}}
      const redirect = {response: {status: 399, data: {error: API_ERROR_CODES.stalePlan}}}

      expect(classifyOutcome(success)).toBe('unknown')
      expect(classifyOutcome(redirect)).toBe('unknown')
    })

    it('classifies a response whose status is not a number as unknown', () => {
      const error = {response: {status: 'oops', data: {error: API_ERROR_CODES.stalePlan}}}

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies a flattened status and error payload as unknown, only nested responses decode', () => {
      const rejection = {status: 409, error: API_ERROR_CODES.stalePlan}
      const serverFailure = {status: 502, error: API_ERROR_CODES.swapFailed}

      expect(classifyOutcome(rejection)).toBe('unknown')
      expect(classifyOutcome(serverFailure)).toBe('unknown')
    })

    it('classifies a network error with no response as unknown', () => {
      expect(classifyOutcome(new Error('Network Error'))).toBe('unknown')
    })

    it('classifies null and undefined as unknown', () => {
      expect(classifyOutcome(null)).toBe('unknown')
      expect(classifyOutcome(undefined)).toBe('unknown')
    })

    it('classifies a bare string as unknown', () => {
      expect(classifyOutcome('boom')).toBe('unknown')
    })
  })

  describe('commit then response loss', () => {
    it('classifies a destroyed socket as unknown, so the caller retries the same idempotency key', () => {
      const error = new Error('socket hang up')

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies an aborted request as unknown rather than promising the write did not happen', () => {
      const error = Object.assign(new Error('timeout of 25000ms exceeded'), {code: 'ECONNABORTED'})

      expect(classifyOutcome(error)).toBe('unknown')
    })
  })

  describe('fixture shape equivalence', () => {
    // classifyOutcome duck-types the status and body rather than calling axios.isAxiosError, unlike the
    // neighbouring isServerFailureError, which rejects an axios-shaped plain object that lacks the flag.
    it('classifies a real AxiosError and a plain object of the same shape as confirmed', () => {
      const axiosError = makeAxiosError(409, {error: API_ERROR_CODES.stalePlan})
      const plainError = {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}}

      expect(classifyOutcome(axiosError)).toBe('confirmed')
      expect(classifyOutcome(plainError)).toBe('confirmed')
      expect(classifyOutcome(axiosError)).toBe(classifyOutcome(plainError))
    })

    it('classifies a bodyless AxiosError and a bodyless plain object as unknown', () => {
      const axiosError = makeAxiosError(504)
      const plainError = {response: {status: 504}}

      expect(classifyOutcome(axiosError)).toBe('unknown')
      expect(classifyOutcome(plainError)).toBe('unknown')
      expect(classifyOutcome(axiosError)).toBe(classifyOutcome(plainError))
    })

    it('classifies a responseless AxiosError and a plain Error as unknown', () => {
      const axiosError = makeAxiosError()
      const plainError = new Error('Network Error')

      expect(classifyOutcome(axiosError)).toBe('unknown')
      expect(classifyOutcome(plainError)).toBe('unknown')
      expect(classifyOutcome(axiosError)).toBe(classifyOutcome(plainError))
    })
  })
})

describe('isUnknownOutcome', () => {
  it('reports a 4xx carrying a machine code as not unknown', () => {
    const error = {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}}

    expect(isUnknownOutcome(error)).toBe(false)
  })

  it('reports a 503 carrying feature_disabled as not unknown', () => {
    const error = {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}}

    expect(isUnknownOutcome(error)).toBe(false)
  })

  it('reports a network error as unknown', () => {
    expect(isUnknownOutcome(new Error('Network Error'))).toBe(true)
  })

  it('reports a 504 with no body as unknown', () => {
    expect(isUnknownOutcome({response: {status: 504}})).toBe(true)
  })

  it('reports null and undefined as unknown', () => {
    expect(isUnknownOutcome(null)).toBe(true)
    expect(isUnknownOutcome(undefined)).toBe(true)
  })

  it('reports every server-described failure as not unknown', () => {
    const confirmedFailures = [
      {response: {status: 400, data: {error: API_ERROR_CODES.invalidRequest}}},
      {response: {status: 404, data: {error: 'Plan not found'}}},
      {response: {status: 409, data: {error: API_ERROR_CODES.idempotencyConflict}}},
      {response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}},
      {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}},
      {response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}},
      {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}}
    ]

    confirmedFailures.forEach(error => expect(isUnknownOutcome(error)).toBe(false))
  })
})
