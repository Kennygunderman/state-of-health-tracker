import {InputMethodEnum, LogCatalogMealEntryPayload, LogMealEntryPayload} from '@data/models/MealEntry'
import {MealEntryResponse} from '@queries/api/macros/decoder/MacrosDecoder'
import {httpPost} from '@service/http/httpUtil'
import CrashUtility from '@utility/CrashUtility'
import * as io from 'io-ts'

import Endpoints from '@constants/endpoints'

import {logMealEntry} from '../logMealEntry'

// Stubbed because the transport reaches the native Firebase auth module for its bearer token and the crash
// reporter reaches native Crashlytics at require time, both of which throw under Jest; the endpoint registry,
// the response codec and the response converter all stay real, so this suite pins the actual request contract.
jest.mock('@service/http/httpUtil', () => ({
  httpPost: jest.fn()
}))

jest.mock('@utility/CrashUtility', () => ({
  __esModule: true,
  default: {recordError: jest.fn()}
}))

const mockHttpPost = jest.mocked(httpPost)
const mockRecordError = jest.mocked(CrashUtility.recordError)

const MEAL_ID = '3f6c1b52-8d47-4f0a-9a21-7c5e0b8d1e44'

// Pinned as a literal rather than read back from Endpoints, so moving the route fails this suite instead of
// silently following the change.
const ENTRIES_PATH = `/macros/meal/${MEAL_ID}/entries`

const LEGACY_PAYLOAD: LogMealEntryPayload = {
  foodId: 'food-1',
  name: 'Greek yogurt bowl',
  servingText: '1 serving',
  servings: 1.5,
  calories: 420,
  protein: 32,
  carbs: 44,
  fat: 11,
  inputMethod: InputMethodEnum.LIBRARY
}

// Names a portion explicitly, which the server honours only when the text equals one of that
// food's stored portion descriptions.
const CATALOG_PAYLOAD: LogCatalogMealEntryPayload = {
  catalogFoodId: 'catalog-food-1',
  servings: 2,
  servingText: '1 cup',
  inputMethod: InputMethodEnum.SEARCH
}

// What Food Detail actually sends: no portion text, so the server uses the food's default portion
// for both the stored label and the stored per-serving macros.
const DEFAULT_PORTION_CATALOG_PAYLOAD: LogCatalogMealEntryPayload = {
  catalogFoodId: 'catalog-food-2',
  servings: 1,
  inputMethod: InputMethodEnum.SEARCH
}

type WireEntry = io.TypeOf<typeof MealEntryResponse>

const LEGACY_WIRE_ENTRY: WireEntry = {
  id: 'entry-1',
  foodId: 'food-1',
  name: 'Greek yogurt bowl',
  servingText: '1 serving',
  servings: 1.5,
  calories: 420,
  protein: 32,
  carbs: 44,
  fat: 11,
  inputMethod: 'library',
  loggedAt: '2026-07-05T12:00:00.000Z',
  mealPlanMealId: null,
  nutritionProvenance: null
}

const PLANNED_WIRE_ENTRY: WireEntry = {
  ...LEGACY_WIRE_ENTRY,
  id: 'entry-2',
  inputMethod: 'meal_plan',
  mealPlanMealId: 'meal-plan-meal-1',
  nutritionProvenance: 'source_backed'
}

// A server that predates meal planning omits both members rather than sending null.
const PRE_MEAL_PLANNING_WIRE_ENTRY: WireEntry = {
  id: 'entry-3',
  foodId: 'food-1',
  name: 'Greek yogurt bowl',
  servingText: '1 serving',
  servings: 1.5,
  calories: 420,
  protein: 32,
  carbs: 44,
  fat: 11,
  inputMethod: 'library',
  loggedAt: '2026-07-05T12:00:00.000Z'
}

const resolveWith = (status: number, data: unknown): void => {
  mockHttpPost.mockResolvedValue({status, data})
}

