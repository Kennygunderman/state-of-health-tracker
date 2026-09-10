import {fingerprint, MealPlanActionType, mintKey} from '../IdempotencyUtility'

interface GenerateBody {
  startDate: string
  expectedPreferencesRevision: number
  expectedTargetsRevision: number
  idempotencyKey: string
}

interface SwapBody {
  recipeVersionId: string
  portionMultiplier: number
  expectedPlanRevision: number
  idempotencyKey: string
}

interface LogBody {
  servings: number
  date: string
  diaryMealId: string
  expectedPlanRevision: number
  idempotencyKey: string
}

const NO_IDS: readonly string[] = []

const PLAN_MEAL_IDS: readonly string[] = ['plan-1', 'meal-1']

const makeGenerateBody = (overrides: Partial<GenerateBody> = {}): GenerateBody => ({
  startDate: '2026-07-05',
  expectedPreferencesRevision: 2,
  expectedTargetsRevision: 5,
  idempotencyKey: 'k1',
  ...overrides
})

const makeSwapBody = (overrides: Partial<SwapBody> = {}): SwapBody => ({
  recipeVersionId: 'rv-1',
  portionMultiplier: 1,
  expectedPlanRevision: 3,
  idempotencyKey: 'k1',
  ...overrides
})

const makeLogBody = (overrides: Partial<LogBody> = {}): LogBody => ({
  servings: 1,
  date: '2026-07-08',
  diaryMealId: 'dm-1',
  expectedPlanRevision: 3,
  idempotencyKey: 'k1',
  ...overrides
})

describe('mintKey', () => {
  it('returns the key produced by the injected source', () => {
    expect(mintKey(() => 'abc')).toBe('abc')
  })

  it('returns a string', () => {
    expect(typeof mintKey(() => 'abc')).toBe('string')
  })

  it('asks the source for a new key on every mint rather than caching the first one', () => {
    let calls = 0
    const countingSource = (): string => {
      calls += 1

      return `key-${calls}`
    }
    const minted = [mintKey(countingSource), mintKey(countingSource), mintKey(countingSource)]

    expect(minted).toEqual(['key-1', 'key-2', 'key-3'])
    expect(calls).toBe(3)
  })
})

