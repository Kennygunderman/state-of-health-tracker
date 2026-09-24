import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'

import CheckboxSquare from '@components/CheckboxSquare'
import OptionCard from '@components/OptionCard'

import CheckIcon, {SELECTION_STROKE, SELECTION_TICK_PATH, SELECTION_VIEW_BOX} from '../CheckIcon'

// No renderer is installed in this repository, so the component is invoked as a plain function and the returned
// element tree is read directly — the same way the glyph's props reach `react-native-svg` at runtime.
interface RenderedTick {
  readonly width: number
  readonly height: number
  readonly viewBox: string
  readonly fill: string
  readonly d: string
  readonly stroke: string
  readonly strokeWidth: number
  readonly strokeLinecap: string
  readonly strokeLinejoin: string
}

const renderTick = (props: Parameters<typeof CheckIcon>[0]): RenderedTick => {
  const svg = CheckIcon(props)
  const path = svg.props.children

  return {
    width: svg.props.width,
    height: svg.props.height,
    viewBox: svg.props.viewBox,
    fill: svg.props.fill,
    d: path.props.d,
    stroke: path.props.stroke,
    strokeWidth: path.props.strokeWidth,
    strokeLinecap: path.props.strokeLinecap,
    strokeLinejoin: path.props.strokeLinejoin
  }
}

interface Point {
  readonly x: number
  readonly y: number
}

interface Bounds {
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

const TICK_COLOR = '#FFFFFF'

// Figma authors every selection tick in scope (`46:172`/`46:173` on the option disc, `37:262`/`37:263` and
// `37:277`/`37:278` on the checkbox) as one asset: an 8.00 x 5.00 frame carrying only a 2 px bottom and left
// border drawn inside, rotated 45 degrees about its own centre, its square 45-degree bounding box sitting 1 px
// above the centre of the 22 px host. Every target below is derived from those five numbers, so the assertions
// constrain the path rather than restate it.
const FRAME_W = 8
const FRAME_H = 5
const FRAME_STROKE = 2
const FRAME_LIFT = 1
const DIAGONAL = Math.SQRT1_2

// A 45-degree rotation projects a length onto both axes at 1/sqrt(2). The painted ink spans the frame's full
// 8 + 5 diagonal across, and 8 + 2 down: the missing top and right borders leave the top corner of the square
// box empty, which is the whole reason the ink is not square while the node box is. The node box — the square
// bounding box of the rotated frame, and the 9.19 x 9.19 a measurement of the node itself reports — therefore
// equals the ink across and exceeds it down by the empty corner's 2.12132.
const INK_WIDTH = (FRAME_W + FRAME_H) * DIAGONAL
const INK_HEIGHT = (FRAME_W + FRAME_STROKE) * DIAGONAL
const NODE_BOX_SIDE = (FRAME_W + FRAME_H) * DIAGONAL
const INK_TOP_INSET = (FRAME_H - FRAME_STROKE) * DIAGONAL
const INK_CENTRE_X = SELECTION_VIEW_BOX / 2
const INK_CENTRE_Y = SELECTION_VIEW_BOX / 2 - FRAME_LIFT + ((FRAME_H - FRAME_STROKE) / 2) * DIAGONAL

// 4 decimal places in the path string can move a derived bound by about 1e-4, so the geometry is pinned to
// 3 places (a 5e-4 window) — over three orders of magnitude tighter than the 1 px bar the findings use.
const GEOMETRY_PRECISION = 3

// Both variants' paths are three-point polylines, but the shipped one uses a relative lineto, so the current
// point is carried rather than assuming every command is absolute.
const parsePolyline = (definition: string): Point[] => {
  const commands = definition.match(/[MLml][^MLml]*/g) ?? []

  return commands.reduce<Point[]>((points, command) => {
    const pair = command
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    const previous = points[points.length - 1]
    const isRelative = command.charAt(0) === command.charAt(0).toLowerCase()
    const origin = isRelative && previous !== undefined ? previous : {x: 0, y: 0}

    return [...points, {x: origin.x + pair[0], y: origin.y + pair[1]}]
  }, [])
}

const unitVector = (from: Point, to: Point): Point => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)

  return {x: dx / length, y: dy / length}
}

