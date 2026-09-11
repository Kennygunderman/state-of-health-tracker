import {
  CATALOG_CATEGORY_FALLBACK_LABEL,
  CATALOG_CATEGORY_LABELS,
  catalogCategoryLabel,
  GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE,
  GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE,
  GROCERY_CHECKED_HEADER_TEMPLATE,
  MEAL_PLAN_MEAL_COUNT_TEMPLATE,
  MEAL_PLAN_MEAL_FLAG_TEMPLATES,
  MEAL_PLAN_WIZARD_STEP_TEMPLATE,
  PLAN_REGENERATE_ENTRIES_KEPT_TEMPLATE,
  PLAN_REGENERATE_MEALS_REPLACED_TEMPLATE,
  PLAN_SETTINGS_FLAGGED_BANNER_BODY_SINGULAR_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_BANNER_BODY_TEMPLATES,
  PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON,
  PLAN_SETTINGS_FLAGGED_BANNER_TITLE_SINGULAR_LABELS,
  PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES,
  stringWithNamedParameters
} from '@constants/strings'

// The 21 catalog category codes the coverage plan defines, in its order.
const CATALOG_CATEGORY_CODES = [
  'produce_vegetable',
  'produce_fruit',
  'protein_meat',
  'protein_poultry',
  'protein_seafood',
  'protein_egg',
  'protein_plant',
  'dairy',
  'dairy_alternative',
  'grain',
  'bread_bakery',
  'legume',
  'nut_seed',
  'oil_fat',
  'condiment_sauce',
  'spice_herb',
  'beverage',
  'snack',
  'sweet',
  'prepared_meal',
  'other'
]

// The flag reasons the server can send, plus the mixed-reason fallback.
const FLAG_REASONS = ['diet', 'allergen', 'dislike', 'cooking_time', 'mixed']

describe('catalogCategoryLabel', () => {
  it('resolves every catalog category code to a human label', () => {
    CATALOG_CATEGORY_CODES.forEach(code => {
      const label = catalogCategoryLabel(code)

      expect(label).toBe(CATALOG_CATEGORY_LABELS[code])
      expect(label).toBeTruthy()
      expect(label).not.toContain('_')
    })
  })

  it('matches the labels the food search rows render', () => {
    expect(catalogCategoryLabel('produce_vegetable')).toBe('Vegetable')
    expect(catalogCategoryLabel('prepared_meal')).toBe('Prepared dish')
  })

  it('falls back for an unrecognised category instead of leaking a code', () => {
    expect(catalogCategoryLabel('quantum_snacks')).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    expect(catalogCategoryLabel('')).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
    expect(catalogCategoryLabel('PRODUCE_VEGETABLE')).toBe(CATALOG_CATEGORY_FALLBACK_LABEL)
  })

  it('never reports an unrecognised category as the valid other category', () => {
    expect(CATALOG_CATEGORY_FALLBACK_LABEL).not.toBe(CATALOG_CATEGORY_LABELS.other)
  })
})

describe('counted copy templates', () => {
  it('substitutes the wizard counter on both setup routes', () => {
    expect(stringWithNamedParameters(MEAL_PLAN_WIZARD_STEP_TEMPLATE, {n: 1, m: 7})).toBe('1 of 7')
    expect(stringWithNamedParameters(MEAL_PLAN_WIZARD_STEP_TEMPLATE, {n: 6, m: 6})).toBe('6 of 6')
  })

  it('substitutes every counted template without leaving a placeholder behind', () => {
    const templates = [
      MEAL_PLAN_MEAL_COUNT_TEMPLATE,
      GROCERY_CHECKED_HEADER_TEMPLATE,
      GROCERY_AMOUNTS_INCREASED_TITLE_TEMPLATE,
      GROCERY_AMOUNTS_INCREASED_BODY_TEMPLATE,
      PLAN_REGENERATE_MEALS_REPLACED_TEMPLATE,
      PLAN_REGENERATE_ENTRIES_KEPT_TEMPLATE
    ]

    templates.forEach(template => {
      const rendered = stringWithNamedParameters(template, {n: 3})

      expect(rendered).toContain('3')
      expect(rendered).not.toMatch(/[{}]/)
    })
  })
})

describe('flagged meal copy', () => {
  const maps = {
    'card meta': MEAL_PLAN_MEAL_FLAG_TEMPLATES,
    'banner title (singular)': PLAN_SETTINGS_FLAGGED_BANNER_TITLE_SINGULAR_LABELS,
    'banner title (plural)': PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES,
    'banner body (singular)': PLAN_SETTINGS_FLAGGED_BANNER_BODY_SINGULAR_TEMPLATES,
    'banner body (plural)': PLAN_SETTINGS_FLAGGED_BANNER_BODY_TEMPLATES
  }

  it.each(Object.keys(maps))('covers every flag reason in the %s copy', key => {
    expect(Object.keys(maps[key as keyof typeof maps]).sort()).toEqual([...FLAG_REASONS].sort())
  })

  it.each(Object.keys(maps))('never claims an allergen outside the allergen reason in the %s copy', key => {
    const map = maps[key as keyof typeof maps]

    FLAG_REASONS.filter(reason => reason !== 'allergen').forEach(reason => {
      expect(map[reason].toLowerCase()).not.toContain('allergen')
      expect(map[reason].toLowerCase()).not.toContain('allergy')
    })
  })

  it('describes a disliked ingredient and a cooking time in their own terms', () => {
    expect(
      stringWithNamedParameters(PLAN_SETTINGS_FLAGGED_BANNER_BODY_SINGULAR_TEMPLATES.dislike, {
        meal: 'Tuesday dinner',
        detail: 'mushrooms'
      })
    ).toBe('Tuesday dinner contains mushrooms, which you asked us to skip. It stays flagged until you swap it.')

    expect(stringWithNamedParameters(MEAL_PLAN_MEAL_FLAG_TEMPLATES.cooking_time, {detail: '30 minutes'})).toBe(
      'Over your 30 minutes cooking time'
    )
  })

  it('renders the allergen reason as the designed copy', () => {
    expect(stringWithNamedParameters(MEAL_PLAN_MEAL_FLAG_TEMPLATES.allergen, {detail: 'milk'})).toBe('Contains milk')

    expect(
      stringWithNamedParameters(PLAN_SETTINGS_FLAGGED_BANNER_BODY_TEMPLATES.allergen, {
        meals: 'Tuesday dinner and Thursday lunch',
        detail: 'milk'
      })
    ).toBe('Tuesday dinner and Thursday lunch contain milk. They stay flagged until you swap them.')

    expect(PLAN_SETTINGS_FLAGGED_BANNER_TITLE_SINGULAR_LABELS.allergen).toBe('1 meal no longer matches your diet')
    expect(stringWithNamedParameters(PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES.allergen, {n: 2})).toBe(
      '2 meals no longer match your diet'
    )
  })

  it('offers a reason for a set of meals flagged for differing reasons', () => {
    expect(PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON).toBe('mixed')
    expect(MEAL_PLAN_MEAL_FLAG_TEMPLATES[PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON]).toBeTruthy()
    expect(PLAN_SETTINGS_FLAGGED_BANNER_TITLE_TEMPLATES[PLAN_SETTINGS_FLAGGED_BANNER_FALLBACK_REASON]).toBeTruthy()
  })
})
