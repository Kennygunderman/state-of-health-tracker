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

import useMealPlanStore, {
  buildPendingIntent,
  isPendingIntentExpired,
  parsePendingIntent,
  PENDING_INTENT_TTL_MS,
  PendingIntent,
  PendingIntentAction,
  PostLogResult,
  prunePendingIntentsForUser,
  resolveKeyedRequest,
  resolvePendingIntent,
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

jest.mock('@service/auth/AuthService', () => ({
  __esModule: true,
  default: {logOutUser: jest.fn(async () => undefined)}
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
    const live = makePendingIntent({key: 'live', createdAt: Date.now()})
    const expired = makePendingIntent({
      action: 'generate',
      key: 'expired',
      createdAt: Date.now() - PENDING_INTENT_TTL_MS
    })

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {log: live, generate: expired}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
  })

  it('restores a live intent without writing storage back', async () => {
    const live = makePendingIntent({key: 'live', createdAt: Date.now()})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {log: live}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).not.toHaveBeenCalled()
  })

  it('keeps a foreign intent for the signing-in account to sweep, since ownership is unknown here', async () => {
    const foreign = makePendingIntent({action: 'generate', key: 'foreign', userId: 'user-b', createdAt: Date.now()})

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
      const live = makePendingIntent({key: 'live', createdAt: Date.now()})

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
      const clock = Date.now()
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
    const clock = Date.now()
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
    const clock = Date.now()
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
    const sent = makePendingIntent({action, key: 'key-sent', createdAt: Date.now()})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {[action]: sent}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    const restored = useMealPlanStore.getState()
    const replay = resolveKeyedRequest(restored, request, 'user-a', Date.now(), 'key-fresh')

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
      createdAt: Date.now()
    }
    const live = makePendingIntent({action: 'swap', key: 'live', createdAt: Date.now()})

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
