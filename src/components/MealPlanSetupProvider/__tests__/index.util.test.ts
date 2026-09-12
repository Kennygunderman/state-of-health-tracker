import {MealPlanPreferences, MealTimeEntry} from '@data/models/MealPlanPreferences'

import {
  ALLERGEN_NONE,
  applyAllergenSelection,
  applyBudgetAmount,
  applyMealSchedule,
  applyNoBudgetPreference,
  completedSteps,
  createEmptyDraft,
  DEFAULT_MEAL_TIMES,
  isStepComplete,
  MealPlanSetupDirty,
  MealPlanSetupDraft,
  MealPlanSetupDraftState,
  seedDraftFromPreferences,
  setDislikedFoodIds,
  setMealTime,
  setStepFields,
  stepsForRoute,
  toggleDislikedFoodId
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
  dirty: Partial<MealPlanSetupDirty> = {}
): MealPlanSetupDraftState => ({
  draft: makeDraft(draft),
  dirty: makeDirty(dirty)
})

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

    it('keeps a currency the draft already carries', () => {
      const state = makeState({budget: {amount: 90, currency: 'EUR'}})

      expect(applyBudgetAmount(state, 150).draft.budget).toEqual({amount: 150, currency: 'EUR'})
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
      expect(isStepComplete(makeDraft({goal: 'maintain'}), 'goal')).toBe(true)
    })

    it('needs a pace for lose and gain', () => {
      expect(isStepComplete(makeDraft({goal: 'lose'}), 'goal')).toBe(false)
      expect(isStepComplete(makeDraft({goal: 'gain'}), 'goal')).toBe(false)
      expect(isStepComplete(makeDraft({goal: 'lose', paceLbPerWeek: 0.5}), 'goal')).toBe(true)
      expect(isStepComplete(makeDraft({goal: 'gain', paceLbPerWeek: 1.5}), 'goal')).toBe(true)
    })

    it('treats the goal weight as optional', () => {
      expect(isStepComplete(makeDraft({goal: 'lose', paceLbPerWeek: 1, goalWeightKg: null}), 'goal')).toBe(true)
      expect(isStepComplete(makeDraft({goal: 'maintain', goalWeightKg: null}), 'goal')).toBe(true)
    })

    it('is incomplete while no goal is chosen', () => {
      expect(isStepComplete(makeDraft(), 'goal')).toBe(false)
      expect(isStepComplete(makeDraft({paceLbPerWeek: 1}), 'goal')).toBe(false)
    })
  })

  describe('body', () => {
    it('needs age, height, weight and sex', () => {
      expect(isStepComplete(makeCompleteDraft(), 'body')).toBe(true)
    })

    it('is incomplete while any measurement is missing', () => {
      expect(isStepComplete(makeCompleteDraft({age: null}), 'body')).toBe(false)
      expect(isStepComplete(makeCompleteDraft({heightCm: null}), 'body')).toBe(false)
      expect(isStepComplete(makeCompleteDraft({weightKg: null}), 'body')).toBe(false)
      expect(isStepComplete(makeCompleteDraft({sexForEstimate: null}), 'body')).toBe(false)
    })

    it('accepts prefer-not-to-say as an answer to the sex question', () => {
      expect(isStepComplete(makeCompleteDraft({sexForEstimate: 'prefer_not_to_say'}), 'body')).toBe(true)
    })
  })

  describe('activity', () => {
    it('needs an activity level', () => {
      expect(isStepComplete(makeDraft({activityLevel: 'very_active'}), 'activity')).toBe(true)
      expect(isStepComplete(makeDraft(), 'activity')).toBe(false)
    })
  })

  describe('diet', () => {
    it('needs a diet', () => {
      expect(isStepComplete(makeDraft({allergens: ['milk']}), 'diet')).toBe(false)
      expect(isStepComplete(makeDraft({diet: 'vegan', allergens: ['milk']}), 'diet')).toBe(true)
    })

    it('counts the None sentinel as an allergy answer but an empty list as unanswered', () => {
      expect(isStepComplete(makeDraft({diet: 'none', allergens: [ALLERGEN_NONE]}), 'diet')).toBe(true)
      expect(isStepComplete(makeDraft({diet: 'none', allergens: []}), 'diet')).toBe(false)
    })
  })

  describe('dislikes', () => {
    it('is complete whether or not anything is selected', () => {
      expect(isStepComplete(makeDraft(), 'dislikes')).toBe(true)
      expect(isStepComplete(makeDraft({dislikedFoodIds: ['food-olive']}), 'dislikes')).toBe(true)
    })
  })

  describe('schedule', () => {
    it('needs a schedule and a time for each of its slots', () => {
      expect(isStepComplete(applyMealSchedule(makeState(), 'three').draft, 'schedule')).toBe(true)
      expect(isStepComplete(applyMealSchedule(makeState(), 'three_plus_snack').draft, 'schedule')).toBe(true)
    })

    it('is incomplete while no schedule is chosen', () => {
      expect(isStepComplete(makeDraft({mealTimes: [{slot: 'breakfast', time: '08:00'}]}), 'schedule')).toBe(false)
    })

    it('is incomplete while a slot of the chosen schedule has no time', () => {
      const missingSnack = makeDraft({
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
      const blankLunch = makeDraft({
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
      const extraSnack = makeDraft({
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
      expect(isStepComplete(makeDraft({cookingTimeLimitMin: 30, noBudgetPreference: true}), 'cooking')).toBe(true)
      expect(
        isStepComplete(makeDraft({cookingTimeLimitMin: 15, budget: {amount: 120, currency: 'USD'}}), 'cooking')
      ).toBe(true)
    })

    it('is incomplete while neither budget answer is given', () => {
      expect(isStepComplete(makeDraft({cookingTimeLimitMin: 60}), 'cooking')).toBe(false)
    })

    it('is incomplete while no cooking-time limit is chosen', () => {
      expect(isStepComplete(makeDraft({noBudgetPreference: true}), 'cooking')).toBe(false)
      expect(isStepComplete(makeDraft({budget: {amount: 120, currency: 'USD'}}), 'cooking')).toBe(false)
    })
  })

  it('does not mutate the draft it reads', () => {
    const draft = makeCompleteDraft()
    const snapshot = makeCompleteDraft()

    stepsForRoute('estimated').forEach(step => isStepComplete(draft, step))

    expect(draft).toEqual(snapshot)
  })
})

describe('completedSteps', () => {
  it('returns every step of the estimated route in wizard order for a fully answered draft', () => {
    expect(completedSteps(makeCompleteDraft(), 'estimated')).toEqual([
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
    const manualDraft = makeCompleteDraft({activityLevel: null, sexForEstimate: 'prefer_not_to_say'})

    expect(completedSteps(manualDraft, 'manual')).toEqual(['goal', 'body', 'diet', 'dislikes', 'schedule', 'cooking'])
  })

  it('counts only the route it was given', () => {
    const manualDraft = makeCompleteDraft({activityLevel: null})

    expect(completedSteps(manualDraft, 'estimated')).not.toContain('activity')
    expect(completedSteps(manualDraft, 'estimated')).toHaveLength(6)
    expect(completedSteps(manualDraft, 'manual')).toHaveLength(6)
  })

  it('counts only the dislikes step for an untouched draft', () => {
    expect(completedSteps(createEmptyDraft().draft, 'estimated')).toEqual(['dislikes'])
    expect(completedSteps(createEmptyDraft().draft, 'manual')).toEqual(['dislikes'])
  })

  it('drops a step again once its answer is cleared', () => {
    const withoutSchedule = makeCompleteDraft({mealSchedule: null, mealTimes: []})

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

describe('determinism', () => {
  it('returns an equal result for repeated calls with the same input', () => {
    const state = makeState({allergens: ['milk']})

    expect(applyAllergenSelection(state, 'eggs')).toEqual(applyAllergenSelection(state, 'eggs'))
    expect(applyMealSchedule(state, 'three_plus_snack')).toEqual(applyMealSchedule(state, 'three_plus_snack'))
    expect(setDislikedFoodIds(state, ['food-olive'])).toEqual(setDislikedFoodIds(state, ['food-olive']))
    expect(applyBudgetAmount(state, 120)).toEqual(applyBudgetAmount(state, 120))
  })

  it('derives the same progress from the same draft', () => {
    const draft = makeCompleteDraft()

    expect(completedSteps(draft, 'estimated')).toEqual(completedSteps(draft, 'estimated'))
    expect(seedDraftFromPreferences(makePreferences())).toEqual(seedDraftFromPreferences(makePreferences()))
  })
})
