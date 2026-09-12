import {MEAL_PLAN_ALLERGEN_LABELS, MEAL_PLAN_DIET_LABELS} from '@constants/strings'

import {ALLERGEN_NONE_CODE, buildAllergenChips, DIET_OPTIONS, dietWizardProgress, validateDietStep} from '../index.util'

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

    it('reflects None alongside named allergens without resolving the exclusivity itself', () => {
      expect(selectedCodesOf([ALLERGEN_NONE_CODE, 'soy'])).toEqual(['none', 'soy'])
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
