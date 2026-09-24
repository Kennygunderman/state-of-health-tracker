import {Sizes} from '@styles/sizes'

// The shared construction behind `ChevronLeftIcon` and `ChevronRightIcon`, transcribed from the Figma nodes
// the AAP assigns them (0.2.4): the back chevron from `46:153` and the row chevron from `47:282`, whose
// export is byte-identical to the row chevrons at `34:108`, `34:119` and `38:412`, so one glyph serves all
// four.
//
// Neither node is a stroked path in Figma. Each is a square FRAME rotated 45 degrees clockwise, carrying an
// INSIDE border on exactly the two adjacent edges that meet at the corner the rotation carries to the apex —
// `strokeWeight: "0px 0px 2px 2px"` (bottom + left) for the back chevron, `"2px 2px 0px 0px"` (top + right)
// for the row chevron. `strokeAlign`, `strokeCap` and `strokeJoin` are all absent from the payload: Inside is
// the only alignment Figma permits with per-side weights, and a per-side frame border has no caps or joins to
// declare — its limbs are cut perpendicular to their own direction and its corner is a sharp point. Rendered
// as a stroked polyline those are BUTT caps and a MITRE join, which is why this module pins them and why the
// round cap and join both glyphs shipped with are wrong rather than stylistic.
//
// The rotation angle is absent too, but it is uniquely determined, five ways over: a square of side `s`
// acquires an `s * sqrt(2)` axis-aligned bounding box only at 45 degrees, and both nodes report exactly that
// (12.73 = 9*sqrt(2), 11.31 = 8*sqrt(2)); the reported `locationRelativeToParent` of -1.66 matches the
// identity `(s - s*sqrt(2)) / 2` for `s = 8`; the painted edges are adjacent, which fixes the direction as
// clockwise (counter-clockwise would point the row chevron's apex up, not right); each node's own mask is the
// rotated diamond; and a render of the export agrees with the derivation below on area and centroid to within
// 0.006px. That chain is what makes the painted extent certifiable rather than indeterminate, and
// `__tests__/ChevronGeometry.test.ts` re-derives every step of it.

// Every glyph in this folder draws in a 24-unit square canvas so that a consumer's `size` prop scales the
// artwork uniformly. This is the artwork's own coordinate space rather than a rendered dimension, so it is a
// property of the transcription and not a design token.
const VIEW_BOX_EXTENT = 24

export const CHEVRON_VIEW_BOX = `0 0 ${VIEW_BOX_EXTENT} ${VIEW_BOX_EXTENT}`

// A per-side frame border, expressed as a stroked polyline.
export const CHEVRON_STROKE_LINECAP = 'butt' as const

export const CHEVRON_STROKE_LINEJOIN = 'miter' as const

// The mitre at the apex extends past it by `stroke / sqrt(2)`, a ratio of 1.414 that sits far below the SVG
// default miter limit of 4, so the join can never silently fall back to a bevel and no limit is declared.
export const CHEVRON_MITER_RATIO = Math.SQRT2

export interface ChevronSpec {
  /** Figma's pre-rotation square side, in viewBox units. */
  side: number
  /** The border thickness, in viewBox units. Also the glyph's authored `strokeWidth` default. */
  stroke: number
  /** The centreline arm length, in viewBox units. Derived: an INSIDE border insets the centreline by half the stroke. */
  arm: number
}

export interface ChevronInk {
  width: number
  height: number
}

/**
 * Restates a Figma node's square side and border thickness in viewBox units.
 *
 * `referenceSize` is the rendered size at which the glyph reproduces its node one-to-one — the size its
 * heaviest consumer asks for. Authoring against it is what lets the node's pixel figures be transcribed
 * literally while the canvas stays 24 units wide for every glyph in the folder.
 */
export const chevronSpecFor = (figmaSide: number, figmaStroke: number, referenceSize: number): ChevronSpec => {
  const unitsPerPixel = VIEW_BOX_EXTENT / referenceSize
  const side = figmaSide * unitsPerPixel
  const stroke = figmaStroke * unitsPerPixel

  return {side, stroke, arm: side - stroke / 2}
}

