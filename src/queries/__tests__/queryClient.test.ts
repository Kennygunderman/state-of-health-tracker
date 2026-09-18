import {QueryClient} from '@tanstack/react-query'
import {
  PersistedClient,
  Persister,
  persistQueryClientRestore,
  persistQueryClientSave
} from '@tanstack/react-query-persist-client'

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
      }),
      getAllKeys: jest.fn(async () => [...store.keys()]),
      multiRemove: jest.fn(async (keys: readonly string[]) => {
        keys.forEach(key => store.delete(key))
      })
    }
  }
})

const USER_A = 'uid-aaaa'
const USER_B = 'uid-bbbb'
const USER_C = 'uid-cccc'

// The on-disk contract: asserted as a literal because installed builds already hold keys under this
// prefix, so changing it silently orphans every device's cache.
const CACHE_KEY_PREFIX = 'soh-query-cache'

// createAsyncStoragePersister's default throttle interval. Its wait loop is `while (Date.now() <
// nextExecutionTime)`, so a second write-through save through one persister object needs the clock
// moved past it.
const THROTTLE_MS = 1000

interface AsyncStorageMock {
  getItem: jest.Mock
  setItem: jest.Mock
  removeItem: jest.Mock
  getAllKeys: jest.Mock
  multiRemove: jest.Mock
}

// The module holds the account whose partition may be written (`writablePartitionKey`), each
// persister remembers the last signature it wrote and the throttle's next execution time, so every
// case gets its own copy of the module — and with it its own in-memory storage, because resetting
// the registry re-runs the mock factory above.
interface FreshQueryClientModule {
  storage: AsyncStorageMock
  persistedQueryKeys: string[]
  cache: typeof import('../queryClient')
  shouldRetryQuery: typeof import('../queryClient').shouldRetryQuery
  client: typeof import('../queryClient').queryClient
}

const loadQueryClientModule = (): FreshQueryClientModule => {
  jest.resetModules()

  const {default: storage} = jest.requireMock<{default: AsyncStorageMock}>('@react-native-async-storage/async-storage')
  const cache = jest.requireActual<typeof import('../queryClient')>('../queryClient')

  return {
    storage,
    persistedQueryKeys: cache.PERSISTED_QUERY_KEYS,
    cache,
    shouldRetryQuery: cache.shouldRetryQuery,
    client: cache.queryClient
  }
}

