import {
  MealPlanPreferences,
  MealPlanPreferencesSaveResult,
  SetupStep,
  SetupStepPayload
} from '@data/models/MealPlanPreferences'
import {
  NutritionTargetEstimate,
  NutritionTargets,
  SaveNutritionTargetsPayload,
  SaveNutritionTargetsResult
} from '@data/models/NutritionTargets'

import {
  GenerateRevisionConflict,
  GenerateSequenceCollaborators,
  GenerateSequenceCommitments,
  GeneratingRouteParams,
  NO_GENERATE_COMMITMENTS,
  runGenerateSequence
} from '../index.orchestration'

const START_DATE = '2026-07-06'

const TIME_ZONE = 'America/New_York'

const ESTIMATE_FIGURES = {calories: 2100, protein: 150, carbs: 220, fat: 70}

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {...ESTIMATE_FIGURES},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 4,
  ...overrides
})

// The shape a user who has never confirmed a target reads back as: no figures, so the review card leads with
// the estimate and a Generate press has a confirmation to make.
const makeUnconfirmedTargets = (revision: number): NutritionTargets => ({
  targets: null,
  complete: false,
  source: null,
  stale: false,
  revision
})

const makeEstimate = (overrides: Partial<NutritionTargetEstimate> = {}): NutritionTargetEstimate => ({
  source: 'estimated',
  estimateRevision: 9,
  inputs: {
    age: 34,
    heightCm: 178,
    weightKg: 82,
    sexForEstimate: 'male',
    activityLevel: 'active',
    goal: 'lose',
    paceLbPerWeek: 1
  },
  bmr: 1780,
  tdee: 2760,
  adjustment: -500,
  ...ESTIMATE_FIGURES,
  clamped: false,
  clampReason: null,
  ...overrides
})

const makePreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
  setupStatus: 'ready_for_review',
  setupStep: 'review',
  reviewStartDate: '2026-07-04',
  timeZone: TIME_ZONE,
  targetRoute: 'estimated',
  revision: 7,
  goal: 'lose',
  goalWeightKg: 75,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 178,
  weightKg: 82,
  sexForEstimate: 'male',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'active',
  diet: 'none',
  allergens: ['none'],
  dislikedFoods: [],
  dislikedFoodGroups: [],
  mealSchedule: 'three',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: {amount: 120, currency: 'USD'},
  noBudgetPreference: false,
  budgetTier: 2,
  hasActivePlan: false,
  ...overrides
})

const makeSaveTargetsResult = (revision: number): SaveNutritionTargetsResult => ({
  targets: makeTargets({revision}),
  feasibility: {ok: true, warnings: []}
})

const makeSaveStepResult = (revision: number): MealPlanPreferencesSaveResult => ({
  preferences: makePreferences({revision, reviewStartDate: START_DATE}),
  affectedMealCount: 0
})

// The error shape getApiErrorCode reads: a status with a decodable `{error}` body.
const apiError = (code: string, status = 409): unknown => ({response: {status, data: {error: code}}})

const MINTED_KEY = 'minted-key'

interface Behaviour {
  saveTargets?: (payload: SaveNutritionTargetsPayload) => Promise<SaveNutritionTargetsResult>
  saveSetupStep?: (variables: {step: SetupStep; payload: SetupStepPayload}) => Promise<MealPlanPreferencesSaveResult>
  refetchedTargets?: NutritionTargets | null
  refetchedPreferences?: MealPlanPreferences | null
}

interface Fakes {
  collaborators: GenerateSequenceCollaborators
  // Every collaborator call in the order it happened, which is what pins the ordering rules.
  calls: string[]
  targetsPayloads: SaveNutritionTargetsPayload[]
  stepVariables: {step: SetupStep; payload: SetupStepPayload}[]
  navigations: GeneratingRouteParams[]
  mintedKeys: string[]
}

