import type {NutritionTargets} from '@data/models/NutritionTargets'
import {NO_TARGETS_REVISION} from '@data/models/NutritionTargets'
import {
  buildSaveEstimatedNutritionTargetsPayload,
  buildSaveManualNutritionTargetsPayload,
  confirmedTargetValues,
  hasAnyTargetValue,
  isPlannerConfirmedTargets
} from '@utility/NutritionTargetsUtility'

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 2100, protein: 150, carbs: 220, fat: 70},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 3,
  ...overrides
})

const VALUES = {calories: 1940, protein: 146, carbs: 194, fat: 65}

describe('NO_TARGETS_REVISION', () => {
  it('is the revision a user carries before any target save', () => {
    expect(NO_TARGETS_REVISION).toBe(0)
  })
})

describe('isPlannerConfirmedTargets', () => {
  it('accepts a complete estimated or manual set', () => {
    expect(isPlannerConfirmedTargets(makeTargets())).toBe(true)
    expect(isPlannerConfirmedTargets(makeTargets({source: 'manual'}))).toBe(true)
  })

  it('accepts a stale set, since generation keeps using confirmed values until the user reconfirms', () => {
    expect(isPlannerConfirmedTargets(makeTargets({stale: true}))).toBe(true)
  })

  it('refuses a legacy set, an incomplete set and an absent one', () => {
    expect(isPlannerConfirmedTargets(makeTargets({source: 'legacy'}))).toBe(false)
    expect(isPlannerConfirmedTargets(makeTargets({complete: false}))).toBe(false)
    expect(isPlannerConfirmedTargets(null)).toBe(false)
  })

  it('refuses a source this build cannot read rather than assuming it is acceptable', () => {
    expect(isPlannerConfirmedTargets(makeTargets({source: null}))).toBe(false)
  })
})

describe('hasAnyTargetValue', () => {
  it('reports the figures the server holds, however few', () => {
    expect(hasAnyTargetValue(makeTargets())).toBe(true)
    expect(
      hasAnyTargetValue(
        makeTargets({targets: {calories: 1900, protein: null, carbs: null, fat: null}, complete: false})
      )
    ).toBe(true)
    expect(
      hasAnyTargetValue(makeTargets({targets: {calories: null, protein: 150, carbs: null, fat: null}, complete: false}))
    ).toBe(true)
  })

  it('reports none for an absent record and for one whose every column is unset', () => {
    expect(hasAnyTargetValue(null)).toBe(false)
    expect(hasAnyTargetValue(makeTargets({targets: null, complete: false, source: null}))).toBe(false)
    expect(
      hasAnyTargetValue(
        makeTargets({targets: {calories: null, protein: null, carbs: null, fat: null}, complete: false, source: null})
      )
    ).toBe(false)
  })
})

describe('confirmedTargetValues', () => {
  it('reads the four values of a planner-confirmed set', () => {
    expect(confirmedTargetValues(makeTargets())).toEqual({calories: 2100, protein: 150, carbs: 220, fat: 70})
    expect(confirmedTargetValues(makeTargets({stale: true}))).toEqual({
      calories: 2100,
      protein: 150,
      carbs: 220,
      fat: 70
    })
  })

  it('reads nothing from a set the planner refuses, so no editor treats it as already confirmed', () => {
    expect(confirmedTargetValues(makeTargets({source: 'legacy'}))).toBeNull()
    expect(confirmedTargetValues(makeTargets({source: null}))).toBeNull()
    expect(confirmedTargetValues(null)).toBeNull()
  })

  it('reads nothing when the record claims completeness but a value is missing', () => {
    expect(
      confirmedTargetValues(makeTargets({targets: {calories: 2100, protein: 150, carbs: null, fat: 70}}))
    ).toBeNull()
    expect(confirmedTargetValues(makeTargets({targets: null}))).toBeNull()
  })
})

describe('buildSaveEstimatedNutritionTargetsPayload', () => {
  it('omits the revision pin on a first save', () => {
    const payload = buildSaveEstimatedNutritionTargetsPayload({
      estimateRevision: 9,
      targetsRevision: NO_TARGETS_REVISION
    })

    expect(payload).toEqual({source: 'estimated', estimateRevision: 9})
    expect('expectedTargetsRevision' in payload).toBe(false)
    expect(JSON.stringify(payload)).not.toContain('expectedTargetsRevision')
  })

  it('pins the read revision on every later save', () => {
    expect(buildSaveEstimatedNutritionTargetsPayload({estimateRevision: 9, targetsRevision: 4})).toEqual({
      source: 'estimated',
      estimateRevision: 9,
      expectedTargetsRevision: 4
    })
  })

  it('states no figures of its own, since the server recomputes them', () => {
    const payload = buildSaveEstimatedNutritionTargetsPayload({estimateRevision: 9, targetsRevision: 4})

    expect(Object.keys(payload)).toEqual(['source', 'estimateRevision', 'expectedTargetsRevision'])
  })
})

describe('buildSaveManualNutritionTargetsPayload', () => {
  it('omits the revision pin on a first save', () => {
    const payload = buildSaveManualNutritionTargetsPayload({
      values: VALUES,
      targetsRevision: NO_TARGETS_REVISION
    })

    expect(payload).toEqual({source: 'manual', ...VALUES})
    expect('expectedTargetsRevision' in payload).toBe(false)
    expect(JSON.stringify(payload)).not.toContain('expectedTargetsRevision')
  })

  it('pins the read revision on every later save', () => {
    expect(buildSaveManualNutritionTargetsPayload({values: VALUES, targetsRevision: 7})).toEqual({
      source: 'manual',
      ...VALUES,
      expectedTargetsRevision: 7
    })
  })

  it('states the four figures exactly as given, since the server stores them unchanged', () => {
    const payload = buildSaveManualNutritionTargetsPayload({
      values: {calories: 1200, protein: 1, carbs: 1, fat: 1},
      targetsRevision: 7
    })

    expect(payload).toMatchObject({calories: 1200, protein: 1, carbs: 1, fat: 1})
  })
})
