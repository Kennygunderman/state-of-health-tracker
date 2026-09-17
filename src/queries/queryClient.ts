import AsyncStorage from '@react-native-async-storage/async-storage'
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister'
import {QueryClient} from '@tanstack/react-query'
import {PersistedClient, Persister} from '@tanstack/react-query-persist-client'
import {classifyOutcome, getApiErrorStatus} from '@utility/ApiErrorUtility'

// Only whitelisted queries are persisted to AsyncStorage — everything else is
// memory-only and refetches on app launch. Exercises are kept on device so the
// workout flow keeps working offline (replaces the old offline exercises store).
// dailyMacros/foods persist so the Macros screen renders offline (display only —
// there is no offline write queue for macros in v1).
// userAvatar persists so the profile photo shows on cold launch without a refetch.
// mealPlanCurrent persists so the saved weekly plan renders offline (display only —
// the plan is read-only until reconnect and no plan writes are queued).
export const PERSISTED_QUERY_KEYS: string[] = ['exercises', 'dailyMacros', 'foods', 'userAvatar', 'mealPlanCurrent']

// One retry remains the app-wide budget for a query; what changes is which failures spend it.
const QUERY_RETRY_BUDGET = 1

// The three client statuses a second attempt can legitimately resolve: a request timeout, an early-data
// rejection, and a rate limit. Every other 4xx is the server's deterministic answer about this request.
const RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 425, 429])

/**
 * Whether a failed query is worth attempting again, shared by every query through `defaultOptions`.
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
      retry: shouldRetryQuery
    }
  }
})

// The signature of the payload already on the device, or null when nothing is known to be stored.
// Held per module rather than per call because the provider that drives persistence saves through one
// persister for the whole app lifetime.
let persistedSignature: string | null = null

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

const storedPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'soh-query-cache',
  // Invoked only after a write failed, with the payload that failed. Forgetting the signature is what
  // keeps the dedupe below from suppressing the next attempt: the device does not hold what we last
  // tried to write, so the next save must go through. Returning `undefined` gives up on this payload
  // exactly as the unconfigured persister did — the next cache event saves the current state anyway.
  retry: () => {
    persistedSignature = null

    return undefined
  }
})

/**
 * The app's persister: the AsyncStorage persister above with content deduplication in front of it.
 *
 * `persistQueryClientSubscribe` saves after every query *and* mutation cache event, and the whitelist
 * is applied while dehydrating, so an unrelated transient query or a mutation moving through pending →
 * success asks this persister to write a payload identical to the one already on disk. Comparing the
 * dehydrated content first replaces that serialization *and* device write with a single serialization,
 * and a mutation-cache event can no longer rewrite an unchanged query-only payload.
 */
export const asyncStoragePersister: Persister = {
  persistClient: async client => {
    const signature = signatureOf(client)

    if (signature === persistedSignature) {
      return
    }

    persistedSignature = signature

    await storedPersister.persistClient(client)
  },
  restoreClient: () => storedPersister.restoreClient(),
  removeClient: async () => {
    persistedSignature = null

    await storedPersister.removeClient()
  }
}
