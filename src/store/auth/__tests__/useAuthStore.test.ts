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
  PendingIntentErasure,
  prunePendingIntentsForUser
} from '@store/mealPlan/useMealPlanStore'
import useProgressStore from '@store/progress/useProgressStore'

import useAuthStore from '../useAuthStore'

// Every collaborator the session boundary touches records the order it was reached in, because the
// order is the contract this suite exists to pin: the in-memory clear has to happen before either
// device call, so that a rejection from the device can never leave the previous account readable.
const cleanupOrder: string[] = []

const record = (step: string) => async (): Promise<void> => {
  cleanupOrder.push(step)
}

// The partition's own semantics — which key a write lands under, what a read hands back once the
// account has changed — belong to queries/__tests__/queryClient.test.ts. What is mocked here is the
// boundary this store is responsible for calling, and the order it calls it in.
jest.mock('@queries/queryClient', () => ({
  queryClient: {
    clear: jest.fn(() => {
      cleanupOrder.push('queryCache')
    })
  },
  sealQueryCachePartition: jest.fn(() => {
    cleanupOrder.push('sealPartition')
  }),
  activateQueryCachePartition: jest.fn(),
  discardPersistedQueryCache: jest.fn(async () => undefined)
}))

jest.mock('@service/auth/AuthService', () => ({
  __esModule: true,
  default: {
    logOutUser: jest.fn(async () => undefined),
    deleteCurrentUser: jest.fn(async () => undefined),
    getCurrentUser: jest.fn(() => null),
    logInUser: jest.fn(async () => ({id: 'uid-aaaa', email: 'a@example.com'})),
    registerUser: jest.fn(async () => ({id: 'uid-aaaa', email: 'a@example.com'})),
    signInWithGoogle: jest.fn(async () => ({id: 'uid-aaaa', email: 'a@example.com'})),
    signInWithApple: jest.fn(async () => ({id: 'uid-aaaa', email: 'a@example.com'}))
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

// The meal-plan store contributes two halves of the boundary, and they are mocked separately because they
// answer different questions: the default export's `reset()` is the synchronous in-memory clear, while
// `clearPersistedPendingIntents` is the awaited device erasure that takes the outgoing account's idempotency
// keys off the disk — the step an ordinary persist write cannot perform after a failed read. The ownership
// sweep is mocked so the identity-resolution call sites can be asserted without driving the real store.
jest.mock('@store/mealPlan/useMealPlanStore', () => ({
  __esModule: true,
  default: {getState: jest.fn(() => ({reset: jest.fn()}))},
  clearPersistedPendingIntents: jest.fn(async () => {
    cleanupOrder.push('mealPlanIntents')

    return {kind: 'erased'}
  }),
  prunePendingIntentsForUser: jest.fn(),
  discardPendingIntentsForSignIn: jest.fn()
}))

const USER_A = {uid: 'uid-aaaa', email: 'a@example.com'} as FirebaseAuthTypes.User
const USER_B = {uid: 'uid-bbbb', email: 'b@example.com'} as FirebaseAuthTypes.User

const cacheClear = jest.mocked(queryClient.clear)
const sealPartition = jest.mocked(sealQueryCachePartition)
const activatePartition = jest.mocked(activateQueryCachePartition)
const discardPersistedCache = jest.mocked(discardPersistedQueryCache)
const offlineWorkoutClear = jest.mocked(offlineWorkoutStorageService.clear)
const workoutEntryState = jest.mocked(useDailyWorkoutEntryStore.getState)
const progressState = jest.mocked(useProgressStore.getState)
const mealPlanState = jest.mocked(useMealPlanStore.getState)
const clearPersistedIntents = jest.mocked(clearPersistedPendingIntents)
const pruneIntentsForUser = jest.mocked(prunePendingIntentsForUser)
const discardIntentsForSignIn = jest.mocked(discardPendingIntentsForSignIn)

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
let consoleError: jest.SpyInstance

afterEach(() => {
  consoleError.mockRestore()
})

// A signed-in session, published the way an explicit login publishes one. Publishing an identity is
// itself answered by the store's partition subscription, so the recorders are cleared afterwards:
// every assertion below is about the transition under test.
const signedInAs = (user: FirebaseAuthTypes.User) => {
  useAuthStore.setState({userId: user.uid, userEmail: user.email, isAuthed: true, isAttemptingAuth: false})
  jest.clearAllMocks()
  cleanupOrder.length = 0
}

beforeEach(() => {
  jest.clearAllMocks()
  cleanupOrder.length = 0
  stores = resetSpies()
  cacheClear.mockImplementation(() => {
    cleanupOrder.push('queryCache')
  })
  discardPersistedCache.mockImplementation(record('persistedCache'))
  offlineWorkoutClear.mockImplementation(record('offlineWorkouts'))
  clearPersistedIntents.mockImplementation(async () => {
    cleanupOrder.push('mealPlanIntents')

    return {kind: 'erased'}
  })
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  useAuthStore.setState({userId: null, userEmail: null, isAuthed: false, isAttemptingAuth: false})
})

const expectSessionCleared = (outgoing: FirebaseAuthTypes.User) => {
  expect(sealPartition).toHaveBeenCalledTimes(1)
  expect(cacheClear).toHaveBeenCalledTimes(1)
  expect(stores.workoutEntry).toHaveBeenCalledTimes(1)
  expect(stores.progress).toHaveBeenCalledTimes(1)
  expect(stores.mealPlan).toHaveBeenCalledTimes(1)
  expect(discardPersistedCache).toHaveBeenCalledTimes(1)
  expect(discardPersistedCache).toHaveBeenCalledWith(outgoing.uid)
  expect(offlineWorkoutClear).toHaveBeenCalledTimes(1)
  // The persisted meal-plan intents are the fourth thing the boundary owns: an unresolved idempotency key
  // stays replayable for seven days and is scoped to the account that minted it, so clearing it only in
  // memory would leave the outgoing account's request snapshot on the device (AAP 0.7.2).
  expect(clearPersistedIntents).toHaveBeenCalledTimes(1)
}

const expectNothingCleared = () => {
  expect(sealPartition).not.toHaveBeenCalled()
  expect(cacheClear).not.toHaveBeenCalled()
  expect(stores.workoutEntry).not.toHaveBeenCalled()
  expect(stores.progress).not.toHaveBeenCalled()
  expect(stores.mealPlan).not.toHaveBeenCalled()
  expect(discardPersistedCache).not.toHaveBeenCalled()
  expect(offlineWorkoutClear).not.toHaveBeenCalled()
  expect(clearPersistedIntents).not.toHaveBeenCalled()
}

// Firebase delivers remote sign-outs, revoked tokens and account changes through this action alone, and
// the cache and the user-scoped stores are singletons that survive the navigator swapping Home for Auth.
// Without the boundary here, the next account reads the previous one's diary, plan and avatar.
describe('syncAuthState — transitions away from a signed-in account', () => {
  it('clears the session when the account is signed out remotely', async () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(null)
    await Promise.resolve()

    expectSessionCleared(USER_A)
    expect(useAuthStore.getState()).toMatchObject({userId: null, userEmail: null, isAuthed: false})
  })

  it('clears the session when one account replaces another with no signed-out state in between', async () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()

    expectSessionCleared(USER_A)
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

    expect(cleanupOrder.indexOf('sealPartition')).toBe(0)
    expect(cleanupOrder).toEqual([
      'sealPartition',
      'queryCache',
      'persistedCache',
      'offlineWorkouts',
      'mealPlanIntents'
    ])
  })

  it('publishes the incoming account even when both device cleanups reject', async () => {
    signedInAs(USER_A)
    discardPersistedCache.mockRejectedValueOnce(new Error('storage unavailable'))
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
    expectSessionCleared(USER_A)
    expect(cleanupOrder).toEqual([
      'sealPartition',
      'queryCache',
      'persistedCache',
      'offlineWorkouts',
      'mealPlanIntents'
    ])
    expect(useAuthStore.getState()).toMatchObject({userId: null, userEmail: null, isAuthed: false})
  })

  it('still completes when the persisted cache cannot be removed from the device', async () => {
    signedInAs(USER_A)
    discardPersistedCache.mockRejectedValueOnce(new Error('storage unavailable'))

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
    expect(discardPersistedCache).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState()).toMatchObject({userId: null, isAuthed: false})
  })
})

describe('deleteUser', () => {
  it('clears the whole session in the same order', async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().deleteUser()

    expect(authService.deleteCurrentUser).toHaveBeenCalledTimes(1)
    expectSessionCleared(USER_A)
    expect(cleanupOrder).toEqual([
      'sealPartition',
      'queryCache',
      'persistedCache',
      'offlineWorkouts',
      'mealPlanIntents'
    ])
    expect(useAuthStore.getState()).toMatchObject({userId: null, isAuthed: false})
  })
})

