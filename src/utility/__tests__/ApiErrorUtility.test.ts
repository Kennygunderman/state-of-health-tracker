import {NoMatchingMealsOutcome, PlanGenerationFailedOutcome} from '@data/models/PlanGenerationResult'
import {AxiosError, AxiosResponse} from 'axios'

import {
  API_ERROR_CODES,
  API_ERROR_DETAIL_CODES,
  apiErrorDetailFields,
  classifyOutcome,
  getApiErrorCode,
  getApiErrorDetails,
  getApiErrorStatus,
  hasApiErrorDetailCode,
  isConfirmedFeatureDisabledError,
  isConfirmedPlanStateError,
  isFeatureDisabledError,
  isPlanOrCapabilityRefusal,
  isPlanReadInvalidatedError,
  isPlanStateError,
  isResourceNotFoundError,
  isUnknownOutcome,
  terminalErrorCode
} from '../ApiErrorUtility'

const makeAxiosError = (status?: number, body?: unknown): AxiosError => {
  const response = status === undefined ? undefined : ({status, data: body} as AxiosResponse)

  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', undefined, undefined, response)
}

describe('API_ERROR_CODES', () => {
  it('declares invalid_payload as a code of its own, distinct from invalid_request', () => {
    expect(API_ERROR_CODES.invalidPayload).toBe('invalid_payload')
    expect(API_ERROR_CODES.invalidPayload).not.toBe(API_ERROR_CODES.invalidRequest)
  })

  it('pins the two wire strings PlanGenerationResult derives its failure discriminants from', () => {
    const noMatchingMealsStatus: NoMatchingMealsOutcome['status'] = API_ERROR_CODES.noMatchingMeals
    const planGenerationFailedStatus: PlanGenerationFailedOutcome['status'] = API_ERROR_CODES.planGenerationFailed

    expect(noMatchingMealsStatus).toBe('no_matching_meals')
    expect(planGenerationFailedStatus).toBe('plan_generation_failed')
  })

  it('declares user_not_found, the answer an unprovisioned identity now receives instead of a 500', () => {
    expect(API_ERROR_CODES.userNotFound).toBe('user_not_found')
  })

  // The separation is the fix, so the separation is what is pinned: a code that only ever appears inside a
  // `details[]` entry must not sit in the map screens compare `getApiErrorCode` against, because the server
  // never puts it in `error` and the comparison is therefore unreachable.
  it('keeps the two vocabularies disjoint so no top-level comparison can name a details-only code', () => {
    const topLevel = Object.values(API_ERROR_CODES)
    const detailOnly = Object.values(API_ERROR_DETAIL_CODES)
    const shared = topLevel.filter(code => (detailOnly as string[]).includes(code))

    expect(shared).toEqual([])
  })

  it('carries read_only_field in the detail vocabulary only, never as a top-level code', () => {
    expect(API_ERROR_DETAIL_CODES.readOnlyField).toBe('read_only_field')
    expect(Object.values(API_ERROR_CODES)).not.toContain('read_only_field')
  })
})

describe('API_ERROR_DETAIL_CODES', () => {
  // One client vocabulary for the six server-side field-code maps. Each entry below is a string one of
  // preferences.logic.ts / targets.logic.ts / plannedMealLog.logic.ts / mealPlan.logic.ts / swap.logic.ts /
  // grocery.logic.ts / nutrition.logic.ts actually emits, so a drift on either side shows up here.
  it.each([
    ['required', 'required'],
    ['invalidType', 'invalid_type'],
    ['invalidId', 'invalid_id'],
    ['invalidDate', 'invalid_date'],
    ['invalidTime', 'invalid_time'],
    ['invalidTimeZone', 'invalid_time_zone'],
    ['invalidServings', 'invalid_servings'],
    ['invalidCharacters', 'invalid_characters'],
    ['notAnInteger', 'not_an_integer'],
    ['belowMinimum', 'below_minimum'],
    ['aboveMaximum', 'above_maximum'],
    ['outOfRange', 'out_of_range'],
    ['outsidePlanWeek', 'outside_plan_week'],
    ['unknownValue', 'unknown_value'],
    ['unknownStep', 'unknown_step'],
    ['unknownField', 'unknown_field'],
    ['readOnlyField', 'read_only_field'],
    ['notAllowed', 'not_allowed'],
    ['tooMany', 'too_many'],
    ['mutuallyExclusive', 'mutually_exclusive'],
    ['unsupportedCurrency', 'unsupported_currency'],
    ['slotMismatch', 'slot_mismatch'],
    ['notBelowCurrentWeight', 'not_below_current_weight'],
    ['notAboveCurrentWeight', 'not_above_current_weight'],
    ['conflictingFoodReference', 'conflicting_food_reference'],
    ['unrecognizedPayload', 'unrecognized_payload']
  ])('maps %s to the wire string %s', (key, wire) => {
    expect(API_ERROR_DETAIL_CODES[key as keyof typeof API_ERROR_DETAIL_CODES]).toBe(wire)
  })
})

