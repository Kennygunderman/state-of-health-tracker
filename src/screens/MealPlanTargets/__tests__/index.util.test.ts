import {MealPlanPreferences} from '@data/models/MealPlanPreferences'
import {NutritionTargetEstimate, NutritionTargets} from '@data/models/NutritionTargets'
import {poundsToKilograms} from '@utility/UnitConversionUtility'

import {
  MEAL_PLAN_ANSWER_DIET_LABEL,
  MEAL_PLAN_ANSWER_MEALS_LABEL,
  MEAL_PLAN_CHOSEN_TARGETS_CAPTION,
  MEAL_PLAN_CHOSEN_TARGETS_OVERLINE,
  MEAL_PLAN_DAILY_TARGETS_OVERLINE,
  MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
  MEAL_PLAN_EDIT_LINK_TEXT,
  MEAL_PLAN_GENERATE_BUTTON_TEXT,
  MEAL_PLAN_GOAL_ROW_LABEL,
  MEAL_PLAN_KCAL_UNIT,
  MEAL_PLAN_MACRO_LABELS,
  MEAL_PLAN_MAX_COOKING_TIME_ROW_LABEL,
  MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL,
  MEAL_PLAN_RECALCULATE_LINK_TEXT,
  MEAL_PLAN_START_DATE_TODAY_LABEL,
  MEAL_PLAN_START_DATE_TOMORROW_LABEL,
  MEAL_PLAN_TARGETS_CAPTION,
  MEAL_PLAN_VALUE_NONE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL
} from '@constants/strings'

import {
  advanceGenerateProgress,
  buildAnswerRows,
  buildTargetConfirmationPayload,
  GenerateSequencePlan,
  GenerateSequenceProgress,
  GenerateSequenceStepKind,
  NavigateToGeneratingStep,
  nextGenerateStep,
  NO_GENERATE_PROGRESS,
  NO_TARGETS_REVISION,
  planGenerateSequence,
  resolveDisplayedTargets,
  resolveGenerateCtaState,
  resolveInitialStartDate,
  resolveStartDateStepState,
  StartDateStepState
} from '../index.util'

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 2100, protein: 150, carbs: 220, fat: 70},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 4,
  ...overrides
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
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  clamped: false,
  clampReason: null,
  ...overrides
})

const makePreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
  setupStatus: 'ready_for_review',
  setupStep: 'review',
  reviewStartDate: '2026-07-04',
  timeZone: 'America/New_York',
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
  dislikedFoods: [{id: 'food-1', name: 'Olives', foodGroup: 'Vegetables'}],
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

