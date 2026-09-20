import {DislikedFoodSummary, MealPlanPreferences, MealTimeEntry} from '@data/models/MealPlanPreferences'
import {MealSlot} from '@data/models/Recipe'
import {isDislikeSelectionAtCap, MAX_DISLIKED_FOOD_IDS} from '@utility/DislikeSelectionUtility'

import {
  ALLERGEN_NONE,
  answerBodySkipped,
  applyAllergenSelection,
  applyBudgetAmount,
  applyLifecycleEvent,
  applyMealSchedule,
  applyNoBudgetPreference,
  beginDislikeStaging,
  clearsSetupDraft,
  clearStagedDislikes,
  commitDislikeStaging,
  completedSteps,
  createEmptyDraft,
  DEFAULT_MEAL_TIMES,
  discardDislikeStaging,
  discardStepEdits,
  DRAFT_FIELDS_BY_STEP,
  isStepComplete,
  markStepSaved,
  MealPlanSetupDirty,
  MealPlanSetupDraft,
  MealPlanSetupDraftState,
  MealPlanSetupLifecycleEvent,
  MealPlanSetupStep,
  removeStagedDislike,
  seedDraftFromPreferences,
  setDislikedFoodIds,
  setMealTime,
  setStepFields,
  SETUP_STEPS_ESTIMATED,
  SETUP_STEPS_MANUAL,
  stagedDislikes,
  STEP_INDEPENDENT_DRAFT_KEYS,
  stepsForRoute,
  toggleDislikedFood,
  toggleDislikedFoodId,
  toggleStagedDislike
} from '../index.util'

const makeDraft = (overrides: Partial<MealPlanSetupDraft> = {}): MealPlanSetupDraft => ({
  ...createEmptyDraft().draft,
  ...overrides
})

const makeDirty = (overrides: Partial<MealPlanSetupDirty> = {}): MealPlanSetupDirty => ({
  ...createEmptyDraft().dirty,
  ...overrides
})

const makeState = (
  draft: Partial<MealPlanSetupDraft> = {},
  dirty: Partial<MealPlanSetupDirty> = {},
  seeded = false,
  bodyAnswered = false
): MealPlanSetupDraftState => ({
  ...createEmptyDraft(),
  draft: makeDraft(draft),
  dirty: makeDirty(dirty),
  seeded,
  bodyAnswered
})

const ALL_DIRTY: MealPlanSetupDirty = {
  goal: true,
  body: true,
  activity: true,
  diet: true,
  dislikes: true,
  schedule: true,
  cooking: true
}

const LIFECYCLE_EVENTS: MealPlanSetupLifecycleEvent[] = [
  'setup_completed',
  'setup_dismissed',
  'signed_out',
  'flow_exited',
  'step_saved'
]

const CLEARING_EVENTS: MealPlanSetupLifecycleEvent[] = [
  'setup_completed',
  'setup_dismissed',
  'signed_out',
  'flow_exited'
]

const makeCompleteDraft = (overrides: Partial<MealPlanSetupDraft> = {}): MealPlanSetupDraft =>
  makeDraft({
    goal: 'lose',
    goalWeightKg: 77.1,
    paceLbPerWeek: 1,
    age: 34,
    heightCm: 177.8,
    weightKg: 82.6,
    sexForEstimate: 'female',
    heightUnitPref: 'ft_in',
    weightUnitPref: 'lb',
    activityLevel: 'lightly_active',
    diet: 'none',
    allergens: [ALLERGEN_NONE],
    mealSchedule: 'three',
    mealTimes: [
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'}
    ],
    cookingTimeLimitMin: 30,
    noBudgetPreference: true,
    timeZone: 'America/New_York',
    ...overrides
  })

const makeCompleteState = (overrides: Partial<MealPlanSetupDraft> = {}): MealPlanSetupDraftState =>
  makeState(makeCompleteDraft(overrides))

const makePreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences => ({
  setupStatus: 'in_progress',
  setupStep: 'cooking',
  reviewStartDate: '2026-07-05',
  timeZone: 'America/New_York',
  targetRoute: 'estimated',
  revision: 4,
  goal: 'lose',
  goalWeightKg: 77.1,
  paceLbPerWeek: 1,
  age: 34,
  heightCm: 177.8,
  weightKg: 82.6,
  sexForEstimate: 'female',
  heightUnitPref: 'ft_in',
  weightUnitPref: 'lb',
  activityLevel: 'lightly_active',
  diet: 'vegetarian',
  allergens: ['milk', 'peanuts'],
  dislikedFoods: [
    {id: 'food-mushroom', name: 'Mushrooms, white', foodGroup: 'mushroom'},
    {id: 'food-olive', name: 'Olives', foodGroup: 'olive'}
  ],
  dislikedFoodGroups: ['mushroom'],
  mealSchedule: 'three_plus_snack',
  mealTimes: [
    {slot: 'breakfast', time: '07:15'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'},
    {slot: 'snack', time: '15:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: {amount: 120, currency: 'USD'},
  noBudgetPreference: false,
  budgetTier: 2,
  hasActivePlan: true,
  ...overrides
})

// A user who answered the body step with Skip, exactly as the server stores it: the manual target
// route is on record, the resume marker sits on the manual target screen, and not one measurement
// was written — Skip sends `{skipped: true}` and the server writes no measurement columns for it.
// Every other step of this fixture is answered, so the manual route's six steps are all complete.
const makeSkippedBodyPreferences = (overrides: Partial<MealPlanPreferences> = {}): MealPlanPreferences =>
  makePreferences({
    targetRoute: 'manual',
    setupStep: 'targets_manual',
    age: null,
    heightCm: null,
    weightKg: null,
    sexForEstimate: null,
    heightUnitPref: null,
    weightUnitPref: null,
    activityLevel: null,
    ...overrides
  })

// A dislike selection of any size the 100-id bound cares about. The ids are generated rather than written
// out because the reducers validate none of them against a catalog — only how many distinct ones there are.
const dislikeIds = (count: number): string[] => Array.from({length: count}, (_, index) => `food-${index}`)

const savedDislikedFoods = (count: number): DislikedFoodSummary[] =>
  dislikeIds(count).map((id, index) => ({id, name: `Food ${index}`, foodGroup: 'other'}))

describe('createEmptyDraft', () => {
  it('preselects nothing, so a first-entry wizard shows no answers', () => {
    expect(createEmptyDraft().draft).toEqual({
      goal: null,
      goalWeightKg: null,
      paceLbPerWeek: null,
      age: null,
      heightCm: null,
      weightKg: null,
      sexForEstimate: null,
      heightUnitPref: null,
      weightUnitPref: null,
      activityLevel: null,
      diet: null,
      allergens: [],
      dislikedFoodIds: [],
      dislikedFoodGroups: [],
      mealSchedule: null,
      mealTimes: [],
      cookingTimeLimitMin: null,
      budget: null,
      noBudgetPreference: false,
      timeZone: null
    })
  })

  it('starts noBudgetPreference at false even though the mock draws the checkbox checked', () => {
    expect(createEmptyDraft().draft.noBudgetPreference).toBe(false)
  })

  it('leaves both unit preferences null for the screen to seed', () => {
    const {draft} = createEmptyDraft()

    expect(draft.heightUnitPref).toBeNull()
    expect(draft.weightUnitPref).toBeNull()
  })

  it('starts every step clean', () => {
    expect(createEmptyDraft().dirty).toEqual({
      goal: false,
      body: false,
      activity: false,
      diet: false,
      dislikes: false,
      schedule: false,
      cooking: false
    })
  })

  it('returns an equal but independent state on each call', () => {
    const first = createEmptyDraft()
    const second = createEmptyDraft()

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(first.draft).not.toBe(second.draft)
    expect(first.draft.allergens).not.toBe(second.draft.allergens)
    expect(first.dirty).not.toBe(second.dirty)
  })

  it('hands out arrays the caller can push to without touching the next draft', () => {
    createEmptyDraft().draft.allergens.push('milk')

    expect(createEmptyDraft().draft.allergens).toEqual([])
  })
})

describe('seedDraftFromPreferences', () => {
  it('copies every editable preference member through', () => {
    const {draft} = seedDraftFromPreferences(makePreferences())

    expect(draft).toEqual({
      goal: 'lose',
      goalWeightKg: 77.1,
      paceLbPerWeek: 1,
      age: 34,
      heightCm: 177.8,
      weightKg: 82.6,
      sexForEstimate: 'female',
      heightUnitPref: 'ft_in',
      weightUnitPref: 'lb',
      activityLevel: 'lightly_active',
      diet: 'vegetarian',
      allergens: ['milk', 'peanuts'],
      dislikedFoodIds: ['food-mushroom', 'food-olive'],
      dislikedFoodGroups: ['mushroom'],
      mealSchedule: 'three_plus_snack',
      mealTimes: [
        {slot: 'breakfast', time: '07:15'},
        {slot: 'lunch', time: '12:30'},
        {slot: 'dinner', time: '18:30'},
        {slot: 'snack', time: '15:30'}
      ],
      cookingTimeLimitMin: 30,
      budget: {amount: 120, currency: 'USD'},
      noBudgetPreference: false,
      timeZone: 'America/New_York'
    })
  })

  it('normalises a saved budget to the one currency this release sends, keeping the amount', () => {
    const {draft} = seedDraftFromPreferences(makePreferences({budget: {amount: 90, currency: 'EUR'}}))

    expect(draft.budget).toEqual({amount: 90, currency: 'USD'})
  })

  it('reduces the fetched disliked foods to their ids in the order the server sent them', () => {
    const preferences = makePreferences({
      dislikedFoods: [
        {id: 'food-olive', name: 'Olives', foodGroup: 'olive'},
        {id: 'food-cilantro', name: 'Cilantro', foodGroup: 'herb'},
        {id: 'food-mushroom', name: 'Mushrooms, white', foodGroup: 'mushroom'}
      ]
    })

    expect(seedDraftFromPreferences(preferences).draft.dislikedFoodIds).toEqual([
      'food-olive',
      'food-cilantro',
      'food-mushroom'
    ])
  })

  it('yields no disliked ids when the server sent an empty list', () => {
    expect(seedDraftFromPreferences(makePreferences({dislikedFoods: []})).draft.dislikedFoodIds).toEqual([])
  })

  it('keeps repeated disliked ids exactly as the server sent them', () => {
    const preferences = makePreferences({
      dislikedFoods: [
        {id: 'food-olive', name: 'Olives', foodGroup: 'olive'},
        {id: 'food-olive', name: 'Olives', foodGroup: 'olive'}
      ]
    })

    expect(seedDraftFromPreferences(preferences).draft.dislikedFoodIds).toEqual(['food-olive', 'food-olive'])
  })

  it('omits every server-owned member so a save can never send a read-only field', () => {
    const keys = Object.keys(seedDraftFromPreferences(makePreferences()).draft)

    expect(keys).not.toContain('setupStatus')
    expect(keys).not.toContain('setupStep')
    expect(keys).not.toContain('revision')
    expect(keys).not.toContain('budgetTier')
    expect(keys).not.toContain('hasActivePlan')
    expect(keys).not.toContain('targetRoute')
    expect(keys).not.toContain('reviewStartDate')
    expect(keys).not.toContain('dislikedFoods')
    // The body-answer marker is state, not a draft field: it is derived from the server-owned
    // route, so a save must never carry it either.
    expect(keys).not.toContain('bodyAnswered')
  })

  it('marks no step dirty, because seeding is not a user edit', () => {
    expect(seedDraftFromPreferences(makePreferences()).dirty).toEqual(makeDirty())
  })

  it('falls back to the empty draft when there are no saved preferences', () => {
    expect(seedDraftFromPreferences(null)).toEqual(createEmptyDraft())
    expect(seedDraftFromPreferences(undefined)).toEqual(createEmptyDraft())
  })

  it('keeps unanswered members null rather than undefined', () => {
    const {draft} = seedDraftFromPreferences(
      makePreferences({
        goal: null,
        goalWeightKg: null,
        paceLbPerWeek: null,
        age: null,
        heightCm: null,
        weightKg: null,
        sexForEstimate: null,
        heightUnitPref: null,
        weightUnitPref: null,
        activityLevel: null,
        diet: null,
        allergens: [],
        mealSchedule: null,
        mealTimes: [],
        cookingTimeLimitMin: null,
        budget: null,
        timeZone: null
      })
    )

    expect(draft.goal).toBeNull()
    expect(draft.age).toBeNull()
    expect(draft.heightUnitPref).toBeNull()
    expect(draft.weightUnitPref).toBeNull()
    expect(draft.budget).toBeNull()
    expect(draft.timeZone).toBeNull()
    expect(Object.values(draft).every(value => value !== undefined)).toBe(true)
  })

  // The bound refuses additions; it never trims. A row stored at the server's maximum must therefore seed
  // whole, and stay editable.
  it('keeps a stored selection of the full 100 ids, and still removes from it', () => {
    const seeded = seedDraftFromPreferences(makePreferences({dislikedFoods: savedDislikedFoods(100)}))

    expect(seeded.draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
    expect(Object.keys(seeded.dislikeLabels)).toHaveLength(MAX_DISLIKED_FOOD_IDS)
    expect(toggleDislikedFoodId(seeded, 'food-0').draft.dislikedFoodIds).toHaveLength(99)
  })

  it('does not mutate the preferences it reads', () => {
    const preferences = makePreferences()
    const snapshot = makePreferences()
    const {draft} = seedDraftFromPreferences(preferences)

    draft.allergens.push('sesame')
    draft.dislikedFoodGroups.push('olive')
    draft.dislikedFoodIds.push('food-tofu')
    draft.mealTimes[0].time = '05:00'

    expect(preferences).toEqual(snapshot)
    expect(preferences.allergens).not.toBe(draft.allergens)
    expect(preferences.mealTimes).not.toBe(draft.mealTimes)
    expect(preferences.budget).not.toBe(draft.budget)
  })
})

describe('setStepFields', () => {
  it('merges the given fields and keeps the answers it was not given', () => {
    const state = makeState({age: 34, heightCm: 177.8})
    const result = setStepFields(state, 'body', {weightKg: 82.6, sexForEstimate: 'male'})

    expect(result.draft.age).toBe(34)
    expect(result.draft.heightCm).toBe(177.8)
    expect(result.draft.weightKg).toBe(82.6)
    expect(result.draft.sexForEstimate).toBe('male')
  })

  it('marks only the step it was given dirty', () => {
    const result = setStepFields(makeState(), 'body', {age: 34})

    expect(result.dirty).toEqual(makeDirty({body: true}))
  })

  it('keeps a step dirty across a second edit', () => {
    const first = setStepFields(makeState(), 'goal', {goal: 'lose'})
    const second = setStepFields(first, 'goal', {paceLbPerWeek: 1.5})

    expect(second.dirty).toEqual(makeDirty({goal: true}))
    expect(second.draft.goal).toBe('lose')
    expect(second.draft.paceLbPerWeek).toBe(1.5)
  })

  it('leaves the input state untouched and returns new objects', () => {
    const state = makeState({age: 34})
    const result = setStepFields(state, 'body', {age: 41})

    expect(state.draft.age).toBe(34)
    expect(state.dirty.body).toBe(false)
    expect(result).not.toBe(state)
    expect(result.draft).not.toBe(state.draft)
    expect(result.dirty).not.toBe(state.dirty)
  })
})

describe('applyAllergenSelection', () => {
  describe('the None sentinel', () => {
    it('clears every named allergy when None is selected', () => {
      const state = makeState({allergens: ['milk', 'eggs', 'peanuts']})

      expect(applyAllergenSelection(state, ALLERGEN_NONE).draft.allergens).toEqual(['none'])
    })

    it('drops None when a named allergy is selected', () => {
      const state = makeState({allergens: [ALLERGEN_NONE]})

      expect(applyAllergenSelection(state, 'shellfish').draft.allergens).toEqual(['shellfish'])
    })

    it('yields an empty list when None itself is de-selected', () => {
      const state = makeState({allergens: [ALLERGEN_NONE]})

      expect(applyAllergenSelection(state, ALLERGEN_NONE).draft.allergens).toEqual([])
    })
  })

  describe('named allergies', () => {
    it('accumulates each of the nine named allergies', () => {
      const named = ['milk', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']
      const result = named.reduce(applyAllergenSelection, makeState())

      expect(result.draft.allergens).toEqual(named)
    })

    it('de-selects a value that is already selected', () => {
      const state = makeState({allergens: ['milk', 'eggs']})

      expect(applyAllergenSelection(state, 'milk').draft.allergens).toEqual(['eggs'])
    })

    it('never lists the same allergy twice', () => {
      const state = makeState({allergens: ['milk']})
      const removed = applyAllergenSelection(state, 'milk')
      const readded = applyAllergenSelection(removed, 'milk')

      expect(removed.draft.allergens).toEqual([])
      expect(readded.draft.allergens).toEqual(['milk'])
    })

    it('yields an empty list, not the None sentinel, when the last named allergy is removed', () => {
      const state = makeState({allergens: ['sesame']})

      expect(applyAllergenSelection(state, 'sesame').draft.allergens).toEqual([])
      expect(applyAllergenSelection(state, 'sesame').draft.allergens).not.toEqual([ALLERGEN_NONE])
    })
  })

  it('marks only the diet step dirty', () => {
    expect(applyAllergenSelection(makeState(), 'milk').dirty).toEqual(makeDirty({diet: true}))
  })

  it('leaves the input state and its allergen array untouched', () => {
    const allergens = ['milk']
    const state = makeState({allergens})
    const result = applyAllergenSelection(state, 'eggs')

    expect(allergens).toEqual(['milk'])
    expect(state.draft.allergens).toEqual(['milk'])
    expect(state.dirty.diet).toBe(false)
    expect(result).not.toBe(state)
    expect(result.draft).not.toBe(state.draft)
    expect(result.draft.allergens).not.toBe(state.draft.allergens)
  })
})

describe('toggleDislikedFoodId / setDislikedFoodIds', () => {
  it('adds an id that is not selected yet and keeps the existing ones', () => {
    const state = makeState({dislikedFoodIds: ['food-mushroom']})

    expect(toggleDislikedFoodId(state, 'food-olive').draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
  })

  it('removes an id that is already selected and keeps the rest', () => {
    const state = makeState({dislikedFoodIds: ['food-mushroom', 'food-olive']})

    expect(toggleDislikedFoodId(state, 'food-mushroom').draft.dislikedFoodIds).toEqual(['food-olive'])
  })

  it('never lists the same id twice', () => {
    const state = makeState({dislikedFoodIds: ['food-olive']})
    const removed = toggleDislikedFoodId(state, 'food-olive')
    const readded = toggleDislikedFoodId(removed, 'food-olive')

    expect(removed.draft.dislikedFoodIds).toEqual([])
    expect(readded.draft.dislikedFoodIds).toEqual(['food-olive'])
  })

  it('accepts an id it has never seen without validating it against a catalog', () => {
    expect(toggleDislikedFoodId(makeState(), 'unknown-food').draft.dislikedFoodIds).toEqual(['unknown-food'])
  })

  it('replaces the whole selection when the search screen commits a set', () => {
    const state = makeState({dislikedFoodIds: ['food-mushroom']})

    expect(setDislikedFoodIds(state, ['food-olive', 'food-anchovy']).draft.dislikedFoodIds).toEqual([
      'food-olive',
      'food-anchovy'
    ])
  })

  it('clears the selection when given an empty list', () => {
    const state = makeState({dislikedFoodIds: ['food-mushroom', 'food-olive']})

    expect(setDislikedFoodIds(state, []).draft.dislikedFoodIds).toEqual([])
  })

  it('collapses repeated ids in the committed set', () => {
    const result = setDislikedFoodIds(makeState(), ['food-olive', 'food-olive', 'food-mushroom'])

    expect(result.draft.dislikedFoodIds).toEqual(['food-olive', 'food-mushroom'])
  })

  it('marks only the dislikes step dirty', () => {
    expect(toggleDislikedFoodId(makeState(), 'food-olive').dirty).toEqual(makeDirty({dislikes: true}))
    expect(setDislikedFoodIds(makeState(), ['food-olive']).dirty).toEqual(makeDirty({dislikes: true}))
  })

  it('leaves the input state and its id array untouched', () => {
    const dislikedFoodIds = ['food-mushroom']
    const state = makeState({dislikedFoodIds})
    const toggled = toggleDislikedFoodId(state, 'food-olive')
    const replaced = setDislikedFoodIds(state, ['food-anchovy'])

    expect(dislikedFoodIds).toEqual(['food-mushroom'])
    expect(state.draft.dislikedFoodIds).toEqual(['food-mushroom'])
    expect(state.dirty.dislikes).toBe(false)
    expect(toggled.draft.dislikedFoodIds).not.toBe(state.draft.dislikedFoodIds)
    expect(replaced.draft.dislikedFoodIds).not.toBe(state.draft.dislikedFoodIds)
    expect(toggled.draft).not.toBe(state.draft)
  })

  // The bound the server applies to this answer, refused here so the app cannot build a selection the
  // dislikes save is certain to answer 400 `invalid_request` for (AAP 0.5.2).
  describe('the 100 distinct ids the server accepts', () => {
    const LATE_FOOD = {id: 'food-late', name: 'Anchovies', foodGroup: 'fish'}

    it('is the bound the server enforces', () => {
      expect(MAX_DISLIKED_FOOD_IDS).toBe(100)
    })

    it('takes the addition that fills the last place', () => {
      const added = toggleDislikedFoodId(makeState({dislikedFoodIds: dislikeIds(99)}), LATE_FOOD.id)

      expect(added.draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(added.draft.dislikedFoodIds[99]).toBe(LATE_FOOD.id)
      expect(added.dirty.dislikes).toBe(true)
    })

    it('refuses the addition that would pass it, leaving the draft and its dirty flag untouched', () => {
      const state = makeState({dislikedFoodIds: dislikeIds(MAX_DISLIKED_FOOD_IDS)})
      const refused = toggleDislikedFoodId(state, LATE_FOOD.id)

      expect(refused).toBe(state)
      expect(refused.draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(refused.dirty.dislikes).toBe(false)
    })

    it('records no name for a food the bound refused', () => {
      const state = makeState({dislikedFoodIds: dislikeIds(MAX_DISLIKED_FOOD_IDS)})
      const refused = toggleDislikedFood(state, LATE_FOOD)

      expect(refused).toBe(state)
      expect(refused.dislikeLabels[LATE_FOOD.id]).toBeUndefined()
    })

    it('removes at the cap, and takes the next addition once a place is free', () => {
      const state = makeState({dislikedFoodIds: dislikeIds(MAX_DISLIKED_FOOD_IDS)})
      const removed = toggleDislikedFoodId(state, 'food-0')
      const added = toggleDislikedFoodId(removed, LATE_FOOD.id)

      expect(removed.draft.dislikedFoodIds).toHaveLength(99)
      expect(removed.draft.dislikedFoodIds).not.toContain('food-0')
      expect(added.draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(added.draft.dislikedFoodIds).toContain(LATE_FOOD.id)
    })

    it('still deselects an already selected food at the cap', () => {
      const state = makeState({dislikedFoodIds: dislikeIds(MAX_DISLIKED_FOOD_IDS)})

      expect(toggleDislikedFoodId(state, 'food-99').draft.dislikedFoodIds).not.toContain('food-99')
    })

    it('accepts a committed set of exactly the cap', () => {
      const ids = dislikeIds(MAX_DISLIKED_FOOD_IDS)

      expect(setDislikedFoodIds(makeState(), ids).draft.dislikedFoodIds).toEqual(ids)
    })

    it('accepts a committed set that only passes the cap before de-duplication', () => {
      const ids = dislikeIds(MAX_DISLIKED_FOOD_IDS)

      expect(setDislikedFoodIds(makeState(), [...ids, 'food-0']).draft.dislikedFoodIds).toEqual(ids)
    })

    it('refuses a committed set of one distinct id too many rather than keeping the first hundred', () => {
      const state = makeState({dislikedFoodIds: ['food-mushroom']})
      const refused = setDislikedFoodIds(state, dislikeIds(MAX_DISLIKED_FOOD_IDS + 1))

      expect(refused).toBe(state)
      expect(refused.draft.dislikedFoodIds).toEqual(['food-mushroom'])
      expect(refused.dirty.dislikes).toBe(false)
    })

    it('reads as at the cap only once the last place is taken', () => {
      expect(isDislikeSelectionAtCap(dislikeIds(99))).toBe(false)
      expect(isDislikeSelectionAtCap(dislikeIds(MAX_DISLIKED_FOOD_IDS))).toBe(true)
    })
  })
})

describe('applyMealSchedule', () => {
  it('seeds three meals in wire order with the product default times', () => {
    const result = applyMealSchedule(makeState(), 'three')

    expect(result.draft.mealSchedule).toBe('three')
    expect(result.draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'}
    ])
  })

  it('seeds the snack last in wire order even though it falls earlier in the day', () => {
    const result = applyMealSchedule(makeState(), 'three_plus_snack')

    expect(result.draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'},
      {slot: 'snack', time: '15:30'}
    ])
    expect(result.draft.mealTimes.map(entry => entry.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack'])
  })

  it('keeps a time the user changed and defaults only the slot being added', () => {
    const three = applyMealSchedule(makeState(), 'three')
    const customised = setMealTime(three, 'breakfast', '06:45')
    const withSnack = applyMealSchedule(customised, 'three_plus_snack')

    expect(withSnack.draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '06:45'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'},
      {slot: 'snack', time: DEFAULT_MEAL_TIMES.snack}
    ])
  })

  it('drops the snack when the user goes back to three meals', () => {
    const withSnack = setMealTime(applyMealSchedule(makeState(), 'three_plus_snack'), 'dinner', '19:15')
    const three = applyMealSchedule(withSnack, 'three')

    expect(three.draft.mealSchedule).toBe('three')
    expect(three.draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '19:15'}
    ])
  })

  it('does not reset customised times when the same schedule is applied again', () => {
    const customised = setMealTime(applyMealSchedule(makeState(), 'three'), 'lunch', '13:15')
    const reapplied = applyMealSchedule(customised, 'three')

    expect(reapplied.draft.mealTimes).toEqual(customised.draft.mealTimes)
  })

  it('marks only the schedule step dirty', () => {
    expect(applyMealSchedule(makeState(), 'three').dirty).toEqual(makeDirty({schedule: true}))
  })

  it('leaves the input state and its meal-time array untouched', () => {
    const mealTimes: MealTimeEntry[] = [{slot: 'lunch', time: '13:15'}]
    const state = makeState({mealSchedule: 'three', mealTimes})
    const result = applyMealSchedule(state, 'three_plus_snack')

    expect(mealTimes).toEqual([{slot: 'lunch', time: '13:15'}])
    expect(state.draft.mealTimes).toEqual([{slot: 'lunch', time: '13:15'}])
    expect(state.draft.mealSchedule).toBe('three')
    expect(result.draft.mealTimes).not.toBe(state.draft.mealTimes)
    expect(result.draft).not.toBe(state.draft)
  })
})

describe('setMealTime', () => {
  it('changes the named slot only and keeps the array order', () => {
    const three = applyMealSchedule(makeState(), 'three')
    const result = setMealTime(three, 'lunch', '13:15')

    expect(result.draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '13:15'},
      {slot: 'dinner', time: '18:30'}
    ])
  })

  it('appends a slot the draft does not hold yet, in wire order', () => {
    const three = applyMealSchedule(makeState(), 'three')
    const result = setMealTime(three, 'snack', '21:00')

    expect(result.draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'},
      {slot: 'snack', time: '21:00'}
    ])
    expect(result.draft.mealSchedule).toBe('three')
  })

  it('sorts an earlier slot into its wire position rather than onto the end', () => {
    const state = makeState({
      mealTimes: [
        {slot: 'lunch', time: '12:30'},
        {slot: 'dinner', time: '18:30'}
      ]
    })

    expect(setMealTime(state, 'breakfast', '07:00').draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '07:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'}
    ])
  })

  it('stores the time as given, without formatting it for display', () => {
    expect(setMealTime(makeState(), 'breakfast', '06:05').draft.mealTimes).toEqual([{slot: 'breakfast', time: '06:05'}])
  })

  it('marks only the schedule step dirty', () => {
    expect(setMealTime(makeState(), 'dinner', '19:00').dirty).toEqual(makeDirty({schedule: true}))
  })

  it('leaves the input state and its meal-time array untouched', () => {
    const mealTimes: MealTimeEntry[] = [{slot: 'breakfast', time: '08:00'}]
    const state = makeState({mealTimes})
    const result = setMealTime(state, 'breakfast', '06:45')

    expect(mealTimes).toEqual([{slot: 'breakfast', time: '08:00'}])
    expect(state.draft.mealTimes).toEqual([{slot: 'breakfast', time: '08:00'}])
    expect(result.draft.mealTimes).not.toBe(state.draft.mealTimes)
    expect(result.draft).not.toBe(state.draft)
  })
})

describe('applyBudgetAmount / applyNoBudgetPreference', () => {
  describe('applyBudgetAmount', () => {
    it('stores the amount in dollars and clears the no-preference flag', () => {
      const state = makeState({noBudgetPreference: true})
      const result = applyBudgetAmount(state, 120)

      expect(result.draft.budget).toEqual({amount: 120, currency: 'USD'})
      expect(result.draft.noBudgetPreference).toBe(false)
    })

    it('accepts the lowest whole-dollar amount', () => {
      expect(applyBudgetAmount(makeState(), 1).draft.budget).toEqual({amount: 1, currency: 'USD'})
    })

    it('stores a zero amount as entered rather than rejecting it', () => {
      expect(applyBudgetAmount(makeState(), 0).draft.budget).toEqual({amount: 0, currency: 'USD'})
    })

    it('clears the amount when the field is emptied', () => {
      const state = makeState({budget: {amount: 120, currency: 'USD'}})
      const result = applyBudgetAmount(state, null)

      expect(result.draft.budget).toBeNull()
      expect(result.draft.noBudgetPreference).toBe(false)
    })

    // This release sends exactly one currency, so the draft — which is what the cooking step's
    // payload is built from — may never carry another one, whatever it held before the edit.
    it('stamps USD over a currency the draft was carrying', () => {
      const state = makeState({budget: {amount: 90, currency: 'EUR'}})

      expect(applyBudgetAmount(state, 150).draft.budget).toEqual({amount: 150, currency: 'USD'})
    })

    it('leaves no path by which a non-USD currency reaches the save payload', () => {
      const seeded = seedDraftFromPreferences(makePreferences({budget: {amount: 90, currency: 'GBP'}}))
      const edited = applyBudgetAmount(seeded, 200)
      const reEntered = applyBudgetAmount(applyBudgetAmount(seeded, null), 75)

      expect(seeded.draft.budget).toEqual({amount: 90, currency: 'USD'})
      expect(edited.draft.budget).toEqual({amount: 200, currency: 'USD'})
      expect(reEntered.draft.budget).toEqual({amount: 75, currency: 'USD'})
    })
  })

  describe('applyNoBudgetPreference', () => {
    it('clears any entered amount when the checkbox is ticked', () => {
      const state = makeState({budget: {amount: 120, currency: 'USD'}})
      const result = applyNoBudgetPreference(state, true)

      expect(result.draft.noBudgetPreference).toBe(true)
      expect(result.draft.budget).toBeNull()
    })

    it('invents no amount when the checkbox is unticked on an unanswered draft', () => {
      const result = applyNoBudgetPreference(makeState({noBudgetPreference: true}), false)

      expect(result.draft.noBudgetPreference).toBe(false)
      expect(result.draft.budget).toBeNull()
    })

    it('keeps an amount the user already entered when the checkbox is unticked', () => {
      const state = makeState({budget: {amount: 120, currency: 'USD'}})

      expect(applyNoBudgetPreference(state, false).draft.budget).toEqual({amount: 120, currency: 'USD'})
    })
  })

  it('marks only the cooking step dirty', () => {
    expect(applyBudgetAmount(makeState(), 120).dirty).toEqual(makeDirty({cooking: true}))
    expect(applyNoBudgetPreference(makeState(), true).dirty).toEqual(makeDirty({cooking: true}))
  })

  it('leaves the input state untouched and returns new objects', () => {
    const state = makeState({budget: {amount: 120, currency: 'USD'}})
    const amountResult = applyBudgetAmount(state, 200)
    const flagResult = applyNoBudgetPreference(state, true)

    expect(state.draft.budget).toEqual({amount: 120, currency: 'USD'})
    expect(state.draft.noBudgetPreference).toBe(false)
    expect(state.dirty.cooking).toBe(false)
    expect(amountResult.draft).not.toBe(state.draft)
    expect(amountResult.draft.budget).not.toBe(state.draft.budget)
    expect(flagResult.draft).not.toBe(state.draft)
    expect(flagResult.dirty).not.toBe(state.dirty)
  })
})

describe('stepsForRoute', () => {
  it('asks all seven questions on the estimated route', () => {
    expect(stepsForRoute('estimated')).toEqual(['goal', 'body', 'activity', 'diet', 'dislikes', 'schedule', 'cooking'])
  })

  it('asks six questions on the manual route, skipping the calculation-only activity step', () => {
    const steps = stepsForRoute('manual')

    expect(steps).toEqual(['goal', 'body', 'diet', 'dislikes', 'schedule', 'cooking'])
    expect(steps).toHaveLength(6)
    expect(steps).not.toContain('activity')
  })

  it('starts both routes at the goal step', () => {
    expect(stepsForRoute('estimated')[0]).toBe('goal')
    expect(stepsForRoute('manual')[0]).toBe('goal')
  })

  it('returns a new array each time, so a caller cannot edit the route definition', () => {
    expect(stepsForRoute('estimated')).not.toBe(stepsForRoute('estimated'))
    expect(stepsForRoute('manual')).not.toBe(stepsForRoute('manual'))
  })
})

describe('isStepComplete', () => {
  describe('goal', () => {
    it('needs no pace for maintain', () => {
      expect(isStepComplete(makeState({goal: 'maintain'}), 'goal')).toBe(true)
    })

    it('needs a pace for lose and gain', () => {
      expect(isStepComplete(makeState({goal: 'lose'}), 'goal')).toBe(false)
      expect(isStepComplete(makeState({goal: 'gain'}), 'goal')).toBe(false)
      expect(isStepComplete(makeState({goal: 'lose', paceLbPerWeek: 0.5}), 'goal')).toBe(true)
      expect(isStepComplete(makeState({goal: 'gain', paceLbPerWeek: 1.5}), 'goal')).toBe(true)
    })

    it('treats the goal weight as optional', () => {
      expect(isStepComplete(makeState({goal: 'lose', paceLbPerWeek: 1, goalWeightKg: null}), 'goal')).toBe(true)
      expect(isStepComplete(makeState({goal: 'maintain', goalWeightKg: null}), 'goal')).toBe(true)
    })

    it('is incomplete while no goal is chosen', () => {
      expect(isStepComplete(makeState(), 'goal')).toBe(false)
      expect(isStepComplete(makeState({paceLbPerWeek: 1}), 'goal')).toBe(false)
    })
  })

  describe('body', () => {
    it('needs age, height, weight and sex', () => {
      expect(isStepComplete(makeCompleteState(), 'body')).toBe(true)
    })

    it('is incomplete while any measurement is missing', () => {
      expect(isStepComplete(makeCompleteState({age: null}), 'body')).toBe(false)
      expect(isStepComplete(makeCompleteState({heightCm: null}), 'body')).toBe(false)
      expect(isStepComplete(makeCompleteState({weightKg: null}), 'body')).toBe(false)
      expect(isStepComplete(makeCompleteState({sexForEstimate: null}), 'body')).toBe(false)
    })

    it('accepts prefer-not-to-say as an answer to the sex question', () => {
      expect(isStepComplete(makeCompleteState({sexForEstimate: 'prefer_not_to_say'}), 'body')).toBe(true)
    })

    // The step's other answer. Skip records a route and no measurements, so a rule that reads the
    // measurements alone calls a completed step unanswered.
    it('counts a Skip answered in this session, which carries no measurement at all', () => {
      const skipped = answerBodySkipped(createEmptyDraft())

      expect(skipped.draft.age).toBeNull()
      expect(isStepComplete(skipped, 'body')).toBe(true)
    })

    it('counts a Skip saved on an earlier visit, read back from the saved route', () => {
      expect(isStepComplete(seedDraftFromPreferences(makeSkippedBodyPreferences()), 'body')).toBe(true)
    })

    it('is unanswered while nothing has been answered and no measurement is entered', () => {
      expect(isStepComplete(createEmptyDraft(), 'body')).toBe(false)
    })
  })

  describe('activity', () => {
    it('needs an activity level', () => {
      expect(isStepComplete(makeState({activityLevel: 'very_active'}), 'activity')).toBe(true)
      expect(isStepComplete(makeState(), 'activity')).toBe(false)
    })
  })

  describe('diet', () => {
    it('needs a diet', () => {
      expect(isStepComplete(makeState({allergens: ['milk']}), 'diet')).toBe(false)
      expect(isStepComplete(makeState({diet: 'vegan', allergens: ['milk']}), 'diet')).toBe(true)
    })

    it('counts the None sentinel as an allergy answer but an empty list as unanswered', () => {
      expect(isStepComplete(makeState({diet: 'none', allergens: [ALLERGEN_NONE]}), 'diet')).toBe(true)
      expect(isStepComplete(makeState({diet: 'none', allergens: []}), 'diet')).toBe(false)
    })
  })

  describe('dislikes', () => {
    it('is complete whether or not anything is selected', () => {
      expect(isStepComplete(makeState(), 'dislikes')).toBe(true)
      expect(isStepComplete(makeState({dislikedFoodIds: ['food-olive']}), 'dislikes')).toBe(true)
    })
  })

  describe('schedule', () => {
    it('needs a schedule and a time for each of its slots', () => {
      expect(isStepComplete(applyMealSchedule(makeState(), 'three'), 'schedule')).toBe(true)
      expect(isStepComplete(applyMealSchedule(makeState(), 'three_plus_snack'), 'schedule')).toBe(true)
    })

    it('is incomplete while no schedule is chosen', () => {
      expect(isStepComplete(makeState({mealTimes: [{slot: 'breakfast', time: '08:00'}]}), 'schedule')).toBe(false)
    })

    it('is incomplete while a slot of the chosen schedule has no time', () => {
      const missingSnack = makeState({
        mealSchedule: 'three_plus_snack',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'dinner', time: '18:30'}
        ]
      })

      expect(isStepComplete(missingSnack, 'schedule')).toBe(false)
    })

    it('treats a blank time as unanswered', () => {
      const blankLunch = makeState({
        mealSchedule: 'three',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '  '},
          {slot: 'dinner', time: '18:30'}
        ]
      })

      expect(isStepComplete(blankLunch, 'schedule')).toBe(false)
    })

    it('ignores a time for a slot the chosen schedule does not use', () => {
      const extraSnack = makeState({
        mealSchedule: 'three',
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'dinner', time: '18:30'},
          {slot: 'snack', time: '15:30'}
        ]
      })

      expect(isStepComplete(extraSnack, 'schedule')).toBe(true)
    })
  })

  describe('cooking', () => {
    it('needs a cooking-time limit and either budget answer', () => {
      expect(isStepComplete(makeState({cookingTimeLimitMin: 30, noBudgetPreference: true}), 'cooking')).toBe(true)
      expect(
        isStepComplete(makeState({cookingTimeLimitMin: 15, budget: {amount: 120, currency: 'USD'}}), 'cooking')
      ).toBe(true)
    })

    it('is incomplete while neither budget answer is given', () => {
      expect(isStepComplete(makeState({cookingTimeLimitMin: 60}), 'cooking')).toBe(false)
    })

    it('is incomplete while no cooking-time limit is chosen', () => {
      expect(isStepComplete(makeState({noBudgetPreference: true}), 'cooking')).toBe(false)
      expect(isStepComplete(makeState({budget: {amount: 120, currency: 'USD'}}), 'cooking')).toBe(false)
    })
  })

  it('does not mutate the state it reads', () => {
    const state = makeCompleteState()
    const snapshot = makeCompleteState()

    stepsForRoute('estimated').forEach(step => isStepComplete(state, step))

    expect(state).toEqual(snapshot)
  })
})