// A cleanup failure is reported so it is not silent, and reported as a fixed code so the report
// itself discloses nothing: a native storage rejection carries file paths, module internals and the
// payload it choked on, and device and crash logs are read by more people than the account owner.
describe('what a failed cleanup is allowed to say', () => {
  const failureWith = async (error: unknown): Promise<unknown[]> => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    signedInAs(USER_A)
    discardPersistedCache.mockRejectedValueOnce(error)

    await useAuthStore.getState().logoutUser()

    const args = log.mock.calls.flat()

    log.mockRestore()

    return args
  }

  it('names the failure and nothing about the rejection that caused it', async () => {
    const args = await failureWith(
      new Error('ENOENT: /data/user/0/com.stateofhealth/databases/RKStorage — uid-aaaa payload 3.2 MB')
    )

    expect(args).toEqual(['persisted_query_cache_removal_failed'])
  })

  it('reports the same code whatever shape the rejection has', async () => {
    const args = await failureWith({nativeStackAndroid: [{file: '/data/user/0/app/RKStorage'}], uid: USER_A.uid})

    expect(args).toEqual(['persisted_query_cache_removal_failed'])
  })
})

// Which account's persisted cache may be written follows the identity this store has committed, and
// nothing else — not a render, which React is free to start and throw away. The store's own
// subscription is what carries that, so these cases drive the actions and read the partition calls.
describe('the writable cache partition', () => {
  it('is opened for the account Firebase restores on cold start', () => {
    useAuthStore.getState().syncAuthState(USER_A)

    expect(activatePartition).toHaveBeenCalledWith(USER_A.uid)
  })

  // The subscription rather than a call inside each action is what makes this true of every flow
  // that publishes an identity, including one added later; login is the representative case.
  it('is opened for the account an explicit login publishes', async () => {
    await useAuthStore.getState().loginUser(USER_A.email ?? '', 'correct-horse')

    expect(activatePartition).toHaveBeenCalledWith(USER_A.uid)
  })

  it('moves to the incoming account only after the outgoing session has been cleared', async () => {
    signedInAs(USER_A)
    const orderWhenActivated: string[] = []

    activatePartition.mockImplementation(() => {
      orderWhenActivated.push(...cleanupOrder)
    })

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()

    // The two device cleanups are started before the identity is published and are not awaited, so
    // they may already have been reached; what has to be true is that the in-memory boundary — seal
    // first, then the cache — ran before the incoming account's partition was opened for writing.
    expect(activatePartition).toHaveBeenCalledWith(USER_B.uid)
    expect(orderWhenActivated.slice(0, 2)).toEqual(['sealPartition', 'queryCache'])
  })

  it('is closed when the account signs out', async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().logoutUser()

    expect(activatePartition).toHaveBeenLastCalledWith(null)
  })

  it('is left where it is on a token or profile refresh of the same account', () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(USER_A)

    expect(activatePartition).not.toHaveBeenCalled()
  })
})