// The persister the app mounts for one account, with that account's partition already open — the
// state the module is in once the auth store has published that identity.
const activePersisterFor = ({cache}: FreshQueryClientModule, userId: string): Persister => {
  cache.activateQueryCachePartition(userId)

  return cache.queryCachePersisterFor(userId)
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

// `buster` and the stored payload both carry the account, because that is what the account cases
// read back: a payload restored into the wrong session is identified by whose data it holds.
const persistedClient = (overrides: {timestamp?: number; calories?: number; owner?: string} = {}): PersistedClient => ({
  buster: overrides.owner ?? USER_A,
  timestamp: overrides.timestamp ?? now,
  clientState: {
    mutations: [],
    queries: [
      {
        queryHash: JSON.stringify(['dailyMacros', '2026-07-05']),
        queryKey: ['dailyMacros', '2026-07-05'],
        state: {
          data: {calories: overrides.calories ?? 1940, owner: overrides.owner ?? USER_A},
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

// Hydrating a query schedules its garbage-collection timer, so every client a case restores into is
// cleared afterwards and the run is left no open handle.
let hydrationClients: QueryClient[] = []

const makeHydrationClient = (): QueryClient => {
  const client = new QueryClient()

  hydrationClients.push(client)

  return client
}

beforeEach(() => {
  now = 1_760_000_000_000
  jest.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  hydrationClients.forEach(client => client.clear())
  hydrationClients = []
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

describe('queryCacheKeyForUser', () => {
  it('gives each account its own storage key under the shared prefix', () => {
    const {cache} = loadQueryClientModule()

    expect(cache.queryCacheKeyForUser(USER_A)).toBe(`${CACHE_KEY_PREFIX}:${USER_A}`)
    expect(cache.queryCacheKeyForUser(USER_A)).not.toBe(cache.queryCacheKeyForUser(USER_B))
  })

  it('never collides with the device-wide key earlier builds wrote', () => {
    const {cache} = loadQueryClientModule()

    expect(cache.LEGACY_QUERY_CACHE_KEY).toBe(CACHE_KEY_PREFIX)
    expect(cache.queryCacheKeyForUser(USER_A)).not.toBe(cache.LEGACY_QUERY_CACHE_KEY)
  })
})

describe('queryCachePersisterFor', () => {
  it("writes the serialized client under its own account's key and nowhere else", async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)
    const client = persistedClient()

    await persister.persistClient(client)

    expect(module.storage.setItem).toHaveBeenCalledTimes(1)
    expect(module.storage.setItem).toHaveBeenCalledWith(
      module.cache.queryCacheKeyForUser(USER_A),
      JSON.stringify(client)
    )
    await expect(module.storage.getItem(module.cache.LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.toBeNull()
  })

  it('restores what it wrote', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)
    const client = persistedClient()

    await persister.persistClient(client)

    await expect(persister.restoreClient()).resolves.toEqual(client)
  })

  it('restores nothing when the device holds nothing', async () => {
    const module = loadQueryClientModule()

    await expect(activePersisterFor(module, USER_A).restoreClient()).resolves.toBeUndefined()
  })

  it('takes the cache off the device on removeClient', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    await persister.persistClient(persistedClient())
    await persister.removeClient()

    expect(module.storage.removeItem).toHaveBeenCalledWith(module.cache.queryCacheKeyForUser(USER_A))
    await expect(persister.restoreClient()).resolves.toBeUndefined()
  })

  it('restores only what its own account stored', async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))

    await expect(activePersisterFor(module, USER_A).restoreClient()).resolves.toMatchObject({buster: USER_A})
    await expect(activePersisterFor(module, USER_B).restoreClient()).resolves.toBeUndefined()
  })

  it('moves no authorization of its own, so a render that is never committed changes nothing', async () => {
    const module = loadQueryClientModule()

    module.cache.activateQueryCachePartition(USER_A)

    const speculativePersister = module.cache.queryCachePersisterFor(USER_B)
    const activePersister = module.cache.queryCachePersisterFor(USER_A)

    await speculativePersister.persistClient(persistedClient({owner: USER_B}))
    await activePersister.persistClient(persistedClient({owner: USER_A}))

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toContain(USER_A)
  })

  it('drops a write from the previous account once the next one has been published', async () => {
    const module = loadQueryClientModule()
    const previousAccountPersister = activePersisterFor(module, USER_A)

    module.cache.activateQueryCachePartition(USER_B)

    // The real shape of this: the persister throttles its writes, so a save started while the
    // outgoing account was live can reach storage once the cache already holds the incoming one's.
    await previousAccountPersister.persistClient(persistedClient({owner: USER_B}))

    expect(module.storage.setItem).not.toHaveBeenCalled()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })

  it('drops a write once the partition is sealed', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    module.cache.sealQueryCachePartition()

    await persister.persistClient(persistedClient())

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })

  // The dedupe below remembers what a partition holds, so a dropped write must not be remembered:
  // the same payload has to reach the device once the account's partition is open again.
  it('writes a payload it previously had to drop once the account is published again', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    module.cache.sealQueryCachePartition()
    await persister.persistClient(persistedClient())

    module.cache.activateQueryCachePartition(USER_A)
    advancePastThrottle()
    await persister.persistClient(persistedClient())

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toContain(USER_A)
  })

  it('neither restores nor stores anything while no identity is known', async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))

    const unidentifiedPersister = module.cache.queryCachePersisterFor(null)

    await expect(unidentifiedPersister.restoreClient()).resolves.toBeUndefined()

    await unidentifiedPersister.persistClient(persistedClient({owner: USER_B}))

    await expect(module.storage.getItem(module.cache.LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toContain(USER_A)
  })
})

