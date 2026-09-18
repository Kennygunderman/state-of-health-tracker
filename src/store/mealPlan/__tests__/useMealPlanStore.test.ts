import authService from '@service/auth/AuthService'
import useAuthStore from '@store/auth/useAuthStore'
import {zustandAsyncStorage} from '@store/zustandAsyncStorage'
import {
  fingerprintSnapshot,
  GenerateRequestSnapshot,
  LogRequestSnapshot,
  MealPlanRequestSnapshot,
  RegenerateRequestSnapshot,
  requestBody,
  requestIds,
  SwapRequestSnapshot
} from '@utility/IdempotencyUtility'
import {StorageValue} from 'zustand/middleware'

import useMealPlanStore, {
  buildPendingIntent,
  clearPersistedPendingIntents,
  discardPendingIntentsForSignIn,
  isPendingIntentExpired,
  MealPlanPersistedState,
  parsePendingIntent,
  PENDING_INTENT_TTL_MS,
  PendingIntent,
  PendingIntentAction,
  PendingIntentReservation,
  PostLogResult,
  prunePendingIntentsForUser,
  resolveKeyedRequest,
  resolvePendingIntent,
  resolveReplayableIntent,
  resolveSlotOwnership,
  selectPersistedState,
  selectPrunedPendingIntents
} from '../useMealPlanStore'

// Mocking the persist adapter instead of AsyncStorage keeps the suite free of native modules; the
// default getItem resolves null so hydration restores nothing and cannot overwrite a seeded state,
// and the rehydration cases below queue their own stored payload for the read they drive.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

// The sign-out case below drives the real auth store so that reset() is reached the way the app reaches
// it. Everything else the session boundary touches is stubbed down to a resolved call: this store is the
// subject, and the cache, the workout file and the other user-scoped stores have their own suites. The
// meal-plan store itself is deliberately left unmocked — it is what the assertion reads back.
jest.mock('@queries/queryClient', () => ({
  queryClient: {clear: jest.fn()},
  sealQueryCachePartition: jest.fn(),
  activateQueryCachePartition: jest.fn(),
  discardPersistedQueryCache: jest.fn(async () => undefined)
}))

// The identity-resolution paths below are driven through the real auth store, so the Firebase wrapper is
// stubbed down to the four calls those paths make: the cold-start read, one sign-in and the sign-out.
jest.mock('@service/auth/AuthService', () => ({
  __esModule: true,
  default: {
    logOutUser: jest.fn(async () => undefined),
    getCurrentUser: jest.fn(() => null),
    logInUser: jest.fn(async () => ({id: 'user-a', email: 'user-a@example.com'}))
  }
}))

jest.mock('@service/workouts/OfflineWorkoutStorageService', () => ({
  __esModule: true,
  default: {clear: jest.fn(async () => undefined)}
}))

jest.mock('@store/dailyWorkoutEntry/useDailyWorkoutEntryStore', () => ({
  __esModule: true,
  default: {getState: () => ({reset: jest.fn()})}
}))

jest.mock('@store/progress/useProgressStore', () => ({
  __esModule: true,
  default: {getState: () => ({reset: jest.fn()})}
}))

const persistedReads = zustandAsyncStorage.getItem as jest.Mock
const persistedWrites = zustandAsyncStorage.setItem as jest.Mock
const persistedRemovals = zustandAsyncStorage.removeItem as jest.Mock

/**
 * Lets the adapter's awaited writes settle. The persist middleware writes after `set` without awaiting, so
 * the memo that decides whether the NEXT write is a duplicate is only correct once those promises have run.
 */
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

/**
 * Drives one successful read, which is what clears the adapter's failed-read latch and re-seeds its write
 * memo. The latch is module state by design — a refused read must block every write path, not just the one
 * that noticed — so a case that rejected a read leaves it set for the cases that follow.
 */
const flushPersistedRead = async (): Promise<void> => {
  persistedReads.mockResolvedValueOnce(null)

  await useMealPlanStore.persist.rehydrate()
  await flushMicrotasks()
}

const NOW = 1_760_000_000_000

// One valid request per action, so a record is always one this release can replay. A record is only valid in
// the slot its own action names, which is why every intent here is built for the slot it is filed under.
interface ActionRequests {
  generate: GenerateRequestSnapshot
  regenerate: RegenerateRequestSnapshot
  swap: SwapRequestSnapshot
  log: LogRequestSnapshot
}

const REQUESTS: ActionRequests = {
  generate: {
    action: 'generate',
    startDate: '2026-07-05',
    expectedPreferencesRevision: 4,
    expectedTargetsRevision: 2
  },
  regenerate: {
    action: 'regenerate',
    planId: 'plan-1',
    expectedPlanRevision: 3,
    expectedPreferencesRevision: 4,
    expectedTargetsRevision: 2
  },
  swap: {
    action: 'swap',
    planId: 'plan-1',
    mealId: 'meal-1',
    recipeVersionId: 'rv-1',
    portionMultiplier: 1.25,
    expectedPlanRevision: 3
  },
  log: {
    action: 'log',
    planId: 'plan-1',
    mealId: 'meal-1',
    servings: 0.66,
    date: '2026-07-05',
    diaryMealId: 'dm-1',
    expectedPlanRevision: 3
  }
}

interface PendingIntentOverrides {
  action?: PendingIntentAction
  userId?: string
  key?: string
  createdAt?: number
  request?: MealPlanRequestSnapshot
}

// Always through buildPendingIntent, which is the only producer of the shape: a hand-written literal could
// carry a fingerprint that does not describe its own request, which is exactly what the store now refuses.
const makePendingIntent = (overrides: PendingIntentOverrides = {}): PendingIntent =>
  buildPendingIntent(
    overrides.request ?? REQUESTS[overrides.action ?? 'log'],
    overrides.key ?? 'key-1',
    overrides.userId ?? 'user-a',
    overrides.createdAt ?? NOW
  )

// What AsyncStorage returns: the record as JSON, not the object that was written.
const throughStorage = (value: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(value))

const makePostLogResult = (overrides: Partial<PostLogResult> = {}): PostLogResult => ({
  entryId: 'entry-1',
  dateIso: '2026-07-05',
  slotLabel: 'Breakfast',
  recipeName: 'Greek yogurt bowl',
  viewTarget: 'diary',
  ...overrides
})

// Every TTL and ownership decision in this suite is made against an explicit timestamp except one: the
// store's rehydration prune, which has no caller to inject a clock and therefore reads `Date.now()` itself
// (useMealPlanStore.ts, `onRehydrateStorage`). Pinning that single read to the same fixture the intents are
// minted from is what keeps a boundary case from depending on when the suite happens to run. Installed once:
// the `jest.clearAllMocks()` below clears recorded calls, not implementations.
beforeAll(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW)
})

// Draining hydration before each case keeps the rehydration prune — the store's only wall-clock
// read — from firing mid-test against an intent seeded at a fixed past timestamp.
beforeEach(async () => {
  await useMealPlanStore.persist.rehydrate()
  useMealPlanStore.getState().reset()
  jest.clearAllMocks()
})

describe('selectPersistedState', () => {
  it('exposes pendingIntents as the only persisted field', () => {
    useMealPlanStore.setState({
      macrosSegment: 'mealPlan',
      selectedPlanDate: '2026-07-05',
      selectedPlanId: 'plan-1',
      dismissedSuccessBannerFor: 'entry-1',
      postLogResult: makePostLogResult(),
      pendingIntents: {generate: makePendingIntent({action: 'generate'})}
    })

    expect(Object.keys(selectPersistedState(useMealPlanStore.getState()))).toEqual(['pendingIntents'])
  })

  it('passes the recorded intents through unchanged', () => {
    const intent = makePendingIntent({action: 'swap', key: 'key-9'})

    useMealPlanStore.setState({pendingIntents: {swap: intent}})

    expect(selectPersistedState(useMealPlanStore.getState()).pendingIntents).toEqual({swap: intent})
  })
})

describe('PENDING_INTENT_TTL_MS', () => {
  it('equals seven days in milliseconds', () => {
    expect(PENDING_INTENT_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })
})

describe('isPendingIntentExpired', () => {
  it('treats a freshly minted intent as live', () => {
    const intent = makePendingIntent({createdAt: NOW})

    expect(isPendingIntentExpired(intent, NOW)).toBe(false)
  })

  it('treats an intent one millisecond inside the window as live', () => {
    const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS + 1})

    expect(isPendingIntentExpired(intent, NOW)).toBe(false)
  })

  it('treats an intent exactly one window old as expired', () => {
    const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS})

    expect(isPendingIntentExpired(intent, NOW)).toBe(true)
  })

  it('treats an intent older than the window as expired', () => {
    const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS - 1})

    expect(isPendingIntentExpired(intent, NOW)).toBe(true)
  })
})

