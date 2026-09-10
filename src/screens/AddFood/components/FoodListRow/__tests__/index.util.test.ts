import {FoodListRowBadge, resolveBadgeVariant} from '../index.util'

const makeBadge = (overrides: Partial<FoodListRowBadge> = {}): FoodListRowBadge => ({
  label: 'Source-backed',
  tone: 'neutral',
  ...overrides
})

describe('resolveBadgeVariant', () => {
  describe('without a badge', () => {
    it('resolves to no badge when none is passed', () => {
      expect(resolveBadgeVariant()).toBe('none')
    })

    it('resolves to no badge for an explicit undefined', () => {
      expect(resolveBadgeVariant(undefined)).toBe('none')
    })

    it('resolves to no badge for null', () => {
      expect(resolveBadgeVariant(null)).toBe('none')
    })
  })

  describe('with a badge', () => {
    it('carries a neutral tone through as the neutral variant', () => {
      expect(resolveBadgeVariant(makeBadge({tone: 'neutral'}))).toBe('neutral')
    })

    it('carries a warning tone through as the warning variant', () => {
      expect(resolveBadgeVariant(makeBadge({tone: 'warning'}))).toBe('warning')
    })

    it('ignores the label when resolving the variant', () => {
      expect(resolveBadgeVariant(makeBadge({label: '', tone: 'neutral'}))).toBe('neutral')
      expect(resolveBadgeVariant(makeBadge({label: '', tone: 'warning'}))).toBe('warning')
    })
  })
})
