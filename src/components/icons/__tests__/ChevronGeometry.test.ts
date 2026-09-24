import {Sizes} from '@styles/sizes'

import {
  BACK_AFFORDANCE_SCAFFOLD_SHIFT,
  BACK_CHEVRON,
  BACK_CHEVRON_REFERENCE_SIZE,
  CHEVRON_MITER_RATIO,
  CHEVRON_STROKE_LINECAP,
  CHEVRON_STROKE_LINEJOIN,
  CHEVRON_VIEW_BOX,
  ChevronDirection,
  ChevronSpec,
  ROW_CHEVRON,
  ROW_CHEVRON_REFERENCE_SIZE,
  chevronInkAt,
  chevronInkFor,
  chevronInkOffsetAt,
  chevronInkShiftMargins,
  chevronPathFor,
  chevronSlotCollapse,
  chevronSpecFor
} from '../ChevronGeometry'

// The values Figma reports for the two nodes the chevrons are transcribed from. Everything below is held
// against these rather than against the module's own arithmetic, so a change to the construction that no
// longer reproduces the design fails here instead of shipping.
const FIGMA_BACK = {
  node: '46:153',
  side: 9,
  border: 2,
  referenceSize: Sizes.ICON_XL,
  inkWidth: 7.778175,
  inkHeight: 12.727922,
  inkArea: 32,
  centrelineArm: 8
}

const FIGMA_ROW = {
  node: '47:282',
  side: 8,
  border: 2,
  referenceSize: Sizes.ICON_MD,
  inkWidth: 7.071068,
  inkHeight: 11.313708,
  inkArea: 28,
  centrelineArm: 7
}

// `strokeWidth` and `size` defaults that shipped rows already lay out against. `ChevronRightIcon`'s pair in
// particular is depended on by eight call sites, so the transcription had to restate them rather than move
// them, and that restatement has to stay exact to the bit — 2.4 reached by arithmetic is only safe because
// `2 * (24 / 20)` and the literal are the same double.
const SHIPPED_ROW_STROKE_DEFAULT = 2.4
const SHIPPED_CHEVRON_SIZE_DEFAULT = 14

const SVG_DEFAULT_MITER_LIMIT = 4

// An independent route to the painted extent, deliberately not sharing a line of arithmetic with the module:
// build the border's ink as a polygon in the node's own unrotated coordinates, rotate it, and take its
// bounding box. Figma draws each chevron as a square frame with an INSIDE border on two adjacent edges, so
// that ink is a hexagonal L — here the top-and-right pair, whose mirror is the bottom-and-left pair the back
// chevron uses; the two are congruent, so one derivation covers both extents.
const borderInkPolygon = (side: number, border: number): number[][] => [
  [0, 0],
  [side, 0],
  [side, side],
  [side - border, side],
  [side - border, border],
  [0, border]
]

// 45 degrees clockwise on screen, about the square's centre. The angle is absent from both Figma payloads,
// which is what left the ink extent uncertified when the findings were raised; it is recovered here and the
// four identities that pin it are asserted below.
const rotateClockwise45 = (points: number[][], centre: number): number[][] =>
  points.map(([x, y]) => {
    const dx = x - centre
    const dy = y - centre

    return [centre + (dx - dy) / Math.SQRT2, centre + (dx + dy) / Math.SQRT2]
  })

const boundingBox = (points: number[][]) => {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)

  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  }
}

// Shoelace, so the polygon's area can be checked against Figma's reported ink area as well as its extent —
// two shapes can share a bounding box and paint different amounts of it.
const polygonArea = (points: number[][]): number => {
  const doubled = points.reduce((total, [x, y], index) => {
    const [nextX, nextY] = points[(index + 1) % points.length]

    return total + (x * nextY - nextX * y)
  }, 0)

  return Math.abs(doubled) / 2
}

const PATH_NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g

const pathPoints = (path: string): number[][] => {
  const numbers = (path.match(PATH_NUMBER_PATTERN) ?? []).map(Number)

  if (numbers.length !== 6) {
    throw new Error(`Expected a three-point chevron path, parsed ${numbers.length / 2} points from "${path}"`)
  }

  return [
    [numbers[0], numbers[1]],
    [numbers[2], numbers[3]],
    [numbers[4], numbers[5]]
  ]
}