// A persisted meal-plan intent carries the account that minted it and stays replayable for seven days, so a
// record the outgoing session failed to erase is still on the device when its own account signs back in.
// Sweeping it needs an identity, which the auth layer is the only holder of — hence a call at every point one
// becomes known, rather than at the one the previous checkpoint happened to cover (AAP 0.7.2).
describe('the ownership sweep of persisted intents', () => {
  it('sweeps the restored account on a synchronous cold-start read', () => {
    jest.mocked(authService.getCurrentUser).mockReturnValueOnce({
      uid: USER_A.uid,
      email: USER_A.email
    } as FirebaseAuthTypes.User)

    expect(useAuthStore.getState().initAuth()).toBe(true)
    expect(pruneIntentsForUser).toHaveBeenCalledTimes(1)
    expect(pruneIntentsForUser.mock.calls[0][0]).toBe(USER_A.uid)
  })

  it('sweeps nothing when the cold-start read finds no session', () => {
    expect(useAuthStore.getState().initAuth()).toBe(false)
    expect(pruneIntentsForUser).not.toHaveBeenCalled()
  })

  it('sweeps the incoming account when one account replaces another', async () => {
    signedInAs(USER_A)

    useAuthStore.getState().syncAuthState(USER_B)
    await Promise.resolve()

    expect(pruneIntentsForUser).toHaveBeenCalledTimes(1)
    expect(pruneIntentsForUser.mock.calls[0][0]).toBe(USER_B.uid)
  })

  it('sweeps the restored account when Firebase answers on cold start', () => {
    useAuthStore.getState().syncAuthState(USER_A)

    expect(pruneIntentsForUser).toHaveBeenCalledTimes(1)
    expect(pruneIntentsForUser.mock.calls[0][0]).toBe(USER_A.uid)
  })

  it('sweeps nothing on a sign-out, where the erasure is what runs instead', async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().logoutUser()

    expect(pruneIntentsForUser).not.toHaveBeenCalled()
    expect(clearPersistedIntents).toHaveBeenCalledTimes(1)
  })
})

