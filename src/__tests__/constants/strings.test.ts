// Not colocated beside its subject because `src/__tests__/constants/` is where this repository keeps a
// constants-module test. What is covered here is everything in @constants/strings that turns a value into copy:
// the substitution helper the whole meal-planning feature renders through, and the three tables read by a key
// this build may never have heard of — a catalog category, a server flag code, a validator's field and error
// code. Each has to answer every input with a string, because the alternative in each case is something the
// user sees: a raw `{placeholder}`, a crashed card, an empty error row, or the word "undefined".
//
// Copy is pinned verbatim throughout. These are authored sentences, not values a future change could recompute,
// so a re-wording should fail here and be re-approved rather than pass quietly.
import {
  CATALOG_CATEGORY_FALLBACK_LABEL,
  CATALOG_CATEGORY_LABELS,
  catalogCategoryLabel,
  hasMealFlagTemplate,
  MEAL_PLAN_ACTIVITY_INFO_BODY,
  MEAL_PLAN_ACTIVITY_SUBTITLE,
  MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT,
  MEAL_PLAN_CARBS_TARGET_ERROR_TEXT,
  MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE,
  MEAL_PLAN_FAT_TARGET_ERROR_TEXT,
  MEAL_PLAN_MEAL_COUNT_SINGULAR_TEMPLATE,
  MEAL_PLAN_MEAL_COUNT_TEMPLATE,
  MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT,
  MEAL_PLAN_MEAL_FLAG_TEMPLATES,
  MEAL_PLAN_MEAL_META_TEMPLATE,
  MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT,
  MEAL_PLAN_TARGET_FIELD_ERROR_TEXTS,
  MEAL_PLAN_TARGET_GENERIC_ERROR_TEXT,
  mealFlagTemplate,
  stringWithNamedParameters,
  targetFieldErrorText
} from '@constants/strings'

// The complete authored table. Listing it out pins both the set of codes the catalog can send and the copy each
// one shows, so deleting or re-wording a row fails here rather than silently degrading a row to "Food".
const EXPECTED_LABELS: Record<string, string> = {
  produce_vegetable: 'Vegetable',
  produce_fruit: 'Fruit',
  protein_meat: 'Meat',
  protein_poultry: 'Poultry',
  protein_seafood: 'Seafood',
  protein_egg: 'Egg',
  protein_plant: 'Plant protein',
  dairy: 'Dairy',
  dairy_alternative: 'Dairy alternative',
  grain: 'Grain',
  bread_bakery: 'Bread & bakery',
  legume: 'Legume',
  nut_seed: 'Nut & seed',
  oil_fat: 'Oil & fat',
  condiment_sauce: 'Condiment & sauce',
  spice_herb: 'Spice & herb',
  beverage: 'Beverage',
  snack: 'Snack',
  sweet: 'Sweet',
  prepared_meal: 'Prepared dish',
  other: 'Other'
}

// The names an ordinary object literal answers to without ever being given them. A category equal to any of
// these is what makes a raw `table[code]` return a function or an object instead of nothing.
const PROTOTYPE_KEYS = [
  'constructor',
  'toString',
  'toLocaleString',
  'valueOf',
  '__proto__',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable'
]

const UNKNOWN_CATEGORY = 'frozen_novelty'

describe('catalogCategoryLabel', () => {
  describe('authored categories', () => {
    it.each(Object.entries(EXPECTED_LABELS))('labels %s as %s', (code, label) => {
      expect(catalogCategoryLabel(code)).toBe(label)
      expect(label.length).toBeGreaterThan(0)
    })

    it('carries exactly the authored codes and nothing else', () => {
      expect(Object.keys(CATALOG_CATEGORY_LABELS).sort()).toEqual(Object.keys(EXPECTED_LABELS).sort())
    })
  })

  describe('codes the table does not carry', () => {
    it('falls back for a code this build has never heard of', () => {
      expect(catalogCategoryLabel(UNKNOWN_CATEGORY)).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    })

    it('falls back for an empty category', () => {
      expect(catalogCategoryLabel('')).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    })

    it('keeps the fallback distinct from the "other" category, which is a known category', () => {
      expect(CATALOG_CATEGORY_FALLBACK_LABEL).not.toBe(EXPECTED_LABELS.other)
    })
  })

  describe('inherited Object.prototype names', () => {
    it.each(PROTOTYPE_KEYS)('falls back to copy for the inherited name %s', key => {
      const label = catalogCategoryLabel(key)

      expect(label).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
      expect(typeof label).toBe('string')
    })

    // The hazard itself: a bare index answers 'constructor' with a function, which is not nullish, so a `??`
    // fallback behind one never fires and a function reaches React text. Reading through an own-property lookup
    // is what keeps the fallback reachable.
    it('returns copy where a bare index returns a non-string', () => {
      const inherited = 'constructor'
      const rawIndex: unknown = (CATALOG_CATEGORY_LABELS as unknown as Record<string, unknown>)[inherited]

      expect(typeof rawIndex).toBe('function')
      expect(catalogCategoryLabel(inherited)).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    })
  })
})