/**
 * The extent a stroked chevron centreline actually paints, derived from the path's own coordinates.
 *
 * Butt caps stop each arm square to its own direction, which on a 45 degree arm pushes the outer corner half
 * a stroke-width diagonally — `(t / 2) / sqrt(2)` on each axis. The mitre runs the two outer edges together
 * to a point, overhanging the apex by `(t / 2) * sqrt(2)`. Round terminals, which both glyphs shipped with,
 * replace the first with a half-disc and the second with an arc, and that is the whole of the defect the
 * findings measured.
 */
const strokedInk = (path: string, stroke: number) => {
  const [firstArm, apex, secondArm] = pathPoints(path)
  const halfStroke = stroke / 2
  const capOverhang = halfStroke / Math.SQRT2
  const apexOverhang = halfStroke * Math.SQRT2

  const pointsRight = apex[0] > firstArm[0]
  const behind = pointsRight ? firstArm[0] - capOverhang : firstArm[0] + capOverhang
  const ahead = pointsRight ? apex[0] + apexOverhang : apex[0] - apexOverhang

  return {
    width: Math.abs(ahead - behind),
    height: secondArm[1] - firstArm[1] + 2 * capOverhang,
    centreX: (ahead + behind) / 2,
    centreY: apex[1]
  }
}

const VIEW_BOX_EXTENT = 24

const inkInViewBox = (spec: ChevronSpec, direction: ChevronDirection) =>
  strokedInk(chevronPathFor(direction, spec), spec.stroke)

describe('the chevrons are transcribed from the Figma nodes the AAP assigns them', () => {
  it('draws both glyphs in the 24-unit canvas every icon in the folder uses', () => {
    expect(CHEVRON_VIEW_BOX).toBe(`0 0 ${VIEW_BOX_EXTENT} ${VIEW_BOX_EXTENT}`)
  })

  it.each([
    ['back chevron', FIGMA_BACK, BACK_CHEVRON],
    ['row chevron', FIGMA_ROW, ROW_CHEVRON]
  ])('restates %s node %s: the square side and border, scaled to the canvas', (_name, figma, spec) => {
    const unitsPerPixel = VIEW_BOX_EXTENT / figma.referenceSize

    expect(spec.side).toBeCloseTo(figma.side * unitsPerPixel, 10)
    expect(spec.stroke).toBeCloseTo(figma.border * unitsPerPixel, 10)
  })

  it.each([
    ['back chevron', FIGMA_BACK, BACK_CHEVRON],
    ['row chevron', FIGMA_ROW, ROW_CHEVRON]
  ])('derives %s centreline arm from the INSIDE border, which insets it half a stroke', (_name, figma, spec) => {
    const renderedArm = spec.arm * (figma.referenceSize / VIEW_BOX_EXTENT)

    expect(renderedArm).toBeCloseTo(figma.centrelineArm, 9)
  })
})

