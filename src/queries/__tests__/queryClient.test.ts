import AsyncStorage from '@react-native-async-storage/async-storage'
import {QueryClient} from '@tanstack/react-query'
import {persistQueryClientRestore, persistQueryClientSave} from '@tanstack/react-query-persist-client'

import {
  activateQueryCachePartition,
  discardForeignPersistedQueryCaches,
  discardPersistedQueryCache,
  LEGACY_QUERY_CACHE_KEY,
  PERSISTED_QUERY_KEYS,
  purgeLegacyQueryCache,
  queryCacheKeyForUser,
  queryCachePersisterFor,
  sealQueryCachePartition
} from '../queryClient'

// An in-memory AsyncStorage keeps the suite free of native modules while still exercising the real
// persisters: what these tests assert is which key a write lands under and what a read hands back,
// which is exactly what the account boundary rests on.
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
      }),
      clear: jest.fn(async () => {
        store.clear()
      })
    }
  }
})

const USER_A = 'uid-aaaa'
const USER_B = 'uid-bbbb'
const USER_C = 'uid-cccc'

const DIARY_KEY = ['dailyMacros', '2026-07-05']

// The clock is frozen so a stored payload is never judged expired by the 24-hour restore default.
// One consequence to respect when adding a case: a persister throttles its writes against this
// clock, so call persistClient at most once per persister object and build a new one to write again.
const NOW = 1_760_000_000_000

