import AsyncStorage from '@react-native-async-storage/async-storage'
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister'
import {QueryClient} from '@tanstack/react-query'
import {
  AsyncStorage as PersistedCacheStorage,
  persistQueryClientRestore,
  PersistedClient,
  Persister,
  PersistQueryClientProviderProps
} from '@tanstack/react-query-persist-client'
import {classifyOutcome, getApiErrorStatus} from '@utility/ApiErrorUtility'

import {queryKeys} from './keys'

// Only whitelisted queries are persisted to AsyncStorage — everything else is
// memory-only and refetches on app launch. Exercises are kept on device so the
// workout flow keeps working offline (replaces the old offline exercises store).
// dailyMacros/foods persist so the Macros screen renders offline (display only —
// there is no offline write queue for macros in v1).
// userAvatar persists so the profile photo shows on cold launch without a refetch.
// mealPlanCurrent persists so the saved weekly plan renders offline (display only —
// the plan is read-only until reconnect and no plan writes are queued).
export const PERSISTED_QUERY_KEYS: string[] = ['exercises', 'dailyMacros', 'foods', 'userAvatar', 'mealPlanCurrent']

// One retry is the budget every query in this app has always had, and it stays the app-wide default
// below. The predicate underneath spends it differently, but it never gets a different budget — the
// two read the same constant so they cannot drift apart.
const QUERY_RETRY_BUDGET = 1

// The three client statuses a second attempt can legitimately resolve: a request timeout, an early-data
// rejection, and a rate limit. Every other 4xx is the server's deterministic answer about this request.
const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429])

/**
 * Whether a failed query is worth attempting again, applied to the meal-planning and catalog resource
 * reads alone (see RETRY_CLASSIFIED_QUERY_ROOTS below).
 *
 * A decoded terminal answer is requested once and not twice: `classifyOutcome(error) === 'confirmed'`
 * is the app's single definition of "the server described this outcome" (AAP 0.2.5 — a 4xx carrying
 * `{error: string}`, or a 5xx carrying a recognised machine code such as `feature_disabled`), and the
 * screens that render those answers — not found, stale plan, ineligible recipe, feature unavailable —
 * gain nothing from asking again. A bare 4xx is refused for the same reason even without a decodable
 * body, except for the three transient statuses above; the 401 token refresh is not a case here at all,
 * because the axios interceptor in `src/service/http/httpRequest.ts` performs it inside the request.
 *
 * Everything else keeps its one retry: no response at all (timeout, network error, airplane mode), an
 * undecodable body, and a 5xx without a recognised code may all succeed on a second attempt.
 */
export const shouldRetryQuery = (failureCount: number, error: Error): boolean => {
  if (failureCount >= QUERY_RETRY_BUDGET) {
    return false
  }

  if (classifyOutcome(error) === 'confirmed') {
    return false
  }

  const status = getApiErrorStatus(error)

  if (status !== null && status >= 400 && status < 500) {
    return RETRYABLE_CLIENT_STATUSES.has(status)
  }

  return true
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // gcTime must outlive an offline session for persisted queries to restore
      gcTime: 24 * 60 * 60_000,
      // A plain attempt budget, which is the contract every query in this app has always had and the
      // one `src/queries/mealPlanning/useNutritionTargetsQuery.ts` documents as "the client default is
      // `retry: 1`". The classification above is a meal-planning read policy, so it is registered per
      // family rather than here: as an app-wide default it would silently change how the diary, the
      // exercise list, the food search and every other legacy query behave on a 4xx.
      retry: QUERY_RETRY_BUDGET
    }
  }
})