describe('the painted extent, re-derived from the rotated border polygon', () => {
  // This is the certification the findings could not reach: the rotation angle is missing from both Figma
  // payloads, so the extent was reported as indeterminate. Four independent identities recover it, and each
  // one is asserted rather than asserted-of.
  it.each([
    ['back chevron', FIGMA_BACK],
    ['row chevron', FIGMA_ROW]
  ])("identity 1: %s bounding box is the square's diagonal, which only 45 degrees produces", (_name, figma) => {
    const rotated = rotateClockwise45(borderInkPolygon(figma.side, figma.border), figma.side / 2)

    expect(boundingBox(rotated).height).toBeCloseTo(figma.side * Math.SQRT2, 9)
  })

  it('identity 2: the rotated box is offset from the unrotated one by (side - side * sqrt(2)) / 2', () => {
    const offset = (FIGMA_ROW.side - FIGMA_ROW.side * Math.SQRT2) / 2

    // Figma reports -1.66 for `47:282`'s position relative to its wrapper, which is this number rounded.
    expect(offset).toBeCloseTo(-1.66, 2)
  })

  it('identity 3: the painted edges are adjacent, so the rotation carries their shared corner to the apex', () => {
    const centre = FIGMA_ROW.side / 2
    const sharedCorner = [FIGMA_ROW.side, 0]
    const [[apexX, apexY]] = rotateClockwise45([sharedCorner], centre)
    const rotated = rotateClockwise45(borderInkPolygon(FIGMA_ROW.side, FIGMA_ROW.border), centre)

    // Clockwise puts the corner on the box's horizontal centre line at its right edge — a chevron pointing
    // right. Anticlockwise would put it on the vertical centre line, pointing the glyph up instead.
    expect(apexY).toBeCloseTo(centre, 9)
    expect(apexX).toBeCloseTo(boundingBox(rotated).maxX, 9)
  })

  it.each([
    ['back chevron', FIGMA_BACK],
    ['row chevron', FIGMA_ROW]
  ])('identity 4: %s ink area is unchanged by the rotation and matches Figma', (_name, figma) => {
    const polygon = borderInkPolygon(figma.side, figma.border)
    const rotated = rotateClockwise45(polygon, figma.side / 2)

    expect(polygonArea(polygon)).toBeCloseTo(figma.inkArea, 9)
    expect(polygonArea(rotated)).toBeCloseTo(figma.inkArea, 9)
  })

  it.each([
    ['back chevron', FIGMA_BACK],
    ['row chevron', FIGMA_ROW]
  ])('%s: the module agrees with the polygon derivation and with Figma', (_name, figma) => {
    const rotated = boundingBox(rotateClockwise45(borderInkPolygon(figma.side, figma.border), figma.side / 2))
    const declared = chevronInkFor(chevronSpecFor(figma.side, figma.border, figma.referenceSize))
    const unitsPerPixel = VIEW_BOX_EXTENT / figma.referenceSize

    expect(rotated.width).toBeCloseTo(figma.inkWidth, 5)
    expect(rotated.height).toBeCloseTo(figma.inkHeight, 5)
    expect(declared.width / unitsPerPixel).toBeCloseTo(rotated.width, 9)
    expect(declared.height / unitsPerPixel).toBeCloseTo(rotated.height, 9)
  })
})

describe('the shipped paths paint that extent at the sizes their consumers ask for', () => {
  it('back chevron paints 7.7782 x 12.7279 at Sizes.ICON_XL, the size BackCircleButton renders', () => {
    const rendered = chevronInkAt(BACK_CHEVRON, FIGMA_BACK.referenceSize)

    expect(rendered.width).toBeCloseTo(FIGMA_BACK.inkWidth, 5)
    expect(rendered.height).toBeCloseTo(FIGMA_BACK.inkHeight, 5)
  })

  it('row chevron paints 7.0711 x 11.3137 at Sizes.ICON_MD, the size the search field renders', () => {
    const rendered = chevronInkAt(ROW_CHEVRON, FIGMA_ROW.referenceSize)

    expect(rendered.width).toBeCloseTo(FIGMA_ROW.inkWidth, 5)
    expect(rendered.height).toBeCloseTo(FIGMA_ROW.inkHeight, 5)
  })

  it.each([
    ['back chevron', 'left' as ChevronDirection, FIGMA_BACK, BACK_CHEVRON],
    ['row chevron', 'right' as ChevronDirection, FIGMA_ROW, ROW_CHEVRON]
  ])("%s's own path coordinates stroke out to the same extent", (_name, direction, figma, spec) => {
    const ink = inkInViewBox(spec, direction)
    const unitsPerPixel = VIEW_BOX_EXTENT / figma.referenceSize

    expect(ink.width / unitsPerPixel).toBeCloseTo(figma.inkWidth, 3)
    expect(ink.height / unitsPerPixel).toBeCloseTo(figma.inkHeight, 3)
  })

  it.each([
    ['back chevron', 'left' as ChevronDirection, BACK_CHEVRON],
    ['row chevron', 'right' as ChevronDirection, ROW_CHEVRON]
  ])('%s centres its ink, not its centreline, in the canvas', (_name, direction, spec) => {
    const ink = inkInViewBox(spec, direction)
    const centre = VIEW_BOX_EXTENT / 2

    expect(ink.centreX).toBeCloseTo(centre, 3)
    expect(ink.centreY).toBeCloseTo(centre, 3)
  })

  it('emits the two transcribed paths', () => {
    expect(chevronPathFor('left', BACK_CHEVRON)).toBe('M15.182 6.3431L9.5251 12L15.182 17.6569')
    expect(chevronPathFor('right', ROW_CHEVRON)).toBe('M8.6059 6.0603L14.5456 12L8.6059 17.9397')
  })
})