describe('getApiErrorDetails', () => {
  // The exact body PUT /meal-planning/preferences answers when the client sends a server-owned key, recorded
  // from the running service: the top-level code says only "invalid_request", and everything that says which
  // field and why lives in details[].
  const READ_ONLY_FIELD_REFUSAL = {
    response: {
      status: 400,
      data: {
        error: API_ERROR_CODES.invalidRequest,
        details: [
          {field: 'setupStatus', code: API_ERROR_DETAIL_CODES.readOnlyField},
          {field: 'timeZone', code: API_ERROR_DETAIL_CODES.required}
        ]
      }
    }
  }

  it('extracts every field/code pair from a refusal, in the order the server listed them', () => {
    expect(getApiErrorDetails(READ_ONLY_FIELD_REFUSAL)).toEqual([
      {field: 'setupStatus', code: 'read_only_field'},
      {field: 'timeZone', code: 'required'}
    ])
  })

  it('recovers the reason getApiErrorCode alone cannot see', () => {
    expect(getApiErrorCode(READ_ONLY_FIELD_REFUSAL)).toBe('invalid_request')
    expect(getApiErrorDetails(READ_ONLY_FIELD_REFUSAL).map(detail => detail.code)).toContain('read_only_field')
  })

  it('returns an empty array when the body carries no details, so callers may iterate unconditionally', () => {
    expect(getApiErrorDetails({response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}})).toEqual([])
  })

  it('returns an empty array for an error with no response payload at all', () => {
    expect(getApiErrorDetails(new Error('network down'))).toEqual([])
  })

  it('returns an empty array for null and undefined', () => {
    expect(getApiErrorDetails(null)).toEqual([])
    expect(getApiErrorDetails(undefined)).toEqual([])
  })

  it('returns an empty array when details is present but not an array', () => {
    expect(getApiErrorDetails({response: {data: {details: 'setupStatus is read only'}}})).toEqual([])
    expect(getApiErrorDetails({response: {data: {details: {field: 'setupStatus', code: 'read_only_field'}}}})).toEqual(
      []
    )
    expect(getApiErrorDetails({response: {data: {details: null}}})).toEqual([])
  })

  it('returns an empty array when the response body is not an object, the undecodable-proxy case', () => {
    expect(getApiErrorDetails({response: {status: 502, data: '<html>Bad Gateway</html>'}})).toEqual([])
  })

  // Per entry rather than per array: a truncated or future-shaped payload should still yield the entries it
  // does carry, because a partially-decodable refusal is more useful than none.
  it('drops only the malformed entries and keeps the well-formed ones', () => {
    const error = {
      response: {
        data: {
          details: [
            null,
            undefined,
            'setupStatus',
            42,
            {field: 'setupStatus'},
            {code: 'read_only_field'},
            {field: 7, code: 'read_only_field'},
            {field: 'hasActivePlan', code: 9},
            {field: 'revision', code: API_ERROR_DETAIL_CODES.readOnlyField, extra: 'ignored'}
          ]
        }
      }
    }

    expect(getApiErrorDetails(error)).toEqual([{field: 'revision', code: 'read_only_field'}])
  })

  it('preserves an unrecognised detail code verbatim rather than discarding the entry', () => {
    const error = {response: {data: {details: [{field: 'somethingNew', code: 'a_future_reason'}]}}}

    expect(getApiErrorDetails(error)).toEqual([{field: 'somethingNew', code: 'a_future_reason'}])
  })
})