// The enforcement half of the account boundary. A credentialed sign-in cannot be the cold start an
// unresolved key exists for, so it keeps nothing: the record on disk belongs to a session that ended, and the
// sign-out that ended it may have failed to erase it (AAP 0.7.2). This suite pins which paths discard and
// which prune, because getting that backwards either replays a request the user abandoned or destroys the key
// that reconciles one they did not.
describe('the sign-in discard of persisted intents', () => {
  it.each([
    ['an email login', async () => useAuthStore.getState().loginUser('a@example.com', 'pw')],
    ['a registration', async () => useAuthStore.getState().registerUser('a@example.com', 'pw')],
    ['a Google sign-in', async () => useAuthStore.getState().signInWithGoogle()],
    ['an Apple sign-in', async () => useAuthStore.getState().signInWithApple()]
  ])('discards every persisted intent after %s, rather than pruning by owner', async (_label, signIn) => {
    await signIn()

    expect(discardIntentsForSignIn).toHaveBeenCalledTimes(1)
    expect(pruneIntentsForUser).not.toHaveBeenCalled()
  })

  it('discards nothing when a provider sign-in is cancelled', async () => {
    jest.mocked(authService.signInWithGoogle).mockResolvedValueOnce(null)

    await useAuthStore.getState().signInWithGoogle()

    expect(discardIntentsForSignIn).not.toHaveBeenCalled()
    expect(pruneIntentsForUser).not.toHaveBeenCalled()
  })

  it('discards nothing when the sign-in fails', async () => {
    jest.mocked(authService.logInUser).mockRejectedValueOnce(new Error('bad password'))

    await expect(useAuthStore.getState().loginUser('a@example.com', 'pw')).rejects.toThrow('bad password')

    expect(discardIntentsForSignIn).not.toHaveBeenCalled()
  })

  // The two restore paths are the case a replay exists for, so they keep the record and prune by owner and
  // age instead. Asserted here beside the discard so the split cannot be changed on one side only.
  it('prunes rather than discards when a cold start restores a session', () => {
    useAuthStore.getState().syncAuthState(USER_A)

    expect(pruneIntentsForUser).toHaveBeenCalledTimes(1)
    expect(discardIntentsForSignIn).not.toHaveBeenCalled()
  })
})

// An erasure the device refused is a record still at rest. Sign-out still completes — the file's convention
// is that a storage failure must not surface as a failed sign-out — but the boundary says so rather than
// reporting a clean teardown, and the sign-in discard above is what makes the surviving record unusable.
describe('an erasure the device would not complete', () => {
  it('completes the sign-out and reports the incomplete erasure as a fixed code', async () => {
    signedInAs(USER_A)
    clearPersistedIntents.mockImplementation(async (): Promise<PendingIntentErasure> => ({kind: 'failed'}))

    await useAuthStore.getState().logoutUser()

    expect(useAuthStore.getState().isAuthed).toBe(false)
    expect(consoleError).toHaveBeenCalledWith('meal_plan_intent_erasure_incomplete')
    expect(consoleError.mock.calls.flat()).not.toContain(USER_A.uid)
  })

  it('reports nothing when the erasure completed', async () => {
    signedInAs(USER_A)

    await useAuthStore.getState().logoutUser()

    expect(consoleError).not.toHaveBeenCalledWith('meal_plan_intent_erasure_incomplete')
  })
})
