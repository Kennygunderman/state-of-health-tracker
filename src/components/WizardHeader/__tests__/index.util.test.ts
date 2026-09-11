import {filledSegmentCount, progressSegmentWidth} from '../index.util'

const GUTTER = 20
const BACK_BUTTON = 40
const COUNTER_HUG = 34
const HEADER_ROW_GAP = 12
const SEGMENT_GAP = 4
const ESTIMATED_ROUTE_STEPS = 7
const MANUAL_ROUTE_STEPS = 6
const WIZARD_STEPS = [1, 2, 3, 4, 5, 6, 7]
const EVENLY_DIVISIBLE_TRACK = 210
const SINGLE_SEGMENT_TRACK = 100
const CONTENT_COLUMN_393 = 393 - GUTTER * 2
const CONTENT_COLUMN_375 = 375 - GUTTER * 2
const TRACK_393 = CONTENT_COLUMN_393 - BACK_BUTTON - COUNTER_HUG - HEADER_ROW_GAP * 2
const TRACK_375 = CONTENT_COLUMN_375 - BACK_BUTTON - COUNTER_HUG - HEADER_ROW_GAP * 2
const UNMEASURABLE_TRACKS = [
  {trackWidth: 0, total: ESTIMATED_ROUTE_STEPS},
  {trackWidth: -10, total: ESTIMATED_ROUTE_STEPS},
  {trackWidth: TRACK_393, total: 0},
  {trackWidth: TRACK_393, total: -1}
]
const EXACTLY_FILLED_TRACKS = [
  {trackWidth: TRACK_393, total: ESTIMATED_ROUTE_STEPS},
  {trackWidth: TRACK_375, total: ESTIMATED_ROUTE_STEPS},
  {trackWidth: TRACK_393, total: MANUAL_ROUTE_STEPS},
  {trackWidth: TRACK_375, total: MANUAL_ROUTE_STEPS}
]

describe('progressSegmentWidth', () => {
  describe('the seven-step estimated route', () => {
    it('is 33 px wide at the 393 px reference', () => {
      expect(CONTENT_COLUMN_393).toBe(353)
      expect(TRACK_393).toBe(255)
      expect(progressSegmentWidth(TRACK_393, ESTIMATED_ROUTE_STEPS, SEGMENT_GAP)).toBe(33)
    })

    it('narrows to about 30.43 px on a 375 px device', () => {
      expect(CONTENT_COLUMN_375).toBe(335)
      expect(TRACK_375).toBe(237)
      expect(progressSegmentWidth(TRACK_375, ESTIMATED_ROUTE_STEPS, SEGMENT_GAP)).toBeCloseTo(30.43, 2)
    })
  })

  describe('the six-step manual-target route', () => {
    it('widens to about 39.17 px at the 393 px reference when the activity step is skipped', () => {
      expect(progressSegmentWidth(TRACK_393, MANUAL_ROUTE_STEPS, SEGMENT_GAP)).toBeCloseTo(39.17, 2)
    })

    it('is about 36.17 px on a 375 px device', () => {
      expect(progressSegmentWidth(TRACK_375, MANUAL_ROUTE_STEPS, SEGMENT_GAP)).toBeCloseTo(36.17, 2)
    })
  })

  describe('gap accounting', () => {
    it('divides the whole track evenly when there is no gap', () => {
      expect(progressSegmentWidth(EVENLY_DIVISIBLE_TRACK, ESTIMATED_ROUTE_STEPS, 0)).toBe(30)
    })

    it('charges one fewer gap than there are segments', () => {
      const oneGapPerSegment = (TRACK_393 - SEGMENT_GAP * ESTIMATED_ROUTE_STEPS) / ESTIMATED_ROUTE_STEPS

      expect(progressSegmentWidth(TRACK_393, ESTIMATED_ROUTE_STEPS, SEGMENT_GAP)).not.toBe(oneGapPerSegment)
      expect(progressSegmentWidth(TRACK_393, ESTIMATED_ROUTE_STEPS, SEGMENT_GAP)).toBe(33)
    })

    it('fills each device track exactly with its segments plus their one-fewer gaps', () => {
      EXACTLY_FILLED_TRACKS.forEach(({trackWidth, total}) => {
        const width = progressSegmentWidth(trackWidth, total, SEGMENT_GAP)

        expect(width * total + SEGMENT_GAP * (total - 1)).toBe(trackWidth)
      })
    })

    it('gives a single segment the whole track regardless of gap', () => {
      expect(progressSegmentWidth(SINGLE_SEGMENT_TRACK, 1, SEGMENT_GAP)).toBe(100)
    })

    it('charges a single segment no gap at all, so a non-zero gap changes nothing', () => {
      const withoutGap = progressSegmentWidth(SINGLE_SEGMENT_TRACK, 1, 0)

      expect(progressSegmentWidth(SINGLE_SEGMENT_TRACK, 1, SEGMENT_GAP)).toBe(withoutGap)
    })
  })

  describe('an unmeasured or empty track', () => {
    it('returns zero rather than a negative or non-finite width', () => {
      UNMEASURABLE_TRACKS.forEach(({trackWidth, total}) => {
        const width = progressSegmentWidth(trackWidth, total, SEGMENT_GAP)

        expect(width).toBe(0)
        expect(width).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(width)).toBe(true)
      })
    })
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