const makePersistedClient = (owner: string) => ({
  buster: owner,
  timestamp: Date.now(),
  clientState: {
    mutations: [],
    queries: [
      {
        queryHash: JSON.stringify(DIARY_KEY),
        queryKey: DIARY_KEY,
        state: {
          data: {calories: 1940, owner},
          dataUpdateCount: 1,
          dataUpdatedAt: Date.now(),
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

// Hydrating a query schedules its garbage-collection timer, so every client a test restores into is
// cleared afterwards and the suite leaves no open handle behind.
let hydrationClients: QueryClient[] = []

const makeHydrationClient = (): QueryClient => {
  const client = new QueryClient()

  hydrationClients.push(client)

  return client
}

beforeEach(async () => {
  jest.clearAllMocks()
  jest.spyOn(Date, 'now').mockReturnValue(NOW)
  await AsyncStorage.clear()
  sealQueryCachePartition()
})

afterEach(() => {
  hydrationClients.forEach(client => client.clear())
  hydrationClients = []
  jest.restoreAllMocks()
})

describe('PERSISTED_QUERY_KEYS', () => {
  it('persists only the whitelisted queries', () => {
    expect(PERSISTED_QUERY_KEYS).toEqual(['exercises', 'dailyMacros', 'foods', 'userAvatar', 'mealPlanCurrent'])
  })
})

describe('queryCacheKeyForUser', () => {
  it('gives each account its own storage key under the shared prefix', () => {
    expect(queryCacheKeyForUser(USER_A)).toBe(`${LEGACY_QUERY_CACHE_KEY}:${USER_A}`)
    expect(queryCacheKeyForUser(USER_A)).not.toBe(queryCacheKeyForUser(USER_B))
  })

  it('never collides with the device-wide key earlier builds wrote', () => {
    expect(queryCacheKeyForUser(USER_A)).not.toBe(LEGACY_QUERY_CACHE_KEY)
  })
})

describe('queryCachePersisterFor', () => {
  it('moves no authorization of its own, so a render that is never committed changes nothing', async () => {
    activateQueryCachePartition(USER_A)

    const speculativePersister = queryCachePersisterFor(USER_B)
    const activePersister = queryCachePersisterFor(USER_A)

    await speculativePersister.persistClient(makePersistedClient(USER_B))
    await activePersister.persistClient(makePersistedClient(USER_A))

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.toBeNull()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toContain(USER_A)
  })

  it("writes an account's cache under that account's key and nowhere else", async () => {
    activateQueryCachePartition(USER_A)

    await queryCachePersisterFor(USER_A).persistClient(makePersistedClient(USER_A))

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toContain(USER_A)
    await expect(AsyncStorage.getItem(LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.toBeNull()
  })

  it('restores only what its own account stored', async () => {
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_A), JSON.stringify(makePersistedClient(USER_A)))

    activateQueryCachePartition(USER_A)
    await expect(queryCachePersisterFor(USER_A).restoreClient()).resolves.toMatchObject({buster: USER_A})

    activateQueryCachePartition(USER_B)
    await expect(queryCachePersisterFor(USER_B).restoreClient()).resolves.toBeUndefined()
  })

  it('drops a write from the previous account once the next one has been published', async () => {
    activateQueryCachePartition(USER_A)

    const previousAccountPersister = queryCachePersisterFor(USER_A)

    activateQueryCachePartition(USER_B)

    // The real shape of this: a persister keeps a throttled write scheduled after the provider that
    // owned it is unmounted, and by the time it fires the cache holds the incoming account's data.
    await previousAccountPersister.persistClient(makePersistedClient(USER_B))

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })

  it('drops a write once the partition is sealed', async () => {
    activateQueryCachePartition(USER_A)

    const persister = queryCachePersisterFor(USER_A)

    sealQueryCachePartition()

    await persister.persistClient(makePersistedClient(USER_A))

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })

  it('writes again for the same account once it is published again', async () => {
    activateQueryCachePartition(USER_B)
    activateQueryCachePartition(USER_A)

    await queryCachePersisterFor(USER_A).persistClient(makePersistedClient(USER_A))

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toContain(USER_A)
  })

  it('neither restores nor stores anything while no identity is known', async () => {
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_A), JSON.stringify(makePersistedClient(USER_A)))

    const unidentifiedPersister = queryCachePersisterFor(null)

    await expect(unidentifiedPersister.restoreClient()).resolves.toBeUndefined()

    await unidentifiedPersister.persistClient(makePersistedClient(USER_A))

    await expect(AsyncStorage.getItem(LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
  })

  it('drops a write from the account that has just signed out', async () => {
    activateQueryCachePartition(USER_A)

    const signedOutAccountPersister = queryCachePersisterFor(USER_A)

    activateQueryCachePartition(null)

    await signedOutAccountPersister.persistClient(makePersistedClient(USER_A))

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })
})

// The ordering the key and the buster cannot catch on their own: restore hydrates the app's single
// shared QueryClient and is not cancelled when its provider unmounts, so a read started for the
// outgoing account can land after the incoming one is live — and from that live cache the incoming
// account's own subscription would write it back under the incoming key and buster.
describe('a restore still in flight when the account changes', () => {
  const holdNextRead = (payload: string) => {
    let releaseRead: () => void = () => undefined
    const held = new Promise<void>(resolve => {
      releaseRead = resolve
    })

    jest.mocked(AsyncStorage.getItem).mockImplementationOnce(async () => {
      await held

      return payload
    })

    return () => releaseRead()
  }

  it('hydrates nothing into the shared client, and nothing reaches the incoming partition', async () => {
    activateQueryCachePartition(USER_A)

    const outgoingPersister = queryCachePersisterFor(USER_A)
    const liveClient = makeHydrationClient()
    const releaseRead = holdNextRead(JSON.stringify(makePersistedClient(USER_A)))
    const restore = persistQueryClientRestore({
      queryClient: liveClient,
      persister: outgoingPersister,
      buster: USER_A
    })

    activateQueryCachePartition(USER_B)

    const incomingPersister = queryCachePersisterFor(USER_B)

    releaseRead()
    await restore

    expect(liveClient.getQueryData(DIARY_KEY)).toBeUndefined()

    await persistQueryClientSave({queryClient: liveClient, persister: incomingPersister, buster: USER_B})

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.not.toContain(USER_A)
  })

  it('still hydrates when the same account is still the one signed in', async () => {
    activateQueryCachePartition(USER_A)

    const liveClient = makeHydrationClient()
    const releaseRead = holdNextRead(JSON.stringify(makePersistedClient(USER_A)))
    const restore = persistQueryClientRestore({
      queryClient: liveClient,
      persister: queryCachePersisterFor(USER_A),
      buster: USER_A
    })

    releaseRead()
    await restore

    expect(liveClient.getQueryData(DIARY_KEY)).toEqual({calories: 1940, owner: USER_A})
  })
})

describe('discardPersistedQueryCache', () => {
  it("removes that account's cache from the device and leaves every other account's alone", async () => {
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_A), JSON.stringify(makePersistedClient(USER_A)))
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_B), JSON.stringify(makePersistedClient(USER_B)))

    await discardPersistedQueryCache(USER_A)

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toBeNull()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })

  it('is a no-op when that account never persisted anything', async () => {
    await expect(discardPersistedQueryCache(USER_A)).resolves.toBeUndefined()
  })
})

// What makes removal at an account change unconditional rather than best-effort: the removal there
// is started and not awaited, so this is the sweep that finishes it if the process died first.
describe('discardForeignPersistedQueryCaches', () => {
  it("removes every other account's cache and keeps the signed-in account's", async () => {
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_A), JSON.stringify(makePersistedClient(USER_A)))
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_B), JSON.stringify(makePersistedClient(USER_B)))
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_C), JSON.stringify(makePersistedClient(USER_C)))

    await discardForeignPersistedQueryCaches(USER_B)

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toBeNull()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_C))).resolves.toBeNull()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })

  it('leaves storage this feature does not own alone', async () => {
    await AsyncStorage.setItem('meal-plan-store', '{"state":{"pendingIntents":{}}}')
    await AsyncStorage.setItem('user-data-store', '{"state":{"targetCalories":1940}}')

    await discardForeignPersistedQueryCaches(USER_B)

    await expect(AsyncStorage.getItem('meal-plan-store')).resolves.not.toBeNull()
    await expect(AsyncStorage.getItem('user-data-store')).resolves.not.toBeNull()
  })

  it('touches the device only when there is something to remove', async () => {
    await discardForeignPersistedQueryCaches(USER_B)

    expect(jest.mocked(AsyncStorage.multiRemove)).not.toHaveBeenCalled()
  })
})

