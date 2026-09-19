import type {
  NutritionTargetEstimate,
  NutritionTargetFeasibilityWarning,
  NutritionTargets
} from '@data/models/NutritionTargets'

import {
  MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT,
  MEAL_PLAN_CARBS_TARGET_ERROR_TEXT,
  MEAL_PLAN_FAT_TARGET_ERROR_TEXT,
  MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT,
  MEAL_PLAN_TARGET_GENERIC_ERROR_TEXT,
  MEAL_PLAN_TARGET_WARNING_LABELS,
  targetFieldErrorText
} from '@constants/strings'

import {
  CALORIES_MAX,
  CALORIES_MIN,
  EditTargetsFieldKey,
  EditTargetsFields,
  EditTargetsReadinessInputs,
  feasibilityBannerBody,
  MACRO_MAX,
  MACRO_MIN,
  resolveEditTargetsIntent,
  resolveEditTargetsReadiness,
  resolveTargetsSave,
  resolveTargetsSaveSource,
  sanitizeIntegerInput,
  shouldOfferRecalculate,
  targetFieldAccessibilityLabel,
  targetFieldDisplayText,
  TargetFieldErrorCode,
  targetFieldMaxLength,
  targetFieldText,
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

describe('targetFieldText', () => {
  describe('a member the server left unset', () => {
    it('opens the field blank for null rather than showing a zero the user never chose', () => {
      expect(targetFieldText(null)).toBe('')
    })

    it('opens the field blank for undefined', () => {
      expect(targetFieldText(undefined)).toBe('')
    })

    it('blanks only the unset members of a calories-only account', () => {
      expect(targetFieldText(1900)).toBe('1900')
      expect(targetFieldText(null)).toBe('')
    })
  })

  describe('a stored figure', () => {
    // The two halves of one rule, which is why they are asserted together: the field stores the bare digits
    // every later check is built from, and presents the grouped figure 34:214 draws. Storing the grouped text
    // instead would stop resolveTargetsSaveSource parsing it, demoting a confirmation of the server's own
    // estimate to a manual save; presenting the bare text is the figure reading '1940' where the review card,
    // the diary and Figma all read '1,940'.
    it('stores a whole target as bare digits and presents it grouped', () => {
      expect(targetFieldText(1940)).toBe('1940')
      expect(targetFieldDisplayText(targetFieldText(1940))).toBe('1,940')
    })

    it('renders a zero the server actually holds, which validation then rejects as below the minimum', () => {
      expect(targetFieldText(0)).toBe('0')
    })

    it('rounds a fraction to the whole number the field can hold', () => {
      expect(targetFieldText(1940.4)).toBe('1940')
      expect(targetFieldText(1940.5)).toBe('1941')
    })
  })

  describe('agreeing with the estimate comparison', () => {
    it('renders a fractional estimate as the figure resolveTargetsSaveSource still calls a confirmation', () => {
      const estimate = makeEstimate({calories: 1940.4, protein: 146.2, carbs: 194.4, fat: 65.4})

      const shown: EditTargetsFields = {
        calories: targetFieldText(estimate.calories),
        protein: targetFieldText(estimate.protein),
        carbs: targetFieldText(estimate.carbs),
        fat: targetFieldText(estimate.fat)
      }

      expect(shown).toEqual({calories: '1940', protein: '146', carbs: '194', fat: '65'})
      expect(resolveTargetsSaveSource(makeSaveInputs({estimate, fields: shown}))).toBe('estimated')
    })
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

  // The field displays a grouped figure, so every edit of one arrives here mid-grouping: backspacing '1,940'
  // hands over '1,94', and refusing that would leave the field unable to delete its own last digit. A
  // separator is presentation wherever it falls, so it is stripped rather than read as part of a number — the
  // refusals above still hold, because they turn on characters that change the value rather than its grouping.
  it('accepts a separator wherever an edit leaves it, because the field displays a grouped figure', () => {
    expect(sanitizeIntegerInput('1,94', '1,940')).toBe('194')
    expect(sanitizeIntegerInput(',940', '1,940')).toBe('940')
    expect(sanitizeIntegerInput('1,940', '194')).toBe('1940')
    expect(sanitizeIntegerInput('19,4000', '1,940')).toBe('194000')
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
    const refused = ['19.40', '1940.5', '-500', '+500', 'one thousand', '1e3', 'NaN']

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

// The composition index.tsx performs for each field: its own bounds as text, grouped by the formatter the field
// displays its value with, resolved into a sentence by the code validateEditTargets returned. The bounds are
// read from the exported constants rather than typed as '800' and '6,000' here, so a bound moved without its
// copy fails these assertions instead of shipping a message naming a limit nothing enforces.
const FIELD_BOUND_TEXTS: Record<EditTargetsFieldKey, {minText: string; maxText: string}> = {
  calories: {
    minText: targetFieldDisplayText(String(CALORIES_MIN)),
    maxText: targetFieldDisplayText(String(CALORIES_MAX))
  },
  protein: {minText: targetFieldDisplayText(String(MACRO_MIN)), maxText: targetFieldDisplayText(String(MACRO_MAX))},
  carbs: {minText: targetFieldDisplayText(String(MACRO_MIN)), maxText: targetFieldDisplayText(String(MACRO_MAX))},
  fat: {minText: targetFieldDisplayText(String(MACRO_MIN)), maxText: targetFieldDisplayText(String(MACRO_MAX))}
}

const messageFor = (field: EditTargetsFieldKey, code: TargetFieldErrorCode): string =>
  targetFieldErrorText({field, code, ...FIELD_BOUND_TEXTS[field]})

// The code the validator actually returns for an entry, so the pairs under test are the ones 09b can reach
// rather than a list written by hand beside it.
const codeForEntry = (field: EditTargetsFieldKey, entry: string): TargetFieldErrorCode => {
  const code = validateEditTargets({...makeFields(), [field]: entry}).errors[field]

  if (code === undefined) {
    throw new Error(`${field} accepted ${JSON.stringify(entry)}, so 09b has no message to render for it`)
  }

  return code
}

const messageForEntry = (field: EditTargetsFieldKey, entry: string): string =>
  messageFor(field, codeForEntry(field, entry))

const ERROR_FIELD_KEYS: EditTargetsFieldKey[] = ['calories', 'protein', 'carbs', 'fat']

const ERROR_CODES: TargetFieldErrorCode[] = ['required', 'not_a_number', 'below_min', 'above_max']

// An entry reaching each code, per field. The calorie floor is 800 and a macro's is 1 g, so 500 and 0 are what
// below_min is reached by; both above_max entries are inside the field's own maxLength (five grouped
// characters), so they are typeable rather than theoretical.
const ENTRY_FOR_CODE: Record<EditTargetsFieldKey, Record<TargetFieldErrorCode, string>> = {
  calories: {required: '', not_a_number: 'abc', below_min: '500', above_max: '60001'},
  protein: {required: '', not_a_number: 'abc', below_min: '0', above_max: '9999'},
  carbs: {required: '', not_a_number: '1.5', below_min: '0', above_max: '9999'},
  fat: {required: '   ', not_a_number: '-5', below_min: '0', above_max: '9999'}
}

const EXPECTED_MESSAGES: Record<EditTargetsFieldKey, Record<TargetFieldErrorCode, string>> = {
  calories: {
    required: MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT,
    not_a_number: 'Enter your calorie target as a whole number',
    below_min: `Enter a calorie target of at least ${FIELD_BOUND_TEXTS.calories.minText} kcal`,
    above_max: `Enter a calorie target of ${FIELD_BOUND_TEXTS.calories.maxText} kcal or less`
  },
  protein: {
    required: MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT,
    not_a_number: 'Enter your protein target as a whole number',
    below_min: MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT,
    above_max: `Enter a protein target of ${FIELD_BOUND_TEXTS.protein.maxText} g or less`
  },
  carbs: {
    required: MEAL_PLAN_CARBS_TARGET_ERROR_TEXT,
    not_a_number: 'Enter your carb target as a whole number',
    below_min: MEAL_PLAN_CARBS_TARGET_ERROR_TEXT,
    above_max: `Enter a carb target of ${FIELD_BOUND_TEXTS.carbs.maxText} g or less`
  },
  fat: {
    required: MEAL_PLAN_FAT_TARGET_ERROR_TEXT,
    not_a_number: 'Enter your fat target as a whole number',
    below_min: MEAL_PLAN_FAT_TARGET_ERROR_TEXT,
    above_max: `Enter a fat target of ${FIELD_BOUND_TEXTS.fat.maxText} g or less`
  }
}

describe('the message 09b renders for a refused field', () => {
  it('states one sentence per field and code, over every pair the validator produces', () => {
    ERROR_FIELD_KEYS.forEach(field => {
      ERROR_CODES.forEach(code => {
        expect(messageFor(field, code)).toBe(EXPECTED_MESSAGES[field][code])
      })
    })
  })

  it('reaches each of those sentences from an entry the field accepts keystrokes for', () => {
    ERROR_FIELD_KEYS.forEach(field => {
      ERROR_CODES.forEach(code => {
        const entry = ENTRY_FOR_CODE[field][code]

        expect(codeForEntry(field, entry)).toBe(code)
        expect(messageForEntry(field, entry)).toBe(EXPECTED_MESSAGES[field][code])
      })
    })
  })

  // The regression this exists for: one fixed sentence per field told a 500 kcal entry it needed a figure
  // "above 0 kcal" — a bound it already satisfied — and never named the 800 it had broken.
  it('never answers an out-of-range entry with a bound it already satisfies', () => {
    expect(messageForEntry('calories', '500')).not.toBe(messageFor('calories', 'required'))
    expect(messageForEntry('calories', '500')).toBe('Enter a calorie target of at least 800 kcal')
    expect(messageForEntry('calories', '60001')).toBe('Enter a calorie target of 6,000 kcal or less')
    expect(messageForEntry('protein', '9999')).toBe('Enter a protein target of 1,000 g or less')
    expect(messageForEntry('carbs', '9999')).toBe('Enter a carb target of 1,000 g or less')
    expect(messageForEntry('fat', '9999')).toBe('Enter a fat target of 1,000 g or less')
  })

  // The coupling: the figure in the sentence is the figure the validator enforces, read from the same export.
  // A bound edited in index.util without its copy fails here rather than at a user.
  it('names the bound it enforces, from the constants the validator bounds the field with', () => {
    expect(messageFor('calories', 'below_min')).toContain(targetFieldDisplayText(String(CALORIES_MIN)))
    expect(messageFor('calories', 'above_max')).toContain(targetFieldDisplayText(String(CALORIES_MAX)))

    ERROR_FIELD_KEYS.filter(field => field !== 'calories').forEach(field => {
      expect(messageFor(field, 'above_max')).toContain(targetFieldDisplayText(String(MACRO_MAX)))
    })
  })

  // 34:251 draws "Enter a carb target above 0 g" on a field holding 0, and the same sentence is the right
  // prompt for an empty one — so the drawn copy is what both of those codes still render, byte for byte.
  it('keeps the drawn sentence for the empty field and for the macro zero Figma draws it on', () => {
    expect(messageFor('calories', 'required')).toBe(MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT)
    expect(messageFor('protein', 'required')).toBe(MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT)
    expect(messageFor('carbs', 'required')).toBe(MEAL_PLAN_CARBS_TARGET_ERROR_TEXT)
    expect(messageFor('fat', 'required')).toBe(MEAL_PLAN_FAT_TARGET_ERROR_TEXT)

    expect(messageForEntry('protein', '0')).toBe(MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT)
    expect(messageForEntry('carbs', '0')).toBe('Enter a carb target above 0 g')
    expect(messageForEntry('fat', '0')).toBe(MEAL_PLAN_FAT_TARGET_ERROR_TEXT)
  })

  it('leaves no placeholder standing in any sentence it renders', () => {
    ERROR_FIELD_KEYS.forEach(field => {
      ERROR_CODES.forEach(code => {
        expect(messageFor(field, code)).not.toContain('{')
        expect(messageFor(field, code)).not.toContain('}')
      })
    })
  })

  // Every pair this screen can reach has copy, so the total resolver's fallback sentence is unreachable from
  // here — it covers a field or a code that does not exist, not a state 09b renders.
  it('has copy for every pair, rather than falling back to the generic sentence', () => {
    ERROR_FIELD_KEYS.forEach(field => {
      ERROR_CODES.forEach(code => {
        expect(messageFor(field, code)).not.toBe(MEAL_PLAN_TARGET_GENERIC_ERROR_TEXT)
      })
    })
  })

  // Both consumption sites read one derived message: the row beneath the field and the field's own
  // accessibility name cannot state different reasons for the same refusal.
  it('carries the same sentence into the field name a screen reader announces', () => {
    const message = messageForEntry('calories', '500')

    expect(targetFieldAccessibilityLabel({label: 'Calories', unitText: 'kilocalories', errorMessage: message})).toBe(
      `Calories, kilocalories, ${message}`
    )
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

describe('targetFieldDisplayText', () => {
  it('groups a stored figure the way every other target surface renders it', () => {
    expect(targetFieldDisplayText('1940')).toBe('1,940')
    expect(targetFieldDisplayText('6000')).toBe('6,000')
    expect(targetFieldDisplayText('1000')).toBe('1,000')
  })

  it('leaves a figure with nothing to group alone', () => {
    expect(targetFieldDisplayText('146')).toBe('146')
    expect(targetFieldDisplayText('0')).toBe('0')
  })

  it('presents an empty field as empty rather than inventing a zero', () => {
    expect(targetFieldDisplayText('')).toBe('')
  })

  // Defensive: the sanitiser means only digits reach the field, and a value it cannot read is handed back
  // untouched rather than replaced, so no state the screen can reach rewrites what the user is typing.
  it('passes an unreadable entry through unchanged', () => {
    expect(targetFieldDisplayText('19.4')).toBe('19.4')
  })
})

describe('targetFieldMaxLength', () => {
  it('measures each field in the grouped presentation it displays', () => {
    expect(targetFieldMaxLength('calories')).toBe('6,000'.length)
    expect(targetFieldMaxLength('protein')).toBe('1,000'.length)
    expect(targetFieldMaxLength('carbs')).toBe('1,000'.length)
    expect(targetFieldMaxLength('fat')).toBe('1,000'.length)
  })

  // The regression this exists for: measured on the bare number every limit is a character short of its own
  // grouped bound, so the drawn 1,940 calorie target cannot be typed and 6,000 cannot be reached at all.
  it('admits every figure inside the bounds once it is grouped', () => {
    expect(targetFieldDisplayText('1940').length).toBeLessThanOrEqual(targetFieldMaxLength('calories'))
    expect(targetFieldDisplayText(String(CALORIES_MAX)).length).toBeLessThanOrEqual(targetFieldMaxLength('calories'))
    expect(targetFieldDisplayText(String(CALORIES_MIN)).length).toBeLessThanOrEqual(targetFieldMaxLength('calories'))
    expect(targetFieldDisplayText(String(MACRO_MAX)).length).toBeLessThanOrEqual(targetFieldMaxLength('protein'))
    expect(targetFieldDisplayText(String(MACRO_MIN)).length).toBeLessThanOrEqual(targetFieldMaxLength('fat'))
  })
})

describe('targetFieldAccessibilityLabel', () => {
  it('names the unit the field holds, which the drawn suffix never announces', () => {
    expect(targetFieldAccessibilityLabel({label: 'Calories', unitText: 'kilocalories'})).toBe('Calories, kilocalories')
    expect(targetFieldAccessibilityLabel({label: 'Protein', unitText: 'grams'})).toBe('Protein, grams')
  })

  // The unit survives the error rather than being replaced by it: a field reached after validation still has to
  // say what it holds as well as what is wrong with it.
  it('keeps the unit in the name when the field is reporting an error', () => {
    expect(
      targetFieldAccessibilityLabel({
        label: 'Carbs',
        unitText: 'grams',
        errorMessage: 'Enter a carb target above 0 g'
      })
    ).toBe('Carbs, grams, Enter a carb target above 0 g')
  })
})

const makeReadinessInputs = (overrides: Partial<EditTargetsReadinessInputs> = {}): EditTargetsReadinessInputs => ({
  intent: 'edit_saved',
  isTargetsLoading: false,
  isTargetsRouteMissing: false,
  hasTargetsReadFailure: false,
  isEstimateLoading: false,
  isEstimateUnavailable: false,
  hasEstimateReadFailure: false,
  hasDraft: false,
  ...overrides
})

describe('resolveEditTargetsReadiness', () => {
  it('edits and saves once the reads have answered', () => {
    expect(resolveEditTargetsReadiness(makeReadinessInputs())).toEqual({
      status: 'ready',
      showFields: true,
      canSave: true,
      retryTargets: false,
      retryEstimate: false
    })
  })

  describe('a targets read that has not answered', () => {
    it('waits rather than rendering blank fields over a first load', () => {
      const readiness = resolveEditTargetsReadiness(makeReadinessInputs({isTargetsLoading: true}))

      expect(readiness.status).toBe('loading')
      expect(readiness.showFields).toBe(false)
      expect(readiness.canSave).toBe(false)
    })

    // The defect this exists for: a failed read left the fields editable and Save live with no revision to
    // pin, so the user could enter a target the server was always going to refuse.
    it('withholds the save and offers a retry for a genuine failure', () => {
      expect(resolveEditTargetsReadiness(makeReadinessInputs({hasTargetsReadFailure: true}))).toEqual({
        status: 'read_failed',
        showFields: false,
        canSave: false,
        retryTargets: true,
        retryEstimate: false
      })
    })

    // The editor refetches while recovering from a rejected revision, and a refetch that fails must not take
    // the user's entered figures down with it.
    it('keeps a draft on screen through a failure, still without saving it', () => {
      const readiness = resolveEditTargetsReadiness(makeReadinessInputs({hasTargetsReadFailure: true, hasDraft: true}))

      expect(readiness.status).toBe('read_failed')
      expect(readiness.showFields).toBe(true)
      expect(readiness.canSave).toBe(false)
    })

    it('offers no retry for a route that is not mounted, because the next attempt answers identically', () => {
      expect(resolveEditTargetsReadiness(makeReadinessInputs({isTargetsRouteMissing: true}))).toEqual({
        status: 'unavailable',
        showFields: false,
        canSave: false,
        retryTargets: false,
        retryEstimate: false
      })
    })

    it('reports the missing route ahead of any other state', () => {
      const readiness = resolveEditTargetsReadiness(
        makeReadinessInputs({isTargetsRouteMissing: true, isTargetsLoading: true, hasDraft: true})
      )

      expect(readiness.status).toBe('unavailable')
    })
  })

  describe('an estimate the intent depends on', () => {
    it('waits for it when the visit exists to confirm it', () => {
      const readiness = resolveEditTargetsReadiness(
        makeReadinessInputs({intent: 'confirm_estimate', isEstimateLoading: true})
      )

      expect(readiness.status).toBe('loading')
      expect(readiness.canSave).toBe(false)
    })

    it('hands over to manual entry when the server says none can be calculated', () => {
      const readiness = resolveEditTargetsReadiness(
        makeReadinessInputs({intent: 'confirm_estimate', isEstimateUnavailable: true})
      )

      expect(readiness.status).toBe('estimate_unavailable')
      expect(readiness.showFields).toBe(false)
      expect(readiness.canSave).toBe(false)
    })

    it('retries the estimate when that is the read that failed', () => {
      const readiness = resolveEditTargetsReadiness(
        makeReadinessInputs({intent: 'confirm_estimate', hasEstimateReadFailure: true})
      )

      expect(readiness.status).toBe('read_failed')
      expect(readiness.retryEstimate).toBe(true)
      expect(readiness.retryTargets).toBe(false)
    })
  })

  // Every other visit treats the estimate as the enhancement it is: it gates the recalculate offer and nothing
  // else, so a slow or broken estimate never blocks an edit that does not depend on one.
  describe('an estimate no intent depends on', () => {
    it('edits saved figures without waiting for it', () => {
      expect(resolveEditTargetsReadiness(makeReadinessInputs({isEstimateLoading: true})).status).toBe('ready')
      expect(resolveEditTargetsReadiness(makeReadinessInputs({hasEstimateReadFailure: true})).status).toBe('ready')
      expect(resolveEditTargetsReadiness(makeReadinessInputs({isEstimateUnavailable: true})).status).toBe('ready')
    })

    it('accepts manual entry with no estimate at all', () => {
      const readiness = resolveEditTargetsReadiness(
        makeReadinessInputs({intent: 'manual_entry', isEstimateUnavailable: true, hasEstimateReadFailure: true})
      )

      expect(readiness.status).toBe('ready')
      expect(readiness.canSave).toBe(true)
    })
  })
})

describe('shouldOfferRecalculate', () => {
  // Without the offer, a user arriving from Account, the diary or Plan settings on a set the server calls
  // stale, legacy or incomplete can only retype the estimate by hand — which saves it as a manual set and
  // leaves the staleness it was meant to clear in place.
  it('offers a recalculation for every saved set 0.5.2 calls one to review', () => {
    expect(shouldOfferRecalculate({intent: 'edit_saved', targets: makeTargets({stale: true}), hasEstimate: true})).toBe(
      true
    )
    expect(
      shouldOfferRecalculate({intent: 'edit_saved', targets: makeTargets({source: 'legacy'}), hasEstimate: true})
    ).toBe(true)
    expect(
      shouldOfferRecalculate({intent: 'edit_saved', targets: makeTargets({complete: false}), hasEstimate: true})
    ).toBe(true)
  })

  it('leaves a settled set alone', () => {
    expect(shouldOfferRecalculate({intent: 'edit_saved', targets: makeTargets(), hasEstimate: true})).toBe(false)
  })

  it('offers nothing it cannot deliver, so an unloaded estimate shows no link', () => {
    expect(
      shouldOfferRecalculate({intent: 'edit_saved', targets: makeTargets({stale: true}), hasEstimate: false})
    ).toBe(false)
  })

  it('adds no link to a visit already holding the estimate, or to the manual route', () => {
    expect(
      shouldOfferRecalculate({intent: 'confirm_estimate', targets: makeTargets({stale: true}), hasEstimate: true})
    ).toBe(false)
    expect(
      shouldOfferRecalculate({intent: 'manual_entry', targets: makeTargets({stale: true}), hasEstimate: true})
    ).toBe(false)
  })

  it('has nothing to recalculate when the server holds no targets', () => {
    expect(shouldOfferRecalculate({intent: 'edit_saved', targets: null, hasEstimate: true})).toBe(false)
  })
})
