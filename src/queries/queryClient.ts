import AsyncStorage from '@react-native-async-storage/async-storage'
import {createAsyncStoragePersister} from '@tanstack/query-async-storage-persister'
import {QueryClient} from '@tanstack/react-query'

// Only whitelisted queries are persisted to AsyncStorage — everything else is
// memory-only and refetches on app launch. Exercises are kept on device so the
// workout flow keeps working offline (replaces the old offline exercises store).
// dailyMacros/foods persist so the Macros screen renders offline (display only —
// there is no offline write queue for macros in v1).
// userAvatar persists so the profile photo shows on cold launch without a refetch.
// coachState persists so the expenditure card renders offline (display only —
// the server recomputes on the next authenticated read).
export const PERSISTED_QUERY_KEYS: string[] = ['exercises', 'dailyMacros', 'foods', 'userAvatar', 'coachState']

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

export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'soh-query-cache'
})