const makeFakes = (behaviour: Behaviour = {}): Fakes => {
  const calls: string[] = []
  const targetsPayloads: SaveNutritionTargetsPayload[] = []
  const stepVariables: {step: SetupStep; payload: SetupStepPayload}[] = []
  const navigations: GeneratingRouteParams[] = []
  const mintedKeys: string[] = []

  const collaborators: GenerateSequenceCollaborators = {
    saveTargets: payload => {
      calls.push('saveTargets')
      targetsPayloads.push(payload)

      return (behaviour.saveTargets ?? (() => Promise.resolve(makeSaveTargetsResult(11))))(payload)
    },
    saveSetupStep: variables => {
      calls.push('saveSetupStep')
      stepVariables.push(variables)

      return (behaviour.saveSetupStep ?? (() => Promise.resolve(makeSaveStepResult(12))))(variables)
    },
    refetchTargets: () => {
      calls.push('refetchTargets')

      return Promise.resolve(behaviour.refetchedTargets ?? null)
    },
    refetchPreferences: () => {
      calls.push('refetchPreferences')

      return Promise.resolve(behaviour.refetchedPreferences ?? null)
    },
    refetchEstimate: () => {
      calls.push('refetchEstimate')

      return Promise.resolve()
    },
    mintIdempotencyKey: () => {
      calls.push('mintIdempotencyKey')
      mintedKeys.push(MINTED_KEY)

      return MINTED_KEY
    },
    navigateToGenerating: params => {
      calls.push('navigateToGenerating')
      navigations.push(params)
    }
  }

  return {collaborators, calls, targetsPayloads, stepVariables, navigations, mintedKeys}
}

interface RunOverrides {
  targets?: NutritionTargets | null
  estimate?: NutritionTargetEstimate | null
  preferences?: MealPlanPreferences
  startDate?: string
  planStartDate?: string | null
  commitments?: GenerateSequenceCommitments
  keepMineConflict?: GenerateRevisionConflict | null
}

// The default run is the state a first-time setup reaches Review in: no confirmed targets, a live estimate and
// a start date the user moved, so both steps are due.
const run = async (fakes: Fakes, overrides: RunOverrides = {}) =>
  runGenerateSequence({
    targets: overrides.targets === undefined ? makeUnconfirmedTargets(3) : overrides.targets,
    estimate: overrides.estimate === undefined ? makeEstimate() : overrides.estimate,
    preferences: overrides.preferences ?? makePreferences(),
    startDate: overrides.startDate ?? START_DATE,
    planStartDate: overrides.planStartDate ?? null,
    timeZone: TIME_ZONE,
    commitments: overrides.commitments ?? NO_GENERATE_COMMITMENTS,
    keepMineConflict: overrides.keepMineConflict ?? null,
    collaborators: fakes.collaborators
  })

