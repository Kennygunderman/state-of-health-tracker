import {isFlexSegments, segmentWidthFor} from '../index.util'

describe('segmentWidthFor', () => {
  describe('unusable track width', () => {
    it('returns 0 while the track is still unmeasured, before onLayout reports a width', () => {
      expect(segmentWidthFor(0, 2, 2)).toBe(0)
    })

    it('returns 0 for a negative track width instead of a negative segment width', () => {
      expect(segmentWidthFor(-353, 2, 2)).toBe(0)
    })
  })

  describe('unusable option count', () => {
    it('returns 0 for zero options, where the unguarded division would be Infinity', () => {
      expect(segmentWidthFor(353, 0, 2)).toBe(0)
    })

    it('keeps the zero-option result finite so the indicator translateX cannot be corrupted', () => {
      expect(Number.isFinite(segmentWidthFor(353, 0, 2))).toBe(true)
    })

    it('returns 0 for a negative option count', () => {
      expect(segmentWidthFor(353, -1, 2)).toBe(0)
    })
  })

  describe('two-segment Diary / Meal Plan track (design contract)', () => {
    it('gives each segment 174.5 across the 353 px content column of the 393 px reference device', () => {
      expect(segmentWidthFor(353, 2, 2)).toBe(174.5)
    })

    it('gives each segment 165.5 across the 335 px content column of a 375 px device', () => {
      expect(segmentWidthFor(335, 2, 2)).toBe(165.5)
    })

    it('insets the leading and the trailing edge, never one edge only', () => {
      expect(segmentWidthFor(353, 2, 2)).not.toBe((353 - 2) / 2)
    })
  })

  describe('three-segment track', () => {
    it('divides the twice-inset track evenly, 304 less both insets being 300 over three segments', () => {
      expect(segmentWidthFor(304, 3, 2)).toBe(100)
    })

    it('leaves the repeating 393 px reference width unrounded', () => {
      expect(segmentWidthFor(353, 3, 2)).toBeCloseTo(116.33333333333333, 10)
    })

    it('recomposes the full track from the three segments plus both insets', () => {
      expect(segmentWidthFor(353, 3, 2) * 3 + 2 + 2).toBe(353)
    })
  })

  describe('inset injected by the caller', () => {
    it('reclaims both insets for the segments when the caller passes a zero inset', () => {
      expect(segmentWidthFor(353, 2, 0)).toBe(176.5)
    })
  })
})

describe('isFlexSegments', () => {
  it('is true for large, whose segments flex to divide the track', () => {
    expect(isFlexSegments('large')).toBe(true)
  })

  it('is false for small, whose segments hug their labels', () => {
    expect(isFlexSegments('small')).toBe(false)
  })

  it('is false for unit, whose two segments hug their labels', () => {
    expect(isFlexSegments('unit')).toBe(false)
  })
})
