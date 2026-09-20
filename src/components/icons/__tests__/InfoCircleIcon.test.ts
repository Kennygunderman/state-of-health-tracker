import {Children, isValidElement, ReactElement, ReactNode} from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import {Path} from 'react-native-svg'

import AlertCircleIcon from '../AlertCircleIcon'
import BannerCheckIcon from '../BannerCheckIcon'
import InfoCircleIcon from '../InfoCircleIcon'
import WarningTriangleIcon from '../WarningTriangleIcon'

// These glyphs have no util module and the repository carries no renderer, so they are exercised by calling the
// component as the plain function it is and reading the element tree it returns. That is enough to pin the two
// things that keep being reported as defects and are not:
//
//   1. the stroke width each glyph renders at, asserted through its `Stroke` token rather than a number, so
//      repointing a default at a purpose-named token provably moves no pixel; and
//   2. the path inventory, so the detached dot that Feather, Lucide, Material and Ionicons draw on their
//      alert-circle and info glyphs — and that Figma does not draw on these nodes — cannot be added silently.
//
// Every `d` string below is the Figma export verbatim. `34:381`/`34:382` (alert, 30 px) and `34:498`/`34:499`
// (info, 18 px) were re-probed against Figma: each node holds exactly those two vector children, the render
// carries bit-exact background beneath the stem, and neither cap nor join attribute is authored — so the
// components must emit no `strokeLinecap`/`strokeLinejoin` and SVG's butt/miter initial values stand.
const ALERT_LG_RING_34_381 =
  'M15 26.25C21.2132 26.25 26.25 21.2132 26.25 15C26.25 8.7868 21.2132 3.75 15 3.75C8.7868 3.75 3.75 8.7868 3.75 15C3.75 21.2132 8.7868 26.25 15 26.25Z'

const ALERT_LG_STEM_34_382 = 'M15 9.375V16.25'

// The 15 px alert export `34:251` is its own drawing, not `34:380` halved: AAP 0.2.4 records ring r 6 and a
// 4.6875 to 8.4375 stem, which the geometry assertions below read back out of these strings.
const ALERT_INLINE_RING_34_251 =
  'M7.5 13.5C10.8137 13.5 13.5 10.8137 13.5 7.5C13.5 4.18629 10.8137 1.5 7.5 1.5C4.18629 1.5 1.5 4.18629 1.5 7.5C1.5 10.8137 4.18629 13.5 7.5 13.5Z'

const ALERT_INLINE_STEM_34_251 = 'M7.5 4.6875V8.4375'

const INFO_RING_34_498 =
  'M9 15.75C12.7279 15.75 15.75 12.7279 15.75 9C15.75 5.27208 12.7279 2.25 9 2.25C5.27208 2.25 2.25 5.27208 2.25 9C2.25 12.7279 5.27208 15.75 9 15.75Z'

const INFO_STEM_34_499 = 'M9 5.8501V9.4501'

const BANNER_TICK_37_45 = 'M2.55 8.4999L5.95 11.8999L14.45 3.3999'

const WARNING_TRIANGLE_37_201 = 'M9.00001 2.7002L15.3 14.4002H2.70001L9.00001 2.7002Z'

const WARNING_STEM_37_201 = 'M9 7.2002V10.3502'

const COLOR = '#5FDCAC'

interface SvgProps {
  width?: number
  height?: number
  viewBox?: string
  fill?: string
  children?: ReactNode
}

interface PathProps {
  d?: string
  stroke?: string
  strokeWidth?: number
  strokeLinecap?: string
  strokeLinejoin?: string
}

const svgPropsOf = (element: ReactElement): SvgProps => element.props as SvgProps

// `Children.toArray` drops the nulls and flattens the fragments a conditional glyph could introduce, so what
// comes back is the drawn mark list and not an artefact of how the JSX happens to be nested.
const pathsOf = (element: ReactElement): PathProps[] =>
  Children.toArray(svgPropsOf(element).children)
    .filter(isValidElement)
    .map(child => {
      expect(child.type).toBe(Path)

      return child.props as PathProps
    })

// A dot would arrive either as an extra element or as a second subpath inside an existing `d`. Both are closed
// here: the element count is asserted per glyph, and a second move command in any one path fails this.
const subpathCountOf = (d: string): number => (d.match(/[Mm]/g) ?? []).length

const numbersIn = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

describe('Stroke token map', () => {
  it('carries a separate entry for each 1.53 glyph rather than one shared entry', () => {
    expect(Object.prototype.hasOwnProperty.call(Stroke, 'INFO_CIRCLE')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(Stroke, 'BANNER_CHECK')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(Stroke, 'WARNING_TRIANGLE')).toBe(true)
  })

  it('gives the three entries the same width, so naming them apart moved nothing on screen', () => {
    expect(Stroke.INFO_CIRCLE).toBe(Stroke.WARNING_TRIANGLE)
    expect(Stroke.BANNER_CHECK).toBe(Stroke.WARNING_TRIANGLE)
  })

  it('leaves the warning triangle glyph on its own entry', () => {
    const paths = pathsOf(WarningTriangleIcon({color: COLOR}))

    expect(paths).toHaveLength(2)
    expect(paths[0].d).toBe(WARNING_TRIANGLE_37_201)
    expect(paths[1].d).toBe(WARNING_STEM_37_201)
    expect(paths[0].strokeWidth).toBe(Stroke.WARNING_TRIANGLE)
    expect(paths[1].strokeWidth).toBe(Stroke.WARNING_TRIANGLE)
  })
})

