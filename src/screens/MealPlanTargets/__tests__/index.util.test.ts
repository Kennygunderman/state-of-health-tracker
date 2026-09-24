import {MealPlanPreferences, MealPlanPreferencesSaveResult, SetupStepRequest} from '@data/models/MealPlanPreferences'
import {
  NutritionTargetEstimate,
  NutritionTargets,
  SaveNutritionTargetsPayload,
  SaveNutritionTargetsResult
} from '@data/models/NutritionTargets'
import {isNutritionTargetsReadFailure} from '@queries/mealPlanning/useNutritionTargetsQuery.util'
import {API_ERROR_CODES} from '@utility/ApiErrorUtility'
import {RoutesMissingError} from '@utility/MealPlanEntitlementUtility'
import {MealPlanReadStatus} from '@utility/MealPlanReadStateUtility'
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
  MEAL_PLAN_NO_TARGET_FIGURE_TEXT,
  MEAL_PLAN_RECALCULATE_LINK_TEXT,
  MEAL_PLAN_START_DATE_TODAY_LABEL,
  MEAL_PLAN_START_DATE_TOMORROW_LABEL,
  MEAL_PLAN_TARGETS_CAPTION,
  MEAL_PLAN_VALUE_NONE,
  MEAL_PLAN_VALUE_SEPARATOR,
  MEAL_PLAN_WEEKLY_BUDGET_ROW_LABEL
} from '@constants/strings'

