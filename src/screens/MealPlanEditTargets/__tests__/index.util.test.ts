import type {
  NutritionTargetEstimate,
  NutritionTargetFeasibilityWarning,
  NutritionTargets
} from '@data/models/NutritionTargets'

import {MEAL_PLAN_TARGET_WARNING_LABELS} from '@constants/strings'

import {
  CALORIES_MAX,
  CALORIES_MIN,
  EditTargetsFields,
  feasibilityBannerBody,
  MACRO_MAX,
  MACRO_MIN,
  resolveEditTargetsIntent,
  resolveTargetsSave,
  resolveTargetsSaveSource,
  sanitizeIntegerInput,
  TargetsSaveInputs,
  validateEditTargets
} from '../index.util'

const makeFields = (overrides: Partial<EditTargetsFields> = {}): EditTargetsFields => ({
  calories: '1940',
  protein: '146',
  carbs: '194',
  fat: '65',
  ...overrides
})

const makeEstimate = (overrides: Partial<NutritionTargetEstimate> = {}): NutritionTargetEstimate => ({
  source: 'estimated',
  estimateRevision: 4,
  inputs: {
    age: 34,
    heightCm: 177.8,
    weightKg: 82.6,
    sexForEstimate: 'female',
    activityLevel: 'lightly_active',
    goal: 'lose',
    paceLbPerWeek: 1
  },
  bmr: 1606,
  tdee: 2209,
  adjustment: -500,
  calories: 1940,
  protein: 146,
  carbs: 194,
  fat: 65,
  clamped: false,
  clampReason: null,
  ...overrides
})

const makeTargets = (overrides: Partial<NutritionTargets> = {}): NutritionTargets => ({
  targets: {calories: 2100, protein: 150, carbs: 220, fat: 70},
  complete: true,
  source: 'estimated',
  stale: false,
  revision: 3,
  ...overrides
})

// The default is the state the confirmation path arrives in: the screen opened on the estimate, its fields still
// hold it, and the server already holds a confirmed set at revision 3.
const makeSaveInputs = (overrides: Partial<TargetsSaveInputs> = {}): TargetsSaveInputs => ({
  intent: 'confirm_estimate',
  fields: makeFields(),
  estimate: makeEstimate(),
  targets: makeTargets(),
  ...overrides
})

describe('target bounds', () => {
  it('pins the manual-target policy bounds the server validates', () => {
    expect(CALORIES_MIN).toBe(800)
    expect(CALORIES_MAX).toBe(6000)
    expect(MACRO_MIN).toBe(1)
    expect(MACRO_MAX).toBe(1000)
  })
})

