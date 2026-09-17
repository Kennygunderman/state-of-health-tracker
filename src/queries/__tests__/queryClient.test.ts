import {QueryClient} from '@tanstack/react-query'
import {PersistedClient, persistQueryClientSave} from '@tanstack/react-query-persist-client'

// An in-memory AsyncStorage keeps the suite free of native modules while still exercising the real
// persister: what these cases assert is which key a write lands under, what a read hands back, and —
// the point of the dedupe — whether a write happened at all.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>()

  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value)
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key)
      })
    }
  }
})

// The on-disk contract: asserted as a literal because the key is what an installed build already
// holds, so changing it silently orphans every device's cache.
const CACHE_KEY = 'soh-query-cache'

// createAsyncStoragePersister's default throttle interval. Its wait loop is `while (Date.now() <
// nextExecutionTime)`, so a second write-through save in one case needs the clock moved past it.
const THROTTLE_MS = 1000

interface AsyncStorageMock {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
}

// `asyncStoragePersister` is a module singleton that remembers both the last signature it wrote and
// the throttle's next execution time, so every case gets its own copy of the module — and with it its
// own in-memory storage, because resetting the registry re-runs the mock factory above.
interface FreshQueryClientModule {
  storage: AsyncStorageMock
  persistedQueryKeys: string[]
  persister: typeof import('../queryClient').asyncStoragePersister
  shouldRetryQuery: typeof import('../queryClient').shouldRetryQuery
  client: typeof import('../queryClient').queryClient
}

const loadQueryClientModule = (): FreshQueryClientModule => {
  jest.resetModules()

  const {default: storage} = jest.requireMock<{default: AsyncStorageMock}>('@react-native-async-storage/async-storage')
  const {asyncStoragePersister, PERSISTED_QUERY_KEYS, queryClient, shouldRetryQuery} =
    jest.requireActual<typeof import('../queryClient')>('../queryClient')

  return {
    storage,
    persistedQueryKeys: PERSISTED_QUERY_KEYS,
    persister: asyncStoragePersister,
    shouldRetryQuery,
    client: queryClient
  }
}

// The clock is read from a variable rather than frozen: a frozen `Date.now` never satisfies the
// throttle's wait condition, so a second write-through save would spin forever.
let now = 1_760_000_000_000

const advancePastThrottle = () => {
  now += THROTTLE_MS + 1
}

// When the whitelisted query last resolved. Fixed rather than read from the mutable clock, so that
// advancing the clock past the throttle window is not itself a content change — the dedupe cases
// below have to distinguish "the same payload again" from "a genuinely newer one".
const DATA_UPDATED_AT = 1_759_000_000_000

const persistedClient = (overrides: {timestamp?: number; calories?: number} = {}): PersistedClient => ({
  buster: '',
  timestamp: overrides.timestamp ?? now,
  clientState: {
    mutations: [],
    queries: [
      {
        queryHash: JSON.stringify(['dailyMacros', '2026-07-05']),
        queryKey: ['dailyMacros', '2026-07-05'],
        state: {
          data: {calories: overrides.calories ?? 1940},
          dataUpdateCount: 1,
          dataUpdatedAt: DATA_UPDATED_AT,
          error: null,
          errorUpdateCount: 0,
          errorUpdatedAt: 0,
          fetchFailureCount: 0,
          fetchFailureReason: null,
          fetchMeta: null,
          isInvalidated: false,
          status: 'success' as const,
          fetchStatus: 'idle' as const
        }
      }
    ]
  }
})

// Axios' rejection shape as the app's classification reads it: a status on `response` and, when the
// server described the outcome, an `error` string in the body.
const apiError = (status: number, code?: string): Error =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: {status, data: code === undefined ? {} : {error: code}}
  })