describe('selectPrunedPendingIntents', () => {
  describe('age', () => {
    it('keeps an intent one millisecond inside the window', () => {
      const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS + 1})

      expect(selectPrunedPendingIntents({log: intent}, NOW, 'user-a')).toEqual({log: intent})
    })

    it('removes an intent exactly one window old', () => {
      const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS})

      expect(selectPrunedPendingIntents({log: intent}, NOW, 'user-a')).toEqual({})
    })

    it('removes an intent older than the window', () => {
      const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS - 1})

      expect(selectPrunedPendingIntents({log: intent}, NOW, 'user-a')).toEqual({})
    })
  })

  describe('ownership', () => {
    it('removes an intent minted by another account when the resolving user is known', () => {
      const foreign = makePendingIntent({action: 'generate', userId: 'user-b'})

      expect(selectPrunedPendingIntents({generate: foreign}, NOW, 'user-a')).toEqual({})
    })

    it('keeps an intent for any account when ownership is unknown at the call site', () => {
      const foreign = makePendingIntent({action: 'generate', userId: 'user-b'})

      expect(selectPrunedPendingIntents({generate: foreign}, NOW, null)).toEqual({generate: foreign})
    })

    it('removes an expired intent even when ownership is unknown', () => {
      const expired = makePendingIntent({
        action: 'generate',
        userId: 'user-b',
        createdAt: NOW - PENDING_INTENT_TTL_MS
      })

      expect(selectPrunedPendingIntents({generate: expired}, NOW, null)).toEqual({})
    })
  })

  it('returns the very same object when every intent is live and owned', () => {
    const pendingIntents = {
      generate: makePendingIntent({action: 'generate', key: 'key-1'}),
      log: makePendingIntent({key: 'key-2'})
    }

    expect(selectPrunedPendingIntents(pendingIntents, NOW, 'user-a')).toBe(pendingIntents)
  })

  it('keeps only the live owned entries and leaves the input untouched', () => {
    const expired = makePendingIntent({action: 'generate', key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({action: 'swap', key: 'foreign', userId: 'user-b'})
    const live = makePendingIntent({key: 'live'})
    const pendingIntents = {generate: expired, swap: foreign, log: live}

    expect(selectPrunedPendingIntents(pendingIntents, NOW, 'user-a')).toEqual({log: live})
    expect(pendingIntents).toEqual({generate: expired, swap: foreign, log: live})
  })
})

describe('resolvePendingIntent', () => {
  describe('user scoping', () => {
    it('returns the intent recorded for the resolving user', () => {
      const intent = makePendingIntent({action: 'generate', userId: 'user-a'})

      expect(resolvePendingIntent({pendingIntents: {generate: intent}}, 'generate', 'user-a', NOW)).toEqual(intent)
    })

    it('returns null for a different user', () => {
      const intent = makePendingIntent({action: 'generate', userId: 'user-a'})

      expect(resolvePendingIntent({pendingIntents: {generate: intent}}, 'generate', 'user-b', NOW)).toBeNull()
    })
  })

  describe('missing intents', () => {
    it('returns null when another action holds the only intent', () => {
      const intent = makePendingIntent({action: 'generate'})

      expect(resolvePendingIntent({pendingIntents: {generate: intent}}, 'swap', 'user-a', NOW)).toBeNull()
    })

    it('returns null when nothing is recorded at all', () => {
      expect(resolvePendingIntent({pendingIntents: {}}, 'regenerate', 'user-a', NOW)).toBeNull()
    })
  })

  describe('expiry', () => {
    it('returns an intent one millisecond inside the window', () => {
      const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS + 1})

      expect(resolvePendingIntent({pendingIntents: {log: intent}}, 'log', 'user-a', NOW)).toEqual(intent)
    })

    it('returns null for an intent exactly one window old', () => {
      const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS})

      expect(resolvePendingIntent({pendingIntents: {log: intent}}, 'log', 'user-a', NOW)).toBeNull()
    })

    it('returns null for an intent older than the window', () => {
      const intent = makePendingIntent({createdAt: NOW - PENDING_INTENT_TTL_MS - 1})

      expect(resolvePendingIntent({pendingIntents: {log: intent}}, 'log', 'user-a', NOW)).toBeNull()
    })
  })
})

describe('recordPendingIntent', () => {
  it('writes the intent under the action of its own request', () => {
    const intent = makePendingIntent()

    useMealPlanStore.getState().recordPendingIntent(intent)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: intent})
  })

  it('files every action in its own slot, so no record can describe a request it is not filed under', () => {
    const actions: readonly PendingIntentAction[] = ['generate', 'regenerate', 'swap', 'log']

    actions.forEach(action => useMealPlanStore.getState().recordPendingIntent(makePendingIntent({action})))

    const recorded = useMealPlanStore.getState().pendingIntents

    actions.forEach(action => expect(recorded[action]?.request.action).toBe(action))
  })

  it('keeps intents recorded for other actions', () => {
    const generate = makePendingIntent({action: 'generate', key: 'key-1'})
    const swap = makePendingIntent({action: 'swap', key: 'key-2'})

    useMealPlanStore.getState().recordPendingIntent(generate)
    useMealPlanStore.getState().recordPendingIntent(swap)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate, swap})
  })

  it('sweeps an expired and a foreign sibling while keeping the live one for the same account', () => {
    const expired = makePendingIntent({action: 'generate', key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({action: 'swap', key: 'foreign', userId: 'user-b'})
    const live = makePendingIntent({action: 'regenerate', key: 'live', createdAt: NOW - 1})
    const incoming = makePendingIntent({key: 'incoming', createdAt: NOW})

    useMealPlanStore.setState({pendingIntents: {generate: expired, swap: foreign, regenerate: live}})
    useMealPlanStore.getState().recordPendingIntent(incoming)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({regenerate: live, log: incoming})
  })

  it('keeps the incoming intent even when it replaces a foreign entry under the same action', () => {
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b'})
    const incoming = makePendingIntent({key: 'incoming'})

    useMealPlanStore.setState({pendingIntents: {log: foreign}})
    useMealPlanStore.getState().recordPendingIntent(incoming)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: incoming})
  })
})

describe('prunePendingIntents', () => {
  it('removes the stale entries and persists the pruned slice', () => {
    const expired = makePendingIntent({action: 'generate', key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({action: 'swap', key: 'foreign', userId: 'user-b'})
    const live = makePendingIntent({key: 'live'})

    useMealPlanStore.setState({pendingIntents: {generate: expired, swap: foreign, log: live}})
    persistedWrites.mockClear()
    useMealPlanStore.getState().prunePendingIntents(NOW, 'user-a')

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
    expect(persistedWrites.mock.calls[0][0]).toBe('meal-plan-store')
  })

  it('prunes by age alone when the signed-in account is unknown', () => {
    const expired = makePendingIntent({action: 'generate', key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({action: 'swap', key: 'foreign', userId: 'user-b'})

    useMealPlanStore.setState({pendingIntents: {generate: expired, swap: foreign}})
    useMealPlanStore.getState().prunePendingIntents(NOW, null)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({swap: foreign})
  })

  it('leaves the slice and the storage adapter untouched when nothing is stale', () => {
    const live = makePendingIntent()

    useMealPlanStore.setState({pendingIntents: {log: live}})

    const before = useMealPlanStore.getState().pendingIntents

    persistedWrites.mockClear()
    useMealPlanStore.getState().prunePendingIntents(NOW, 'user-a')

    expect(useMealPlanStore.getState().pendingIntents).toBe(before)
    expect(persistedWrites).not.toHaveBeenCalled()
  })
})

describe('rehydration', () => {
  it('removes an intent that aged out while the app was closed and rewrites storage', async () => {
    const live = makePendingIntent({key: 'live', createdAt: NOW})
    const expired = makePendingIntent({
      action: 'generate',
      key: 'expired',
      createdAt: NOW - PENDING_INTENT_TTL_MS
    })

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {log: live, generate: expired}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
  })

  it('restores a live intent without writing storage back', async () => {
    const live = makePendingIntent({key: 'live', createdAt: NOW})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {log: live}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).not.toHaveBeenCalled()
  })

  it('keeps a foreign intent for the signing-in account to sweep, since ownership is unknown here', async () => {
    const foreign = makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: NOW})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {generate: foreign}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate: foreign})
  })

  // Storage can hold a slot this release has no snapshot contract for: a newer build that added a keyed
  // write, or a hand-edited file. Reading its members by name has to fail closed, because an exception here
  // escapes the rehydration listener — hydration never finishes, the deferred ownership sweep waits on it
  // forever, and every keyed action stays unusable until the user clears app storage.
  describe('a slot this release cannot read', () => {
    // Well formed in every member parsePendingIntent checks before the snapshot, and filed under the slot its
    // own discriminant names, so it reaches the member lookup exactly as a newer release's record would. The
    // request carries the discriminant alone because a prototype name resolves to a function whose `length`
    // is its arity: a one-member request is what makes the member count agree and the lookup's result be
    // used, which is the shape a name-keyed table has to survive.
    const forwardVersionRecord = (action: string): Record<string, unknown> => ({
      userId: 'user-a',
      key: 'forward-key',
      fingerprint: 'forward-fingerprint',
      planId: null,
      planRevision: null,
      createdAt: NOW,
      request: {action}
    })

    it.each([
      ['an action added by a newer release', 'reorder'],
      ['a name resolving to a one-argument function on Object.prototype', 'hasOwnProperty'],
      ['a name resolving to the Object constructor', 'constructor'],
      ['a name resolving to a zero-argument function on Object.prototype', 'toString']
    ])('completes hydration and drops %s', async (_label, slot) => {
      const live = makePendingIntent({key: 'live', createdAt: NOW})

      persistedReads.mockResolvedValueOnce({
        state: {pendingIntents: {log: live, [slot]: forwardVersionRecord(slot)}},
        version: 0
      })

      await expect(useMealPlanStore.persist.rehydrate()).resolves.toBeUndefined()

      expect(useMealPlanStore.persist.hasHydrated()).toBe(true)
      expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
      expect(persistedWrites).toHaveBeenCalledTimes(1)
      expect(persistedWrites.mock.calls[0][1]).toEqual({state: {pendingIntents: {log: live}}, version: 0})
    })

    it('still runs the ownership sweep that was deferred until hydration finished', async () => {
      const clock = NOW
      const foreign = makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: clock})
      const live = makePendingIntent({key: 'live', userId: 'user-a', createdAt: clock})

      persistedReads.mockResolvedValueOnce({
        state: {pendingIntents: {generate: foreign, log: live, reorder: forwardVersionRecord('reorder')}},
        version: 0
      })

      const hydration = useMealPlanStore.persist.rehydrate()

      prunePendingIntentsForUser('user-a', () => clock)

      await hydration

      expect(useMealPlanStore.persist.hasHydrated()).toBe(true)
      expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    })
  })

  // `Object.entries` throws on null and enumerates the characters of a string, so the container itself is a
  // boundary value and not merely its members. Anything that is not a plain object holds nothing replayable,
  // so hydration replaces it and the write repairs storage.
  describe('a persisted slice that is not an object', () => {
    it.each([
      ['null', null],
      ['an array', []],
      ['a string', 'pendingIntents'],
      ['a number', 7]
    ])('completes hydration and replaces %s with an empty slice', async (_label, slice) => {
      persistedReads.mockResolvedValueOnce({state: {pendingIntents: slice}, version: 0})

      await expect(useMealPlanStore.persist.rehydrate()).resolves.toBeUndefined()

      expect(useMealPlanStore.persist.hasHydrated()).toBe(true)
      expect(useMealPlanStore.getState().pendingIntents).toEqual({})
      expect(persistedWrites).toHaveBeenCalledTimes(1)
      expect(persistedWrites.mock.calls[0][1]).toEqual({state: {pendingIntents: {}}, version: 0})
    })

    it('answers no unresolved intent from a slice that is not an object', () => {
      expect(resolvePendingIntent({pendingIntents: null} as never, 'log', 'user-a', NOW)).toBeNull()
    })
  })
})

