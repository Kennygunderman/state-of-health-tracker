import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'

import styles from '../index.styled'
import {
  isFlexSegments,
  optionBoxHeightFor,
  segmentEnvelopeInsetFor,
  segmentWidthFor,
  visualTrackHeightFor
} from '../index.util'

// The composites the component actually renders: `index.tsx` styles the envelope, the drawn track,
// each option and each pill as `[base, variant]` arrays, so they are resolved here the same way the
// renderer resolves them. `StyleSheet.create` may hand back either the style objects or registered
// ids depending on the React Native version, hence `flatten` rather than direct property access.
const LARGE = {
  envelope: StyleSheet.flatten<ViewStyle>([styles.envelope, styles.envelopeLarge]),
  option: StyleSheet.flatten<ViewStyle>(styles.option),
  pill: StyleSheet.flatten<ViewStyle>(styles.segment),
  pillHeight: Sizes.SEGMENT_H,
  trackSurface: StyleSheet.flatten<ViewStyle>([styles.trackSurface, styles.trackSurfaceLarge])
}
const COMPACT = {
  envelope: StyleSheet.flatten<ViewStyle>([styles.envelope, styles.envelopeCompact]),
  option: StyleSheet.flatten<ViewStyle>([styles.option, styles.optionCompact]),
  pill: StyleSheet.flatten<ViewStyle>([styles.segment, styles.segmentCompact]),
  pillHeight: Sizes.SEGMENT_COMPACT_H,
  trackSurface: StyleSheet.flatten<ViewStyle>([styles.trackSurface, styles.trackSurfaceCompact])
}
const INDICATOR = StyleSheet.flatten<ViewStyle>(styles.indicator)
const SCALED_PILL_HEIGHTS = [Sizes.SEGMENT_H, 36, 40, 48]

// Guarded rather than cast: a style value that stops being a number — dropped, or authored as a
// percentage string — has to fail the test loudly instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const envelopeInsetOf = (variant: typeof LARGE, name: string): number =>
  -resolvedNumber(variant.envelope.marginVertical, `the ${name} envelope's negative margin`)

const pillInsetOf = (variant: typeof LARGE, name: string): number =>
  resolvedNumber(variant.option.paddingVertical, `the ${name} option's vertical padding`)

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

// The three derivations above are what `index.styled.ts` calls to build the envelope, so the cases
// above pin the arithmetic. These cases pin the styles that arithmetic produces — read off the
// exported composites the component renders — so a change made directly in the styled module, or a
// composite the component stops assembling, cannot leave the rendered target, inset or footprint
// wrong while the derivation tests stay green.
describe('the rendered envelope', () => {
  it('presses at exactly the minimum target on the large variant, with no hit slop involved', () => {
    expect(resolvedNumber(LARGE.envelope.minHeight, "the large envelope's minimum height")).toBe(
      optionBoxHeightFor(Sizes.SEGMENT_H, Sizes.SEGMENT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)
    )
    expect(resolvedNumber(LARGE.envelope.minHeight, "the large envelope's minimum height")).toBe(Sizes.TOUCH_TARGET)
  })

  it('presses at exactly the minimum target on the compact variants too', () => {
    expect(resolvedNumber(COMPACT.envelope.minHeight, "the compact envelope's minimum height")).toBe(
      optionBoxHeightFor(Sizes.SEGMENT_COMPACT_H, Sizes.SEGMENT_COMPACT_ENVELOPE_INSET_V, Sizes.SEGMENT_TRACK_INSET)
    )
    expect(resolvedNumber(COMPACT.envelope.minHeight, "the compact envelope's minimum height")).toBe(Sizes.TOUCH_TARGET)
  })

  it('fills the envelope with the pressable option, so the parent bounds cannot cut the target short', () => {
    ;[
      {name: 'large', variant: LARGE},
      {name: 'compact', variant: COMPACT}
    ].forEach(({name, variant}) => {
      const pillInset = pillInsetOf(variant, name)
      const pillHeight = resolvedNumber(variant.pill.minHeight, `the ${name} pill's minimum height`)

      expect(pillHeight).toBe(variant.pillHeight)
      expect(pillHeight + pillInset + pillInset).toBe(
        resolvedNumber(variant.envelope.minHeight, `the ${name} envelope's minimum height`)
      )
    })
  })

  it('occupies the drawn track in layout, so gaining a press envelope moved nothing on screen', () => {
    ;[
      {name: 'large', variant: LARGE},
      {name: 'compact', variant: COMPACT}
    ].forEach(({name, variant}) => {
      const envelopeInset = envelopeInsetOf(variant, name)
      const optionBox = resolvedNumber(variant.envelope.minHeight, `the ${name} envelope's minimum height`)

      expect(optionBox - envelopeInset - envelopeInset).toBe(
        visualTrackHeightFor(variant.pillHeight, Sizes.SEGMENT_TRACK_INSET)
      )
    })
  })

  it('keeps that footprint equal to the drawn track at every text size, not only the reference one', () => {
    const envelopeInset = envelopeInsetOf(LARGE, 'large')
    const pillInset = pillInsetOf(LARGE, 'large')

    // `minHeight` is a floor, so a label that scales the pill up grows the option box with it.
    SCALED_PILL_HEIGHTS.forEach(pillHeight => {
      const optionBox = pillHeight + pillInset + pillInset

      expect(optionBox - envelopeInset - envelopeInset).toBe(
        visualTrackHeightFor(pillHeight, Sizes.SEGMENT_TRACK_INSET)
      )
    })
  })

  it('draws the track inside the envelope by that same inset, on both edges', () => {
    ;[
      {name: 'large', variant: LARGE},
      {name: 'compact', variant: COMPACT}
    ].forEach(({name, variant}) => {
      const envelopeInset = envelopeInsetOf(variant, name)

      expect(resolvedNumber(variant.trackSurface.top, `the ${name} track's top inset`)).toBe(envelopeInset)
      expect(resolvedNumber(variant.trackSurface.bottom, `the ${name} track's bottom inset`)).toBe(envelopeInset)
      expect(envelopeInset).toBe(
        segmentEnvelopeInsetFor(visualTrackHeightFor(variant.pillHeight, Sizes.SEGMENT_TRACK_INSET), Sizes.TOUCH_TARGET)
      )
    })
  })

  it('insets the swipe indicator to the pill it tracks, across the envelope and then the track', () => {
    const pillInset = pillInsetOf(LARGE, 'large')

    expect(resolvedNumber(INDICATOR.top, "the indicator's top inset")).toBe(pillInset)
    expect(resolvedNumber(INDICATOR.bottom, "the indicator's bottom inset")).toBe(pillInset)
    expect(resolvedNumber(INDICATOR.left, "the indicator's leading inset")).toBe(Sizes.SEGMENT_TRACK_INSET)
    expect(resolvedNumber(LARGE.envelope.paddingHorizontal, "the envelope's horizontal padding")).toBe(
      Sizes.SEGMENT_TRACK_INSET
    )
  })

  it('flexes the large segments across the track and lets the compact ones hug their labels', () => {
    expect(LARGE.option.flex).toBe(1)
    expect(LARGE.option.flexGrow).toBeUndefined()
    expect(LARGE.option.flexShrink).toBeUndefined()
    expect(LARGE.envelope.alignSelf).toBe('stretch')
    expect(COMPACT.option.flex).toBe(0)
    expect(COMPACT.envelope.alignSelf).toBe('flex-start')
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