// The values reaching this helper are app figures, slot labels, dates, formatted durations and server text
// (food and recipe names), and several of them are themselves the output of an earlier substitution. So the
// contract is: scan the template once, resolve each placeholder where it stands, and never show the user a
// placeholder — neither one the caller left unsupplied nor one that a value happens to contain.
describe('stringWithNamedParameters', () => {
  describe('one pass over the template', () => {
    // The four cases that showed the previous per-key implementation substituting its own output. Reading the
    // template once leaves a brace token inside a value as the literal text the caller supplied, which is the
    // honest rendering of the caller's own data.
    it('leaves a placeholder that a substituted value contains as literal text', () => {
      expect(stringWithNamedParameters('{a} and {b}', {a: 'I contain {b}', b: 'PWNED'})).toBe('I contain {b} and PWNED')
    })

    it('does not let a portion value inject the protein figure of a real meta template', () => {
      expect(
        stringWithNamedParameters(MEAL_PLAN_MEAL_META_TEMPLATE, {
          portion: '1 serving {protein}',
          minutes: 25,
          protein: '32g'
        })
      ).toBe('1 serving {protein} · 25 min · 32g protein')
    })

    it('does not let a food name inject the quantity beside it', () => {
      expect(stringWithNamedParameters('{name}, {quantity}', {name: 'Weird food {quantity}', quantity: '3.1 lb'})).toBe(
        'Weird food {quantity}, 3.1 lb'
      )
    })

    it('resolves the same result whichever order the values were written in', () => {
      const template = '{a} and {b}'

      expect(stringWithNamedParameters(template, {a: 'I contain {b}', b: 'PWNED'})).toBe(
        stringWithNamedParameters(template, {b: 'PWNED', a: 'I contain {b}'})
      )
    })

    it('replaces every occurrence of a repeated placeholder', () => {
      expect(stringWithNamedParameters('{n} of {n}', {n: 3})).toBe('3 of 3')
    })

    it('renders a numeric value', () => {
      expect(stringWithNamedParameters('{n} meals', {n: 0})).toBe('0 meals')
    })

    // A function replacer, not a replacement string: '$&' and "$'" are substitution patterns to
    // String.replace and would otherwise re-inject the match or the text around it.
    it('renders a value containing regex replacement patterns literally', () => {
      expect(stringWithNamedParameters('{name} here', {name: "$& and $1 and $'"})).toBe("$& and $1 and $' here")
    })

    it('leaves a template with no placeholders untouched', () => {
      expect(stringWithNamedParameters(MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT, {detail: 'milk'})).toBe(
        MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT
      )
    })
  })

  describe('values the template asks for and does not get', () => {
    it('drops a placeholder with no value rather than rendering it', () => {
      const rendered = stringWithNamedParameters('{a} and {missing}', {a: 'AAA'})

      expect(rendered).toBe('AAA and ')
      expect(rendered).not.toContain('{missing}')
    })

    it('drops a placeholder whose value is not a string or a number', () => {
      const values = {a: undefined} as unknown as Record<string, string | number>

      expect(stringWithNamedParameters('[{a}]', values)).toBe('[]')
    })

    it('renders an absent template as empty text rather than throwing', () => {
      const absent = undefined as unknown as string

      expect(stringWithNamedParameters(absent, {detail: 'milk'})).toBe('')
    })
  })

  // A key equal to an inherited name is reachable: several of these templates are filled with server values.
  describe('inherited Object.prototype names', () => {
    it.each(PROTOTYPE_KEYS)('drops the placeholder {%s} rather than rendering an inherited member', key => {
      expect(stringWithNamedParameters(`[{${key}}]`, {detail: 'milk'})).toBe('[]')
    })
  })
})