describe('terminals', () => {
  it('cuts the arms square and points the apex, because a per-side frame border has no caps to round', () => {
    expect(CHEVRON_STROKE_LINECAP).toBe('butt')
    expect(CHEVRON_STROKE_LINEJOIN).toBe('miter')
  })

  it('keeps the mitre well inside the SVG default limit, so the join can never fall back to a bevel', () => {
    expect(CHEVRON_MITER_RATIO).toBeCloseTo(Math.SQRT2, 9)
    expect(CHEVRON_MITER_RATIO).toBeLessThan(SVG_DEFAULT_MITER_LIMIT)
  })

  it.each([
    ['back chevron', 'left' as ChevronDirection, FIGMA_BACK, BACK_CHEVRON],
    ['row chevron', 'right' as ChevronDirection, FIGMA_ROW, ROW_CHEVRON]
  ])('%s: round terminals paint taller than Figma, the defect reported', (_name, direction, figma, spec) => {
    const [firstArm, , secondArm] = pathPoints(chevronPathFor(direction, spec))
    const unitsPerPixel = VIEW_BOX_EXTENT / figma.referenceSize

    // A round cap is a half-disc of radius `stroke / 2` on the arm's axis, so it reaches further than the
    // butt cap's diagonal corner by exactly the difference below.
    const roundCapHeight = secondArm[1] - firstArm[1] + spec.stroke
    const buttCapHeight = inkInViewBox(spec, direction).height

    expect(roundCapHeight).toBeGreaterThan(buttCapHeight)
    expect(roundCapHeight / unitsPerPixel).toBeGreaterThan(figma.inkHeight)
  })
})

describe('the two glyphs are not mirror images, so one path cannot serve both', () => {
  it('gives the back chevron an arm four times its stroke and the row chevron three and a half', () => {
    expect(BACK_CHEVRON.arm / BACK_CHEVRON.stroke).toBeCloseTo(4, 9)
    expect(ROW_CHEVRON.arm / ROW_CHEVRON.stroke).toBeCloseTo(3.5, 9)
  })

  it('cannot be reconciled by scaling, because scaling moves arm and stroke together', () => {
    const backRatio = BACK_CHEVRON.arm / BACK_CHEVRON.stroke
    const rowRatio = ROW_CHEVRON.arm / ROW_CHEVRON.stroke

    expect(backRatio).not.toBeCloseTo(rowRatio, 2)
  })

  it('rejects the stock 1:2 chevron both glyphs shipped with, whose arm is 4.24 strokes', () => {
    // `M15 6l-6 6 6 6` on a 24-unit canvas at stroke 2: arms of 6 * sqrt(2) units.
    const stockArmToStroke = (6 * Math.SQRT2) / 2

    expect(stockArmToStroke).not.toBeCloseTo(BACK_CHEVRON.arm / BACK_CHEVRON.stroke, 2)
    expect(stockArmToStroke).not.toBeCloseTo(ROW_CHEVRON.arm / ROW_CHEVRON.stroke, 2)
  })
})

describe('defaults the shipped rows lay out against', () => {
  it('reaches the row chevron stroke default by arithmetic that is the same double as the literal', () => {
    expect(ROW_CHEVRON.stroke).toBe(SHIPPED_ROW_STROKE_DEFAULT)
  })

  it('renders that default as a 2px stroke at the size the search field asks for', () => {
    const renderedStroke = ROW_CHEVRON.stroke * (Sizes.ICON_MD / VIEW_BOX_EXTENT)

    expect(renderedStroke).toBeCloseTo(FIGMA_ROW.border, 9)
  })

  it('renders the back chevron default as a 2px stroke at the size the back button asks for', () => {
    const renderedStroke = BACK_CHEVRON.stroke * (Sizes.ICON_XL / VIEW_BOX_EXTENT)

    expect(renderedStroke).toBeCloseTo(FIGMA_BACK.border, 9)
  })

  it('keeps the size default both glyphs share', () => {
    expect(Sizes.ICON_CHEVRON).toBe(SHIPPED_CHEVRON_SIZE_DEFAULT)
  })
})