// The query families the classification above applies to: the meal-planning and catalog resource
// reads, and nothing else. `setQueryDefaults` is what scopes it — query-core resolves a query's
// options as `{...defaultOptions.queries, ...getQueryDefaults(queryKey), ...options}` and
// `getQueryDefaults` merges every *partial* key match, so a family root here covers its own detail
// keys, beats the app-wide budget above, and still loses to a hook that declares a `retry` of its own
// (`useNutritionTargetsQuery` and `useMealPlanDayQuery` both do, to decline a retry of their own
// terminal answer).
//
// Why it is registered at all: PERFMOB-F19 asked for the classification on these reads, because a
// decoded terminal answer — not found, stale plan, ineligible recipe, feature unavailable — is what
// their recovery states render, and a second identical request only delays that. Why it is registered
// *here* rather than on the client's defaults: REGC-cache-key-purge's sibling finding
// REGC-retry-policy-appwide refuses it app-wide, and AAP 0.7.2 scopes the new retry classification to
// the four keyed mutations, which declare it themselves.
//
// The roots are read out of `queryKeys` rather than written again as literals. Two families exist
// only as detail factories, so their root is the first segment of a key the factory builds.
// `mealPlanCapability` is deliberately absent: it has no `queryFn`, is written only by the entitlement
// recorder, and therefore never fails.
const rootOf = (detailKey: readonly string[]): readonly string[] => detailKey.slice(0, 1)

const RETRY_CLASSIFIED_QUERY_ROOTS: readonly (readonly string[])[] = [
  queryKeys.mealPlanPreferences,
  queryKeys.nutritionTargets,
  queryKeys.targetEstimate,
  queryKeys.mealPlanCurrent,
  queryKeys.mealPlanDayAll,
  queryKeys.swapAlternativesAll,
  queryKeys.swapPreviewAll,
  queryKeys.groceryListAll,
  queryKeys.affectedMealsAll,
  queryKeys.catalogSuggestions,
  rootOf(queryKeys.recipeVersion('')),
  rootOf(queryKeys.catalogSearch(''))
]

RETRY_CLASSIFIED_QUERY_ROOTS.forEach(root => {
  queryClient.setQueryDefaults(root, {retry: shouldRetryQuery})
})

// Everything above is shared by every account that ever signs in on this device; everything below
// makes sure only one of them can read or write what is on disk. The persisted cache holds diary
// macros, the profile photo and the whole current meal plan, so a single device-wide blob would let
// whoever signs in next cold-start into the previous account's health data — the store's in-memory
// cleanup cannot reach a file, and a persist write is throttled and asynchronous, so no flush can be
// relied on either. The boundary is therefore structural: the storage key carries the account.
export const QUERY_CACHE_KEY_PREFIX = 'soh-query-cache'

// The device-wide key every build before this one wrote to. Its contents belong to whichever account
// happened to be signed in here last, so nothing reads it as it stands; it is resolved once per launch
// instead (resolveLegacyQueryCache), which adopts it into that account's own partition when the device
// can be shown to have been signed into it before this launch, and otherwise takes it off the device
// unread.
export const LEGACY_QUERY_CACHE_KEY = QUERY_CACHE_KEY_PREFIX

export const queryCacheKeyForUser = (userId: string): string => `${QUERY_CACHE_KEY_PREFIX}:${userId}`

// The partition of the account that is signed in right now, or none. It is moved by
// activateQueryCachePartition alone, which the auth store calls when it publishes an identity — a
// committed fact, never a render, so a speculative or abandoned render cannot move authorization.
let writablePartitionKey: string | null = null

const isPartitionActive = (key: string): boolean => key === writablePartitionKey

const isPartitionKey = (key: string): boolean => key.startsWith(`${QUERY_CACHE_KEY_PREFIX}:`)

// A key names its account, so a read can only ever reach its own partition — what the gate is here
// for is writes, in both of the ways one can outlive the account it was started for: the persister
// throttles its writes, so a save called while this account was live can reach storage after the
// next account is, and clearing the cache at an account change makes every mounted observer refetch.
// Without the gate either could be written under the outgoing account's key.
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