const postedCall = (): [string, unknown, unknown] => {
  const call = mockHttpPost.mock.calls[0]

  return [call[0], call[1], call[2]]
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('logMealEntry', () => {
  describe('the request, for a legacy macro-bearing payload', () => {
    it('posts to the meal-entries endpoint of the given meal', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      const [url] = postedCall()

      expect(url).toBe(Endpoints.MacroMealEntries(MEAL_ID))
      expect(url.endsWith(ENTRIES_PATH)).toBe(true)
    })

    it('validates the response with the shared MealEntryResponse codec', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      const [, decoder] = postedCall()

      expect(decoder).toBe(MealEntryResponse)
    })

    it('passes the payload object through to the transport by reference', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      const [, , body] = postedCall()

      expect(body).toBe(LEGACY_PAYLOAD)
    })

    it('adds, removes and renames no member of the legacy body', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      const [, , body] = postedCall()

      expect(Object.keys(body as object).sort()).toEqual([
        'calories',
        'carbs',
        'fat',
        'foodId',
        'inputMethod',
        'name',
        'protein',
        'servingText',
        'servings'
      ])
      expect(body).toEqual({
        foodId: 'food-1',
        name: 'Greek yogurt bowl',
        servingText: '1 serving',
        servings: 1.5,
        calories: 420,
        protein: 32,
        carbs: 44,
        fat: 11,
        inputMethod: 'library'
      })
    })

    it('sends one request carrying only the url, the codec and the body', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      expect(mockHttpPost).toHaveBeenCalledTimes(1)
      expect(mockHttpPost.mock.calls[0]).toHaveLength(3)
    })
  })

  describe('the request, for a catalog payload', () => {
    it('posts to the same meal-entries endpoint', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, CATALOG_PAYLOAD)

      const [url, decoder] = postedCall()

      expect(url).toBe(Endpoints.MacroMealEntries(MEAL_ID))
      expect(url.endsWith(ENTRIES_PATH)).toBe(true)
      expect(decoder).toBe(MealEntryResponse)
    })

    it('passes the payload object through to the transport by reference', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, CATALOG_PAYLOAD)

      const [, , body] = postedCall()

      expect(body).toBe(CATALOG_PAYLOAD)
    })

    it('sends exactly the catalog members — an id, servings, serving text and the search input method', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, CATALOG_PAYLOAD)

      const [, , body] = postedCall()

      expect(Object.keys(body as object).sort()).toEqual(['catalogFoodId', 'inputMethod', 'servingText', 'servings'])
      expect(body).toEqual({
        catalogFoodId: 'catalog-food-1',
        servings: 2,
        servingText: '1 cup',
        inputMethod: 'search'
      })
    })

    it('carries no foodId, name or macro member the server would reject', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, CATALOG_PAYLOAD)

      const [, , body] = postedCall()

      expect(body).not.toHaveProperty('foodId')
      expect(body).not.toHaveProperty('name')
      expect(body).not.toHaveProperty('calories')
      expect(body).not.toHaveProperty('protein')
      expect(body).not.toHaveProperty('carbs')
      expect(body).not.toHaveProperty('fat')
    })

    it('sends one request carrying only the url, the codec and the body', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, CATALOG_PAYLOAD)

      expect(mockHttpPost).toHaveBeenCalledTimes(1)
      expect(mockHttpPost.mock.calls[0]).toHaveLength(3)
    })

    // The server accepts a servingText only when it equals one of the food's stored portion
    // descriptions and otherwise derives the canonical one, so a body that omits the member must
    // reach the transport with the key still absent rather than as an empty or reconstructed value.
    it('forwards a body that names no portion with the member still absent', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, DEFAULT_PORTION_CATALOG_PAYLOAD)

      const [, , body] = postedCall()

      expect(body).toBe(DEFAULT_PORTION_CATALOG_PAYLOAD)
      expect('servingText' in (body as object)).toBe(false)
      expect(Object.keys(body as object).sort()).toEqual(['catalogFoodId', 'inputMethod', 'servings'])
    })
  })

  describe('the resolved entry', () => {
    it('resolves the converted entry on 201 Created', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await expect(logMealEntry(MEAL_ID, LEGACY_PAYLOAD)).resolves.toEqual({
        id: 'entry-1',
        foodId: 'food-1',
        name: 'Greek yogurt bowl',
        servingText: '1 serving',
        servings: 1.5,
        calories: 420,
        protein: 32,
        carbs: 44,
        fat: 11,
        inputMethod: InputMethodEnum.LIBRARY,
        loggedAt: '2026-07-05T12:00:00.000Z',
        mealPlanMealId: null,
        nutritionProvenance: null
      })
    })

    it('accepts a 200 OK response from an idempotent replay', async () => {
      resolveWith(200, LEGACY_WIRE_ENTRY)

      const entry = await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      expect(entry.id).toBe('entry-1')
      expect(entry.inputMethod).toBe(InputMethodEnum.LIBRARY)
    })

    it('carries the meal-plan origin and provenance of a planned entry', async () => {
      resolveWith(201, PLANNED_WIRE_ENTRY)

      const entry = await logMealEntry(MEAL_ID, CATALOG_PAYLOAD)

      expect(entry.inputMethod).toBe(InputMethodEnum.MEAL_PLAN)
      expect(entry.mealPlanMealId).toBe('meal-plan-meal-1')
      expect(entry.nutritionProvenance).toBe('source_backed')
    })

    it('defaults both meal-planning members to null when the response omits them', async () => {
      resolveWith(201, PRE_MEAL_PLANNING_WIRE_ENTRY)

      const entry = await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      expect(entry.mealPlanMealId).toBeNull()
      expect(entry.nutritionProvenance).toBeNull()
    })

    it('degrades an input method it does not know to the library method', async () => {
      resolveWith(201, {...LEGACY_WIRE_ENTRY, inputMethod: 'voice_dictation'})

      const entry = await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      expect(entry.inputMethod).toBe(InputMethodEnum.LIBRARY)
    })

    it('records nothing with the crash reporter on a successful call', async () => {
      resolveWith(201, LEGACY_WIRE_ENTRY)

      await logMealEntry(MEAL_ID, LEGACY_PAYLOAD)

      expect(mockRecordError).not.toHaveBeenCalled()
    })
  })

  describe('a response the endpoint should never return', () => {
    it('rejects and reports an unexpected status', async () => {
      resolveWith(500, LEGACY_WIRE_ENTRY)

      await expect(logMealEntry(MEAL_ID, LEGACY_PAYLOAD)).rejects.toThrow(
        'Unexpected response logging entry: status=500'
      )
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('rejects and reports a success status that carries no entry', async () => {
      resolveWith(201, undefined)

      await expect(logMealEntry(MEAL_ID, CATALOG_PAYLOAD)).rejects.toThrow(
        'Unexpected response logging entry: status=201'
      )
      expect(mockRecordError).toHaveBeenCalledTimes(1)
    })

    it('reports and rethrows a transport failure', async () => {
      const transportError = new Error('Network request failed')

      mockHttpPost.mockRejectedValue(transportError)

      await expect(logMealEntry(MEAL_ID, LEGACY_PAYLOAD)).rejects.toBe(transportError)
      expect(mockRecordError).toHaveBeenCalledTimes(1)
      expect(mockRecordError).toHaveBeenCalledWith(transportError)
    })
  })
})