describe('runGenerateSequence ordering', () => {
  it('confirms the targets, then saves the start date, then navigates', async () => {
    const fakes = makeFakes()

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'saveSetupStep', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(outcome.status).toBe('generating')
    expect(fakes.navigations).toEqual([
      {
        context: {kind: 'setup'},
        idempotencyKey: MINTED_KEY,
        expectedPreferencesRevision: 12,
        expectedTargetsRevision: 11,
        startDate: START_DATE
      }
    ])
  })

  it('carries the revisions each save returned rather than the ones read before the press', async () => {
    const fakes = makeFakes({
      saveTargets: () => Promise.resolve(makeSaveTargetsResult(21)),
      saveSetupStep: () => Promise.resolve(makeSaveStepResult(22))
    })

    await run(fakes)

    expect(fakes.navigations[0].expectedTargetsRevision).toBe(21)
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(22)
  })

  it('attempts neither the start-date save nor navigation once the targets save fails', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.reject(apiError('boom', 500))})

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual(['saveTargets'])
    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('does not navigate when the start-date save fails', async () => {
    const fakes = makeFakes({saveSetupStep: () => Promise.reject(apiError('boom', 500))})

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'saveSetupStep'])
    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('keeps the confirmed targets revision after the start-date save fails', async () => {
    const fakes = makeFakes({saveSetupStep: () => Promise.reject(apiError('boom', 500))})

    const outcome = await run(fakes)

    expect(outcome.commitments).toEqual({confirmedTargetsRevision: 11, savedStartDate: null})
  })

  it('sends the review step with the chosen date, the screen time zone and the live revision', async () => {
    const fakes = makeFakes()

    await run(fakes)

    expect(fakes.stepVariables).toEqual([
      {step: 'review', payload: {startDate: START_DATE, timeZone: TIME_ZONE, expectedRevision: 7}}
    ])
  })

  it('skips the start-date save when the row already holds the chosen date', async () => {
    const fakes = makeFakes()

    await run(fakes, {preferences: makePreferences({reviewStartDate: START_DATE})})

    expect(fakes.calls).toEqual(['saveTargets', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(7)
  })

  it('carries the nextWeek context when the route supplied a successor start date', async () => {
    const fakes = makeFakes()

    await run(fakes, {planStartDate: START_DATE})

    expect(fakes.navigations[0].context).toEqual({kind: 'nextWeek', startDate: START_DATE})
  })
})

describe('runGenerateSequence selective retry', () => {
  it('skips the confirmation while the recorded revision is still the live one, and carries it', async () => {
    const fakes = makeFakes()

    const outcome = await run(fakes, {
      targets: makeUnconfirmedTargets(5),
      commitments: {confirmedTargetsRevision: 5, savedStartDate: null}
    })

    expect(fakes.calls).toEqual(['saveSetupStep', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(5)
    expect(outcome.commitments.confirmedTargetsRevision).toBe(5)
  })

  it('carries the fresh revision, not the recorded one, once an edit has moved the targets on', async () => {
    const fakes = makeFakes()

    const outcome = await run(fakes, {
      targets: makeTargets({source: 'manual', revision: 6}),
      commitments: {confirmedTargetsRevision: 5, savedStartDate: null}
    })

    expect(fakes.calls).toEqual(['saveSetupStep', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(6)
    expect(outcome.commitments.confirmedTargetsRevision).toBeNull()
  })

  it('confirms again against the fresh revision when the recorded one is obsolete', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.resolve(makeSaveTargetsResult(7))})

    await run(fakes, {
      targets: makeUnconfirmedTargets(6),
      commitments: {confirmedTargetsRevision: 5, savedStartDate: null}
    })

    expect(fakes.targetsPayloads).toEqual([{source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 6}])
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(7)
  })

  it('skips the start-date save while the recorded save is still the live revision', async () => {
    const fakes = makeFakes()

    const outcome = await run(fakes, {
      commitments: {confirmedTargetsRevision: null, savedStartDate: {date: START_DATE, revision: 7}}
    })

    expect(fakes.calls).toEqual(['saveTargets', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(7)
    expect(outcome.commitments.savedStartDate).toEqual({date: START_DATE, revision: 7})
  })

  it('re-sends the start date pinned to the live revision when another answer has moved it', async () => {
    const fakes = makeFakes()

    await run(fakes, {
      preferences: makePreferences({revision: 8}),
      commitments: {confirmedTargetsRevision: null, savedStartDate: {date: START_DATE, revision: 7}}
    })

    expect(fakes.stepVariables[0].payload).toEqual({
      startDate: START_DATE,
      timeZone: TIME_ZONE,
      expectedRevision: 8
    })
  })

  it('re-sends the start date when the user has chosen a different one since the recorded save', async () => {
    const fakes = makeFakes()

    await run(fakes, {
      startDate: '2026-07-07',
      commitments: {confirmedTargetsRevision: null, savedStartDate: {date: START_DATE, revision: 7}}
    })

    expect(fakes.stepVariables[0].payload).toEqual({
      startDate: '2026-07-07',
      timeZone: TIME_ZONE,
      expectedRevision: 7
    })
  })
})

describe('runGenerateSequence estimate_stale', () => {
  it('refetches the estimate, neither retrying the save nor navigating', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.reject(apiError('estimate_stale'))})

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'refetchEstimate'])
    expect(outcome.status).toBe('estimate_stale')
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })
})

describe('runGenerateSequence rejected targets revision', () => {
  it('resolves silently and continues when the refetched figures equal the asserted estimate', async () => {
    const fakes = makeFakes({
      saveTargets: () => Promise.reject(apiError('stale_targets')),
      refetchedTargets: makeTargets({revision: 9})
    })

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual([
      'saveTargets',
      'refetchTargets',
      'saveSetupStep',
      'mintIdempotencyKey',
      'navigateToGenerating'
    ])
    expect(outcome.status).toBe('generating')
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(9)
    expect(outcome.commitments.confirmedTargetsRevision).toBe(9)
  })

  it('raises a conflict when the refetched figures differ, writing nothing a second time', async () => {
    const fakes = makeFakes({
      saveTargets: () => Promise.reject(apiError('stale_targets')),
      refetchedTargets: makeTargets({targets: {calories: 1800, protein: 140, carbs: 180, fat: 60}, revision: 9})
    })

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'refetchTargets'])
    expect(outcome).toEqual({
      status: 'conflict',
      commitments: NO_GENERATE_COMMITMENTS,
      conflict: {
        step: 'targets',
        payload: {source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 9}
      }
    })
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('raises a conflict rather than assuming the write landed when there is no estimate to compare', async () => {
    const fakes = makeFakes({
      saveTargets: () => Promise.reject(apiError('stale_targets')),
      refetchedTargets: makeTargets({revision: 9})
    })

    const outcome = await run(fakes, {
      // A confirmation is still due from the commitments' point of view, but the estimate the card showed is
      // no longer in hand, so the asserted figures cannot be compared with the refetched ones.
      keepMineConflict: {
        step: 'targets',
        payload: {source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 3}
      },
      estimate: null
    })

    expect(outcome.status).toBe('conflict')
    expect(fakes.navigations).toHaveLength(0)
  })

  it('fails rather than prompting when the refetch yields no targets to compare', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.reject(apiError('stale_targets')), refetchedTargets: null})

    const outcome = await run(fakes)

    expect(outcome.status).toBe('failed')
    expect(fakes.calls).toEqual(['saveTargets', 'refetchTargets'])
  })

  it('re-sends the refused confirmation against the refetched revision when the user keeps theirs', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.resolve(makeSaveTargetsResult(10))})
    const conflict: GenerateRevisionConflict = {
      step: 'targets',
      payload: {source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 9}
    }

    const outcome = await run(fakes, {
      // The refetch has already replaced the card with the server's own figures; a re-derived plan would ask
      // for no confirmation at all, so only the answered conflict can re-assert the user's estimate.
      targets: makeTargets({source: 'manual', revision: 9}),
      keepMineConflict: conflict
    })

    expect(fakes.targetsPayloads).toEqual([conflict.payload])
    expect(outcome.status).toBe('generating')
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(10)
  })
})

