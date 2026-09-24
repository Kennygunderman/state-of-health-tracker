import {
  fingerprint,
  fingerprintSnapshot,
  GenerateRequestSnapshot,
  isMealPlanActionType,
  KeyedLaunchDecision,
  KeyedLaunchInput,
  LogRequestSnapshot,
  matchesFingerprint,
  MEAL_PLAN_REQUEST_METHOD,
  MealPlanActionType,
  MealPlanRequestSnapshot,
  mintKey,
  parseRequestSnapshot,
  RegenerateRequestSnapshot,
  requestBody,
  requestIds,
  requestMealId,
  requestPlanId,
  resolveKeyedLaunch,
  resolveMountReplay,
  SlotOwnership,
  snapshotMatchesScope,
  SwapRequestSnapshot
} from '../IdempotencyUtility'

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

  describe('sparse arrays', () => {
    it('distinguishes a one-hole array from an empty one, so the two cannot reuse a key', () => {
      const oneHole: unknown[] = new Array(1)
      const withHole = fingerprint('POST', 'generate', NO_IDS, {tags: oneHole})
      const empty = fingerprint('POST', 'generate', NO_IDS, {tags: []})

      expect(withHole).not.toBe(empty)
    })

    it('renders a hole as null, matching the [null] JSON sends', () => {
      const oneHole: unknown[] = new Array(1)
      const withHole = fingerprint('POST', 'generate', NO_IDS, {tags: oneHole})
      const withNull = fingerprint('POST', 'generate', NO_IDS, {tags: [null]})

      expect(withHole).toBe(withNull)
    })

    it('distinguishes a one-hole array body from an empty array body', () => {
      const oneHole: unknown[] = new Array(1)
      const withHole = fingerprint('POST', 'generate', NO_IDS, oneHole)
      const empty = fingerprint('POST', 'generate', NO_IDS, [])

      expect(withHole).not.toBe(empty)
    })

    it('matches an explicit null when the hole is the leading slot', () => {
      const holeThenValue: unknown[] = new Array(2)

      holeThenValue[1] = 'a'

      const withHole = fingerprint('POST', 'generate', NO_IDS, {tags: holeThenValue})
      const withNull = fingerprint('POST', 'generate', NO_IDS, {tags: [null, 'a']})

      expect(withHole).toBe(withNull)
    })

    it('counts a trailing hole, matching the null JSON sends in that slot', () => {
      const trailingHole: unknown[] = ['a']

      trailingHole.length = 2

      const withHole = fingerprint('POST', 'generate', NO_IDS, {tags: trailingHole})
      const withNull = fingerprint('POST', 'generate', NO_IDS, {tags: ['a', null]})

      expect(withHole).toBe(withNull)
    })

    it('distinguishes a trailing hole from an array that simply ends earlier', () => {
      const trailingHole: unknown[] = ['a']

      trailingHole.length = 2

      const withHole = fingerprint('POST', 'generate', NO_IDS, {tags: trailingHole})
      const shorter = fingerprint('POST', 'generate', NO_IDS, {tags: ['a']})

      expect(withHole).not.toBe(shorter)
    })

    it('renders every slot of a wholly sparse array as null', () => {
      const threeHoles: unknown[] = new Array(3)
      const withHoles = fingerprint('POST', 'generate', NO_IDS, {tags: threeHoles})
      const withNulls = fingerprint('POST', 'generate', NO_IDS, {tags: [null, null, null]})

      expect(withHoles).toBe(withNulls)
    })

    it('visits the holes of an array nested inside another array', () => {
      const innerHole: unknown[] = new Array(1)
      const withHole = fingerprint('POST', 'generate', NO_IDS, {tags: [[], innerHole]})
      const withNull = fingerprint('POST', 'generate', NO_IDS, {tags: [[], [null]]})

      expect(withHole).toBe(withNull)
      expect(withHole).not.toBe(fingerprint('POST', 'generate', NO_IDS, {tags: [[], []]}))
    })

    it('matches the body JSON actually sends for the same sparse array', () => {
      const withHoles: unknown[] = new Array(3)

      withHoles[0] = 'a'
      withHoles[2] = 'b'

      const body = {tags: withHoles}
      const asSentOverTheWire: unknown = JSON.parse(JSON.stringify(body))
      const fromSparseBody = fingerprint('POST', 'generate', NO_IDS, body)
      const fromWireBody = fingerprint('POST', 'generate', NO_IDS, asSentOverTheWire)

      expect(fromSparseBody).toBe(fromWireBody)
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

const generateSnapshot = (overrides: Partial<GenerateRequestSnapshot> = {}): GenerateRequestSnapshot => ({
  action: 'generate',
  startDate: '2026-07-05',
  expectedPreferencesRevision: 4,
  expectedTargetsRevision: 2,
  ...overrides
})

const regenerateSnapshot = (overrides: Partial<RegenerateRequestSnapshot> = {}): RegenerateRequestSnapshot => ({
  action: 'regenerate',
  planId: 'plan-1',
  expectedPlanRevision: 3,
  expectedPreferencesRevision: 4,
  expectedTargetsRevision: 2,
  ...overrides
})

const swapSnapshot = (overrides: Partial<SwapRequestSnapshot> = {}): SwapRequestSnapshot => ({
  action: 'swap',
  planId: 'plan-1',
  mealId: 'meal-1',
  recipeVersionId: 'rv-1',
  portionMultiplier: 1.25,
  expectedPlanRevision: 3,
  ...overrides
})

const logSnapshot = (overrides: Partial<LogRequestSnapshot> = {}): LogRequestSnapshot => ({
  action: 'log',
  planId: 'plan-1',
  mealId: 'meal-1',
  servings: 0.66,
  date: '2026-07-05',
  diaryMealId: 'dm-1',
  expectedPlanRevision: 3,
  ...overrides
})

const EVERY_SNAPSHOT: readonly MealPlanRequestSnapshot[] = [
  generateSnapshot(),
  regenerateSnapshot(),
  swapSnapshot(),
  logSnapshot()
]

// What AsyncStorage actually hands back: the record that was written, decoded from JSON. Round-tripping it is
// the difference between testing the parser and testing the object that was just built in memory.
const throughStorage = (snapshot: MealPlanRequestSnapshot): unknown => JSON.parse(JSON.stringify(snapshot))

describe('MEAL_PLAN_REQUEST_METHOD', () => {
  it('is the one method every keyed meal-planning write uses', () => {
    expect(MEAL_PLAN_REQUEST_METHOD).toBe('POST')
  })
})

describe('requestIds', () => {
  it('gives a generation no path ids, because it names no existing resource', () => {
    expect(requestIds(generateSnapshot())).toEqual([])
  })

  it('gives a regeneration the plan it replaces', () => {
    expect(requestIds(regenerateSnapshot({planId: 'plan-9'}))).toEqual(['plan-9'])
  })

  it('gives a swap the plan and the meal, in path order', () => {
    expect(requestIds(swapSnapshot({planId: 'plan-9', mealId: 'meal-9'}))).toEqual(['plan-9', 'meal-9'])
  })

  it('gives a planned log the plan and the meal, in path order', () => {
    expect(requestIds(logSnapshot({planId: 'plan-9', mealId: 'meal-9'}))).toEqual(['plan-9', 'meal-9'])
  })
})

describe('requestBody', () => {
  it('rebuilds the generate body of the plans endpoint', () => {
    expect(requestBody(generateSnapshot(), 'key-1')).toEqual({
      startDate: '2026-07-05',
      expectedPreferencesRevision: 4,
      expectedTargetsRevision: 2,
      idempotencyKey: 'key-1'
    })
  })

  it('rebuilds the regenerate body without the plan id, which the path already carries', () => {
    expect(requestBody(regenerateSnapshot(), 'key-1')).toEqual({
      expectedPlanRevision: 3,
      expectedPreferencesRevision: 4,
      expectedTargetsRevision: 2,
      idempotencyKey: 'key-1'
    })
  })

  it('rebuilds the swap body with the bound alternative and portion', () => {
    expect(requestBody(swapSnapshot(), 'key-1')).toEqual({
      recipeVersionId: 'rv-1',
      portionMultiplier: 1.25,
      expectedPlanRevision: 3,
      idempotencyKey: 'key-1'
    })
  })

  it('rebuilds the planned-log body with the eaten servings, date and diary bucket', () => {
    expect(requestBody(logSnapshot(), 'key-1')).toEqual({
      servings: 0.66,
      date: '2026-07-05',
      diaryMealId: 'dm-1',
      expectedPlanRevision: 3,
      idempotencyKey: 'key-1'
    })
  })

  it('carries whichever key the caller decided to send', () => {
    EVERY_SNAPSHOT.forEach(snapshot => {
      expect(requestBody(snapshot, 'replayed-key').idempotencyKey).toBe('replayed-key')
    })
  })

  it('never puts a path id in the body', () => {
    EVERY_SNAPSHOT.forEach(snapshot => {
      const body = requestBody(snapshot, 'key-1')

      expect(body.planId).toBeUndefined()
      expect(body.mealId).toBeUndefined()
    })
  })
})

describe('fingerprintSnapshot', () => {
  it('equals the fingerprint of the request the snapshot rebuilds', () => {
    const snapshot = swapSnapshot()

    expect(fingerprintSnapshot(snapshot)).toBe(
      fingerprint(MEAL_PLAN_REQUEST_METHOD, 'swap', requestIds(snapshot), requestBody(snapshot, 'any-key'))
    )
  })

  it('does not depend on the idempotency key, so a replay compares equal', () => {
    EVERY_SNAPSHOT.forEach(snapshot => {
      const withKey = fingerprint(
        MEAL_PLAN_REQUEST_METHOD,
        snapshot.action,
        requestIds(snapshot),
        requestBody(snapshot, 'minted-now')
      )

      expect(fingerprintSnapshot(snapshot)).toBe(withKey)
    })
  })

  it('survives a round trip through storage, which is what a cold-start replay depends on', () => {
    EVERY_SNAPSHOT.forEach(snapshot => {
      const restored = parseRequestSnapshot(throughStorage(snapshot), snapshot.action)

      expect(restored).not.toBeNull()
      expect(fingerprintSnapshot(restored as MealPlanRequestSnapshot)).toBe(fingerprintSnapshot(snapshot))
    })
  })

  it('distinguishes the four actions even where their bodies would agree', () => {
    const fingerprints = EVERY_SNAPSHOT.map(fingerprintSnapshot)

    expect(new Set(fingerprints).size).toBe(4)
  })

  describe('changes with any member of the request', () => {
    it.each([
      ['the start date', generateSnapshot({startDate: '2026-07-12'})],
      ['the preferences revision', generateSnapshot({expectedPreferencesRevision: 5})],
      ['the targets revision', generateSnapshot({expectedTargetsRevision: 3})]
    ])('%s of a generation', (_member, changed) => {
      expect(fingerprintSnapshot(changed)).not.toBe(fingerprintSnapshot(generateSnapshot()))
    })

    it.each([
      ['the plan', regenerateSnapshot({planId: 'plan-2'})],
      ['the plan revision', regenerateSnapshot({expectedPlanRevision: 4})]
    ])('%s of a regeneration', (_member, changed) => {
      expect(fingerprintSnapshot(changed)).not.toBe(fingerprintSnapshot(regenerateSnapshot()))
    })

    it.each([
      ['the chosen alternative', swapSnapshot({recipeVersionId: 'rv-2'})],
      ['the portion', swapSnapshot({portionMultiplier: 1})],
      ['the meal', swapSnapshot({mealId: 'meal-2'})],
      ['the plan revision', swapSnapshot({expectedPlanRevision: 4})]
    ])('%s of a swap', (_member, changed) => {
      expect(fingerprintSnapshot(changed)).not.toBe(fingerprintSnapshot(swapSnapshot()))
    })

    it.each([
      ['the eaten servings', logSnapshot({servings: 1})],
      ['the diary date', logSnapshot({date: '2026-07-06'})],
      ['the diary bucket', logSnapshot({diaryMealId: 'dm-2'})],
      ['the plan revision', logSnapshot({expectedPlanRevision: 4})]
    ])('%s of a planned log', (_member, changed) => {
      expect(fingerprintSnapshot(changed)).not.toBe(fingerprintSnapshot(logSnapshot()))
    })
  })
})

describe('matchesFingerprint', () => {
  it('accepts the snapshot the fingerprint was taken of', () => {
    const snapshot = logSnapshot()

    expect(matchesFingerprint(snapshot, fingerprintSnapshot(snapshot))).toBe(true)
  })

  it('rejects a snapshot whose request has changed since the key was minted', () => {
    expect(matchesFingerprint(logSnapshot({servings: 2}), fingerprintSnapshot(logSnapshot()))).toBe(false)
  })

  it('rejects a fingerprint from a different action', () => {
    expect(matchesFingerprint(swapSnapshot(), fingerprintSnapshot(logSnapshot()))).toBe(false)
  })
})

describe('parseRequestSnapshot', () => {
  it('restores every action from storage exactly as it was written', () => {
    EVERY_SNAPSHOT.forEach(snapshot => {
      expect(parseRequestSnapshot(throughStorage(snapshot), snapshot.action)).toEqual(snapshot)
    })
  })

  it('returns a value of its own rather than the stored object', () => {
    const stored = throughStorage(swapSnapshot())

    expect(parseRequestSnapshot(stored, 'swap')).not.toBe(stored)
  })

  it('refuses a snapshot filed under an action it would not reconstruct', () => {
    expect(parseRequestSnapshot(throughStorage(swapSnapshot()), 'log')).toBeNull()
    expect(parseRequestSnapshot(throughStorage(generateSnapshot()), 'regenerate')).toBeNull()
  })

  it('refuses a value that is not a JSON object', () => {
    ;[null, undefined, 'generate', 7, true, [generateSnapshot()]].forEach(value => {
      expect(parseRequestSnapshot(value, 'generate')).toBeNull()
    })
  })

  describe('refuses an incomplete record, because a missing member cannot be reconstructed', () => {
    it.each([
      ['startDate', 'generate' as MealPlanActionType, generateSnapshot()],
      ['expectedTargetsRevision', 'generate' as MealPlanActionType, generateSnapshot()],
      ['planId', 'regenerate' as MealPlanActionType, regenerateSnapshot()],
      ['recipeVersionId', 'swap' as MealPlanActionType, swapSnapshot()],
      ['portionMultiplier', 'swap' as MealPlanActionType, swapSnapshot()],
      ['diaryMealId', 'log' as MealPlanActionType, logSnapshot()],
      ['servings', 'log' as MealPlanActionType, logSnapshot()]
    ])('without %s', (member, action, snapshot) => {
      const stored = throughStorage(snapshot) as Record<string, unknown>

      delete stored[member]

      expect(parseRequestSnapshot(stored, action)).toBeNull()
    })
  })

  it('refuses a record carrying a member the contract does not have', () => {
    const stored = {...(throughStorage(logSnapshot()) as Record<string, unknown>), mealName: 'Greek yogurt bowl'}

    expect(parseRequestSnapshot(stored, 'log')).toBeNull()
  })

  describe('refuses a member whose value could not have come from this app', () => {
    it.each([
      ['a start date that is not a day key', generateSnapshot({startDate: '05/07/2026'})],
      ['an empty start date', generateSnapshot({startDate: ''})],
      ['a fractional revision', generateSnapshot({expectedPreferencesRevision: 1.5})],
      ['a negative revision', generateSnapshot({expectedTargetsRevision: -1})],
      ['a revision beyond a database integer', generateSnapshot({expectedPreferencesRevision: 2_147_483_648})],
      ['an unsafe revision', generateSnapshot({expectedTargetsRevision: 1e30})]
    ])('%s', (_case, snapshot) => {
      expect(parseRequestSnapshot(throughStorage(snapshot), 'generate')).toBeNull()
    })

    it.each([
      ['an empty plan id', regenerateSnapshot({planId: ''})],
      ['a revision beyond a database integer', regenerateSnapshot({expectedPlanRevision: 2_147_483_648})]
    ])('%s', (_case, snapshot) => {
      expect(parseRequestSnapshot(throughStorage(snapshot), 'regenerate')).toBeNull()
    })

    it.each([
      ['an empty meal id', swapSnapshot({mealId: ''})],
      ['an empty recipe version', swapSnapshot({recipeVersionId: ''})],
      ['a zero portion', swapSnapshot({portionMultiplier: 0})],
      ['a negative portion', swapSnapshot({portionMultiplier: -1})]
    ])('%s', (_case, snapshot) => {
      expect(parseRequestSnapshot(throughStorage(snapshot), 'swap')).toBeNull()
    })

    it.each([
      ['zero servings', logSnapshot({servings: 0})],
      ['negative servings', logSnapshot({servings: -1})],
      ['a date that is not a day key', logSnapshot({date: '2026-7-5'})],
      ['an empty diary bucket', logSnapshot({diaryMealId: ''})]
    ])('%s', (_case, snapshot) => {
      expect(parseRequestSnapshot(throughStorage(snapshot), 'log')).toBeNull()
    })

    it('a member of the wrong type entirely', () => {
      const stored = {...(throughStorage(swapSnapshot()) as Record<string, unknown>), portionMultiplier: '1.25'}

      expect(parseRequestSnapshot(stored, 'swap')).toBeNull()
    })

    it('a non-finite portion, which JSON stores as null', () => {
      const stored = {...(throughStorage(swapSnapshot()) as Record<string, unknown>), portionMultiplier: null}

      expect(parseRequestSnapshot(stored, 'swap')).toBeNull()
    })
  })

  it('keeps the two-decimal fractional servings the app sends', () => {
    const restored = parseRequestSnapshot(throughStorage(logSnapshot({servings: 0.33})), 'log')

    expect((restored as LogRequestSnapshot).servings).toBe(0.33)
  })

  // The action is as much a boundary value as the record: it arrives as a persisted slot key, so it can name
  // a keyed write a newer release added, or a member of `Object.prototype`. Reading the member table by that
  // name has to answer "cannot reproduce this" rather than throw, because the caller is the rehydration path
  // and an exception there aborts hydration for every slot at once.
  describe('refuses an action this release has no contract for', () => {
    it.each([
      ['an action added by a newer release', 'reorder'],
      ['the empty string', ''],
      ['a one-argument function on Object.prototype', 'hasOwnProperty'],
      ['the Object constructor', 'constructor'],
      ['a zero-argument function on Object.prototype', 'toString'],
      ['a prototype member that is not a function', '__proto__']
    ])('%s', (_case, action) => {
      const call = (): MealPlanRequestSnapshot | null =>
        parseRequestSnapshot({action}, action as unknown as MealPlanActionType)

      expect(call).not.toThrow()
      expect(call()).toBeNull()
    })

    it('refuses a full record whose discriminant is an action this release does not have', () => {
      const stored = {...(throughStorage(swapSnapshot()) as Record<string, unknown>), action: 'reorder'}

      expect(parseRequestSnapshot(stored, 'reorder' as unknown as MealPlanActionType)).toBeNull()
    })
  })
})

describe('isMealPlanActionType', () => {
  it.each([['generate'], ['regenerate'], ['swap'], ['log']])('accepts %s', action => {
    expect(isMealPlanActionType(action)).toBe(true)
  })

  // Own-property only: a plain `in` or truthiness test would accept every member of `Object.prototype` as an
  // action and hand its value to the member lookup.
  it.each([
    ['an action added by a newer release', 'reorder'],
    ['the empty string', ''],
    ['a capitalised action', 'Generate'],
    ['hasOwnProperty', 'hasOwnProperty'],
    ['constructor', 'constructor'],
    ['toString', 'toString'],
    ['__proto__', '__proto__'],
    ['valueOf', 'valueOf']
  ])('rejects %s', (_case, action) => {
    expect(isMealPlanActionType(action)).toBe(false)
  })

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 1],
    ['an object', {action: 'generate'}],
    ['an array', ['generate']]
  ])('rejects %s, which is not a name at all', (_case, value) => {
    expect(isMealPlanActionType(value)).toBe(false)
  })
})

describe('requestPlanId', () => {
  it('answers null for a generation, which precedes every plan', () => {
    expect(requestPlanId(generateSnapshot())).toBeNull()
  })

  it.each([
    ['a regeneration', regenerateSnapshot({planId: 'plan-9'})],
    ['a swap', swapSnapshot({planId: 'plan-9'})],
    ['a planned log', logSnapshot({planId: 'plan-9'})]
  ])('reports the plan %s names', (_case, snapshot) => {
    expect(requestPlanId(snapshot)).toBe('plan-9')
  })
})

describe('requestMealId', () => {
  it.each([
    ['a generation', generateSnapshot()],
    ['a regeneration', regenerateSnapshot()]
  ])('answers null for %s, which addresses the whole week', (_case, snapshot) => {
    expect(requestMealId(snapshot)).toBeNull()
  })

  it.each([
    ['a swap', swapSnapshot({mealId: 'meal-9'})],
    ['a planned log', logSnapshot({mealId: 'meal-9'})]
  ])('reports the meal %s names', (_case, snapshot) => {
    expect(requestMealId(snapshot)).toBe('meal-9')
  })
})

describe('snapshotMatchesScope', () => {
  it('matches every snapshot against an empty scope, which constrains nothing', () => {
    EVERY_SNAPSHOT.forEach(snapshot => {
      expect(snapshotMatchesScope(snapshot, {})).toBe(true)
    })
  })

  it('matches a swap on both its ids', () => {
    expect(
      snapshotMatchesScope(swapSnapshot({planId: 'plan-1', mealId: 'meal-1'}), {planId: 'plan-1', mealId: 'meal-1'})
    ).toBe(true)
  })

  // The ids are what tie a key to the resource it would commit against, so the wrong meal's screen must never
  // recognise this record: replaying it would commit that other meal's swap.
  it('rejects a swap for another meal of the same plan', () => {
    expect(
      snapshotMatchesScope(swapSnapshot({planId: 'plan-1', mealId: 'meal-1'}), {planId: 'plan-1', mealId: 'meal-2'})
    ).toBe(false)
  })

  it('rejects a swap for the same slot of another plan', () => {
    expect(
      snapshotMatchesScope(swapSnapshot({planId: 'plan-1', mealId: 'meal-1'}), {planId: 'plan-2', mealId: 'meal-1'})
    ).toBe(false)
  })

  it('matches a regeneration on its plan alone', () => {
    expect(snapshotMatchesScope(regenerateSnapshot({planId: 'plan-1'}), {planId: 'plan-1'})).toBe(true)
  })

  // Fail-closed: absence is a mismatch rather than a wildcard, so a screen that knows a plan can never adopt
  // a record that names none.
  it('rejects a generation asked about a plan, since it carries none', () => {
    expect(snapshotMatchesScope(generateSnapshot(), {planId: 'plan-1'})).toBe(false)
  })

  it('rejects a regeneration asked about a meal, since it addresses the week', () => {
    expect(snapshotMatchesScope(regenerateSnapshot({planId: 'plan-1'}), {planId: 'plan-1', mealId: 'meal-1'})).toBe(
      false
    )
  })

  it('matches a planned log on its plan and meal', () => {
    expect(
      snapshotMatchesScope(logSnapshot({planId: 'plan-1', mealId: 'meal-1'}), {planId: 'plan-1', mealId: 'meal-1'})
    ).toBe(true)
  })
})

describe('resolveMountReplay', () => {
  const READY = {intent: {key: 'key-1'}, isReady: true, isRequestInFlight: false, replayedKey: null}

  it('replays the unresolved intent once and latches its key', () => {
    expect(resolveMountReplay(READY)).toEqual({replays: true, replayedKey: 'key-1'})
  })

  it('does not replay again once that key has been sent', () => {
    expect(resolveMountReplay({...READY, replayedKey: 'key-1'})).toEqual({replays: false, replayedKey: 'key-1'})
  })

  // The latch holds a key rather than a flag precisely so this case still replays: a later attempt under a new
  // key is a new intent, and the screen that reopens on it owes it the same silent replay.
  it('replays a different key recorded after the first was sent', () => {
    expect(resolveMountReplay({...READY, intent: {key: 'key-2'}, replayedKey: 'key-1'})).toEqual({
      replays: true,
      replayedKey: 'key-2'
    })
  })

  it('does nothing when no intent is on record', () => {
    expect(resolveMountReplay({...READY, intent: null})).toEqual({replays: false, replayedKey: null})
  })

  // 'No intent' and 'not yet known' are different answers, and deciding before the persisted slice and the
  // signed-in account are known is what would mint a second key for a request the server may already hold.
  it('waits while its prerequisites are unknown, keeping the latch untouched', () => {
    expect(resolveMountReplay({...READY, isReady: false})).toEqual({replays: false, replayedKey: null})
  })

  it('leaves an existing latch alone while it waits', () => {
    expect(resolveMountReplay({...READY, isReady: false, replayedKey: 'key-0'})).toEqual({
      replays: false,
      replayedKey: 'key-0'
    })
  })

  // An attempt already on the wire is the same ask; firing a second would race two answers for one key.
  it('does not replay while a request is in flight', () => {
    expect(resolveMountReplay({...READY, isRequestInFlight: true})).toEqual({replays: false, replayedKey: null})
  })
})

describe('resolveKeyedLaunch', () => {
  const launch = (overrides: Partial<KeyedLaunchInput> = {}): KeyedLaunchDecision =>
    resolveKeyedLaunch({ownership: 'free', isHydrated: true, isRequestInFlight: false, ...overrides})

  it('mints for a request nothing is on record for', () => {
    expect(launch()).toEqual({kind: 'mint'})
  })

  it('replays the caller own unresolved request instead of minting beside it', () => {
    expect(launch({ownership: 'mine'})).toEqual({kind: 'replay'})
  })

  // The case the duplicate-write findings turn on: the action holds ONE slot, so a request from another plan
  // or meal is refused rather than allowed to mint over the key that slot already holds.
  it('blocks a launch while another resource holds the slot', () => {
    expect(launch({ownership: 'foreign'})).toEqual({kind: 'blocked', reason: 'otherResource'})
  })

  // A pending read and a refused one are both "not hydrated", and both fail closed: an unread slice may
  // already hold a key for this action, and minting beside it is the duplicate this contract prevents.
  it('blocks every launch until the persisted slice has been read successfully', () => {
    const ownerships: SlotOwnership[] = ['free', 'mine', 'foreign']

    ownerships.forEach(ownership =>
      expect(launch({ownership, isHydrated: false})).toEqual({kind: 'blocked', reason: 'hydrating'})
    )
  })

  it('blocks a launch while an attempt for this action is already on the wire', () => {
    expect(launch({isRequestInFlight: true})).toEqual({kind: 'blocked', reason: 'inFlight'})
    expect(launch({ownership: 'mine', isRequestInFlight: true})).toEqual({kind: 'blocked', reason: 'inFlight'})
  })

  // Precedence runs from least to most knowledge, so the reason reported is the one furthest upstream.
  it('reports hydration ahead of an in-flight request, and an in-flight request ahead of a foreign holder', () => {
    expect(launch({ownership: 'foreign', isHydrated: false, isRequestInFlight: true})).toEqual({
      kind: 'blocked',
      reason: 'hydrating'
    })
    expect(launch({ownership: 'foreign', isRequestInFlight: true})).toEqual({kind: 'blocked', reason: 'inFlight'})
  })
})