const offsetBy = (point: Point, direction: Point, distance: number): Point => ({
  x: point.x + direction.x * distance,
  y: point.y + direction.y * distance
})

// Where the two outer edges meet — the tip a miter join paints and a round or bevel join does not.
const intersect = (pointA: Point, directionA: Point, pointB: Point, directionB: Point): Point => {
  const denominator = directionA.x * directionB.y - directionA.y * directionB.x
  const t = ((pointB.x - pointA.x) * directionB.y - (pointB.y - pointA.y) * directionB.x) / denominator

  return offsetBy(pointA, directionA, t)
}

// A round cap or a round join paints the disc of radius half a stroke around that point, so its bbox
// contribution is the point grown by the half stroke on both axes.
const disc = (centre: Point, radius: number): Point[] => [
  {x: centre.x - radius, y: centre.y - radius},
  {x: centre.x + radius, y: centre.y + radius}
]

/**
 * The bounds of the ink a two-segment centreline actually paints, given the cap and join the component
 * renders. Every cap contributes its segment's stroke rectangle; butt adds nothing beyond it, round adds the
 * end disc. A miter join adds the tip where the two outer edges meet, a round join the vertex disc, and a
 * bevel neither. This is why the assertions read the rendered `strokeLinecap`/`strokeLinejoin` rather than
 * assuming them: the same path under round terminations paints a different box.
 */
const paintedBounds = (points: Point[], strokeWidth: number, linecap: string, linejoin: string): Bounds => {
  const [start, vertex, end] = points
  const half = strokeWidth / 2
  const into = unitVector(start, vertex)
  const outOf = unitVector(vertex, end)
  const leftOf = (direction: Point): Point => ({x: -direction.y, y: direction.x})
  const turnsLeft = into.x * outOf.y - into.y * outOf.x < 0
  const outerSign = turnsLeft ? 1 : -1
  const outerInto = offsetBy({x: 0, y: 0}, leftOf(into), outerSign)
  const outerOutOf = offsetBy({x: 0, y: 0}, leftOf(outOf), outerSign)
  const outerStart = offsetBy(start, outerInto, half)
  const outerEnd = offsetBy(end, outerOutOf, half)
  const corners = [
    outerStart,
    offsetBy(start, outerInto, -half),
    offsetBy(vertex, outerInto, -half),
    offsetBy(vertex, outerOutOf, -half),
    outerEnd,
    offsetBy(end, outerOutOf, -half),
    ...(linejoin === 'miter' ? [intersect(outerStart, into, outerEnd, outOf)] : []),
    ...(linejoin === 'round' ? disc(vertex, half) : []),
    ...(linecap === 'round' ? [...disc(start, half), ...disc(end, half)] : []),
    ...(linecap === 'square'
      ? [
          offsetBy(outerStart, into, -half),
          offsetBy(offsetBy(start, outerInto, -half), into, -half),
          offsetBy(outerEnd, outOf, half),
          offsetBy(offsetBy(end, outerOutOf, -half), outOf, half)
        ]
      : [])
  ]
  const xs = corners.map(corner => corner.x)
  const ys = corners.map(corner => corner.y)

  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys)
  }
}

const inkOf = (tick: RenderedTick): Bounds =>
  paintedBounds(parsePolyline(tick.d), tick.strokeWidth, tick.strokeLinecap, tick.strokeLinejoin)

// The 22 px hosts are walked rather than rendered for the same reason as above, so the tick is located by
// component type wherever either host puts it.
const findTick = (node: unknown): React.ReactElement | undefined => {
  if (!React.isValidElement<{children?: React.ReactNode}>(node)) {
    return undefined
  }

  if (node.type === CheckIcon) {
    return node
  }

  return React.Children.toArray(node.props.children).reduce<React.ReactElement | undefined>(
    (found, child) => found ?? findTick(child),
    undefined
  )
}