describe('InfoCircleIcon', () => {
  it('draws the ring and the stem of node 34:497 and nothing else', () => {
    const paths = pathsOf(InfoCircleIcon({color: COLOR}))

    expect(paths).toHaveLength(2)
    expect(paths[0].d).toBe(INFO_RING_34_498)
    expect(paths[1].d).toBe(INFO_STEM_34_499)
  })

  it('draws no detached dot, as neither an extra path nor a second subpath', () => {
    const paths = pathsOf(InfoCircleIcon({color: COLOR}))

    expect(paths).toHaveLength(2)
    expect(subpathCountOf(INFO_RING_34_498)).toBe(1)
    expect(subpathCountOf(INFO_STEM_34_499)).toBe(1)
    paths.forEach(path => expect(subpathCountOf(path.d ?? '')).toBe(1))
  })

  it('renders at its own purpose-named stroke token', () => {
    const paths = pathsOf(InfoCircleIcon({color: COLOR}))

    paths.forEach(path => expect(path.strokeWidth).toBe(Stroke.INFO_CIRCLE))
  })

  it('still honours an explicitly passed stroke width', () => {
    const paths = pathsOf(InfoCircleIcon({color: COLOR, strokeWidth: Stroke.BOLD}))

    paths.forEach(path => expect(path.strokeWidth).toBe(Stroke.BOLD))
  })

  it('fills its 18-unit box at the default icon size', () => {
    const svg = svgPropsOf(InfoCircleIcon({color: COLOR}))

    expect(svg.width).toBe(Sizes.ICON)
    expect(svg.height).toBe(Sizes.ICON)
    expect(svg.viewBox).toBe(`0 0 ${Sizes.ICON} ${Sizes.ICON}`)
    expect(svg.fill).toBe('none')
  })

  it('authors butt caps and mitred joins by leaving both attributes off', () => {
    const paths = pathsOf(InfoCircleIcon({color: COLOR}))

    paths.forEach(path => {
      expect(path.strokeLinecap).toBeUndefined()
      expect(path.strokeLinejoin).toBeUndefined()
    })
  })

  it('takes its ink from the colour prop on both marks', () => {
    const paths = pathsOf(InfoCircleIcon({color: COLOR}))

    paths.forEach(path => expect(path.stroke).toBe(COLOR))
  })
})

describe('BannerCheckIcon', () => {
  it('draws the single two-segment tick of node 37:45', () => {
    const paths = pathsOf(BannerCheckIcon({color: COLOR}))

    expect(paths).toHaveLength(1)
    expect(paths[0].d).toBe(BANNER_TICK_37_45)
    expect(subpathCountOf(BANNER_TICK_37_45)).toBe(1)
  })

  it('renders at its own purpose-named stroke token', () => {
    const paths = pathsOf(BannerCheckIcon({color: COLOR}))

    expect(paths[0].strokeWidth).toBe(Stroke.BANNER_CHECK)
  })

  it('fills its 17-unit box at the default small icon size', () => {
    const svg = svgPropsOf(BannerCheckIcon({color: COLOR}))

    expect(svg.width).toBe(Sizes.ICON_SM)
    expect(svg.viewBox).toBe(`0 0 ${Sizes.ICON_SM} ${Sizes.ICON_SM}`)
  })

  it('authors butt caps and mitred joins by leaving both attributes off', () => {
    const paths = pathsOf(BannerCheckIcon({color: COLOR}))

    expect(paths[0].strokeLinecap).toBeUndefined()
    expect(paths[0].strokeLinejoin).toBeUndefined()
  })
})

