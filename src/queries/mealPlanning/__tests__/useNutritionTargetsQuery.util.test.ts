import {NutritionTargets} from '@data/models/NutritionTargets'
import {RoutesMissingError} from '@utility/MealPlanEntitlementUtility'

import {
  isNutritionTargetsReadFailure,
  isNutritionTargetsRouteMissing,
  NutritionTargetsReadResult,
  selectNutritionTargets
} from '../useNutritionTargetsQuery.util'

const TARGETS_PATH = '/meal-planning/targets'

const CONFIRMED_TARGETS: NutritionTargets = {
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  complete: true,
  source: 'manual',
  stale: false,
  revision: 3
}

// The server's answer for a user who has never confirmed a target: a successful read holding no figures. It is
// here to pin that the selector treats it as data, not as an unanswered read.
const UNCONFIRMED_TARGETS: NutritionTargets = {
  targets: null,
  complete: false,
  source: null,
  stale: false,
  revision: 0
}

const makeApiError = (status: number, code?: string): unknown => ({
  response: {status, data: code === undefined ? {} : {error: code}}
})

const ROUTE_MISSING_ERRORS: [string, unknown][] = [
  ['the typed RoutesMissingError the targets fetch throws', new RoutesMissingError(TARGETS_PATH)],
  ['an axios-shaped bare 404, the same answer before any classification', makeApiError(404)]
]

const READ_FAILURE_ERRORS: [string, unknown][] = [
  ['a 404 carrying a decodable code, the not-found answer of a resource route', makeApiError(404, 'not_found')],
  ['a 500 carrying a machine code', makeApiError(500, 'plan_generation_failed')],
  ['a network error with no response at all', new Error('network down')]
]

// A read that never answered: no data, and an error the displaying surface itself never reads.
const erroredResult = (error: unknown): NutritionTargetsReadResult => ({data: undefined, isError: true, error})

// The state TanStack actually leaves behind when a refetch fails after a successful read: `status` moves to
// 'error' and the last `data` is kept. It is the reason the selector classifies the whole result rather than
// just its data member.
const retainedDataResult = (error: unknown): NutritionTargetsReadResult => ({
  data: CONFIRMED_TARGETS,
  isError: true,
  error
})

const succeededResult = (data: NutritionTargets | undefined): NutritionTargetsReadResult => ({
  data,
  isError: false,
  error: null
})

describe('selectNutritionTargets', () => {
  it('returns the server targets when the read answered with them', () => {
    expect(selectNutritionTargets(succeededResult(CONFIRMED_TARGETS))).toBe(CONFIRMED_TARGETS)
  })

  it('returns a successful read that holds no figures as data, not as an absent answer', () => {
    expect(selectNutritionTargets(succeededResult(UNCONFIRMED_TARGETS))).toBe(UNCONFIRMED_TARGETS)
  })

  it('selects the local fallback when there is no data, which is every read that has not answered', () => {
    expect(selectNutritionTargets(succeededResult(undefined))).toBeNull()
  })

  it('selects the local fallback for a result carrying no data member at all', () => {
    expect(selectNutritionTargets({isError: false, error: null})).toBeNull()
  })

  it.each([...ROUTE_MISSING_ERRORS, ...READ_FAILURE_ERRORS])(
    'selects the local fallback under %s when the read never produced data',
    (_label, error) => {
      expect(selectNutritionTargets(erroredResult(error))).toBeNull()
    }
  )

  // The case that made the plain `data ?? null` wrong: targets loaded, the backend was then rolled back past
  // `/meal-planning/targets*`, and TanStack kept the figures from before. That server holds no targets at all,
  // so the surface must degrade to the local value exactly as it does for a user who never opted in (AAP
  // 0.7.5) — while the Meal Plan segment, reading the same error, shows its unavailable card.
  describe('a route-missing answer arriving after a successful read', () => {
    it.each(ROUTE_MISSING_ERRORS)(
      'selects the local fallback under %s even though TanStack retained the figures',
      (_label, error) => {
        const result = retainedDataResult(error)

        expect(result.data).toBe(CONFIRMED_TARGETS)
        expect(selectNutritionTargets(result)).toBeNull()
      }
    )
  })

  // The deliberate other half of that rule: a 500 or a lost connection says nothing about whether the server
  // still holds these targets, so the last answer stays on screen and only the surface's retry affordance
  // (`isNutritionTargetsReadFailure`) reacts.
  describe('a generic read failure arriving after a successful read', () => {
    it.each(READ_FAILURE_ERRORS)('keeps the retained figures under %s', (_label, error) => {
      expect(selectNutritionTargets(retainedDataResult(error))).toBe(CONFIRMED_TARGETS)
    })
  })

  it('keeps the data of a succeeded result that still carries a previous route-missing error', () => {
    const result: NutritionTargetsReadResult = {
      data: CONFIRMED_TARGETS,
      isError: false,
      error: new RoutesMissingError(TARGETS_PATH)
    }

    expect(selectNutritionTargets(result)).toBe(CONFIRMED_TARGETS)
  })
})

describe('isNutritionTargetsRouteMissing', () => {
  it.each(ROUTE_MISSING_ERRORS)('is true for %s', (_label, error) => {
    expect(isNutritionTargetsRouteMissing({isError: true, error})).toBe(true)
  })

  it.each(READ_FAILURE_ERRORS)('is false for %s', (_label, error) => {
    expect(isNutritionTargetsRouteMissing({isError: true, error})).toBe(false)
  })

  it('is false on a successful result, where there is no error to classify', () => {
    expect(isNutritionTargetsRouteMissing({isError: false, error: null})).toBe(false)
  })

  it('is false on a succeeded result that still carries the previous error, which TanStack keeps', () => {
    expect(isNutritionTargetsRouteMissing({isError: false, error: new RoutesMissingError(TARGETS_PATH)})).toBe(false)
  })
})

describe('isNutritionTargetsReadFailure', () => {
  it.each(READ_FAILURE_ERRORS)('is true for %s, the failure a retry belongs to', (_label, error) => {
    expect(isNutritionTargetsReadFailure({isError: true, error})).toBe(true)
  })

  it.each(ROUTE_MISSING_ERRORS)('is false for %s, which no retry can resolve', (_label, error) => {
    expect(isNutritionTargetsReadFailure({isError: true, error})).toBe(false)
  })

  it('is false on a successful result', () => {
    expect(isNutritionTargetsReadFailure({isError: false, error: null})).toBe(false)
  })

  it('is false on a succeeded result that still carries the previous error', () => {
    expect(isNutritionTargetsReadFailure({isError: false, error: makeApiError(500, 'plan_generation_failed')})).toBe(
      false
    )
  })
})

describe('the two predicates together', () => {
  it.each([...ROUTE_MISSING_ERRORS, ...READ_FAILURE_ERRORS])(
    'classifies %s as exactly one of route-missing and read failure',
    (_label, error) => {
      const result = {isError: true, error}

      expect(isNutritionTargetsRouteMissing(result)).not.toBe(isNutritionTargetsReadFailure(result))
    }
  )

  it.each([...ROUTE_MISSING_ERRORS, ...READ_FAILURE_ERRORS])(
    'reports neither for %s once the read has succeeded, because both key on isError',
    (_label, error) => {
      const result = {isError: false, error}

      expect(isNutritionTargetsRouteMissing(result)).toBe(false)
      expect(isNutritionTargetsReadFailure(result)).toBe(false)
    }
  )
})