describe('prunePendingIntentsForUser', () => {
  it('removes a record minted by another account and rewrites the persisted slice', async () => {
    const clock = NOW
    const foreign = makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: clock})
    const live = makePendingIntent({key: 'live', userId: 'user-a', createdAt: clock})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {generate: foreign, log: live}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate: foreign, log: live})

    persistedWrites.mockClear()
    prunePendingIntentsForUser('user-a', () => clock)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
    expect(persistedWrites.mock.calls[0][0]).toBe('meal-plan-store')
    expect(persistedWrites.mock.calls[0][1]).toEqual({state: {pendingIntents: {log: live}}, version: 0})
  })

  it('waits for an in-flight hydration instead of being overwritten by it', async () => {
    const clock = NOW
    const foreign = makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: clock})
    const live = makePendingIntent({key: 'live', userId: 'user-a', createdAt: clock})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {generate: foreign, log: live}}, version: 0})

    const hydration = useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.persist.hasHydrated()).toBe(false)

    prunePendingIntentsForUser('user-a', () => clock)
    persistedWrites.mockClear()

    await hydration

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
    expect(persistedWrites.mock.calls[0][1]).toEqual({state: {pendingIntents: {log: live}}, version: 0})
  })

  // A read that REJECTED leaves the contents of storage unknown, so sweeping would decide the fate of records
  // nobody has seen — including, possibly, a key the server has already acted on. The sweep therefore waits,
  // and a retry that succeeds is what finally runs it.
  it('does not sweep a slice it could not read, and sweeps once a retry succeeds', async () => {
    const clock = NOW
    const foreign = makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: clock})

    useMealPlanStore.setState({
      pendingIntents: {generate: foreign},
      hasHydratedIntents: false,
      intentsHydration: 'pending'
    })
    persistedReads.mockRejectedValueOnce(new Error('storage unavailable'))

    const hydration = useMealPlanStore.persist.rehydrate()

    prunePendingIntentsForUser('user-a', () => clock)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate: foreign})

    await hydration

    expect(useMealPlanStore.getState().intentsHydration).toBe('failed')
    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate: foreign})

    // The retry reads successfully, which both permits writes again and releases the deferred sweep.
    persistedReads.mockResolvedValueOnce(null)
    useMealPlanStore.getState().retryIntentsHydration()

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().intentsHydration).toBe('succeeded')
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
  })

  it('drops the signed-in account own record once it has aged out', () => {
    const expired = makePendingIntent({action: 'swap', userId: 'user-a', createdAt: NOW - PENDING_INTENT_TTL_MS})

    useMealPlanStore.setState({pendingIntents: {swap: expired}})
    prunePendingIntentsForUser('user-a', () => NOW)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
  })

  it('leaves the slice and storage untouched when every record belongs to the signed-in account', () => {
    const live = makePendingIntent({userId: 'user-a'})

    useMealPlanStore.setState({pendingIntents: {log: live}})

    const before = useMealPlanStore.getState().pendingIntents

    persistedWrites.mockClear()
    prunePendingIntentsForUser('user-a', () => live.createdAt)

    expect(useMealPlanStore.getState().pendingIntents).toBe(before)
    expect(persistedWrites).not.toHaveBeenCalled()
  })
})

// The sweep is only worth anything if something actually runs it. A record minted by the previous account
// stays replayable for seven days, so every path where an identity becomes known has to sweep — otherwise a
// record the outgoing session failed to erase is still there when its own account signs back in.
describe('the ownership sweep at identity resolution', () => {
  const currentUser = authService.getCurrentUser as jest.Mock
  const logIn = authService.logInUser as jest.Mock

  const seed = (clock: number): {foreign: PendingIntent; mine: PendingIntent} => ({
    foreign: makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: clock}),
    mine: makePendingIntent({key: 'mine', userId: 'user-a', createdAt: clock})
  })

  it('runs for the account a cold start finds already signed in', async () => {
    const clock = NOW
    const {foreign, mine} = seed(clock)

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {generate: foreign, log: mine}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    // Hydration cannot judge ownership, so the foreign record is still there when initAuth runs.
    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate: foreign, log: mine})

    currentUser.mockReturnValueOnce({uid: 'user-a', email: 'user-a@example.com'})

    expect(useAuthStore.getState().initAuth()).toBe(true)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: mine})
  })

  it('runs for an asynchronous session restore, which initAuth own synchronous read can miss', () => {
    const clock = NOW
    const {foreign, mine} = seed(clock)

    useMealPlanStore.setState({pendingIntents: {generate: foreign, log: mine}})
    useAuthStore.setState({userId: null, userEmail: null, isAuthed: false, isAttemptingAuth: false})

    useAuthStore.getState().syncAuthState({uid: 'user-a', email: 'user-a@example.com'} as never)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: mine})
  })

  it('leaves nothing of the outgoing account when one account replaces another', async () => {
    const clock = NOW
    const {mine} = seed(clock)

    useMealPlanStore.setState({pendingIntents: {log: mine}})
    useAuthStore.setState({userId: 'user-a', userEmail: 'user-a@example.com', isAuthed: true, isAttemptingAuth: false})
    persistedRemovals.mockClear()

    useAuthStore.getState().syncAuthState({uid: 'user-b', email: 'user-b@example.com'} as never)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({})

    await flushMicrotasks()

    expect(persistedRemovals).toHaveBeenCalledTimes(1)
    expect(persistedRemovals.mock.calls[0][0]).toBe('meal-plan-store')
  })

  // A sign-in is the one identity resolution that is NOT a restore, so it discards rather than prunes: the
  // credentials just typed mean the session that minted any record here has ended, and the record the
  // signed-out session failed to erase is precisely the one that would otherwise replay (0.7.2).
  it('discards every record when a sign-in is what establishes the account, its own included', async () => {
    const clock = NOW
    const {foreign, mine} = seed(clock)

    useMealPlanStore.setState({pendingIntents: {generate: foreign, log: mine}})
    logIn.mockResolvedValueOnce({id: 'user-a', email: 'user-a@example.com'})

    await useAuthStore.getState().loginUser('user-a@example.com', 'secret')

    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
    expect(resolveReplayableIntent(useMealPlanStore.getState(), 'log', 'user-a', clock, REQUESTS.log)).toBeNull()
  })
})

describe('clearPendingIntent', () => {
  it('removes only the intent for the given action', () => {
    const generate = makePendingIntent({action: 'generate', key: 'key-1'})
    const log = makePendingIntent({key: 'key-2'})

    useMealPlanStore.setState({pendingIntents: {generate, log}})
    useMealPlanStore.getState().clearPendingIntent('generate')

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log})
  })

  it('leaves the slice untouched when the action holds no intent', () => {
    const log = makePendingIntent()

    useMealPlanStore.setState({pendingIntents: {log}})
    useMealPlanStore.getState().clearPendingIntent('regenerate')

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log})
  })
})

describe('setSelectedPlanId', () => {
  it('clears the selected day when the plan changes', () => {
    useMealPlanStore.setState({selectedPlanId: 'plan-1', selectedPlanDate: '2026-07-05'})

    useMealPlanStore.getState().setSelectedPlanId('plan-2')

    expect(useMealPlanStore.getState().selectedPlanId).toBe('plan-2')
    expect(useMealPlanStore.getState().selectedPlanDate).toBeNull()
  })

  it('keeps the selected day when the plan is unchanged', () => {
    useMealPlanStore.setState({selectedPlanId: 'plan-1', selectedPlanDate: '2026-07-05'})

    useMealPlanStore.getState().setSelectedPlanId('plan-1')

    expect(useMealPlanStore.getState().selectedPlanDate).toBe('2026-07-05')
  })
})