/**
 * The extent of the ink a spec actually paints, in viewBox units.
 *
 * Rotating the border's L-shaped ink polygon by 45 degrees turns its two limbs into the diagonals of the
 * bounding box: the height becomes the square's diagonal, and the width becomes the diagonal of the square
 * grown by one border thickness. Both follow from the polygon alone, so this is the statement of the glyph's
 * painted size that a test can hold the rendered artwork to.
 */
export const chevronInkFor = ({side, stroke}: ChevronSpec): ChevronInk => ({
  width: (side + stroke) / Math.SQRT2,
  height: side * Math.SQRT2
})

/** The same ink, in the pixels a consumer sees when it renders the glyph at `size`. */
export const chevronInkAt = (spec: ChevronSpec, size: number): ChevronInk => {
  const scale = size / VIEW_BOX_EXTENT
  const ink = chevronInkFor(spec)

  return {width: ink.width * scale, height: ink.height * scale}
}

export type ChevronDirection = 'left' | 'right'

// Four decimals hold every coordinate below to under a ten-thousandth of a viewBox unit, which is three
// orders of magnitude finer than a device pixel at the largest size either glyph is rendered at.
const COORDINATE_PRECISION = 4

const coordinate = (value: number): string => Number(value.toFixed(COORDINATE_PRECISION)).toString()

/**
 * The centreline of a chevron, as an SVG path, with its painted ink centred in the canvas.
 *
 * Centring the ink rather than the centreline matters because the two are not the same point: the mitre
 * overhangs the apex by `stroke / sqrt(2)` while the butt caps overhang the far end of each arm by half that,
 * so the ink reaches further behind the apex than in front of it.
 *
 * Figma offsets the ink again, and that offset is applied by the call sites rather than baked in here — see
 * `chevronInkOffsetAt`. Keeping the artwork ink-centred is what lets one glyph serve call sites whose slots
 * are built differently: a screen that centres the canvas still gets a centred glyph.
 */
export const chevronPathFor = (direction: ChevronDirection, {arm, stroke}: ChevronSpec): string => {
  const centre = VIEW_BOX_EXTENT / 2
  const halfStroke = stroke / 2

  // A 45 degree arm advances equally along both axes, so one arm's run is its length over sqrt(2).
  const run = arm / Math.SQRT2
  const apexOverhang = halfStroke * Math.SQRT2
  const capOverhang = halfStroke / Math.SQRT2
  const apexOffset = (run + capOverhang - apexOverhang) / 2

  const towardsApex = direction === 'right' ? 1 : -1
  const apexX = centre + towardsApex * apexOffset
  const armX = apexX - towardsApex * run

  return [
    `M${coordinate(armX)} ${coordinate(centre - run)}`,
    `L${coordinate(apexX)} ${coordinate(centre)}`,
    `L${coordinate(armX)} ${coordinate(centre + run)}`
  ].join('')
}

/**
 * The size a consumer must render each glyph at for its ink to equal its Figma node. Parity holds at this
 * size alone: the canvas is 24 units wide for every glyph in the folder, so any other size scales the ink
 * away from the node's figures — `Sizes.ICON_CHEVRON`, the icons' own default, paints the back chevron 42%
 * short, and the 20px an `Sizes.TILE_SM` circle invites would paint it 17% short.
 *
 * Exported so that the size a component renders and the size its stylesheet computes the ink offset against
 * are the same name rather than the same number written twice.
 */
export const BACK_CHEVRON_REFERENCE_SIZE = Sizes.ICON_XL

export const ROW_CHEVRON_REFERENCE_SIZE = Sizes.ICON_MD

/**
 * Figma `46:153`: a 9px square with a 2px inside border, reproduced one-to-one at its reference size, which
 * is what `BackCircleButton` renders the back affordance at. Painted ink there is 7.7782 x 12.7279px.
 */
export const BACK_CHEVRON = chevronSpecFor(9, 2, BACK_CHEVRON_REFERENCE_SIZE)

