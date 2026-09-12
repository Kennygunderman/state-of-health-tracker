import {resolveStaleRevision} from '../RevisionConflictUtility'

type MealTime = {slot: string; time: string}

type PreferencesShape = {
  goal: string | null
  age: number | null
  weightKg: number | null
  diet: string | null
  allergens: string[]
  dislikedFoodIds: string[]
  mealSchedule: string | null
  mealTimes: MealTime[]
  cookingTimeLimitMin: number | null
  budget: {amount: number; currency: string} | null
  noBudgetPreference: boolean
  timeZone: string | null
}

type TargetsShape = {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
}

const PREFERENCE_FIELDS = [
  'goal',
  'age',
  'weightKg',
  'diet',
  'allergens',
  'dislikedFoodIds',
  'mealSchedule',
  'mealTimes',
  'cookingTimeLimitMin',
  'budget',
  'noBudgetPreference',
  'timeZone'
] as const

const TARGET_FIELDS = ['calories', 'protein', 'carbs', 'fat'] as const

const freshPreferences = (overrides: Partial<PreferencesShape> = {}): PreferencesShape => ({
  goal: 'lose',
  age: 34,
  weightKg: 82.6,
  diet: 'none',
  allergens: ['milk', 'peanuts'],
  dislikedFoodIds: ['a1', 'b2'],
  mealSchedule: 'three',
  mealTimes: [
    {slot: 'breakfast', time: '08:00'},
    {slot: 'lunch', time: '12:30'},
    {slot: 'dinner', time: '18:30'}
  ],
  cookingTimeLimitMin: 30,
  budget: {amount: 90, currency: 'USD'},
  noBudgetPreference: false,
  timeZone: 'Pacific/Auckland',
  ...overrides
})