describe('setPostLogResult', () => {
  it('stores the payload and re-arms the success banner', () => {
    const result = makePostLogResult({entryId: 'entry-2'})

    useMealPlanStore.setState({dismissedSuccessBannerFor: 'entry-1'})
    useMealPlanStore.getState().setPostLogResult(result)

    expect(useMealPlanStore.getState().postLogResult).toEqual(result)
    expect(useMealPlanStore.getState().dismissedSuccessBannerFor).toBeNull()
  })

  it('ignores a replay carrying the entry the user already dismissed', () => {
    const result = makePostLogResult()

    useMealPlanStore.getState().setPostLogResult(result)
    useMealPlanStore.getState().dismissSuccessBanner(result.entryId)
    useMealPlanStore.getState().setPostLogResult(result)

    expect(useMealPlanStore.getState().postLogResult).toBeNull()
    expect(useMealPlanStore.getState().dismissedSuccessBannerFor).toBe('entry-1')
  })

  it('raises the banner again for a second serving logged as its own entry', () => {
    const first = makePostLogResult()
    const second = makePostLogResult({entryId: 'entry-2'})

    useMealPlanStore.getState().setPostLogResult(first)
    useMealPlanStore.getState().dismissSuccessBanner(first.entryId)
    useMealPlanStore.getState().setPostLogResult(second)

    expect(useMealPlanStore.getState().postLogResult).toEqual(second)
    expect(useMealPlanStore.getState().dismissedSuccessBannerFor).toBeNull()
  })
})

describe('dismissSuccessBanner', () => {
  it('discards the payload and records the dismissed entry', () => {
    const result = makePostLogResult()

    useMealPlanStore.getState().setPostLogResult(result)
    useMealPlanStore.getState().dismissSuccessBanner(result.entryId)

    expect(useMealPlanStore.getState().dismissedSuccessBannerFor).toBe('entry-1')
    expect(useMealPlanStore.getState().postLogResult).toBeNull()
  })
})

describe('clearPostLogResult', () => {
  it('drops the payload and the dismissal recorded against it', () => {
    const result = makePostLogResult()

    useMealPlanStore.getState().setPostLogResult(result)
    useMealPlanStore.getState().dismissSuccessBanner(result.entryId)
    useMealPlanStore.getState().clearPostLogResult()

    expect(useMealPlanStore.getState().postLogResult).toBeNull()
    expect(useMealPlanStore.getState().dismissedSuccessBannerFor).toBeNull()
  })
})

describe('reset', () => {
  it('clears the ephemeral fields and the persisted slice', () => {
    useMealPlanStore.setState({
      macrosSegment: 'mealPlan',
      selectedPlanDate: '2026-07-05',
      selectedPlanId: 'plan-1',
      dismissedSuccessBannerFor: 'entry-1',
      postLogResult: makePostLogResult(),
      pendingIntents: {
        generate: makePendingIntent({action: 'generate'}),
        swap: makePendingIntent({action: 'swap', key: 'key-2'})
      }
    })

    useMealPlanStore.getState().reset()

    const state = useMealPlanStore.getState()

    expect(state.macrosSegment).toBe('diary')
    expect(state.selectedPlanDate).toBeNull()
    expect(state.selectedPlanId).toBeNull()
    expect(state.dismissedSuccessBannerFor).toBeNull()
    expect(state.postLogResult).toBeNull()
    expect(state.pendingIntents).toEqual({})
  })

  // Signing out is the one caller outside this store that has to run reset(), and a plan left behind
  // would be readable by whoever signs in next — so the case drives the auth store's own logout path
  // instead of asserting that the two are wired together.
  it('is run by a sign-out, so neither slice survives into the next account', async () => {
    useMealPlanStore.setState({
      macrosSegment: 'mealPlan',
      selectedPlanDate: '2026-07-05',
      selectedPlanId: 'plan-1',
      dismissedSuccessBannerFor: 'entry-1',
      postLogResult: makePostLogResult(),
      pendingIntents: {log: makePendingIntent({action: 'log'})}
    })
    useAuthStore.setState({userId: 'user-a', userEmail: 'user-a@example.com', isAuthed: true})

    await useAuthStore.getState().logoutUser()

    const state = useMealPlanStore.getState()

    expect(state.macrosSegment).toBe('diary')
    expect(state.selectedPlanDate).toBeNull()
    expect(state.selectedPlanId).toBeNull()
    expect(state.dismissedSuccessBannerFor).toBeNull()
    expect(state.postLogResult).toBeNull()
    expect(state.pendingIntents).toEqual({})
  })
})

// `reset()` writes the default state through the persisting setter, which is neither awaited nor even
// attempted while the store's last read failed. The outgoing account's request snapshot would then stay on
// the device — so the account boundary removes the item and waits for the device to say it is gone.
describe('clearPersistedPendingIntents', () => {
  it('removes the persisted item and clears the slice in memory', async () => {
    useMealPlanStore.setState({
      macrosSegment: 'mealPlan',
      selectedPlanId: 'plan-1',
      pendingIntents: {log: makePendingIntent({key: 'outgoing'})}
    })
    persistedRemovals.mockClear()

    await clearPersistedPendingIntents()

    expect(persistedRemovals).toHaveBeenCalledTimes(1)
    expect(persistedRemovals.mock.calls[0][0]).toBe('meal-plan-store')
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
    expect(useMealPlanStore.getState().macrosSegment).toBe('diary')
    expect(useMealPlanStore.getState().selectedPlanId).toBeNull()
  })

  // The case `reset()` alone cannot cover: after a refused read the adapter writes nothing at all, so the
  // only thing that can take the record off the device is the removal.
  it('erases the slice after a read that rejected, where an ordinary write is refused', async () => {
    useMealPlanStore.setState({
      pendingIntents: {log: makePendingIntent({key: 'stranded'})},
      hasHydratedIntents: false,
      intentsHydration: 'pending'
    })
    persistedReads.mockRejectedValueOnce(new Error('storage unavailable'))

    await useMealPlanStore.persist.rehydrate()

    persistedWrites.mockClear()
    persistedRemovals.mockClear()

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'erased'})

    expect(persistedWrites).not.toHaveBeenCalled()
    expect(persistedRemovals).toHaveBeenCalledTimes(1)
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
  })

  // A removal the device refuses must not surface as a failed sign-out, and must not take the in-memory
  // boundary down with it — and it must not be the end of the erasure either: writing the empty slice is a
  // different storage call, and a rejection of the removal says nothing about it.
  it('writes an empty slice when the removal is refused, and still reports the record erased', async () => {
    useMealPlanStore.setState({pendingIntents: {log: makePendingIntent({key: 'undeletable'})}})
    persistedRemovals.mockRejectedValueOnce(new Error('storage unavailable'))
    persistedWrites.mockClear()

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'erased'})

    expect(persistedWrites.mock.calls.at(-1)).toEqual(['meal-plan-store', {state: {pendingIntents: {}}, version: 0}])
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
  })

  it('is reached by a sign-out, so the record leaves the device and not only memory', async () => {
    useMealPlanStore.setState({pendingIntents: {log: makePendingIntent({key: 'signed-out'})}})
    useAuthStore.setState({userId: 'user-a', userEmail: 'user-a@example.com', isAuthed: true})
    persistedRemovals.mockClear()

    await useAuthStore.getState().logoutUser()

    expect(persistedRemovals).toHaveBeenCalledTimes(1)
    expect(persistedRemovals.mock.calls[0][0]).toBe('meal-plan-store')
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
  })
})

describe('buildPendingIntent', () => {
  it('derives the fingerprint from the request, so the record describes itself', () => {
    const request = REQUESTS.swap
    const intent = buildPendingIntent(request, 'key-1', 'user-a', NOW)

    expect(intent.fingerprint).toBe(fingerprintSnapshot(request))
    expect(intent.request).toBe(request)
  })

  it('derives the plan and revision a keyed write names, rather than accepting them', () => {
    expect(buildPendingIntent(REQUESTS.regenerate, 'key-1', 'user-a', NOW)).toMatchObject({
      planId: 'plan-1',
      planRevision: 3
    })
    expect(buildPendingIntent(REQUESTS.swap, 'key-1', 'user-a', NOW)).toMatchObject({planId: 'plan-1', planRevision: 3})
    expect(buildPendingIntent(REQUESTS.log, 'key-1', 'user-a', NOW)).toMatchObject({planId: 'plan-1', planRevision: 3})
  })

  it('leaves a generation without a plan, because none exists yet', () => {
    expect(buildPendingIntent(REQUESTS.generate, 'key-1', 'user-a', NOW)).toMatchObject({
      planId: null,
      planRevision: null
    })
  })

  it('keeps the key, the account and the mint time exactly as given', () => {
    expect(buildPendingIntent(REQUESTS.log, 'key-9', 'user-b', 42)).toMatchObject({
      key: 'key-9',
      userId: 'user-b',
      createdAt: 42
    })
  })
})