// PERFMOB-F20: the provider saves after every query *and* mutation cache event, so most saves carry a
// payload the device already holds. These cases are the difference between "throttled" and "not
// written": a suppressed save must reach neither serialization nor storage.
describe('persisted cache content deduplication', () => {
  it('does not write again for an unchanged client state', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    await persister.persistClient(persistedClient())
    await persister.persistClient(persistedClient())

    expect(module.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('does not write again for a payload that differs only in its save timestamp', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    await persister.persistClient(persistedClient({timestamp: now}))
    await persister.persistClient(persistedClient({timestamp: now + 5_000}))

    expect(module.storage.setItem).toHaveBeenCalledTimes(1)
  })

  it('writes again once the cached data itself changes', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    await persister.persistClient(persistedClient({calories: 1940}))
    advancePastThrottle()
    await persister.persistClient(persistedClient({calories: 2100}))

    expect(module.storage.setItem).toHaveBeenCalledTimes(2)
    expect(module.storage.setItem).toHaveBeenLastCalledWith(
      module.cache.queryCacheKeyForUser(USER_A),
      expect.stringContaining('2100')
    )
  })

  it('writes again after removeClient, because the device no longer holds it', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    await persister.persistClient(persistedClient())
    await persister.removeClient()
    advancePastThrottle()
    await persister.persistClient(persistedClient())

    expect(module.storage.setItem).toHaveBeenCalledTimes(2)
    await expect(persister.restoreClient()).resolves.toEqual(persistedClient())
  })

  it('writes again after a failed write, so a rejected save is not mistaken for a stored one', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    module.storage.setItem.mockRejectedValueOnce(new Error('QUOTA_EXCEEDED'))

    await persister.persistClient(persistedClient())
    advancePastThrottle()
    await persister.persistClient(persistedClient())

    expect(module.storage.setItem).toHaveBeenCalledTimes(2)
    await expect(persister.restoreClient()).resolves.toEqual(persistedClient())
  })

  // The signature is per persister, so it describes one account's partition. A device-wide signature
  // would let the outgoing account's last payload suppress the incoming account's identical-looking
  // first write, leaving nothing at all under the incoming key.
  it("is per account, so one account never suppresses another account's write", async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))
    advancePastThrottle()
    await activePersisterFor(module, USER_B).persistClient(persistedClient({owner: USER_A}))

    expect(module.storage.setItem).toHaveBeenCalledTimes(2)
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })
})

// The cases above hand the persister payloads built by hand. These drive the path the app actually
// uses — `persistQueryClientSave` dehydrating a real cache through the whitelist, exactly as App.tsx
// composes it — because that is where the volatile fields come from: the provider stamps `timestamp`
// on the payload and query-core's `dehydrateQuery` stamps `dehydratedAt` on every query, so a
// comparison that misses either one silently never dedupes anything in the running app.
describe('the persisted cache through the provider save path', () => {
  it('writes the whitelisted cache once and does not rewrite it for unrelated cache activity', async () => {
    const module = loadQueryClientModule()
    const cache = new QueryClient()

    module.cache.activateQueryCachePartition(USER_A)

    // One binding for the whole case, because that is what App.tsx mounts: the persister it carries
    // is the object holding this account's last-written signature.
    const {persistOptions} = module.cache.sessionCacheBindingFor(USER_A)
    const saveThroughProvider = async () => persistQueryClientSave({queryClient: cache, ...persistOptions})

    try {
      cache.setQueryData(['mealPlanCurrent'], {current: {id: 'plan-1'}, upcoming: null})
      await saveThroughProvider()

      expect(module.storage.setItem).toHaveBeenCalledTimes(1)

      // What every screen does constantly: transient, non-whitelisted queries resolve and mutations move
      // through their states. None of it is dehydrated, so the payload is the one already on the device.
      // The clock moves too, which is what makes this case fail if `timestamp` or `dehydratedAt` is compared.
      cache.setQueryData(['catalogSearch', 'chicken'], {items: []})
      cache.setQueryData(['mealPlanDay', 'plan-1', '2026-07-05'], {day: {meals: []}})
      advancePastThrottle()
      await saveThroughProvider()
      await saveThroughProvider()

      expect(module.storage.setItem).toHaveBeenCalledTimes(1)

      // A whitelisted query changing is the case that must still reach the device.
      advancePastThrottle()
      cache.setQueryData(['mealPlanCurrent'], {current: {id: 'plan-2'}, upcoming: null})
      await saveThroughProvider()

      expect(module.storage.setItem).toHaveBeenCalledTimes(2)
      expect(module.storage.setItem).toHaveBeenLastCalledWith(
        module.cache.queryCacheKeyForUser(USER_A),
        expect.stringContaining('plan-2')
      )
    } finally {
      // Hydrating or seeding a query schedules its garbage-collection timer; clearing leaves the run no
      // open handle.
      cache.clear()
    }
  })
})