describe('completedSteps', () => {
  it('returns every step of the estimated route in wizard order for a fully answered draft', () => {
    expect(completedSteps(makeCompleteState(), 'estimated')).toEqual([
      'goal',
      'body',
      'activity',
      'diet',
      'dislikes',
      'schedule',
      'cooking'
    ])
  })

  it('does not penalise a manual-route draft for the activity step it is never asked', () => {
    const manualDraft = makeCompleteState({activityLevel: null, sexForEstimate: 'prefer_not_to_say'})

    expect(completedSteps(manualDraft, 'manual')).toEqual(['goal', 'body', 'diet', 'dislikes', 'schedule', 'cooking'])
  })

  it('counts only the route it was given', () => {
    const manualDraft = makeCompleteState({activityLevel: null})

    expect(completedSteps(manualDraft, 'estimated')).not.toContain('activity')
    expect(completedSteps(manualDraft, 'estimated')).toHaveLength(6)
    expect(completedSteps(manualDraft, 'manual')).toHaveLength(6)
  })

  it('counts only the dislikes step for an untouched draft', () => {
    expect(completedSteps(createEmptyDraft(), 'estimated')).toEqual(['dislikes'])
    expect(completedSteps(createEmptyDraft(), 'manual')).toEqual(['dislikes'])
  })

  // The counter the wizard header renders on the manual route. A saved Skip is the sixth answer,
  // so reading it off the measurements reported five of six and re-opened a finished screen.
  it('counts all six manual-route steps for a resumed user who answered the body step with Skip', () => {
    const resumed = seedDraftFromPreferences(makeSkippedBodyPreferences())

    expect(completedSteps(resumed, 'manual')).toEqual(['goal', 'body', 'diet', 'dislikes', 'schedule', 'cooking'])
    expect(completedSteps(resumed, 'manual')).toHaveLength(SETUP_STEPS_MANUAL.length)
  })

  it('drops a step again once its answer is cleared', () => {
    const withoutSchedule = makeCompleteState({mealSchedule: null, mealTimes: []})

    expect(completedSteps(withoutSchedule, 'estimated')).toEqual([
      'goal',
      'body',
      'activity',
      'diet',
      'dislikes',
      'cooking'
    ])
  })
})