import {
  buildAnswerRows,
  buildTargetConfirmationPayload,
  GenerateCtaInputs,
  GenerateRevisionConflict,
  GenerateSequenceCollaborators,
  GenerateSequenceCommitments,
  GenerateSequencePlan,
  GeneratingRouteParams,
  authoritativeEstimate,
  isConfirmedEstimateUnavailableError,
  NO_GENERATE_COMMITMENTS,
  NO_TARGETS_REVISION,
  planGenerateSequence,
  resolveDisplayedTargets,
  resolveGenerateCtaState,
  resolveInitialStartDate,
  resolveReviewReadState,
  resolveStartDateStepState,
  ReviewReadStateInputs,
  runGenerateSequence,
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

  it('generates against a confirmed set that has gone stale rather than confirming the recalculation', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({stale: true, revision: 4}),
      estimate: makeEstimate({estimateRevision: 9}),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })

    // A confirmed target is fixed once confirmed: moving inputs make it stale, and generation keeps using it
    // until the user reconfirms (AAP 0.7.3). Confirming the recalculation here would overwrite the figures the
    // user chose with figures they never selected, on a press that only asked for a plan.
    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.blockedReason).toBeNull()
    expect(buildTargetConfirmationPayload(plan)).toBeNull()
    expect(plan.expectedTargetsRevision).toBe(4)
  })

  it('pins the superseded set own revision, since generation is still built from those figures', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({stale: true, revision: 4}),
      estimate: makeEstimate({estimateRevision: 9}),
      preferences: makePreferences({reviewStartDate: '2026-07-04', revision: 7}),
      startDate: '2026-07-04'
    })

    // Nothing is saved, so the revision the request carries is the one the read reported — the recalculated
    // set is adopted through the Recalculate link, which is the press that records a new one.
    expect(plan.requiresTargetConfirmation).toBe(false)
    expect(plan.requiresStartDateSave).toBe(false)
    expect(plan.expectedTargetsRevision).toBe(4)
    expect(plan.expectedPreferencesRevision).toBe(7)
    expect(plan.blockedReason).toBeNull()
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

      // Generation would answer 422 targets_missing or 409 targets_unconfirmed for each of these (0.5.2), and
      // neither the saved figures nor the recalculated ones can be chosen for the user — so the press is
      // blocked to the editor, where both sets are on screen, instead of confirming an estimate they were
      // never shown leading the card.
      expect(plan.requiresTargetConfirmation).toBe(false)
      expect(plan.blockedReason).toBe('targets_unconfirmed')
      expect(buildTargetConfirmationPayload(plan)).toBeNull()
      expect(plan.expectedTargetsRevision).toBe(3)
    })
  })

  it('never confirms the estimate over a saved row that holds no calorie target', () => {
    const macroOnlyRows: NutritionTargets[] = [
      makeTargets({targets: {calories: null, protein: 150, carbs: null, fat: null}, complete: false, revision: 3}),
      makeTargets({targets: {calories: null, protein: 150, carbs: 220, fat: 70}, complete: false, revision: 3}),
      makeTargets({
        targets: {calories: null, protein: null, carbs: null, fat: 70},
        complete: false,
        source: 'legacy',
        revision: 3
      })
    ]

    macroOnlyRows.forEach(targets => {
      const plan = planGenerateSequence({
        targets,
        estimate: makeEstimate({estimateRevision: 9}),
        preferences: makePreferences(),
        startDate: '2026-07-04'
      })
      const cta = resolveGenerateCtaState({plan, isEstimateLoading: false, isPending: false, hasReadFailure: false})

      // The absent calorie target does not make these the estimate's figures. Confirming the estimate here
      // would save four numbers over a row the user had saved one of, on a press that only asked for a plan —
      // so the press is blocked to the editor instead, and no confirmation body is ever built.
      expect(plan.requiresTargetConfirmation).toBe(false)
      expect(buildTargetConfirmationPayload(plan)).toBeNull()
      expect(plan.blockedReason).toBe('targets_unconfirmed')
      expect(plan.dependsOnEstimate).toBe(false)
      expect(cta.action).toBe('review_targets')
      expect(cta.isEnabled).toBe(true)
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
    expect(buildTargetConfirmationPayload(plan)).toBeNull()
    // The saved legacy figures are still the user's, so the press sends them to be reviewed rather than
    // reading the absent estimate as "this account has no targets".
    expect(plan.blockedReason).toBe('targets_unconfirmed')
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

  it('reports no figures at all as unavailable and figures generation refuses as unconfirmed', () => {
    const planWithoutEstimate = (targets: NutritionTargets | null): GenerateSequencePlan =>
      planGenerateSequence({targets, estimate: null, preferences: makePreferences(), startDate: '2026-07-04'})

    // Nothing saved and nothing calculated: there is no figure to generate against at all, and the recovery is
    // manual entry (0.2.5).
    expect(planWithoutEstimate(null).blockedReason).toBe('estimate_unavailable')
    expect(planWithoutEstimate(makeTargets({targets: null, complete: false, source: null})).blockedReason).toBe(
      'estimate_unavailable'
    )

    // Saved figures generation refuses are a different answer: they exist, they are the user's, and the
    // recovery is to review them — not to declare the account targetless because no estimate arrived.
    expect(planWithoutEstimate(makeTargets({source: 'legacy'})).blockedReason).toBe('targets_unconfirmed')
    expect(planWithoutEstimate(makeTargets({complete: false})).blockedReason).toBe('targets_unconfirmed')

    // A confirmed set generates with no estimate in hand, stale or not.
    expect(planWithoutEstimate(makeTargets()).blockedReason).toBeNull()
    expect(planWithoutEstimate(makeTargets({source: 'manual'})).blockedReason).toBeNull()
    expect(planWithoutEstimate(makeTargets({stale: true})).blockedReason).toBeNull()
  })

  it('depends on the estimate only where it leads the card or there are no figures at all', () => {
    const dependsFor = (
      targets: NutritionTargets | null,
      estimate: NutritionTargetEstimate | null = makeEstimate()
    ): boolean =>
      planGenerateSequence({targets, estimate, preferences: makePreferences(), startDate: '2026-07-04'})
        .dependsOnEstimate

    // A press acting on the user's own figures is already decided, so holding the CTA back for an estimate it
    // will not send would make a slow query look like a broken screen.
    expect(dependsFor(makeTargets())).toBe(false)
    expect(dependsFor(makeTargets({source: 'manual'}))).toBe(false)
    expect(dependsFor(makeTargets(), null)).toBe(false)
    expect(dependsFor(makeTargets({stale: true}))).toBe(false)
    expect(dependsFor(makeTargets({source: 'legacy'}))).toBe(false)
    expect(dependsFor(makeTargets({complete: false}))).toBe(false)
    // A saved row with no calorie target is still the user's own, so this press does not wait on the estimate
    // either — it is blocked to the editor whatever the estimate turns out to be.
    expect(
      dependsFor(makeTargets({targets: {calories: null, protein: 150, carbs: 220, fat: 70}, complete: false}))
    ).toBe(false)

    // The estimate decides these three: it leads the card, or there is nothing saved to lead with.
    expect(dependsFor(null)).toBe(true)
    expect(dependsFor(null, null)).toBe(true)
    expect(dependsFor(makeTargets({targets: null, complete: false, source: null}))).toBe(true)
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
      freshEstimateText: null,
      summaryAccessibilityLabel: 'Daily targets, 2,100 kcal. Protein 150g, Carbs 220g, Fat 70g',
      missingTargetKeys: []
    })
  })

  it('keeps a complete legacy set on the card and shows the recalculated figure beside it', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({source: 'legacy'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    // The user's own figures lead. Replacing them with the recalculated set would discard the only numbers
    // they chose and would let a Generate press confirm figures they never selected (AAP 0.5.2, 0.7.3).
    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe('2,100')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g', '220g', '70g'])
    expect(display.missingTargetKeys).toEqual([])

    // The comparison the Recalculate link is for: the figure adopting it would produce, labelled as an
    // estimate and never as the card's own figure.
    expect(display.freshEstimateText).toBe('New estimate 1,940')
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    expect(display.summaryAccessibilityLabel).toContain('New estimate 1,940')
  })

  it('keeps a calories-only legacy account on the card with only the figures it holds', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe('1,900')
    // No row is invented for a macro the server does not hold, and no macro of the estimate is presented as
    // one of the user's: the three it left unset are named for the editor to fill.
    expect(display.macros).toEqual([])
    expect(display.missingTargetKeys).toEqual(['protein', 'carbs', 'fat'])
    expect(display.freshEstimateText).toBe('New estimate 1,940')
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

  it('keeps a partially saved set on the card with only the macros it holds', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 2100, protein: 150, carbs: null, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe('2,100')
    expect(display.macros).toEqual([
      {key: 'protein', label: MEAL_PLAN_MACRO_LABELS.protein, valueText: '150g'},
      {key: 'fat', label: MEAL_PLAN_MACRO_LABELS.fat, valueText: '70g'}
    ])
    expect(display.missingTargetKeys).toEqual(['carbs'])
    expect(display.freshEstimateText).toBe('New estimate 1,940')
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
  })

  it('never presents a calculated figure as one of the card own target rows', () => {
    const estimateFigureTexts = ['1,940', '146g', '194g', '65g']
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
      const targetRows = [display.calories, ...display.macros.map(macro => macro.valueText)]

      // The recalculated set is a single labelled figure beside the card's own, never a row among them: a
      // macro row reading '146g' would be indistinguishable from a target the user actually saved.
      estimateFigureTexts.forEach(estimateText => expect(targetRows).not.toContain(estimateText))
      expect(display.freshEstimateText).toBe('New estimate 1,940')
    })
  })

  it('keeps a single saved macro on the card and marks the absent calorie target unset', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: null, protein: 150, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    // One saved macro is still the user's own figure, so it leads the card. The calculated figure may not fill
    // the empty calorie slot: doing so would present a number the user never chose as their target, and would
    // put the card back under the estimate, where a Generate press confirms it and overwrites this 150g.
    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe(MEAL_PLAN_NO_TARGET_FIGURE_TEXT)
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g'])
    expect(display.missingTargetKeys).toEqual(['calories', 'carbs', 'fat'])
    expect(display.freshEstimateText).toBe('New estimate 1,940')
    expect(display.editLabel).toBe(MEAL_PLAN_RECALCULATE_LINK_TEXT)
    // Spoken rather than the dash, which a screen reader reads as punctuation or skips.
    expect(display.summaryAccessibilityLabel).toBe('Daily targets, not set kcal. Protein 150g. New estimate 1,940')
  })

  it('keeps a superseded set on the card with the recalculated figure beside it', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    // 0.7.3: the confirmed set stays until the user reconfirms, and what staleness changes is the label and
    // the figure shown beside it — so the card states the numbers generation will actually use.
    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe('2,100')
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g', '220g', '70g'])
    expect(display.freshEstimateText).toBe('New estimate 1,940')
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

  it('keeps all three saved macros on the card when no calorie target was saved', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: null, protein: 150, carbs: 220, fat: 70},
        complete: false
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.source).toBe('confirmed')
    expect(display.calories).toBe(MEAL_PLAN_NO_TARGET_FIGURE_TEXT)
    expect(display.macros.map(macro => macro.valueText)).toEqual(['150g', '220g', '70g'])
    expect(display.missingTargetKeys).toEqual(['calories'])
    // The estimate is the labelled comparison beside them, never the three macro rows themselves.
    expect(display.freshEstimateText).toBe('New estimate 1,940')
    expect(display.macros.map(macro => macro.valueText)).not.toContain('146g')
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

  // The defect, and the reason the caption no longer follows the card's heading. A legacy record — the state
  // most of the installed base arrives in, written through the pre-planner target endpoint — leads a card
  // still headed 'Daily targets', which is correct, because those are the user's own figures. The caption
  // called them starting estimates, which is not: no estimator ever ran on them. A partly saved set is the
  // same case. So the caption answers whether a calculation produced the figures, and the label answers
  // whose they are, and in the legacy state the two answers differ (AAP 0.5.2's 'legacy' source, 0.7.3).
  it('calls figures starting estimates only where an estimator produced them', () => {
    const CALORIES_ONLY = {calories: 1900, protein: null, carbs: null, fat: null}

    const estimateDerived = [
      {targets: makeTargets(), preferences: makePreferences()},
      {targets: makeTargets({source: 'estimated'}), preferences: makePreferences()},
      {targets: makeTargets({source: 'estimated', stale: true}), preferences: makePreferences()},
      {targets: null, preferences: makePreferences()}
    ]

    const notEstimateDerived = [
      {targets: makeTargets({source: 'manual'}), preferences: makePreferences()},
      {targets: null, preferences: makePreferences({targetRoute: 'manual'})},
      {targets: makeTargets({source: 'legacy'}), preferences: makePreferences()},
      {
        targets: makeTargets({targets: CALORIES_ONLY, complete: false, source: 'legacy'}),
        preferences: makePreferences()
      }
    ]

    estimateDerived.forEach(({targets, preferences}) => {
      expect(resolveDisplayedTargets({targets, estimate: makeEstimate(), preferences}).caption).toBe(
        MEAL_PLAN_TARGETS_CAPTION
      )
    })

    notEstimateDerived.forEach(({targets, preferences}) => {
      const display = resolveDisplayedTargets({targets, estimate: makeEstimate(), preferences})

      expect(display.caption).toBe(MEAL_PLAN_CHOSEN_TARGETS_CAPTION)
      expect(display.caption).not.toMatch(/estimate/i)
    })
  })

  // The one state where the heading and the caption disagree, pinned on its own so that making them agree
  // again — in either direction — fails here rather than reintroducing the claim.
  it('heads a legacy set as the daily targets it is while not calling it an estimate', () => {
    const display = resolveDisplayedTargets({
      targets: makeTargets({source: 'legacy'}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(display.cardLabel).toBe(MEAL_PLAN_DAILY_TARGETS_OVERLINE)
    expect(display.caption).toBe(MEAL_PLAN_CHOSEN_TARGETS_CAPTION)
  })

  it('shows no recalculated figure where there is nothing to compare', () => {
    const settled = resolveDisplayedTargets({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const noEstimate = resolveDisplayedTargets({
      targets: makeTargets({stale: true}),
      estimate: null,
      preferences: makePreferences()
    })
    // The estimate already heads this card, so repeating it beside itself would read as two different targets.
    const estimateLeads = resolveDisplayedTargets({
      targets: null,
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const unavailable = resolveDisplayedTargets({targets: null, estimate: null, preferences: makePreferences()})

    expect(settled.freshEstimateText).toBeNull()
    expect(noEstimate.freshEstimateText).toBeNull()
    expect(estimateLeads.freshEstimateText).toBeNull()
    expect(unavailable.freshEstimateText).toBeNull()
  })

  it('announces the whole card as one sentence rather than four unrelated numbers', () => {
    const confirmed = resolveDisplayedTargets({
      targets: makeTargets(),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const superseded = resolveDisplayedTargets({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })
    const caloriesOnly = resolveDisplayedTargets({
      targets: makeTargets({
        targets: {calories: 1900, protein: null, carbs: null, fat: null},
        complete: false,
        source: 'legacy'
      }),
      estimate: makeEstimate(),
      preferences: makePreferences()
    })

    expect(confirmed.summaryAccessibilityLabel).toBe('Daily targets, 2,100 kcal. Protein 150g, Carbs 220g, Fat 70g')
    expect(superseded.summaryAccessibilityLabel).toBe(
      'Daily targets, 2,100 kcal. Protein 150g, Carbs 220g, Fat 70g. New estimate 1,940'
    )
    // A card with no macro rows still reads as whole sentences, with no dangling separator or nil text.
    expect(caloriesOnly.summaryAccessibilityLabel).toBe('Daily targets, 1,900 kcal. New estimate 1,940')
    expect(caloriesOnly.summaryAccessibilityLabel).not.toMatch(/null|undefined/)
  })

  it('never announces nil text for a card with no figures at all', () => {
    const display = resolveDisplayedTargets({targets: null, estimate: null, preferences: makePreferences()})

    expect(display.summaryAccessibilityLabel).not.toMatch(/null|undefined/)
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
  const makeCtaInputs = (overrides: Partial<GenerateCtaInputs> = {}): GenerateCtaInputs => ({
    plan: makePlan(),
    isEstimateLoading: false,
    isPending: false,
    hasReadFailure: false,
    ...overrides
  })

  it('offers a live Generate when nothing is pending, loading or failed', () => {
    const cta = resolveGenerateCtaState(makeCtaInputs())

    expect(cta).toEqual({label: MEAL_PLAN_GENERATE_BUTTON_TEXT, isEnabled: true, action: 'generate'})
  })

  it('disables the CTA while the press is pending', () => {
    expect(resolveGenerateCtaState(makeCtaInputs({isPending: true})).isEnabled).toBe(false)
  })

  it('disables the CTA while a read this screen is built on has failed', () => {
    // Both revisions the press pins come from those reads. A press made without them would pin a revision the
    // screen never actually read and argue with the server about a conflict the user never had.
    const failed = resolveGenerateCtaState(makeCtaInputs({hasReadFailure: true}))

    expect(failed.isEnabled).toBe(false)
    expect(failed.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('keeps a failed read disabling the press in every action it could take', () => {
    const actions: Partial<GenerateCtaInputs>[] = [
      {plan: makePlan()},
      {plan: makePlan({blockedReason: 'estimate_unavailable'})},
      {plan: makePlan({blockedReason: 'targets_unconfirmed'})}
    ]

    actions.forEach(overrides => {
      expect(resolveGenerateCtaState(makeCtaInputs({...overrides, hasReadFailure: true})).isEnabled).toBe(false)
    })
  })

  it('waits for a loading estimate only when the press depends on it', () => {
    const unconfirmed = resolveGenerateCtaState(
      makeCtaInputs({
        plan: makePlan({requiresTargetConfirmation: true, dependsOnEstimate: true}),
        isEstimateLoading: true
      })
    )
    const confirmed = resolveGenerateCtaState(makeCtaInputs({isEstimateLoading: true}))

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
    const whileLoading = resolveGenerateCtaState(makeCtaInputs({plan, isEstimateLoading: true}))

    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(plan.dependsOnEstimate).toBe(true)
    expect(whileLoading.isEnabled).toBe(false)
    expect(whileLoading.action).toBe('generate')
    expect(whileLoading.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('stays live for the user own saved figures while the estimate is still loading', () => {
    const savedStates = [makeTargets({stale: true}), makeTargets({source: 'legacy'}), makeTargets({complete: false})]

    savedStates.forEach(targets => {
      const plan = planGenerateSequence({
        targets,
        estimate: null,
        preferences: makePreferences(),
        startDate: '2026-07-04'
      })
      const cta = resolveGenerateCtaState(makeCtaInputs({plan, isEstimateLoading: true}))

      // The press acts on figures already on the card, so it sends no estimate and has nothing to wait for:
      // holding it back would make a slow estimate query look like a broken screen.
      expect(plan.dependsOnEstimate).toBe(false)
      expect(cta.isEnabled).toBe(true)
    })
  })

  it('stays live once the estimate settles unavailable and carries the press to manual targets', () => {
    const plan = planGenerateSequence({
      targets: null,
      estimate: null,
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const cta = resolveGenerateCtaState(makeCtaInputs({plan}))

    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(cta.isEnabled).toBe(true)
    expect(cta.action).toBe('manual_targets')
    expect(cta.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
  })

  it('carries the press to the editor when the saved figures generation refuses', () => {
    const refusedStates = [makeTargets({source: 'legacy'}), makeTargets({complete: false})]

    refusedStates.forEach(targets => {
      const plan = planGenerateSequence({
        targets,
        estimate: makeEstimate(),
        preferences: makePreferences(),
        startDate: '2026-07-04'
      })
      const cta = resolveGenerateCtaState(makeCtaInputs({plan}))

      // Generating would be refused and confirming the recalculation would replace figures the user chose, so
      // the press opens 09b on their own numbers with the recalculated set beside them (0.5.2).
      expect(plan.blockedReason).toBe('targets_unconfirmed')
      expect(cta.isEnabled).toBe(true)
      expect(cta.action).toBe('review_targets')
      expect(cta.label).toBe(MEAL_PLAN_GENERATE_BUTTON_TEXT)
    })
  })

  it('generates for a superseded set rather than diverting the press', () => {
    const plan = planGenerateSequence({
      targets: makeTargets({stale: true}),
      estimate: makeEstimate(),
      preferences: makePreferences(),
      startDate: '2026-07-04'
    })
    const cta = resolveGenerateCtaState(makeCtaInputs({plan}))

    expect(plan.blockedReason).toBeNull()
    expect(cta.isEnabled).toBe(true)
    expect(cta.action).toBe('generate')
  })

  it('generates when the sequence is not blocked', () => {
    const cta = resolveGenerateCtaState(
      makeCtaInputs({plan: makePlan({requiresTargetConfirmation: true, dependsOnEstimate: true})})
    )

    expect(cta.action).toBe('generate')
    expect(cta.isEnabled).toBe(true)
  })

  it('offers manual entry only when the settled state has no figures, never while it is undecided', () => {
    const blocked = makePlan({dependsOnEstimate: true, blockedReason: 'estimate_unavailable'})
    const undecided = resolveGenerateCtaState(makeCtaInputs({plan: blocked, isEstimateLoading: true}))
    const settled = resolveGenerateCtaState(makeCtaInputs({plan: blocked}))

    expect(undecided.action).toBe('generate')
    expect(settled.action).toBe('manual_targets')
    expect(resolveGenerateCtaState(makeCtaInputs({plan: blocked, isPending: true}))).toEqual({
      label: MEAL_PLAN_GENERATE_BUTTON_TEXT,
      isEnabled: false,
      action: 'manual_targets'
    })
  })
})

// The shapes the reads actually produce: an axios rejection carrying the response the server sent, a transport
// failure carrying none, and — for the targets read, which classifies its own bare 404 — the typed error.
const readError = (status: number, code?: string): unknown => ({
  isAxiosError: true,
  response: {status, data: code === undefined ? {} : {error: code}}
})

const NETWORK_ERROR = new Error('Network Error')

const READ_ANSWERED: MealPlanReadStatus = {isSuccess: true, isError: false, error: null}

const READ_PENDING: MealPlanReadStatus = {isSuccess: false, isError: false, error: null}

const failedRead = (error: unknown): MealPlanReadStatus => ({isSuccess: false, isError: true, error})

// The case these derivations exist for: TanStack has flipped the status to error and kept the last successful
// row, so the read has stopped working while its data still reads as an answer.
const failedReadWithRetainedRow = (error: unknown, data: unknown): MealPlanReadStatus & {data: unknown} => ({
  isSuccess: false,
  isError: true,
  error,
  data
})

const REVIEW_START_DATE = '2026-07-04'

const makeFirstVisitPlan = (): GenerateSequencePlan =>
  planGenerateSequence({
    targets: null,
    estimate: null,
    preferences: makePreferences(),
    startDate: REVIEW_START_DATE
  })

describe('isConfirmedEstimateUnavailableError', () => {
  it('recognises the server own 409 verdict', () => {
    expect(isConfirmedEstimateUnavailableError(readError(409, 'estimate_unavailable'))).toBe(true)
  })

  it('refuses the same code carried by an unconfirmed outcome', () => {
    // A gateway 502 says nothing about the user inputs, so routing the press to manual entry on it would ask
    // them to type figures the server never said it could not calculate (0.2.5).
    expect(isConfirmedEstimateUnavailableError(readError(502, 'estimate_unavailable'))).toBe(false)
  })

  it('refuses a transport failure, an undecodable body and every other code', () => {
    expect(isConfirmedEstimateUnavailableError(NETWORK_ERROR)).toBe(false)
    expect(isConfirmedEstimateUnavailableError(readError(500))).toBe(false)
    expect(isConfirmedEstimateUnavailableError(readError(409, 'stale_targets'))).toBe(false)
    expect(isConfirmedEstimateUnavailableError(null)).toBe(false)
  })
})

describe('resolveReviewReadState', () => {
  const makeReadInputs = (overrides: Partial<ReviewReadStateInputs> = {}): ReviewReadStateInputs => ({
    preferences: READ_ANSWERED,
    targets: READ_ANSWERED,
    estimate: READ_ANSWERED,
    dependsOnEstimate: false,
    ...overrides
  })

  it('renders the review, with nothing to retry, once all three reads have answered', () => {
    expect(resolveReviewReadState(makeReadInputs({dependsOnEstimate: true}))).toEqual({
      status: 'ready',
      retryPreferences: false,
      retryTargets: false,
      retryEstimate: false
    })
  })

  it('withholds the review when the preferences read failed while holding its retained row', () => {
    // The finding case: `data` survives a refetch that failed, so a screen keying on data nullity reports a
    // read that has stopped working as settled state and pins a revision nothing stands behind.
    const state = resolveReviewReadState(
      makeReadInputs({preferences: failedReadWithRetainedRow(readError(500), makePreferences())})
    )

    expect(state.status).toBe('failed')
    expect(state.retryPreferences).toBe(true)
  })

  it('withholds the review for a generic estimate failure the press still depends on', () => {
    const state = resolveReviewReadState(
      makeReadInputs({estimate: failedRead(readError(500)), dependsOnEstimate: true})
    )

    expect(state).toEqual({
      status: 'failed',
      retryPreferences: false,
      retryTargets: false,
      retryEstimate: true
    })
  })

  it('keeps the confirmed 409 an answer, so the estimate-unavailable card still shows', () => {
    const state = resolveReviewReadState(
      makeReadInputs({estimate: failedRead(readError(409, 'estimate_unavailable')), dependsOnEstimate: true})
    )

    expect(state.status).toBe('ready')
    expect(state.retryEstimate).toBe(false)
  })

  it('reads an unconfirmed estimate_unavailable as the failure it is', () => {
    const state = resolveReviewReadState(
      makeReadInputs({estimate: failedRead(readError(502, 'estimate_unavailable')), dependsOnEstimate: true})
    )

    expect(state.status).toBe('failed')
    expect(state.retryEstimate).toBe(true)
  })

  it('ignores an estimate failure the press does not depend on', () => {
    // The user own confirmed figures lead the card and the press sends no estimate revision, so blocking the
    // review on an estimate it never shows would replace a settled state with a retry card.
    const state = resolveReviewReadState(
      makeReadInputs({estimate: failedReadWithRetainedRow(NETWORK_ERROR, null), dependsOnEstimate: false})
    )

    expect(state).toEqual({
      status: 'ready',
      retryPreferences: false,
      retryTargets: false,
      retryEstimate: false
    })
  })

  it('leaves a loading estimate to the card skeleton rather than the whole screen', () => {
    // 0.2.5 gives the estimate read a card-level skeleton; the press waits for it through
    // resolveGenerateCtaState instead, so the answers and the start date stay on screen meanwhile.
    expect(resolveReviewReadState(makeReadInputs({estimate: READ_PENDING, dependsOnEstimate: true})).status).toBe(
      'ready'
    )
  })

  it('follows the plan about whether the estimate can still decide the press', () => {
    const estimateDown = failedRead(readError(500))
    const confirmedLead = planGenerateSequence({
      targets: makeTargets(),
      estimate: null,
      preferences: makePreferences(),
      startDate: REVIEW_START_DATE
    })
    const firstVisit = makeFirstVisitPlan()

    expect(firstVisit.dependsOnEstimate).toBe(true)
    expect(confirmedLead.dependsOnEstimate).toBe(false)
    expect(
      resolveReviewReadState(makeReadInputs({estimate: estimateDown, dependsOnEstimate: firstVisit.dependsOnEstimate}))
        .status
    ).toBe('failed')
    expect(
      resolveReviewReadState(
        makeReadInputs({estimate: estimateDown, dependsOnEstimate: confirmedLead.dependsOnEstimate})
      ).status
    ).toBe('ready')
  })

  it('keeps the review on a routes-missing targets answer, in either form it arrives', () => {
    // A rolled-back targets route is an answer, not a failure: the local target stands and the card renders
    // exactly as it does for a user who never opted in (AAP 0.7.5).
    const thrown = resolveReviewReadState(
      makeReadInputs({targets: failedRead(new RoutesMissingError('/meal-planning/targets'))})
    )
    const bare404 = resolveReviewReadState(
      makeReadInputs({targets: failedReadWithRetainedRow(readError(404), makeTargets())})
    )

    expect(thrown.status).toBe('ready')
    expect(thrown.retryTargets).toBe(false)
    expect(bare404.status).toBe('ready')
    expect(bare404.retryTargets).toBe(false)
  })

  it('reproduces the targets read-failure treatment for every other targets error', () => {
    const errors = [readError(500), NETWORK_ERROR, readError(404, 'Targets not found')]

    errors.forEach(error => {
      const read = failedReadWithRetainedRow(error, makeTargets())
      const state = resolveReviewReadState(makeReadInputs({targets: read}))

      expect(isNutritionTargetsReadFailure(read)).toBe(true)
      expect(state.status).toBe('failed')
      expect(state.retryTargets).toBe(true)
    })
  })

  it('reports a gated read capability answer as unavailable, with nothing to retry', () => {
    // /meal-planning/preferences is a gated, resource-less GET: a bare 404 means a backend rolled back past the
    // routes and a confirmed 503 means the capability is switched off (0.2.5). Neither changes on a retry.
    const bare404 = resolveReviewReadState(
      makeReadInputs({preferences: failedReadWithRetainedRow(readError(404), makePreferences())})
    )
    const disabled = resolveReviewReadState(
      makeReadInputs({preferences: failedRead(readError(503, 'feature_disabled'))})
    )

    expect(bare404).toEqual({
      status: 'unavailable',
      retryPreferences: false,
      retryTargets: false,
      retryEstimate: false
    })
    expect(disabled.status).toBe('unavailable')
    expect(disabled.retryPreferences).toBe(false)
  })

  it('lets an absent capability outrank a failure, since no retry can change it', () => {
    const state = resolveReviewReadState(
      makeReadInputs({preferences: failedRead(readError(404)), targets: failedRead(readError(500))})
    )

    expect(state.status).toBe('unavailable')
  })

  it('waits while a read this screen is built on has not answered', () => {
    expect(resolveReviewReadState(makeReadInputs({preferences: READ_PENDING})).status).toBe('loading')
    expect(resolveReviewReadState(makeReadInputs({targets: READ_PENDING})).status).toBe('loading')
  })

  it('names exactly the reads a retry must refetch', () => {
    const state = resolveReviewReadState(
      makeReadInputs({
        preferences: failedReadWithRetainedRow(readError(500), makePreferences()),
        targets: failedRead(new RoutesMissingError('/meal-planning/targets')),
        estimate: failedRead(NETWORK_ERROR),
        dependsOnEstimate: true
      })
    )
    const targetsOnly = resolveReviewReadState(makeReadInputs({targets: failedRead(NETWORK_ERROR)}))

    expect(state).toEqual({
      status: 'failed',
      retryPreferences: true,
      retryTargets: false,
      retryEstimate: true
    })
    expect(targetsOnly).toEqual({
      status: 'failed',
      retryPreferences: false,
      retryTargets: true,
      retryEstimate: false
    })
  })

  it('hands the CTA a read failure for both withholding states, so neither generates', () => {
    const plan = makeFirstVisitPlan()
    const preferencesReads = [failedRead(readError(500)), failedRead(readError(404))]

    preferencesReads.forEach(preferences => {
      const state = resolveReviewReadState(makeReadInputs({preferences, dependsOnEstimate: plan.dependsOnEstimate}))
      const cta = resolveGenerateCtaState({
        plan,
        isEstimateLoading: false,
        isPending: false,
        hasReadFailure: state.status === 'failed' || state.status === 'unavailable'
      })

      expect(state.status).not.toBe('ready')
      expect(cta.isEnabled).toBe(false)
    })
  })

  it('stops a generic estimate failure from reaching the manual-entry press', () => {
    const plan = makeFirstVisitPlan()
    const state = resolveReviewReadState(
      makeReadInputs({estimate: failedRead(readError(500)), dependsOnEstimate: plan.dependsOnEstimate})
    )
    const cta = resolveGenerateCtaState({
      plan,
      isEstimateLoading: false,
      isPending: false,
      hasReadFailure: state.status === 'failed' || state.status === 'unavailable'
    })

    // The plan still reads as figureless, because the estimate never arrived — so it is the read state that has
    // to withhold the press the server never answered for.
    expect(plan.blockedReason).toBe('estimate_unavailable')
    expect(state.status).toBe('failed')
    expect(cta.action).toBe('manual_targets')
    expect(cta.isEnabled).toBe(false)
  })
})

const START_DATE = '2026-07-06'

const TIME_ZONE = 'America/New_York'

const ESTIMATE_FIGURES = {calories: 2100, protein: 150, carbs: 220, fat: 70}

const makeSequenceTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
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

const makeSequenceEstimate = (overrides: Partial<NutritionTargetEstimate> = {}): NutritionTargetEstimate => ({
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

const makeSequencePreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
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
  targets: makeSequenceTargets({revision}),
  feasibility: {ok: true, warnings: []}
})

const makeSaveStepResult = (revision: number): MealPlanPreferencesSaveResult => ({
  preferences: makeSequencePreferences({revision, reviewStartDate: START_DATE}),
  affectedMealCount: 0
})

// The error shape getApiErrorCode reads: a status with a decodable `{error}` body.
const apiError = (code: string, status = 409): unknown => ({response: {status, data: {error: code}}})

const MINTED_KEY = 'minted-key'

interface Behaviour {
  saveTargets?: (payload: SaveNutritionTargetsPayload) => Promise<SaveNutritionTargetsResult>
  saveSetupStep?: (variables: SetupStepRequest) => Promise<MealPlanPreferencesSaveResult>
  refetchedTargets?: NutritionTargets | null
  refetchedPreferences?: MealPlanPreferences | null
  // Whether the refetch itself failed. Distinct from the row it would have answered with, because that is the
  // distinction recovery turns on: a failed refetch has no authoritative figures at all, while the values
  // above are what a refetch that reached the server reported.
  targetsRefetchFails?: boolean
  preferencesRefetchFails?: boolean
  estimateRefetchFails?: boolean
}

interface Fakes {
  collaborators: GenerateSequenceCollaborators
  // Every collaborator call in the order it happened, which is what pins the ordering rules.
  calls: string[]
  targetsPayloads: SaveNutritionTargetsPayload[]
  stepVariables: SetupStepRequest[]
  navigations: GeneratingRouteParams[]
  mintedKeys: string[]
}

const makeFakes = (behaviour: Behaviour = {}): Fakes => {
  const calls: string[] = []
  const targetsPayloads: SaveNutritionTargetsPayload[] = []
  const stepVariables: SetupStepRequest[] = []
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

      return Promise.resolve(
        behaviour.targetsRefetchFails === true
          ? {status: 'failed' as const}
          : {status: 'ok' as const, data: behaviour.refetchedTargets ?? null}
      )
    },
    refetchPreferences: () => {
      calls.push('refetchPreferences')

      return Promise.resolve(
        behaviour.preferencesRefetchFails === true
          ? {status: 'failed' as const}
          : {status: 'ok' as const, data: behaviour.refetchedPreferences ?? null}
      )
    },
    refetchEstimate: () => {
      calls.push('refetchEstimate')

      return Promise.resolve(
        behaviour.estimateRefetchFails === true ? {status: 'failed' as const} : {status: 'ok' as const, data: null}
      )
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
const runSequence = async (fakes: Fakes, overrides: RunOverrides = {}) =>
  runGenerateSequence({
    targets: overrides.targets === undefined ? makeUnconfirmedTargets(3) : overrides.targets,
    estimate: overrides.estimate === undefined ? makeSequenceEstimate() : overrides.estimate,
    preferences: overrides.preferences ?? makeSequencePreferences(),
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

    const outcome = await runSequence(fakes)

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

    await runSequence(fakes)

    expect(fakes.navigations[0].expectedTargetsRevision).toBe(21)
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(22)
  })

  it('attempts neither the start-date save nor navigation once the targets save fails', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.reject(apiError('boom', 500))})

    const outcome = await runSequence(fakes)

    expect(fakes.calls).toEqual(['saveTargets'])
    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('does not navigate when the start-date save fails', async () => {
    const fakes = makeFakes({saveSetupStep: () => Promise.reject(apiError('boom', 500))})

    const outcome = await runSequence(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'saveSetupStep'])
    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('keeps the confirmed targets revision after the start-date save fails', async () => {
    const fakes = makeFakes({saveSetupStep: () => Promise.reject(apiError('boom', 500))})

    const outcome = await runSequence(fakes)

    expect(outcome.commitments).toEqual({confirmedTargetsRevision: 11, savedStartDate: null})
  })

  it('sends the review step with the chosen date, the screen time zone and the live revision', async () => {
    const fakes = makeFakes()

    await runSequence(fakes)

    expect(fakes.stepVariables).toEqual([
      {step: 'review', payload: {startDate: START_DATE, timeZone: TIME_ZONE, expectedRevision: 7}}
    ])
  })

  it('skips the start-date save when the row already holds the chosen date', async () => {
    const fakes = makeFakes()

    await runSequence(fakes, {preferences: makeSequencePreferences({reviewStartDate: START_DATE})})

    expect(fakes.calls).toEqual(['saveTargets', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(7)
  })

  it('carries the nextWeek context when the route supplied a successor start date', async () => {
    const fakes = makeFakes()

    await runSequence(fakes, {planStartDate: START_DATE})

    expect(fakes.navigations[0].context).toEqual({kind: 'nextWeek', startDate: START_DATE})
  })
})

describe('runGenerateSequence selective retry', () => {
  it('skips the confirmation while the recorded revision is still the live one, and carries it', async () => {
    const fakes = makeFakes()

    const outcome = await runSequence(fakes, {
      targets: makeUnconfirmedTargets(5),
      commitments: {confirmedTargetsRevision: 5, savedStartDate: null}
    })

    expect(fakes.calls).toEqual(['saveSetupStep', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(5)
    expect(outcome.commitments.confirmedTargetsRevision).toBe(5)
  })

  it('carries the fresh revision, not the recorded one, once an edit has moved the targets on', async () => {
    const fakes = makeFakes()

    const outcome = await runSequence(fakes, {
      targets: makeSequenceTargets({source: 'manual', revision: 6}),
      commitments: {confirmedTargetsRevision: 5, savedStartDate: null}
    })

    expect(fakes.calls).toEqual(['saveSetupStep', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(6)
    expect(outcome.commitments.confirmedTargetsRevision).toBeNull()
  })

  it('confirms again against the fresh revision when the recorded one is obsolete', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.resolve(makeSaveTargetsResult(7))})

    await runSequence(fakes, {
      targets: makeUnconfirmedTargets(6),
      commitments: {confirmedTargetsRevision: 5, savedStartDate: null}
    })

    expect(fakes.targetsPayloads).toEqual([{source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 6}])
    expect(fakes.navigations[0].expectedTargetsRevision).toBe(7)
  })

  it('skips the start-date save while the recorded save is still the live revision', async () => {
    const fakes = makeFakes()

    const outcome = await runSequence(fakes, {
      commitments: {confirmedTargetsRevision: null, savedStartDate: {date: START_DATE, revision: 7}}
    })

    expect(fakes.calls).toEqual(['saveTargets', 'mintIdempotencyKey', 'navigateToGenerating'])
    expect(fakes.navigations[0].expectedPreferencesRevision).toBe(7)
    expect(outcome.commitments.savedStartDate).toEqual({date: START_DATE, revision: 7})
  })

  it('re-sends the start date pinned to the live revision when another answer has moved it', async () => {
    const fakes = makeFakes()

    await runSequence(fakes, {
      preferences: makeSequencePreferences({revision: 8}),
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

    await runSequence(fakes, {
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

    const outcome = await runSequence(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'refetchEstimate'])
    expect(outcome.status).toBe('estimate_stale')
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('reports an ordinary failure when the estimate refresh itself failed', async () => {
    // The 'estimate_stale' outcome tells the user the figures on the card have been recalculated. A refresh
    // that never reached the server leaves the old figures there, so reporting it would name numbers the card
    // does not show.
    const fakes = makeFakes({
      saveTargets: () => Promise.reject(apiError('estimate_stale')),
      estimateRefetchFails: true
    })

    const outcome = await runSequence(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'refetchEstimate'])
    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
  })
})

describe('runGenerateSequence rejected targets revision', () => {
  it('resolves silently and continues when the refetched figures equal the asserted estimate', async () => {
    const fakes = makeFakes({
      saveTargets: () => Promise.reject(apiError('stale_targets')),
      refetchedTargets: makeSequenceTargets({revision: 9})
    })

    const outcome = await runSequence(fakes)

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
      refetchedTargets: makeSequenceTargets({targets: {calories: 1800, protein: 140, carbs: 180, fat: 60}, revision: 9})
    })

    const outcome = await runSequence(fakes)

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
      refetchedTargets: makeSequenceTargets({revision: 9})
    })

    const outcome = await runSequence(fakes, {
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

    const outcome = await runSequence(fakes)

    expect(outcome.status).toBe('failed')
    expect(fakes.calls).toEqual(['saveTargets', 'refetchTargets'])
  })

  it('fails rather than reading a failed refetch as proof the refused confirmation had landed', async () => {
    // The row a failed refetch leaves behind is the pre-save cache, whose figures are exactly the ones this
    // press asserted — so read as an answer it matches, and a save the server rejected is reported as
    // already written and a plan generated against it. Only a refetch that reached the server can settle it.
    const fakes = makeFakes({
      saveTargets: () => Promise.reject(apiError('stale_targets')),
      refetchedTargets: makeTargets({revision: 9}),
      targetsRefetchFails: true
    })

    const outcome = await runSequence(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'refetchTargets'])
    expect(outcome.status).toBe('failed')
    expect(outcome.commitments.confirmedTargetsRevision).toBeNull()
    expect(fakes.navigations).toHaveLength(0)
    expect(fakes.mintedKeys).toHaveLength(0)
  })

  it('re-sends the refused confirmation against the refetched revision when the user keeps theirs', async () => {
    const fakes = makeFakes({saveTargets: () => Promise.resolve(makeSaveTargetsResult(10))})
    const conflict: GenerateRevisionConflict = {
      step: 'targets',
      payload: {source: 'estimated', estimateRevision: 9, expectedTargetsRevision: 9}
    }

    const outcome = await runSequence(fakes, {
      // The refetch has already replaced the card with the server's own figures; a re-derived plan would ask
      // for no confirmation at all, so only the answered conflict can re-assert the user's estimate.
      targets: makeSequenceTargets({source: 'manual', revision: 9}),
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
      refetchedPreferences: makeSequencePreferences({reviewStartDate: START_DATE, revision: 13})
    })

    const outcome = await runSequence(fakes)

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
      refetchedPreferences: makeSequencePreferences({reviewStartDate: '2026-07-09', revision: 13})
    })

    const outcome = await runSequence(fakes)

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

  it('fails rather than reading a failed refetch as proof the refused start date had landed', async () => {
    const fakes = makeFakes({
      saveSetupStep: () => Promise.reject(apiError('stale_revision')),
      refetchedPreferences: makePreferences({reviewStartDate: START_DATE, revision: 13}),
      preferencesRefetchFails: true
    })

    const outcome = await runSequence(fakes)

    expect(fakes.calls).toEqual(['saveTargets', 'saveSetupStep', 'refetchPreferences'])
    expect(outcome.status).toBe('failed')
    expect(outcome.commitments.savedStartDate).toBeNull()
    expect(fakes.navigations).toHaveLength(0)
  })

  it('re-sends the chosen date against the refetched revision when the user keeps theirs', async () => {
    const fakes = makeFakes()

    const outcome = await runSequence(fakes, {
      // The refetched row now holds the other device's date, so the plan would no longer ask for this save on
      // its own: the answered conflict is what re-sends it, pinned to the revision the refetch reported.
      preferences: makeSequencePreferences({reviewStartDate: '2026-07-09', revision: 13}),
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

    const outcome = await runSequence(fakes)

    expect(outcome.status).toBe('failed')
    expect(fakes.navigations).toHaveLength(0)
  })
})

describe('runGenerateSequence idempotency key', () => {
  it('mints the key inside the navigating call, after both saves have settled', async () => {
    const fakes = makeFakes()

    await runSequence(fakes)

    expect(fakes.calls.indexOf('mintIdempotencyKey')).toBe(fakes.calls.indexOf('navigateToGenerating') - 1)
    expect(fakes.calls.indexOf('mintIdempotencyKey')).toBeGreaterThan(fakes.calls.indexOf('saveSetupStep'))
    expect(fakes.mintedKeys).toEqual([MINTED_KEY])
  })

  it('mints one key per navigating run and none for a run that navigates nowhere', async () => {
    const navigating = makeFakes()
    const failing = makeFakes({saveTargets: () => Promise.reject(apiError('boom', 500))})

    await runSequence(navigating)
    await runSequence(navigating)
    await runSequence(failing)

    expect(navigating.mintedKeys).toHaveLength(2)
    expect(failing.mintedKeys).toHaveLength(0)
  })
})

describe('authoritativeEstimate', () => {
  const RETAINED = makeEstimate({estimateRevision: 9})
  const CONFIRMED_UNAVAILABLE = readError(409, API_ERROR_CODES.estimateUnavailable)

  it('returns the estimate while the read succeeded', () => {
    expect(authoritativeEstimate({isSuccess: true, data: RETAINED})).toBe(RETAINED)
  })

  it('returns null for a successful read that carries no estimate', () => {
    expect(authoritativeEstimate({isSuccess: true, data: undefined})).toBeNull()
  })

  it('withholds a retained estimate after a confirmed estimate_unavailable', () => {
    // The whole point: `estimate_unavailable` is classified as an *answer* rather than a failure, so nothing
    // else in the read state stops the retained estimate — this gate does.
    expect(isConfirmedEstimateUnavailableError(CONFIRMED_UNAVAILABLE)).toBe(true)
    expect(authoritativeEstimate({isSuccess: false, data: RETAINED})).toBeNull()
  })

  it('withholds a retained estimate after a generic failure too', () => {
    expect(authoritativeEstimate({isSuccess: false, data: RETAINED})).toBeNull()
  })

  describe('a confirmed estimate_unavailable arriving after a good estimate', () => {
    // The read as TanStack leaves it: status flipped to error, last successful estimate still in `data`.
    const read = {isSuccess: false, isError: true, error: CONFIRMED_UNAVAILABLE, data: RETAINED}
    const withheld = authoritativeEstimate(read)
    const preferences = makePreferences()

    it('shows the unavailable treatment instead of the retained figures', () => {
      const displayed = resolveDisplayedTargets({targets: null, estimate: withheld, preferences})

      // Were the estimate read, this would be 'estimate' and the card branch on it is tested before
      // `isEstimateUnavailable`, so the stale figures would render over the manual-entry card.
      expect(displayed.source).toBe('unavailable')
      expect(resolveDisplayedTargets({targets: null, estimate: RETAINED, preferences}).source).toBe('estimate')
    })

    it('exposes no confirmation path for the withheld estimate', () => {
      const plan = planGenerateSequence({
        targets: null,
        estimate: withheld,
        preferences,
        startDate: REVIEW_START_DATE
      })

      expect(plan.requiresTargetConfirmation).toBe(false)
      expect(plan.estimateRevision).toBeNull()
      expect(buildTargetConfirmationPayload(plan)).toBeNull()
      // A blocked press routes to manual entry rather than confirming figures the server refused.
      expect(plan.blockedReason).not.toBeNull()
    })

    it('still depends on the estimate, so the read state keeps composing its answer', () => {
      const plan = planGenerateSequence({
        targets: null,
        estimate: withheld,
        preferences,
        startDate: REVIEW_START_DATE
      })

      // Withholding the estimate must not make the screen stop caring about the estimate read — that would
      // undo the generic-failure composition this file also pins.
      expect(plan.dependsOnEstimate).toBe(true)
      expect(
        resolveReviewReadState({
          preferences: READ_ANSWERED,
          targets: READ_ANSWERED,
          estimate: failedRead(NETWORK_ERROR),
          dependsOnEstimate: plan.dependsOnEstimate
        })
      ).toMatchObject({status: 'failed', retryEstimate: true})
    })
  })
})