// What App.tsx mounts. These cases are the account boundary as the app actually wires it: the React
// key that decides whether a uid replacing another recreates the session tree, the persister and
// buster that decide whose cache that tree may read, and the whitelist that decides what reaches the
// device at all.
describe('sessionCacheBindingFor', () => {
  const DIARY_KEY = ['dailyMacros', '2026-07-05']
  const PLAN_DAY_KEY = ['mealPlanDay', 'plan-1', '2026-07-05']

  const seededClient = (): QueryClient => {
    const client = makeHydrationClient()

    client.setQueryData(DIARY_KEY, {calories: 1940, owner: USER_A})
    client.setQueryData(PLAN_DAY_KEY, {planId: 'plan-1'})

    return client
  }

  const storedFor = async (module: FreshQueryClientModule, userId: string): Promise<string> => {
    const stored = await module.storage.getItem(module.cache.queryCacheKeyForUser(userId))

    return stored ?? ''
  }

  it('keys the session tree by the signed-in account, so one uid replacing another recreates it', () => {
    const {cache} = loadQueryClientModule()

    expect(cache.sessionCacheBindingFor(USER_A).sessionKey).toBe(USER_A)
    expect(cache.sessionCacheBindingFor(USER_A).sessionKey).not.toBe(cache.sessionCacheBindingFor(USER_B).sessionKey)
  })

  // The draft in MealPlanSetupProvider and the plan/meal/recipe ids in the navigation state are
  // cleared by that remount and by nothing else, so a signed-out key colliding with a real uid would
  // be a leak rather than a cosmetic bug.
  it('keys a signed-out session with a value no Firebase uid can be', () => {
    const {cache} = loadQueryClientModule()

    expect(cache.sessionCacheBindingFor(null).sessionKey).toBe(cache.SIGNED_OUT_SESSION_KEY)
    expect(cache.SIGNED_OUT_SESSION_KEY).not.toMatch(/^[A-Za-z0-9]+$/)
  })

  it('keys the same account the same way, so an unrelated re-render never remounts the tree', () => {
    const {cache} = loadQueryClientModule()

    expect(cache.sessionCacheBindingFor(USER_A).sessionKey).toBe(cache.sessionCacheBindingFor(USER_A).sessionKey)
  })

  it('busts a stored cache that was written for anybody else', () => {
    const {cache} = loadQueryClientModule()

    expect(cache.sessionCacheBindingFor(USER_A).persistOptions.buster).toBe(USER_A)
    expect(cache.sessionCacheBindingFor(USER_B).persistOptions.buster).toBe(USER_B)
    expect(cache.sessionCacheBindingFor(null).persistOptions.buster).toBe('')
  })

  it("writes through the signed-in account's partition and nowhere else", async () => {
    const module = loadQueryClientModule()

    module.cache.activateQueryCachePartition(USER_A)

    await persistQueryClientSave({
      queryClient: seededClient(),
      ...module.cache.sessionCacheBindingFor(USER_A).persistOptions
    })

    await expect(storedFor(module, USER_A)).resolves.toContain('dailyMacros')
    await expect(module.storage.getItem(module.cache.LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.toBeNull()
  })

  // The whitelist is the other half of what reaches the device: a plan day, a grocery list or a
  // target is refetched on launch rather than stored, so an account change cannot leave it behind.
  it('stores only the whitelisted queries, whatever else the cache holds', async () => {
    const module = loadQueryClientModule()

    module.cache.activateQueryCachePartition(USER_A)

    await persistQueryClientSave({
      queryClient: seededClient(),
      ...module.cache.sessionCacheBindingFor(USER_A).persistOptions
    })

    const stored = await storedFor(module, USER_A)

    expect(module.persistedQueryKeys).toContain('dailyMacros')
    expect(module.persistedQueryKeys).not.toContain('mealPlanDay')
    expect(stored).toContain('dailyMacros')
    expect(stored).not.toContain('mealPlanDay')
  })

  it('hands an incoming account nothing the outgoing account stored', async () => {
    const module = loadQueryClientModule()

    module.cache.activateQueryCachePartition(USER_A)
    await persistQueryClientSave({
      queryClient: seededClient(),
      ...module.cache.sessionCacheBindingFor(USER_A).persistOptions
    })

    module.cache.activateQueryCachePartition(USER_B)

    const incomingClient = makeHydrationClient()

    await persistQueryClientRestore({
      queryClient: incomingClient,
      ...module.cache.sessionCacheBindingFor(USER_B).persistOptions
    })

    expect(incomingClient.getQueryData(DIARY_KEY)).toBeUndefined()
  })

  it('stores and restores nothing at all while no identity is known', async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))
    module.cache.sealQueryCachePartition()

    const {persistOptions} = module.cache.sessionCacheBindingFor(null)
    const unidentifiedClient = makeHydrationClient()

    await persistQueryClientRestore({queryClient: unidentifiedClient, ...persistOptions})
    await persistQueryClientSave({queryClient: seededClient(), ...persistOptions})

    expect(unidentifiedClient.getQueryData(DIARY_KEY)).toBeUndefined()
    await expect(module.storage.getItem(module.cache.LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(storedFor(module, USER_A)).resolves.toContain(USER_A)
  })
})

// The ordering the key and the buster cannot catch on their own: restore hydrates the app's single
// shared QueryClient and is not cancelled when its provider unmounts, so a read started for the
// outgoing account can land after the incoming one is live — and from that live cache the incoming
// account's own subscription would write it back under the incoming key and buster.
describe('a restore still in flight when the account changes', () => {
  const DIARY_KEY = ['dailyMacros', '2026-07-05']

  const holdNextRead = (module: FreshQueryClientModule, payload: string) => {
    let releaseRead: () => void = () => undefined
    const held = new Promise<void>(resolve => {
      releaseRead = resolve
    })

    module.storage.getItem.mockImplementationOnce(async () => {
      await held

      return payload
    })

    return () => releaseRead()
  }

  it('hydrates nothing into the shared client, and nothing reaches the incoming partition', async () => {
    const module = loadQueryClientModule()
    const outgoingPersister = activePersisterFor(module, USER_A)
    const liveClient = makeHydrationClient()
    const releaseRead = holdNextRead(module, JSON.stringify(persistedClient({owner: USER_A})))
    const restore = persistQueryClientRestore({
      queryClient: liveClient,
      persister: outgoingPersister,
      buster: USER_A
    })

    module.cache.activateQueryCachePartition(USER_B)

    const incomingPersister = module.cache.queryCachePersisterFor(USER_B)

    releaseRead()
    await restore

    expect(liveClient.getQueryData(DIARY_KEY)).toBeUndefined()

    await persistQueryClientSave({queryClient: liveClient, persister: incomingPersister, buster: USER_B})

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.not.toContain(USER_A)
  })

  it('still hydrates when the same account is still the one signed in', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)
    const liveClient = makeHydrationClient()
    const releaseRead = holdNextRead(module, JSON.stringify(persistedClient({owner: USER_A})))
    const restore = persistQueryClientRestore({queryClient: liveClient, persister, buster: USER_A})

    releaseRead()
    await restore

    expect(liveClient.getQueryData(DIARY_KEY)).toEqual({calories: 1940, owner: USER_A})
  })
})

