import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

import styles from '../index.styled'
import {filledSegmentCount, shouldRenderProgress} from '../index.util'

// The progress bar has no width derivation of its own: `ProgressSegments` renders `total` segments
// that each take `flex: 1` inside a `flex: 1` track and lets Yoga size them, which is the AAP's
// universal responsive rule (0.7.5 — a fixed Figma width inside the content column becomes
// `flex: 1`). So the layout contract under test is the exported style objects the component renders,
// and the reference widths below are resolved from those styles rather than from a second formula
// that neither WizardHeader nor ProgressSegments evaluates.
const header = StyleSheet.flatten<ViewStyle>(styles.header)
const track = StyleSheet.flatten<ViewStyle>(styles.track)
const segment = StyleSheet.flatten<ViewStyle>(styles.segment)
const segmentFilled = StyleSheet.flatten<ViewStyle>([styles.segment, styles.segmentFilled])

const ESTIMATED_ROUTE_STEPS = 7
const MANUAL_ROUTE_STEPS = 6
const WIZARD_STEPS = [1, 2, 3, 4, 5, 6, 7]
const REFERENCE_DEVICE_WIDTH = 393
const SMALL_DEVICE_WIDTH = 375
// The "n of m" counter hugs its text, measured at 34 px in Figma 46:151 at the reference frame.
const COUNTER_HUG_WIDTH = 34
const FIGMA_SEGMENT_WIDTH_375 = 30.43
const FIGMA_MANUAL_SEGMENT_WIDTH_393 = 39.17
const FIGMA_MANUAL_SEGMENT_WIDTH_375 = 36.17

// Guarded rather than cast: a style value that stops being a number — dropped, or authored as a
// percentage string — has to fail the test loudly instead of being scored as `undefined`.
const resolvedNumber = (value: unknown, description: string): number => {
  if (typeof value !== 'number') {
    throw new Error(`Expected ${description} to resolve to a number, received ${String(value)}`)
  }

  return value
}

const headerGap = resolvedNumber(header.gap, "the header row's gap")
const segmentGap = resolvedNumber(track.gap, "the segment row's gap")

// What the `flex: 1` track is left with: the content column less the back button, the hugging counter
// and the two header gaps separating the three. The gap is read off the header style above; the
// button is `Sizes.TILE_SM`, the token `BackCircleButton` is drawn at.
const trackWidth = (deviceWidth: number): number =>
  deviceWidth - Spacing.GUTTER * 2 - Sizes.TILE_SM - COUNTER_HUG_WIDTH - headerGap * 2

// How Yoga resolves the track, not a parallel formula for it: `flex: 1` on every segment is a flex
// basis of 0 plus an equal share of whatever the interior gaps leave, and a child's main size is
// clamped at 0 however narrow — or unmeasured — the track is.
const flexSegmentWidth = (deviceTrackWidth: number, total: number): number =>
  total > 0 ? Math.max(deviceTrackWidth - segmentGap * (total - 1), 0) / total : 0

describe('the progress track', () => {
  it('lays the header out as one row of back button, track and counter, stretched and centred', () => {
    expect(header.flexDirection).toBe('row')
    expect(header.alignItems).toBe('center')
    expect(header.alignSelf).toBe('stretch')
    expect(headerGap).toBe(Spacing.SMALL)
  })

  it('gives the track the whole remainder of that row', () => {
    expect(track.flex).toBe(1)
    expect(track.flexDirection).toBe('row')
  })

  it('separates the segments by the extra-extra-small spacing token, and only between them', () => {
    expect(segmentGap).toBe(Spacing.XX_SMALL)
    expect(track.columnGap).toBeUndefined()
    expect(track.rowGap).toBeUndefined()
  })

  it('gives every segment an equal share of the track at the Figma bar height', () => {
    expect(segment.flex).toBe(1)
    expect(segment.flexGrow).toBeUndefined()
    expect(segment.flexShrink).toBeUndefined()
    expect(segment.height).toBe(Sizes.PROGRESS_SEGMENT_H)
  })

  it('carries no fixed Figma width, so the bar follows the device rather than the 393 px frame', () => {
    expect(segment.width).toBeUndefined()
    expect(segment.minWidth).toBeUndefined()
    expect(segment.maxWidth).toBeUndefined()
    expect(segment.flexBasis).toBeUndefined()
  })

  it('fills a reached segment with the accent and leaves the rest on the track colour', () => {
    expect(segment.backgroundColor).toBe(Theme.colors.track)
    expect(segmentFilled.backgroundColor).toBe(Theme.colors.accentGreen)
  })
})