describe('the seeded flag', () => {
  it('leaves a first-entry draft unseeded, so a screen may still read the saved answers', () => {
    expect(createEmptyDraft().seeded).toBe(false)
  })

  it('marks a draft filled from the saved preferences as seeded', () => {
    expect(seedDraftFromPreferences(makePreferences()).seeded).toBe(true)
  })

  it('leaves the draft unseeded when there is nothing saved to seed it from', () => {
    expect(seedDraftFromPreferences(null).seeded).toBe(false)
    expect(seedDraftFromPreferences(undefined).seeded).toBe(false)
  })

  // The point of the flag: once the draft holds the saved answers, a null in it is the answer the
  // user cleared — an optional goal weight removed on frame 02 — and a screen composing the draft
  // with the fetched preferences must not fill it back in.
  it('survives clearing an optional answer, so the cleared value stays the user answer', () => {
    const cleared = setStepFields(seedDraftFromPreferences(makePreferences()), 'goal', {goalWeightKg: null})

    expect(cleared.seeded).toBe(true)
    expect(cleared.draft.goalWeightKg).toBeNull()
  })

  it('survives every reducer that edits the draft', () => {
    const seeded = seedDraftFromPreferences(makePreferences())

    expect(applyAllergenSelection(seeded, 'soy').seeded).toBe(true)
    expect(toggleDislikedFoodId(seeded, 'food-olive').seeded).toBe(true)
    expect(setDislikedFoodIds(seeded, ['food-olive']).seeded).toBe(true)
    expect(applyMealSchedule(seeded, 'three').seeded).toBe(true)
    expect(setMealTime(seeded, 'dinner', '19:00').seeded).toBe(true)
    expect(applyBudgetAmount(seeded, 120).seeded).toBe(true)
    expect(applyNoBudgetPreference(seeded, true).seeded).toBe(true)
  })

  it('is never invented by an edit of an unseeded draft', () => {
    expect(setStepFields(createEmptyDraft(), 'goal', {goal: 'lose'}).seeded).toBe(false)
    expect(applyBudgetAmount(createEmptyDraft(), 120).seeded).toBe(false)
  })
})