// The flagged-card meta line. Two things are pinned: that the table answers any code the server can send, which
// is what stopped the card crashing, and the copy itself, because each code's detail is a different kind of
// value and three of the five sentences would be false about the other four's data.
const EXPECTED_FLAG_TEMPLATES: Record<string, string> = {
  diet: "Doesn't fit your {detail} diet",
  allergen: 'Contains {detail}',
  dislike: 'Contains {detail} · an ingredient you skip',
  cooking_time: 'Takes {detail} · longer than your cooking time',
  mixed: "Doesn't match your preferences"
}

// A code from a server newer than this build — the input that used to reach the card as an absent template.
const UNKNOWN_FLAG_CODE = 'something_new'

describe('mealFlagTemplate', () => {
  describe('authored flag codes', () => {
    it.each(Object.entries(EXPECTED_FLAG_TEMPLATES))('states %s as %s', (code, template) => {
      expect(mealFlagTemplate(code)).toBe(template)
      expect(hasMealFlagTemplate(code)).toBe(true)
    })

    it('carries exactly the authored codes and nothing else', () => {
      expect(Object.keys(MEAL_PLAN_MEAL_FLAG_TEMPLATES).sort()).toEqual(Object.keys(EXPECTED_FLAG_TEMPLATES).sort())
    })
  })

  describe('codes the table does not carry', () => {
    it.each([UNKNOWN_FLAG_CODE, '', ...PROTOTYPE_KEYS])('states %s generically', code => {
      expect(hasMealFlagTemplate(code)).toBe(false)
      expect(mealFlagTemplate(code)).toBe(MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT)
    })

    // The defect this read exists for: a bare index answers an unrecognised code with undefined, and the card
    // rendered the line by substituting into it.
    it('renders a line for a code whose bare index is undefined', () => {
      const rawIndex: unknown = (MEAL_PLAN_MEAL_FLAG_TEMPLATES as Record<string, unknown>)[UNKNOWN_FLAG_CODE]

      expect(rawIndex).toBeUndefined()
      expect(stringWithNamedParameters(mealFlagTemplate(UNKNOWN_FLAG_CODE), {detail: 'anything'})).toBe(
        MEAL_PLAN_MEAL_FLAG_GENERIC_TEXT
      )
    })

    it('states an unrecognised code exactly as it states a mixed set', () => {
      expect(mealFlagTemplate(UNKNOWN_FLAG_CODE)).toBe(mealFlagTemplate('mixed'))
    })
  })

  // The detail is an ingredient for two codes, the user's own diet for one and the recipe's own duration for
  // one, so only the ingredient sentences may say "contains" and none may call the recipe's minutes "yours".
  describe('what each sentence claims about its detail', () => {
    it('does not say a meal contains the diet it does not fit', () => {
      expect(mealFlagTemplate('diet')).not.toContain('Contains')
      expect(stringWithNamedParameters(mealFlagTemplate('diet'), {detail: 'vegan'})).toBe("Doesn't fit your vegan diet")
    })

    it('says a meal contains an allergen and a disliked ingredient', () => {
      expect(stringWithNamedParameters(mealFlagTemplate('allergen'), {detail: 'tree nuts'})).toBe('Contains tree nuts')
      expect(stringWithNamedParameters(mealFlagTemplate('dislike'), {detail: 'Mushrooms, white'})).toBe(
        'Contains Mushrooms, white · an ingredient you skip'
      )
    })

    it("states the duration with its unit and does not call it the user's own", () => {
      const detail = stringWithNamedParameters(MEAL_PLAN_COOKING_TIME_VALUE_TEMPLATE, {minutes: 30})

      expect(stringWithNamedParameters(mealFlagTemplate('cooking_time'), {detail})).toBe(
        'Takes 30 minutes · longer than your cooking time'
      )
      expect(mealFlagTemplate('cooking_time')).not.toContain('your {detail}')
    })

    it('leaves the generic sentence free of any detail', () => {
      expect(mealFlagTemplate('mixed')).not.toContain('{detail}')
    })
  })
})