describe('parsePendingIntent', () => {
  it('restores a record written by this release for every action', () => {
    const actions: readonly PendingIntentAction[] = ['generate', 'regenerate', 'swap', 'log']

    actions.forEach(action => {
      const intent = makePendingIntent({action})

      expect(parsePendingIntent(throughStorage(intent), action)).toEqual(intent)
    })
  })

  it('refuses a record from a release that stored no request, which could never be replayed', () => {
    const legacy = {
      userId: 'user-a',
      key: 'key-1',
      fingerprint: 'fp-1',
      planId: 'plan-1',
      planRevision: 3,
      createdAt: NOW
    }

    expect(parsePendingIntent(legacy, 'log')).toBeNull()
  })

  it('refuses a record whose fingerprint does not describe its own request', () => {
    const tampered = {...throughStorage(makePendingIntent()), fingerprint: 'fp-of-something-else'}

    expect(parsePendingIntent(tampered, 'log')).toBeNull()
  })

  it('refuses a record whose request belongs to another action', () => {
    expect(parsePendingIntent(throughStorage(makePendingIntent({action: 'swap'})), 'log')).toBeNull()
  })

  it('refuses a record whose stored plan or revision contradicts its request', () => {
    const wrongPlan = {...throughStorage(makePendingIntent({action: 'swap'})), planId: 'plan-2'}
    const wrongRevision = {...throughStorage(makePendingIntent({action: 'swap'})), planRevision: 4}

    expect(parsePendingIntent(wrongPlan, 'swap')).toBeNull()
    expect(parsePendingIntent(wrongRevision, 'swap')).toBeNull()
  })

  it('refuses a generation that claims a plan it cannot have', () => {
    const claimsPlan = {...throughStorage(makePendingIntent({action: 'generate'})), planId: 'plan-1'}

    expect(parsePendingIntent(claimsPlan, 'generate')).toBeNull()
  })

  it('refuses a record missing the account, the key or the mint time', () => {
    const fields: readonly string[] = ['userId', 'key', 'fingerprint', 'createdAt', 'request']

    fields.forEach(field => {
      const stored = throughStorage(makePendingIntent())

      delete stored[field]

      expect(parsePendingIntent(stored, 'log')).toBeNull()
    })
  })

  it('refuses a value that is not a record at all', () => {
    ;[null, undefined, 'log', 7, [makePendingIntent()]].forEach(value => {
      expect(parsePendingIntent(value, 'log')).toBeNull()
    })
  })

  it('refuses an unusable account or key rather than replaying under one', () => {
    const emptyUser = {...throughStorage(makePendingIntent()), userId: ''}
    const emptyKey = {...throughStorage(makePendingIntent()), key: ''}
    const unusableClock = {...throughStorage(makePendingIntent()), createdAt: 'yesterday'}

    expect(parsePendingIntent(emptyUser, 'log')).toBeNull()
    expect(parsePendingIntent(emptyKey, 'log')).toBeNull()
    expect(parsePendingIntent(unusableClock, 'log')).toBeNull()
  })
})

describe('cold-start replay', () => {
  const actions: readonly PendingIntentAction[] = ['generate', 'regenerate', 'swap', 'log']

  // The whole point of persisting an intent: the process that sent the request is gone, so the request has to
  // come back out of storage byte for byte and go out under the key it was already sent with.
  it.each(actions)('rebuilds the identical %s request after the app was killed mid-request', async action => {
    const request = REQUESTS[action]
    const sent = makePendingIntent({action, key: 'key-sent', createdAt: NOW})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {[action]: sent}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    const restored = useMealPlanStore.getState()
    const replay = resolveKeyedRequest(restored, request, 'user-a', NOW, 'key-fresh')

    expect(replay).toEqual({idempotencyKey: 'key-sent', isReplay: true, request})
    expect(requestBody(replay.request, replay.idempotencyKey)).toEqual(requestBody(request, 'key-sent'))
    expect(requestIds(replay.request)).toEqual(requestIds(request))
  })

  it('replays the stored request rather than the one the caller assembled', () => {
    const intent = makePendingIntent({action: 'swap', key: 'key-sent'})
    const rebuilt: MealPlanRequestSnapshot = {...REQUESTS.swap}

    const replay = resolveKeyedRequest({pendingIntents: {swap: intent}}, rebuilt, 'user-a', NOW, 'key-fresh')

    // The validated record, not the object the caller passed in: a replay must send what was stored, and the
    // stored snapshot reaches the caller re-parsed rather than as a live reference into persisted state.
    expect(replay.request).toEqual(intent.request)
    expect(replay.request).not.toBe(rebuilt)
  })

  it('mints a new key when nothing is pending', () => {
    expect(resolveKeyedRequest({pendingIntents: {}}, REQUESTS.log, 'user-a', NOW, 'key-fresh')).toEqual({
      idempotencyKey: 'key-fresh',
      isReplay: false,
      request: REQUESTS.log
    })
  })

  describe('mints a new key rather than reusing a spent one', () => {
    it.each([
      ['the chosen alternative changed', {...REQUESTS.swap, recipeVersionId: 'rv-2'} as MealPlanRequestSnapshot],
      ['the portion changed', {...REQUESTS.swap, portionMultiplier: 1} as MealPlanRequestSnapshot],
      ['the plan revision moved on', {...REQUESTS.swap, expectedPlanRevision: 4} as MealPlanRequestSnapshot]
    ])('when %s', (_case, request) => {
      const intent = makePendingIntent({action: 'swap', key: 'key-sent'})

      expect(resolveKeyedRequest({pendingIntents: {swap: intent}}, request, 'user-a', NOW, 'key-fresh')).toEqual({
        idempotencyKey: 'key-fresh',
        isReplay: false,
        request
      })
    })

    it('when the eaten servings changed since the key was minted', () => {
      const intent = makePendingIntent({key: 'key-sent'})
      const request: MealPlanRequestSnapshot = {...REQUESTS.log, servings: 2}

      expect(resolveKeyedRequest({pendingIntents: {log: intent}}, request, 'user-a', NOW, 'key-fresh')).toMatchObject({
        idempotencyKey: 'key-fresh',
        isReplay: false
      })
    })

    it('when the pending intent belongs to another account', () => {
      const intent = makePendingIntent({key: 'key-sent', userId: 'user-b'})

      expect(
        resolveKeyedRequest({pendingIntents: {log: intent}}, REQUESTS.log, 'user-a', NOW, 'key-fresh')
      ).toMatchObject({idempotencyKey: 'key-fresh', isReplay: false})
    })

    it('when the pending intent has aged out', () => {
      const intent = makePendingIntent({key: 'key-sent', createdAt: NOW - PENDING_INTENT_TTL_MS})

      expect(
        resolveKeyedRequest({pendingIntents: {log: intent}}, REQUESTS.log, 'user-a', NOW, 'key-fresh')
      ).toMatchObject({idempotencyKey: 'key-fresh', isReplay: false})
    })

    it('when the stored record cannot be trusted to describe its request', () => {
      const tampered = {...makePendingIntent({key: 'key-sent'}), fingerprint: 'fp-of-something-else'}

      expect(
        resolveKeyedRequest({pendingIntents: {log: tampered}}, REQUESTS.log, 'user-a', NOW, 'key-fresh')
      ).toMatchObject({idempotencyKey: 'key-fresh', isReplay: false})
    })
  })

  it('consults only the intent of the action being sent', () => {
    const swap = makePendingIntent({action: 'swap', key: 'key-swap'})

    expect(resolveKeyedRequest({pendingIntents: {swap}}, REQUESTS.log, 'user-a', NOW, 'key-fresh')).toMatchObject({
      idempotencyKey: 'key-fresh',
      isReplay: false
    })
  })

  it('drops a record no release can replay while the app starts, so its key stops being offered', async () => {
    const legacy = {
      userId: 'user-a',
      key: 'key-legacy',
      fingerprint: 'fp-1',
      planId: 'plan-1',
      planRevision: 3,
      createdAt: NOW
    }
    const live = makePendingIntent({action: 'swap', key: 'live', createdAt: NOW})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {log: legacy, swap: live}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({swap: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
  })

  it('drops a record filed under an action its request does not name', () => {
    const misfiled = makePendingIntent({action: 'swap'})

    expect(selectPrunedPendingIntents({log: misfiled}, NOW, 'user-a')).toEqual({})
  })
})

describe('resolveReplayableIntent', () => {
  const state = (intent: PendingIntent, action: PendingIntentAction = 'swap') => ({pendingIntents: {[action]: intent}})

  it('returns the record when the scope names the plan and meal it was minted for', () => {
    const intent = makePendingIntent({action: 'swap', request: REQUESTS.swap})

    expect(resolveReplayableIntent(state(intent), 'swap', 'user-a', NOW, {planId: 'plan-1', mealId: 'meal-1'})).toEqual(
      intent
    )
  })

  // Replaying another meal's key would commit that meal's swap, which is why the ids are compared rather than
  // assumed from the action alone.
  it('refuses a record minted for another meal', () => {
    const intent = makePendingIntent({action: 'swap', request: REQUESTS.swap})

    expect(
      resolveReplayableIntent(state(intent), 'swap', 'user-a', NOW, {planId: 'plan-1', mealId: 'meal-2'})
    ).toBeNull()
  })

  it('refuses a record minted for another plan', () => {
    const intent = makePendingIntent({action: 'swap', request: REQUESTS.swap})

    expect(
      resolveReplayableIntent(state(intent), 'swap', 'user-a', NOW, {planId: 'plan-2', mealId: 'meal-1'})
    ).toBeNull()
  })

  it('returns a generation when no scope is given, since it names no resource', () => {
    const intent = makePendingIntent({action: 'generate', request: REQUESTS.generate})

    expect(resolveReplayableIntent(state(intent, 'generate'), 'generate', 'user-a', NOW)).toEqual(intent)
  })

  it('refuses a record belonging to another account', () => {
    const intent = makePendingIntent({action: 'log', request: REQUESTS.log, userId: 'user-b'})

    expect(
      resolveReplayableIntent(state(intent, 'log'), 'log', 'user-a', NOW, {planId: 'plan-1', mealId: 'meal-1'})
    ).toBeNull()
  })

  it('refuses a record that has aged out', () => {
    const intent = makePendingIntent({action: 'log', request: REQUESTS.log, createdAt: NOW - PENDING_INTENT_TTL_MS})

    expect(
      resolveReplayableIntent(state(intent, 'log'), 'log', 'user-a', NOW, {planId: 'plan-1', mealId: 'meal-1'})
    ).toBeNull()
  })

  // Signed out, ownership cannot be judged at all, so nothing is replayable.
  it('refuses every record while the account is unknown', () => {
    const intent = makePendingIntent({action: 'log', request: REQUESTS.log})

    expect(resolveReplayableIntent(state(intent, 'log'), 'log', null, NOW)).toBeNull()
  })

  it('refuses the slot the caller did not ask about', () => {
    const intent = makePendingIntent({action: 'swap', request: REQUESTS.swap})

    expect(resolveReplayableIntent(state(intent), 'log', 'user-a', NOW)).toBeNull()
  })
})

describe('hasHydratedIntents', () => {
  it('is announced through the store, so a screen subscribed to it re-renders when the read lands', async () => {
    useMealPlanStore.setState({hasHydratedIntents: false})

    // A first launch restores nothing: hydration finishes with no state change at all, which is exactly the
    // case a screen waiting on `pendingIntents` alone would never hear about.
    persistedReads.mockResolvedValueOnce(null)

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().hasHydratedIntents).toBe(true)
  })

  // A refused read is NOT an empty store, and this is the assertion that says so. The slice may still hold the
  // key of an action the server committed, so reporting the read as "hydrated" would hand every gate built on
  // this flag permission to mint a second key for that same action (0.7.2).
  it('reports a refused read as failed rather than as hydrated, so no fresh key may be minted', async () => {
    const stranded = makePendingIntent({action: 'log', key: 'stranded', userId: 'user-a'})

    useMealPlanStore.setState({
      pendingIntents: {log: stranded},
      hasHydratedIntents: false,
      intentsHydration: 'pending'
    })
    persistedReads.mockRejectedValueOnce(new Error('storage unavailable'))
    persistedWrites.mockClear()

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().intentsHydration).toBe('failed')
    expect(useMealPlanStore.getState().hasHydratedIntents).toBe(false)

    // And nothing was written back. The old behaviour announced hydration through the persisting setter, whose
    // write would have put this process's default empty slice on top of whatever the failed read did not see.
    expect(persistedWrites).not.toHaveBeenCalled()
  })

  // The way out of 'failed': until a read succeeds nothing may be minted and nothing may be written, so a
  // device that momentarily refused the read must not strand the feature for the rest of the process.
  it('returns to pending and then succeeds when the read is retried', async () => {
    useMealPlanStore.setState({hasHydratedIntents: false, intentsHydration: 'pending'})
    persistedReads.mockRejectedValueOnce(new Error('storage unavailable'))

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().intentsHydration).toBe('failed')

    persistedReads.mockResolvedValueOnce(null)
    useMealPlanStore.getState().retryIntentsHydration()

    expect(useMealPlanStore.getState().intentsHydration).toBe('pending')

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().intentsHydration).toBe('succeeded')
    expect(useMealPlanStore.getState().hasHydratedIntents).toBe(true)
  })

  it('refuses every storage write while the contents are unknown, and writes again after a successful read', async () => {
    useMealPlanStore.setState({pendingIntents: {}, hasHydratedIntents: false, intentsHydration: 'pending'})
    persistedReads.mockRejectedValueOnce(new Error('storage unavailable'))

    await useMealPlanStore.persist.rehydrate()

    persistedWrites.mockClear()
    useMealPlanStore.getState().recordPendingIntent(makePendingIntent({key: 'after-failed-read'}))

    expect(persistedWrites).not.toHaveBeenCalled()

    persistedReads.mockResolvedValueOnce(null)
    useMealPlanStore.getState().retryIntentsHydration()

    await useMealPlanStore.persist.rehydrate()
    await flushMicrotasks()

    // Cleared here so the count below is the recorded intent's own write, not the rehydration prune's.
    persistedWrites.mockClear()
    useMealPlanStore.getState().recordPendingIntent(makePendingIntent({key: 'after-retry'}))

    expect(persistedWrites).toHaveBeenCalledTimes(1)
  })

  // Hydration is a fact about this process, not about the account: putting every owning screen back to
  // 'not yet known' at sign-out would leave each of them waiting for a read that already happened.
  it('survives reset, unlike every other field', () => {
    useMealPlanStore.setState({hasHydratedIntents: true})
    useMealPlanStore.getState().reset()

    expect(useMealPlanStore.getState().hasHydratedIntents).toBe(true)
  })

  it('is not persisted, since it describes this launch rather than the stored record', () => {
    useMealPlanStore.setState({hasHydratedIntents: true})

    expect(selectPersistedState(useMealPlanStore.getState())).toEqual({
      pendingIntents: useMealPlanStore.getState().pendingIntents
    })
  })
})

