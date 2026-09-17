import {asyncStoragePersister, queryClient} from '@queries/queryClient'
import {FirebaseAuthTypes} from '@react-native-firebase/auth'
import authService from '@service/auth/AuthService'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
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
const clearInMemoryUserData = () => {
  queryClient.clear()
  useDailyWorkoutEntryStore.getState().reset()
  useProgressStore.getState().reset()
  // The meal-plan store holds plan UI state and its persisted pending intents, neither of
  // which the query cache reaches, so a session change has to clear it here for the plan not
  // to be readable by whoever signs in next
  useMealPlanStore.getState().reset()
}

// The persisted query cache is the half of the boundary that outlives the process: it holds the
// diary, the profile photo and the saved weekly plan under one device-wide key, so the outgoing
// account's copy is taken off the device rather than only out of memory. Reported rather than
// thrown for the same reason as the workout file below — the memory boundary above is already
// enforced by the time this runs, and a storage failure must not surface as a failed sign-out.
const discardPersistedQueryCache = async () => {
  try {
    await asyncStoragePersister.removeClient()
  } catch (error) {
    console.error("Failed to remove the previous account's persisted query cache:", error)
  }
}

const clearOfflineWorkoutFile = async () => {
  try {
    await offlineWorkoutStorageService.clear()
  } catch (error) {
    console.error('Failed to clear unsynced offline workouts during session cleanup:', error)
  }
}

// Clears everything owned by the previous account so a different login never sees stale data:
// server cache in memory and on the device, unsynced workouts, and the in-progress workout.
// The order is the contract — memory first, then the two fallible device calls, each reporting
// its own failure — so no single rejection can leave the previous account's data readable.
const clearUserSession = async () => {
  clearInMemoryUserData()

  await discardPersistedQueryCache()
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
      discardPersistedQueryCache()
      clearOfflineWorkoutFile()
    }

    set({
      userId: nextUserId,
      userEmail: user?.email ?? null,
      isAuthed: user !== null
    })
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
    await authService.logOutUser()
    await clearUserSession()

    set({
      userId: null,
      userEmail: null,
      isAuthed: false
    })
  },
  deleteUser: async () => {
    await authService.deleteCurrentUser()
    await clearUserSession()

    set({
      userId: null,
      userEmail: null,
      isAuthed: false
    })
  }
}))

export default useAuthStore
