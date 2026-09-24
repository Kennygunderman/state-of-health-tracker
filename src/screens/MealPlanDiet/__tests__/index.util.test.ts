import {Diet} from '@data/models/MealPlanPreferences'

import {MEAL_PLAN_ALLERGEN_LABELS, MEAL_PLAN_DIET_LABELS} from '@constants/strings'

import {
  AllergenChip,
  ALLERGEN_NONE_CODE,
  buildAllergenChips,
  DIET_OPTIONS,
  DietOption,
  dietWizardProgress,
  validateDietStep
} from '../index.util'

const FIGMA_CHIP_ORDER = ['none', 'milk', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']

const NAMED_ALLERGENS = FIGMA_CHIP_ORDER.slice(1)

const selectedCodesOf = (selected: string[]): string[] =>
  buildAllergenChips(selected)
    .filter(chip => chip.selected)
    .map(chip => chip.code)

describe('buildAllergenChips', () => {
  describe('the chip cloud itself', () => {
    it('renders the ten chips in the order frame 05 draws them, None first', () => {
      expect(buildAllergenChips([]).map(chip => chip.code)).toEqual(FIGMA_CHIP_ORDER)
    })

    it('leads the cloud with the None sentinel the saved step carries on its own', () => {
      expect(buildAllergenChips([])[0].code).toBe(ALLERGEN_NONE_CODE)
    })

    it('labels every chip with the copy its code owns in the strings module', () => {
      expect(buildAllergenChips([]).map(chip => chip.label)).toEqual([
        MEAL_PLAN_ALLERGEN_LABELS.none,
        MEAL_PLAN_ALLERGEN_LABELS.milk,
        MEAL_PLAN_ALLERGEN_LABELS.eggs,
        MEAL_PLAN_ALLERGEN_LABELS.peanuts,
        MEAL_PLAN_ALLERGEN_LABELS.tree_nuts,
        MEAL_PLAN_ALLERGEN_LABELS.soy,
        MEAL_PLAN_ALLERGEN_LABELS.wheat,
        MEAL_PLAN_ALLERGEN_LABELS.fish,
        MEAL_PLAN_ALLERGEN_LABELS.shellfish,
        MEAL_PLAN_ALLERGEN_LABELS.sesame
      ])
    })

    it('selects nothing on first entry', () => {
      const chips = buildAllergenChips([])

      expect(chips.every(chip => !chip.selected)).toBe(true)
      expect(chips.every(chip => !chip.removable)).toBe(true)
    })
  })

  describe('a named selection', () => {
    it('marks only the chosen allergen and leaves None unselected', () => {
      const chips = buildAllergenChips(['milk'])

      expect(chips.filter(chip => chip.selected).map(chip => chip.code)).toEqual(['milk'])
      expect(chips[0].selected).toBe(false)
    })

    it('marks each selected allergen and nothing else', () => {
      expect(selectedCodesOf(['milk', 'tree_nuts'])).toEqual(['milk', 'tree_nuts'])
    })

    it('keeps the selection order of the cloud rather than of the argument', () => {
      expect(selectedCodesOf(['sesame', 'eggs'])).toEqual(['eggs', 'sesame'])
    })

    it('makes a selected chip removable and an unselected chip not', () => {
      const chips = buildAllergenChips(['peanuts'])

      expect(chips.filter(chip => chip.removable).map(chip => chip.code)).toEqual(['peanuts'])
    })

    it('marks all nine named allergens without deriving None from them', () => {
      const chips = buildAllergenChips(NAMED_ALLERGENS)

      expect(chips.filter(chip => chip.selected).map(chip => chip.code)).toEqual(NAMED_ALLERGENS)
      expect(chips[0].selected).toBe(false)
      expect(chips[0].removable).toBe(false)
    })

    it('ignores a duplicated selection', () => {
      expect(selectedCodesOf(['fish', 'fish'])).toEqual(['fish'])
    })
  })

  describe('a None selection', () => {
    it('marks None selected and removable when it is the stored answer', () => {
      const chips = buildAllergenChips([ALLERGEN_NONE_CODE])

      expect(chips[0]).toEqual({
        code: ALLERGEN_NONE_CODE,
        label: MEAL_PLAN_ALLERGEN_LABELS.none,
        selected: true,
        removable: true
      })
    })

    it('leaves every named chip unselected and not removable', () => {
      const namedChips = buildAllergenChips([ALLERGEN_NONE_CODE]).slice(1)

      expect(namedChips.map(chip => chip.code)).toEqual(NAMED_ALLERGENS)
      expect(namedChips.every(chip => !chip.selected && !chip.removable)).toBe(true)
    })

    it('keeps None selected when it is the only recognised answer, however often it is repeated', () => {
      expect(selectedCodesOf([ALLERGEN_NONE_CODE, ALLERGEN_NONE_CODE])).toEqual(['none'])
      expect(selectedCodesOf(['gluten', ALLERGEN_NONE_CODE])).toEqual(['none'])
    })
  })

  // None is exclusive both ways, so the cloud must never show it chosen beside a named allergy. The stored
  // answer resolves towards the allergies: they are what the user asked to exclude, and an allergy is never
  // dropped automatically. validateDietStep (below) refuses the same answer, so it is corrected, not saved.
  describe('a stored answer holding None and a named allergen', () => {
    it('shows the named allergens as chosen and leaves None unselected', () => {
      const chips = buildAllergenChips([ALLERGEN_NONE_CODE, 'soy'])

      expect(chips.filter(chip => chip.selected).map(chip => chip.code)).toEqual(['soy'])
      expect(chips[0]).toEqual({
        code: ALLERGEN_NONE_CODE,
        label: MEAL_PLAN_ALLERGEN_LABELS.none,
        selected: false,
        removable: false
      })
    })

    it('resolves the same way whichever order the two arrive in', () => {
      expect(selectedCodesOf([ALLERGEN_NONE_CODE, 'soy'])).toEqual(['soy'])
      expect(selectedCodesOf(['soy', ALLERGEN_NONE_CODE])).toEqual(['soy'])
    })

    it('keeps every named allergen rather than only the first, in the order the cloud draws them', () => {
      expect(selectedCodesOf(['milk', ALLERGEN_NONE_CODE, 'sesame', 'eggs'])).toEqual(['milk', 'eggs', 'sesame'])
      expect(selectedCodesOf([ALLERGEN_NONE_CODE, ...NAMED_ALLERGENS])).toEqual(NAMED_ALLERGENS)
    })

    it('resolves it the same way when duplicates or an unrecognised code are mixed in', () => {
      expect(selectedCodesOf([ALLERGEN_NONE_CODE, 'fish', ALLERGEN_NONE_CODE, 'fish', 'gluten'])).toEqual(['fish'])
    })
  })

  describe('an unrecognised stored code', () => {
    it('drops it instead of rendering an extra chip', () => {
      const chips = buildAllergenChips(['gluten'])

      expect(chips).toHaveLength(FIGMA_CHIP_ORDER.length)
      expect(chips.some(chip => chip.selected)).toBe(false)
    })

    it('keeps the recognised codes beside it', () => {
      expect(selectedCodesOf(['gluten', 'milk'])).toEqual(['milk'])
    })

    it('does not mutate the selection it is given', () => {
      const selected = ['gluten', 'milk']

      buildAllergenChips(selected)

      expect(selected).toEqual(['gluten', 'milk'])
    })
  })
})

describe('DIET_OPTIONS', () => {
  it('offers exactly the four diet cards of frame 05', () => {
    expect(DIET_OPTIONS).toHaveLength(4)
  })

  it('orders the wire codes as the option cards are drawn', () => {
    expect(DIET_OPTIONS.map(option => option.value)).toEqual(['none', 'vegetarian', 'vegan', 'pescatarian'])
  })

  it('labels each option with the copy its code owns in the strings module', () => {
    expect(DIET_OPTIONS.map(option => option.label)).toEqual([
      MEAL_PLAN_DIET_LABELS.none,
      MEAL_PLAN_DIET_LABELS.vegetarian,
      MEAL_PLAN_DIET_LABELS.vegan,
      MEAL_PLAN_DIET_LABELS.pescatarian
    ])
  })

  // The table is module-global: the option cards read it on every render, so nothing may rewrite
  // which diets this screen offers or what they are called.
  it('freezes the table so a consumer cannot add, drop or reorder a diet', () => {
    expect(Object.isFrozen(DIET_OPTIONS)).toBe(true)
    expect(() => (DIET_OPTIONS as DietOption[]).push({value: 'vegan', label: 'Anything'})).toThrow(TypeError)
    expect(() => (DIET_OPTIONS as DietOption[]).reverse()).toThrow(TypeError)
    expect(DIET_OPTIONS.map(option => option.value)).toEqual(['none', 'vegetarian', 'vegan', 'pescatarian'])
  })

  it('freezes each entry so a consumer cannot relabel a diet in place', () => {
    const [first] = DIET_OPTIONS as DietOption[]
    const rewritten = first as {value: Diet; label: string}

    rewritten.label = 'Anything'

    expect(DIET_OPTIONS.every(option => Object.isFrozen(option))).toBe(true)
    expect(DIET_OPTIONS[0].label).toBe(MEAL_PLAN_DIET_LABELS.none)
  })
})

describe('the allergen table behind the chips', () => {
  it('keeps the ten codes and their order after an attempt to rewrite the cloud', () => {
    const chips = buildAllergenChips([]) as AllergenChip[]

    chips.push({code: 'milk', label: 'Milk again', selected: true, removable: true})
    chips.reverse()

    expect(buildAllergenChips([]).map(chip => chip.code)).toEqual(FIGMA_CHIP_ORDER)
    expect(buildAllergenChips([])).toHaveLength(FIGMA_CHIP_ORDER.length)
  })

  it('derives a fresh chip array per call, so a caller may sort or filter its own copy', () => {
    const first = buildAllergenChips(['milk'])
    const second = buildAllergenChips(['milk'])

    expect(first).toEqual(second)
    expect(first).not.toBe(second)
    expect(Object.isFrozen(first)).toBe(false)
  })
})

describe('validateDietStep', () => {
  it('passes a diet with a named allergen', () => {
    expect(validateDietStep('vegan', ['milk'])).toEqual([])
  })

  it('accepts None as a real answer', () => {
    expect(validateDietStep('none', ['none'])).toEqual([])
  })

  it('reports a missing diet', () => {
    expect(validateDietStep(null, ['none'])).toEqual(['diet_required'])
  })

  it('reports an empty allergen answer', () => {
    expect(validateDietStep('pescatarian', [])).toEqual(['allergens_required'])
  })

  it('reports both controls at once when neither has been answered', () => {
    expect(validateDietStep(null, [])).toEqual(['diet_required', 'allergens_required'])
  })

  it('reports an allergen answer the cloud cannot show as selected', () => {
    expect(validateDietStep('vegetarian', ['gluten'])).toEqual(['allergens_required'])
  })

  // The exclusivity the saved step depends on: exactly ['none'] or named allergens, never a mix.
  it('refuses None beside a named allergen instead of accepting the contradiction', () => {
    expect(validateDietStep('none', [ALLERGEN_NONE_CODE, 'soy'])).toEqual(['allergens_exclusive'])
    expect(validateDietStep('none', ['soy', ALLERGEN_NONE_CODE])).toEqual(['allergens_exclusive'])
    expect(validateDietStep('vegan', ['milk', ALLERGEN_NONE_CODE, 'sesame'])).toEqual(['allergens_exclusive'])
  })

  it('refuses the contradiction even when an unrecognised code sits beside it', () => {
    expect(validateDietStep('none', ['gluten', ALLERGEN_NONE_CODE, 'fish'])).toEqual(['allergens_exclusive'])
  })

  it('reports the contradiction alongside a missing diet, one error per control', () => {
    expect(validateDietStep(null, [ALLERGEN_NONE_CODE, 'soy'])).toEqual(['diet_required', 'allergens_exclusive'])
  })

  it('does not confuse a repeated None with a contradiction', () => {
    expect(validateDietStep('none', [ALLERGEN_NONE_CODE, ALLERGEN_NONE_CODE])).toEqual([])
  })

  it('accepts every named allergen at once', () => {
    expect(validateDietStep('none', NAMED_ALLERGENS)).toEqual([])
  })
})

describe('dietWizardProgress', () => {
  it('counts Diet as the fourth of seven steps on the estimated route', () => {
    expect(dietWizardProgress('estimated')).toEqual({step: 4, totalSteps: 7})
  })

  it('counts Diet as the third of six steps on the manual route, which skips Activity', () => {
    expect(dietWizardProgress('manual')).toEqual({step: 3, totalSteps: 6})
  })

  it('counts the seven-step route before a target route has been chosen', () => {
    expect(dietWizardProgress(null)).toEqual({step: 4, totalSteps: 7})
  })
})