describe('persisted writes', () => {
  // The middleware writes after every set and partializes only at write time, so before this every segment
  // tap, day selection and banner dismissal serialised and wrote an unchanged pendingIntents to the device.
  it.each([
    ['the macros segment', () => useMealPlanStore.getState().setMacrosSegment('mealPlan')],
    ['the selected day', () => useMealPlanStore.getState().setSelectedPlanDate('2026-07-06')],
    ['the selected plan', () => useMealPlanStore.getState().setSelectedPlanId('plan-2')],
    ['the post-log banner', () => useMealPlanStore.getState().setPostLogResult(makePostLogResult())],
    ['a banner dismissal', () => useMealPlanStore.getState().dismissSuccessBanner('entry-1')]
  ])('skips the storage write when %s changes, leaving the intent slice untouched', (_case, change) => {
    useMealPlanStore.setState({pendingIntents: {log: makePendingIntent()}})
    persistedWrites.mockClear()

    change()

    expect(persistedWrites).not.toHaveBeenCalled()
  })

  it('still writes when the intent slice itself changes', () => {
    useMealPlanStore.setState({pendingIntents: {}})
    persistedWrites.mockClear()

    useMealPlanStore.getState().recordPendingIntent(makePendingIntent())

    expect(persistedWrites).toHaveBeenCalledTimes(1)
    expect(persistedWrites.mock.calls[0][0]).toBe('meal-plan-store')
  })

  it('writes once for a change and not again for the ephemeral updates that follow it', () => {
    useMealPlanStore.setState({pendingIntents: {}})
    persistedWrites.mockClear()

    useMealPlanStore.getState().recordPendingIntent(makePendingIntent())
    useMealPlanStore.getState().setMacrosSegment('mealPlan')
    useMealPlanStore.getState().setSelectedPlanDate('2026-07-07')

    expect(persistedWrites).toHaveBeenCalledTimes(1)
  })

  it('writes again when the slice returns to a value it held earlier, since the last write was a different one', () => {
    const intent = makePendingIntent()

    useMealPlanStore.setState({pendingIntents: {}})
    useMealPlanStore.getState().recordPendingIntent(intent)
    useMealPlanStore.getState().clearPendingIntent('log')
    persistedWrites.mockClear()

    useMealPlanStore.getState().recordPendingIntent(intent)

    expect(persistedWrites).toHaveBeenCalledTimes(1)
  })
})

describe('persisted write durability', () => {
  // The memo exists to skip writes that would change nothing on disk, so it may only ever record what disk
  // has CONFIRMED. Recording the value before awaiting made a rejected write permanent: the next identical
  // attempt matched the memo and returned without touching the device, so the key of an action the server may
  // already have committed never reached storage and the next launch minted a second one (0.7.2).
  it('retries an identical write after the first one was rejected', async () => {
    const intent = makePendingIntent({key: 'durable'})

    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()

    persistedWrites.mockClear()
    persistedWrites.mockRejectedValueOnce(new Error('disk full'))

    useMealPlanStore.getState().recordPendingIntent(intent)
    await flushMicrotasks()

    expect(persistedWrites).toHaveBeenCalledTimes(1)

    // Same slice, second attempt: a write, not a no-op.
    useMealPlanStore.setState({pendingIntents: {}})
    useMealPlanStore.getState().recordPendingIntent(intent)
    await flushMicrotasks()

    expect(persistedWrites).toHaveBeenCalledTimes(3)
    expect(persistedWrites.mock.calls[2][1]).toEqual({state: {pendingIntents: {log: intent}}, version: 0})
  })

  // Two sets in one tick queue two writes, and the first may resolve last. Letting whichever finished last
  // claim the memo would tell the next comparison that the OLDER state is what sits on disk, and the newer
  // state would then be skipped for good.
  it('lets only the newest queued write claim the memo, whatever order they resolve in', async () => {
    const first = makePendingIntent({key: 'first'})
    const second = makePendingIntent({key: 'second'})

    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()
    persistedWrites.mockClear()

    let releaseFirst = (): void => undefined

    persistedWrites.mockImplementationOnce(
      async () =>
        new Promise<void>(resolve => {
          releaseFirst = resolve
        })
    )

    useMealPlanStore.getState().recordPendingIntent(first)
    useMealPlanStore.getState().recordPendingIntent(second)

    releaseFirst()
    await flushMicrotasks()

    expect(persistedWrites).toHaveBeenCalledTimes(2)

    // The newest value is what disk holds, so restating it is the no-op...
    useMealPlanStore.getState().recordPendingIntent(second)
    await flushMicrotasks()

    expect(persistedWrites).toHaveBeenCalledTimes(2)

    // ...while returning to the older value is a real change and must be written.
    useMealPlanStore.getState().recordPendingIntent(first)
    await flushMicrotasks()

    expect(persistedWrites).toHaveBeenCalledTimes(3)
  })
})