describe('AlertCircleIcon', () => {
  it('draws the ring and the stem of node 34:380 in the lg variant and nothing else', () => {
    const paths = pathsOf(AlertCircleIcon({color: COLOR, variant: 'lg'}))

    expect(paths).toHaveLength(2)
    expect(paths[0].d).toBe(ALERT_LG_RING_34_381)
    expect(paths[1].d).toBe(ALERT_LG_STEM_34_382)
    paths.forEach(path => expect(subpathCountOf(path.d ?? '')).toBe(1))
  })

  it('draws the ring and the stem of node 34:251 in the inline variant and nothing else', () => {
    const paths = pathsOf(AlertCircleIcon({color: COLOR, variant: 'inline'}))

    expect(paths).toHaveLength(2)
    expect(paths[0].d).toBe(ALERT_INLINE_RING_34_251)
    expect(paths[1].d).toBe(ALERT_INLINE_STEM_34_251)
    paths.forEach(path => expect(subpathCountOf(path.d ?? '')).toBe(1))
  })

  it('defaults to the lg variant', () => {
    expect(pathsOf(AlertCircleIcon({color: COLOR}))).toEqual(pathsOf(AlertCircleIcon({color: COLOR, variant: 'lg'})))
  })

  it('renders each variant at its own stroke token', () => {
    pathsOf(AlertCircleIcon({color: COLOR, variant: 'lg'})).forEach(path =>
      expect(path.strokeWidth).toBe(Stroke.BADGE_ALERT)
    )
    pathsOf(AlertCircleIcon({color: COLOR, variant: 'inline'})).forEach(path =>
      expect(path.strokeWidth).toBe(Stroke.DEFAULT)
    )
  })

  it('puts 1.583 on screen when the lg variant is drawn at the 20 px banner size', () => {
    const svg = svgPropsOf(AlertCircleIcon({color: COLOR, variant: 'lg', size: Sizes.ICON_MD}))
    const paths = pathsOf(AlertCircleIcon({color: COLOR, variant: 'lg', size: Sizes.ICON_MD}))

    expect(svg.width).toBe(Sizes.ICON_MD)
    expect(svg.viewBox).toBe(`0 0 ${Sizes.ICON_ALERT} ${Sizes.ICON_ALERT}`)
    // strokeWidth is in viewBox units, so the painted weight is the token scaled by canvas over box.
    paths.forEach(path =>
      expect(((path.strokeWidth as number) * Sizes.ICON_MD) / Sizes.ICON_ALERT).toBeCloseTo(1.583, 3)
    )
  })

  it('gives each variant its own box', () => {
    const lg = svgPropsOf(AlertCircleIcon({color: COLOR, variant: 'lg'}))
    const inline = svgPropsOf(AlertCircleIcon({color: COLOR, variant: 'inline'}))

    expect(lg.width).toBe(Sizes.ICON_ALERT)
    expect(lg.viewBox).toBe(`0 0 ${Sizes.ICON_ALERT} ${Sizes.ICON_ALERT}`)
    expect(inline.width).toBe(Sizes.ICON_XS)
    expect(inline.viewBox).toBe(`0 0 ${Sizes.ICON_XS} ${Sizes.ICON_XS}`)
  })

  it('authors butt caps and mitred joins on both variants by leaving both attributes off', () => {
    const paths = [
      ...pathsOf(AlertCircleIcon({color: COLOR, variant: 'lg'})),
      ...pathsOf(AlertCircleIcon({color: COLOR, variant: 'inline'}))
    ]

    paths.forEach(path => {
      expect(path.strokeLinecap).toBeUndefined()
      expect(path.strokeLinejoin).toBeUndefined()
    })
  })

  // Reading the geometry back out of the path strings is what makes the variant tables load-bearing rather than
  // decorative: it shows the inline export is not the lg export halved, and that the 18 px info glyph is not the
  // lg export scaled either — its ring alone would scale, which is what makes the mismatch easy to miss.
  it('keeps each variant transcribed from its own node rather than scaled from the other', () => {
    const lgRingAnchors = numbersIn(ALERT_LG_RING_34_381)
    const inlineRingAnchors = numbersIn(ALERT_INLINE_RING_34_251)
    const lgRingRadius = lgRingAnchors[1] - Sizes.ICON_ALERT / 2
    const inlineRingRadius = inlineRingAnchors[1] - Sizes.ICON_XS / 2
    const lgStem = numbersIn(ALERT_LG_STEM_34_382)
    const inlineStem = numbersIn(ALERT_INLINE_STEM_34_251)
    const halfBox = Sizes.ICON_XS / Sizes.ICON_ALERT

    expect(lgRingRadius).toBeCloseTo(11.25, 5)
    expect(inlineRingRadius).toBeCloseTo(6, 5)
    expect(inlineRingRadius).not.toBeCloseTo(lgRingRadius * halfBox, 3)
    expect(Stroke.DEFAULT).not.toBeCloseTo(Stroke.BADGE_ALERT * halfBox, 3)
    expect(inlineStem[2] - inlineStem[1]).toBeCloseTo(3.75, 5)
    expect(inlineStem[2] - inlineStem[1]).not.toBeCloseTo((lgStem[2] - lgStem[1]) * halfBox, 3)
  })

  it('is not interchangeable with the 18 px info glyph, whose ring alone would scale', () => {
    const infoBox = Sizes.ICON / Sizes.ICON_ALERT
    const lgRingRadius = numbersIn(ALERT_LG_RING_34_381)[1] - Sizes.ICON_ALERT / 2
    const infoRingRadius = numbersIn(INFO_RING_34_498)[1] - Sizes.ICON / 2
    const lgStem = numbersIn(ALERT_LG_STEM_34_382)
    const infoStem = numbersIn(INFO_STEM_34_499)

    expect(infoRingRadius).toBeCloseTo(lgRingRadius * infoBox, 5)
    expect(Stroke.INFO_CIRCLE).not.toBeCloseTo(Stroke.BADGE_ALERT * infoBox, 3)
    expect(infoStem[2] - infoStem[1]).toBeCloseTo(3.6, 5)
    expect(infoStem[2] - infoStem[1]).not.toBeCloseTo((lgStem[2] - lgStem[1]) * infoBox, 3)
  })
})