const tickPropsOf = (host: React.JSX.Element): Parameters<typeof CheckIcon>[0] | undefined => {
  const element = findTick(host)

  return element === undefined ? undefined : (element.props as Parameters<typeof CheckIcon>[0])
}

const noop = (): void => undefined

describe('CheckIcon selection variant', () => {
  const tick = renderTick({color: TICK_COLOR, variant: 'selection'})

  it('draws the transcribed selection path in its own 22-unit viewBox', () => {
    expect(tick.viewBox).toBe('0 0 22 22')
    expect(tick.d).toBe('M7.1109 10.3536L9.9393 13.182L14.8891 8.2322')
    expect(tick.d).toBe(SELECTION_TICK_PATH)
    expect(tick.fill).toBe('none')
    expect(tick.stroke).toBe(TICK_COLOR)
  })

  it('defaults its canvas to the 22 px host both consumers render it in', () => {
    expect(tick.width).toBe(Sizes.ICON_LG)
    expect(tick.height).toBe(Sizes.ICON_LG)
    expect(tick.width).toBe(22)
    expect(SELECTION_VIEW_BOX).toBe(Sizes.ICON_LG)
  })

  it('defaults its stroke to the Figma-confirmed 2 px, exact on screen at a 1:1 canvas', () => {
    expect(tick.strokeWidth).toBe(Stroke.BOLD)
    expect(tick.strokeWidth).toBe(FRAME_STROKE)
    expect(SELECTION_STROKE).toBe(Stroke.BOLD)
    expect((tick.strokeWidth * tick.width) / SELECTION_VIEW_BOX).toBeCloseTo(2, 5)
  })

  it('terminates with butt caps and a mitred join, as a frame border renders', () => {
    expect(tick.strokeLinecap).toBe('butt')
    expect(tick.strokeLinejoin).toBe('miter')
  })

  it('keeps both limbs at exactly 45 degrees', () => {
    const [start, vertex, end] = parsePolyline(tick.d)
    const first = unitVector(start, vertex)
    const second = unitVector(vertex, end)

    expect((Math.atan2(first.y, first.x) * 180) / Math.PI).toBeCloseTo(45, GEOMETRY_PRECISION)
    expect((Math.atan2(second.y, second.x) * 180) / Math.PI).toBeCloseTo(-45, GEOMETRY_PRECISION)
  })

  it('draws centreline limbs of 4 and 7, so the outer edges are the authored 5 and 8 at a ratio of 1.6', () => {
    const [start, vertex, end] = parsePolyline(tick.d)
    const half = tick.strokeWidth / 2
    const shortLimb = Math.hypot(vertex.x - start.x, vertex.y - start.y)
    const longLimb = Math.hypot(end.x - vertex.x, end.y - vertex.y)

    expect(shortLimb).toBeCloseTo(FRAME_H - half, GEOMETRY_PRECISION)
    expect(longLimb).toBeCloseTo(FRAME_W - half, GEOMETRY_PRECISION)
    expect(shortLimb + half).toBeCloseTo(FRAME_H, GEOMETRY_PRECISION)
    expect(longLimb + half).toBeCloseTo(FRAME_W, GEOMETRY_PRECISION)
    expect((longLimb + half) / (shortLimb + half)).toBeCloseTo(FRAME_W / FRAME_H, GEOMETRY_PRECISION)
  })

  it('paints 9.19239 x 7.07107 of ink, the rotated frame less its empty top corner', () => {
    const bounds = inkOf(tick)

    expect(bounds.right - bounds.left).toBeCloseTo(INK_WIDTH, GEOMETRY_PRECISION)
    expect(bounds.bottom - bounds.top).toBeCloseTo(INK_HEIGHT, GEOMETRY_PRECISION)
    expect(INK_WIDTH).toBeCloseTo(9.19239, 5)
    expect(INK_HEIGHT).toBeCloseTo(7.07107, 5)
    expect(bounds.right - bounds.left).toBeCloseTo(NODE_BOX_SIDE, GEOMETRY_PRECISION)
    expect(bounds.bottom - bounds.top).toBeCloseTo(NODE_BOX_SIDE - INK_TOP_INSET, GEOMETRY_PRECISION)
    expect(INK_TOP_INSET).toBeCloseTo(2.12132, 5)
  })

  it('lands that ink at the authored offsets inside the 22 px host', () => {
    const bounds = inkOf(tick)
    const expectedLeft = (SELECTION_VIEW_BOX - INK_WIDTH) / 2
    const expectedTop = INK_CENTRE_Y - INK_HEIGHT / 2
    const expectedBottom = SELECTION_VIEW_BOX - expectedTop - INK_HEIGHT

    expect(bounds.left).toBeCloseTo(expectedLeft, GEOMETRY_PRECISION)
    expect(SELECTION_VIEW_BOX - bounds.right).toBeCloseTo(expectedLeft, GEOMETRY_PRECISION)
    expect(bounds.top).toBeCloseTo(expectedTop, GEOMETRY_PRECISION)
    expect(SELECTION_VIEW_BOX - bounds.bottom).toBeCloseTo(expectedBottom, GEOMETRY_PRECISION)
    expect(expectedLeft).toBeCloseTo(6.40381, 5)
    expect(expectedTop).toBeCloseTo(7.52513, 5)
    expect(expectedBottom).toBeCloseTo(7.40381, 5)
  })

  it('centres that ink horizontally and sits it the authored 0.06 px below centre', () => {
    const bounds = inkOf(tick)

    expect((bounds.left + bounds.right) / 2).toBeCloseTo(INK_CENTRE_X, GEOMETRY_PRECISION)
    expect((bounds.top + bounds.bottom) / 2).toBeCloseTo(INK_CENTRE_Y, GEOMETRY_PRECISION)
    expect(INK_CENTRE_Y - INK_CENTRE_X).toBeCloseTo(0.06066, 5)
  })
})