describe('the widths that track resolves to', () => {
  it('is the reference segment width on the seven-step estimated route at 393 px', () => {
    expect(trackWidth(REFERENCE_DEVICE_WIDTH)).toBe(255)
    expect(flexSegmentWidth(trackWidth(REFERENCE_DEVICE_WIDTH), ESTIMATED_ROUTE_STEPS)).toBe(Sizes.PROGRESS_SEGMENT_W)
  })

  it('narrows to about 30.43 px on a 375 px device', () => {
    expect(trackWidth(SMALL_DEVICE_WIDTH)).toBe(237)
    expect(flexSegmentWidth(trackWidth(SMALL_DEVICE_WIDTH), ESTIMATED_ROUTE_STEPS)).toBeCloseTo(
      FIGMA_SEGMENT_WIDTH_375,
      2
    )
  })

  it('widens on the six-step manual-target route, where the activity step is skipped', () => {
    expect(flexSegmentWidth(trackWidth(REFERENCE_DEVICE_WIDTH), MANUAL_ROUTE_STEPS)).toBeCloseTo(
      FIGMA_MANUAL_SEGMENT_WIDTH_393,
      2
    )
    expect(flexSegmentWidth(trackWidth(SMALL_DEVICE_WIDTH), MANUAL_ROUTE_STEPS)).toBeCloseTo(
      FIGMA_MANUAL_SEGMENT_WIDTH_375,
      2
    )
  })

  it('fills each device track exactly with its segments plus their one-fewer gaps', () => {
    ;[REFERENCE_DEVICE_WIDTH, SMALL_DEVICE_WIDTH].forEach(deviceWidth => {
      ;[ESTIMATED_ROUTE_STEPS, MANUAL_ROUTE_STEPS].forEach(total => {
        const width = flexSegmentWidth(trackWidth(deviceWidth), total)

        expect(width * total + segmentGap * (total - 1)).toBe(trackWidth(deviceWidth))
      })
    })
  })

  it('charges one fewer gap than there are segments', () => {
    const available = trackWidth(REFERENCE_DEVICE_WIDTH)
    const oneGapPerSegment = (available - segmentGap * ESTIMATED_ROUTE_STEPS) / ESTIMATED_ROUTE_STEPS

    expect(flexSegmentWidth(available, ESTIMATED_ROUTE_STEPS)).not.toBe(oneGapPerSegment)
    expect(flexSegmentWidth(available, ESTIMATED_ROUTE_STEPS)).toBe(Sizes.PROGRESS_SEGMENT_W)
  })

  it('gives a single segment the whole track, because it spans no gaps', () => {
    expect(flexSegmentWidth(trackWidth(REFERENCE_DEVICE_WIDTH), 1)).toBe(trackWidth(REFERENCE_DEVICE_WIDTH))
  })

  it('collapses to zero rather than a negative width while the track is unmeasured or empty', () => {
    expect(flexSegmentWidth(0, ESTIMATED_ROUTE_STEPS)).toBe(0)
    expect(flexSegmentWidth(segmentGap, ESTIMATED_ROUTE_STEPS)).toBe(0)
    expect(flexSegmentWidth(trackWidth(REFERENCE_DEVICE_WIDTH), 0)).toBe(0)
    expect(flexSegmentWidth(0, ESTIMATED_ROUTE_STEPS)).toBeGreaterThanOrEqual(0)
  })
})

describe('filledSegmentCount', () => {
  describe('within the step range', () => {
    it('fills one bar per step reached on the seven-step route', () => {
      expect(filledSegmentCount(1, ESTIMATED_ROUTE_STEPS)).toBe(1)
      expect(filledSegmentCount(4, ESTIMATED_ROUTE_STEPS)).toBe(4)
      expect(filledSegmentCount(7, ESTIMATED_ROUTE_STEPS)).toBe(7)
    })

    it('fills one bar per step reached on the six-step manual-target route', () => {
      expect(filledSegmentCount(3, MANUAL_ROUTE_STEPS)).toBe(3)
      expect(filledSegmentCount(6, MANUAL_ROUTE_STEPS)).toBe(6)
    })

    it('advances exactly one bar per step across the whole wizard', () => {
      WIZARD_STEPS.forEach(step => {
        expect(filledSegmentCount(step, ESTIMATED_ROUTE_STEPS)).toBe(step)
      })
    })
  })

  describe('steps outside the range', () => {
    it('fills nothing before the first step', () => {
      expect(filledSegmentCount(0, ESTIMATED_ROUTE_STEPS)).toBe(0)
    })

    it('never returns a negative count', () => {
      expect(filledSegmentCount(-1, ESTIMATED_ROUTE_STEPS)).toBe(0)
    })

    it('never fills more bars than the track has', () => {
      expect(filledSegmentCount(8, ESTIMATED_ROUTE_STEPS)).toBe(ESTIMATED_ROUTE_STEPS)
      expect(filledSegmentCount(99, MANUAL_ROUTE_STEPS)).toBe(MANUAL_ROUTE_STEPS)
    })
  })

  describe('degenerate totals', () => {
    it('returns zero when there are no segments to fill', () => {
      expect(filledSegmentCount(3, 0)).toBe(0)
    })

    it('returns zero for a negative total', () => {
      expect(filledSegmentCount(3, -2)).toBe(0)
    })
  })
})

describe('shouldRenderProgress', () => {
  describe('inside the setup flow', () => {
    it('shows the progress on either route, at every step of it', () => {
      WIZARD_STEPS.forEach(() => {
        expect(shouldRenderProgress(true, ESTIMATED_ROUTE_STEPS)).toBe(true)
        expect(shouldRenderProgress(true, MANUAL_ROUTE_STEPS)).toBe(true)
      })
    })
  })

  describe('a step reopened on its own', () => {
    // Edit mode reopens one step from a Review or Plan settings row and returns to where it was opened
    // from, so the user is not moving through a numbered flow and the header must not say they are — the
    // segments and the counter are one claim and are refused together (AAP 0.7.4).
    it('shows no progress however many steps the route has', () => {
      expect(shouldRenderProgress(false, ESTIMATED_ROUTE_STEPS)).toBe(false)
      expect(shouldRenderProgress(false, MANUAL_ROUTE_STEPS)).toBe(false)
    })
  })

  describe('degenerate totals', () => {
    it('shows no progress for a track with no segments, even when the flow asks for one', () => {
      expect(shouldRenderProgress(true, 0)).toBe(false)
    })

    it('shows no progress for a negative total', () => {
      expect(shouldRenderProgress(true, -2)).toBe(false)
    })
  })
})