// The planned-totals unit line, whose count can be one.
describe('meal count templates', () => {
  it('states the plural form verbatim', () => {
    expect(MEAL_PLAN_MEAL_COUNT_TEMPLATE).toBe('kcal across {n} meals')
  })

  it('states the singular form verbatim', () => {
    expect(MEAL_PLAN_MEAL_COUNT_SINGULAR_TEMPLATE).toBe('kcal across {n} meal')
  })

  it('differs from the plural only in the noun', () => {
    expect(`${MEAL_PLAN_MEAL_COUNT_SINGULAR_TEMPLATE}s`).toBe(MEAL_PLAN_MEAL_COUNT_TEMPLATE)
  })

  it.each([
    [MEAL_PLAN_MEAL_COUNT_SINGULAR_TEMPLATE, 1, 'kcal across 1 meal'],
    [MEAL_PLAN_MEAL_COUNT_TEMPLATE, 3, 'kcal across 3 meals'],
    [MEAL_PLAN_MEAL_COUNT_TEMPLATE, 0, 'kcal across 0 meals']
  ])('renders %s with n=%s as %s', (template, count, expected) => {
    expect(stringWithNamedParameters(template, {n: count})).toBe(expected)
  })
})

// The 09b field errors. The bounds are the screen's own constants, so the numbers are passed in; what is pinned
// here is that each code gets a sentence about the bound it actually broke, that the drawn sentence survives
// where it applies, and that no message can reach the user with a placeholder still in it.
const CALORIES_MIN_TEXT = '800'
const CALORIES_MAX_TEXT = '6,000'
const MACRO_MAX_TEXT = '1,000'

const EXPECTED_TARGET_ERRORS: [string, string, string, string, string][] = [
  ['calories', 'required', CALORIES_MIN_TEXT, CALORIES_MAX_TEXT, 'Enter a calorie target above 0 kcal'],
  ['calories', 'not_a_number', CALORIES_MIN_TEXT, CALORIES_MAX_TEXT, 'Enter your calorie target as a whole number'],
  ['calories', 'below_min', CALORIES_MIN_TEXT, CALORIES_MAX_TEXT, 'Enter a calorie target of at least 800 kcal'],
  ['calories', 'above_max', CALORIES_MIN_TEXT, CALORIES_MAX_TEXT, 'Enter a calorie target of 6,000 kcal or less'],
  ['protein', 'required', '1', MACRO_MAX_TEXT, 'Enter a protein target above 0 g'],
  ['protein', 'not_a_number', '1', MACRO_MAX_TEXT, 'Enter your protein target as a whole number'],
  ['protein', 'below_min', '1', MACRO_MAX_TEXT, 'Enter a protein target above 0 g'],
  ['protein', 'above_max', '1', MACRO_MAX_TEXT, 'Enter a protein target of 1,000 g or less'],
  ['carbs', 'required', '1', MACRO_MAX_TEXT, 'Enter a carb target above 0 g'],
  ['carbs', 'not_a_number', '1', MACRO_MAX_TEXT, 'Enter your carb target as a whole number'],
  ['carbs', 'below_min', '1', MACRO_MAX_TEXT, 'Enter a carb target above 0 g'],
  ['carbs', 'above_max', '1', MACRO_MAX_TEXT, 'Enter a carb target of 1,000 g or less'],
  ['fat', 'required', '1', MACRO_MAX_TEXT, 'Enter a fat target above 0 g'],
  ['fat', 'not_a_number', '1', MACRO_MAX_TEXT, 'Enter your fat target as a whole number'],
  ['fat', 'below_min', '1', MACRO_MAX_TEXT, 'Enter a fat target above 0 g'],
  ['fat', 'above_max', '1', MACRO_MAX_TEXT, 'Enter a fat target of 1,000 g or less']
]

