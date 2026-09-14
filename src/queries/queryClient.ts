import AsyncStorage from '@react-native-async-storage/async-storage'
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister'
import {QueryClient} from '@tanstack/react-query'
import {
  AsyncStorage as PersistedCacheStorage,
  Persister,
  PersistQueryClientProviderProps
} from '@tanstack/react-query-persist-client'

// Only whitelisted queries are persisted to AsyncStorage — everything else is
// memory-only and refetches on app launch. Exercises are kept on device so the
// workout flow keeps working offline (replaces the old offline exercises store).
// dailyMacros/foods persist so the Macros screen renders offline (display only —
// there is no offline write queue for macros in v1).
// userAvatar persists so the profile photo shows on cold launch without a refetch.
// mealPlanCurrent persists so the saved weekly plan renders offline (display only —
// the plan is read-only until reconnect and no plan writes are queued).
export const PERSISTED_QUERY_KEYS: string[] = ['exercises', 'dailyMacros', 'foods', 'userAvatar', 'mealPlanCurrent']

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // gcTime must outlive an offline session for persisted queries to restore
      gcTime: 24 * 60 * 60_000,
      retry: 1
    }
  }
})

// Everything above is shared by every account that ever signs in on this device; everything below
// makes sure only one of them can read or write what is on disk. The persisted cache holds diary
// macros, the profile photo and the whole current meal plan, so a single device-wide blob would let
// whoever signs in next cold-start into the previous account's health data — the store's in-memory
// cleanup cannot reach a file, and a persist write is throttled and asynchronous, so no flush can be
// relied on either. The boundary is therefore structural: the storage key carries the account.
export const QUERY_CACHE_KEY_PREFIX = 'soh-query-cache'

// The device-wide key every build before this one wrote to. Nothing reads it any more, so it is
// removed once at launch (purgeLegacyQueryCache) rather than migrated — its contents belong to
// whichever account happened to be signed in last.
export const LEGACY_QUERY_CACHE_KEY = QUERY_CACHE_KEY_PREFIX

export const queryCacheKeyForUser = (userId: string): string => `${QUERY_CACHE_KEY_PREFIX}:${userId}`

// The partition of the account that is signed in right now, or none. It is moved by
// activateQueryCachePartition alone, which the auth store calls when it publishes an identity — a
// committed fact, never a render, so a speculative or abandoned render cannot move authorization.
let writablePartitionKey: string | null = null

const isPartitionActive = (key: string): boolean => key === writablePartitionKey

const isPartitionKey = (key: string): boolean => key.startsWith(`${QUERY_CACHE_KEY_PREFIX}:`)

// A key names its account, so a read can only ever reach its own partition — what the gate is here
// for is writes, in both of the ways one can outlive the account it was started for: a persister
// keeps a throttled write scheduled after it has been unsubscribed, and clearing the cache at an
// account change makes every mounted observer refetch. Without the gate either could be written
// under the outgoing account's key.
const partitionedCacheStorage: PersistedCacheStorage<string> = {
  getItem: key => AsyncStorage.getItem(key),
  setItem: async (key, value) => {
    if (key !== writablePartitionKey) {
      return
    }

    await AsyncStorage.setItem(key, value)
  },
  removeItem: key => AsyncStorage.removeItem(key)
}

// Before anyone is known to be signed in there is no partition to read or write, and restoring the
// last account's cache to find out who owns it is the defect itself. This persister answers "nothing
// stored" and drops every write, so restore is deferred until an identity exists.
// All three resolve rather than returning synchronously, so swapping this persister for a real one
// cannot change what a caller observes beyond the stored payload itself.
const unidentifiedSessionPersister: Persister = {
  persistClient: () => Promise.resolve(),
  restoreClient: () => Promise.resolve(undefined),
  removeClient: () => Promise.resolve()
}

/**
 * The persister for one account. Pure: it reads no identity of its own and moves no authorization,
 * so it is safe to build during a render that React may never commit.
 *
 * Both halves verify the partition is still the active one at the moment they finish, which is what
 * makes the boundary hold for an operation that outlives the account it was started for. The write
 * half is the storage gate above. The read half matters because restore hydrates the app's single
 * shared QueryClient and is never cancelled when its provider unmounts: a read that started for the
 * outgoing account can resolve after the incoming one is live, and a late answer would pour the
 * previous account's diary, avatar and meal plan into the incoming account's cache — from where its
 * own subscription would persist it under its own key and its own buster, defeating both of those
 * guards. Answering "nothing stored" instead is the only point at which that ordering can be caught.
 */