// The preferences model types allergens as string[] and the decoder validates them as io.array(io.string), so
// these codes reach the label map with no cast anywhere. The goal and diet casts model a server that sent a code
// the narrow union does not contain.
const UNKNOWN_ALLERGEN_CODE = 'unobtainium'
const PROTOTYPE_ALLERGEN_CODES = ['constructor', 'toString', '__proto__', 'valueOf']
const PROTOTYPE_GOAL = 'toString' as unknown as MealPlanPreferences['goal']
const PROTOTYPE_DIET = 'constructor' as unknown as MealPlanPreferences['diet']
const INHERITED_MEMBER_TEXT = /function|\[object|native code/i

// A press with confirmed targets by default: nothing to confirm, nothing to save, and no dependence on the
// estimate query. Every case that needs another shape states the difference.
const makePlan = (overrides: Partial<GenerateSequencePlan> = {}): GenerateSequencePlan => ({
  requiresTargetConfirmation: false,
  requiresStartDateSave: false,
  dependsOnEstimate: false,
  startDate: '2026-07-04',
  estimateRevision: 9,
  expectedTargetsRevision: 4,
  expectedPreferencesRevision: 7,
  blockedReason: null,
  ...overrides
})

// What each save returns, and where this press fails. The revisions differ from the ones the plan was read
// with, so a navigation carrying a pre-save revision is visible rather than coincidentally equal.
interface PressServer {
  targetsRevision: number
  preferencesRevision: number
  failAt?: GenerateSequenceStepKind
}

interface PressRun {
  derived: GenerateSequenceStepKind[]
  completed: GenerateSequenceStepKind[]
  failedAt: GenerateSequenceStepKind | null
  navigated: NavigateToGeneratingStep | null
  progress: GenerateSequenceProgress
}

const CONFIRMED_TARGETS_REVISION = 5

const SAVED_REVIEW_DATE_REVISION = 8

// One Generate press, driven exactly as the screen drives it: derive the next step, execute it, record what it
// returned, derive again. A press that never reaches a terminal step is a defect, so the loop is bounded and
// throws rather than hanging.
const MAX_PRESS_DERIVATIONS = 4

const runGeneratePress = (
  plan: GenerateSequencePlan,
  server: PressServer,
  startingProgress: GenerateSequenceProgress = NO_GENERATE_PROGRESS
): PressRun => {
  const run: PressRun = {derived: [], completed: [], failedAt: null, navigated: null, progress: startingProgress}

  for (let derivation = 0; derivation < MAX_PRESS_DERIVATIONS; derivation += 1) {
    const step = nextGenerateStep(plan, run.progress)

    if (step === null) {
      return run
    }

    run.derived.push(step.kind)

    if (server.failAt === step.kind) {
      run.failedAt = step.kind

      return run
    }

    run.completed.push(step.kind)

    if (step.kind === 'confirm_targets') {
      run.progress = advanceGenerateProgress(run.progress, {
        kind: 'confirm_targets',
        targetsRevision: server.targetsRevision
      })
    } else if (step.kind === 'save_review_date') {
      run.progress = advanceGenerateProgress(run.progress, {
        kind: 'save_review_date',
        preferencesRevision: server.preferencesRevision
      })
    } else {
      run.navigated = step

      return run
    }
  }

  throw new Error('the Generate press never reached a terminal step')
}

const workingServer: PressServer = {
  targetsRevision: CONFIRMED_TARGETS_REVISION,
  preferencesRevision: SAVED_REVIEW_DATE_REVISION
}

describe('NO_TARGETS_REVISION', () => {
  it('is the revision a user with no preferences row carries', () => {
    expect(NO_TARGETS_REVISION).toBe(0)
  })
})

describe('planGenerateSequence', () => {
  it('asks for no confirmation when the targets are complete, non-legacy and fresh', () => {
    const plan = planGenerateSequence({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.blockedReason).toBeNull()
  })

  it('asks for no confirmation for a complete, fresh manual set', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({source: 'manual'}),
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.blockedReason).toBeNull()
  })

  it('confirms the estimate when the account has confirmed nothing of its own', () => {
    const plan = planGenerateSequence({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(true)
    expect(plan.blockedReason).toBeNull()
    expect(buildTargetConfirmationPayload(plan)).toEqual({source: 'estimated', estimateRevision: 9})
  })

  it('confirms the recalculated estimate when the confirmed set has gone stale', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({stale: true, revision: 4}),
      estimate: makeEstimate({estimateRevision: 9}),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(true)
    expect(plan.blockedReason).toBeNull()
    expect(buildTargetConfirmationPayload(plan)).toEqual({
      source: 'estimated',
      estimateRevision: 9,
      expectedTargetsRevision: 4
    })
  })

  it('carries the revision a stale confirmation returns into generation rather than the one it replaced', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({stale: true, revision: 4}),
      estimate: makeEstimate(),
      preferences: makePreferences({reviewStartDate: '2026-07-04'}),
      startDate: '2026-07-04'
    })
    const press = runGeneratePress(plan, workingServer)

    expect(press.completed).toEqual(['confirm_targets', 'navigate'])
    expect(press.navigated).toEqual({
      kind: 'navigate',
      startDate: '2026-07-04',
      expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
      expectedPreferencesRevision: 7
    })
    expect(press.navigated?.expectedTargetsRevision).not.toBe(4)
  })

  it('confirms the reviewed estimate for every saved set generation would refuse', () => {
    const planFor = (targets: NutritionTargets | null): GenerateSequencePlan =>
      planGenerateSequence({
        targets,
        estimate: makeEstimate({estimateRevision: 9}),
        preferences: makePreferences(),
        startDate: '2026-07-04'
      })
    const refusedBases: NutritionTargets[] = [
      makeTargets({source: 'legacy', revision: 3}),
      makeTargets({targets: {calories: 2100, protein: 150, carbs: null, fat: 70}, complete: false, revision: 3}),
      makeTargets({targets: {calories: 1900, protein: null, carbs: null, fat: null}, complete: false, revision: 3}),
      makeTargets({source: null, revision: 3}),
      // A response claiming completeness while holding a null value: still not a set generation accepts.
      makeTargets({targets: {calories: 2100, protein: 150, carbs: null, fat: 70}, revision: 3})
    ]

    refusedBases.forEach(targets => {
      const plan = planFor(targets)

      expect(plan.requiresTargetConfirmation).toBe(true)
      expect(plan.blockedReason).toBeNull()
      expect(buildTargetConfirmationPayload(plan)).toEqual({
        source: 'estimated',
        estimateRevision: 9,
        expectedTargetsRevision: 3
      })
    })
  })

  it('never asks for a confirmation the press could not state', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({source: 'legacy'}),
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(buildTargetConfirmationPayload(plan)).toBeNull()
    expect(nextGenerateStep(plan)).toBeNull()
  })

  it('confirms nothing the card does not lead with, in every target state', () => {
    const states: (NutritionTargets | null)[] = [
      null,
      makeTargets(),
      makeTargets({stale: true}),
      makeTargets({source: 'legacy'}),
      makeTargets({source: null}),
      makeTargets({complete: false}),
      makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      makeTargets({targets: null, complete: false, source: null})
    ]

    states.forEach(targets => {
      const inputs = {targets, estimate: makeEstimate(), preferences: makePreferences(), startDate: '2026-07-04'}
      const plan = planGenerateSequence(inputs)
      const display = resolveDisplayedTargets(inputs)

      expect(plan.requiresTargetConfirmation).toBe(display.source === 'estimate')
    })
  })

  it('blocks only when neither a confirmed set nor an estimate exists', () => {
    const planWithoutEstimate = (targets: NutritionTargets | null): GenerateSequencePlan =>
      planGenerateSequence({targets, estimate: null, preferences: makePreferences(), startDate: '2026-07-04'})

    expect(planWithoutEstimate(null).blockedReason).toBe('estimate_unavailable')
    expect(planWithoutEstimate(makeTargets({targets: null, complete: false, source: null})).blockedReason).toBe(
      'estimate_unavailable'
    )
    expect(planWithoutEstimate(makeTargets({stale: true})).blockedReason).toBe('estimate_unavailable')
    expect(planWithoutEstimate(makeTargets({source: 'legacy'})).blockedReason).toBe('estimate_unavailable')
    expect(planWithoutEstimate(makeTargets()).blockedReason).toBeNull()
    expect(planWithoutEstimate(makeTargets({source: 'manual'})).blockedReason).toBeNull()
  })

  it('depends on the estimate in every state except a confirmed set', () => {
    const dependsFor = (
      targets: NutritionTargets | null,
      estimate: NutritionTargetEstimate | null = makeEstimate()
    ): boolean =>
      planGenerateSequence({targets, estimate, preferences: makePreferences(), startDate: '2026-07-04'})
        .dependsOnEstimate

    expect(dependsFor(makeTargets())).toBe(false)
    expect(dependsFor(makeTargets({source: 'manual'}))).toBe(false)
    expect(dependsFor(makeTargets(), null)).toBe(false)
    expect(dependsFor(null)).toBe(true)
    expect(dependsFor(null, null)).toBe(true)
    expect(dependsFor(makeTargets({stale: true}))).toBe(true)
    expect(dependsFor(makeTargets({source: 'legacy'}))).toBe(true)
    expect(dependsFor(makeTargets({complete: false}))).toBe(true)
  })

  it('threads the estimate, revision and start-date inputs the caller must send with each save', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({revision: 6}),
      estimate: makeEstimate({estimateRevision: 12}),
      preferences: makePreferences({revision: 11}),
      startDate: '2026-07-09'
    })

    expect(plan.estimateRevision).toBe(12)
    expect(plan.expectedTargetsRevision).toBe(6)
    expect(plan.expectedPreferencesRevision).toBe(11)
    expect(plan.startDate).toBe('2026-07-09')
  })

  it('carries no estimate revision and the no-targets revision for a first-time account', () => {
    const plan = planGenerateSequence({
      targets: null,
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    expect(plan.estimateRevision).toBeNull()
    expect(plan.expectedTargetsRevision).toBe(NO_TARGETS_REVISION)
  })

  it('saves the start date only when it differs from the persisted review date', () => {
    const startDateSaveFor = (reviewStartDate: string | null, startDate: string): boolean =>
      planGenerateSequence({
        targets: makeTargets(),
        estimate: makeEstimate(),
        preferences: makePreferences({reviewStartDate}),
        startDate
      }).requiresStartDateSave

    expect(startDateSaveFor('2026-07-04', '2026-07-10')).toBe(true)
    expect(startDateSaveFor(null, '2026-07-04')).toBe(true)
    expect(startDateSaveFor('2026-07-04', '2026-07-04')).toBe(false)
  })
})