describe('targetFieldErrorText', () => {
  it.each(EXPECTED_TARGET_ERRORS)('states %s %s as %s', (field, code, minText, maxText, expected) => {
    expect(targetFieldErrorText({field, code, minText, maxText})).toBe(expected)
  })

  it('carries one sentence per field and code and nothing else', () => {
    expect(Object.keys(MEAL_PLAN_TARGET_FIELD_ERROR_TEXTS).sort()).toEqual(
      EXPECTED_TARGET_ERRORS.map(([field, code]) => `${field}.${code}`).sort()
    )
  })

  it.each(EXPECTED_TARGET_ERRORS)('renders %s %s with no placeholder left in it', (field, code, minText, maxText) => {
    expect(targetFieldErrorText({field, code, minText, maxText})).not.toContain('{')
  })

  // The value 34:251 draws, and the only entry a macro's below_min can hold: macros are whole numbers with a
  // minimum of 1, so the drawn sentence is the one that applies and it is reused rather than reworded.
  it('keeps the drawn sentence on the macro fields', () => {
    const bounds = {minText: '1', maxText: MACRO_MAX_TEXT}

    expect(targetFieldErrorText({field: 'carbs', code: 'below_min', ...bounds})).toBe(MEAL_PLAN_CARBS_TARGET_ERROR_TEXT)
    expect(targetFieldErrorText({field: 'protein', code: 'required', ...bounds})).toBe(
      MEAL_PLAN_PROTEIN_TARGET_ERROR_TEXT
    )
    expect(targetFieldErrorText({field: 'fat', code: 'required', ...bounds})).toBe(MEAL_PLAN_FAT_TARGET_ERROR_TEXT)
  })

  // The defect: every code used to answer with the field's single "above 0" sentence, which tells a 500 kcal
  // entry a bound it already satisfies.
  it('names the bound a calorie entry actually broke instead of repeating "above 0"', () => {
    const bounds = {field: 'calories', minText: CALORIES_MIN_TEXT, maxText: CALORIES_MAX_TEXT}
    const belowMin = targetFieldErrorText({...bounds, code: 'below_min'})
    const aboveMax = targetFieldErrorText({...bounds, code: 'above_max'})

    expect(belowMin).toContain(CALORIES_MIN_TEXT)
    expect(belowMin).not.toBe(MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT)
    expect(aboveMax).toContain(CALORIES_MAX_TEXT)
    expect(aboveMax).not.toBe(MEAL_PLAN_CALORIES_TARGET_ERROR_TEXT)
  })

  it('names the gram ceiling on a macro field', () => {
    const aboveMax = targetFieldErrorText({field: 'fat', code: 'above_max', minText: '1', maxText: MACRO_MAX_TEXT})

    expect(aboveMax).toContain(MACRO_MAX_TEXT)
    expect(aboveMax).not.toBe(MEAL_PLAN_FAT_TARGET_ERROR_TEXT)
  })

  describe('a field or code the table does not carry', () => {
    it.each(['protein.unknown_code', 'unknown_field.required', '.', ...PROTOTYPE_KEYS.map(key => `${key}.required`)])(
      'states %s with the generic sentence',
      pair => {
        const [field, code] = pair.split('.')

        expect(targetFieldErrorText({field, code, minText: '1', maxText: MACRO_MAX_TEXT})).toBe(
          MEAL_PLAN_TARGET_GENERIC_ERROR_TEXT
        )
      }
    )
  })
})

// Screen 04 says two things about the training the user logs, and they have to agree: AAP 0.1.4 replaces the
// "don't include the workouts you log" instruction because the activity factor already accounts for habitual
// training, and the frame states that instruction twice. Keeping one of them is how the screen came to tell the
// user to include and to exclude the same training at once.
describe('activity copy on screen 04', () => {
  const EXCLUSION_PHRASES = ['outside of workouts', "don't include", 'do not include', 'counted separately']

  it('states the replacement info body verbatim', () => {
    expect(MEAL_PLAN_ACTIVITY_INFO_BODY).toBe(
      'Include your usual training. Workouts and runs you log are tracked separately and never added to your targets.'
    )
  })

  it('states the sub-copy verbatim', () => {
    expect(MEAL_PLAN_ACTIVITY_SUBTITLE).toBe('Your usual activity, including how often you train.')
  })

  it.each(EXCLUSION_PHRASES)('does not tell the user to exclude their training (%s)', phrase => {
    expect(MEAL_PLAN_ACTIVITY_SUBTITLE.toLowerCase()).not.toContain(phrase)
    expect(MEAL_PLAN_ACTIVITY_INFO_BODY.toLowerCase()).not.toContain(phrase)
  })

  it('asks for the training to be included', () => {
    expect(MEAL_PLAN_ACTIVITY_SUBTITLE.toLowerCase()).toContain('includ')
    expect(MEAL_PLAN_ACTIVITY_INFO_BODY.toLowerCase()).toContain('includ')
  })
})