export const queryCachePersisterFor = (userId: string | null): Persister => {
  if (userId === null) {
    return unidentifiedSessionPersister
  }

  const key = queryCacheKeyForUser(userId)
  const stored = createAsyncStoragePersister({storage: partitionedCacheStorage, key})

  return {
    persistClient: stored.persistClient,
    restoreClient: async () => {
      const restored = await stored.restoreClient()

      return isPartitionActive(key) ? restored : undefined
    },
    removeClient: stored.removeClient
  }
}

// The React key of the session tree while nobody is signed in. Any value works as long as it cannot
// collide with a Firebase uid — those are 28 alphanumeric characters, so a hyphenated word cannot.
export const SIGNED_OUT_SESSION_KEY = 'signed-out'

export interface SessionCacheBinding {
  sessionKey: string
  persistOptions: PersistQueryClientProviderProps['persistOptions']
}

/**
 * Everything the app's single persisted-cache provider needs to belong to one account, derived from
 * that account and nothing else.
 *
 * It is one value rather than three because the three cannot be mixed: a persister for account A
 * mounted under a tree keyed for account B would write A's diary into B's session. Building them
 * together also keeps the derivation out of App.tsx, where it would be untestable glue.
 *
 * - `sessionKey` is the React key of the whole session tree. The signed-in uid is the identity of
 *   everything below it, so React recreates the subtree when the account changes rather than only
 *   when somebody signs out. Signing in as a different user with no signed-out render in between
 *   (Firebase delivers that as one uid replacing another) would otherwise leave the previous
 *   account's data in the two places a store or cache reset cannot reach: the meal-plan setup draft
 *   held in React Context (age, weight, diet, allergies, schedule, budget) and the navigation state,
 *   whose route params carry that account's plan, meal and recipe ids.
 * - `persistOptions.persister` reads and writes that account's partition alone, and stores nothing at
 *   all until an identity exists (queryCachePersisterFor(null)).
 * - `persistOptions.buster` is the second guard behind the key: a payload restored from another
 *   account's buster is removed instead of hydrated.
 * - `persistOptions.dehydrateOptions` applies the whitelist above, so only the queries listed there
 *   ever reach the device.
 */
export const sessionCacheBindingFor = (userId: string | null): SessionCacheBinding => ({
  sessionKey: userId ?? SIGNED_OUT_SESSION_KEY,
  persistOptions: {
    persister: queryCachePersisterFor(userId),
    buster: userId ?? '',
    dehydrateOptions: {
      shouldDehydrateQuery: query => PERSISTED_QUERY_KEYS.includes(String(query.queryKey[0]))
    }
  }
})

/**
 * Opens the partition of the account that has just been published, or closes the one that was open
 * when no account is signed in. The auth store owns every call: identity as this store has committed
 * it is the only thing allowed to move write authorization.
 */
export const activateQueryCachePartition = (userId: string | null): void => {
  writablePartitionKey = userId === null ? null : queryCacheKeyForUser(userId)
}

/**
 * Closes the writable partition without opening another — activating nobody. Session cleanup calls
 * this before clearing the cache, so the refetches that clearing provokes cannot be persisted
 * anywhere until the next account is published.
 */
export const sealQueryCachePartition = (): void => activateQueryCachePartition(null)

/**
 * Takes one account's persisted cache off the device. Partitioning already makes another account
 * unable to read it, so this is about not leaving a signed-out account's health data at rest.
 */
export const discardPersistedQueryCache = async (userId: string): Promise<void> => {
  await AsyncStorage.removeItem(queryCacheKeyForUser(userId))
}

/**
 * Removes every partition except the given account's. Removal at an account change is started
 * without being awaited — the action that triggers it is synchronous — so a process that dies in
 * between can leave the previous account's cache on disk. This is what makes that removal
 * unconditional rather than best-effort: it runs for whoever is signed in, so the next session
 * finishes the job, and it also collects partitions left behind by any earlier account.
 *
 * It is deliberately never called with "nobody signed in": at launch the app renders before Firebase
 * has restored its session, and treating that moment as "no account owns anything" would delete the
 * restoring account's own cache — the one thing that lets the diary and the saved plan render
 * offline.
 */
export const discardForeignPersistedQueryCaches = async (userId: string): Promise<void> => {
  const ownKey = queryCacheKeyForUser(userId)
  const foreignKeys = (await AsyncStorage.getAllKeys()).filter(key => isPartitionKey(key) && key !== ownKey)

  if (foreignKeys.length === 0) {
    return
  }

  await AsyncStorage.multiRemove(foreignKeys)
}

/**
 * Removes the pre-partition device-wide cache written by earlier builds. Safe to call at any time and
 * on every launch: nothing writes that key any more, so it can only ever be leftover data.
 */
export const purgeLegacyQueryCache = async (): Promise<void> => {
  await AsyncStorage.removeItem(LEGACY_QUERY_CACHE_KEY)
}
