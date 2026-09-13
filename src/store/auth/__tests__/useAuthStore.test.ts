import {
  activateQueryCachePartition,
  discardPersistedQueryCache,
  queryClient,
  sealQueryCachePartition
} from '@queries/queryClient'
import {FirebaseAuthTypes} from '@react-native-firebase/auth'
import authService from '@service/auth/AuthService'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'

import useAuthStore from '../useAuthStore'

// What these tests are about is the session boundary, so the collaborators are mocked down to the
// calls that enforce it and the order they run in. The partition's own semantics — which key a write
// lands under, what a read hands back after the account has changed — belong to
// queries/__tests__/queryClient.test.ts.
const mockSessionCleanupOrder: string[] = []
const mockResetDailyWorkoutEntry = jest.fn()
const mockResetProgress = jest.fn()
const mockResetMealPlanState = jest.fn()

jest.mock('@queries/queryClient', () => ({
  queryClient: {
    clear: jest.fn(() => {
      mockSessionCleanupOrder.push('clear-in-memory-cache')
    })
  },
  sealQueryCachePartition: jest.fn(() => {
    mockSessionCleanupOrder.push('seal-partition')
  }),
  activateQueryCachePartition: jest.fn((userId: string | null) => {
    mockSessionCleanupOrder.push(`activate-partition:${userId ?? 'nobody'}`)
  }),
  discardPersistedQueryCache: jest.fn(async () => {
    mockSessionCleanupOrder.push('discard-persisted-cache')
  })
}))

jest.mock('@service/auth/AuthService', () => ({
  __esModule: true,
  default: {
    getCurrentUser: jest.fn(() => null),
    logOutUser: jest.fn(async () => undefined),
    deleteCurrentUser: jest.fn(async () => undefined)
  }
}))

jest.mock('@service/workouts/OfflineWorkoutStorageService', () => ({
  __esModule: true,
  default: {clear: jest.fn(async () => undefined)}
}))

jest.mock('@store/dailyWorkoutEntry/useDailyWorkoutEntryStore', () => ({
  __esModule: true,
  default: {getState: () => ({reset: mockResetDailyWorkoutEntry})}
}))

jest.mock('@store/progress/useProgressStore', () => ({
  __esModule: true,
  default: {getState: () => ({reset: mockResetProgress})}
}))

jest.mock('@store/mealPlan/useMealPlanStore', () => ({
  __esModule: true,
  default: {getState: () => ({reset: mockResetMealPlanState})},
  prunePendingIntentsForUser: jest.fn()
}))

const USER_A = 'uid-aaaa'
const USER_B = 'uid-bbbb'

const sealPartition = jest.mocked(sealQueryCachePartition)
const activatePartition = jest.mocked(activateQueryCachePartition)
const discardPersistedCache = jest.mocked(discardPersistedQueryCache)
const clearInMemoryCache = jest.mocked(queryClient.clear)
const logOutUser = jest.mocked(authService.logOutUser)
const deleteCurrentUser = jest.mocked(authService.deleteCurrentUser)
const clearOfflineWorkouts = jest.mocked(offlineWorkoutStorageService.clear)

const makeUser = (uid: string): FirebaseAuthTypes.User =>
  ({uid, email: `${uid}@example.com`}) as unknown as FirebaseAuthTypes.User

// Seeding a signed-in account publishes an identity, which the store's own subscription answers, so
// the recorders are reset afterwards: every assertion below is about the transition under test.
const signedInAs = (uid: string) => {
  useAuthStore.setState({userId: uid, userEmail: `${uid}@example.com`, isAuthed: true, isAttemptingAuth: false})
  jest.clearAllMocks()
  mockSessionCleanupOrder.length = 0
}

beforeEach(() => {
  useAuthStore.setState({userId: null, userEmail: null, isAuthed: false, isAttemptingAuth: false})
  jest.clearAllMocks()
  mockSessionCleanupOrder.length = 0
  logOutUser.mockImplementation(async () => undefined)
  deleteCurrentUser.mockImplementation(async () => undefined)
})