describe('discardPersistedQueryCache', () => {
  it("removes that account's cache from the device and leaves every other account's alone", async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))
    await activePersisterFor(module, USER_B).persistClient(persistedClient({owner: USER_B}))

    await module.cache.discardPersistedQueryCache(USER_A)

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })

  it('is a no-op when that account never persisted anything', async () => {
    const {cache} = loadQueryClientModule()

    await expect(cache.discardPersistedQueryCache(USER_A)).resolves.toBeUndefined()
  })
})

// What makes removal at an account change unconditional rather than best-effort: the removal there
// is started and not awaited, so this is the sweep that finishes it if the process died first.
describe('discardForeignPersistedQueryCaches', () => {
  it("removes every other account's cache and keeps the signed-in account's", async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))
    await activePersisterFor(module, USER_B).persistClient(persistedClient({owner: USER_B}))
    await activePersisterFor(module, USER_C).persistClient(persistedClient({owner: USER_C}))

    await module.cache.discardForeignPersistedQueryCaches(USER_B)

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_C))).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })

  it('leaves storage this feature does not own alone', async () => {
    const module = loadQueryClientModule()

    await module.storage.setItem('meal-plan-store', '{"state":{"pendingIntents":{}}}')
    await module.storage.setItem('user-data-store', '{"state":{"targetCalories":1940}}')

    await module.cache.discardForeignPersistedQueryCaches(USER_B)

    await expect(module.storage.getItem('meal-plan-store')).resolves.not.toBeNull()
    await expect(module.storage.getItem('user-data-store')).resolves.not.toBeNull()
  })

  it('touches the device only when there is something to remove', async () => {
    const module = loadQueryClientModule()

    await module.cache.discardForeignPersistedQueryCaches(USER_B)

    expect(module.storage.multiRemove).not.toHaveBeenCalled()
  })
})