describe('purgeLegacyQueryCache', () => {
  it('removes the device-wide cache earlier builds wrote and keeps the partitions', async () => {
    await AsyncStorage.setItem(LEGACY_QUERY_CACHE_KEY, JSON.stringify(makePersistedClient(USER_A)))
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_B), JSON.stringify(makePersistedClient(USER_B)))

    await purgeLegacyQueryCache()

    await expect(AsyncStorage.getItem(LEGACY_QUERY_CACHE_KEY)).resolves.toBeNull()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.not.toBeNull()
  })
})

// The case the account boundary has to survive: the process dies between a sign-out and the next
// launch, so the previous account's cache is still on the device when somebody else signs in.
describe('a cache left behind by a killed process', () => {
  it('is not hydrated for the next account, and is not readable through its persister', async () => {
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_A), JSON.stringify(makePersistedClient(USER_A)))

    activateQueryCachePartition(USER_B)

    const nextAccountClient = makeHydrationClient()

    await persistQueryClientRestore({
      queryClient: nextAccountClient,
      persister: queryCachePersisterFor(USER_B),
      buster: USER_B
    })

    expect(nextAccountClient.getQueryData(DIARY_KEY)).toBeUndefined()
  })

  it('is then swept off the device by the account that is signed in', async () => {
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_A), JSON.stringify(makePersistedClient(USER_A)))

    await discardForeignPersistedQueryCaches(USER_B)

    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_A))).resolves.toBeNull()
  })

  it('is discarded rather than hydrated when it carries another account as its buster', async () => {
    // Belt and braces behind the key: even a payload that somehow sits under this account's key is
    // thrown away, because restore compares the buster App.tsx passes with the stored one.
    await AsyncStorage.setItem(queryCacheKeyForUser(USER_B), JSON.stringify(makePersistedClient(USER_A)))

    activateQueryCachePartition(USER_B)

    const nextAccountClient = makeHydrationClient()

    await persistQueryClientRestore({
      queryClient: nextAccountClient,
      persister: queryCachePersisterFor(USER_B),
      buster: USER_B
    })

    expect(nextAccountClient.getQueryData(DIARY_KEY)).toBeUndefined()
    await expect(AsyncStorage.getItem(queryCacheKeyForUser(USER_B))).resolves.toBeNull()
  })

  it('is hydrated for its own account, which is what keeps the diary readable offline', async () => {
    activateQueryCachePartition(USER_A)

    const persister = queryCachePersisterFor(USER_A)

    await persister.persistClient(makePersistedClient(USER_A))

    const sameAccountClient = makeHydrationClient()

    await persistQueryClientRestore({queryClient: sameAccountClient, persister, buster: USER_A})

    expect(sameAccountClient.getQueryData(DIARY_KEY)).toEqual({calories: 1940, owner: USER_A})
  })
})