describe('hasApiErrorDetailCode', () => {
  const refusal = {
    response: {
      status: 400,
      data: {
        error: API_ERROR_CODES.invalidRequest,
        details: [
          {field: 'setupStatus', code: API_ERROR_DETAIL_CODES.readOnlyField},
          {field: 'timeZone', code: API_ERROR_DETAIL_CODES.required}
        ]
      }
    }
  }

  it('is true when any entry reports the code, whichever field it named', () => {
    expect(hasApiErrorDetailCode(refusal, API_ERROR_DETAIL_CODES.readOnlyField)).toBe(true)
    expect(hasApiErrorDetailCode(refusal, API_ERROR_DETAIL_CODES.required)).toBe(true)
  })

  it('is false for a code the refusal did not report', () => {
    expect(hasApiErrorDetailCode(refusal, API_ERROR_DETAIL_CODES.outsidePlanWeek)).toBe(false)
  })

  it('is false when the error carries no details, and for a transport failure', () => {
    expect(hasApiErrorDetailCode({response: {status: 409, data: {error: 'stale_plan'}}}, 'required')).toBe(false)
    expect(hasApiErrorDetailCode(new Error('timeout'), 'required')).toBe(false)
  })
})

describe('apiErrorDetailFields', () => {
  it('returns every field one reason was reported against, in server order', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: API_ERROR_CODES.invalidRequest,
          details: [
            {field: 'setupStatus', code: API_ERROR_DETAIL_CODES.readOnlyField},
            {field: 'timeZone', code: API_ERROR_DETAIL_CODES.required},
            {field: 'revision', code: API_ERROR_DETAIL_CODES.readOnlyField}
          ]
        }
      }
    }

    expect(apiErrorDetailFields(error, API_ERROR_DETAIL_CODES.readOnlyField)).toEqual(['setupStatus', 'revision'])
    expect(apiErrorDetailFields(error, API_ERROR_DETAIL_CODES.required)).toEqual(['timeZone'])
  })

  it('returns an empty array for a code the refusal did not report, and for a transport failure', () => {
    const error = {response: {status: 400, data: {error: API_ERROR_CODES.invalidRequest, details: []}}}

    expect(apiErrorDetailFields(error, API_ERROR_DETAIL_CODES.required)).toEqual([])
    expect(apiErrorDetailFields(new Error('timeout'), API_ERROR_DETAIL_CODES.required)).toEqual([])
  })

  // The diary routes answer `{error: 'invalid_request', details: [{field: 'mealId', code: 'invalid_id'}]}`;
  // the field name is the only part of that answer that says which id was rejected.
  it('names the path parameter a malformed-id refusal rejected', () => {
    const error = {
      response: {
        status: 400,
        data: {
          error: API_ERROR_CODES.invalidRequest,
          details: [{field: 'mealId', code: API_ERROR_DETAIL_CODES.invalidId}]
        }
      }
    }

    expect(apiErrorDetailFields(error, API_ERROR_DETAIL_CODES.invalidId)).toEqual(['mealId'])
  })
})

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

