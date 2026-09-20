import {Sizes, Stroke} from '@styles/sizes'

import {paintedRowChevron, rowChevronGeometry} from '../index.util'

// The export of Figma 38:412, the chevron all seven settings rows share: 5.66 x 11.31 of path at a 2 px
// stroke. These three numbers are the whole specification this suite exists to hold.
const FIGMA_PATH_WIDTH: number = 5.66
const FIGMA_PATH_HEIGHT: number = 11.31
const FIGMA_STROKE: number = Stroke.BOLD

// The checkpoint's PASS bar is 1 px. This suite holds two orders of magnitude tighter, so it catches the
// drift that made the bar fail long before the bar does.
const TOLERANCE: number = 0.01

// The canvas that path height resolves to on the glyph's 24-unit viewBox, and the value shipped at the call
// site. Named here so a change to the derivation has to restate the number it lands on.
const RECONCILED_CANVAS: number = 22.62

// What the row painted while the call site passed no `size`: `ChevronRightIcon`'s own 14 default, the value
// `Sizes.ICON_CHEVRON` carries. Kept here so the defect itself is pinned, not only its fix.
const UNSIZED_GLYPH: number = Sizes.ICON_CHEVRON

const expectWithinTolerance = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE)
}

describe('rowChevronGeometry', () => {
  it('resolves the canvas 38:412’s path height needs', () => {
    expect(rowChevronGeometry().size).toBeCloseTo(RECONCILED_CANVAS, 5)
  })

  it('scales the bold stroke into viewBox units rather than passing it through', () => {
    expect(rowChevronGeometry().strokeWidth).toBeGreaterThan(Stroke.BOLD)
  })

  it('is deterministic, so every one of the seven rows asks for the same glyph', () => {
    expect(rowChevronGeometry()).toEqual(rowChevronGeometry())
  })

  it('needs a slot, because the canvas is wider than the 8 pt advance the row reconciles', () => {
    expect(rowChevronGeometry().size).toBeGreaterThan(Sizes.CHEVRON_SLOT)
  })
})

describe('paintedRowChevron', () => {
  it('paints 38:412’s path height', () => {
    expectWithinTolerance(paintedRowChevron(rowChevronGeometry()).height, FIGMA_PATH_HEIGHT)
  })

  it('paints 38:412’s path width', () => {
    expectWithinTolerance(paintedRowChevron(rowChevronGeometry()).width, FIGMA_PATH_WIDTH)
  })

  it('renders 38:412’s 2 px stroke', () => {
    expectWithinTolerance(paintedRowChevron(rowChevronGeometry()).strokeWidth, FIGMA_STROKE)
  })

  it('misses 38:412 on the height and the stroke when the call site passes no size', () => {
    const painted = paintedRowChevron({size: UNSIZED_GLYPH, strokeWidth: Stroke.BOLD})

    expect(Math.abs(painted.height - FIGMA_PATH_HEIGHT)).toBeGreaterThan(TOLERANCE)
    expect(Math.abs(painted.width - FIGMA_PATH_WIDTH)).toBeGreaterThan(TOLERANCE)
    expect(Math.abs(painted.strokeWidth - FIGMA_STROKE)).toBeGreaterThan(TOLERANCE)
  })

  it('holds the glyph’s 1:2 path aspect on any canvas', () => {
    const painted = paintedRowChevron({size: Sizes.ICON_XL, strokeWidth: Stroke.BOLD})

    expect(painted.height).toBeCloseTo(painted.width * 2, 5)
    expect(painted.strokeWidth).toBeCloseTo(Stroke.BOLD, 5)
  })

  it('paints nothing on a zero canvas', () => {
    expect(paintedRowChevron({size: 0, strokeWidth: Stroke.BOLD})).toEqual({width: 0, height: 0, strokeWidth: 0})
  })
})
