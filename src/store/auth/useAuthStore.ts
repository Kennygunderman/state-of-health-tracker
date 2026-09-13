import {
  activateQueryCachePartition,
  discardPersistedQueryCache,
  queryClient,
  sealQueryCachePartition
} from '@queries/queryClient'
import {FirebaseAuthTypes} from '@react-native-firebase/auth'
import authService from '@service/auth/AuthService'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import useMealPlanStore, {prunePendingIntentsForUser} from '@store/mealPlan/useMealPlanStore'
import useProgressStore from '@store/progress/useProgressStore'
import {create} from 'zustand'

export type AuthState = {
  userId: string | null
  userEmail: string | null
  isAuthed: boolean
  isAttemptingAuth: boolean
  initAuth: () => boolean
  syncAuthState: (user: FirebaseAuthTypes.User | null) => void
  loginUser: (email: string, password: string) => Promise<void>
  registerUser: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  logoutUser: () => Promise<void>
  deleteUser: () => Promise<void>
}

// The account boundary itself: server cache, the in-progress workout, progress,
// and meal-plan UI state (including its persisted intents). Synchronous and
// infallible on purpose — nothing that can fail may run before it, or a rejection
// would leave the previous account's data readable by whoever signs in next.
// Sealing the persisted cache partition is deliberately the first statement and
// cannot be reordered: clearing the cache makes every mounted query refetch, and
// from here until the next account opens its own partition those responses belong
// to nobody this partition may be written for.
const clearInMemoryUserData = () => {
  sealQueryCachePartition()
  queryClient.clear()
  useDailyWorkoutEntryStore.getState().reset()
  useProgressStore.getState().reset()
  useMealPlanStore.getState().reset()
}

// The persisted query cache is the one half of the boundary that outlives the
// process, so the account leaving the session has its partition taken off the
// device rather than only out of memory. Partitioning is what makes the isolation
// hold even if this never completes — another account reads another key — so a
// rejection is reported for the same reason as the offline workout file below and
// never surfaced as a failed sign-out.
const discardPersistedCacheForUser = async (userId: string) => {
  try {
    await discardPersistedQueryCache(userId)
  } catch (error) {
    console.error("Failed to clear the previous account's persisted query cache during session cleanup:", error)
  }
}

// A filesystem rejection here must never be the reason a sign-out looks failed:
// it happens after the boundary above is already enforced, and the caller only
// awaits the auth provider's own result.
const clearOfflineWorkoutFile = async () => {
  try {
    await offlineWorkoutStorageService.clear()
  } catch (error) {
    console.error('Failed to clear unsynced offline workouts during session cleanup:', error)
  }
}

// Clears everything owned by the previous account so a different login never
// sees stale data: server cache in memory and on disk, the in-progress workout,
// and unsynced workouts. `userId` is the account being signed out — the caller
// reads it before the auth provider's own listener can null it — and is `null`
// only when there was no session to clean up.
const clearUserSession = async (userId: string | null) => {
  clearInMemoryUserData()

  if (userId !== null) {
    await discardPersistedCacheForUser(userId)
  }

  await clearOfflineWorkoutFile()
}