describe('getApiErrorStatus', () => {
  it('extracts the status from an axios-shaped error', () => {
    expect(getApiErrorStatus(makeAxiosError(404, {error: 'not_found'}))).toBe(404)
  })

  it('reads the status even when the body carries no code, which is the undecodable case', () => {
    expect(getApiErrorStatus(makeAxiosError(404, '<html>Not Found</html>'))).toBe(404)
  })

  it('returns null when the rejection never reached a response', () => {
    expect(getApiErrorStatus(makeAxiosError())).toBeNull()
    expect(getApiErrorStatus(new Error('network down'))).toBeNull()
  })

  it('returns null for null and undefined', () => {
    expect(getApiErrorStatus(null)).toBeNull()
    expect(getApiErrorStatus(undefined)).toBeNull()
  })

  it('returns null when the status is not a number', () => {
    expect(getApiErrorStatus({response: {status: '404'}})).toBeNull()
  })

  it('reads the same status classifyOutcome branches on, so the two can never disagree', () => {
    const notFound = makeAxiosError(404, {error: 'catalog_food_not_found'})

    expect(getApiErrorStatus(notFound)).toBe(404)
    expect(classifyOutcome(notFound)).toBe('confirmed')
    expect(getApiErrorStatus(makeAxiosError())).toBeNull()
    expect(classifyOutcome(makeAxiosError())).toBe('unknown')
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

    it('classifies the 400 invalid_payload of a body naming both foodId and catalogFoodId as confirmed', () => {
      const error = {response: {status: 400, data: {error: API_ERROR_CODES.invalidPayload}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies a 404 with a human message as confirmed, not as a feature-unavailability signal', () => {
      const error = {response: {status: 404, data: {error: 'Plan not found'}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    // The orphan-principal answer. It used to be a 500 whose body read `internal_error`, which is not a
    // recognised 5xx failure code, so it classified as `unknown` — and per AAP 0.7.2 the four keyed
    // mutations then spent their automatic same-key retry and drew the unconfirmed-outcome state over a
    // permanent condition that had written nothing. As a 404 carrying a decodable code it is confirmed, so
    // the retry never fires and the screen may state plainly that nothing changed.
    it('classifies the 404 user_not_found of an unprovisioned identity as confirmed, never unknown', () => {
      const error = {response: {status: 404, data: {error: API_ERROR_CODES.userNotFound}}}

      expect(classifyOutcome(error)).toBe('confirmed')
      expect(isUnknownOutcome(error)).toBe(false)
    })

    it('classifies the legacy family variant of the same condition as confirmed', () => {
      const error = {response: {status: 404, data: {error: 'User not found'}}}

      expect(classifyOutcome(error)).toBe('confirmed')
      expect(isUnknownOutcome(error)).toBe(false)
    })

    // What the fix replaces, pinned so the regression is visible if the guard is ever removed.
    it('classifies the 500 internal_error the guard replaces as unknown, the defect being closed', () => {
      const error = {response: {status: 500, data: {error: 'internal_error'}}}

      expect(classifyOutcome(error)).toBe('unknown')
      expect(isUnknownOutcome(error)).toBe(true)
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

    it('classifies a 499 carrying a machine code as confirmed, the top of the 4xx range', () => {
      const error = {response: {status: 499, data: {error: API_ERROR_CODES.stalePlan}}}

      expect(classifyOutcome(error)).toBe('confirmed')
    })

    it('classifies 500 and 599 carrying a recognised code as confirmed, both ends of the 5xx range', () => {
      const lowerEdge = {response: {status: 500, data: {error: API_ERROR_CODES.planGenerationFailed}}}
      const upperEdge = {response: {status: 599, data: {error: API_ERROR_CODES.swapFailed}}}

      expect(classifyOutcome(lowerEdge)).toBe('confirmed')
      expect(classifyOutcome(upperEdge)).toBe('confirmed')
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

    it('classifies a 600 carrying a recognised server failure code as unknown', () => {
      const error = {response: {status: 600, data: {error: API_ERROR_CODES.swapFailed}}}

      expect(classifyOutcome(error)).toBe('unknown')
    })

    it('classifies a 600 carrying a code the 4xx rule accepts as unknown, so nothing falls through', () => {
      const error = {response: {status: 600, data: {error: API_ERROR_CODES.stalePlan}}}

      expect(classifyOutcome(error)).toBe('unknown')
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

  it('reports a 600 carrying a recognised code as unknown', () => {
    expect(isUnknownOutcome({response: {status: 600, data: {error: API_ERROR_CODES.swapFailed}}})).toBe(true)
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

describe('isFeatureDisabledError', () => {
  it('recognises the capability code a mounted backend returns from a gated route', () => {
    expect(isFeatureDisabledError({response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(true)
  })

  it('does not treat another refusal as the capability being off', () => {
    expect(isFeatureDisabledError({response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(false)
  })

  it('does not treat a bodiless failure as the capability being off', () => {
    expect(isFeatureDisabledError({response: {status: 503}})).toBe(false)
    expect(isFeatureDisabledError(new Error('Network Error'))).toBe(false)
    expect(isFeatureDisabledError(null)).toBe(false)
    expect(isFeatureDisabledError(undefined)).toBe(false)
  })
})

describe('isConfirmedFeatureDisabledError', () => {
  it('recognises the 503 a mounted backend returns from a gated route', () => {
    expect(
      isConfirmedFeatureDisabledError({response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})
    ).toBe(true)
  })

  // THE STATUS IS PART OF THE SIGNAL. A resource route's 404 is the not-found/not-yours answer of AAP 0.5.2,
  // which that section never distinguishes and which is emphatically not an unavailability signal — so even
  // when such a response carries this exact code (a proxy, a rewritten route, a future handler), reading it as
  // the capability being off would latch the entire session over one plan day or one recipe the caller cannot
  // see. The generic classification still calls it confirmed, as it must; the capability question answers no.
  it('refuses the code on a resource 404, which AAP 0.5.2 reserves for not-found/not-yours', () => {
    const resourceNotFound = {response: {status: 404, data: {error: API_ERROR_CODES.featureDisabled}}}

    expect(classifyOutcome(resourceNotFound)).toBe('confirmed')
    expect(isFeatureDisabledError(resourceNotFound)).toBe(true)
    expect(isConfirmedFeatureDisabledError(resourceNotFound)).toBe(false)
  })

  it('refuses the code on any other 4xx, which is some other refusal of this request', () => {
    expect(
      isConfirmedFeatureDisabledError({response: {status: 403, data: {error: API_ERROR_CODES.featureDisabled}}})
    ).toBe(false)
    expect(
      isConfirmedFeatureDisabledError({response: {status: 409, data: {error: API_ERROR_CODES.featureDisabled}}})
    ).toBe(false)
  })

  // A gateway failure echoing the string describes nothing about this attempt. `classifyOutcome` calls it
  // confirmed because the code is a recognised machine code and the generic rule has other purposes for that
  // (a keyed write must not promise "nothing changed"); stopping every gated request in the session over a
  // failure a second attempt would have resolved is not one of them.
  it('refuses the code on a 5xx that is not the 503 the capability answer arrives as', () => {
    const gatewayEcho = {response: {status: 502, data: {error: API_ERROR_CODES.featureDisabled}}}

    expect(classifyOutcome(gatewayEcho)).toBe('confirmed')
    expect(isConfirmedFeatureDisabledError(gatewayEcho)).toBe(false)
    expect(
      isConfirmedFeatureDisabledError({response: {status: 500, data: {error: API_ERROR_CODES.featureDisabled}}})
    ).toBe(false)
    expect(
      isConfirmedFeatureDisabledError({response: {status: 504, data: {error: API_ERROR_CODES.featureDisabled}}})
    ).toBe(false)
  })

  // A rejection that never reached a response describes no outcome, however its shape was assembled, so it
  // must stay a retry rather than latch the session's unavailable verdict.
  it('refuses the code when no response status carried it', () => {
    expect(isConfirmedFeatureDisabledError({response: {data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(false)
    expect(isConfirmedFeatureDisabledError({message: API_ERROR_CODES.featureDisabled})).toBe(false)
  })

  it('does not treat another confirmed refusal as the capability being off', () => {
    expect(
      isConfirmedFeatureDisabledError({response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}})
    ).toBe(false)
    expect(isConfirmedFeatureDisabledError({response: {status: 404, data: {error: 'Plan not found'}}})).toBe(false)
  })

  it('does not treat a bodiless or transport failure as the capability being off', () => {
    expect(isConfirmedFeatureDisabledError({response: {status: 503}})).toBe(false)
    expect(isConfirmedFeatureDisabledError(new Error('Network Error'))).toBe(false)
    expect(isConfirmedFeatureDisabledError(null)).toBe(false)
    expect(isConfirmedFeatureDisabledError(undefined)).toBe(false)
  })

  it('reads an axios-shaped rejection, the form a request function re-throws', () => {
    expect(isConfirmedFeatureDisabledError(makeAxiosError(503, {error: API_ERROR_CODES.featureDisabled}))).toBe(true)
    // The same rejection without a response is the transport failure case: no status, so nothing is confirmed.
    expect(isConfirmedFeatureDisabledError(makeAxiosError(undefined))).toBe(false)
  })
})

describe('isPlanStateError', () => {
  it('recognises both codes that say the plan an attempt named is not the plan the server holds', () => {
    expect(isPlanStateError({response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(true)
    expect(isPlanStateError({response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(true)
  })

  it('does not treat another refusal as the plan having moved on', () => {
    expect(isPlanStateError({response: {status: 409, data: {error: API_ERROR_CODES.previewStale}}})).toBe(false)
    expect(isPlanStateError({response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(false)
  })

  it('does not treat a bodiless failure as the plan having moved on', () => {
    expect(isPlanStateError({response: {status: 409}})).toBe(false)
    expect(isPlanStateError(new Error('Network Error'))).toBe(false)
    expect(isPlanStateError(null)).toBe(false)
    expect(isPlanStateError(undefined)).toBe(false)
  })
})

describe('isConfirmedPlanStateError', () => {
  it('recognises a 4xx whose decoded body says the plan has moved on', () => {
    expect(isConfirmedPlanStateError({response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(true)
    expect(isConfirmedPlanStateError({response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(
      true
    )
    expect(isConfirmedPlanStateError(makeAxiosError(404, {error: API_ERROR_CODES.planNotActive}))).toBe(true)
  })

  // The misclassification the finding names: the code string alone is not an answer, because a gateway that
  // echoes it described nothing about this attempt.
  it('refuses a 5xx carrying a plan-state string, whose outcome is unknown', () => {
    expect(isConfirmedPlanStateError({response: {status: 502, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(false)
    expect(isConfirmedPlanStateError({response: {status: 500, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(
      false
    )
    expect(isConfirmedPlanStateError({response: {status: 504, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(false)
  })

  it('refuses an undecodable or absent body, whatever the status', () => {
    expect(isConfirmedPlanStateError({response: {status: 409}})).toBe(false)
    expect(isConfirmedPlanStateError({response: {status: 500, data: '<html>bad gateway</html>'}})).toBe(false)
    expect(isConfirmedPlanStateError(new Error('Network Error'))).toBe(false)
    expect(isConfirmedPlanStateError(null)).toBe(false)
    expect(isConfirmedPlanStateError(undefined)).toBe(false)
  })

  it('leaves every other confirmed code to its own handling', () => {
    expect(isConfirmedPlanStateError({response: {status: 409, data: {error: API_ERROR_CODES.previewStale}}})).toBe(
      false
    )
    expect(isConfirmedPlanStateError({response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(
      false
    )
  })
})

describe('isResourceNotFoundError', () => {
  // The literal body `GET /meal-planning/plans/:planId/days/:date` returns for a plan that is absent or
  // foreign, and for a date outside the plan's week: a human string, not a machine code.
  const PLAN_NOT_FOUND_BODY = {error: 'Plan not found'}

  it("recognises the resource route's combined not-found/not-yours 404 from its real body", () => {
    expect(isResourceNotFoundError(makeAxiosError(404, PLAN_NOT_FOUND_BODY))).toBe(true)
    expect(isResourceNotFoundError({response: {status: 404, data: PLAN_NOT_FOUND_BODY}})).toBe(true)
  })

  it('recognises a resource 404 whichever string names the refusal, machine code or prose', () => {
    expect(isResourceNotFoundError({response: {status: 404, data: {error: 'catalog_food_not_found'}}})).toBe(true)
    expect(isResourceNotFoundError({response: {status: 404, data: {error: 'Meal entry not found'}}})).toBe(true)
  })

  it('refuses the routes-missing 404 of a resource-less GET, which carries no code', () => {
    expect(isResourceNotFoundError(makeAxiosError(404, {}))).toBe(false)
    expect(isResourceNotFoundError(makeAxiosError(404, undefined))).toBe(false)
    expect(isResourceNotFoundError({response: {status: 404, data: '<html>not found</html>'}})).toBe(false)
  })

  it('refuses a RoutesMissingError, whose 404 lives on the error rather than on a response', () => {
    expect(isResourceNotFoundError({routesMissing: 'meal_planning_routes_missing', status: 404})).toBe(false)
  })

  it('refuses every other status and every answer that never reached one', () => {
    expect(isResourceNotFoundError(makeAxiosError(409, {error: API_ERROR_CODES.stalePlan}))).toBe(false)
    expect(isResourceNotFoundError(makeAxiosError(500, {error: 'Failed to get the meal plan day'}))).toBe(false)
    expect(isResourceNotFoundError(new Error('Network Error'))).toBe(false)
    expect(isResourceNotFoundError(null)).toBe(false)
    expect(isResourceNotFoundError(undefined)).toBe(false)
  })
})

describe('isPlanReadInvalidatedError', () => {
  it('recognises the resource 404 saying the plan a read named is not one this caller may read', () => {
    expect(isPlanReadInvalidatedError(makeAxiosError(404, {error: 'Plan not found'}))).toBe(true)
  })

  it('recognises a confirmed plan-state answer', () => {
    expect(isPlanReadInvalidatedError(makeAxiosError(409, {error: API_ERROR_CODES.stalePlan}))).toBe(true)
    expect(isPlanReadInvalidatedError(makeAxiosError(409, {error: API_ERROR_CODES.planNotActive}))).toBe(true)
  })

  it('refuses a 5xx that merely echoed a plan-state code, which described no outcome', () => {
    expect(isPlanReadInvalidatedError(makeAxiosError(502, {error: API_ERROR_CODES.stalePlan}))).toBe(false)
  })

  it('refuses the routes-missing 404, which the entitlement verdict owns', () => {
    expect(isPlanReadInvalidatedError(makeAxiosError(404, {}))).toBe(false)
    expect(isPlanReadInvalidatedError({routesMissing: 'meal_planning_routes_missing', status: 404})).toBe(false)
  })

  it('refuses a failure a second attempt could still resolve', () => {
    expect(isPlanReadInvalidatedError(new Error('Network Error'))).toBe(false)
    expect(isPlanReadInvalidatedError(makeAxiosError(500, {error: 'Failed to get the meal plan day'}))).toBe(false)
    expect(isPlanReadInvalidatedError(makeAxiosError(undefined))).toBe(false)
    expect(isPlanReadInvalidatedError(null)).toBe(false)
  })
})

describe('isPlanOrCapabilityRefusal', () => {
  it('recognises a confirmed plan-state answer, the one a read may be redirected on', () => {
    expect(isPlanOrCapabilityRefusal({response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(true)
    expect(isPlanOrCapabilityRefusal({response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(
      true
    )
  })

  it('recognises the capability being off, a 5xx code the classification does confirm', () => {
    expect(isPlanOrCapabilityRefusal({response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(
      true
    )
  })

  it('does not treat another confirmed refusal as a plan or capability answer', () => {
    expect(isPlanOrCapabilityRefusal({response: {status: 409, data: {error: API_ERROR_CODES.previewStale}}})).toBe(
      false
    )
    expect(isPlanOrCapabilityRefusal({response: {status: 400, data: {error: API_ERROR_CODES.invalidRequest}}})).toBe(
      false
    )
  })

  // The distinction the confirmed check exists for: a gateway body that merely echoes the string is an unknown
  // outcome, so it stays a retry rather than becoming a redirection.
  it('does not treat a 5xx carrying a plan-state string as a refusal, because that outcome is unknown', () => {
    expect(isPlanOrCapabilityRefusal({response: {status: 502, data: {error: API_ERROR_CODES.stalePlan}}})).toBe(false)
    expect(isPlanOrCapabilityRefusal({response: {status: 500, data: {error: API_ERROR_CODES.planNotActive}}})).toBe(
      false
    )
  })

  it('does not treat a bodiless failure as a refusal', () => {
    expect(isPlanOrCapabilityRefusal({response: {status: 503}})).toBe(false)
    expect(isPlanOrCapabilityRefusal(new Error('Network Error'))).toBe(false)
    expect(isPlanOrCapabilityRefusal(null)).toBe(false)
    expect(isPlanOrCapabilityRefusal(undefined)).toBe(false)
  })

  // The swap screen reads this predicate to decide a terminal refusal, so the resource-404 rule has to hold
  // here too: AAP 0.5.2 makes a 404 from a plan or recipe route the not-found/not-yours answer, and a swap
  // abandoned as "meal planning is off" over an alternative the caller simply cannot see would be wrong for
  // the same reason it would be wrong in the entitlement.
  it('does not treat a resource 404 carrying the capability code as a refusal', () => {
    expect(isPlanOrCapabilityRefusal({response: {status: 404, data: {error: API_ERROR_CODES.featureDisabled}}})).toBe(
      false
    )
  })

  // The composition itself, so the wider predicate cannot drift from the two narrower ones it is built out of:
  // whatever either of them confirms, this confirms, and nothing else.
  it('is exactly its two confirmed parts, for every shape either of them judges', () => {
    const errors: unknown[] = [
      {response: {status: 409, data: {error: API_ERROR_CODES.stalePlan}}},
      {response: {status: 409, data: {error: API_ERROR_CODES.planNotActive}}},
      {response: {status: 503, data: {error: API_ERROR_CODES.featureDisabled}}},
      {response: {status: 502, data: {error: API_ERROR_CODES.featureDisabled}}},
      {response: {status: 502, data: {error: API_ERROR_CODES.stalePlan}}},
      {response: {status: 409, data: {error: API_ERROR_CODES.previewStale}}},
      {response: {status: 404, data: {error: 'Plan not found'}}},
      {response: {status: 503}},
      new Error('Network Error'),
      null,
      undefined
    ]

    errors.forEach(error => {
      expect(isPlanOrCapabilityRefusal(error)).toBe(
        isConfirmedPlanStateError(error) || isConfirmedFeatureDisabledError(error)
      )
    })
  })
})

describe('terminalErrorCode', () => {
  const RETRYABLE: ReadonlySet<string> = new Set<string>([
    API_ERROR_CODES.planGenerationFailed,
    API_ERROR_CODES.noMatchingMeals
  ])

  it('has nothing to retire when there was no error', () => {
    expect(terminalErrorCode(null, RETRYABLE)).toBeNull()
    expect(terminalErrorCode(undefined, RETRYABLE)).toBeNull()
  })

  describe('leaves a key replayable', () => {
    it('for an outcome the server never described, which may have committed', () => {
      expect(terminalErrorCode(new Error('Network Error'), RETRYABLE)).toBeNull()
      expect(terminalErrorCode({response: {status: 504}}, RETRYABLE)).toBeNull()
    })

    it('for a 5xx whose code this client does not recognise', () => {
      expect(terminalErrorCode({response: {status: 500, data: {error: 'some_future_failure'}}}, RETRYABLE)).toBeNull()
    })

    it('for a 4xx whose error field is not a string', () => {
      expect(terminalErrorCode({response: {status: 409, data: {error: 42}}}, RETRYABLE)).toBeNull()
    })

    it('for each code the caller named as retryable or handled in place', () => {
      const generationFailed = {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}}
      const noMatch = {response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}}

      expect(terminalErrorCode(generationFailed, RETRYABLE)).toBeNull()
      expect(terminalErrorCode(noMatch, RETRYABLE)).toBeNull()
    })
  })

  describe('retires the key, naming the code that refused it', () => {
    it.each([
      ['a validation refusal', 400, API_ERROR_CODES.invalidRequest],
      ['the capability being off', 503, API_ERROR_CODES.featureDisabled],
      ['a superseded plan', 409, API_ERROR_CODES.planNotActive],
      ['a reused key with a changed body', 409, API_ERROR_CODES.idempotencyConflict],
      ['missing targets', 422, API_ERROR_CODES.targetsMissing],
      ['a code from a later server release', 409, 'some_future_refusal']
    ])('for %s', (_case, status, code) => {
      expect(terminalErrorCode({response: {status, data: {error: code}}}, RETRYABLE)).toBe(code)
    })

    it('for a confirmed 5xx that is not the caller\u2019s retryable failure', () => {
      expect(terminalErrorCode({response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}}, RETRYABLE)).toBe(
        API_ERROR_CODES.swapFailed
      )
    })
  })

  it('lets each flow name its own retryable set without changing the others', () => {
    const swapRetryable: ReadonlySet<string> = new Set<string>([API_ERROR_CODES.swapFailed])
    const swapFailed = {response: {status: 502, data: {error: API_ERROR_CODES.swapFailed}}}
    const generationFailed = {response: {status: 502, data: {error: API_ERROR_CODES.planGenerationFailed}}}

    expect(terminalErrorCode(swapFailed, swapRetryable)).toBeNull()
    expect(terminalErrorCode(generationFailed, swapRetryable)).toBe(API_ERROR_CODES.planGenerationFailed)
  })

  it('is terminal by default, so a code nobody listed is never replayed forever', () => {
    const empty: ReadonlySet<string> = new Set<string>()

    expect(terminalErrorCode({response: {status: 422, data: {error: API_ERROR_CODES.noMatchingMeals}}}, empty)).toBe(
      API_ERROR_CODES.noMatchingMeals
    )
  })
})