describe('resolveStaleRevision', () => {
  describe('silent resolution', () => {
    it('resolves when every compared field is identical', () => {
      const fresh = freshPreferences()
      const draft: Partial<PreferencesShape> = freshPreferences()

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('resolves an empty field list', () => {
      const fresh = freshPreferences()

      expect(resolveStaleRevision({cookingTimeLimitMin: 45}, fresh, [])).toEqual({status: 'resolved'})
    })

    it('resolves an empty draft', () => {
      const fresh = freshPreferences()

      expect(resolveStaleRevision({}, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('ignores a listed field the draft never carried, even when the fresh value differs', () => {
      const fresh = freshPreferences({cookingTimeLimitMin: 60})

      expect(resolveStaleRevision({goal: 'lose'}, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('ignores a field explicitly set to undefined in the draft', () => {
      const fresh = freshPreferences({age: 41})
      const draft: Partial<PreferencesShape> = {age: undefined}

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('ignores a draft undefined against a fresh null, which comparison alone would call a difference', () => {
      const fresh = freshPreferences({budget: null})
      const draft: Partial<PreferencesShape> = {budget: undefined}

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('treats null as equal to null', () => {
      const fresh = freshPreferences({budget: null, timeZone: null})

      expect(resolveStaleRevision({budget: null, timeZone: null}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'resolved'
      })
    })

    it('resolves a false boolean draft value that matches', () => {
      const fresh = freshPreferences({noBudgetPreference: false})

      expect(resolveStaleRevision({noBudgetPreference: false}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'resolved'
      })
    })

    it('resolves a zero numeric draft value that matches', () => {
      const fresh = freshPreferences({age: 0, weightKg: 0})
      const draft: Partial<PreferencesShape> = {age: 0, weightKg: 0}

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('resolves a resubmitted draft that a lost first attempt had already written', () => {
      const draft: Partial<PreferencesShape> = {cookingTimeLimitMin: 45, allergens: ['milk', 'soy']}
      const fresh = freshPreferences({cookingTimeLimitMin: 45, allergens: ['milk', 'soy']})

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('resolves when another device had already saved the same answers', () => {
      const fresh = freshPreferences({allergens: ['soy', 'milk'], diet: 'vegan'})
      const draft: Partial<PreferencesShape> = {allergens: ['milk', 'soy'], diet: 'vegan'}

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('resolves a single-field list whose one field matches', () => {
      const fresh = freshPreferences({cookingTimeLimitMin: 30})

      expect(resolveStaleRevision({cookingTimeLimitMin: 30}, fresh, ['cookingTimeLimitMin'])).toEqual({
        status: 'resolved'
      })
    })

    it('resolves an empty field list however far the draft has drifted', () => {
      const fresh = freshPreferences({goal: 'gain', diet: 'vegan', cookingTimeLimitMin: 60, allergens: ['soy']})
      const draft: Partial<PreferencesShape> = {
        goal: 'lose',
        diet: 'none',
        cookingTimeLimitMin: 15,
        allergens: ['milk']
      }

      expect(resolveStaleRevision(draft, fresh, [])).toEqual({status: 'resolved'})
    })
  })

  describe('primitive comparison', () => {
    it('reports a single differing primitive', () => {
      const fresh = freshPreferences({cookingTimeLimitMin: 45})

      expect(resolveStaleRevision({cookingTimeLimitMin: 30}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['cookingTimeLimitMin']
      })
    })

    it('names every differing field in the order the caller listed them, not the draft order', () => {
      const fresh = freshPreferences({goal: 'gain', cookingTimeLimitMin: 45})
      const draft: Partial<PreferencesShape> = {cookingTimeLimitMin: 30, goal: 'lose'}

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['goal', 'cookingTimeLimitMin']
      })
    })

    it('reports a draft null against a fresh value', () => {
      const fresh = freshPreferences({age: 34})

      expect(resolveStaleRevision({age: null}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['age']
      })
    })

    it('reports a draft value against a fresh null', () => {
      const fresh = freshPreferences({diet: null})

      expect(resolveStaleRevision({diet: 'vegan'}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['diet']
      })
    })

    it('does not treat null as equal to zero or to an empty string', () => {
      const zeroFresh = freshPreferences({age: 0})
      const emptyFresh = freshPreferences({timeZone: ''})

      expect(resolveStaleRevision({age: null}, zeroFresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['age']
      })
      expect(resolveStaleRevision({timeZone: null}, emptyFresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['timeZone']
      })
    })

    it('distinguishes a numeric value from its string form', () => {
      const fresh = freshPreferences()
      const draft = {age: '34'} as unknown as Partial<PreferencesShape>

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['age']
      })
    })

    it('names only the differing field when three are listed', () => {
      const fields = ['goal', 'diet', 'cookingTimeLimitMin'] as const
      const fresh = freshPreferences({cookingTimeLimitMin: 45})
      const draft: Partial<PreferencesShape> = {goal: 'lose', diet: 'none', cookingTimeLimitMin: 30}

      expect(resolveStaleRevision(draft, fresh, fields)).toEqual({
        status: 'conflict',
        conflictingFields: ['cookingTimeLimitMin']
      })
    })

    it('ignores a differing field the caller did not list', () => {
      const fields = ['goal', 'diet'] as const
      const fresh = freshPreferences({cookingTimeLimitMin: 45})
      const draft: Partial<PreferencesShape> = {goal: 'lose', diet: 'none', cookingTimeLimitMin: 30}

      expect(resolveStaleRevision(draft, fresh, fields)).toEqual({status: 'resolved'})
    })
  })

  describe('draft presence', () => {
    it('ignores a listed field the draft never edited, even though the fresh value moved', () => {
      const fresh = freshPreferences({weightKg: 79.4})

      expect(resolveStaleRevision({goal: 'lose'}, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('resolves a listed field the draft carries with a matching value', () => {
      const fresh = freshPreferences({weightKg: 82.6})

      expect(resolveStaleRevision({weightKg: 82.6}, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('reports a listed field the draft carries with a differing value', () => {
      const fresh = freshPreferences({weightKg: 79.4})

      expect(resolveStaleRevision({weightKg: 82.6}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['weightKg']
      })
    })

    it('reports a drafted field the fresh resource no longer carries', () => {
      const fresh: Partial<PreferencesShape> = {goal: 'lose', age: 34}
      const draft: Partial<PreferencesShape> = {diet: 'vegan'}

      expect(resolveStaleRevision<Partial<PreferencesShape>>(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['diet']
      })
    })
  })

  describe('arrays of primitives compare as sets', () => {
    it('resolves a reordered identical selection', () => {
      const fresh = freshPreferences({allergens: ['peanuts', 'milk']})

      expect(resolveStaleRevision({allergens: ['milk', 'peanuts']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'resolved'
      })
    })

    it('reports an added member', () => {
      const fresh = freshPreferences({allergens: ['milk', 'soy']})

      expect(resolveStaleRevision({allergens: ['milk']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['allergens']
      })
    })

    it('reports a removed member', () => {
      const fresh = freshPreferences({dislikedFoodIds: ['a1']})

      expect(resolveStaleRevision({dislikedFoodIds: ['a1', 'b2']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['dislikedFoodIds']
      })
    })

    it('reports a swapped member of equal length', () => {
      const fresh = freshPreferences({allergens: ['milk', 'sesame']})

      expect(resolveStaleRevision({allergens: ['milk', 'peanuts']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['allergens']
      })
    })

    it('distinguishes repeated members from distinct ones', () => {
      const fresh = freshPreferences({allergens: ['milk', 'soy']})

      expect(resolveStaleRevision({allergens: ['milk', 'milk']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['allergens']
      })
    })

    it('counts repeated members, so a duplicated selection differs from a single one', () => {
      const fresh = freshPreferences({allergens: ['milk']})

      expect(resolveStaleRevision({allergens: ['milk', 'milk']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['allergens']
      })
    })

    it('falls back to element-wise comparison for a selection holding a null', () => {
      const fresh = freshPreferences({allergens: [null, 'milk'] as unknown as string[]})
      const draft = {allergens: ['milk', null]} as unknown as Partial<PreferencesShape>

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['allergens']
      })
    })

    it('resolves two empty selections', () => {
      const fresh = freshPreferences({allergens: []})

      expect(resolveStaleRevision({allergens: []}, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('reports an emptied selection', () => {
      const fresh = freshPreferences({allergens: []})

      expect(resolveStaleRevision({allergens: ['milk']}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['allergens']
      })
    })

    it('does not mutate or reorder the caller arrays', () => {
      const draftAllergens = ['peanuts', 'milk']
      const freshAllergens = ['milk', 'peanuts']
      const fresh = freshPreferences({allergens: freshAllergens})

      expect(resolveStaleRevision({allergens: draftAllergens}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'resolved'
      })
      expect(draftAllergens).toEqual(['peanuts', 'milk'])
      expect(freshAllergens).toEqual(['milk', 'peanuts'])
    })
  })

  describe('arrays of objects compare element-wise in order', () => {
    it('resolves an identical schedule', () => {
      const fresh = freshPreferences()
      const draft: Partial<PreferencesShape> = {
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'dinner', time: '18:30'}
        ]
      }

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({status: 'resolved'})
    })

    it('reports a changed time', () => {
      const fresh = freshPreferences()
      const draft: Partial<PreferencesShape> = {
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '13:00'},
          {slot: 'dinner', time: '18:30'}
        ]
      }

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['mealTimes']
      })
    })

    it('reports a reordered schedule because slot order is meaningful', () => {
      const fresh = freshPreferences()
      const draft: Partial<PreferencesShape> = {
        mealTimes: [
          {slot: 'lunch', time: '12:30'},
          {slot: 'breakfast', time: '08:00'},
          {slot: 'dinner', time: '18:30'}
        ]
      }

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['mealTimes']
      })
    })

    it('reports an appended slot', () => {
      const fresh = freshPreferences()
      const draft: Partial<PreferencesShape> = {
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '12:30'},
          {slot: 'dinner', time: '18:30'},
          {slot: 'snack', time: '15:30'}
        ]
      }

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['mealTimes']
      })
    })
  })

  describe('nested objects compare deeply', () => {
    it('resolves an equal budget held in a different object instance', () => {
      const fresh = freshPreferences({budget: {amount: 90, currency: 'USD'}})

      expect(resolveStaleRevision({budget: {amount: 90, currency: 'USD'}}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'resolved'
      })
    })

    it('reports a changed amount', () => {
      const fresh = freshPreferences({budget: {amount: 90, currency: 'USD'}})

      expect(resolveStaleRevision({budget: {amount: 120, currency: 'USD'}}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['budget']
      })
    })

    it('reports a changed currency', () => {
      const fresh = freshPreferences({budget: {amount: 90, currency: 'USD'}})

      expect(resolveStaleRevision({budget: {amount: 90, currency: 'EUR'}}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['budget']
      })
    })

    it('reports a cleared budget against a fresh object', () => {
      const fresh = freshPreferences({budget: {amount: 90, currency: 'USD'}})

      expect(resolveStaleRevision({budget: null}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['budget']
      })
    })

    it('reports a budget set against a cleared fresh value', () => {
      const fresh = freshPreferences({budget: null})

      expect(resolveStaleRevision({budget: {amount: 90, currency: 'USD'}}, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['budget']
      })
    })

    it('treats a missing key on one side as a difference', () => {
      const fresh = freshPreferences({budget: {amount: 90, currency: 'USD'}})
      const draft = {budget: {amount: 90}} as unknown as Partial<PreferencesShape>

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['budget']
      })
    })

    it('reports an array held against an object', () => {
      const fresh = freshPreferences({budget: {amount: 90, currency: 'USD'}})
      const draft = {budget: []} as unknown as Partial<PreferencesShape>

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['budget']
      })
    })
  })

  describe('purity', () => {
    it('leaves the draft and the fresh resource deeply unchanged', () => {
      const fresh = freshPreferences({allergens: ['peanuts', 'milk'], cookingTimeLimitMin: 45})
      const draft: Partial<PreferencesShape> = {
        allergens: ['milk', 'peanuts'],
        cookingTimeLimitMin: 30,
        budget: {amount: 90, currency: 'USD'},
        mealTimes: [
          {slot: 'breakfast', time: '08:00'},
          {slot: 'lunch', time: '13:00'}
        ]
      }
      const draftBefore: Partial<PreferencesShape> = JSON.parse(JSON.stringify(draft))
      const freshBefore: PreferencesShape = JSON.parse(JSON.stringify(fresh))

      resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)

      expect(draft).toEqual(draftBefore)
      expect(fresh).toEqual(freshBefore)
    })

    it('returns an equal result when called twice with the same arguments', () => {
      const fresh = freshPreferences({goal: 'gain', cookingTimeLimitMin: 45})
      const draft: Partial<PreferencesShape> = {goal: 'lose', cookingTimeLimitMin: 30}
      const first = resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)

      expect(resolveStaleRevision(draft, fresh, PREFERENCE_FIELDS)).toEqual(first)
    })

    it('returns a conflicting-field list the caller cannot mutate its inputs through', () => {
      const fields = ['allergens', 'cookingTimeLimitMin'] as const
      const draftAllergens = ['milk']
      const fresh = freshPreferences({allergens: ['milk', 'soy'], cookingTimeLimitMin: 45})
      const result = resolveStaleRevision({allergens: draftAllergens, cookingTimeLimitMin: 30}, fresh, fields)

      expect(result).toEqual({status: 'conflict', conflictingFields: ['allergens', 'cookingTimeLimitMin']})

      if (result.status === 'conflict') {
        result.conflictingFields.push('goal')
      }

      expect(fields).toEqual(['allergens', 'cookingTimeLimitMin'])
      expect(draftAllergens).toEqual(['milk'])
    })
  })

  describe('targets-shaped drafts', () => {
    const freshTargets: TargetsShape = {calories: 1940, protein: 146, carbs: 194, fat: 65}

    it('resolves an identical target save', () => {
      const draft: Partial<TargetsShape> = {calories: 1940, protein: 146, carbs: 194, fat: 65}

      expect(resolveStaleRevision(draft, freshTargets, TARGET_FIELDS)).toEqual({status: 'resolved'})
    })

    it('reports the changed macro only', () => {
      const draft: Partial<TargetsShape> = {calories: 1940, protein: 146, carbs: 210, fat: 65}

      expect(resolveStaleRevision(draft, freshTargets, TARGET_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['carbs']
      })
    })

    it('reports every changed macro in compare order', () => {
      const draft: Partial<TargetsShape> = {fat: 70, calories: 2100}

      expect(resolveStaleRevision(draft, freshTargets, TARGET_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['calories', 'fat']
      })
    })

    it('names all four macros when every one differs', () => {
      const draft: Partial<TargetsShape> = {fat: 70, carbs: 200, protein: 150, calories: 2100}

      expect(resolveStaleRevision(draft, freshTargets, TARGET_FIELDS)).toEqual({
        status: 'conflict',
        conflictingFields: ['calories', 'protein', 'carbs', 'fat']
      })
    })

    it('resolves a partial draft whose listed fields all match', () => {
      const draft: Partial<TargetsShape> = {calories: 1940}

      expect(resolveStaleRevision(draft, freshTargets, TARGET_FIELDS)).toEqual({status: 'resolved'})
    })
  })
})