describe('sanitizeIntegerInput', () => {
  it('keeps a plain whole number as typed', () => {
    expect(sanitizeIntegerInput('1940', '194')).toBe('1940')
  })

  // Targets are whole numbers: surrounding space and a well-formed group separator are presentation, so
  // they are the only characters removed.
  it('drops the group separators and the spaces the field never stores', () => {
    expect(sanitizeIntegerInput('1,940 ', '194')).toBe('1940')
    expect(sanitizeIntegerInput('10,000', '194')).toBe('10000')
    expect(sanitizeIntegerInput(' 65 ', '146')).toBe('65')
  })

  it('drops a redundant leading zero', () => {
    expect(sanitizeIntegerInput('0500', '0')).toBe('500')
  })

  it('keeps a lone zero, which the user is still typing', () => {
    expect(sanitizeIntegerInput('0', '')).toBe('0')
  })

  it('empties the field for an empty entry rather than inventing a zero', () => {
    expect(sanitizeIntegerInput('', '1940')).toBe('')
    expect(sanitizeIntegerInput('   ', '1940')).toBe('')
  })

  // The reason this function is syntax-aware: deleting the semantic characters would store '19.40' as 1940
  // and '-500' as 500 — a different target the user never typed, which every later check accepts as valid.
  // A refused entry leaves the field holding exactly what it held.
  it('refuses a decimal instead of concatenating its digits', () => {
    expect(sanitizeIntegerInput('19.40', '1940')).toBe('1940')
    expect(sanitizeIntegerInput('19.', '1940')).toBe('1940')
    expect(sanitizeIntegerInput('.5', '1940')).toBe('1940')
  })

  it('refuses a signed target instead of dropping the sign', () => {
    expect(sanitizeIntegerInput('-500', '146')).toBe('146')
    expect(sanitizeIntegerInput('+500', '146')).toBe('146')
  })

  it('refuses mixed prose instead of harvesting the digits out of it', () => {
    expect(sanitizeIntegerInput('19a40', '1940')).toBe('1940')
    expect(sanitizeIntegerInput('abc', '1940')).toBe('1940')
    expect(sanitizeIntegerInput('19 40', '1940')).toBe('1940')
    expect(sanitizeIntegerInput('1e3', '1940')).toBe('1940')
  })

  it('refuses a malformed group instead of reading it as a larger number', () => {
    expect(sanitizeIntegerInput('1,94', '1940')).toBe('1940')
    expect(sanitizeIntegerInput('19,4000', '1940')).toBe('1940')
    expect(sanitizeIntegerInput(',940', '1940')).toBe('1940')
  })

  // A caller with nothing to preserve — the manual route opens every field blank — still never receives a
  // rewritten value.
  it('empties the field when a refused entry has no previous value to keep', () => {
    expect(sanitizeIntegerInput('19.40')).toBe('')
    expect(sanitizeIntegerInput('-500')).toBe('')
    expect(sanitizeIntegerInput('abc')).toBe('')
  })

  // Nothing the bounds check rejects for its syntax may reach it in a rewritten, acceptable form.
  it('refuses every entry validateEditTargets rejects as not a number', () => {
    const refused = ['19.40', '1940.5', '-500', '+500', 'one thousand', '1e3', 'NaN', '1,94']

    refused.forEach(text => {
      expect(sanitizeIntegerInput(text, '1940')).toBe('1940')
      expect(validateEditTargets(makeFields({calories: text})).errors).toEqual({calories: 'not_a_number'})
    })
  })

  it('never re-formats, so a partially typed value can still be extended', () => {
    expect(sanitizeIntegerInput('1')).toBe('1')
    expect(sanitizeIntegerInput('19')).toBe('19')
    expect(sanitizeIntegerInput('1940')).not.toBe('1,940')
  })
})

describe('validateEditTargets', () => {
  describe('a complete in-range set', () => {
    it('accepts four in-range whole numbers', () => {
      expect(validateEditTargets(makeFields())).toEqual({errors: {}, isValid: true})
    })

    it('tolerates surrounding whitespace on an otherwise valid value', () => {
      expect(validateEditTargets(makeFields({fat: ' 65 '})).isValid).toBe(true)
    })

    it('does not mutate the fields it is given', () => {
      const fields = makeFields({calories: ''})

      validateEditTargets(fields)

      expect(fields).toEqual(makeFields({calories: ''}))
    })
  })

  describe('missing and malformed input', () => {
    it('reports a blank field as required, the state the manual route opens every field in', () => {
      expect(validateEditTargets(makeFields({calories: ''})).errors).toEqual({calories: 'required'})
      expect(validateEditTargets(makeFields({protein: '   '})).errors).toEqual({protein: 'required'})
      expect(validateEditTargets({calories: '', protein: '', carbs: '', fat: ''}).isValid).toBe(false)
    })

    it('distinguishes a non-numeric value from an empty one', () => {
      expect(validateEditTargets(makeFields({calories: 'abc'})).errors).toEqual({calories: 'not_a_number'})
      expect(validateEditTargets(makeFields({fat: '-5'})).errors).toEqual({fat: 'not_a_number'})
    })

    it('rejects a decimal because a target is only ever a whole number', () => {
      expect(validateEditTargets(makeFields({carbs: '1.5'})).errors).toEqual({carbs: 'not_a_number'})
      expect(validateEditTargets(makeFields({calories: '1940.5'})).errors).toEqual({calories: 'not_a_number'})
    })
  })

  describe('calories', () => {
    it('rejects 799 as below the minimum and accepts 800', () => {
      expect(validateEditTargets(makeFields({calories: '799'})).errors).toEqual({calories: 'below_min'})
      expect(validateEditTargets(makeFields({calories: '800'})).isValid).toBe(true)
    })

    it('accepts 6000 and rejects 6001 as above the maximum', () => {
      expect(validateEditTargets(makeFields({calories: '6000'})).isValid).toBe(true)
      expect(validateEditTargets(makeFields({calories: '6001'})).errors).toEqual({calories: 'above_max'})
    })
  })

  describe('protein', () => {
    it('rejects 0 grams as below the minimum and accepts 1 gram', () => {
      expect(validateEditTargets(makeFields({protein: '0'})).errors).toEqual({protein: 'below_min'})
      expect(validateEditTargets(makeFields({protein: '1'})).isValid).toBe(true)
    })

    it('accepts 1000 grams and rejects 1001 as above the maximum', () => {
      expect(validateEditTargets(makeFields({protein: '1000'})).isValid).toBe(true)
      expect(validateEditTargets(makeFields({protein: '1001'})).errors).toEqual({protein: 'above_max'})
    })
  })

  describe('carbs', () => {
    it('rejects 0 grams as below the minimum and accepts 1 gram', () => {
      expect(validateEditTargets(makeFields({carbs: '0'})).errors).toEqual({carbs: 'below_min'})
      expect(validateEditTargets(makeFields({carbs: '1'})).isValid).toBe(true)
    })

    it('accepts 1000 grams and rejects 1001 as above the maximum', () => {
      expect(validateEditTargets(makeFields({carbs: '1000'})).isValid).toBe(true)
      expect(validateEditTargets(makeFields({carbs: '1001'})).errors).toEqual({carbs: 'above_max'})
    })
  })

  describe('fat', () => {
    it('rejects 0 grams as below the minimum and accepts 1 gram', () => {
      expect(validateEditTargets(makeFields({fat: '0'})).errors).toEqual({fat: 'below_min'})
      expect(validateEditTargets(makeFields({fat: '1'})).isValid).toBe(true)
    })

    it('accepts 1000 grams and rejects 1001 as above the maximum', () => {
      expect(validateEditTargets(makeFields({fat: '1000'})).isValid).toBe(true)
      expect(validateEditTargets(makeFields({fat: '1001'})).errors).toEqual({fat: 'above_max'})
    })
  })

  describe('every field at once', () => {
    it('reports every offending field in one pass', () => {
      const validation = validateEditTargets({calories: '', protein: 'abc', carbs: '0', fat: '1001'})

      expect(validation.errors).toEqual({
        calories: 'required',
        protein: 'not_a_number',
        carbs: 'below_min',
        fat: 'above_max'
      })
      expect(Object.keys(validation.errors)).toHaveLength(4)
      expect(validation.isValid).toBe(false)
    })
  })
})

