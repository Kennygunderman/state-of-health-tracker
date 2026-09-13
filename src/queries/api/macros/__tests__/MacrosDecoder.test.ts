import {DailyMacrosResponse, MealEntryResponse} from '@queries/api/macros/decoder/MacrosDecoder'
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

    it('leaves both meal planning keys off the decoded entry instead of assigning them as undefined', () => {
      const entry = expectRight(MealEntryResponse.decode(makeEntryPayload()))

      expect('mealPlanMealId' in entry).toBe(false)
      expect('nutritionProvenance' in entry).toBe(false)
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

  // loggedAt orders the entries of a meal and dates the diary row, so it is validated as an instant rather
  // than taken as any string: the server sends one Date.toISOString() value and nothing else is meaningful.
  describe('loggedAt', () => {
    it('accepts the instants the server sends', () => {
      const forms = [
        '2026-07-05T12:00:00.000Z',
        '2026-07-05T12:00:00Z',
        '2026-07-05T14:00:00+02:00',
        '2024-02-29T23:59:59.999Z'
      ]

      forms.forEach(loggedAt => expect(isRight(MealEntryResponse.decode(makeEntryPayload({loggedAt})))).toBe(true))
    })

    it('refuses a value that names no point in time', () => {
      const forms = [
        '2026-07-05T12:00:00',
        '2026-07-05',
        '2026-02-30T12:00:00.000Z',
        '2026-07-05T24:00:00.000Z',
        'not-a-date',
        '',
        1783254600000,
        null
      ]

      forms.forEach(loggedAt => expect(isLeft(MealEntryResponse.decode(makeEntryPayload({loggedAt})))).toBe(true))
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

// The diary's date is the key every macro query is cached under and the value the meal-plan screens compare
// their planned dates against, so a malformed one is refused rather than trusted as a day.
describe('DailyMacrosResponse', () => {
  const makeDayPayload = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    date: '2026-07-05',
    meals: [
      {
        id: 'meal-breakfast',
        name: 'Breakfast',
        sortOrder: 0,
        entries: [makeEntryPayload()],
        totals: {calories: 420, protein: 32, carbs: 44, fat: 11}
      }
    ],
    totals: {calories: 420, protein: 32, carbs: 44, fat: 11},
    targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
    ...overrides
  })

  it('decodes a day whose date is a real calendar day', () => {
    const day = expectRight(DailyMacrosResponse.decode(makeDayPayload()))

    expect(day.date).toBe('2026-07-05')
    expect(day.meals[0].entries[0].name).toBe('Greek yogurt bowl')
  })

  it('accepts a leap-year February 29th', () => {
    expect(isRight(DailyMacrosResponse.decode(makeDayPayload({date: '2024-02-29'})))).toBe(true)
  })

  it('refuses a date that is malformed or not a real day', () => {
    const forms = ['2026-02-30', '2026-13-01', '2026-07-5', '2026/07/05', 'today', '', 20260705, null]

    forms.forEach(date => expect(isLeft(DailyMacrosResponse.decode(makeDayPayload({date})))).toBe(true))
  })

  it('keeps a per-field-nullable target block decodable', () => {
    const day = expectRight(
      DailyMacrosResponse.decode(makeDayPayload({targets: {calories: 1900, protein: null, carbs: null, fat: null}}))
    )

    expect(day.targets.calories).toBe(1900)
    expect(day.targets.protein).toBeNull()
  })
})