describe('buildTargetConfirmationPayload', () => {
  const planFor = (targets: NutritionTargets | null): GenerateSequencePlan =>
    planGenerateSequence({
      targets,
      estimate: makeEstimate({estimateRevision: 12}),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

  it('omits the revision pin on a first save, rather than pinning a revision that does not exist', () => {
    const payload = buildTargetConfirmationPayload(planFor(null))

    expect(payload).toEqual({source: 'estimated', estimateRevision: 12})
    expect(payload !== null && 'expectedTargetsRevision' in payload).toBe(false)
    expect(JSON.stringify(payload)).not.toContain('expectedTargetsRevision')
  })

  it('pins the revision a preferences row reports even when it holds no target figures', () => {
    const payload = buildTargetConfirmationPayload(planFor(makeTargets({targets: null, complete: false, revision: 5})))

    expect(payload).toEqual({source: 'estimated', estimateRevision: 12, expectedTargetsRevision: 5})
  })

  it('carries no figures of its own, since the server recomputes them', () => {
    const payload = buildTargetConfirmationPayload(planFor(null))
    const members = payload === null ? [] : Object.keys(payload)

    expect(members).not.toContain('calories')
    expect(members).not.toContain('protein')
    expect(members).not.toContain('carbs')
    expect(members).not.toContain('fat')
  })

  it('builds nothing for a press that confirms nothing', () => {
    expect(buildTargetConfirmationPayload(makePlan())).toBeNull()
    expect(
      buildTargetConfirmationPayload(makePlan({requiresTargetConfirmation: true, estimateRevision: null}))
    ).toBeNull()
  })
})

describe('nextGenerateStep', () => {
  const fullPress = makePlan({
    requiresTargetConfirmation: true,
    requiresStartDateSave: true,
    dependsOnEstimate: true,
    startDate: '2026-07-09',
    estimateRevision: 9,
    expectedTargetsRevision: 4,
    expectedPreferencesRevision: 7
  })

  it('starts a press with no step recorded as complete', () => {
    expect(NO_GENERATE_PROGRESS).toEqual({confirmedTargetsRevision: null, savedReviewDateRevision: null})
    expect(nextGenerateStep(fullPress)).toEqual(nextGenerateStep(fullPress, NO_GENERATE_PROGRESS))
  })

  it('derives the confirmation first, carrying the body that replaces the reviewed targets', () => {
    expect(nextGenerateStep(fullPress)).toEqual({
      kind: 'confirm_targets',
      payload: {source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 4}
    })
  })

  it('derives the review-date save once the confirmation has landed', () => {
    const progress = advanceGenerateProgress(NO_GENERATE_PROGRESS, {
      kind: 'confirm_targets',
      targetsRevision: CONFIRMED_TARGETS_REVISION
    })

    expect(nextGenerateStep(fullPress, progress)).toEqual({
      kind: 'save_review_date',
      startDate: '2026-07-09',
      expectedRevision: 7
    })
  })

  it('never derives the navigation while a save it would outrun is still outstanding', () => {
    const afterConfirmation = advanceGenerateProgress(NO_GENERATE_PROGRESS, {
      kind: 'confirm_targets',
      targetsRevision: CONFIRMED_TARGETS_REVISION
    })
    const afterDateSave = advanceGenerateProgress(NO_GENERATE_PROGRESS, {
      kind: 'save_review_date',
      preferencesRevision: SAVED_REVIEW_DATE_REVISION
    })

    expect(nextGenerateStep(fullPress, NO_GENERATE_PROGRESS)?.kind).toBe('confirm_targets')
    expect(nextGenerateStep(fullPress, afterConfirmation)?.kind).toBe('save_review_date')
    expect(nextGenerateStep(fullPress, afterDateSave)?.kind).toBe('confirm_targets')
  })

  it('navigates only once every save of this press has returned', () => {
    const bothSaved: GenerateSequenceProgress = {
      confirmedTargetsRevision: CONFIRMED_TARGETS_REVISION,
      savedReviewDateRevision: SAVED_REVIEW_DATE_REVISION
    }

    expect(nextGenerateStep(fullPress, bothSaved)).toEqual({
      kind: 'navigate',
      startDate: '2026-07-09',
      expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
      expectedPreferencesRevision: SAVED_REVIEW_DATE_REVISION
    })
  })

  it('navigates straight away with the read revisions when this press saves nothing', () => {
    expect(nextGenerateStep(makePlan({startDate: '2026-07-04'}))).toEqual({
      kind: 'navigate',
      startDate: '2026-07-04',
      expectedTargetsRevision: 4,
      expectedPreferencesRevision: 7
    })
  })

  it('derives nothing for a blocked press, so it can never generate', () => {
    const blocked = planGenerateSequence({
      targets: null,
      estimate: null,
      preferences: makePreferences({reviewStartDate: '2026-07-04'}),
      startDate: '2026-07-09'
    })

    expect(blocked.blockedReason).toBe('estimate_unavailable')
    expect(nextGenerateStep(blocked)).toBeNull()
    expect(nextGenerateStep(makePlan({blockedReason: 'estimate_unavailable'}))).toBeNull()
  })

  it('derives nothing when a required confirmation cannot be stated', () => {
    const unstatable = makePlan({
      requiresTargetConfirmation: true,
      requiresStartDateSave: true,
      dependsOnEstimate: true,
      estimateRevision: null
    })

    expect(nextGenerateStep(unstatable)).toBeNull()
  })

  describe('one uninterrupted press', () => {
    it('confirms the targets, saves the changed review date, then navigates with the revisions those saves returned', () => {
      const press = runGeneratePress(fullPress, workingServer)

      expect(press.derived).toEqual(['confirm_targets', 'save_review_date', 'navigate'])
      expect(press.completed).toEqual(['confirm_targets', 'save_review_date', 'navigate'])
      expect(press.failedAt).toBeNull()
      expect(press.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-09',
        expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
        expectedPreferencesRevision: SAVED_REVIEW_DATE_REVISION
      })
      expect(press.navigated?.expectedTargetsRevision).not.toBe(fullPress.expectedTargetsRevision)
      expect(press.navigated?.expectedPreferencesRevision).not.toBe(fullPress.expectedPreferencesRevision)
    })

    it('confirms a stale set and generates against the revision that confirmation returned', () => {
      const plan = planGenerateSequence({
        targets: makeTargets({stale: true, revision: 4}),
        estimate: makeEstimate({estimateRevision: 9}),
        preferences: makePreferences({reviewStartDate: '2026-07-04', revision: 7}),
        startDate: '2026-07-09'
      })
      const press = runGeneratePress(plan, workingServer)

      expect(press.derived).toEqual(['confirm_targets', 'save_review_date', 'navigate'])
      expect(press.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-09',
        expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
        expectedPreferencesRevision: SAVED_REVIEW_DATE_REVISION
      })
    })

    it('saves only the review date for a set generation already accepts', () => {
      const confirmed = planGenerateSequence({
        targets: makeTargets({revision: 4}),
        estimate: makeEstimate(),
        preferences: makePreferences({reviewStartDate: '2026-07-04', revision: 7}),
        startDate: '2026-07-09'
      })
      const press = runGeneratePress(confirmed, workingServer)

      expect(press.derived).toEqual(['save_review_date', 'navigate'])
      expect(press.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-09',
        expectedTargetsRevision: 4,
        expectedPreferencesRevision: SAVED_REVIEW_DATE_REVISION
      })
    })

    it('saves nothing for a manual set on an unchanged date', () => {
      const manual = planGenerateSequence({
        targets: makeTargets({source: 'manual', revision: 4}),
        estimate: null,
        preferences: makePreferences({reviewStartDate: '2026-07-04', revision: 7}),
        startDate: '2026-07-04'
      })
      const press = runGeneratePress(manual, workingServer)

      expect(press.derived).toEqual(['navigate'])
      expect(press.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-04',
        expectedTargetsRevision: 4,
        expectedPreferencesRevision: 7
      })
    })

    it('confirms the estimate without a date save when the chosen date is already persisted', () => {
      const unchangedDate = planGenerateSequence({
        targets: null,
        estimate: makeEstimate({estimateRevision: 9}),
        preferences: makePreferences({reviewStartDate: '2026-07-04', revision: 7}),
        startDate: '2026-07-04'
      })
      const press = runGeneratePress(unchangedDate, workingServer)

      expect(press.derived).toEqual(['confirm_targets', 'navigate'])
      expect(press.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-04',
        expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
        expectedPreferencesRevision: 7
      })
    })

    it('derives and completes nothing when the press is blocked', () => {
      const blocked = makePlan({dependsOnEstimate: true, blockedReason: 'estimate_unavailable'})
      const press = runGeneratePress(blocked, workingServer)

      expect(press.derived).toEqual([])
      expect(press.completed).toEqual([])
      expect(press.navigated).toBeNull()
      expect(press.progress).toEqual(NO_GENERATE_PROGRESS)
    })
  })

  describe('a press that failed partway', () => {
    it('stops at a failed confirmation without navigating, and the retry re-derives it', () => {
      const failed = runGeneratePress(fullPress, {...workingServer, failAt: 'confirm_targets'})

      expect(failed.derived).toEqual(['confirm_targets'])
      expect(failed.completed).toEqual([])
      expect(failed.failedAt).toBe('confirm_targets')
      expect(failed.navigated).toBeNull()
      expect(failed.progress).toEqual(NO_GENERATE_PROGRESS)

      const retry = runGeneratePress(fullPress, workingServer, failed.progress)

      expect(retry.completed).toEqual(['confirm_targets', 'save_review_date', 'navigate'])
      expect(retry.navigated?.expectedTargetsRevision).toBe(CONFIRMED_TARGETS_REVISION)
    })

    it('stops at a failed review-date save, and the retry skips the confirmation that already landed', () => {
      const failed = runGeneratePress(fullPress, {...workingServer, failAt: 'save_review_date'})

      expect(failed.derived).toEqual(['confirm_targets', 'save_review_date'])
      expect(failed.completed).toEqual(['confirm_targets'])
      expect(failed.failedAt).toBe('save_review_date')
      expect(failed.navigated).toBeNull()
      expect(failed.progress.confirmedTargetsRevision).toBe(CONFIRMED_TARGETS_REVISION)

      const retry = runGeneratePress(fullPress, workingServer, failed.progress)

      expect(retry.derived).toEqual(['save_review_date', 'navigate'])
      expect(retry.completed).not.toContain('confirm_targets')
      expect(retry.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-09',
        expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
        expectedPreferencesRevision: SAVED_REVIEW_DATE_REVISION
      })
    })

    it('repeats neither save when the navigation itself could not complete', () => {
      const failed = runGeneratePress(fullPress, {...workingServer, failAt: 'navigate'})

      expect(failed.completed).toEqual(['confirm_targets', 'save_review_date'])
      expect(failed.failedAt).toBe('navigate')
      expect(failed.navigated).toBeNull()

      const retry = runGeneratePress(fullPress, workingServer, failed.progress)

      expect(retry.derived).toEqual(['navigate'])
      expect(retry.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-09',
        expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
        expectedPreferencesRevision: SAVED_REVIEW_DATE_REVISION
      })
    })

    it('performs every write exactly once across the failure and its retry, whichever step failed', () => {
      const failurePositions: GenerateSequenceStepKind[] = ['confirm_targets', 'save_review_date', 'navigate']

      failurePositions.forEach(failAt => {
        const failed = runGeneratePress(fullPress, {...workingServer, failAt})
        const retry = runGeneratePress(fullPress, workingServer, failed.progress)
        const writes = [...failed.completed, ...retry.completed]

        expect(writes.filter(kind => kind === 'confirm_targets')).toHaveLength(1)
        expect(writes.filter(kind => kind === 'save_review_date')).toHaveLength(1)
        expect(retry.navigated).not.toBeNull()
      })
    })

    it('does not bump the target revision a second time once the refetched targets report the confirmation', () => {
      const afterServerRefetch = planGenerateSequence({
        targets: makeTargets({source: 'estimated', stale: false, revision: CONFIRMED_TARGETS_REVISION}),
        estimate: makeEstimate(),
        preferences: makePreferences({reviewStartDate: '2026-07-09'}),
        startDate: '2026-07-09'
      })
      const press = runGeneratePress(afterServerRefetch, workingServer)

      expect(afterServerRefetch.requiresTargetConfirmation).toBe(false)
      expect(press.derived).toEqual(['navigate'])
      expect(press.navigated).toEqual({
        kind: 'navigate',
        startDate: '2026-07-09',
        expectedTargetsRevision: CONFIRMED_TARGETS_REVISION,
        expectedPreferencesRevision: 7
      })
    })
  })
})

