import {zustandAsyncStorage} from '@store/zustandAsyncStorage'

import useMealPlanStore, {
  isPendingIntentExpired,
  PENDING_INTENT_TTL_MS,
  PendingIntent,
  PostLogResult,
  prunePendingIntentsForUser,
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

const persistedReads = zustandAsyncStorage.getItem as jest.Mock
const persistedWrites = zustandAsyncStorage.setItem as jest.Mock

const NOW = 1_760_000_000_000

const makePendingIntent = (overrides: Partial<PendingIntent> = {}): PendingIntent => ({
  userId: 'user-a',
  key: 'key-1',
  fingerprint: 'fp-1',
  planId: 'plan-1',
  planRevision: 3,
  createdAt: NOW,
  ...overrides
})

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
      pendingIntents: {generate: makePendingIntent()}
    })

    expect(Object.keys(selectPersistedState(useMealPlanStore.getState()))).toEqual(['pendingIntents'])
  })

  it('passes the recorded intents through unchanged', () => {
    const intent = makePendingIntent({key: 'key-9'})

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
      const foreign = makePendingIntent({userId: 'user-b'})

      expect(selectPrunedPendingIntents({generate: foreign}, NOW, 'user-a')).toEqual({})
    })

    it('keeps an intent for any account when ownership is unknown at the call site', () => {
      const foreign = makePendingIntent({userId: 'user-b'})

      expect(selectPrunedPendingIntents({generate: foreign}, NOW, null)).toEqual({generate: foreign})
    })

    it('removes an expired intent even when ownership is unknown', () => {
      const expired = makePendingIntent({userId: 'user-b', createdAt: NOW - PENDING_INTENT_TTL_MS})

      expect(selectPrunedPendingIntents({generate: expired}, NOW, null)).toEqual({})
    })
  })

  it('returns the very same object when every intent is live and owned', () => {
    const pendingIntents = {generate: makePendingIntent({key: 'key-1'}), log: makePendingIntent({key: 'key-2'})}

    expect(selectPrunedPendingIntents(pendingIntents, NOW, 'user-a')).toBe(pendingIntents)
  })

  it('keeps only the live owned entries and leaves the input untouched', () => {
    const expired = makePendingIntent({key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b'})
    const live = makePendingIntent({key: 'live'})
    const pendingIntents = {generate: expired, swap: foreign, log: live}

    expect(selectPrunedPendingIntents(pendingIntents, NOW, 'user-a')).toEqual({log: live})
    expect(pendingIntents).toEqual({generate: expired, swap: foreign, log: live})
  })
})

describe('resolvePendingIntent', () => {
  describe('user scoping', () => {
    it('returns the intent recorded for the resolving user', () => {
      const intent = makePendingIntent({userId: 'user-a'})

      expect(resolvePendingIntent({pendingIntents: {generate: intent}}, 'generate', 'user-a', NOW)).toEqual(intent)
    })

    it('returns null for a different user', () => {
      const intent = makePendingIntent({userId: 'user-a'})

      expect(resolvePendingIntent({pendingIntents: {generate: intent}}, 'generate', 'user-b', NOW)).toBeNull()
    })
  })

  describe('missing intents', () => {
    it('returns null when another action holds the only intent', () => {
      const intent = makePendingIntent()

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
  it('writes the intent under the action it was minted for', () => {
    const intent = makePendingIntent()

    useMealPlanStore.getState().recordPendingIntent('log', intent)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: intent})
  })

  it('keeps intents recorded for other actions', () => {
    const generate = makePendingIntent({key: 'key-1'})
    const swap = makePendingIntent({key: 'key-2'})

    useMealPlanStore.getState().recordPendingIntent('generate', generate)
    useMealPlanStore.getState().recordPendingIntent('swap', swap)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate, swap})
  })

  it('sweeps an expired and a foreign sibling while keeping the live one for the same account', () => {
    const expired = makePendingIntent({key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b'})
    const live = makePendingIntent({key: 'live', createdAt: NOW - 1})
    const incoming = makePendingIntent({key: 'incoming', createdAt: NOW})

    useMealPlanStore.setState({pendingIntents: {generate: expired, swap: foreign, regenerate: live}})
    useMealPlanStore.getState().recordPendingIntent('log', incoming)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({regenerate: live, log: incoming})
  })

  it('keeps the incoming intent even when it replaces a foreign entry under the same action', () => {
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b'})
    const incoming = makePendingIntent({key: 'incoming'})

    useMealPlanStore.setState({pendingIntents: {log: foreign}})
    useMealPlanStore.getState().recordPendingIntent('log', incoming)

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: incoming})
  })
})

describe('prunePendingIntents', () => {
  it('removes the stale entries and persists the pruned slice', () => {
    const expired = makePendingIntent({key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b'})
    const live = makePendingIntent({key: 'live'})

    useMealPlanStore.setState({pendingIntents: {generate: expired, swap: foreign, log: live}})
    persistedWrites.mockClear()
    useMealPlanStore.getState().prunePendingIntents(NOW, 'user-a')

    expect(useMealPlanStore.getState().pendingIntents).toEqual({log: live})
    expect(persistedWrites).toHaveBeenCalledTimes(1)
    expect(persistedWrites.mock.calls[0][0]).toBe('meal-plan-store')
  })

  it('prunes by age alone when the signed-in account is unknown', () => {
    const expired = makePendingIntent({key: 'expired', createdAt: NOW - PENDING_INTENT_TTL_MS})
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b'})

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
    const expired = makePendingIntent({key: 'expired', createdAt: Date.now() - PENDING_INTENT_TTL_MS})

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
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b', createdAt: Date.now()})

    persistedReads.mockResolvedValueOnce({state: {pendingIntents: {generate: foreign}}, version: 0})

    await useMealPlanStore.persist.rehydrate()

    expect(useMealPlanStore.getState().pendingIntents).toEqual({generate: foreign})
  })
})

describe('prunePendingIntentsForUser', () => {
  it('removes a record minted by another account and rewrites the persisted slice', async () => {
    const clock = Date.now()
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b', createdAt: clock})
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
    const foreign = makePendingIntent({key: 'foreign', userId: 'user-b', createdAt: clock})
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
    const expired = makePendingIntent({userId: 'user-a', createdAt: NOW - PENDING_INTENT_TTL_MS})

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
    const generate = makePendingIntent({key: 'key-1'})
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
      pendingIntents: {generate: makePendingIntent(), swap: makePendingIntent({key: 'key-2'})}
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
})
