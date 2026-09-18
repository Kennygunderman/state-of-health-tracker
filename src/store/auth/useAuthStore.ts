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
import useMealPlanStore, {
  clearPersistedPendingIntents,
  discardPendingIntentsForSignIn,
  prunePendingIntentsForUser
} from '@store/mealPlan/useMealPlanStore'
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

// Everything the outgoing account owns that lives in this process. Synchronous and infallible
// by construction, and it runs before any of the device cleanup below: a boundary that only
// held when a filesystem call succeeded would be no boundary at all.
// Sealing the persisted cache partition is deliberately the first statement and cannot be
// reordered: clearing the cache makes every mounted query refetch, and from here until the next
// account opens its own partition those responses belong to nobody this partition may be written
// for.
const clearInMemoryUserData = (): void => {
  sealQueryCachePartition()
  queryClient.clear()
  useDailyWorkoutEntryStore.getState().reset()
  useProgressStore.getState().reset()
  // The meal-plan store holds plan UI state and its persisted pending intents, neither of
  // which the query cache reaches, so a session change has to clear it here for the plan not
  // to be readable by whoever signs in next
  useMealPlanStore.getState().reset()
}

// The persisted query cache is the one half of the boundary that outlives the process, so the
// account leaving the session has its partition taken off the device rather than only out of
// memory. Partitioning is what makes the isolation hold even if this never completes — another
// account reads another key — so a rejection is reported rather than surfaced as a failed
// sign-out, and reported as a fixed code: a native storage rejection carries paths, module detail
// and payload context that must not reach a device or crash log.
const discardPersistedCacheForUser = async (userId: string): Promise<void> => {
  try {
    await discardPersistedQueryCache(userId)
  } catch {
    console.error('persisted_query_cache_removal_failed')
  }
}

// A persisted meal-plan intent stays replayable for seven days and carries the account that minted it, so
// every point at which an identity becomes known has to sweep the ones that belong to somebody else — a
// record the outgoing session failed to erase would otherwise be waiting when its own account signs back in.
// Kept as one helper so each call site is a single line, and safe to call before hydration: the sweep defers
// itself until the persisted slice has actually come back (prunePendingIntentsForUser).
//
// This is the RESTORE half of the boundary, and it deliberately keeps a record belonging to the user it is
// given: a cold start that restores a session is the case an unresolved key exists for (AAP 0.7.2). The
// explicit sign-in paths below call discardPendingIntentsForSignIn instead, which keeps nothing — a
// credentialed sign-in means the session that minted any record has ended.
const prunePendingIntentsForKnownUser = (userId: string | null): void => {
  if (userId === null) {
    return
  }

  prunePendingIntentsForUser(userId, Date.now)
}

// Logged instead of the outcome object for the same reason the store logs codes rather than errors: the
// record this names carries an idempotency key and a request body (CWE-532).
const INTENT_ERASURE_FAILURE_CODE = 'meal_plan_intent_erasure_incomplete'

// A filesystem rejection here must never be the reason a sign-out looks failed: it happens after
// the boundary above is already enforced, and the caller only awaits the auth provider's own
// result. Reported as a fixed code for the same reason as the cache above.
const clearOfflineWorkoutFile = async (): Promise<void> => {
  try {
    await offlineWorkoutStorageService.clear()
  } catch {
    console.error('offline_workout_file_clear_failed')
  }
}

// Clears everything owned by the previous account so a different login never sees stale data:
// server cache in memory and on the device, unsynced workouts, the in-progress workout, and the
// persisted meal-plan intents. The order is the contract — memory first, then the fallible device
// calls, each reporting its own failure — so no single rejection can leave the previous account's
// data readable.
// `userId` is the account being signed out; the caller reads it before the auth provider's own
// listener can null it, and it is `null` only when there was no session to clean up.
const clearUserSession = async (userId: string | null): Promise<void> => {
  clearInMemoryUserData()

  if (userId !== null) {
    await discardPersistedCacheForUser(userId)
  }

  await clearOfflineWorkoutFile()

  // The one step whose outcome is acted on rather than only reported. Sign-out still completes when the
  // device refuses the erasure — the convention above — but a record left at rest must not silently pass for
  // a closed boundary, so it is logged as a fixed code and, decisively, the next explicit sign-in discards
  // every persisted intent rather than trusting this call to have succeeded.
  const erasure = await clearPersistedPendingIntents()

  if (erasure.kind === 'failed') {
    console.error(INTENT_ERASURE_FAILURE_CODE)
  }
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

    prunePendingIntentsForKnownUser(user?.uid ?? null)

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

    // A remote sign-out, a revoked token and an account change all arrive here and nowhere else,
    // so the session boundary has to be enforced on this path too and not only in logoutUser:
    // the query cache and the user-scoped stores are singletons that outlive the navigator swap,
    // so without this whoever signs in next can read the previous account's diary, meal plan and
    // avatar until every one of those queries has refetched. Only a real change of account
    // qualifies — an unchanged uid is a token or profile refresh, and a null previous id is
    // cold-start restore. The device cleanup is started rather than awaited because this action
    // is synchronous; each half reports its own failure, and the in-memory clear has already
    // closed the boundary before either runs.
    if (previousUserId !== null && previousUserId !== nextUserId) {
      clearInMemoryUserData()
      discardPersistedCacheForUser(previousUserId)
      clearOfflineWorkoutFile()
      clearPersistedPendingIntents()
    }

    set({
      userId: nextUserId,
      userEmail: user?.email ?? null,
      isAuthed: user !== null
    })

    prunePendingIntentsForKnownUser(nextUserId)
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

      discardPendingIntentsForSignIn()
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

      discardPendingIntentsForSignIn()
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

      discardPendingIntentsForSignIn()
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

      discardPendingIntentsForSignIn()
    } catch (error) {
      set({isAuthed: false})
      throw error
    } finally {
      set({isAttemptingAuth: false})
    }
  },
  logoutUser: async () => {
    // Read before signing out: the auth provider's listener reaches syncAuthState first and nulls
    // the id, and the account whose cache is being removed has to be known here even when it does.
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