// The three shipped Workouts call sites are out of scope (AAP 0.8.2) and must not move by a pixel: two of them
// pass size and strokeWidth, and one relies on both defaults. Every prop below is the value the component
// rendered before the `selection` variant existed.
describe('CheckIcon default variant', () => {
  it('renders the shipped round-capped tick when no variant is asked for', () => {
    const tick = renderTick({color: TICK_COLOR})

    expect(tick.viewBox).toBe('0 0 24 24')
    expect(tick.d).toBe('M4 12.5l5.5 5.5L20 6.5')
    expect(tick.fill).toBe('none')
    expect(tick.stroke).toBe(TICK_COLOR)
    expect(tick.width).toBe(13)
    expect(tick.height).toBe(13)
    expect(tick.strokeWidth).toBe(3.2)
    expect(tick.strokeLinecap).toBe('round')
    expect(tick.strokeLinejoin).toBe('round')
  })

  it('renders identically when the variant is passed explicitly', () => {
    expect(renderTick({color: TICK_COLOR, variant: 'default'})).toEqual(renderTick({color: TICK_COLOR}))
  })

  it('keeps honouring the size and strokeWidth the week strip and the workouts list pass', () => {
    const tick = renderTick({color: TICK_COLOR, size: 10, strokeWidth: 3.4})

    expect(tick.width).toBe(10)
    expect(tick.height).toBe(10)
    expect(tick.viewBox).toBe('0 0 24 24')
    expect(tick.d).toBe('M4 12.5l5.5 5.5L20 6.5')
    expect(tick.strokeWidth).toBe(3.4)
    expect(tick.strokeLinecap).toBe('round')
    expect(tick.strokeLinejoin).toBe('round')
  })

  it('leaves its round-capped ink at the 1:2 limb ratio no scale of it could reconcile with the frame', () => {
    const tick = renderTick({color: TICK_COLOR})
    const [start, vertex, end] = parsePolyline(tick.d)
    const shortLimb = Math.hypot(vertex.x - start.x, vertex.y - start.y)
    const longLimb = Math.hypot(end.x - vertex.x, end.y - vertex.y)

    expect(longLimb / shortLimb).toBeCloseTo(2.0021, 4)
    expect(longLimb / shortLimb).not.toBeCloseTo(FRAME_W / FRAME_H, 1)
  })

  // The 12.0000 x 9.1875 every QA pass measured on the option disc and the grocery checkbox: this variant at
  // Sizes.ICON_XS in a 22 px host. Kept as an assertion so the number the findings reported stays attached to
  // the variant that produces it, and so it is provable that the 22 px hosts no longer render this one.
  it('paints the 12.0000 x 9.1875 of ink the 22 px hosts used to show, when scaled to 15 px', () => {
    const tick = renderTick({color: TICK_COLOR, size: Sizes.ICON_XS})
    const bounds = inkOf(tick)
    const scale = tick.width / 24

    expect((bounds.right - bounds.left) * scale).toBeCloseTo(12, GEOMETRY_PRECISION)
    expect((bounds.bottom - bounds.top) * scale).toBeCloseTo(9.1875, GEOMETRY_PRECISION)
    expect(tick.strokeWidth * scale).toBeCloseTo(2, GEOMETRY_PRECISION)
  })
})