describe('runGenerateSequence rejected preferences revision', () => {
  it('resolves silently and navigates when the refetched row already holds the chosen date', async () => {
    const fakes = makeFakes({
      saveSetupStep: () => Promise.reject(apiError('stale_revision')),
      refetchedPreferences: makePreferences({reviewStartDate: START_DATE, revision: 13})
    })

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual([
      'saveTargets',
      'saveSetupStep',
      'refetchPreferences',
      'mintIdempotencyKey',
      'navigateToGenerating'
    ])
    expect(outcome.status).toBe('generating')
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(13)
  })

  it('raises a conflict carrying the value "Use theirs" adopts when the refetched date differs', async () => {
    const fakes = makeFakes({
      saveSetupStep: () => Promise.reject(apiError('stale_revision')),
      refetchedPreferences: makePreferences({reviewStartDate: '2026-07-09', revision: 13})
    })

    const outcome = await run(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'saveSetupStep', 'refetchPreferences'])
    expect(outcome).toEqual({
      status: 'conflict',
      commitments: {confirmedTargetsRevision: 11, savedStartDate: null},
      conflict: {
        step: 'startDate',
        startDate: START_DATE,
        expectedRevision: 13,
        theirStartDate: '2026-07-09'
      }
    })
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('re-sends the chosen date against the refetched revision when the user keeps theirs', async () => {
    const fakes = makeFakes()

    const outcome = await run(fakes, {
      // The refetched row now holds the other device's date, so the plan would no longer ask for this save on
      // its own: the answered conflict is what re-sends it, pinned to the revision the refetch reported.
      preferences: makePreferences({reviewStartDate: '2026-07-09', revision: 13}),
      commitments: {confirmedTargetsRevision: null, savedStartDate: null},
      keepMineConflict: {
        step: 'startDate',
        startDate: START_DATE,
        expectedRevision: 13,
        theirStartDate: '2026-07-09'
      }
    })

    expect(fakes.stepVariables[0].payload).toEqual({
      startDate: START_DATE,
      timeZone: TIME_ZONE,
      expectedRevision: 13
    })
    expect(outcome.status).toBe('generating')
  })

  it('fails rather than prompting when the refetch yields no preferences to compare', async () => {
    const fakes = makeFakes({
      saveSetupStep: () => Promise.reject(apiError('stale_revision')),
      refetchedPreferences: null
    })

    const outcome = await run(fakes)

    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
  })
})

describe('runGenerateSequence idempotency key', () => {
  it('mints the key inside the navigating call, after both saves have settled', async () => {
    const fakes = makeFakes()

    await run(fakes)

    expect(fakes.calls.indexOf('mintIdempotencyKey')).toBe(fakes.calls.indexOf('navigateToGenerating') - 1)
    expect(fakes.calls.indexOf('mintIdempotencyKey')).toBeGreaterThan(fakes.calls.indexOf('saveSetupStep'))
    expect(fakes.mintedKeys).toEqual([MINTED_KEY])
  })

  it('mints one key per navigating run and none for a run that navigates nowhere', async () => {
    const navigating = makeFakes()
    const failing = makeFakes({saveTargets: () => Promise.reject(apiError('boom', 500))})

    await run(navigating)
    await run(navigating)
    await run(failing)

    expect(navigating.mintedKeys).toHaveLength(2)
    expect(failing.mintedKeys).toHaveLength(0)
  })
})