beforeEach(() => {
  now = 1_760_000_000_000
  jest.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('PERSISTED_QUERY_KEYS', () => {
  it('persists only the whitelisted queries', () => {
    expect(loadQueryClientModule().persistedQueryKeys).toEqual([
      'exercises',
      'dailyMacros',
      'foods',
      'userAvatar',
      'mealPlanCurrent'
    ])
  })
})

describe('asyncStoragePersister', () => {
  it('writes the serialized client under the key installed builds already hold', async () => {
    const {persister, storage} = loadQueryClientModule()
    const client = persistedClient()

    await persister.persistClient(client)

    expect(storage.setItem).toHaveBeenCalledTimes(1)
    expect(storage.setItem).toHaveBeenCalledWith(CACHE_KEY, JSON.stringify(client))
  })

  it('restores what it wrote', async () => {
    const {persister} = loadQueryClientModule()
    const client = persistedClient()

    await persister.persistClient(client)

    await expect(persister.restoreClient()).resolves.toEqual(client)
  })

  it('restores nothing when the device holds nothing', async () => {
    const {persister} = loadQueryClientModule()

    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })

  it('takes the cache off the device on removeClient', async () => {
    const {persister, storage} = loadQueryClientModule()

    await persister.persistClient(persistedClient())
    await persister.removeClient()

    expect(storage.removeItem).toHaveBeenCalledWith(CACHE_KEY)
    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })
})

// PERFMOB-F20: the provider saves after every query *and* mutation cache event, so most saves carry a
// payload the device already holds. These cases are the difference between "throttled" and "not
// written": a suppressed save must reach neither serialization nor storage.
describe('asyncStoragePersister content deduplication', () => {
  it('does not write again for an unchanged client state', async () => {
    const {persister, storage} = loadQueryClientModule()

    await persister.persistClient(persistedClient())
    await persister.persistClient(persistedClient())

    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('does not write again for a payload that differs only in its save timestamp', async () => {
    const {persister, storage} = loadQueryClientModule()

    await persister.persistClient(persistedClient({timestamp: now}))
    await persister.persistClient(persistedClient({timestamp: now + 5_000}))

    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('writes again once the cached data itself changes', async () => {
    const {persister, storage} = loadQueryClientModule()

    await persister.persistClient(persistedClient({calories: 1940}))
    advancePastThrottle()
    await persister.persistClient(persistedClient({calories: 2100}))

    expect(storage.setItem).toHaveBeenCalledTimes(2)
    expect(storage.setItem).toHaveBeenLastCalledWith(CACHE_KEY, expect.stringContaining('2100'))
  })

  it('writes again after removeClient, because the device no longer holds it', async () => {
    const {persister, storage} = loadQueryClientModule()

    await persister.persistClient(persistedClient())
    await persister.removeClient()
    advancePastThrottle()
    await persister.persistClient(persistedClient())

    expect(storage.setItem).toHaveBeenCalledTimes(2)
    await expect(persister.restoreClient()).resolves.toEqual(persistedClient())
  })

  it('writes again after a failed write, so a rejected save is not mistaken for a stored one', async () => {
    const {persister, storage} = loadQueryClientModule()

    storage.setItem.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))

    await persister.persistClient(persistedClient())
    advancePastThrottle()
    await persister.persistClient(persistedClient())

    expect(storage.setItem).toHaveBeenCalledTimes(2)
    await expect(persister.restoreClient()).resolves.toEqual(persistedClient())
  })
})

// The cases above hand the persister payloads built by hand. These drive the path the app actually
// uses — `persistQueryClientSave` dehydrating a real cache through the whitelist, exactly as App.tsx
// composes it — because that is where the volatile fields come from: the provider stamps `timestamp`
// on the payload and query-core's `dehydrateQuery` stamps `dehydratedAt` on every query, so a
// comparison that misses either one silently never dedupes anything in the running app.
describe('asyncStoragePersister through the provider save path', () => {
  const saveThroughProvider = async (module: FreshQueryClientModule, cache: QueryClient) =>
    persistQueryClientSave({
      queryClient: cache,
      persister: module.persister,
      dehydrateOptions: {
        shouldDehydrateQuery: query => module.persistedQueryKeys.includes(String(query.queryKey[0]))
      }
    })

  it('writes the whitelisted cache once and does not rewrite it for unrelated cache activity', async () => {
    const module = loadQueryClientModule()
    const cache = new QueryClient()

    try {
      cache.setQueryData(['mealPlanCurrent'], {current: {id: 'plan-1'}, upcoming: null})
      await saveThroughProvider(module, cache)

      expect(module.storage.setItem).toHaveBeenCalledTimes(1)

      // What every screen does constantly: transient, non-whitelisted queries resolve and mutations move
      // through their states. None of it is dehydrated, so the payload is the one already on the device.
      // The clock moves too, which is what makes this case fail if `timestamp` or `dehydratedAt` is compared.
      cache.setQueryData(['catalogSearch', 'chicken'], {items: []})
      cache.setQueryData(['mealPlanDay', 'plan-1', '2026-07-05'], {day: {meals: []}})
      advancePastThrottle()
      await saveThroughProvider(module, cache)
      await saveThroughProvider(module, cache)

      expect(module.storage.setItem).toHaveBeenCalledTimes(1)

      // A whitelisted query changing is the case that must still reach the device.
      advancePastThrottle()
      cache.setQueryData(['mealPlanCurrent'], {current: {id: 'plan-2'}, upcoming: null})
      await saveThroughProvider(module, cache)

      expect(module.storage.setItem).toHaveBeenCalledTimes(2)
      expect(module.storage.setItem).toHaveBeenLastCalledWith(CACHE_KEY, expect.stringContaining('plan-2'))
    } finally {
      // Hydrating or seeding a query schedules its garbage-collection timer; clearing leaves the run no
      // open handle.
      cache.clear()
    }
  })
})

// PERFMOB-F19: the six meal-planning resource queries set no `retry` of their own, so this predicate
// is what decides whether a decoded terminal answer is requested twice before recovery renders.
describe('shouldRetryQuery', () => {
  it('refuses a decoded resource answer', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(0, apiError(404, 'This recipe is not available'))).toBe(false)
    expect(shouldRetryQuery(0, apiError(409, 'stale_plan'))).toBe(false)
    expect(shouldRetryQuery(0, apiError(422, 'invalid_request'))).toBe(false)
  })

  it('refuses the capability answer a gated backend returns', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(0, apiError(503, 'feature_disabled'))).toBe(false)
  })

  it('refuses a 4xx that carries no decodable code at all', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(0, apiError(400))).toBe(false)
    expect(shouldRetryQuery(0, apiError(404))).toBe(false)
  })

  it('retries the three transient client answers', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(0, apiError(408))).toBe(true)
    expect(shouldRetryQuery(0, apiError(425))).toBe(true)
    expect(shouldRetryQuery(0, apiError(429))).toBe(true)
  })

  it('retries a server failure nothing recognised described', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(0, apiError(500))).toBe(true)
    expect(shouldRetryQuery(0, apiError(500, 'Failed to load the plan'))).toBe(true)
    expect(shouldRetryQuery(0, apiError(502))).toBe(true)
  })

  it('retries a rejection that never reached a response', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(0, new Error('Network Error'))).toBe(true)
  })

  it('spends its one retry and then stops, whatever the failure was', () => {
    const {shouldRetryQuery} = loadQueryClientModule()

    expect(shouldRetryQuery(1, new Error('Network Error'))).toBe(false)
    expect(shouldRetryQuery(1, apiError(429))).toBe(false)
    expect(shouldRetryQuery(2, apiError(500))).toBe(false)
  })

  // The predicate is a default rather than a per-hook option, which is the whole of how the six
  // meal-planning resource queries inherit it without setting a `retry` of their own.
  it('is the retry every query inherits, beside the unchanged cache windows', () => {
    const {client, shouldRetryQuery} = loadQueryClientModule()
    const {queries} = client.getDefaultOptions()

    expect(queries?.retry).toBe(shouldRetryQuery)
    expect(queries?.staleTime).toBe(60_000)
    expect(queries?.gcTime).toBe(24 * 60 * 60_000)
  })
})