// The reservation is what a screen may act on: the memory record alone says nothing about the device, and a
// keyed request sent on the strength of it races its own storage write. A kill in that window loses the only
// key that can reconcile an action the server may already have committed (0.7.2).
describe('recordPendingIntent durability', () => {
  it('reports the record durable only once the device has confirmed the write', async () => {
    const intent = makePendingIntent({key: 'durable'})

    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()
    persistedWrites.mockClear()

    let releaseWrite = (): void => undefined

    persistedWrites.mockImplementationOnce(
      async () =>
        new Promise<void>(resolve => {
          releaseWrite = resolve
        })
    )

    const reservation = useMealPlanStore.getState().recordPendingIntent(intent)

    let settled: PendingIntentReservation | null = null

    reservation.then(value => {
      settled = value
    })

    await flushMicrotasks()

    // The record is already in memory, but nothing may be claimed about the device yet.
    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: intent})
    expect(settled).toBeNull()

    releaseWrite()

    await expect(reservation).resolves.toEqual({kind: 'durable'})
  })

  it('reports a rejected write as storage_failed, keeps the record, and still writes on the next attempt', async () => {
    const intent = makePendingIntent({key: 'rejected'})

    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()

    persistedWrites.mockClear()
    persistedWrites.mockRejectedValueOnce(new Error('disk full'))

    await expect(useMealPlanStore.getState().recordPendingIntent(intent)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'storage_failed'
    })

    // Deliberately NOT rolled back: the caller has already pressed, and a caller that lost its key would mint
    // a second one for a request the server may have committed under the first.
    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: intent})
    expect(persistedWrites).toHaveBeenCalledTimes(1)

    await expect(useMealPlanStore.getState().recordPendingIntent(intent)).resolves.toEqual({kind: 'durable'})

    expect(persistedWrites).toHaveBeenCalledTimes(2)
    expect(persistedWrites.mock.calls[1][1]).toEqual({state: {pendingIntents: {log: intent}}, version: 0})
  })

  // Re-recording the same intent writes nothing — the device already holds exactly that slice — and the
  // reservation has to report that as durable rather than as a write it never saw land.
  it('reports durability for a record the device already holds, without writing again', async () => {
    const intent = makePendingIntent({key: 'already-stored'})

    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()

    await expect(useMealPlanStore.getState().recordPendingIntent(intent)).resolves.toEqual({kind: 'durable'})

    persistedWrites.mockClear()

    await expect(useMealPlanStore.getState().recordPendingIntent(intent)).resolves.toEqual({kind: 'durable'})

    expect(persistedWrites).not.toHaveBeenCalled()
  })

  it('claims nothing while the persisted slice has not come back yet', async () => {
    const intent = makePendingIntent({key: 'while-pending'})

    useMealPlanStore.setState({pendingIntents: {}, hasHydratedIntents: false, intentsHydration: 'pending'})

    await expect(useMealPlanStore.getState().recordPendingIntent(intent)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'hydration_unknown'
    })

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: intent})
  })

  it('claims nothing after a read that rejected, where the adapter refuses the write outright', async () => {
    const intent = makePendingIntent({key: 'after-failed-read'})

    useMealPlanStore.setState({pendingIntents: {}, hasHydratedIntents: false, intentsHydration: 'pending'})
    persistedReads.mockRejectedValueOnce(new Error('storage unavailable'))

    await useMealPlanStore.persist.rehydrate()
    persistedWrites.mockClear()

    await expect(useMealPlanStore.getState().recordPendingIntent(intent)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'hydration_unknown'
    })

    expect(persistedWrites).not.toHaveBeenCalled()
    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: intent})
  })

  // A confirmed slice describing a DIFFERENT request must not pass for this one: the reservation exists to
  // say that this key is recoverable, and a key that is not on disk is not.
  it('does not report durability from a confirmed slice holding another key for the same action', async () => {
    const stored = makePendingIntent({key: 'stored'})
    const other = makePendingIntent({key: 'other'})

    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()

    await expect(useMealPlanStore.getState().recordPendingIntent(stored)).resolves.toEqual({kind: 'durable'})

    // The write of the second record is refused, so what the device confirmed still describes the first.
    persistedWrites.mockRejectedValueOnce(new Error('disk full'))

    await expect(useMealPlanStore.getState().recordPendingIntent(other)).resolves.toEqual({
      kind: 'unavailable',
      reason: 'storage_failed'
    })
  })
})

// CWE-532. An AsyncStorage rejection carries native paths and module internals, and its message can quote
// the value being written — which here is an idempotency key and a request body. Device and crash logs are
// read by more people than the user, so the log carries a fixed code and nothing else.
describe('persistence failure logging', () => {
  const CANARY = '/data/user/0/com.stateofhealth/files/RCTAsyncLocalStorage_V1/intent-key-9f3c-CANARY'

  let consoleError: jest.SpyInstance

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  const loggedArguments = (): string[] => consoleError.mock.calls.flat().map(value => String(value))

  it('logs a fixed code for a rejected write, never the rejection', async () => {
    useMealPlanStore.setState({pendingIntents: {}})
    await flushPersistedRead()

    persistedWrites.mockRejectedValueOnce(new Error(CANARY))

    await useMealPlanStore.getState().recordPendingIntent(makePendingIntent({key: 'canary-write'}))

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]).toEqual(['meal_plan_intent_persist_write_failed'])

    loggedArguments().forEach(logged => {
      expect(logged).not.toContain(CANARY)
      expect(logged).not.toContain('Error')
      expect(logged).not.toContain('canary-write')
    })
  })

  it('logs a fixed code for a refused removal, never the rejection', async () => {
    useMealPlanStore.setState({pendingIntents: {log: makePendingIntent({key: 'canary-removal'})}})
    persistedRemovals.mockRejectedValueOnce(new Error(CANARY))

    await clearPersistedPendingIntents()

    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError.mock.calls[0]).toEqual(['meal_plan_intent_persist_remove_failed'])

    loggedArguments().forEach(logged => {
      expect(logged).not.toContain(CANARY)
      expect(logged).not.toContain('Error')
      expect(logged).not.toContain('canary-removal')
    })
  })
})

describe('resolveSlotOwnership', () => {
  const swap = (planId: string, mealId: string): PendingIntent =>
    makePendingIntent({
      action: 'swap',
      key: `key-${mealId}`,
      userId: 'user-a',
      request: {...REQUESTS.swap, planId, mealId}
    })

  it('reports a free slot when nothing is on record', () => {
    expect(
      resolveSlotOwnership({pendingIntents: {}}, 'swap', 'user-a', NOW, {planId: 'plan-1', mealId: 'meal-1'})
    ).toEqual({
      kind: 'free'
    })
  })

  it('reports the caller own unresolved request as theirs to replay', () => {
    const intent = swap('plan-1', 'meal-1')

    expect(
      resolveSlotOwnership({pendingIntents: {swap: intent}}, 'swap', 'user-a', NOW, {
        planId: 'plan-1',
        mealId: 'meal-1'
      })
    ).toEqual({kind: 'mine', intent})
  })

  // The distinction the scoped resolver cannot make, and the one that matters: another meal holding the slot
  // is NOT an empty slot. Minting over it abandons the only key that could reconcile that meal's commit.
  it('reports another meal holding the slot as foreign rather than free', () => {
    const intent = swap('plan-1', 'meal-other')

    expect(
      resolveSlotOwnership({pendingIntents: {swap: intent}}, 'swap', 'user-a', NOW, {
        planId: 'plan-1',
        mealId: 'meal-1'
      })
    ).toEqual({kind: 'foreign', intent})
  })

  it('reports another plan holding the slot as foreign', () => {
    const intent = swap('plan-other', 'meal-1')

    expect(
      resolveSlotOwnership({pendingIntents: {swap: intent}}, 'swap', 'user-a', NOW, {
        planId: 'plan-1',
        mealId: 'meal-1'
      })
    ).toEqual({kind: 'foreign', intent})
  })

  // Expired and foreign-account records really are free: neither may be replayed, and neither is a reason to
  // refuse the user's new request.
  it('reports a free slot for a record that has aged out or belongs to another account', () => {
    const expired = makePendingIntent({
      action: 'swap',
      userId: 'user-a',
      createdAt: NOW - PENDING_INTENT_TTL_MS,
      request: REQUESTS.swap
    })
    const foreignUser = makePendingIntent({
      action: 'swap',
      userId: 'user-b',
      request: REQUESTS.swap
    })

    expect(resolveSlotOwnership({pendingIntents: {swap: expired}}, 'swap', 'user-a', NOW).kind).toBe('free')
    expect(resolveSlotOwnership({pendingIntents: {swap: foreignUser}}, 'swap', 'user-a', NOW).kind).toBe('free')
  })

  it('reports a free slot when no account is known, since ownership cannot be judged', () => {
    const intent = swap('plan-1', 'meal-1')

    expect(resolveSlotOwnership({pendingIntents: {swap: intent}}, 'swap', null, NOW).kind).toBe('free')
  })

  // A generate snapshot carries neither id, so an empty scope is the only one it can match — which is what
  // keeps the fail-closed scope check from reporting the generation slot as foreign to its own owner.
  it('reports an unscoped generation record as theirs when no scope is asked for', () => {
    const intent = makePendingIntent({action: 'generate', userId: 'user-a', request: REQUESTS.generate})

    expect(resolveSlotOwnership({pendingIntents: {generate: intent}}, 'generate', 'user-a', NOW).kind).toBe('mine')
    expect(
      resolveSlotOwnership({pendingIntents: {generate: intent}}, 'generate', 'user-a', NOW, {planId: 'plan-1'}).kind
    ).toBe('foreign')
  })
})

