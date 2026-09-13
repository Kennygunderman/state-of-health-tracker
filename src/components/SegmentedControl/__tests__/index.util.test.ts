import {Sizes} from '@styles/sizes'

import {
  envelopeFootprintFor,
  isFlexSegments,
  optionBoxHeightFor,
  segmentEnvelopeInsetFor,
  segmentWidthFor,
  visualTrackHeightFor
} from '../index.util'

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

describe('visualTrackHeightFor', () => {
  it('draws the large track at 36, the pill plus the inset above and below it', () => {
    expect(visualTrackHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_TRACK_INSET)).toBe(36)
  })

  it('draws the compact track at 29, the height the small and unit controls are designed at', () => {
    expect(visualTrackHeightFor(Sizes.SEGMENT_COMPACT_H, Sizes.SEGMENT_TRACK_INSET)).toBe(29)
  })

  it('grows with a pill enlarged by a scaled-up label', () => {
    expect(visualTrackHeightFor(40, Sizes.SEGMENT_TRACK_INSET)).toBe(44)
  })

  it('insets both edges, never one only', () => {
    expect(visualTrackHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_TRACK_INSET)).not.toBe(
      Sizes.SEGMENT_H + Sizes.SEGMENT_TRACK_INSET
    )
  })
})

describe('segmentEnvelopeInsetFor', () => {
  describe('track drawn below the minimum target', () => {
    it('needs 4 px on each edge to lift the 36 px large track to the 44 px target', () => {
      expect(segmentEnvelopeInsetFor(36, Sizes.TOUCH_TARGET)).toBe(4)
    })

    it('needs 7.5 px on each edge to lift the 29 px compact track to the target', () => {
      expect(segmentEnvelopeInsetFor(29, Sizes.TOUCH_TARGET)).toBe(7.5)
    })

    it('is the value the large envelope token carries, derived from the tokens themselves', () => {
      const trackHeight = visualTrackHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_TRACK_INSET)

      expect(segmentEnvelopeInsetFor(trackHeight, Sizes.TOUCH_TARGET)).toBe(Sizes.SEGMENT_ENVELOPE_INSET_V)
    })

    it('is the value the compact envelope token carries, derived from the tokens themselves', () => {
      const trackHeight = visualTrackHeightFor(Sizes.SEGMENT_COMPACT_H, Sizes.SEGMENT_TRACK_INSET)

      expect(segmentEnvelopeInsetFor(trackHeight, Sizes.TOUCH_TARGET)).toBe(Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V)
    })
  })

  describe('track already at or above the target', () => {
    it('asks for nothing when the drawn track exactly meets the target', () => {
      expect(segmentEnvelopeInsetFor(Sizes.TOUCH_TARGET, Sizes.TOUCH_TARGET)).toBe(0)
    })

    it('asks for nothing when a scaled-up label has already taken the track past the target', () => {
      expect(segmentEnvelopeInsetFor(48, Sizes.TOUCH_TARGET)).toBe(0)
    })

    it('never returns a negative inset, which would crop the drawn track', () => {
      expect(segmentEnvelopeInsetFor(60, Sizes.TOUCH_TARGET)).toBeGreaterThanOrEqual(0)
    })
  })

  describe('unusable input', () => {
    it('asks for nothing on a NaN track height instead of a NaN margin', () => {
      expect(segmentEnvelopeInsetFor(Number.NaN, Sizes.TOUCH_TARGET)).toBe(0)
    })

    it('asks for nothing on an infinite track height', () => {
      expect(segmentEnvelopeInsetFor(Number.NEGATIVE_INFINITY, Sizes.TOUCH_TARGET)).toBe(0)
    })

    it('stays finite for every input, so a style value can never be corrupted', () => {
      expect(Number.isFinite(segmentEnvelopeInsetFor(Number.POSITIVE_INFINITY, Sizes.TOUCH_TARGET))).toBe(true)
    })
  })
})

describe('optionBoxHeightFor (the box the user actually presses)', () => {
  it('gives a large option exactly the 44 px target, with no hit slop involved', () => {
    expect(optionBoxHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)).toBe(
      Sizes.TOUCH_TARGET
    )
  })

  it('gives a compact option exactly the 44 px target, with no hit slop involved', () => {
    expect(
      optionBoxHeightFor(Sizes.SEGMENT_COMPACT_H, Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)
    ).toBe(Sizes.TOUCH_TARGET)
  })

  it('fits its envelope exactly, so the parent bounds React Native clips to cannot cut the target short', () => {
    const optionBox = optionBoxHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)

    expect(optionBox).toBeLessThanOrEqual(Sizes.TOUCH_TARGET)
    expect(optionBox).toBeGreaterThanOrEqual(Sizes.TOUCH_TARGET)
  })

  it('stays at or above the target once a scaled-up label enlarges the pill', () => {
    expect(optionBoxHeightFor(40, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)).toBeGreaterThanOrEqual(
      Sizes.TOUCH_TARGET
    )
  })

  it('is taller than the track it is drawn over, which is the whole reason the envelope exists', () => {
    const optionBox = optionBoxHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)
    const trackHeight = visualTrackHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_TRACK_INSET)

    expect(optionBox).toBeGreaterThan(trackHeight)
    expect(trackHeight).toBeLessThan(Sizes.TOUCH_TARGET)
  })
})

describe('envelopeFootprintFor (what the control occupies in layout)', () => {
  it('occupies the drawn 36 px track for the large variant, so nothing on the screen moves', () => {
    const optionBox = optionBoxHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)

    expect(envelopeFootprintFor(optionBox, Sizes.SEGMENT_ENVELOPE_INSET_V)).toBe(
      visualTrackHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_TRACK_INSET)
    )
  })

  it('occupies the drawn 29 px track for the compact variants', () => {
    const optionBox = optionBoxHeightFor(
      Sizes.SEGMENT_COMPACT_H,
      Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V,
      Sizes.SEGMENT_TRACK_INSET
    )

    expect(envelopeFootprintFor(optionBox, Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V)).toBe(
      visualTrackHeightFor(Sizes.SEGMENT_COMPACT_H, Sizes.SEGMENT_TRACK_INSET)
    )
  })

  it('keeps the footprint equal to the drawn track at every text size, not only the reference one', () => {
    const pillHeights = [Sizes.SEGMENT_H, 36, 40, 48]

    pillHeights.forEach(pillHeight => {
      const optionBox = optionBoxHeightFor(pillHeight, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)

      expect(envelopeFootprintFor(optionBox, Sizes.SEGMENT_ENVELOPE_INSET_V)).toBe(
        visualTrackHeightFor(pillHeight, Sizes.SEGMENT_TRACK_INSET)
      )
    })
  })

  it('gives both insets back, never one only', () => {
    expect(envelopeFootprintFor(Sizes.TOUCH_TARGET, Sizes.SEGMENT_ENVELOPE_INSET_V)).not.toBe(
      Sizes.TOUCH_TARGET - Sizes.SEGMENT_ENVELOPE_INSET_V
    )
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