// The two 22 px hosts the findings were raised against. Asserted here, on the shared glyph, because neither
// component owns a test file: what each one hands the tick is the whole of its contribution to the geometry,
// and a size or strokeWidth reappearing at either call site would silently restore the over-scaled ink.
describe('the 22 px hosts that render the selection tick', () => {
  const selectionInkBounds = (props: Parameters<typeof CheckIcon>[0] | undefined): Bounds => {
    expect(props).toBeDefined()
    expect(props?.variant).toBe('selection')
    expect(props?.size).toBeUndefined()
    expect(props?.strokeWidth).toBeUndefined()

    return inkOf(renderTick(props as Parameters<typeof CheckIcon>[0]))
  }

  it('paints a white 9.19239 x 7.07107 tick on the selected OptionCard indicator', () => {
    const props = tickPropsOf(OptionCard({label: 'Lightly active', selected: true, onPress: noop}))
    const bounds = selectionInkBounds(props)

    expect(props?.color).toBe(Theme.colors.white)
    expect(bounds.right - bounds.left).toBeCloseTo(INK_WIDTH, GEOMETRY_PRECISION)
    expect(bounds.bottom - bounds.top).toBeCloseTo(INK_HEIGHT, GEOMETRY_PRECISION)
  })

  it('paints the same artwork in white on a checked-emphasis CheckboxSquare', () => {
    const host = CheckboxSquare({state: 'checkedEmphasis', onPress: noop, accessibilityLabel: 'Oats'})
    const props = tickPropsOf(host)
    const bounds = selectionInkBounds(props)

    expect(props?.color).toBe(Theme.colors.white)
    expect(bounds.right - bounds.left).toBeCloseTo(INK_WIDTH, GEOMETRY_PRECISION)
    expect(bounds.bottom - bounds.top).toBeCloseTo(INK_HEIGHT, GEOMETRY_PRECISION)
  })

  it('paints the same artwork recoloured on a checked-muted CheckboxSquare', () => {
    const host = CheckboxSquare({state: 'checkedMuted', onPress: noop, accessibilityLabel: 'Oats'})
    const props = tickPropsOf(host)
    const bounds = selectionInkBounds(props)

    expect(props?.color).toBe(Theme.colors.textFaint)
    expect(bounds.right - bounds.left).toBeCloseTo(INK_WIDTH, GEOMETRY_PRECISION)
    expect(bounds.bottom - bounds.top).toBeCloseTo(INK_HEIGHT, GEOMETRY_PRECISION)
  })

  it('draws no tick at all while unselected or unchecked, leaving both indicators empty', () => {
    expect(tickPropsOf(OptionCard({label: 'Lightly active', selected: false, onPress: noop}))).toBeUndefined()
    expect(tickPropsOf(CheckboxSquare({state: 'unchecked', onPress: noop, accessibilityLabel: 'Oats'}))).toBeUndefined()
  })
})