describe('advanceGenerateProgress', () => {
  it('records the targets revision a confirmation returned', () => {
    expect(advanceGenerateProgress(NO_GENERATE_PROGRESS, {kind: 'confirm_targets', targetsRevision: 5})).toEqual({
      confirmedTargetsRevision: 5,
      savedReviewDateRevision: null
    })
  })

  it('records the preferences revision a review-date save returned', () => {
    expect(advanceGenerateProgress(NO_GENERATE_PROGRESS, {kind: 'save_review_date', preferencesRevision: 8})).toEqual({
      confirmedTargetsRevision: null,
      savedReviewDateRevision: 8
    })
  })

  it('keeps the step already recorded when the other one lands', () => {
    const afterConfirmation: GenerateSequenceProgress = advanceGenerateProgress(NO_GENERATE_PROGRESS, {
      kind: 'confirm_targets',
      targetsRevision: 5
    })

    expect(advanceGenerateProgress(afterConfirmation, {kind: 'save_review_date', preferencesRevision: 8})).toEqual({
      confirmedTargetsRevision: 5,
      savedReviewDateRevision: 8
    })
  })

  it('leaves the progress it was given untouched', () => {
    const progress: GenerateSequenceProgress = {confirmedTargetsRevision: null, savedReviewDateRevision: null}

    advanceGenerateProgress(progress, {kind: 'confirm_targets', targetsRevision: 5})

    expect(progress).toEqual({confirmedTargetsRevision: null, savedReviewDateRevision: null})
    expect(NO_GENERATE_PROGRESS).toEqual({confirmedTargetsRevision: null, savedReviewDateRevision: null})
  })
})