// The one way a correct glyph can still ship wrong, and the reason the reference sizes are exported rather
// than written out at each call site: the canvas is 24 units wide for every icon in the folder, so the ink
// equals its node at one size only. Both plausible near misses are pinned — the icons' own 14px default, and
// the 20px that a 40px circle invites.
describe('the render size Figma parity depends on', () => {
  it.each([
    ['back chevron', FIGMA_BACK, BACK_CHEVRON, BACK_CHEVRON_REFERENCE_SIZE],
    ['row chevron', FIGMA_ROW, ROW_CHEVRON, ROW_CHEVRON_REFERENCE_SIZE]
  ])('reproduces the %s node at its reference size and at no other', (_glyph, figma, spec, referenceSize) => {
    expect(referenceSize).toBe(figma.referenceSize)
    expect(chevronInkAt(spec, referenceSize).width).toBeCloseTo(figma.inkWidth, 5)
    expect(chevronInkAt(spec, Sizes.ICON_CHEVRON).width).not.toBeCloseTo(figma.inkWidth, 2)
  })

  // Held against the ink the glyph paints at parity rather than against Figma's own figure, which is
  // transcribed to six decimals and so cannot carry a ratio to nine.
  it.each([
    ['the size the icons themselves default to', Sizes.ICON_CHEVRON, 5 / 12],
    ['the 20px its 40px circle invites', Sizes.ICON_MD, 1 / 6]
  ])('would paint the back chevron short of its node at %s', (_size, renderedAt, expectedShortfall) => {
    const parityInk = chevronInkAt(BACK_CHEVRON, BACK_CHEVRON_REFERENCE_SIZE).width
    const shortfall = 1 - chevronInkAt(BACK_CHEVRON, renderedAt).width / parityInk

    expect(shortfall).toBeCloseTo(1 - renderedAt / BACK_CHEVRON_REFERENCE_SIZE, 12)
    expect(shortfall).toBeCloseTo(expectedShortfall, 12)
    expect(parityInk).toBeCloseTo(FIGMA_BACK.inkWidth, 5)
  })
})

// Where Figma puts the ink inside the box it lays out, as against how much ink there is. The extents above
// were already exact while the placement was not: both glyphs centred their ink, and Figma centres the
// rotated frame instead, which is a different point because only two of that frame's four edges paint.
describe('the offset Figma gives the ink inside its layout box', () => {
  // Independent of the module: rotate the square itself for the layout box, rotate the border's ink for the
  // ink box, and compare their centres. Shares no arithmetic with `chevronInkOffsetAt`.
  const measuredOffset = (side: number, border: number) => {
    const centre = side / 2
    const square = [
      [0, 0],
      [side, 0],
      [side, side],
      [0, side]
    ]
    const layoutBox = boundingBox(rotateClockwise45(square, centre))
    const inkBox = boundingBox(rotateClockwise45(borderInkPolygon(side, border), centre))

    return (inkBox.minX + inkBox.maxX) / 2 - (layoutBox.minX + layoutBox.maxX) / 2
  }

  it.each([
    ['back', FIGMA_BACK, BACK_CHEVRON, 'left' as ChevronDirection, -1],
    ['row', FIGMA_ROW, ROW_CHEVRON, 'right' as ChevronDirection, 1]
  ])('places the %s chevron ink off the centre of its box, towards the apex', (_name, figma, spec, direction, sign) => {
    const magnitude = measuredOffset(figma.side, figma.border)

    expect(magnitude).toBeGreaterThan(0)
    expect(chevronInkOffsetAt(direction, spec, figma.referenceSize)).toBeCloseTo(sign * magnitude, 9)
  })

  it('leaves the row chevron ink right of its slot centre by the distance Figma paints it', () => {
    expect(chevronInkOffsetAt('right', ROW_CHEVRON, Sizes.ICON_MD)).toBeCloseTo(2.121320343559643, 9)
  })

  // The back affordance has a wrapper between circle and glyph, so its net offset is the glyph's own plus
  // that wrapper's contribution, and the two partly cancel.
  it('lands the back chevron ink left of its circle centre once the wrapper is counted', () => {
    const glyph = chevronInkOffsetAt('left', BACK_CHEVRON, Sizes.ICON_XL)

    expect(glyph).toBeCloseTo(-2.474873734152916, 9)
    expect(BACK_AFFORDANCE_SCAFFOLD_SHIFT + glyph).toBeCloseTo(-0.974873734152916, 9)
  })

  it('is a real offset rather than a rounding artefact, at every shipping pixel density', () => {
    const net = BACK_AFFORDANCE_SCAFFOLD_SHIFT + chevronInkOffsetAt('left', BACK_CHEVRON, Sizes.ICON_XL)

    // Half a stroke width, and a whole device pixel or more everywhere it ships.
    expect(Math.abs(net) / BACK_CHEVRON.stroke).toBeGreaterThan(0.48)
    expect(Math.abs(net) * 2).toBeGreaterThan(1)
  })
})

