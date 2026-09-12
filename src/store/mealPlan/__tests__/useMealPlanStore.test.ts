import useMealPlanStore, {
  isPendingIntentExpired,
  PENDING_INTENT_TTL_MS,
  PendingIntent,
  PostLogResult,
  resolvePendingIntent,
  selectPersistedState
} from '../useMealPlanStore'

// Mocking the persist adapter instead of AsyncStorage keeps the suite free of native modules, and a
// getItem resolving null makes rehydration a no-op so it can never overwrite a seeded state.
jest.mock('@store/zustandAsyncStorage', () => ({
  zustandAsyncStorage: {getItem: jest.fn(async () => null), setItem: jest.fn(), removeItem: jest.fn()}
}))

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

beforeEach(() => {
  jest.clearAllMocks()
  useMealPlanStore.getState().reset()
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
})

describe('dismissSuccessBanner', () => {
  it('records the dismissed entry without discarding the payload', () => {
    const result = makePostLogResult()

    useMealPlanStore.getState().setPostLogResult(result)
    useMealPlanStore.getState().dismissSuccessBanner(result.entryId)

    expect(useMealPlanStore.getState().dismissedSuccessBannerFor).toBe('entry-1')
    expect(useMealPlanStore.getState().postLogResult).toEqual(result)
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