// The body step is the one step whose answer can leave every field of it empty, so the fact that
// it was answered is carried on the state rather than inferred from the draft.
describe('the body-answer marker', () => {
  it('is unanswered for a first-entry draft', () => {
    expect(createEmptyDraft().bodyAnswered).toBe(false)
  })

  // The saved route is the server's own proof that the step was answered: a body-step save is the
  // only writer of it, and Skip, 'Prefer not to say' and a measured answer all resolve it.
  it('reads the saved answer off the target route, whichever branch the user took', () => {
    expect(seedDraftFromPreferences(makePreferences({targetRoute: 'estimated'})).bodyAnswered).toBe(true)
    expect(seedDraftFromPreferences(makeSkippedBodyPreferences()).bodyAnswered).toBe(true)
  })

  it('stays unanswered while no route is on record, so the step is asked rather than assumed', () => {
    expect(seedDraftFromPreferences(makePreferences({targetRoute: null})).bodyAnswered).toBe(false)
    expect(seedDraftFromPreferences(null).bodyAnswered).toBe(false)
    expect(seedDraftFromPreferences(undefined).bodyAnswered).toBe(false)
  })

  // First save: the screen records the Skip before the refetch that would seed it, so the counter
  // is right the moment the user taps it rather than one request later.
  it('records a Skip taken in this session', () => {
    const skipped = answerBodySkipped(createEmptyDraft())

    expect(skipped.bodyAnswered).toBe(true)
    expect(skipped.dirty).toEqual(makeDirty({body: true}))
  })

  // Skip records a route; it does not delete figures entered on an earlier pass, which is exactly
  // what the server does with it.
  it('clears no measurement the draft already holds', () => {
    const skipped = answerBodySkipped(makeCompleteState())

    expect(skipped.draft).toEqual(makeCompleteDraft())
    expect(skipped.bodyAnswered).toBe(true)
  })

  it('does not mutate the state it answers', () => {
    const state = makeCompleteState()
    const snapshot = makeCompleteState()

    answerBodySkipped(state)

    expect(state).toEqual(snapshot)
  })

  it('leaves a seeded draft seeded', () => {
    expect(answerBodySkipped(seedDraftFromPreferences(makePreferences())).seeded).toBe(true)
    expect(answerBodySkipped(createEmptyDraft()).seeded).toBe(false)
  })

  // Resume: a user who skipped and came back keeps the answer while they edit anything, including
  // the body screen itself, so the counter cannot drop a step mid-session.
  it('survives every reducer that edits the draft', () => {
    const resumed = seedDraftFromPreferences(makeSkippedBodyPreferences())

    expect(setStepFields(resumed, 'body', {age: 34}).bodyAnswered).toBe(true)
    expect(applyAllergenSelection(resumed, 'soy').bodyAnswered).toBe(true)
    expect(toggleDislikedFoodId(resumed, 'food-olive').bodyAnswered).toBe(true)
    expect(setDislikedFoodIds(resumed, ['food-olive']).bodyAnswered).toBe(true)
    expect(applyMealSchedule(resumed, 'three').bodyAnswered).toBe(true)
    expect(setMealTime(resumed, 'dinner', '19:00').bodyAnswered).toBe(true)
    expect(applyBudgetAmount(resumed, 120).bodyAnswered).toBe(true)
    expect(applyNoBudgetPreference(resumed, true).bodyAnswered).toBe(true)
  })

  it('is never invented by an edit of a draft whose body step was never answered', () => {
    expect(setStepFields(createEmptyDraft(), 'body', {age: 34}).bodyAnswered).toBe(false)
    expect(applyBudgetAmount(createEmptyDraft(), 120).bodyAnswered).toBe(false)
  })

  // Resume, measured after a skip: the step is answered either way, and a half-entered measurement
  // never un-answers the Skip that is on record.
  it('keeps the step complete while a resumed user re-enters measurements one field at a time', () => {
    const resumed = seedDraftFromPreferences(makeSkippedBodyPreferences())
    const partial = setStepFields(resumed, 'body', {age: 34})

    expect(isStepComplete(partial, 'body')).toBe(true)
    expect(isStepComplete(setStepFields(partial, 'body', {heightCm: 177.8}), 'body')).toBe(true)
  })
})

describe('clearsSetupDraft', () => {
  it('clears the draft when a generated plan hands the answers to the server', () => {
    expect(clearsSetupDraft('setup_completed')).toBe(true)
  })

  it('clears the draft when the user dismisses setup with Not now', () => {
    expect(clearsSetupDraft('setup_dismissed')).toBe(true)
  })

  it('clears the draft when the session ends at sign-out', () => {
    expect(clearsSetupDraft('signed_out')).toBe(true)
  })

  // The navigation boundary MacrosStack reports: no setup route is left on the stack, which is how
  // a generated plan and 'Not now' both end.
  it('clears the draft when the flow is left behind', () => {
    expect(clearsSetupDraft('flow_exited')).toBe(true)
  })

  // A Continue persists its own step and the later steps still derive from the earlier answers,
  // so reporting a saved step must not discard the draft the user is still filling in.
  it('keeps the draft when a step has just been persisted', () => {
    expect(clearsSetupDraft('step_saved')).toBe(false)
  })

  it('decides every lifecycle event rather than falling through undefined', () => {
    expect(LIFECYCLE_EVENTS.map(event => clearsSetupDraft(event))).toEqual([true, true, true, true, false])
  })
})

describe('applyLifecycleEvent', () => {
  const fullyDirtyDraft = (): MealPlanSetupDraftState => ({
    ...createEmptyDraft(),
    draft: makeCompleteDraft({budget: {amount: 120, currency: 'USD'}, noBudgetPreference: false}),
    dirty: {...ALL_DIRTY},
    seeded: true,
    bodyAnswered: true
  })

  it('discards every answer of a fully dirty draft once setup completes', () => {
    expect(applyLifecycleEvent(fullyDirtyDraft(), 'setup_completed')).toEqual(createEmptyDraft())
  })

  it('discards every answer of a fully dirty draft when the user taps Not now', () => {
    expect(applyLifecycleEvent(fullyDirtyDraft(), 'setup_dismissed')).toEqual(createEmptyDraft())
  })

  it('discards every answer of a fully dirty draft at sign-out, leaving nothing for the next user', () => {
    const cleared = applyLifecycleEvent(fullyDirtyDraft(), 'signed_out')

    expect(cleared).toEqual(createEmptyDraft())
    expect(cleared.draft.weightKg).toBeNull()
    expect(cleared.draft.allergens).toEqual([])
    expect(cleared.seeded).toBe(false)
    // The next user must be asked the body step rather than inheriting the answer to it.
    expect(cleared.bodyAnswered).toBe(false)
    expect(Object.values(cleared.dirty).some(Boolean)).toBe(false)
  })

  // The reset MacrosStack actually dispatches when the Macros root regains focus: a finished or
  // abandoned wizard session leaves nothing behind for a later visit in the same app session.
  it('discards every answer of a fully dirty draft when the flow is left behind', () => {
    expect(applyLifecycleEvent(fullyDirtyDraft(), 'flow_exited')).toEqual(createEmptyDraft())
  })

  it('discards a seeded draft the user never edited, so no saved answer lingers in memory', () => {
    const seeded = seedDraftFromPreferences(makePreferences())

    expect(applyLifecycleEvent(seeded, 'flow_exited')).toEqual(createEmptyDraft())
  })

  it('returns the draft untouched when a step was merely persisted', () => {
    const state = fullyDirtyDraft()

    expect(applyLifecycleEvent(state, 'step_saved')).toBe(state)
  })

  // Returning to the Macros root happens constantly with no setup in flight, so clearing an
  // untouched draft must not hand the provider a new object to re-render for.
  it('leaves an untouched draft alone for every clearing event, object identity included', () => {
    const state = createEmptyDraft()

    expect(CLEARING_EVENTS.map(event => applyLifecycleEvent(state, event))).toEqual([state, state, state, state])
    expect(CLEARING_EVENTS.every(event => applyLifecycleEvent(state, event) === state)).toBe(true)
  })

  it('does not mutate the state it clears', () => {
    const state = fullyDirtyDraft()
    const snapshot = fullyDirtyDraft()

    applyLifecycleEvent(state, 'setup_dismissed')

    expect(state).toEqual(snapshot)
  })

  it('returns a fresh draft each time, so two cleared sessions share no array', () => {
    const first = applyLifecycleEvent(fullyDirtyDraft(), 'setup_completed')
    const second = applyLifecycleEvent(fullyDirtyDraft(), 'setup_completed')

    expect(first).toEqual(second)
    expect(first.draft).not.toBe(second.draft)
    expect(first.draft.allergens).not.toBe(second.draft.allergens)
  })

  it('is idempotent on an already-empty draft', () => {
    expect(applyLifecycleEvent(createEmptyDraft(), 'setup_completed')).toEqual(createEmptyDraft())
  })
})

// The account boundary as it reaches this module. An account change arrives as one Firebase uid
// replacing another with no signed-out render in between, and nothing in this tree can observe it:
// App.tsx gives the session tree the signed-in uid as its React key, so the provider is recreated
// and starts again from createEmptyDraft(). These cases pin what that has to mean for the answers
// the draft holds — what you weigh, how old you are, what you can't eat — because a store or query
// reset cannot reach state held in a mounted Context.
describe('an account change, one uid replacing another', () => {
  const outgoingAccountState = (): MealPlanSetupDraftState => ({
    ...createEmptyDraft(),
    draft: makeCompleteDraft({
      budget: {amount: 120, currency: 'USD'},
      noBudgetPreference: false,
      allergens: ['milk', 'peanuts'],
      dislikedFoodIds: ['food-mushroom', 'food-olive'],
      dislikedFoodGroups: ['mushroom']
    }),
    dirty: {...ALL_DIRTY},
    // The names those two selections were made with are part of what the outgoing account leaves behind.
    dislikeLabels: {
      'food-mushroom': {id: 'food-mushroom', name: 'Mushrooms, white', foodGroup: 'mushroom'},
      'food-olive': {id: 'food-olive', name: 'Olives', foodGroup: 'olive'}
    },
    seeded: true,
    bodyAnswered: true
  })

  const ANSWER_BEARING_FIELDS: (keyof MealPlanSetupDraft)[] = [
    'goal',
    'goalWeightKg',
    'paceLbPerWeek',
    'age',
    'heightCm',
    'weightKg',
    'sexForEstimate',
    'activityLevel',
    'diet',
    'allergens',
    'dislikedFoodIds',
    'dislikedFoodGroups',
    'mealSchedule',
    'mealTimes',
    'cookingTimeLimitMin',
    'budget'
  ]

  const isEmptyAnswer = (value: unknown): boolean => value === null || (Array.isArray(value) && value.length === 0)

  it('leaves not one answer of the outgoing account in the state the recreated provider starts from', () => {
    const outgoing = outgoingAccountState()
    const {draft} = createEmptyDraft()

    ANSWER_BEARING_FIELDS.forEach(field => {
      expect(isEmptyAnswer(outgoing.draft[field])).toBe(false)
      expect(isEmptyAnswer(draft[field])).toBe(true)
    })
  })

  it('shows the incoming account no progress the outgoing account had made', () => {
    const outgoing = outgoingAccountState()
    const recreated = createEmptyDraft()

    expect(completedSteps(outgoing, 'estimated')).toEqual([...SETUP_STEPS_ESTIMATED])
    expect(completedSteps(recreated, 'estimated')).toEqual(['dislikes'])
    expect(completedSteps(recreated, 'manual')).toEqual(['dislikes'])
    expect(isStepComplete(recreated, 'body')).toBe(false)
    expect(recreated.bodyAnswered).toBe(false)
    expect(recreated.seeded).toBe(false)
  })

  // The draft is what the wizard screens render, so a shared array would put the outgoing account's
  // allergies and dislikes on screen for the incoming one even after the state object was replaced.
  it('shares no array with the draft the outgoing account was editing', () => {
    const outgoing = setDislikedFoodIds(outgoingAccountState(), ['food-mushroom'])
    const recreated = createEmptyDraft()

    expect(recreated.draft.allergens).not.toBe(outgoing.draft.allergens)
    expect(recreated.draft.dislikedFoodIds).not.toBe(outgoing.draft.dislikedFoodIds)
    expect(recreated.draft.dislikedFoodGroups).not.toBe(outgoing.draft.dislikedFoodGroups)
    expect(recreated.draft.mealTimes).not.toBe(outgoing.draft.mealTimes)

    recreated.draft.allergens.push('sesame')
    recreated.draft.mealTimes.push({slot: 'snack', time: '15:30'})

    expect(outgoing.draft.allergens).toEqual(['milk', 'peanuts'])
    expect(outgoing.draft.mealTimes).toHaveLength(3)
  })

  // Seeding is how the incoming account's own answers arrive, and it reads only the preferences it
  // is given: there is no merge with whatever the provider held, so even a provider that somehow
  // survived the account change cannot show the outgoing account's answers once it seeds.
  it('replaces every answer when the incoming account seeds its own preferences', () => {
    const incoming = makePreferences({
      age: 51,
      weightKg: 68.2,
      heightCm: 162.6,
      sexForEstimate: 'male',
      diet: 'vegan',
      allergens: ['sesame'],
      dislikedFoods: [],
      dislikedFoodGroups: [],
      budget: null,
      noBudgetPreference: true
    })

    const seeded = seedDraftFromPreferences(incoming)

    expect(seeded).toEqual(seedDraftFromPreferences(incoming))
    expect(seeded.draft.age).toBe(51)
    expect(seeded.draft.weightKg).toBe(68.2)
    expect(seeded.draft.diet).toBe('vegan')
    expect(seeded.draft.allergens).toEqual(['sesame'])
    expect(seeded.draft.dislikedFoodIds).toEqual([])
    expect(seeded.draft.budget).toBeNull()
    expect(seeded.draft.noBudgetPreference).toBe(true)
  })

  // The first render after a remount has no preferences yet, because the incoming account's query is
  // still in flight. That must show the incoming account nothing rather than the last answers held.
  it('holds nothing while the incoming account has no preferences yet', () => {
    expect(seedDraftFromPreferences(null)).toEqual(createEmptyDraft())
    expect(seedDraftFromPreferences(undefined)).toEqual(createEmptyDraft())
  })
})

