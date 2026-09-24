import {
  NutritionTargets,
  SaveEstimatedNutritionTargetsPayload,
  SaveManualNutritionTargetsPayload,
  SaveNutritionTargetsPayload,
  SaveNutritionTargetsResult
} from '@data/models/NutritionTargets'
import {mutationKeys, queryKeys} from '@queries/keys'
import {MutationFunctionContext, QueryClient, QueryKey} from '@tanstack/react-query'
import {API_ERROR_CODES, API_ERROR_DETAIL_CODES} from '@utility/ApiErrorUtility'

import {buildSaveNutritionTargetsMutationOptions} from '../useSaveNutritionTargetsMutation.util'

const PLAN_ID = 'plan-1'
const OTHER_PLAN_ID = 'plan-2'
const DATE = '2026-07-05'
const OTHER_DATE = '2026-07-08'
const MEAL_ID = 'meal-1'
const RECIPE_VERSION_ID = 'recipe-version-1'
const PLAN_REVISION = 4

type SaveNutritionTargetsOptions = ReturnType<typeof buildSaveNutritionTargetsMutationOptions>

const ESTIMATED_PAYLOAD: SaveEstimatedNutritionTargetsPayload = {
  source: 'estimated',
  estimateRevision: 7,
  expectedTargetsRevision: 2
}

const MANUAL_PAYLOAD: SaveManualNutritionTargetsPayload = {
  source: 'manual',
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  expectedTargetsRevision: 2
}

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 1940, protein: 146, carbs: 194, fat: 65},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 3,
  ...overrides
})

const makeSaveResult = (overrides: Partial<SaveNutritionTargetsResult> = {}): SaveNutritionTargetsResult => ({
  targets: makeTargets(),
  feasibility: {ok: true, warnings: []},
  ...overrides
})

const EXPECTED_INVALIDATED_KEYS: QueryKey[] = [
  queryKeys.nutritionTargets,
  queryKeys.targetEstimate,
  queryKeys.dailyMacrosAll,
  queryKeys.macrosHistory,
  queryKeys.mealPlanPreferences,
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll,
  queryKeys.swapAlternativesAll
]

const serialize = (keys: (QueryKey | undefined)[]): string[] => keys.map(key => JSON.stringify(key)).sort()

let queryClient: QueryClient

const seedCache = (): void => {
  queryClient.setQueryData(queryKeys.nutritionTargets, {seeded: true})
  queryClient.setQueryData(queryKeys.targetEstimate, {seeded: true})
  queryClient.setQueryData(queryKeys.dailyMacros(DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.dailyMacros(OTHER_DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.macrosHistory, {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanPreferences, {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanCurrent, {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanDay(PLAN_ID, DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE), {seeded: true})
  queryClient.setQueryData(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION), {seeded: true})
  queryClient.setQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION), {seeded: true})
  queryClient.setQueryData(queryKeys.groceryList(PLAN_ID), {seeded: true})
  queryClient.setQueryData(queryKeys.affectedMeals(PLAN_ID), {seeded: true})
  queryClient.setQueryData(queryKeys.exercises, {seeded: true})
  queryClient.setQueryData(queryKeys.foods, {seeded: true})
}

const makeFunctionContext = (): MutationFunctionContext => ({
  client: queryClient,
  meta: undefined,
  mutationKey: mutationKeys.saveNutritionTargets
})

const invokeOnSuccess = async (
  options: SaveNutritionTargetsOptions,
  result: SaveNutritionTargetsResult = makeSaveResult(),
  payload: SaveNutritionTargetsPayload = ESTIMATED_PAYLOAD,
  onMutateResult: unknown = undefined
): Promise<unknown> => {
  const {onSuccess} = options

  if (!onSuccess) {
    throw new Error('buildSaveNutritionTargetsMutationOptions must declare onSuccess')
  }

  return onSuccess(result, payload, onMutateResult, makeFunctionContext())
}

// Thrown Errors carrying a response shape, which is what the axios transport rejects with: classification
// reads only `response.status` and `response.data.error`, so this suite owes the transport no dependency.
const makeApiError = (status: number, code?: string, details?: {field: string; code: string}[]): Error =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {
      status,
      data: code === undefined ? {} : {error: code, ...(details === undefined ? {} : {details})}
    }
  })

const STALE_TARGETS_ERROR = makeApiError(409, API_ERROR_CODES.staleTargets)
const ESTIMATE_STALE_ERROR = makeApiError(409, API_ERROR_CODES.estimateStale)
const READ_ONLY_FIELD_ERROR = makeApiError(400, API_ERROR_CODES.invalidRequest, [
  {field: 'setupStatus', code: API_ERROR_DETAIL_CODES.readOnlyField}
])
const INVALID_REQUEST_ERROR = makeApiError(400, API_ERROR_CODES.invalidRequest)
const STALE_REVISION_ERROR = makeApiError(409, API_ERROR_CODES.staleRevision)
const TRANSPORT_LOSS_ERROR = new Error('Network Error')
const SERVER_ERROR_WITHOUT_CODE = makeApiError(500)

