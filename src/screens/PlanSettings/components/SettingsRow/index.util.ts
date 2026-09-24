import {Stroke} from '@styles/sizes'

/** The two arguments `ChevronRightIcon` takes: a square canvas in points, and a stroke in viewBox units. */
export interface RowChevronGeometry {
  readonly size: number
  readonly strokeWidth: number
}

/** What a `RowChevronGeometry` puts on screen, in points, so the comparison with Figma is direct. */
export interface PaintedRowChevron {
  readonly width: number
  readonly height: number
  readonly strokeWidth: number
}

// `ChevronRightIcon` draws `M9 6l6 6-6 6` on a 24-unit viewBox, so its ink spans x 9→15 and y 6→18 and both
// the path and the stroke scale by size / 24. These are the shipped glyph's transcribed dimensions rather
// than design values, and they move only if that path does.
const GLYPH_CANVAS_UNITS: number = 24
const GLYPH_PATH_WIDTH_UNITS: number = 6
const GLYPH_PATH_HEIGHT_UNITS: number = 12

// Figma 38:412 — the chevron all seven settings rows share — paints 5.66 x 11.31 at a 2 px stroke. It is the
// construction `AlternativeRow` records for 36:70, a 45°-rotated frame the width of the row's chevron slot
// carrying 2 px inside borders, so its ink is that frame's diagonal (8 x √2 = 11.31) tall and half of it
// wide. The exact 1:2 aspect is the path's own 6:12, which is what identifies the measurement as the path's
// bounding box and not the wider box the round caps add.
const FIGMA_PATH_HEIGHT: number = 11.31

/**
 * The arguments frame 38:412 reconciles to. The height is the binding measurement, because the path's 12 of
 * 24 units scale with the canvas; the stroke is then expressed in those same viewBox units, so `Stroke.BOLD`
 * has to be scaled up by exactly the factor the canvas shrinks the glyph by. Passing `Stroke.BOLD` straight
 * through would paint 1.89 px, and leaving `size` off falls back to the glyph's own 14 and paints 3.5 x 7.0.
 */
export const rowChevronGeometry = (): RowChevronGeometry => {
  const size = (FIGMA_PATH_HEIGHT * GLYPH_CANVAS_UNITS) / GLYPH_PATH_HEIGHT_UNITS

  return {size, strokeWidth: (Stroke.BOLD * GLYPH_CANVAS_UNITS) / size}
}

/**
 * The ink a geometry renders: the path's bounding box and the stroke that draws it, both in points. Its one
 * consumer is the suite that pins 38:412 — the derivation above is only correct to the extent that what it
 * puts on screen matches the export, and that is the assertion this makes readable.
 */
export const paintedRowChevron = (geometry: RowChevronGeometry): PaintedRowChevron => {
  const scale = geometry.size / GLYPH_CANVAS_UNITS

  return {
    width: GLYPH_PATH_WIDTH_UNITS * scale,
    height: GLYPH_PATH_HEIGHT_UNITS * scale,
    strokeWidth: geometry.strokeWidth * scale
  }
}
