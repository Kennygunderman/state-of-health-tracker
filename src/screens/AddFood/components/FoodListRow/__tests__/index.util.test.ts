import {CATALOG_PROVENANCE_BADGE_LABELS} from '@constants/strings'

import {
  FoodListRowBadge,
  FoodListRowLabelParts,
  foodListRowAccessibilityLabel,
  resolveBadgeVariant
} from '../index.util'

const makeBadge = (overrides: Partial<FoodListRowBadge> = {}): FoodListRowBadge => ({
  label: 'Source-backed',
  tone: 'neutral',
  ...overrides
})

const makeLabelParts = (overrides: Partial<FoodListRowLabelParts> = {}): FoodListRowLabelParts => ({
  name: 'Brown rice, cooked',
  detail: '1 cup',
  subtitle: 'Grain',
  calories: 240,
  badge: makeBadge(),
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

describe('foodListRowAccessibilityLabel', () => {
  describe('with every part present', () => {
    it('reads the row in the order a sighted user reads it', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts())).toBe(
        'Brown rice, cooked, 1 cup, Source-backed, Grain, 240 cal'
      )
    })

    it('states the provenance pill, which is otherwise sighted-only', () => {
      const label = foodListRowAccessibilityLabel(
        makeLabelParts({badge: {label: CATALOG_PROVENANCE_BADGE_LABELS.ai_estimated, tone: 'warning'}})
      )

      expect(label).toContain(CATALOG_PROVENANCE_BADGE_LABELS.ai_estimated)
    })
  })

  describe('with a part absent', () => {
    it('drops an omitted detail together with its separator', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({detail: undefined}))).toBe(
        'Brown rice, cooked, Source-backed, Grain, 240 cal'
      )
    })

    it('drops a null detail', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({detail: null}))).toBe(
        'Brown rice, cooked, Source-backed, Grain, 240 cal'
      )
    })

    it('drops an omitted subtitle', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({subtitle: undefined}))).toBe(
        'Brown rice, cooked, 1 cup, Source-backed, 240 cal'
      )
    })

    it('drops a null subtitle', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({subtitle: null}))).toBe(
        'Brown rice, cooked, 1 cup, Source-backed, 240 cal'
      )
    })

    it('drops a blank part rather than announcing an empty gap', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({detail: '   ', subtitle: ''}))).toBe(
        'Brown rice, cooked, Source-backed, 240 cal'
      )
    })

    it('always keeps the name and the calories', () => {
      expect(
        foodListRowAccessibilityLabel({name: 'Olive oil', detail: null, subtitle: null, calories: 130, badge: null})
      ).toBe('Olive oil, 130 cal')
    })
  })

  describe('with no badge', () => {
    it('omits the pill for a library row', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({badge: undefined}))).toBe(
        'Brown rice, cooked, 1 cup, Grain, 240 cal'
      )
    })

    it('omits the pill for an explicit null badge', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({badge: null}))).toBe(
        'Brown rice, cooked, 1 cup, Grain, 240 cal'
      )
    })

    it('omits a badge carrying no label', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({badge: makeBadge({label: ''})}))).toBe(
        'Brown rice, cooked, 1 cup, Grain, 240 cal'
      )
    })
  })

  describe('calorie rounding', () => {
    it('rounds a fractional value up exactly as the row does', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({calories: 239.85}))).toContain('240 cal')
    })

    it('rounds a fractional value down exactly as the row does', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({calories: 239.4}))).toContain('239 cal')
    })

    it('rounds a half up', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({calories: 0.5}))).toContain('1 cal')
    })

    it('announces a zero-calorie food as zero', () => {
      expect(foodListRowAccessibilityLabel(makeLabelParts({calories: 0}))).toContain('0 cal')
    })
  })
})