describe('syncAuthState — a different account signs in with no signed-out render in between', () => {
  it('enforces the whole boundary before the incoming account is published', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(makeUser(USER_B))

    expect(sealPartition).toHaveBeenCalledTimes(1)
    expect(clearInMemoryCache).toHaveBeenCalledTimes(1)
    expect(discardPersistedCache).toHaveBeenCalledWith(USER_A)
    expect(clearOfflineWorkouts).toHaveBeenCalledTimes(1)
    expect(mockResetDailyWorkoutEntry).toHaveBeenCalledTimes(1)
    expect(mockResetProgress).toHaveBeenCalledTimes(1)
    expect(mockResetMealPlanState).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().userId).toBe(USER_B)
    expect(useAuthStore.getState().isAuthed).toBe(true)
  })

  it('seals the outgoing partition before clearing the cache, because clearing makes every query refetch', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(makeUser(USER_B))

    expect(mockSessionCleanupOrder.indexOf('seal-partition')).toBeLessThan(
      mockSessionCleanupOrder.indexOf('clear-in-memory-cache')
    )
  })

  it("opens the incoming account's partition only once that account has been published", () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(makeUser(USER_B))

    expect(activatePartition).toHaveBeenCalledTimes(1)
    expect(activatePartition).toHaveBeenCalledWith(USER_B)
    expect(mockSessionCleanupOrder).toEqual([
      'seal-partition',
      'clear-in-memory-cache',
      'discard-persisted-cache',
      `activate-partition:${USER_B}`
    ])
  })

  it('removes the cache of the account being replaced, never the incoming one', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(makeUser(USER_B))

    expect(discardPersistedCache).toHaveBeenCalledTimes(1)
    expect(discardPersistedCache).not.toHaveBeenCalledWith(USER_B)
  })

  it('enforces the boundary again when the account changes a second time', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(makeUser(USER_B))
    useAuthStore.getState().syncAuthState(makeUser(USER_A))

    expect(discardPersistedCache).toHaveBeenNthCalledWith(1, USER_A)
    expect(discardPersistedCache).toHaveBeenNthCalledWith(2, USER_B)
    expect(sealPartition).toHaveBeenCalledTimes(2)
    expect(activatePartition).toHaveBeenNthCalledWith(1, USER_B)
    expect(activatePartition).toHaveBeenNthCalledWith(2, USER_A)
  })
})

describe('syncAuthState — the cases that must not clear anything', () => {
  it('leaves the session alone on a token or profile refresh of the same account', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(makeUser(USER_A))

    expect(sealPartition).not.toHaveBeenCalled()
    expect(clearInMemoryCache).not.toHaveBeenCalled()
    expect(discardPersistedCache).not.toHaveBeenCalled()
    expect(mockResetMealPlanState).not.toHaveBeenCalled()
    expect(activatePartition).not.toHaveBeenCalled()
  })

  it("opens the restored account's partition on cold start without clearing anything", () => {
    useAuthStore.getState().syncAuthState(makeUser(USER_A))

    expect(sealPartition).not.toHaveBeenCalled()
    expect(discardPersistedCache).not.toHaveBeenCalled()
    expect(activatePartition).toHaveBeenCalledWith(USER_A)
    expect(useAuthStore.getState().userId).toBe(USER_A)
  })

  it('defers to an explicit login or registration flow that owns its own transition', () => {
    signedInAs(USER_A)
    useAuthStore.setState({isAttemptingAuth: true})

    useAuthStore.getState().syncAuthState(makeUser(USER_B))

    expect(sealPartition).not.toHaveBeenCalled()
    expect(discardPersistedCache).not.toHaveBeenCalled()
    expect(activatePartition).not.toHaveBeenCalled()
    expect(useAuthStore.getState().userId).toBe(USER_A)
  })
})

describe('syncAuthState — a remote sign-out', () => {
  it('clears the session, takes the signed-out account off the device and leaves no partition open', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(null)

    expect(sealPartition).toHaveBeenCalledTimes(1)
    expect(discardPersistedCache).toHaveBeenCalledWith(USER_A)
    expect(activatePartition).toHaveBeenCalledWith(null)
    expect(useAuthStore.getState().isAuthed).toBe(false)
  })
})

describe('logoutUser', () => {
  it("removes the signed-out account's persisted cache", async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().logoutUser()

    expect(sealPartition).toHaveBeenCalled()
    expect(clearInMemoryCache).toHaveBeenCalled()
    expect(discardPersistedCache).toHaveBeenCalledWith(USER_A)
    expect(activatePartition).toHaveBeenCalledWith(null)
    expect(useAuthStore.getState().userId).toBeNull()
  })

  it("still knows whose cache to remove when the auth provider's listener has already nulled the id", async () => {
    signedInAs(USER_A)

    // Firebase delivers the sign-out to subscribeToAuthChanges, which reaches syncAuthState before
    // logoutUser resumes — so the id has to have been read before the provider was called.
    logOutUser.mockImplementation(async () => {
      useAuthStore.getState().syncAuthState(null)
    })

    await useAuthStore.getState().logoutUser()

    expect(discardPersistedCache).toHaveBeenCalledWith(USER_A)
    expect(discardPersistedCache).not.toHaveBeenCalledWith(null)
  })

  it('reports rather than throws when the cache cannot be removed from the device', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    signedInAs(USER_A)
    discardPersistedCache.mockRejectedValueOnce(new Error('storage unavailable'))

    await expect(useAuthStore.getState().logoutUser()).resolves.toBeUndefined()

    expect(clearInMemoryCache).toHaveBeenCalled()
    expect(useAuthStore.getState().isAuthed).toBe(false)
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })
})

describe('deleteUser', () => {
  it("removes the deleted account's persisted cache", async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().deleteUser()

    expect(deleteCurrentUser).toHaveBeenCalledTimes(1)
    expect(sealPartition).toHaveBeenCalled()
    expect(discardPersistedCache).toHaveBeenCalledWith(USER_A)
    expect(activatePartition).toHaveBeenCalledWith(null)
    expect(useAuthStore.getState().userId).toBeNull()
  })
})