describe('resolveEditTargetsIntent', () => {
  it('reads the manual route as manual entry whatever else it is told', () => {
    expect(resolveEditTargetsIntent({mode: 'manual', targets: null})).toBe('manual_entry')
    expect(resolveEditTargetsIntent({mode: 'manual', routeIntent: 'confirm_estimate', targets: makeTargets()})).toBe(
      'manual_entry'
    )
  })

  it('honours the intent the opening row stated', () => {
    expect(
      resolveEditTargetsIntent({mode: 'edit', routeIntent: 'confirm_estimate', targets: makeTargets({stale: true})})
    ).toBe('confirm_estimate')
    expect(resolveEditTargetsIntent({mode: 'setup', routeIntent: 'edit_saved', targets: null})).toBe('edit_saved')
  })

  it('falls back to editing whatever figures the server already holds', () => {
    expect(resolveEditTargetsIntent({mode: 'edit', targets: makeTargets()})).toBe('edit_saved')
    expect(
      resolveEditTargetsIntent({
        mode: 'edit',
        targets: makeTargets({
          targets: {calories: 1900, protein: null, carbs: null, fat: null},
          complete: false,
          source: 'legacy'
        })
      })
    ).toBe('edit_saved')
  })

  it('falls back to confirming the estimate when the server holds no figure at all', () => {
    expect(resolveEditTargetsIntent({mode: 'edit', targets: null})).toBe('confirm_estimate')
    expect(
      resolveEditTargetsIntent({mode: 'setup', targets: makeTargets({targets: null, complete: false, source: null})})
    ).toBe('confirm_estimate')
    expect(
      resolveEditTargetsIntent({
        mode: 'edit',
        targets: makeTargets({
          targets: {calories: null, protein: null, carbs: null, fat: null},
          complete: false,
          source: null
        })
      })
    ).toBe('confirm_estimate')
  })
})