describe('fingerprint', () => {
  describe('key-order independence', () => {
    it('sorts top-level and nested object keys', () => {
      const ascending = fingerprint('POST', 'generate', ['p1'], {a: 1, b: {x: 1, y: 2}})
      const shuffled = fingerprint('POST', 'generate', ['p1'], {b: {y: 2, x: 1}, a: 1})

      expect(ascending).toBe(shuffled)
    })

    it('sorts keys at every level of a three-level body', () => {
      const ascending = fingerprint('POST', 'generate', NO_IDS, {a: {b: {c: 1, d: 2}, e: 3}, f: 4})
      const shuffled = fingerprint('POST', 'generate', NO_IDS, {f: 4, a: {e: 3, b: {d: 2, c: 1}}})

      expect(ascending).toBe(shuffled)
    })

    it('sorts the keys of an object nested inside an array element', () => {
      const ascending = fingerprint('POST', 'generate', NO_IDS, {items: [{x: 1, y: 2}]})
      const shuffled = fingerprint('POST', 'generate', NO_IDS, {items: [{y: 2, x: 1}]})

      expect(ascending).toBe(shuffled)
    })
  })

  describe('the idempotency key is excluded', () => {
    it('is unchanged when only the key differs, letting a cold start replay its stored key', () => {
      const first = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({idempotencyKey: 'key-one'}))
      const second = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({idempotencyKey: 'key-two'}))

      expect(first).toBe(second)
    })

    it('changes when the expected plan revision changes, so the caller must mint a fresh key', () => {
      const atRevisionThree = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({expectedPlanRevision: 3}))
      const atRevisionFour = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({expectedPlanRevision: 4}))

      expect(atRevisionThree).not.toBe(atRevisionFour)
    })

    it('changes when the servings change, so the caller must mint a fresh key', () => {
      const oneServing = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({servings: 1}))
      const oneAndAHalf = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({servings: 1.5}))

      expect(oneServing).not.toBe(oneAndAHalf)
    })

    it('changes when the date changes, so the caller must mint a fresh key', () => {
      const eighth = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({date: '2026-07-08'}))
      const ninth = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({date: '2026-07-09'}))

      expect(eighth).not.toBe(ninth)
    })

    it('changes when a new key accompanies a real change, so excluding the key masks nothing', () => {
      const original = makeLogBody({idempotencyKey: 'key-one', expectedPlanRevision: 3})
      const edited = makeLogBody({idempotencyKey: 'key-two', expectedPlanRevision: 4})

      expect(fingerprint('POST', 'log', PLAN_MEAL_IDS, original)).not.toBe(
        fingerprint('POST', 'log', PLAN_MEAL_IDS, edited)
      )
    })

    it('excludes the key at every depth of the body', () => {
      const withNestedKey = fingerprint('POST', 'log', NO_IDS, {a: {idempotencyKey: 'k1', b: 1}})
      const withoutNestedKey = fingerprint('POST', 'log', NO_IDS, {a: {b: 1}})

      expect(withNestedKey).toBe(withoutNestedKey)
    })

    it('reduces a body carrying nothing but the key to an empty body', () => {
      const keyOnly = fingerprint('POST', 'generate', NO_IDS, {idempotencyKey: 'k1'})
      const empty = fingerprint('POST', 'generate', NO_IDS, {})

      expect(keyOnly).toBe(empty)
    })
  })

  describe('canonicalisation', () => {
    it('treats the path ids as a path, so their order matters', () => {
      const planThenMeal = fingerprint('POST', 'swap', ['plan-1', 'meal-1'], makeSwapBody())
      const mealThenPlan = fingerprint('POST', 'swap', ['meal-1', 'plan-1'], makeSwapBody())

      expect(planThenMeal).not.toBe(mealThenPlan)
    })

    it('distinguishes a request with no path ids from one carrying an id', () => {
      const collection = fingerprint('POST', 'generate', NO_IDS, {a: 1})
      const resource = fingerprint('POST', 'generate', ['plan-1'], {a: 1})

      expect(collection).not.toBe(resource)
    })

    it('normalises the method case', () => {
      const lowerCase = fingerprint('post', 'generate', NO_IDS, {a: 1})
      const upperCase = fingerprint('POST', 'generate', NO_IDS, {a: 1})

      expect(lowerCase).toBe(upperCase)
    })

    it('distinguishes one method from another', () => {
      const post = fingerprint('POST', 'generate', NO_IDS, {a: 1})
      const put = fingerprint('PUT', 'generate', NO_IDS, {a: 1})

      expect(post).not.toBe(put)
    })

    it('distinguishes generate from regenerate', () => {
      const generate = fingerprint('POST', 'generate', ['plan-1'], {a: 1})
      const regenerate = fingerprint('POST', 'regenerate', ['plan-1'], {a: 1})

      expect(generate).not.toBe(regenerate)
    })

    it('distinguishes every action type from the others', () => {
      const actions: MealPlanActionType[] = ['generate', 'regenerate', 'swap', 'log']
      const fingerprints = actions.map(action => fingerprint('POST', action, ['plan-1'], {a: 1}))

      expect(new Set(fingerprints).size).toBe(actions.length)
    })

    it('preserves array order, because an array is ordered data', () => {
      const ascending = fingerprint('POST', 'generate', NO_IDS, {tags: ['a', 'b']})
      const descending = fingerprint('POST', 'generate', NO_IDS, {tags: ['b', 'a']})

      expect(ascending).not.toBe(descending)
    })

    it('drops an undefined member', () => {
      const withUndefined = fingerprint('POST', 'generate', NO_IDS, {a: 1, b: undefined})
      const without = fingerprint('POST', 'generate', NO_IDS, {a: 1})

      expect(withUndefined).toBe(without)
    })

    it('drops an undefined member nested inside another member', () => {
      const withUndefined = fingerprint('POST', 'generate', NO_IDS, {a: {b: 1, c: undefined}})
      const without = fingerprint('POST', 'generate', NO_IDS, {a: {b: 1}})

      expect(withUndefined).toBe(without)
    })

    it('renders undefined in an array slot as null, matching JSON', () => {
      const withUndefined = fingerprint('POST', 'generate', NO_IDS, {tags: [undefined, 'a']})
      const withNull = fingerprint('POST', 'generate', NO_IDS, {tags: [null, 'a']})

      expect(withUndefined).toBe(withNull)
    })

    it('keeps a null member and distinguishes it from an absent one', () => {
      const withNull = fingerprint('POST', 'generate', NO_IDS, {a: 1, b: null})
      const absent = fingerprint('POST', 'generate', NO_IDS, {a: 1})

      expect(withNull).not.toBe(absent)
    })

    it('distinguishes a null member from zero', () => {
      const withNull = fingerprint('POST', 'generate', NO_IDS, {a: 1, b: null})
      const withZero = fingerprint('POST', 'generate', NO_IDS, {a: 1, b: 0})

      expect(withNull).not.toBe(withZero)
    })

    it('distinguishes a null member from an empty string', () => {
      const withNull = fingerprint('POST', 'generate', NO_IDS, {a: 1, b: null})
      const withEmptyString = fingerprint('POST', 'generate', NO_IDS, {a: 1, b: ''})

      expect(withNull).not.toBe(withEmptyString)
    })

    it('returns a string for a primitive body without throwing', () => {
      expect(() => fingerprint('POST', 'generate', NO_IDS, 1)).not.toThrow()
      expect(() => fingerprint('POST', 'generate', NO_IDS, 'x')).not.toThrow()
      expect(typeof fingerprint('POST', 'generate', NO_IDS, 1)).toBe('string')
      expect(typeof fingerprint('POST', 'generate', NO_IDS, 'x')).toBe('string')
    })

    it('returns a string for an undefined or null body without throwing', () => {
      expect(() => fingerprint('POST', 'generate', NO_IDS, undefined)).not.toThrow()
      expect(() => fingerprint('POST', 'generate', NO_IDS, null)).not.toThrow()
      expect(typeof fingerprint('POST', 'generate', NO_IDS, undefined)).toBe('string')
      expect(typeof fingerprint('POST', 'generate', NO_IDS, null)).toBe('string')
    })

    it('treats an undefined body and a null body as the same request', () => {
      const undefinedBody = fingerprint('POST', 'generate', NO_IDS, undefined)
      const nullBody = fingerprint('POST', 'generate', NO_IDS, null)

      expect(undefinedBody).toBe(nullBody)
    })

    it('returns a string for an empty body with no path ids', () => {
      expect(() => fingerprint('POST', 'generate', NO_IDS, {})).not.toThrow()
      expect(() => fingerprint('POST', 'generate', NO_IDS, [])).not.toThrow()
      expect(typeof fingerprint('POST', 'generate', NO_IDS, {})).toBe('string')
      expect(typeof fingerprint('POST', 'generate', NO_IDS, [])).toBe('string')
    })

    it('distinguishes an empty object body from an empty array body', () => {
      const emptyObject = fingerprint('POST', 'generate', NO_IDS, {})
      const emptyArray = fingerprint('POST', 'generate', NO_IDS, [])

      expect(emptyObject).not.toBe(emptyArray)
    })
  })

  describe('purity and persistence', () => {
    it('leaves the body it is given unmutated and unreordered', () => {
      const body = {servings: 1, nested: {z: 1, a: 2}, tags: ['b', 'a'], idempotencyKey: 'k1'}

      fingerprint('POST', 'log', PLAN_MEAL_IDS, body)

      expect(body).toEqual({servings: 1, nested: {z: 1, a: 2}, tags: ['b', 'a'], idempotencyKey: 'k1'})
      expect(Object.keys(body)).toEqual(['servings', 'nested', 'tags', 'idempotencyKey'])
      expect(Object.keys(body.nested)).toEqual(['z', 'a'])
      expect(body.tags).toEqual(['b', 'a'])
    })

    it('matches after the JSON round trip a persisted intent makes across a cold start', () => {
      const body = {
        servings: 1.25,
        absent: undefined,
        empty: null,
        nested: {z: 1, a: [1, {q: 2, p: 3}]},
        idempotencyKey: 'k1'
      }
      const rehydrated: unknown = JSON.parse(JSON.stringify(body))
      const beforeRestart = fingerprint('POST', 'log', PLAN_MEAL_IDS, body)
      const afterRestart = fingerprint('POST', 'log', PLAN_MEAL_IDS, rehydrated)

      expect(beforeRestart).toBe(afterRestart)
    })

    it('returns the identical string for identical arguments', () => {
      const first = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody())
      const second = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody())

      expect(first).toBe(second)
    })
  })
})