const runOnError = (
  options: SaveNutritionTargetsOptions,
  error: Error,
  payload: SaveNutritionTargetsPayload = ESTIMATED_PAYLOAD
): void => {
  const {onError} = options

  if (!onError) {
    throw new Error('buildSaveNutritionTargetsMutationOptions must declare onError')
  }

  onError(error, payload, undefined, makeFunctionContext())
}

const isQueryInvalidated = (queryKey: QueryKey): boolean | undefined =>
  queryClient.getQueryState(queryKey)?.isInvalidated

beforeEach(() => {
  // gcTime Infinity keeps the seeded queries from scheduling garbage-collection timeouts, which would
  // otherwise hold the Node event loop open long after the assertions are done.
  queryClient = new QueryClient({defaultOptions: {queries: {retry: false, gcTime: Infinity}}})
})

afterEach(() => {
  jest.restoreAllMocks()
  queryClient.clear()
})

describe('buildSaveNutritionTargetsMutationOptions', () => {
  describe('the returned options', () => {
    it('carries the centralized save-targets mutation key, which is what useIsMutating matches on', () => {
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      expect(options.mutationKey).toBe(mutationKeys.saveNutritionTargets)
    })

    it('declares both cache handlers only, leaving the request function to the hook', () => {
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      expect(Object.keys(options).sort()).toEqual(['mutationKey', 'onError', 'onSuccess'])
    })

    it('declares no retry, because a revisioned save recovers through 409 stale_targets rather than a replay', () => {
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      expect(options.retry).toBeUndefined()
      expect(options.retryDelay).toBeUndefined()
    })
  })

  describe('build-time purity', () => {
    it('touches no cache while the options are built', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const writeSpy = jest.spyOn(queryClient, 'setQueryData')

      buildSaveNutritionTargetsMutationOptions(queryClient)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess cache contract', () => {
    it('invalidates exactly the eight target-save keys, the two diary keys among them, and nothing else', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(invalidateSpy).toHaveBeenCalledTimes(EXPECTED_INVALIDATED_KEYS.length)
    })

    it('issues those invalidations in the order the cache contract states, so a reordering is a failure', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(EXPECTED_INVALIDATED_KEYS)
    })

    it('invalidates the daily macros, which is where the Diary reads the targets this save just confirmed', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.dailyMacrosAll})
    })

    it('invalidates the macros history, so past days re-resolve against the new targets', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.macrosHistory})
      expect(isQueryInvalidated(queryKeys.macrosHistory)).toBe(true)
    })

    it('reaches every cached diary day through the dailyMacros root, which one date key could not do', async () => {
      seedCache()

      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(isQueryInvalidated(queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.dailyMacros(OTHER_DATE))).toBe(true)
    })

    it('invalidates the swap alternatives, because a target change reorders the candidate ranking', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapAlternativesAll})
    })

    it('reaches every cached plan day and alternatives set through their family roots', async () => {
      seedCache()

      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(isQueryInvalidated(queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))).toBe(true)
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(true)
      expect(isQueryInvalidated(queryKeys.targetEstimate)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanCurrent)).toBe(true)
    })

    it('leaves the grocery list, the affected-meal sets and unrelated domains valid', async () => {
      seedCache()

      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(isQueryInvalidated(queryKeys.groceryList(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryKeys.affectedMeals(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryKeys.exercises)).toBe(false)
      expect(isQueryInvalidated(queryKeys.foods)).toBe(false)
    })

    it('removes the swap previews rather than invalidating a preview ranked against the old targets', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).not.toContain(
        JSON.stringify(queryKeys.swapPreviewAll)
      )
    })

    it('leaves an already-cached preview gone from the cache rather than refetched into view', async () => {
      seedCache()

      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(
        queryClient.getQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION))
      ).toBeUndefined()
    })

    it('writes nothing optimistically', async () => {
      seedCache()

      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options)

      expect(writeSpy).not.toHaveBeenCalled()
    })
  })

  describe('onSuccess edge cases', () => {
    it('issues every operation against a completely empty cache without throwing', async () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await expect(invokeOnSuccess(options)).resolves.toBeUndefined()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('tolerates the undefined onMutate result a factory declaring no onMutate always receives', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await expect(invokeOnSuccess(options, makeSaveResult(), ESTIMATED_PAYLOAD, undefined)).resolves.toBeUndefined()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(true)
    })

    it('invalidates the same keys for a manual save as for an estimate confirmation', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options, makeSaveResult(), MANUAL_PAYLOAD)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(isQueryInvalidated(queryKeys.dailyMacros(OTHER_DATE))).toBe(true)
    })

    it('invalidates the same keys when only some of the confirmed target values came back set', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const partialTargets = makeTargets({
        targets: {calories: 1940, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      })
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(options, makeSaveResult({targets: partialTargets}), MANUAL_PAYLOAD)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('invalidates the same keys for a save the server accepted with feasibility warnings', async () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      await invokeOnSuccess(
        options,
        makeSaveResult({feasibility: {ok: false, warnings: ['macro_energy_mismatch']}}),
        MANUAL_PAYLOAD
      )

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(isQueryInvalidated(queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.dailyMacros(OTHER_DATE))).toBe(true)
    })
  })

  describe('onError cache contract', () => {
    it('applies the whole set after commit-response-loss, the 409 stale_targets the equality recovery resolves silently', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(invalidateSpy).toHaveBeenCalledTimes(EXPECTED_INVALIDATED_KEYS.length)
    })

    it('issues them in the same order the success path does, so the two cannot drift', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR)

      expect(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(EXPECTED_INVALIDATED_KEYS)
    })

    it('removes the swap previews exactly once on that recovery, rather than invalidating a preview ranked against the old targets', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR)

      expect(removeSpy).toHaveBeenCalledTimes(1)
      expect(removeSpy).toHaveBeenCalledWith({queryKey: queryKeys.swapPreviewAll})
      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).not.toContain(
        JSON.stringify(queryKeys.swapPreviewAll)
      )
      expect(
        queryClient.getQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION))
      ).toBeUndefined()
    })

    it('reaches every cached diary day, plan day and alternatives set through their family roots', () => {
      seedCache()

      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR)

      expect(isQueryInvalidated(queryKeys.dailyMacros(DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.dailyMacros(OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.macrosHistory)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanDay(PLAN_ID, DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanDay(OTHER_PLAN_ID, OTHER_DATE))).toBe(true)
      expect(isQueryInvalidated(queryKeys.swapAlternatives(PLAN_ID, MEAL_ID, PLAN_REVISION))).toBe(true)
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(true)
      expect(isQueryInvalidated(queryKeys.targetEstimate)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanPreferences)).toBe(true)
      expect(isQueryInvalidated(queryKeys.mealPlanCurrent)).toBe(true)
    })

    it('leaves the grocery list, the affected-meal sets and unrelated domains valid on that recovery too', () => {
      seedCache()

      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR)

      expect(isQueryInvalidated(queryKeys.groceryList(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryKeys.affectedMeals(PLAN_ID))).toBe(false)
      expect(isQueryInvalidated(queryKeys.exercises)).toBe(false)
      expect(isQueryInvalidated(queryKeys.foods)).toBe(false)
    })

    it('applies the whole set for a rejection that carries no response at all, which may still have committed', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, TRANSPORT_LOSS_ERROR)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('applies the whole set for a 500 carrying no recognised code, the other unknown outcome', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, SERVER_ERROR_WITHOUT_CODE)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('issues no cache operation for a confirmed answer that wrote nothing, estimate_stale among them', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, ESTIMATE_STALE_ERROR)
      runOnError(options, INVALID_REQUEST_ERROR)
      runOnError(options, READ_ONLY_FIELD_ERROR)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
      expect(isQueryInvalidated(queryKeys.nutritionTargets)).toBe(false)
      expect(isQueryInvalidated(queryKeys.dailyMacros(DATE))).toBe(false)
      expect(
        queryClient.getQueryData(queryKeys.swapPreview(PLAN_ID, MEAL_ID, RECIPE_VERSION_ID, PLAN_REVISION))
      ).toEqual({seeded: true})
    })

    it("reads stale_targets and not stale_revision, which is the preferences routes' own conflict code", () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_REVISION_ERROR)

      expect(invalidateSpy).not.toHaveBeenCalled()
      expect(removeSpy).not.toHaveBeenCalled()
    })

    it('issues every operation against a completely empty cache without throwing', () => {
      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      expect(() => runOnError(options, STALE_TARGETS_ERROR)).not.toThrow()

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })

    it('writes nothing optimistically on any failure', () => {
      seedCache()

      const writeSpy = jest.spyOn(queryClient, 'setQueryData')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR)
      runOnError(options, TRANSPORT_LOSS_ERROR)
      runOnError(options, ESTIMATE_STALE_ERROR)

      expect(writeSpy).not.toHaveBeenCalled()
    })

    it('does the same cache work for a manual save as for an estimate confirmation', () => {
      seedCache()

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
      const removeSpy = jest.spyOn(queryClient, 'removeQueries')
      const options = buildSaveNutritionTargetsMutationOptions(queryClient)

      runOnError(options, STALE_TARGETS_ERROR, MANUAL_PAYLOAD)

      expect(serialize(invalidateSpy.mock.calls.map(([filters]) => filters?.queryKey))).toEqual(
        serialize(EXPECTED_INVALIDATED_KEYS)
      )
      expect(removeSpy).toHaveBeenCalledTimes(1)
    })
  })
})
