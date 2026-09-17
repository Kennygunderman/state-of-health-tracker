import {asyncStoragePersister, queryClient} from '@queries/queryClient'
import {FirebaseAuthTypes} from '@react-native-firebase/auth'
import authService from '@service/auth/AuthService'
import offlineWorkoutStorageService from '@service/workouts/OfflineWorkoutStorageService'
import useDailyWorkoutEntryStore from '@store/dailyWorkoutEntry/useDailyWorkoutEntryStore'
import useMealPlanStore from '@store/mealPlan/useMealPlanStore'
import useProgressStore from '@store/progress/useProgressStore'

import useAuthStore from '../useAuthStore'

// Every collaborator the session boundary touches records the order it was reached in, because the
// order is the contract this suite exists to pin: the in-memory clear has to happen before either
// device call, so that a rejection from the device can never leave the previous account readable.
const cleanupOrder: string[] = []

const record = (step: string) => async (): Promise<void> => {
  cleanupOrder.push(step)
}

jest.mock('@queries/queryClient', () => ({
  queryClient: {
    clear: jest.fn(() => {
      cleanupOrder.push('queryCache')
    })
  },
  asyncStoragePersister: {removeClient: jest.fn(async () => undefined)}
}))

jest.mock('@service/auth/AuthService', () => ({
  __esModule: true,
  default: {
    logOutUser: jest.fn(async () => undefined),
    deleteCurrentUser: jest.fn(async () => undefined),
    getCurrentUser: jest.fn(() => null)
  }
}))

jest.mock('@service/workouts/OfflineWorkoutStorageService', () => ({
  __esModule: true,
  default: {clear: jest.fn(async () => undefined)}
}))

jest.mock('@store/dailyWorkoutEntry/useDailyWorkoutEntryStore', () => ({
  __esModule: true,
  default: {getState: jest.fn(() => ({reset: jest.fn()}))}
}))

jest.mock('@store/progress/useProgressStore', () => ({
  __esModule: true,
  default: {getState: jest.fn(() => ({reset: jest.fn()}))}
}))

jest.mock('@store/mealPlan/useMealPlanStore', () => ({
  __esModule: true,
  default: {getState: jest.fn(() => ({reset: jest.fn()}))}
}))

const USER_A = {uid: 'uid-aaaa', email: 'a@example.com'} as FirebaseAuthTypes.User
const USER_B = {uid: 'uid-bbbb', email: 'b@example.com'} as FirebaseAuthTypes.User

const cacheClear = jest.mocked(queryClient.clear)
const removePersistedCache = jest.mocked(asyncStoragePersister.removeClient)
const offlineWorkoutClear = jest.mocked(offlineWorkoutStorageService.clear)
const workoutEntryState = jest.mocked(useDailyWorkoutEntryStore.getState)
const progressState = jest.mocked(useProgressStore.getState)
const mealPlanState = jest.mocked(useMealPlanStore.getState)

const resetSpies = () => {
  const spies = {workoutEntry: jest.fn(), progress: jest.fn(), mealPlan: jest.fn()}

  workoutEntryState.mockReturnValue({reset: spies.workoutEntry} as unknown as ReturnType<
    typeof useDailyWorkoutEntryStore.getState
  >)
  progressState.mockReturnValue({reset: spies.progress} as unknown as ReturnType<typeof useProgressStore.getState>)
  mealPlanState.mockReturnValue({reset: spies.mealPlan} as unknown as ReturnType<typeof useMealPlanStore.getState>)

  return spies
}

let stores: ReturnType<typeof resetSpies>

// A signed-in session, published the way an explicit login publishes one.
const signedInAs = (user: FirebaseAuthTypes.User) => {
  useAuthStore.setState({userId: user.uid, userEmail: user.email, isAuthed: true, isAttemptingAuth: false})
}

beforeEach(() => {
  jest.clearAllMocks()
  cleanupOrder.length = 0
  stores = resetSpies()
  cacheClear.mockImplementation(() => {
    cleanupOrder.push('queryCache')
  })
  removePersistedCache.mockImplementation(record('persistedCache'))
  offlineWorkoutClear.mockImplementation(record('offlineWorkouts'))
  useAuthStore.setState({userId: null, userEmail: null, isAuthed: false, isAttemptingAuth: false})
})

const expectSessionCleared = () => {
  expect(cacheClear).toHaveBeenCalledTimes(1)
  expect(stores.workoutEntry).toHaveBeenCalledTimes(1)
  expect(stores.progress).toHaveBeenCalledTimes(1)
  expect(stores.mealPlan).toHaveBeenCalledTimes(1)
  expect(removePersistedCache).toHaveBeenCalledTimes(1)
  expect(offlineWorkoutClear).toHaveBeenCalledTimes(1)
}

const expectNothingCleared = () => {
  expect(cacheClear).not.toHaveBeenCalled()
  expect(stores.workoutEntry).not.toHaveBeenCalled()
  expect(stores.progress).not.toHaveBeenCalled()
  expect(stores.mealPlan).not.toHaveBeenCalled()
  expect(removePersistedCache).not.toHaveBeenCalled()
  expect(offlineWorkoutClear).not.toHaveBeenCalled()
}