describe('real request payloads', () => {
  describe('generate', () => {
    it('is unchanged when only the key differs', () => {
      const first = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({idempotencyKey: 'k1'}))
      const second = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({idempotencyKey: 'k2'}))

      expect(first).toBe(second)
    })

    it('changes when the start date changes', () => {
      const fifth = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({startDate: '2026-07-05'}))
      const twelfth = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({startDate: '2026-07-12'}))

      expect(fifth).not.toBe(twelfth)
    })

    it('changes when the expected preferences revision changes', () => {
      const atTwo = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({expectedPreferencesRevision: 2}))
      const atThree = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({expectedPreferencesRevision: 3}))

      expect(atTwo).not.toBe(atThree)
    })

    it('changes when the expected targets revision changes', () => {
      const atFive = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({expectedTargetsRevision: 5}))
      const atSix = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody({expectedTargetsRevision: 6}))

      expect(atFive).not.toBe(atSix)
    })
  })

  describe('swap', () => {
    it('is unchanged when only the key differs', () => {
      const first = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({idempotencyKey: 'k1'}))
      const second = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({idempotencyKey: 'k2'}))

      expect(first).toBe(second)
    })

    it('changes when the chosen recipe version changes', () => {
      const first = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({recipeVersionId: 'rv-1'}))
      const second = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({recipeVersionId: 'rv-2'}))

      expect(first).not.toBe(second)
    })

    it('changes when the portion multiplier changes', () => {
      const wholePortion = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({portionMultiplier: 1}))
      const largerPortion = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({portionMultiplier: 1.25}))

      expect(wholePortion).not.toBe(largerPortion)
    })

    it('changes when the expected plan revision changes', () => {
      const atThree = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({expectedPlanRevision: 3}))
      const atFour = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody({expectedPlanRevision: 4}))

      expect(atThree).not.toBe(atFour)
    })

    it('changes when the plan and meal ids are transposed', () => {
      const planThenMeal = fingerprint('POST', 'swap', ['plan-1', 'meal-1'], makeSwapBody())
      const mealThenPlan = fingerprint('POST', 'swap', ['meal-1', 'plan-1'], makeSwapBody())

      expect(planThenMeal).not.toBe(mealThenPlan)
    })
  })

  describe('log', () => {
    it('is unchanged when only the key differs', () => {
      const first = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({idempotencyKey: 'k1'}))
      const second = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({idempotencyKey: 'k2'}))

      expect(first).toBe(second)
    })

    it('changes when the eaten servings change', () => {
      const oneServing = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({servings: 1}))
      const oneAndAHalf = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({servings: 1.5}))

      expect(oneServing).not.toBe(oneAndAHalf)
    })

    it('changes when a fractional serving changes', () => {
      const aThird = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({servings: 0.33}))
      const twoThirds = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({servings: 0.66}))

      expect(aThird).not.toBe(twoThirds)
    })

    it('changes when the diary date changes', () => {
      const eighth = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({date: '2026-07-08'}))
      const ninth = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({date: '2026-07-09'}))

      expect(eighth).not.toBe(ninth)
    })

    it('changes when the diary meal changes', () => {
      const breakfast = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({diaryMealId: 'dm-1'}))
      const lunch = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody({diaryMealId: 'dm-2'}))

      expect(breakfast).not.toBe(lunch)
    })
  })

  it('never collides across the generate, swap and log shapes', () => {
    const generate = fingerprint('POST', 'generate', NO_IDS, makeGenerateBody())
    const swap = fingerprint('POST', 'swap', PLAN_MEAL_IDS, makeSwapBody())
    const log = fingerprint('POST', 'log', PLAN_MEAL_IDS, makeLogBody())

    expect(new Set([generate, swap, log]).size).toBe(3)
  })
})