describe('resolveDisplayedTargets', () => {
  it('shows the confirmed server targets under a plain edit link', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display).toEqual({
      source: 'confirmed',
      cardLabel: MEAL_PLAN_DAILY_TARGETS_OVERLINE,
      calories: '2,100',
      unitLabel: MEAL_PLAN_KCAL_UNIT,
      macros: [
        {key: 'protein', label: MEAL_PLAN_MACRO_LABELS.protein, valueText: '150g'},
        {key: 'carbs', label: MEAL_PLAN_MACRO_LABELS.carbs, valueText: '220g'},
        {key: 'fat', label: MEAL_PLAN_MACRO_LABELS.fat, valueText: '70g'}
      ],
      caption: MEAL_PLAN_TARGETS_CAPTION,
      editLabel: MEAL_PLAN_EDIT_LINK_TEXT,
      missingTargetKeys: []
    })
  })

  it('reviews the calculated estimate in place of a complete legacy set, with a recalculation link', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({source: 'legacy'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.calories).not.toBe('2,100')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('reviews the calculated estimate in place of a calories-only legacy account', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.calories).not.toBe('1,900')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('renders no empty or nil text for a calories-only legacy account', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const rendered = [
      display.cardLabel,
      display.calories,
      display.unitLabel,
      display.caption,
      display.editLabel,
      ...display.macros.map(macro => macro.valueText)
    ]

    rendered.forEach(text => {
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toMatch(/null|undefined/)
    })
  })

  it('reviews the whole calculated estimate in place of a partially saved set', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 2100, protein: 150, carbs: null, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.macros).toEqual([
      {key: 'protein', label: MEAL_PLAN_MACRO_LABELS.protein, valueText: '146g'},
      {key: 'carbs', label: MEAL_PLAN_MACRO_LABELS.carbs, valueText: '194g'},
      {key: 'fat', label: MEAL_PLAN_MACRO_LABELS.fat, valueText: '65g'}
    ])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('never mixes saved figures with calculated ones in one card', () => {
    const savedFigureTexts = ['2,100', '150g', '220g', '70g', '1,900']
    const partiallySaved = resolveDisplayedTargets({
      targets: makeTargets({targets: {calories: 2100, protein: 150, carbs: null, fat: 70}, complete: false}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const stale = resolveDisplayedTargets({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    ;[partiallySaved, stale].forEach(display => {
      const rendered = [display.calories, ...display.macros.map(macro => macro.valueText)]

      expect(rendered).toEqual(['1,940', '146g', '194g', '65g'])
      savedFigureTexts.forEach(savedText => expect(rendered).not.toContain(savedText))
    })
  })

  it('reviews the calculated estimate in place of a single saved macro', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: null, protein: 150, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('reviews the recalculated estimate once a confirmed set has gone stale', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('states the figures the Generate press will act on, in every target state', () => {
    const states: (NutritionTargets | null)[] = [
      null,
      makeTargets(),
      makeTargets({source: 'manual'}),
      makeTargets({stale: true}),
      makeTargets({source: 'legacy'}),
      makeTargets({source: null}),
      makeTargets({complete: false}),
      makeTargets({targets: null, complete: false, source: null})
    ]

    states.forEach(targets => {
      const inputs = {targets, estimate: makeEstimate(), preferences: makePreferences()}
      const display = resolveDisplayedTargets(inputs)
      const plan = planGenerateSequence({...inputs, startDate: '2026-07-04'})
      const confirmsEstimate = buildTargetConfirmationPayload(plan) !== null

      expect(confirmsEstimate).toBe(display.source === 'estimate')
      expect(display.calories).toBe(confirmsEstimate ? '1,940' : '2,100')
    })
  })

  it('lets the estimate supply the card when the account has no targets at all', () => {
    const display = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
  })

  it('lets the estimate supply the card when every target column is unset', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({targets: null, complete: false, source: null}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
  })

  it('offers an edit rather than a recalculation when there are no saved figures to supersede', () => {
    const firstVisit = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const rowWithoutFigures = resolveDisplayedTargets({
      targets: makeTargets({targets: null, complete: false, source: null}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(firstVisit.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
    expect(rowWithoutFigures.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
  })

  it('reviews the calculated estimate in place of a set saved without a calorie target', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: null, protein: 150, carbs: 220, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('estimate')
    expect(display.calories).toBe('1,940')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['146g', '194g', '65g'])
    expect(display.missingTargetKeys).toEqual([])
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('reports no figures when neither targets nor an estimate exist', () => {
    const display = resolveDisplayedTargets({
      targets: null,
      estimate: null,
      preferences: makePreferences()
    })

    expect(display.source).toBe('unavailable')
    expect(display.calories).toBe('')
    expect(display.macros).toEqual([])
    expect(display.missingTargetKeys).toEqual(['calories', 'protein', 'carbs', 'fat'])
    expect(display.editLabel).toBe(MEAL_PLAN_EDIT_LINK_TEXT)
  })

  it('labels the manual route distinctly from the estimated one', () => {
    const manualTargets = resolveDisplayedTargets({
      targets: makeTargets({source: 'manual'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const manualRoute = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences({targetRoute: 'manual'})
    })
    const estimatedRoute = resolveDisplayedTargets({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(MEAL_PLAN_CHOSEN_TARGETS_OVERLINE).not.toBe(MEAL_PLAN_DAILY_TARGETS_OVERLINE)
    expect(manualTargets.cardLabel).toBe(MEAL_PLAN_CHOSEN_TARGETS_OVERLINE)
    expect(manualRoute.cardLabel).toBe(MEAL_PLAN_CHOSEN_TARGETS_OVERLINE)
    expect(estimatedRoute.cardLabel).toBe(MEAL_PLAN_DAILY_TARGETS_OVERLINE)
  })

  it('never calls figures the user chose starting estimates', () => {
    const manualTargets = resolveDisplayedTargets({
      targets: makeTargets({source: 'manual'}),
      estimate: makeEstimate(),
      preferences: makePreferences({targetRoute: 'manual'})
    })
    const manualRoute = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences({targetRoute: 'manual'})
    })

    expect(MEAL_PLAN_CHOSEN_TARGETS_CAPTION).not.toBe(MEAL_PLAN_TARGETS_CAPTION)
    ;[manualTargets, manualRoute].forEach(display => {
      expect(display.caption).toBe(MEAL_PLAN_CHOSEN_TARGETS_CAPTION)
      expect(display.caption).not.toMatch(/estimate/i)
      expect(display.caption.length).toBeGreaterThan(0)
    })
  })

  it('keeps the drawn estimate caption for a calculated or confirmed-estimate set', () => {
    const estimateLed = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const confirmedEstimate = resolveDisplayedTargets({
      targets: makeTargets({source: 'estimated'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(estimateLed.caption).toBe(MEAL_PLAN_TARGETS_CAPTION)
    expect(confirmedEstimate.caption).toBe(MEAL_PLAN_TARGETS_CAPTION)
  })

  it('keeps the card label and its caption telling the same story', () => {
    const inputs = [
      {targets: makeTargets({source: 'manual'}), preferences: makePreferences()},
      {targets: null, preferences: makePreferences({targetRoute: 'manual'})},
      {targets: makeTargets(), preferences: makePreferences()},
      {targets: makeTargets({source: 'legacy'}), preferences: makePreferences()},
      {targets: null, preferences: makePreferences()}
    ]

    inputs.forEach(({targets, preferences}) => {
      const display = resolveDisplayedTargets({targets, estimate: makeEstimate(), preferences})
      const isChosenCard = display.cardLabel === MEAL_PLAN_CHOSEN_TARGETS_OVERLINE

      expect(display.caption).toBe(isChosenCard ? MEAL_PLAN_CHOSEN_TARGETS_CAPTION : MEAL_PLAN_TARGETS_CAPTION)
    })
  })
})

describe('buildAnswerRows', () => {
  it('builds exactly the six review rows, in order, each routed to its own step', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows).toHaveLength(6)
    expect(rows.map(row => row.key)).toEqual(['goal', 'diet', 'dislikes', 'meals', 'cookingTime', 'budget'])
    expect(rows.map(row => row.label)).toEqual([
      MEAL_PLAN_GOAL_ROW_LABEL,
      MEAL_PLAN_ANSWER_DIET_LABEL,
      MEAL_PLAN_DISLIKED_INGREDIENTS_ROW_LABEL,
      MEAL_PLAN_ANSWER_MEALS_LABEL,
      MEAL_PLAN_MAX_COOKING_TIME_ROW_LABEL,
      MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL
    ])
    expect(rows.map(row => row.editStep)).toEqual(['goal', 'diet', 'dislikes', 'schedule', 'cooking', 'cooking'])
  })

  it('reads a losing goal back with its goal weight in pounds and its pace', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows[0].value).toBe('Lose weight · 165.3 lb · 1 lb a week')
  })

  it('reads a goal weight back to the tenth the user entered it at', () => {
    const halfPound = buildAnswerRows(makePreferences({goalWeightKg: poundsToKilograms(170.5)}))
    const wholePound = buildAnswerRows(makePreferences({goalWeightKg: poundsToKilograms(170)}))

    expect(halfPound[0].value).toBe('Lose weight · 170.5 lb · 1 lb a week')
    expect(wholePound[0].value).toBe('Lose weight · 170 lb · 1 lb a week')
  })

  it('reads a metric goal weight back to the tenth, without a trailing zero decimal', () => {
    const fraction = buildAnswerRows(makePreferences({goalWeightKg: 77.34, weightUnitPref: 'kg'}))
    const whole = buildAnswerRows(makePreferences({goalWeightKg: 77, weightUnitPref: 'kg'}))

    expect(fraction[0].value).toBe('Lose weight · 77.3 kg · 1 lb a week')
    expect(whole[0].value).toBe('Lose weight · 77 kg · 1 lb a week')
  })

  it('reads a gaining goal back with a metric goal weight', () => {
    const rows = buildAnswerRows(
      makePreferences({goal: 'gain', goalWeightKg: 90, paceLbPerWeek: 0.5, weightUnitPref: 'kg'})
    )

    expect(rows[0].value).toBe('Gain weight · 90 kg · 0.5 lb a week')
  })

  it('omits the goal weight and pace when maintaining', () => {
    const rows = buildAnswerRows(makePreferences({goal: 'maintain'}))

    expect(rows[0].value).toBe('Maintain weight')
  })

  it('reads the explicit no-allergies answer beside the diet', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows[1].value).toBe('No specific diet · None')
  })

  it('names every selected allergen beside the diet', () => {
    const rows = buildAnswerRows(makePreferences({diet: 'vegetarian', allergens: ['milk', 'peanuts', 'sesame']}))

    expect(rows[1].value).toBe('Vegetarian · Milk, Peanuts, Sesame')
  })

  it('lists the disliked foods and falls to the shared none value when there are none', () => {
    const named = buildAnswerRows(
      makePreferences({
        dislikedFoods: [
          {id: 'food-1', name: 'Olives', foodGroup: 'Vegetables'},
          {id: 'food-2', name: 'Anchovies', foodGroup: 'Seafood'}
        ]
      })
    )
    const empty = buildAnswerRows(makePreferences({dislikedFoods: []}))

    expect(named[2].value).toBe('Olives, Anchovies')
    expect(empty[2].value).toBe(MEAL_PLAN_VALUE_NONE)
  })

  it('lists three meal times in slot order', () => {
    const rows = buildAnswerRows(makePreferences())

    expect(rows[3].value).toBe('8:00 AM · 12:30 PM · 6:30 PM')
  })

  it('lists a mid-afternoon snack last rather than at its time of day', () => {
    const rows = buildAnswerRows(
      makePreferences({
        mealSchedule: 'three_plus_snack',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'snack', time: '15:30'},
          {slot: 'dinner', time: '18:30'}
        ]
      })
    )

    expect(rows[3].value).toBe('8:00 AM · 12:30 PM · 6:30 PM · 3:30 PM')
  })

  it('reads the cooking limit and both budget answers back', () => {
    const amount = buildAnswerRows(makePreferences())
    const noPreference = buildAnswerRows(makePreferences({budget: null, noBudgetPreference: true}))

    expect(amount[4].value).toBe('30 minutes')
    expect(amount[5].value).toBe('$120 per week')
    expect(noPreference[5].value).toBe(MEAL_PLAN_NO_BUDGET_PREFERENCE_LABEL)
  })

  it('renders no empty or nil value for an account that answered nothing', () => {
    const rows = buildAnswerRows(
      makePreferences({
        goal: null,
        goalWeightKg: null,
        paceLbPerWeek: null,
        weightUnitPref: null,
        diet: null,
        allergens: [],
        dislikedFoods: [],
        mealSchedule: null,
        mealTimes: [],
        cookingTimeLimitMin: null,
        budget: null,
        noBudgetPreference: false
      })
    )

    expect(rows).toHaveLength(6)

    rows.forEach(row => {
      expect(row.value.length).toBeGreaterThan(0)
      expect(row.value).not.toMatch(/null|undefined/)
    })
  })

  it('treats allergen codes named after Object.prototype members exactly like any unknown code', () => {
    const prototypeNamed = buildAnswerRows(makePreferences({diet: 'vegetarian', allergens: PROTOTYPE_ALLERGEN_CODES}))
    const unknown = buildAnswerRows(makePreferences({diet: 'vegetarian', allergens: [UNKNOWN_ALLERGEN_CODE]}))

    expect(prototypeNamed[1].value).toBe(unknown[1].value)
    expect(prototypeNamed[1].value).toBe('Vegetarian')
    expect(prototypeNamed[1].value).not.toMatch(INHERITED_MEMBER_TEXT)
  })

  it('states no goal and no diet for prototype-named codes rather than an inherited member', () => {
    const rows = buildAnswerRows(makePreferences({goal: PROTOTYPE_GOAL, diet: PROTOTYPE_DIET, allergens: []}))

    expect(rows[0].value).toBe(MEAL_PLAN_VALUE_NONE)
    expect(rows[1].value).toBe(MEAL_PLAN_VALUE_NONE)
    expect(rows[0].value).not.toMatch(INHERITED_MEMBER_TEXT)
    expect(rows[1].value).not.toMatch(INHERITED_MEMBER_TEXT)
  })
})

describe('resolveInitialStartDate', () => {
  const now = new Date(2026, 6, 3, 12, 0, 0)

  const initialStartDate = (
    reviewStartDate: string | null,
    paramStartDate: string | null,
    activePlanEndDate: string | null = null
  ): string => resolveInitialStartDate({reviewStartDate, paramStartDate, now, activePlanEndDate})

  it('prefers the route param over the persisted review date', () => {
    expect(initialStartDate('2026-07-06', '2026-07-10')).toBe('2026-07-10')
  })

  it('falls back to the persisted review date when no param was passed', () => {
    expect(initialStartDate('2026-07-06', null)).toBe('2026-07-06')
  })

  it('defaults to tomorrow when neither a param nor a persisted date exists', () => {
    expect(initialStartDate(null, null)).toBe('2026-07-04')
  })

  it('clamps a persisted date that has since passed forward to today', () => {
    expect(initialStartDate('2026-06-20', null)).toBe('2026-07-03')
  })

  it('clamps a param beyond the horizon back to the last selectable day', () => {
    expect(initialStartDate(null, '2026-09-01')).toBe('2026-08-02')
  })

  it('admits the successor week of an active plan that ends past the horizon', () => {
    expect(initialStartDate(null, '2026-08-21', '2026-08-20')).toBe('2026-08-21')
  })
})

describe('resolveStartDateStepState', () => {
  const now = new Date(2026, 6, 3, 12, 0, 0)

  const stepState = (startDate: string, activePlanEndDate: string | null = null): StartDateStepState =>
    resolveStartDateStepState({startDate, now, activePlanEndDate})

  it('bounds the stepper at today, tomorrow and thirty days ahead', () => {
    expect(stepState('2026-07-04').bounds).toEqual({min: '2026-07-03', default: '2026-07-04', max: '2026-08-02'})
  })

  it('refuses to step back from the first reachable day', () => {
    expect(stepState('2026-07-03').canStepBack).toBe(false)
    expect(stepState('2026-07-04').canStepBack).toBe(true)
  })

  it('refuses to step forward from the last reachable day', () => {
    expect(stepState('2026-08-02').canStepForward).toBe(false)
    expect(stepState('2026-08-01').canStepForward).toBe(true)
  })

  it('extends the forward bound to the day after an active plan ends', () => {
    expect(stepState('2026-08-02', '2026-08-20').bounds.max).toBe('2026-08-21')
    expect(stepState('2026-08-02', '2026-08-20').canStepForward).toBe(true)
    expect(stepState('2026-08-21', '2026-08-20').canStepForward).toBe(false)
  })

  it('names the first two reachable days and dates every later one', () => {
    expect(stepState('2026-07-03').dayLabel).toBe(MEAL_PLAN_START_DATE_TODAY_LABEL)
    expect(stepState('2026-07-04').dayLabel).toBe(MEAL_PLAN_START_DATE_TOMORROW_LABEL)
    expect(stepState('2026-08-02').dayLabel).toBe('Aug 2')
  })

  it('reads the chosen day beside the week it plans', () => {
    const state = stepState('2026-07-04')

    expect(state.rangeText).toBe(
      `${MEAL_PLAN_START_DATE_TOMORROW_LABEL}${MEAL_PLAN_VALUE_SEPARATOR}Jul 4 \u2013 Jul 10`
    )
  })
})

describe('resolveGenerateCtaState', () => {
  it('offers a live Generate when nothing is pending or loading', () => {
    const cta = resolveGenerateCtaState({plan: makePlan(), isEstimateLoading: false, isPending: false})

    expect(cta).toEqual({label: MEAL_PLAN_GENERATE_BUTTON_TEXT, isEnabled: true, action: 'generate'})
  })

  it('disables the CTA while the press is pending', () => {
    const cta = resolveGenerateCtaState({plan: makePlan(), isEstimateLoading: false, isPending: true})

    expect(cta.isEnabled).toBe(false)
  })

  it('waits for a loading estimate only when the press depends on it', () => {
    const unconfirmed = resolveGenerateCtaState({
      plan: makePlan({requiresTargetConfirmation: true, dependsOnEstimate: true}),
      isEstimateLoading: true,
      isPending: false
    })
    const confirmed = resolveGenerateCtaState({plan: makePlan(), isEstimateLoading: true, isPending: false})

    expect(unconfirmed.isEnabled).toBe(false)
    expect(confirmed.isEnabled).toBe(true)
  })

  it('waits out a first visit whose estimate has not arrived instead of offering manual entry', () => {
    const plan = planGenerateSequence({
      targets: null,
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const whileLoading = resolveGenerateCtaState({plan, isEstimateLoading: true, isPending: false})

    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(plan.dependsOnEstimate).toBe(true)
    expect(whileLoading.isEnabled).toBe(false)
    expect(whileLoading.action).toBe('generate')
    expect(whileLoading.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('waits out a loading estimate for saved figures the estimate is about to supersede', () => {
    const supersededStates = [
      makeTargets({stale: true}),
      makeTargets({source: 'legacy'}),
      makeTargets({complete: false})
    ]

    supersededStates.forEach(targets => {
      const plan = planGenerateSequence({
        targets,
        estimate: null,
        preferences: makePreferences(),
        startDate: '2026-07-04'
      })
      const cta = resolveGenerateCtaState({plan, isEstimateLoading: true, isPending: false})

      expect(cta.isEnabled).toBe(false)
      expect(cta.action).toBe('generate')
    })
  })

  it('stays live once the estimate settles unavailable and carries the press to manual targets', () => {
    const plan = planGenerateSequence({
      targets: null,
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const cta = resolveGenerateCtaState({plan, isEstimateLoading: false, isPending: false})

    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(cta.isEnabled).toBe(true)
    expect(cta.action).toBe('manual_targets')
    expect(cta.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('generates rather than diverting the press when saved figures need reviewing', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({source: 'legacy'}),
      estimate: makeEstimate(),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const cta = resolveGenerateCtaState({plan, isEstimateLoading: false, isPending: false})

    expect(plan.blockedReason).toBeNull()
    expect(cta.isEnabled).toBe(true)
    expect(cta.action).toBe('generate')
    expect(cta.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('generates when the sequence is not blocked', () => {
    const cta = resolveGenerateCtaState({
      plan: makePlan({requiresTargetConfirmation: true, dependsOnEstimate: true}),
      isEstimateLoading: false,
      isPending: false
    })

    expect(cta.action).toBe('generate')
    expect(cta.isEnabled).toBe(true)
  })

  it('offers manual entry only when the settled state has no figures, never while it is undecided', () => {
    const blocked = makePlan({dependsOnEstimate: true, blockedReason: 'estimate_unavailable'})
    const undecided = resolveGenerateCtaState({plan: blocked, isEstimateLoading: true, isPending: false})
    const settled = resolveGenerateCtaState({plan: blocked, isEstimateLoading: false, isPending: false})

    expect(undecided.action).toBe('generate')
    expect(settled.action).toBe('manual_targets')
    expect(resolveGenerateCtaState({plan: blocked, isEstimateLoading: false, isPending: true})).toEqual({
      label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
      isEnabled: false,
      action: 'manual_targets'
    })
  })
})