// Two fields are excluded deliberately, and both have to be: each is `Date.now()` read at save time, so
// either one left in makes every payload unique and defeats the comparison entirely. The payload's own
// `timestamp` is stamped by the provider; `dehydratedAt` is stamped per query by query-core's
// `dehydrateQuery`, which is why excluding only the first is not enough.
//
// Nothing is lost by leaving them out. A real refetch moves `dataUpdatedAt` inside `clientState`, so
// genuine refreshes still differ and still write; the 24-hour `maxAge` at restore keeps measuring from
// the last write that actually happened; and `dehydratedAt` is read at hydration only against the
// `dataUpdatedAt` of the same payload, which this comparison does include. Every other field of the
// dehydrated state is carried through, so a version that adds one is compared rather than ignored.
const signatureOf = ({buster, clientState}: PersistedClient): string => {
  const {queries, ...rest} = clientState

  return JSON.stringify({
    buster,
    ...rest,
    queries: queries.map(({dehydratedAt: _dehydratedAt, ...query}) => query)
  })
}

/**
 * The persister for one account. Pure: it reads no identity of its own and moves no authorization,
 * so it is safe to build during a render that React may never commit.
 *
 * Three guards live here, and each answers a different way an operation can outlive the account it
 * was started for.
 *
 * The write half is the storage gate above, plus the partition check before anything is remembered
 * as stored: `persistQueryClientSubscribe` saves after every query *and* mutation cache event, and
 * the whitelist is applied while dehydrating, so most saves carry a payload the device already holds.
 * Comparing the dehydrated content replaces that serialization *and* device write with one
 * serialization — held per persister, so the signature is what *this account's* partition is known to
 * hold and can never suppress a write for another. A save the gate would drop is not recorded at all:
 * were it recorded, the same payload offered again once the partition reopened would be suppressed as
 * already stored, and nothing would ever reach the device.
 *
 * The read half matters because restore hydrates the app's single shared QueryClient and is never
 * cancelled when its provider unmounts: a read that started for the outgoing account can resolve
 * after the incoming one is live, and a late answer would pour the previous account's diary, avatar
 * and meal plan into the incoming account's cache — from where its own subscription would persist it
 * under its own key and its own buster, defeating both of those guards. Answering "nothing stored"
 * instead is the only point at which that ordering can be caught.
 */
