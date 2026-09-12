import {ALLERGEN_NONE_CODE, buildAllergenChips, DIET_OPTIONS, dietWizardProgress, validateDietStep} from '../index.util'

// Frame 05 (47:177) draws the cloud as None, Milk, Eggs, Peanuts, Tree nuts, Soy, Wheat, Fish, Shellfish, Sesame
const FIGMA_CHIP_ORDER = ['none', 'milk', 'eggs', 'peanuts', 'tree_nuts', 'soy', 'wheat', 'fish', 'shellfish', 'sesame']

const FIGMA_CHIP_LABELS = [
  'None',
  'Milk',
  'Eggs',
  'Peanuts',
  'Tree nuts',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish',
  'Sesame'
]

const selectedCodesOf = (selected: string[]): string[] =>
  buildAllergenChips(selected)
    .filter(chip => chip.selected)
    .map(chip => chip.code)

describe('ALLERGEN_NONE_CODE', () => {
  it('is the wire sentinel the saved step carries on its own', () => {
    expect(ALLERGEN_NONE_CODE).toBe('none')
  })

  it('leads the chip cloud', () => {
    expect(buildAllergenChips([])[0].code).toBe(ALLERGEN_NONE_CODE)
  })
})

describe('buildAllergenChips', () => {
  it('renders the ten chips in the order frame 05 draws them, None first', () => {
    expect(buildAllergenChips([]).map(chip => chip.code)).toEqual(FIGMA_CHIP_ORDER)
  })

  it('labels every chip with its Figma copy', () => {
    expect(buildAllergenChips([]).map(chip => chip.label)).toEqual(FIGMA_CHIP_LABELS)
  })

  it('selects nothing on first entry', () => {
    const chips = buildAllergenChips([])

    expect(chips.every(chip => !chip.selected)).toBe(true)
    expect(chips.every(chip => !chip.removable)).toBe(true)
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

  it('reflects a None-only selection', () => {
    expect(selectedCodesOf(['none'])).toEqual(['none'])
  })

  it('reflects None alongside named allergens without resolving the exclusivity itself', () => {
    expect(selectedCodesOf(['none', 'soy'])).toEqual(['none', 'soy'])
  })

  it('drops an unrecognised code instead of rendering an extra chip', () => {
    const chips = buildAllergenChips(['gluten'])

    expect(chips).toHaveLength(FIGMA_CHIP_ORDER.length)
    expect(chips.some(chip => chip.selected)).toBe(false)
  })

  it('ignores a duplicated selection', () => {
    expect(selectedCodesOf(['fish', 'fish'])).toEqual(['fish'])
  })

  it('does not mutate the selection it is given', () => {
    const selected = ['gluten', 'milk']

    buildAllergenChips(selected)

    expect(selected).toEqual(['gluten', 'milk'])
  })
})

describe('DIET_OPTIONS', () => {
  it('offers the four diet cards of frame 05 in order, with their wire codes', () => {
    expect(DIET_OPTIONS).toEqual([
      {value: 'none', label: 'No specific diet'},
      {value: 'vegetarian', label: 'Vegetarian'},
      {value: 'vegan', label: 'Vegan'},
      {value: 'pescatarian', label: 'Pescatarian'}
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