// The pin above is what every boundary case in this file rests on, and it is installed once rather than per
// case. This is the assertion that it survived all of them — `jest.clearAllMocks()` resets recorded calls,
// not implementations, and a change to that would otherwise turn these cases back into live-clock tests
// without failing anything.
describe('the suite clock', () => {
  it('is still pinned to the NOW fixture after every earlier case', () => {
    expect(Date.now()).toBe(NOW)
  })
})

// The account boundary as a sequence of processes rather than of calls. Everything above drives the adapter
// with one-shot mock answers, which cannot express the question these findings actually ask: what is STILL AT
// REST after storage refused, and what happens when the app comes back and reads it. So these cases run
// against a device that retains what was written to it and can be told to refuse each call independently.
describe('the account boundary against a device that keeps what it was given', () => {
  interface Device {
    item: StorageValue<MealPlanPersistedState> | null
    rejectReads: boolean
    rejectWrites: boolean
    rejectRemovals: boolean
  }

  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

  let device: Device

  beforeEach(() => {
    device = {item: null, rejectReads: false, rejectWrites: false, rejectRemovals: false}

    persistedReads.mockImplementation(async () => {
      if (device.rejectReads) {
        throw new Error('read unavailable')
      }

      return device.item === null ? null : clone(device.item)
    })

    persistedWrites.mockImplementation(async (_name: string, value: StorageValue<MealPlanPersistedState>) => {
      if (device.rejectWrites) {
        throw new Error('write unavailable')
      }

      device.item = clone(value)
    })

    persistedRemovals.mockImplementation(async () => {
      if (device.rejectRemovals) {
        throw new Error('removal unavailable')
      }

      device.item = null
    })
  })

  // The adapter's quarantine and write memos are module state that outlives a case, so the suite is handed
  // back a device that answers, and one successful read is what clears a latch this describe set.
  afterEach(async () => {
    persistedReads.mockImplementation(async () => null)
    persistedWrites.mockImplementation(async () => undefined)
    persistedRemovals.mockImplementation(async () => undefined)

    await flushPersistedRead()
  })

  /** What the device holds, as the slice rather than the envelope. */
  const restingIntents = (): unknown => device.item?.state.pendingIntents ?? null

  const seedDeviceWith = async (intent: PendingIntent): Promise<void> => {
    device.item = {state: {pendingIntents: {[intent.request.action]: intent}}, version: 0}

    await useMealPlanStore.persist.rehydrate()
    await flushMicrotasks()
  }

  it('leaves nothing at rest when the removal lands', async () => {
    await seedDeviceWith(makePendingIntent({key: 'signed-out'}))

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'erased'})

    expect(restingIntents()).toBeNull()
  })

  // The scenario the erasure finding named: the read rejected, so every ordinary write is refused, and then
  // the removal rejected too. Before the fallback write existed, the outgoing account's request snapshot
  // stayed on the device from here on.
  it('erases the record through the empty write when the read and the removal both refused', async () => {
    const stranded = makePendingIntent({key: 'stranded'})

    await seedDeviceWith(stranded)

    device.rejectReads = true
    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().intentsHydration).toBe('failed')

    device.rejectReads = false
    device.rejectRemovals = true

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'erased'})

    expect(restingIntents()).toEqual({})
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
  })

  // Every path refused. The record really is still at rest, so the boundary says so — and what makes it
  // harmless is the next sign-in, not a hope about storage.
  it('reports failure, and the next explicit sign-in discards the record it left behind', async () => {
    const abandoned = makePendingIntent({key: 'abandoned'})

    await seedDeviceWith(abandoned)

    device.rejectRemovals = true
    device.rejectWrites = true

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'failed'})

    // Still there, which is the honest state of the device and why the outcome is reported.
    expect(restingIntents()).toEqual({log: throughStorage(abandoned)})

    // The app comes back. Writes are still refused, so nothing can quietly erase the device before the read
    // — a new process starts from the default state and hydrates, it does not write first. The abandoned
    // record is restored into memory: exactly the cold start that would have replayed it.
    useMealPlanStore.setState({hasHydratedIntents: false, intentsHydration: 'pending'})

    await useMealPlanStore.persist.rehydrate()
    await flushMicrotasks()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: throughStorage(abandoned)})

    // And the sign-in that follows a sign-out keeps nothing, whoever minted it.
    device.rejectWrites = false
    discardPendingIntentsForSignIn()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
    expect(resolveReplayableIntent(useMealPlanStore.getState(), 'log', 'user-a', NOW, REQUESTS.log)).toBeNull()

    await flushMicrotasks()

    // The discard's own write is what finally takes it off the device, now that the device answers again.
    expect(restingIntents()).toEqual({})
  })

  // The dangerous ordering: the sign-in happens while the read is still out, so the sweep has to wait for it
  // rather than decide on a slice nobody has seen — and then discard what the read brings back.
  it('discards a record that arrives from storage after the sign-in', async () => {
    const abandoned = makePendingIntent({key: 'late-arrival'})

    device.item = {state: {pendingIntents: {log: abandoned}}, version: 0}
    useMealPlanStore.setState({hasHydratedIntents: false, intentsHydration: 'pending'})
    device.rejectReads = true

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().intentsHydration).toBe('failed')

    discardPendingIntentsForSignIn()
    device.rejectReads = false
    useMealPlanStore.getState().retryIntentsHydration()

    await useMealPlanStore.persist.rehydrate()
    await flushMicrotasks()

    expect(useMealPlanStore.getState().intentsHydration).toBe('succeeded')
    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
    expect(restingIntents()).toEqual({})
  })

  // The sequence the ownership finding named, end to end: A's cleanup fails, B arrives and B's own prune
  // cannot be written either, and then A comes back. A's abandoned key must not be replayable at any point
  // after the sign-out that abandoned it.
  it("keeps A's abandoned key unreplayable through B and back to A, even when every write refused", async () => {
    const abandonedByA = makePendingIntent({key: 'a-abandoned', userId: 'user-a'})

    await seedDeviceWith(abandonedByA)

    device.rejectRemovals = true
    device.rejectWrites = true

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'failed'})

    // B signs in. The discard drops the record from memory; the write that would take it off the device is
    // still refused, so it remains at rest and B can see it on a cold start — but never resolve it.
    useMealPlanStore.setState({hasHydratedIntents: false, intentsHydration: 'pending'})

    await useMealPlanStore.persist.rehydrate()
    await flushMicrotasks()

    discardPendingIntentsForSignIn()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({})
    expect(resolveReplayableIntent(useMealPlanStore.getState(), 'log', 'user-b', NOW, REQUESTS.log)).toBeNull()
    expect(restingIntents()).toEqual({log: throughStorage(abandonedByA)})

    // A comes back. The record is restored from the device it never left, and A's own sign-in is what
    // refuses it: the session that minted it ended at the sign-out.
    useMealPlanStore.setState({hasHydratedIntents: false, intentsHydration: 'pending'})

    await useMealPlanStore.persist.rehydrate()
    await flushMicrotasks()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: throughStorage(abandonedByA)})

    device.rejectWrites = false
    discardPendingIntentsForSignIn()

    expect(resolveReplayableIntent(useMealPlanStore.getState(), 'log', 'user-a', NOW, REQUESTS.log)).toBeNull()

    await flushMicrotasks()

    expect(restingIntents()).toEqual({})
  })

  // A cold start that RESTORES a session is the one case an unresolved key exists for, so the two sweeps must
  // not be interchangeable: the prune keeps the restored account's own live record.
  it('keeps the restored account own record where the prune runs instead of the discard', async () => {
    const live = makePendingIntent({key: 'live', userId: 'user-a'})

    await seedDeviceWith(live)
    prunePendingIntentsForUser('user-a', () => NOW)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: throughStorage(live)})
    expect(resolveReplayableIntent(useMealPlanStore.getState(), 'log', 'user-a', NOW, REQUESTS.log)).not.toBeNull()
  })

  // The quarantine exists so that a write cannot overwrite contents nobody has read. A removal that REJECTED
  // did not make those contents known, so announcing them as empty — which is what clearing the latch before
  // the await did — would hand that permission out on the strength of a call that failed.
  it('keeps refusing ordinary writes after a removal the device rejected', async () => {
    await seedDeviceWith(makePendingIntent({key: 'quarantined'}))

    device.rejectReads = true
    await useMealPlanStore.persist.rehydrate()

    device.rejectReads = false
    device.rejectRemovals = true
    device.rejectWrites = true

    await expect(clearPersistedPendingIntents()).resolves.toEqual({kind: 'failed'})

    device.rejectWrites = false
    persistedWrites.mockClear()

    // An ordinary state change, which the persist middleware would write. The contents are still unknown, so
    // it must not reach the device.
    useMealPlanStore.setState({pendingIntents: {swap: makePendingIntent({action: 'swap', key: 'later'})}})
    await flushMicrotasks()

    expect(persistedWrites).not.toHaveBeenCalled()
  })
})