describe('purgeLegacyQueryCache', () => {
  it('removes the device-wide cache earlier builds wrote and keeps the partitions', async () => {
    const module = loadQueryClientModule()

    await module.storage.setItem(module.cache.LEGACY_QUERY_CACHE_KEY, JSON.stringify(persistedClient()))
    await activePersisterFor(module, USER_B).persistClient(persistedClient({owner: USER_B}))

    await module.cache.purgeLegacyQueryCache()

    await expect(module.storage.getItem(module.cache.LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })
})

// The case the account boundary has to survive: the process dies between a sign-out and the next
// launch — or the sign-out's own removal is rejected — so the previous account's cache is still on
// the device when somebody else signs in.
describe('a cache left behind by a killed process', () => {
  const DIARY_KEY = ['dailyMacros', '2026-07-05']

  it('is not hydrated for the next account, and is not readable through its persister', async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))

    module.cache.activateQueryCachePartition(USER_B)

    const nextAccountClient = makeHydrationClient()

    await persistQueryClientRestore({
      queryClient: nextAccountClient,
      persister: module.cache.queryCachePersisterFor(USER_B),
      buster: USER_B
    })

    expect(nextAccountClient.getQueryData(DIARY_KEY)).toBeUndefined()
  })

  it('is then swept off the device by the account that is signed in', async () => {
    const module = loadQueryClientModule()

    await activePersisterFor(module, USER_A).persistClient(persistedClient({owner: USER_A}))

    await module.cache.discardForeignPersistedQueryCaches(USER_B)

    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })

  it('is discarded rather than hydrated when it carries another account as its buster', async () => {
    // Belt and braces behind the key: even a payload that somehow sits under this account's key is
    // thrown away, because restore compares the buster App.tsx passes with the stored one.
    const module = loadQueryClientModule()

    await module.storage.setItem(
      module.cache.queryCacheKeyForUser(USER_B),
      JSON.stringify(persistedClient({owner: USER_A}))
    )

    module.cache.activateQueryCachePartition(USER_B)

    const nextAccountClient = makeHydrationClient()

    await persistQueryClientRestore({
      queryClient: nextAccountClient,
      persister: module.cache.queryCachePersisterFor(USER_B),
      buster: USER_B
    })

    expect(nextAccountClient.getQueryData(DIARY_KEY)).toBeUndefined()
    await expect(module.storage.getItem(module.cache.queryCacheKeyForUser(USER_B))).resolves.toBeNull()
  })

  it('is hydrated for its own account, which is what keeps the diary readable offline', async () => {
    const module = loadQueryClientModule()
    const persister = activePersisterFor(module, USER_A)

    await persister.persistClient(persistedClient({owner: USER_A}))

    const sameAccountClient = makeHydrationClient()

    await persistQueryClientRestore({queryClient: sameAccountClient, persister, buster: USER_A})

    expect(sameAccountClient.getQueryData(DIARY_KEY)).toEqual({calories: 1940, owner: USER_A})
  })
})

// PERFMOB-F19: the meal-planning resource reads inherit this predicate rather than declaring a `retry` of
// their own, so it is what decides whether a decoded terminal answer is requested twice before recovery
// renders. `useMealPlanDayQuery` and `useNutritionTargetsQuery` are the exceptions, and only to decline a
// retry of their own terminal answer.
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

  // The predicate is a default rather than a per-hook option, which is the whole of how a resource read
  // inherits it by declaring no `retry` of its own.
  it('is the retry every query inherits, beside the unchanged cache windows', () => {
    const {client, shouldRetryQuery} = loadQueryClientModule()
    const {queries} = client.getDefaultOptions()

    expect(queries?.retry).toBe(shouldRetryQuery)
    expect(queries?.staleTime).toBe(60_000)
    expect(queries?.gcTime).toBe(24 * 60 * 60_000)
  })
})
