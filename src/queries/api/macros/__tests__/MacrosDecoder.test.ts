import {MealEntryResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import {Either, isLeft, isRight} from 'fp-ts/lib/Either'

const PLANNED_MEAL_ID = '8f14e45f-ceea-467a-9e2d-1f2a3b4c5d6e'

const makeEntryPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'entry-1',
  foodId: 'food-1',
  name: 'Greek yogurt bowl',
  servingText: '1 serving',
  servings: 1,
  calories: 420,
  protein: 32,
  carbs: 44,
  fat: 11,
  inputMethod: 'library',
  loggedAt: '2026-07-05T12:00:00.000Z',
  ...overrides
})

const makeEntryPayloadWithout = (key: string): Record<string, unknown> => {
  const payload = makeEntryPayload()

  delete payload[key]

  return payload
}

const expectRight = <A>(decoded: Either<unknown, A>): A => {
  if (isLeft(decoded)) {
    throw new Error(`expected a Right, received: ${JSON.stringify(decoded.left)}`)
  }

  return decoded.right
}

describe('MealEntryResponse', () => {
  describe('a payload from a server that predates meal planning', () => {
    it('decodes a payload that omits both meal planning members', () => {
      const decoded = MealEntryResponse.decode(makeEntryPayload())
      const entry = expectRight(decoded)

      expect(isRight(decoded)).toBe(true)
      expect(entry.mealPlanMealId).toBeUndefined()
      expect(entry.nutritionProvenance).toBeUndefined()
    })

    it('carries every legacy member through unchanged', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload()))

      expect(entry.id).toBe('entry-1')
      expect(entry.foodId).toBe('food-1')
      expect(entry.name).toBe('Greek yogurt bowl')
      expect(entry.servingText).toBe('1 serving')
      expect(entry.servings).toBe(1)
      expect(entry.calories).toBe(420)
      expect(entry.protein).toBe(32)
      expect(entry.carbs).toBe(44)
      expect(entry.fat).toBe(11)
      expect(entry.inputMethod).toBe('library')
      expect(entry.loggedAt).toBe('2026-07-05T12:00:00.000Z')
    })

    it('decodes an entry that carries no food id', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload({foodId: null})))

      expect(entry.foodId).toBeNull()
    })

    it('decodes an entry that carries no serving text', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload({servingText: null})))

      expect(entry.servingText).toBeNull()
    })
  })

  describe('mealPlanMealId', () => {
    it('decodes an absent member as undefined', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload()))

      expect(entry.mealPlanMealId).toBeUndefined()
    })

    it('decodes the explicit null the server sends for a legacy row', () => {
      const decoded = MealEntryResponse.decode(makeEntryPayload({mealPlanMealId: null}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).mealPlanMealId).toBeNull()
    })

    it('carries a populated identifier through unchanged', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload({mealPlanMealId: PLANNED_MEAL_ID})))

      expect(entry.mealPlanMealId).toBe(PLANNED_MEAL_ID)
    })
  })

  describe('nutritionProvenance', () => {
    it('decodes an absent member as undefined', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload()))

      expect(entry.nutritionProvenance).toBeUndefined()
    })

    it('decodes the explicit null the server sends for a legacy row', () => {
      const decoded = MealEntryResponse.decode(makeEntryPayload({nutritionProvenance: null}))

      expect(isRight(decoded)).toBe(true)
      expect(expectRight(decoded).nutritionProvenance).toBeNull()
    })

    it('carries a recognised provenance through unchanged', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload({nutritionProvenance: 'source_backed'})))

      expect(entry.nutritionProvenance).toBe('source_backed')
    })

    it('carries a provenance it does not recognise through verbatim', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload({nutritionProvenance: 'lab_measured'})))

      expect(entry.nutritionProvenance).toBe('lab_measured')
    })
  })

  describe('invalid payloads', () => {
    it('rejects a payload that is missing a required member', () => {
      const decoded = MealEntryResponse.decode(makeEntryPayloadWithout('id'))

      expect(isLeft(decoded)).toBe(true)
    })

    it('rejects a legacy member of the wrong type', () => {
      const decoded = MealEntryResponse.decode(makeEntryPayload({calories: '420'}))

      expect(isLeft(decoded)).toBe(true)
    })

    it('rejects a mealPlanMealId of the wrong type', () => {
      const decoded = MealEntryResponse.decode(makeEntryPayload({mealPlanMealId: 42}))

      expect(isLeft(decoded)).toBe(true)
    })
  })
})