// Firebase delivers remote sign-outs, revoked tokens and account changes through this action alone, and
// the cache and the user-scoped stores are singletons that survive the navigator swapping Home for Auth.
// Without the boundary here, the next account reads the previous one's diary, plan and avatar.
describe('syncAuthState — transitions away from a signed-in account', () => {
  it('clears the session when the account is signed out remotely', async () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(null)
    await Promise.resolve()

    expectSessionCleared()
    expect(useAuthStore.getState()).toMatchObject({userId: null, userEmail: null, isAuthed: false})
  })

  it('clears the session when one account replaces another with no signed-out state in between', async () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()

    expectSessionCleared()
    expect(useAuthStore.getState()).toMatchObject({userId: USER_B.uid, userEmail: USER_B.email, isAuthed: true})
  })

  it('clears the previous account before publishing the incoming one', async () => {
    signedInAs(USER_A)
    let userIdWhenCacheCleared: string | null = 'unset'

    cacheClear.mockImplementation(() => {
      cleanupOrder.push('queryCache')
      userIdWhenCacheCleared = useAuthStore.getState().userId
    })

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()

    expect(userIdWhenCacheCleared).toBe(USER_A.uid)
  })

  it('clears memory before it touches the device, so a storage failure cannot reopen the boundary', async () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()

    expect(cleanupOrder.indexOf('queryCache')).toBe(0)
    expect(cleanupOrder).toEqual(['queryCache', 'persistedCache', 'offlineWorkouts'])
  })

  it('publishes the incoming account even when both device cleanups reject', async () => {
    signedInAs(USER_A)
    removePersistedCache.mockRejectedValueOnce(new Error('storage unavailable'))
    offlineWorkoutClear.mockRejectedValueOnce(new Error('filesystem unavailable'))

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()
    await Promise.resolve()

    expect(cacheClear).toHaveBeenCalledTimes(1)
    expect(stores.mealPlan).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({userId: USER_B.uid, isAuthed: true})
  })
})

describe('syncAuthState — the cases that must not clear anything', () => {
  it('leaves the session alone on a token or profile refresh of the same account', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(USER_A)

    expectNothingCleared()
    expect(useAuthStore.getState()).toMatchObject({userId: USER_A.uid, isAuthed: true})
  })

  it('leaves the session alone when Firebase restores a session on cold start', () => {
    useAuthStore.getState().syncAuthState(USER_A)

    expectNothingCleared()
    expect(useAuthStore.getState()).toMatchObject({userId: USER_A.uid, isAuthed: true})
  })

  it('defers to an explicit login or registration flow that owns its own transition', () => {
    signedInAs(USER_A)
    useAuthStore.setState({isAttemptingAuth: true})

    useAuthStore.getState().syncAuthState(null)

    expectNothingCleared()
    expect(useAuthStore.getState()).toMatchObject({userId: USER_A.uid, isAuthed: true})
  })
})

describe('logoutUser', () => {
  it('clears the whole session and signs out', async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().logoutUser()

    expect(authService.logOutUser).toHaveBeenCalledTimes(1)
    expectSessionCleared()
    expect(cleanupOrder).toEqual(['queryCache', 'persistedCache', 'offlineWorkouts'])
    expect(useAuthStore.getState()).toMatchObject({userId: null, userEmail: null, isAuthed: false})
  })

  it('still completes when the persisted cache cannot be removed from the device', async () => {
    signedInAs(USER_A)
    removePersistedCache.mockRejectedValueOnce(new Error('storage unavailable'))

    await expect(useAuthStore.getState().logoutUser()).resolves.toBeUndefined()

    expect(cacheClear).toHaveBeenCalledTimes(1)
    expect(offlineWorkoutClear).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({userId: null, isAuthed: false})
  })

  // The fail-open shape this replaced awaited the workout file first, so a rejection there skipped every
  // reset that followed and left the previous account's cache and stores in place.
  it('has already cleared memory and the device cache when the workout file cannot be cleared', async () => {
    signedInAs(USER_A)
    offlineWorkoutClear.mockRejectedValueOnce(new Error('filesystem unavailable'))

    await expect(useAuthStore.getState().logoutUser()).resolves.toBeUndefined()

    expect(cacheClear).toHaveBeenCalledTimes(1)
    expect(stores.mealPlan).toHaveBeenCalledTimes(1)
    expect(removePersistedCache).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({userId: null, isAuthed: false})
  })
})

describe('deleteUser', () => {
  it('clears the whole session in the same order', async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().deleteUser()

    expect(authService.deleteCurrentUser).toHaveBeenCalledTimes(1)
    expectSessionCleared()
    expect(cleanupOrder).toEqual(['queryCache', 'persistedCache', 'offlineWorkouts'])
    expect(useAuthStore.getState()).toMatchObject({userId: null, isAuthed: false})
  })
})