const useAuthStore = create<AuthState>()((set, get) => ({
  userId: null,
  userEmail: null,
  isAuthed: false,
  isAttemptingAuth: false,
  initAuth: () => {
    const user = authService.getCurrentUser()
    const isAuthed = user !== null

    set({
      userId: user?.uid ?? null,
      userEmail: user?.email ?? null,
      isAuthed
    })

    // A meal-plan intent is replayable only by the account that minted it, and this is the first
    // point in a launch where that account is known, so a record left behind by a previous one is
    // swept from the persisted slice here instead of waiting for the next keyed write.
    if (user !== null) {
      prunePendingIntentsForUser(user.uid, Date.now)
    }

    return isAuthed
  },
  // Keeps the store in sync with Firebase's async auth state — cold-start
  // session restore (which initAuth's synchronous read can miss) and remote
  // sign-outs. Wired to authService.subscribeToAuthChanges in App.tsx.
  syncAuthState: user => {
    // Explicit login/registration flows own their state transitions —
    // registration in particular must not flip isAuthed before the backend
    // account is created (a failure there rolls the Firebase user back)
    if (get().isAttemptingAuth) return

    const previousUserId = get().userId
    const nextUserId = user?.uid ?? null

    // A remote sign-out, a revoked token and an account change all arrive here
    // and nowhere else, so the boundary has to be enforced before the new state
    // is published — otherwise the incoming user renders the previous account's
    // cache. Only a real change of account qualifies: an unchanged uid is a
    // token or profile refresh, and a null previous id is cold-start restore.
    // The two device-storage sweeps are intentionally left unawaited — this
    // action is synchronous and each helper already reports its own failure.
    if (previousUserId !== null && previousUserId !== nextUserId) {
      clearInMemoryUserData()
      discardPersistedCacheForUser(previousUserId)
      clearOfflineWorkoutFile()
    }

    set({
      userId: nextUserId,
      userEmail: user?.email ?? null,
      isAuthed: user !== null
    })

    // Firebase restores a session asynchronously, so this is the other point where the account
    // becomes known — and the one that catches a restore initAuth's synchronous read missed.
    if (nextUserId !== null) {
      prunePendingIntentsForUser(nextUserId, Date.now)
    }
  },
  loginUser: async (email, password) => {
    set({isAttemptingAuth: true})
    try {
      const user = await authService.logInUser(email, password)

      set({
        userId: user.id,
        userEmail: user.email,
        isAuthed: true
      })
    } catch (error) {
      set({isAuthed: false})
      throw error
    } finally {
      set({isAttemptingAuth: false})
    }
  },
  registerUser: async (email, password) => {
    set({isAttemptingAuth: true})
    try {
      const account = await authService.registerUser(email, password)

      set({
        userId: account.id,
        userEmail: account.email,
        isAuthed: true
      })
    } catch (error) {
      set({isAuthed: false})
      throw error
    } finally {
      set({isAttemptingAuth: false})
    }
  },
  signInWithGoogle: async () => {
    set({isAttemptingAuth: true})
    try {
      const user = await authService.signInWithGoogle()

      if (!user) {
        return
      }

      set({
        userId: user.id,
        userEmail: user.email,
        isAuthed: true
      })
    } catch (error) {
      set({isAuthed: false})
      throw error
    } finally {
      set({isAttemptingAuth: false})
    }
  },
  signInWithApple: async () => {
    set({isAttemptingAuth: true})
    try {
      const user = await authService.signInWithApple()

      if (!user) {
        return
      }

      set({
        userId: user.id,
        userEmail: user.email,
        isAuthed: true
      })
    } catch (error) {
      set({isAuthed: false})
      throw error
    } finally {
      set({isAttemptingAuth: false})
    }
  },
  logoutUser: async () => {
    // Read before signing out: the auth provider's listener reaches syncAuthState
    // first and nulls the id, and the account whose cache is being removed has to
    // be known here even when it does.
    const previousUserId = get().userId

    await authService.logOutUser()
    await clearUserSession(previousUserId)

    set({
      userId: null,
      userEmail: null,
      isAuthed: false
    })
  },
  deleteUser: async () => {
    const previousUserId = get().userId

    await authService.deleteCurrentUser()
    await clearUserSession(previousUserId)

    set({
      userId: null,
      userEmail: null,
      isAuthed: false
    })
  }
}))

// Which account the persisted cache may be written for follows the identity this store has
// committed, and nothing else — in particular not a render, which React is free to start and throw
// away. Every action that changes accounts publishes through `set`, so one subscription covers them
// all, including any added later; zustand notifies synchronously, so the partition is already open
// before React renders the tree whose persister belongs to it.
useAuthStore.subscribe((state, previousState) => {
  if (state.userId !== previousState.userId) {
    activateQueryCachePartition(state.userId)
  }
})

export default useAuthStore
