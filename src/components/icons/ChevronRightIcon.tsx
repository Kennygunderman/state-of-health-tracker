import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

type ChevronRightVariant = 'default' | 'row'

interface Props extends IconProps {
  variant?: ChevronRightVariant
}

// The two variants are separate drawings, not one path at two weights: `default` is the shipped
// 24-unit round-capped polyline, while `row` is 23.7% thicker and 9.4% wider for its height with
// butt-cut arm ends and a sharp mitred apex, so neither can be derived from the other by scaling.
const DEFAULT_VIEW_BOX = '0 0 24 24'

const DEFAULT_PATH = 'M9 6l6 6-6 6'

// The shipped stroke weight for `default`, preserved for its existing callers; no other drawing in
// the app uses it, so it stays local rather than becoming a `Stroke` token.
const DEFAULT_STROKE_WIDTH = 2.4

const ROW_VIEW_BOX = '0 0 14 14'

// Figma 47:282 (identical in 34:108, 34:119 and 38:412) is an 8x8 frame carrying only a 2px top and
// right border, rotated 45deg, so its ink is 7.071068 x 11.313708 with a 2px perpendicular arm.
// This is that ink's centreline `M0.70711 0.70711L5.65685 5.65685L0.70711 10.60660` translated by
// ((14 - 7.071068) / 2, (14 - 11.313708) / 2) = (3.46447, 1.34315), placing the true-scale ink in
// the centre of the 14-unit canvas; it equals Figma's own 12-unit form
// `M3.17157 1.05025L8.12132 6L3.17157 10.94975` offset by 1 on both axes. Drawn with butt caps and
// a miter join at Stroke.BOLD, rendered at Sizes.ICON_CHEVRON, it reproduces the node exactly. The
// apex needs no strokeMiterlimit: its mitre ratio is 1.414214, well inside SVG's default limit of 4.
const ROW_PATH = 'M4.17157 2.05025L9.12132 7L4.17157 11.94975'

const VARIANT_STROKE: Record<ChevronRightVariant, number> = {
  default: DEFAULT_STROKE_WIDTH,
  row: Stroke.BOLD
}

const ChevronRightIcon = ({
  color,
  size = Sizes.ICON_CHEVRON,
  strokeWidth,
  variant = 'default'
}: Props): React.JSX.Element => {
  const isRow = variant === 'row'
  const stroke = strokeWidth ?? VARIANT_STROKE[variant]

  return (
    <Svg width={size} height={size} viewBox={isRow ? ROW_VIEW_BOX : DEFAULT_VIEW_BOX} fill="none">
      <Path
        d={isRow ? ROW_PATH : DEFAULT_PATH}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap={isRow ? 'butt' : 'round'}
        strokeLinejoin={isRow ? 'miter' : 'round'}
      />
    </Svg>
  )
}

export default ChevronRightIcon