describe('resolveTargetsSaveSource', () => {
  it('claims estimated only for an explicit confirmation whose fields still hold the estimate', () => {
    expect(resolveTargetsSaveSource(makeSaveInputs())).toBe('estimated')
    expect(resolveTargetsSaveSource(makeSaveInputs({fields: makeFields({calories: ' 1940 '})}))).toBe('estimated')
  })

  it('reports manual when a single digit was edited away from the estimate', () => {
    expect(resolveTargetsSaveSource(makeSaveInputs({fields: makeFields({calories: '1941'})}))).toBe('manual')
    expect(resolveTargetsSaveSource(makeSaveInputs({fields: makeFields({fat: '64'})}))).toBe('manual')
  })

  it('reports manual for an edit of saved targets even when the entered numbers equal the estimate', () => {
    const source = resolveTargetsSaveSource(
      makeSaveInputs({intent: 'edit_saved', targets: makeTargets({source: 'manual'})})
    )

    expect(source).toBe('manual')
  })

  it('reports manual on the manual route even when the entered numbers equal the estimate', () => {
    expect(resolveTargetsSaveSource(makeSaveInputs({intent: 'manual_entry', targets: null}))).toBe('manual')
  })

  it('reports manual when no estimate is available to confirm', () => {
    expect(resolveTargetsSaveSource(makeSaveInputs({estimate: null}))).toBe('manual')
  })

  it('reports manual when a field is empty or unparseable', () => {
    expect(resolveTargetsSaveSource(makeSaveInputs({fields: makeFields({protein: ''})}))).toBe('manual')
    expect(resolveTargetsSaveSource(makeSaveInputs({fields: makeFields({protein: 'abc'})}))).toBe('manual')
  })

  it('compares against the estimate as the whole number this screen renders', () => {
    expect(
      resolveTargetsSaveSource(
        makeSaveInputs({fields: makeFields({calories: '1940'}), estimate: makeEstimate({calories: 1940.4})})
      )
    ).toBe('estimated')
    expect(
      resolveTargetsSaveSource(
        makeSaveInputs({fields: makeFields({calories: '1941'}), estimate: makeEstimate({calories: 1940.4})})
      )
    ).toBe('manual')
  })
})

describe('resolveTargetsSave', () => {
  it('sends nothing for a form that does not parse', () => {
    expect(resolveTargetsSave(makeSaveInputs({fields: makeFields({carbs: ''})}))).toEqual({kind: 'invalid'})
    expect(resolveTargetsSave(makeSaveInputs({fields: makeFields({carbs: 'abc'})}))).toEqual({kind: 'invalid'})
  })

  it('sends nothing when the fields still hold the confirmed values the server has', () => {
    const decision = resolveTargetsSave(
      makeSaveInputs({
        intent: 'edit_saved',
        fields: makeFields({calories: '2100', protein: '150', carbs: '220', fat: '70'}),
        targets: makeTargets()
      })
    )

    expect(decision).toEqual({kind: 'unchanged'})
  })

  it('keeps a stale confirmed estimate as it stands rather than re-declaring it manual', () => {
    const decision = resolveTargetsSave(
      makeSaveInputs({
        intent: 'edit_saved',
        fields: makeFields({calories: '2100', protein: '150', carbs: '220', fat: '70'}),
        targets: makeTargets({stale: true})
      })
    )

    expect(decision).toEqual({kind: 'unchanged'})
  })

  it('adopts an untouched legacy set as the user\u2019s own, since the planner refuses it as it stands', () => {
    const decision = resolveTargetsSave(
      makeSaveInputs({
        intent: 'edit_saved',
        fields: makeFields({calories: '2100', protein: '150', carbs: '220', fat: '70'}),
        targets: makeTargets({source: 'legacy'})
      })
    )

    expect(decision).toEqual({
      kind: 'save',
      source: 'manual',
      payload: {source: 'manual', calories: 2100, protein: 150, carbs: 220, fat: 70, expectedTargetsRevision: 3}
    })
  })

  it('saves the completed figures of an incomplete set rather than reporting it unchanged', () => {
    const decision = resolveTargetsSave(
      makeSaveInputs({
        intent: 'edit_saved',
        fields: makeFields({calories: '2100', protein: '150', carbs: '220', fat: '70'}),
        targets: makeTargets({targets: {calories: 2100, protein: 150, carbs: null, fat: 70}, complete: false})
      })
    )

    expect(decision.kind).toBe('save')
    expect(decision).toMatchObject({source: 'manual'})
  })

  it('records an explicit confirmation even when the recalculated figures equal the stale ones', () => {
    const decision = resolveTargetsSave(
      makeSaveInputs({
        intent: 'confirm_estimate',
        fields: makeFields(),
        estimate: makeEstimate({estimateRevision: 11}),
        targets: makeTargets({targets: {calories: 1940, protein: 146, carbs: 194, fat: 65}, stale: true})
      })
    )

    expect(decision).toEqual({
      kind: 'save',
      source: 'estimated',
      payload: {source: 'estimated', estimateRevision: 11, expectedTargetsRevision: 3}
    })
  })

  it('saves exactly the numbers entered when a field was edited', () => {
    const decision = resolveTargetsSave(
      makeSaveInputs({intent: 'edit_saved', fields: makeFields({calories: '2000', fat: '70'})})
    )

    expect(decision).toEqual({
      kind: 'save',
      source: 'manual',
      payload: {source: 'manual', calories: 2000, protein: 146, carbs: 194, fat: 70, expectedTargetsRevision: 3}
    })
  })

  describe('the revision a save pins', () => {
    it('omits the pin on a first save, for both the estimated and the manual body', () => {
      const confirmation = resolveTargetsSave(makeSaveInputs({targets: null}))
      const manual = resolveTargetsSave(
        makeSaveInputs({intent: 'manual_entry', fields: makeFields({calories: '2000'}), targets: null})
      )

      expect(confirmation).toEqual({
        kind: 'save',
        source: 'estimated',
        payload: {source: 'estimated', estimateRevision: 4}
      })
      expect(manual).toEqual({
        kind: 'save',
        source: 'manual',
        payload: {source: 'manual', calories: 2000, protein: 146, carbs: 194, fat: 65}
      })

      const bodies = [confirmation, manual].map(decision => (decision.kind === 'save' ? decision.payload : null))

      bodies.forEach(payload => {
        expect(payload).not.toBeNull()
        expect(payload !== null && 'expectedTargetsRevision' in payload).toBe(false)
        expect(JSON.stringify(payload)).not.toContain('expectedTargetsRevision')
      })
    })

    it('omits the pin for a preferences row that has never confirmed a target', () => {
      const decision = resolveTargetsSave(
        makeSaveInputs({targets: makeTargets({targets: null, complete: false, source: null, revision: 0})})
      )

      expect(decision).toEqual({
        kind: 'save',
        source: 'estimated',
        payload: {source: 'estimated', estimateRevision: 4}
      })
    })

    it('carries the read revision on every later save', () => {
      const confirmation = resolveTargetsSave(makeSaveInputs({targets: makeTargets({revision: 8})}))
      const manual = resolveTargetsSave(
        makeSaveInputs({
          intent: 'edit_saved',
          fields: makeFields({calories: '2000'}),
          targets: makeTargets({revision: 8})
        })
      )

      expect(confirmation).toMatchObject({payload: {expectedTargetsRevision: 8}})
      expect(manual).toMatchObject({payload: {expectedTargetsRevision: 8}})
    })
  })
})