/**
 * Figma `47:282`: an 8px square with a 2px inside border, reproduced one-to-one at its reference size, which
 * is what the search field renders its trailing chevron at. Painted ink there is 7.0711 x 11.3137px.
 *
 * The 8px square gives this glyph an arm-to-stroke ratio of 3.5 where the back chevron's 9px square gives 4.
 * The two are therefore not mirror images of one another, and no single path can serve both: a chevron whose
 * ratio is wrong cannot be corrected by scaling, because scaling moves the stroke and the arm together.
 */
export const ROW_CHEVRON = chevronSpecFor(8, 2, ROW_CHEVRON_REFERENCE_SIZE)

/**
 * How far Figma's ink sits from the centre of the box it is laid out in, in rendered pixels, positive to the
 * right.
 *
 * Figma draws these glyphs as a square frame carrying a border on two adjacent edges, rotated 45 degrees. The
 * layout box is that square's bounding box, `side * sqrt(2)` across, but only two of the diamond's four edges
 * carry paint, so the ink fills the apex half of the box and is flush against the apex-side corner. Its centre
 * therefore sits `side * sqrt(2) / 2 - (side + stroke) / (2 * sqrt(2))` from the box centre, towards the apex:
 * 2.4749px for the back chevron's 9px square and 2.1213px for the row chevron's 8px one.
 *
 * Ink-centred artwork has no such offset, so a call site that wants Figma's placement applies this difference
 * itself. `chevronInkShiftMargins` turns it into the margins that do so.
 */
export const chevronInkOffsetAt = (direction: ChevronDirection, spec: ChevronSpec, size: number): number => {
  const {side, stroke} = spec
  const boxHalfExtent = (side * Math.SQRT2) / 2
  const inkHalfWidth = (side + stroke) / (2 * Math.SQRT2)
  const towardsApex = direction === 'right' ? 1 : -1

  return towardsApex * (boxHalfExtent - inkHalfWidth) * (size / VIEW_BOX_EXTENT)
}

/**
 * Figma `47:256` (`46:154` on the goal screen), the wrapper between the back affordance's circle and its
 * chevron: a 12x9 box concentric with the circle, holding the chevron as an absolutely positioned child at
 * x 1.136. That puts the chevron's 12.7279px node box centre at 7.5 against the wrapper's own centre of 6, so
 * the glyph is authored 1.5px right of the circle's centre.
 *
 * The wrapper's 3px left padding is not the source of that 1.5px and must not be modelled: an absolutely
 * positioned child is measured from its parent's frame origin rather than its padded content box, so the
 * padding reaches no content. Honouring it would add a second 1.5px and paint the ink 3px right of Figma. The
 * wrapper is not modelled as a box either, because the glyph overflows it unclipped.
 *
 * With the glyph's own -2.4749px ink offset this lands the ink 0.9749px left of the circle's centre, which is
 * where Figma paints it.
 */
export const BACK_AFFORDANCE_SCAFFOLD_SHIFT = 3 / 2

/**
 * The symmetric margin, per side, that collapses a chevron canvas laid out at `referenceSize` down to the
 * `slot` its row reserves for it — negative, because the canvas is the larger of the two.
 *
 * A row draws its chevron inside a slot smaller than the canvas the glyph needs: the artwork's own frame is
 * the rotated square's bounding box, so a slot-sized wrapper would become a clipping parent and square off
 * the apex. Halving the difference onto each side collapses the layout footprint to the slot while leaving
 * the canvas its natural size, which is what keeps the label's track and the row's height measured from the
 * slot rather than from the artwork.
 *
 * Named here rather than written at the call site so the arithmetic that halves a difference lives with the
 * rest of this glyph's geometry, and so no stylesheet has to carry a bare divisor to express it.
 */
export const chevronSlotCollapse = (referenceSize: number, slot: number): number => -(referenceSize - slot) / 2

/**
 * The margins that shift a chevron's ink by `shift` pixels without changing the space it occupies.
 *
 * `collapse` is the margin already applied on each side to bring the canvas down to its layout slot, or zero
 * where the canvas is laid out as-is. Adding `shift` to one side and subtracting it from the other moves the
 * canvas while leaving the sum, and therefore the advance, untouched.
 */
export const chevronInkShiftMargins = (collapse: number, shift: number): {marginLeft: number; marginRight: number} => ({
  marginLeft: collapse + shift,
  marginRight: collapse - shift
})