export const queryCachePersisterFor = (userId: string | null): Persister => {
  if (userId === null) {
    return unidentifiedSessionPersister
  }

  const key = queryCacheKeyForUser(userId)

  // The signature of the payload this account's partition is known to hold, or null when nothing is.
  let persistedSignature: string | null = null

  const stored = createAsyncStoragePersister({
    storage: partitionedCacheStorage,
    key,
    // Invoked only after a write failed, with the payload that failed. Forgetting the signature is
    // what keeps the dedupe from suppressing the next attempt: the device does not hold what we last
    // tried to write, so the next save must go through. Returning `undefined` gives up on this
    // payload exactly as the unconfigured persister did — the next cache event saves the current
    // state anyway.
    retry: () => {
      persistedSignature = null

      return undefined
    }
  })

  return {
    persistClient: async client => {
      if (!isPartitionActive(key)) {
        return
      }

      const signature = signatureOf(client)

      if (signature === persistedSignature) {
        return
      }

      persistedSignature = signature

      await stored.persistClient(client)
    },
    restoreClient: async () => {
      const restored = await stored.restoreClient()

      return isPartitionActive(key) ? restored : undefined
    },
    removeClient: async () => {
      persistedSignature = null

      await stored.removeClient()
    }
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
 * on every launch: nothing writes that key any more, so it can only ever be leftover data. This is the
 * discard half of resolveLegacyQueryCache below — every path that cannot prove who owns the blob ends
 * here rather than leaving health data at rest under a key no account can read.
 */
export const purgeLegacyQueryCache = async (): Promise<void> => {
  await AsyncStorage.removeItem(LEGACY_QUERY_CACHE_KEY)
}

// How far the account's last sign-in has to predate this launch before the pre-partition blob is
// treated as that account's. Five minutes rather than zero because the two timestamps are read from
// different clocks (see claimsLegacyQueryCache).
export const LEGACY_CLAIM_MARGIN_MS = 5 * 60_000

/**
 * Whether the account published at this launch may claim the pre-partition cache blob as its own.
 *
 * The blob carries no owner at all — there is no uid in the payload, none in any persisted query key
 * and none in the persisted state of `useUserData` — so ownership cannot be read; it can only be
 * inferred. The one sound inference is that the device was *already* signed into this account before
 * this launch began: a session Firebase restored rather than one created here was established by an
 * earlier run of the app, which is the only run that could have written the blob.
 *
 * The margin is what keeps two clocks from deciding it. `lastSignInTime` is an ISO string stamped by
 * the server clock and documented by the SDK as accurate only to a two-minute granularity for
 * consecutive sign-ins, while the launch timestamp is device time; a bare `<` comparison would let a
 * few seconds of skew read a sign-in that has just happened as one that predates the launch, and the
 * account would inherit a blob it never wrote. Five minutes clears the documented granularity with
 * room to spare and costs an upgrading user nothing: their session was restored, not created, so its
 * sign-in is as old as their last real sign-in.
 */
export const claimsLegacyQueryCache = (lastSignInTime: string | null, launchedAtMs: number): boolean => {
  if (lastSignInTime === null) {
    return false
  }

  const signedInAtMs = Date.parse(lastSignInTime)

  if (!Number.isFinite(signedInAtMs)) {
    return false
  }

  return launchedAtMs - signedInAtMs >= LEGACY_CLAIM_MARGIN_MS
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// The shape a restore can actually hydrate: an object whose `clientState.queries` is an array. Anything
// else found on that key — a truncated write, another library's value, a payload a future version
// writes differently — is not adopted into an account's partition, because `hydrate` iterates that
// array unguarded and the provider answers a throw there by removing the cache and re-raising, so an
// adopted foreign payload would turn one launch's cold start into a rejected restore.
const dehydratedCachePayloadOf = (raw: string): Record<string, unknown> | null => {
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }

  if (!isRecord(parsed) || !isRecord(parsed.clientState) || !Array.isArray(parsed.clientState.queries)) {
    return null
  }

  return parsed
}

/**
 * The pre-partition payload rewritten to belong to one account, or null when what is on that key is not
 * a dehydrated cache at all.
 *
 * Rewriting `buster` is not cosmetic — it is the whole of why a verbatim copy would not work. Restore
 * compares the stored buster with the one the provider passes (`sessionCacheBindingFor` passes the uid)
 * and *removes* the payload on a mismatch, and a blob written before this app passed a buster at all
 * carries `''`. Copied as it stands it would be deleted at the next restore instead of hydrated, which
 * is the same data loss by a longer route.
 *
 * `timestamp` is deliberately left alone: the 24-hour `maxAge` the provider applies at restore must go
 * on measuring from the last write that actually happened, not from this migration, or an adoption
 * would silently extend the life of a cache that had already expired.
 */
export const rebusteredLegacyQueryCache = (raw: string, userId: string): string | null => {
  const payload = dehydratedCachePayloadOf(raw)

  if (payload === null) {
    return null
  }

  return JSON.stringify({...payload, buster: userId})
}

/**
 * What became of the pre-partition cache blob at this launch.
 *
 * - `absent` — nothing is on that key. Every launch after the first reports this, which is what makes
 *   the resolution free to run unconditionally.
 * - `adopted` — the blob is now the signed-in account's own partition, and has been hydrated into the
 *   live cache so this launch renders from it rather than the one after.
 * - `superseded` — that account already has a partition of its own. That partition is authoritative, so
 *   the blob is dropped and the partition is left exactly as it was.
 * - `discarded` — nobody here can be shown to own the blob, so it leaves the device unread.
 */
export type LegacyQueryCacheOutcome = 'absent' | 'adopted' | 'superseded' | 'discarded'

export interface LegacyQueryCacheSession {
  /** The uid Firebase has just published, or none when nobody is signed in. */
  userId: string | null
  /** `user.metadata.lastSignInTime` — a server-clock ISO string, or none when it was not reported. */
  lastSignInTime: string | null
}

/**
 * Resolves the pre-partition cache blob once per launch: adopted into the signed-in account's partition
 * when that account can be shown to have owned it, and off the device in every other case.
 *
 * This exists because partitioning the persisted cache by account changed the key it lives under. A
 * device upgrading across that change holds a whole cache — diary macros, the exercise list, the food
 * list, the profile photo — under a key nothing reads any more, so simply removing it costs an
 * upgrading user a cold start on every one of those screens. Adoption keeps the account boundary the
 * partitioning was introduced for: the blob becomes *one* account's partition, never a value every
 * account can read, and an account that cannot be shown to have written it gets nothing.
 *
 * Called with the identity Firebase has just published, after the auth store has committed it — the
 * commit is what opens this account's partition, and the write below goes through the same gate as
 * every other write to a partition.
 */
export const resolveLegacyQueryCache = async (
  session: LegacyQueryCacheSession,
  launchedAtMs: number
): Promise<LegacyQueryCacheOutcome> => {
  const raw = await AsyncStorage.getItem(LEGACY_QUERY_CACHE_KEY)

  if (raw === null) {
    return 'absent'
  }

  const {userId, lastSignInTime} = session

  if (userId === null) {
    await purgeLegacyQueryCache()

    return 'discarded'
  }

  const ownKey = queryCacheKeyForUser(userId)

  // Either half failing means this account cannot be shown to own the blob: a session established
  // during this launch was not the one that wrote it, and a partition that is not open belongs to
  // somebody other than whoever the auth store has committed.
  if (!claimsLegacyQueryCache(lastSignInTime, launchedAtMs) || !isPartitionActive(ownKey)) {
    await purgeLegacyQueryCache()

    return 'discarded'
  }

  if ((await AsyncStorage.getItem(ownKey)) !== null) {
    await purgeLegacyQueryCache()

    return 'superseded'
  }

  const adopted = rebusteredLegacyQueryCache(raw, userId)

  if (adopted === null) {
    await purgeLegacyQueryCache()

    return 'discarded'
  }

  // Re-read because every step above is awaited: an account change in between moves the partition, and
  // the storage gate would then drop this write rather than misfile it — leaving the legacy key removed
  // and nothing written in its place. The blob is not provably this account's at that point either, and
  // the incoming account's sweep (discardForeignPersistedQueryCaches) would remove this partition
  // anyway, so discarding is both the honest outcome and the same end state.
  if (!isPartitionActive(ownKey)) {
    await purgeLegacyQueryCache()

    return 'discarded'
  }

  await partitionedCacheStorage.setItem(ownKey, adopted)

  // Writing it is not enough, and this is the second way the migration can silently do nothing. The
  // provider restores once per mounted session tree and attaches its save subscription as soon as that
  // restore resolves; on this launch its restore is dispatched while the reads above are still in
  // flight, so it finds the account's key still empty, hydrates nothing, and the launch's first cache
  // event then saves the unhydrated cache straight over what was just adopted (the persister's throttle
  // does not delay a first write). Restoring here instead puts the payload where no later save can
  // erase it — the live cache — and the provider's next save writes it back out. Whichever of the two
  // reads wins, the outcome is the same: a duplicate hydration of identical data is a no-op.
  //
  // It goes through this account's own persister rather than reading storage directly, because that
  // persister is where the ordering guard lives: an account change between the write above and this
  // read makes `restoreClient` answer "nothing stored", so a resolution that lands late cannot pour one
  // account's diary, avatar and plan into another's cache. A payload that has outlived the provider's
  // 24-hour window is dropped by this restore, exactly as the pre-partition build's own restore would
  // have dropped it.
  await persistQueryClientRestore({queryClient, persister: queryCachePersisterFor(userId), buster: userId})

  await purgeLegacyQueryCache()

  return 'adopted'
}