describe('the module tables', () => {
  it('freezes the default meal times a schedule is seeded from', () => {
    const rewritten = DEFAULT_MEAL_TIMES as Record<MealSlot, string>

    rewritten.breakfast = '05:00'

    expect(Object.isFrozen(DEFAULT_MEAL_TIMES)).toBe(true)
    expect(DEFAULT_MEAL_TIMES.breakfast).toBe('08:00')
    expect(applyMealSchedule(createEmptyDraft(), 'three').draft.mealTimes).toEqual([
      {slot: 'breakfast', time: '08:00'},
      {slot: 'lunch', time: '12:30'},
      {slot: 'dinner', time: '18:30'}
    ])
  })

  it('freezes both route step lists so a consumer cannot reorder or extend the wizard', () => {
    expect(Object.isFrozen(SETUP_STEPS_ESTIMATED)).toBe(true)
    expect(Object.isFrozen(SETUP_STEPS_MANUAL)).toBe(true)
    expect(() => (SETUP_STEPS_ESTIMATED as MealPlanSetupStep[]).push('goal')).toThrow(TypeError)
    expect(() => (SETUP_STEPS_MANUAL as MealPlanSetupStep[]).push('activity')).toThrow(TypeError)
    expect(SETUP_STEPS_ESTIMATED).toHaveLength(7)
    expect(SETUP_STEPS_MANUAL).toHaveLength(6)
  })

  it('still hands stepsForRoute callers a mutable copy of their own', () => {
    const steps = stepsForRoute('estimated')

    steps.push('goal')

    expect(SETUP_STEPS_ESTIMATED).toHaveLength(7)
    expect(stepsForRoute('estimated')).toHaveLength(7)
  })
})

describe('determinism', () => {
  it('returns an equal result for repeated calls with the same input', () => {
    const state = makeState({allergens: ['milk']})

    expect(applyAllergenSelection(state, 'eggs')).toEqual(applyAllergenSelection(state, 'eggs'))
    expect(applyMealSchedule(state, 'three_plus_snack')).toEqual(applyMealSchedule(state, 'three_plus_snack'))
    expect(setDislikedFoodIds(state, ['food-olive'])).toEqual(setDislikedFoodIds(state, ['food-olive']))
    expect(applyBudgetAmount(state, 120)).toEqual(applyBudgetAmount(state, 120))
  })

  it('derives the same progress from the same state', () => {
    const state = makeCompleteState()

    expect(completedSteps(state, 'estimated')).toEqual(completedSteps(state, 'estimated'))
    expect(seedDraftFromPreferences(makePreferences())).toEqual(seedDraftFromPreferences(makePreferences()))
  })
})

// The draft is partitioned by step so that a preferences response arriving AFTER the user has started
// answering can adopt the saved row for the steps they have not touched without erasing the ones they have.
// A field owned by no step would be overwritten by every reseed, which is why the partition's completeness
// is asserted here rather than trusted.
describe('the step partition of the draft', () => {
  it('assigns every editable draft field to exactly one step, or to the step-independent set', () => {
    const partitioned = [
      ...SETUP_STEPS_ESTIMATED.flatMap(step => [...DRAFT_FIELDS_BY_STEP[step]]),
      ...STEP_INDEPENDENT_DRAFT_KEYS
    ]

    expect([...partitioned].sort()).toEqual(Object.keys(createEmptyDraft().draft).sort())
    expect(new Set(partitioned).size).toBe(partitioned.length)
  })

  it('keeps timeZone out of every step, because each step payload carries it', () => {
    const stepOwned = SETUP_STEPS_ESTIMATED.flatMap(step => [...DRAFT_FIELDS_BY_STEP[step]])

    expect(stepOwned).not.toContain('timeZone')
    expect(STEP_INDEPENDENT_DRAFT_KEYS).toEqual(['timeZone'])
  })
})