describe('the collapse that brings a canvas down to the slot its row reserves', () => {
  it('is half the difference, per side, so the two sides remove the whole of it', () => {
    const collapse = chevronSlotCollapse(ROW_CHEVRON_REFERENCE_SIZE, Sizes.CHEVRON_SLOT)

    expect(2 * collapse).toBeCloseTo(Sizes.CHEVRON_SLOT - ROW_CHEVRON_REFERENCE_SIZE, 9)
    expect(ROW_CHEVRON_REFERENCE_SIZE + 2 * collapse).toBe(Sizes.CHEVRON_SLOT)
  })

  it('is the negative margin the search field row lays its chevron out with', () => {
    expect(chevronSlotCollapse(ROW_CHEVRON_REFERENCE_SIZE, Sizes.CHEVRON_SLOT)).toBe(-6)
  })

  // Zero to nine places rather than exactly 0: negating a zero difference yields -0, which is the same margin
  // to Yoga and to every consumer, and pinning the sign here would assert nothing about the geometry.
  it('collapses nothing when the canvas already measures its slot', () => {
    expect(chevronSlotCollapse(Sizes.CHEVRON_SLOT, Sizes.CHEVRON_SLOT)).toBeCloseTo(0, 9)
  })

  // A canvas smaller than its slot would need positive margins to fill it, which is not what this models: the
  // caller states the slot it reserves, and a reserve larger than the artwork is expressed by the slot alone.
  it('never reports a positive margin for a canvas at least as large as its slot', () => {
    ;[
      [ROW_CHEVRON_REFERENCE_SIZE, Sizes.CHEVRON_SLOT],
      [BACK_CHEVRON_REFERENCE_SIZE, Sizes.CHEVRON_SLOT],
      [Sizes.CHEVRON_SLOT, Sizes.CHEVRON_SLOT]
    ].forEach(([referenceSize, slot]) => {
      expect(chevronSlotCollapse(referenceSize, slot)).toBeLessThanOrEqual(0)
    })
  })
})

describe('the margins that apply that offset without moving the row around it', () => {
  // Yoga lays out the margin box, so the canvas sits at `advanceLeft + marginLeft` and the ink, centred in
  // the canvas, ends up this far from the advance's own centre.
  const inkOffsetWithinAdvance = (canvas: number, marginLeft: number, marginRight: number) =>
    canvas / 2 + marginLeft - (canvas + marginLeft + marginRight) / 2

  it.each([
    ['the back affordance, whose canvas is laid out as-is', Sizes.ICON_XL, 0, -0.974873734152916],
    ['the search field, whose canvas is collapsed to its slot', Sizes.ICON_MD, -6, 2.121320343559643]
  ])('shifts the ink of %s by exactly the offset asked for', (_name, canvas, collapse, shift) => {
    const {marginLeft, marginRight} = chevronInkShiftMargins(collapse, shift)

    expect(inkOffsetWithinAdvance(canvas, marginLeft, marginRight)).toBeCloseTo(shift, 9)
  })

  it.each([
    ['as-is', Sizes.ICON_XL, 0, -0.974873734152916],
    ['collapsed', Sizes.ICON_MD, -6, 2.121320343559643]
  ])('leaves the space the %s canvas occupies unchanged', (_name, canvas, collapse, shift) => {
    const {marginLeft, marginRight} = chevronInkShiftMargins(collapse, shift)

    expect(marginLeft + marginRight).toBeCloseTo(2 * collapse, 9)
    expect(canvas + marginLeft + marginRight).toBeCloseTo(canvas + 2 * collapse, 9)
  })

  it('reduces to symmetric margins when nothing is being shifted', () => {
    expect(chevronInkShiftMargins(-6, 0)).toEqual({marginLeft: -6, marginRight: -6})
  })
})