describe('feasibilityBannerBody', () => {
  it('returns null when there is nothing to warn about', () => {
    expect(feasibilityBannerBody([])).toBeNull()
  })

  it('returns the sentence for a single warning', () => {
    expect(feasibilityBannerBody(['macro_energy_mismatch'])).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.macro_energy_mismatch)
    expect(feasibilityBannerBody(['below_catalog_min'])).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.below_catalog_min)
    expect(feasibilityBannerBody(['above_catalog_max'])).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.above_catalog_max)
  })

  it('joins several warnings in a fixed order whatever order they arrive in', () => {
    const expected = [
      MEAL_PLAN_TARGET_WARNING_LABELS.macro_energy_mismatch,
      MEAL_PLAN_TARGET_WARNING_LABELS.above_catalog_max
    ].join(' ')

    expect(feasibilityBannerBody(['above_catalog_max', 'macro_energy_mismatch'])).toBe(expected)
    expect(feasibilityBannerBody(['macro_energy_mismatch', 'above_catalog_max'])).toBe(expected)
  })

  it('collapses a repeated warning and stays identical across calls', () => {
    const body = feasibilityBannerBody(['below_catalog_min', 'below_catalog_min'])

    expect(body).toBe(MEAL_PLAN_TARGET_WARNING_LABELS.below_catalog_min)
    expect(feasibilityBannerBody(['below_catalog_min'])).toBe(body)
  })

  it('returns the same body for the same input on every call', () => {
    const warnings: NutritionTargetFeasibilityWarning[] = ['below_catalog_min', 'macro_energy_mismatch']
    const expected = [
      MEAL_PLAN_TARGET_WARNING_LABELS.macro_energy_mismatch,
      MEAL_PLAN_TARGET_WARNING_LABELS.below_catalog_min
    ].join(' ')

    expect(feasibilityBannerBody(warnings)).toBe(expected)
    expect(feasibilityBannerBody(warnings)).toBe(expected)
  })
})