// A step screen stays interactive while its preferences query is in flight, so the response can land after
// the user has already answered. Seeding on top of their answer is data loss, and these cases are what stops
// it: the seed is given the state it is replacing, and an edited step keeps what the user put in it.
describe('a preferences response that arrives after the user has started answering', () => {
  const editedState = (): MealPlanSetupDraftState =>
    setStepFields(createEmptyDraft(), 'goal', {goal: 'gain', paceLbPerWeek: 1.5})

  it('keeps an edited step exactly as the user left it', () => {
    const {draft} = seedDraftFromPreferences(makePreferences(), editedState())

    expect(draft.goal).toBe('gain')
    expect(draft.paceLbPerWeek).toBe(1.5)
  })

  it('keeps an edited step marked edited, so a later reseed cannot take it either', () => {
    const once = seedDraftFromPreferences(makePreferences(), editedState())
    const twice = seedDraftFromPreferences(makePreferences(), once)

    expect(once.dirty.goal).toBe(true)
    expect(twice.draft.goal).toBe('gain')
  })

  it('adopts the saved answers of every step the user has not touched', () => {
    const {draft} = seedDraftFromPreferences(makePreferences(), editedState())

    expect(draft.activityLevel).toBe('lightly_active')
    expect(draft.diet).toBe('vegetarian')
    expect(draft.mealSchedule).toBe('three_plus_snack')
    expect(draft.cookingTimeLimitMin).toBe(30)
    expect(draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
  })

  it('preserves a typed budget amount rather than replacing it with the saved one', () => {
    const typed = applyBudgetAmount(createEmptyDraft(), 45)
    const {draft} = seedDraftFromPreferences(makePreferences(), typed)

    expect(draft.budget).toEqual({amount: 45, currency: 'USD'})
    expect(draft.noBudgetPreference).toBe(false)
  })

  // An amount being typed reaches the draft only while it parses, so 10001 — outside the accepted range —
  // leaves the draft holding null while the field still shows the digits. The step counts as edited all the
  // same, so a response landing mid-typing must not put the saved amount back underneath what is on screen.
  it('keeps an amount typed past the accepted range out of the draft rather than re-adopting the saved one', () => {
    const halfTyped = applyBudgetAmount(createEmptyDraft(), null)
    const seeded = seedDraftFromPreferences(makePreferences(), halfTyped)

    expect(seeded.draft.budget).toBeNull()
    expect(seeded.dirty.cooking).toBe(true)
  })

  it('preserves every field of an edited step, including the ones the user left empty', () => {
    const partialBody = setStepFields(createEmptyDraft(), 'body', {age: 41})
    const {draft} = seedDraftFromPreferences(makePreferences(), partialBody)

    expect(draft.age).toBe(41)
    expect(draft.heightCm).toBeNull()
    expect(draft.weightKg).toBeNull()
    expect(draft.sexForEstimate).toBeNull()
  })

  it('cannot un-answer the body step a Skip answered in this session', () => {
    const skipped = answerBodySkipped(createEmptyDraft())
    const seeded = seedDraftFromPreferences(makePreferences({targetRoute: null}), skipped)

    expect(seeded.bodyAnswered).toBe(true)
  })

  it('seeds the whole saved row when there is no state to protect, exactly as a first seed does', () => {
    expect(seedDraftFromPreferences(makePreferences(), createEmptyDraft())).toEqual(
      seedDraftFromPreferences(makePreferences())
    )
  })

  it('records the saved answers as the baseline whatever the draft kept', () => {
    const seeded = seedDraftFromPreferences(makePreferences(), editedState())

    expect(seeded.baseline.goal).toBe('lose')
    expect(seeded.baseline.paceLbPerWeek).toBe(1)
    expect(seeded.draft.goal).toBe('gain')
  })
})

// The same late response against a SET answer — the allergies and the dislikes — where keeping the edit
// whole is itself the data loss. Before the first seed the draft's sets are empty, so every chip renders
// unselected: a tap can only mean "add this", never "remove the selected thing I can see". Taking that tap
// wholesale would delete a stored allergy the user was never shown, which Figma note `47:230` (allergies are
// never removed automatically) and AAP 0.2.5 both refuse, so the first seed reconciles those three fields
// with the stored answer instead of replacing them.
describe('a preferences response that arrives after the user has touched a set answer', () => {
  // The reproduction from the report, as the screen produces it: the diet screen mounted with no answer yet,
  // the user tapped the Eggs chip, and the response holding Milk and Peanuts landed afterwards.
  const eggsTappedBeforeAnswerArrived = (): MealPlanSetupDraftState =>
    applyAllergenSelection(createEmptyDraft(), 'eggs')

  it('keeps the allergies the response brought and adds the one tapped before it arrived', () => {
    const {draft} = seedDraftFromPreferences(makePreferences(), eggsTappedBeforeAnswerArrived())

    expect(draft.allergens).toEqual(['milk', 'peanuts', 'eggs'])
  })

  it('leaves the step edited, so the reconciled selection is what the next save sends', () => {
    const seeded = seedDraftFromPreferences(makePreferences(), eggsTappedBeforeAnswerArrived())

    expect(seeded.dirty.diet).toBe(true)
  })

  it('does not repeat an allergy the tap and the response both name', () => {
    const tappedOne = applyAllergenSelection(createEmptyDraft(), 'milk')
    const {draft} = seedDraftFromPreferences(makePreferences(), tappedOne)

    expect(draft.allergens).toEqual(['milk', 'peanuts'])
  })

  // 'None' cannot travel beside a named allergy, and of the two it is the sentinel that goes: dropping an
  // allergy would relax a restriction the user asked for, and this tap was made against an empty screen.
  it('keeps the stored allergies when None was tapped before they arrived', () => {
    const noneTapped = applyAllergenSelection(createEmptyDraft(), ALLERGEN_NONE)
    const {draft} = seedDraftFromPreferences(makePreferences(), noneTapped)

    expect(draft.allergens).toEqual(['milk', 'peanuts'])
  })

  it('keeps None when it was tapped and the response brought no allergies', () => {
    const noneTapped = applyAllergenSelection(createEmptyDraft(), ALLERGEN_NONE)
    const {draft} = seedDraftFromPreferences(makePreferences({allergens: []}), noneTapped)

    expect(draft.allergens).toEqual([ALLERGEN_NONE])
  })

  it('keeps None when it was tapped and the response brought None too', () => {
    const noneTapped = applyAllergenSelection(createEmptyDraft(), ALLERGEN_NONE)
    const {draft} = seedDraftFromPreferences(makePreferences({allergens: [ALLERGEN_NONE]}), noneTapped)

    expect(draft.allergens).toEqual([ALLERGEN_NONE])
  })

  // The stored 'no allergies' answer and a named allergy are the same pair the other way round, and the
  // named one wins here too — the rule `applyAllergenSelection` already applies to a live tap.
  it('drops a stored None when a named allergy was tapped before it arrived', () => {
    const {draft} = seedDraftFromPreferences(
      makePreferences({allergens: [ALLERGEN_NONE]}),
      eggsTappedBeforeAnswerArrived()
    )

    expect(draft.allergens).toEqual(['eggs'])
  })

  it('reconciles the set answer of a step while its single-value answer still takes the edit', () => {
    const dietChosenThenAllergyTapped = applyAllergenSelection(
      setStepFields(createEmptyDraft(), 'diet', {diet: 'vegan'}),
      'eggs'
    )
    const {draft} = seedDraftFromPreferences(makePreferences(), dietChosenThenAllergyTapped)

    expect(draft.diet).toBe('vegan')
    expect(draft.allergens).toEqual(['milk', 'peanuts', 'eggs'])
  })

  it('keeps the stored dislikes and adds the one selected before they arrived', () => {
    const selectedBefore = toggleDislikedFoodId(createEmptyDraft(), 'food-broccoli')
    const {draft} = seedDraftFromPreferences(makePreferences(), selectedBefore)

    expect(draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive', 'food-broccoli'])
  })

  it('does not repeat a dislike the selection and the response both name', () => {
    const selectedBefore = toggleDislikedFoodId(createEmptyDraft(), 'food-olive')
    const {draft} = seedDraftFromPreferences(makePreferences(), selectedBefore)

    expect(draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
  })

  it('keeps the stored food groups and adds the one selected before they arrived', () => {
    const groupSelectedBefore = setStepFields(createEmptyDraft(), 'dislikes', {dislikedFoodGroups: ['olive']})
    const {draft} = seedDraftFromPreferences(makePreferences(), groupSelectedBefore)

    expect(draft.dislikedFoodGroups).toEqual(['mushroom', 'olive'])
  })

  // A stored answer already at the hundred-id bound leaves no room for the addition made under it. The
  // additions are refused as a set rather than trimmed to a count nobody chose, so the stored answer stands
  // whole — the rule `commitDislikeStaging` applies when a response raises that answer mid-visit.
  it('keeps the stored dislikes whole when the addition would take them past the bound', () => {
    const atCap = makePreferences({dislikedFoods: savedDislikedFoods(MAX_DISLIKED_FOOD_IDS)})
    const selectedBefore = toggleDislikedFoodId(createEmptyDraft(), 'food-one-too-many')
    const {draft} = seedDraftFromPreferences(atCap, selectedBefore)

    expect(draft.dislikedFoodIds).toEqual(dislikeIds(MAX_DISLIKED_FOOD_IDS))
    expect(isDislikeSelectionAtCap(draft.dislikedFoodIds)).toBe(true)
  })

  it('still takes an addition that lands exactly on the bound', () => {
    const oneShort = makePreferences({dislikedFoods: savedDislikedFoods(MAX_DISLIKED_FOOD_IDS - 1)})
    const selectedBefore = toggleDislikedFoodId(createEmptyDraft(), 'food-last')
    const {draft} = seedDraftFromPreferences(oneShort, selectedBefore)

    expect(draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
    expect(draft.dislikedFoodIds[MAX_DISLIKED_FOOD_IDS - 1]).toBe('food-last')
  })

  it('records the saved set answers as the baseline, whatever the reconciled draft holds', () => {
    const seeded = seedDraftFromPreferences(makePreferences(), eggsTappedBeforeAnswerArrived())

    expect(seeded.baseline.allergens).toEqual(['milk', 'peanuts'])
    expect(seeded.draft.allergens).toEqual(['milk', 'peanuts', 'eggs'])
  })

  // Reconciliation belongs to the FIRST seed alone. Once the draft has been seeded from a known answer, a
  // removal in it is a removal the user chose against a selection they could see, so a background refetch
  // landing afterwards still takes the edit whole — including what it takes away.
  it('lets a removal made after the answer arrived stand through a later refetch', () => {
    const saved = seedDraftFromPreferences(makePreferences())
    const milkRemoved = applyAllergenSelection(saved, 'milk')
    const refetched = seedDraftFromPreferences(makePreferences(), milkRemoved)

    expect(milkRemoved.draft.allergens).toEqual(['peanuts'])
    expect(refetched.draft.allergens).toEqual(['peanuts'])
  })

  it('lets a dislike removed after the answer arrived stay removed through a later refetch', () => {
    const saved = seedDraftFromPreferences(makePreferences())
    const oliveRemoved = toggleDislikedFoodId(saved, 'food-olive')
    const refetched = seedDraftFromPreferences(makePreferences(), oliveRemoved)

    expect(refetched.draft.dislikedFoodIds).toEqual(['food-mushroom'])
  })

  it('lets None chosen after the answer arrived clear the stored allergies through a later refetch', () => {
    const saved = seedDraftFromPreferences(makePreferences())
    const noneChosen = applyAllergenSelection(saved, ALLERGEN_NONE)
    const refetched = seedDraftFromPreferences(makePreferences(), noneChosen)

    expect(refetched.draft.allergens).toEqual([ALLERGEN_NONE])
  })

  it('reconciles a step the user edited without disturbing the steps they did not', () => {
    const {draft} = seedDraftFromPreferences(makePreferences(), eggsTappedBeforeAnswerArrived())

    expect(draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
    expect(draft.dislikedFoodGroups).toEqual(['mushroom'])
    expect(draft.activityLevel).toBe('lightly_active')
  })

  it('reads the response and the state it replaces without mutating either', () => {
    const preferences = makePreferences()
    const previous = eggsTappedBeforeAnswerArrived()

    seedDraftFromPreferences(preferences, previous)

    expect(preferences.allergens).toEqual(['milk', 'peanuts'])
    expect(previous.draft.allergens).toEqual(['eggs'])
  })

  it('hands the reconciled set to the draft as its own array', () => {
    const preferences = makePreferences()
    const seeded = seedDraftFromPreferences(preferences, eggsTappedBeforeAnswerArrived())

    expect(seeded.draft.allergens).not.toBe(preferences.allergens)
    expect(seeded.draft.allergens).not.toBe(seeded.baseline.allergens)
  })

  it('reconciles the same response and state to the same answer every time', () => {
    const first = seedDraftFromPreferences(makePreferences(), eggsTappedBeforeAnswerArrived())
    const second = seedDraftFromPreferences(makePreferences(), eggsTappedBeforeAnswerArrived())

    expect(first.draft).toEqual(second.draft)
  })
})

// Cancel on a step opened in edit mode. The seven step screens write into the shared draft as the user
// edits, so leaving without saving has to put the step back — and leaving is the swipe and the system back
// as much as the drawn button.
describe('discarding the edits of one step', () => {
  const savedThenEdited = (): MealPlanSetupDraftState =>
    setStepFields(seedDraftFromPreferences(makePreferences()), 'diet', {diet: 'vegan', allergens: ['none']})

  it('returns the step to the saved answers', () => {
    const {draft} = discardStepEdits(savedThenEdited(), 'diet')

    expect(draft.diet).toBe('vegetarian')
    expect(draft.allergens).toEqual(['milk', 'peanuts'])
  })

  it('reports the step as no longer edited', () => {
    expect(discardStepEdits(savedThenEdited(), 'diet').dirty.diet).toBe(false)
  })

  it('leaves every other step of the draft untouched', () => {
    const edited = setStepFields(savedThenEdited(), 'schedule', {mealSchedule: 'three'})
    const discarded = discardStepEdits(edited, 'diet')

    expect(discarded.draft.mealSchedule).toBe('three')
    expect(discarded.dirty.schedule).toBe(true)
  })

  it('empties the draft step of a user who never had saved answers to return to', () => {
    const firstEntry = setStepFields(createEmptyDraft(), 'activity', {activityLevel: 'very_active'})

    expect(discardStepEdits(firstEntry, 'activity').draft.activityLevel).toBeNull()
  })

  it('restores the body step answer marker along with its measurements', () => {
    const skipped = answerBodySkipped(seedDraftFromPreferences(makePreferences({targetRoute: null})))

    expect(discardStepEdits(skipped, 'body').bodyAnswered).toBe(false)
  })

  it('keeps a body answer that was already on the server before the edit', () => {
    const edited = setStepFields(seedDraftFromPreferences(makePreferences()), 'body', {age: 41})
    const discarded = discardStepEdits(edited, 'body')

    expect(discarded.bodyAnswered).toBe(true)
    expect(discarded.draft.age).toBe(34)
  })

  it('drops a food-search visit that belonged to the dislikes edit being abandoned', () => {
    const staging = toggleStagedDislike(beginDislikeStaging(seedDraftFromPreferences(makePreferences())), {
      id: 'food-anchovy',
      name: 'Anchovies',
      foodGroup: 'fish'
    })

    expect(discardStepEdits(staging, 'dislikes').dislikeStaging).toBeNull()
  })

  it('takes nothing back once the step has been marked saved', () => {
    const edited = setStepFields(seedDraftFromPreferences(makePreferences()), 'diet', {diet: 'vegan'})
    const saved = markStepSaved(edited, 'diet')

    expect(discardStepEdits(saved, 'diet').draft.diet).toBe('vegan')
    expect(saved.dirty.diet).toBe(false)
  })

  it('leaves the answers of a saved step alone when another step is discarded', () => {
    const edited = setStepFields(seedDraftFromPreferences(makePreferences()), 'diet', {diet: 'vegan'})
    const saved = markStepSaved(setStepFields(edited, 'activity', {activityLevel: 'active'}), 'activity')

    expect(discardStepEdits(saved, 'diet').draft.activityLevel).toBe('active')
  })
})

// A visit to the food-search screen (06b). It stages rather than answers: nothing it does reaches the step's
// own selection until Done, which is what makes the iOS swipe and Android system back — neither of which
// reaches a handler — discard the visit instead of committing it.
describe('a food-search visit', () => {
  const MUSHROOM = {id: 'food-mushroom', name: 'Mushrooms, white', foodGroup: 'mushroom'}

  const ANCHOVY = {id: 'food-anchovy', name: 'Anchovies', foodGroup: 'fish'}

  const savedState = (): MealPlanSetupDraftState => seedDraftFromPreferences(makePreferences())

  it('opens on the selection the step currently holds', () => {
    const opened = beginDislikeStaging(savedState())

    expect(opened.dislikeStaging).toEqual({added: [], removed: [], labels: {}})
    expect(stagedDislikes(opened)).toEqual({
      selection: ['food-mushroom', 'food-olive'],
      labels: {
        'food-mushroom': MUSHROOM,
        'food-olive': {id: 'food-olive', name: 'Olives', foodGroup: 'olive'}
      }
    })
  })

  // The search screen can be reached while the preferences query is still in flight, so the answer the
  // visit sits on can arrive after the visit has started. Committing a copy of the pre-response selection
  // would delete saved dislikes the user was never shown; the visit is stored as a difference so that a
  // response landing mid-visit changes what Done writes.
  it('reconciles an answer that arrives while the visit is open rather than replacing it', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(createEmptyDraft()), ANCHOVY)
    const seededMidVisit = seedDraftFromPreferences(makePreferences(), staged)

    expect(commitDislikeStaging(seededMidVisit).draft.dislikedFoodIds).toEqual([
      'food-mushroom',
      'food-olive',
      'food-anchovy'
    ])
  })

  it('does not let a visit opened before the answer loaded delete the answer it never showed', () => {
    const clearedBeforeSeed = clearStagedDislikes(beginDislikeStaging(createEmptyDraft()))
    const committed = commitDislikeStaging(seedDraftFromPreferences(makePreferences(), clearedBeforeSeed))

    expect(committed.draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
    expect(committed.dirty.dislikes).toBe(false)
  })

  it('keeps a food taken out during the visit out when the answer is reseeded under it', () => {
    const staged = removeStagedDislike(beginDislikeStaging(savedState()), 'food-mushroom')
    const reseeded = seedDraftFromPreferences(makePreferences(), staged)

    expect(commitDislikeStaging(reseeded).draft.dislikedFoodIds).toEqual(['food-olive'])
  })

  it('reads as the step selection before a visit has been opened, so the screen can render at once', () => {
    expect(stagedDislikes(savedState()).selection).toEqual(['food-mushroom', 'food-olive'])
  })

  it('does not reopen over a visit already in flight', () => {
    const open = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)

    expect(beginDislikeStaging(open)).toBe(open)
  })

  it('leaves the step selection untouched while the visit is being made', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)

    expect(staged.draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
    expect(staged.dirty.dislikes).toBe(false)
  })

  it('records the name of every food it stages, which is the only place a searched food is named', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)

    expect(stagedDislikes(staged).labels['food-anchovy']).toEqual(ANCHOVY)
  })

  it('removes a staged food by id and keeps the name it learned', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)
    const removed = removeStagedDislike(staged, 'food-anchovy')

    expect(stagedDislikes(removed).selection).toEqual(['food-mushroom', 'food-olive'])
    expect(stagedDislikes(removed).labels['food-anchovy']).toEqual(ANCHOVY)
  })

  it('empties the staged selection on Clear all while keeping every name already learned', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)
    const cleared = clearStagedDislikes(staged)

    expect(stagedDislikes(cleared).selection).toEqual([])
    expect(Object.keys(stagedDislikes(cleared).labels).sort()).toEqual(['food-anchovy', 'food-mushroom', 'food-olive'])
  })

  it('writes the visit into the step on Done, with the names it was made with', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)
    const committed = commitDislikeStaging(staged)

    expect(committed.draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive', 'food-anchovy'])
    expect(committed.dislikeLabels['food-anchovy']).toEqual(ANCHOVY)
    expect(committed.dirty.dislikes).toBe(true)
    expect(committed.dislikeStaging).toBeNull()
  })

  it('commits a cleared selection as the empty answer', () => {
    const cleared = clearStagedDislikes(beginDislikeStaging(savedState()))
    const committed = commitDislikeStaging(cleared)

    expect(committed.draft.dislikedFoodIds).toEqual([])
    expect(committed.dirty.dislikes).toBe(true)
  })

  it('does not report the step edited when the visit ends on the selection it started from', () => {
    const untouched = commitDislikeStaging(beginDislikeStaging(savedState()))

    expect(untouched.draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
    expect(untouched.dirty.dislikes).toBe(false)
  })

  it('commits a selection once however many times the same food was staged', () => {
    const staged = toggleStagedDislike(
      toggleStagedDislike(toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY), ANCHOVY),
      ANCHOVY
    )

    expect(commitDislikeStaging(staged).draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive', 'food-anchovy'])
  })

  it('leaves the step selection alone when the visit is discarded', () => {
    const staged = clearStagedDislikes(toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY))
    const discarded = discardDislikeStaging(staged)

    expect(discarded.draft.dislikedFoodIds).toEqual(['food-mushroom', 'food-olive'])
    expect(discarded.dirty.dislikes).toBe(false)
    expect(discarded.dislikeStaging).toBeNull()
  })

  it('discards nothing when no visit is in flight', () => {
    const state = savedState()

    expect(discardDislikeStaging(state)).toBe(state)
  })

  it('commits nothing when no visit is in flight', () => {
    const state = savedState()

    expect(commitDislikeStaging(state)).toBe(state)
  })

  it('survives a background refetch that lands mid-visit', () => {
    const staged = toggleStagedDislike(beginDislikeStaging(savedState()), ANCHOVY)
    const reseeded = seedDraftFromPreferences(makePreferences(), staged)

    expect(stagedDislikes(reseeded).selection).toEqual(['food-mushroom', 'food-olive', 'food-anchovy'])
  })

  // A visit is bounded by the same 100 distinct ids the step's own save is, so Done can never present the
  // server with a selection it refuses.
  describe('the 100 distinct ids the server accepts', () => {
    const FOOD_ZERO = {id: 'food-0', name: 'Food 0', foodGroup: 'other'}

    const visitAtCap = (): MealPlanSetupDraftState =>
      beginDislikeStaging(makeState({dislikedFoodIds: dislikeIds(MAX_DISLIKED_FOOD_IDS)}))

    it('stages the addition that fills the last place, with its name', () => {
      const staged = toggleStagedDislike(beginDislikeStaging(makeState({dislikedFoodIds: dislikeIds(99)})), ANCHOVY)

      expect(stagedDislikes(staged).selection).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(stagedDislikes(staged).labels['food-anchovy']).toEqual(ANCHOVY)
    })

    it('refuses a tap that would pass it, staging neither the id nor the name', () => {
      const opened = visitAtCap()
      const refused = toggleStagedDislike(opened, ANCHOVY)

      expect(refused).toBe(opened)
      expect(stagedDislikes(refused).selection).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(stagedDislikes(refused).labels['food-anchovy']).toBeUndefined()
    })

    it('refuses the tap that passes it once the visit itself has filled the last place', () => {
      const filled = toggleStagedDislike(beginDislikeStaging(makeState({dislikedFoodIds: dislikeIds(99)})), ANCHOVY)
      const refused = toggleStagedDislike(filled, MUSHROOM)

      expect(refused).toBe(filled)
      expect(stagedDislikes(refused).selection).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(stagedDislikes(refused).selection).not.toContain('food-mushroom')
    })

    it('removes a staged food at the cap, and then takes an addition', () => {
      const removed = removeStagedDislike(visitAtCap(), 'food-0')
      const added = toggleStagedDislike(removed, ANCHOVY)

      expect(stagedDislikes(removed).selection).toHaveLength(99)
      expect(stagedDislikes(added).selection).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(stagedDislikes(added).selection).toContain('food-anchovy')
    })

    it('still deselects an already staged food at the cap', () => {
      expect(stagedDislikes(toggleStagedDislike(visitAtCap(), FOOD_ZERO)).selection).not.toContain('food-0')
    })

    it('empties a staged selection at the cap on Clear all', () => {
      expect(stagedDislikes(clearStagedDislikes(visitAtCap())).selection).toEqual([])
    })

    it('commits the full hundred a visit at the cap ends on', () => {
      const committed = commitDislikeStaging(toggleStagedDislike(removeStagedDislike(visitAtCap(), 'food-0'), ANCHOVY))

      expect(committed.draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(committed.draft.dislikedFoodIds).toContain('food-anchovy')
      expect(committed.dirty.dislikes).toBe(true)
    })

    // The one path a tap cannot bound: the answer underneath the visit is raised to the cap by a response
    // landing mid-visit, so what Done would write is larger than either the visit or the answer alone.
    it('refuses the visit additions the answer raised under it no longer leaves room for', () => {
      const staged = toggleStagedDislike(beginDislikeStaging(createEmptyDraft()), ANCHOVY)
      const raised = seedDraftFromPreferences(
        makePreferences({dislikedFoods: savedDislikedFoods(MAX_DISLIKED_FOOD_IDS)}),
        staged
      )
      const committed = commitDislikeStaging(raised)

      expect(committed.draft.dislikedFoodIds).toHaveLength(MAX_DISLIKED_FOOD_IDS)
      expect(committed.draft.dislikedFoodIds).not.toContain('food-anchovy')
      expect(committed.dirty.dislikes).toBe(false)
      expect(committed.dislikeStaging).toBeNull()
    })

    it('still applies the removal of a visit whose additions no longer fit', () => {
      const shortened = removeStagedDislike(beginDislikeStaging(makeState({dislikedFoodIds: dislikeIds(99)})), 'food-0')
      const staged = toggleStagedDislike(toggleStagedDislike(shortened, ANCHOVY), MUSHROOM)
      const raised = seedDraftFromPreferences(
        makePreferences({dislikedFoods: savedDislikedFoods(MAX_DISLIKED_FOOD_IDS)}),
        staged
      )
      const committed = commitDislikeStaging(raised)

      expect(committed.draft.dislikedFoodIds).toHaveLength(99)
      expect(committed.draft.dislikedFoodIds).not.toContain('food-0')
      expect(committed.draft.dislikedFoodIds).not.toContain('food-anchovy')
      expect(committed.dirty.dislikes).toBe(true)
    })
  })
})

// The name each selection was made under. It is not an answer — it never reaches a payload, and the server
// answers 400 read_only_field for a name — so it lives beside the draft and is never rolled back by a step.
describe('the names of selected foods', () => {
  const ANCHOVY = {id: 'food-anchovy', name: 'Anchovies', foodGroup: 'fish'}

  it('is recorded by the selection that made it', () => {
    const toggled = toggleDislikedFood(createEmptyDraft(), ANCHOVY)

    expect(toggled.draft.dislikedFoodIds).toEqual(['food-anchovy'])
    expect(toggled.dislikeLabels['food-anchovy']).toEqual(ANCHOVY)
    expect(toggled.dirty.dislikes).toBe(true)
  })

  it('is kept when the food is deselected, so re-adding it needs no lookup', () => {
    const removed = toggleDislikedFood(toggleDislikedFood(createEmptyDraft(), ANCHOVY), ANCHOVY)

    expect(removed.draft.dislikedFoodIds).toEqual([])
    expect(removed.dislikeLabels['food-anchovy']).toEqual(ANCHOVY)
  })

  it('comes from the saved row for every food a seed reads', () => {
    expect(seedDraftFromPreferences(makePreferences()).dislikeLabels).toEqual({
      'food-mushroom': {id: 'food-mushroom', name: 'Mushrooms, white', foodGroup: 'mushroom'},
      'food-olive': {id: 'food-olive', name: 'Olives', foodGroup: 'olive'}
    })
  })

  it('outlives a reseed that cannot name the food yet', () => {
    const staged = toggleDislikedFood(seedDraftFromPreferences(makePreferences()), ANCHOVY)
    const reseeded = seedDraftFromPreferences(makePreferences(), staged)

    expect(reseeded.dislikeLabels['food-anchovy']).toEqual(ANCHOVY)
  })

  it('adopts the catalog name from the saved row where both can name the food', () => {
    const renamed = makePreferences({
      dislikedFoods: [{id: 'food-mushroom', name: 'Mushrooms, portobello', foodGroup: 'mushroom'}]
    })
    const stale = toggleDislikedFood(createEmptyDraft(), {
      id: 'food-mushroom',
      name: 'Mushrooms, white',
      foodGroup: 'mushroom'
    })

    expect(seedDraftFromPreferences(renamed, stale).dislikeLabels['food-mushroom'].name).toBe('Mushrooms, portobello')
  })

  it('is discarded with the draft when the flow ends', () => {
    const toggled = toggleDislikedFood(createEmptyDraft(), ANCHOVY)

    expect(applyLifecycleEvent(toggled, 'flow_exited')).toEqual(createEmptyDraft())
  })
})
