import React from 'react'

import {Sizes} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {
  CHEVRON_STROKE_LINECAP,
  CHEVRON_STROKE_LINEJOIN,
  CHEVRON_VIEW_BOX,
  ROW_CHEVRON,
  chevronPathFor
} from './ChevronGeometry'
import {IconProps} from './IconProps'

// Transcribed from Figma `47:282` through the shared construction in `./ChevronGeometry`, which carries the
// derivation. Built once at module load so the coordinates are resolved before the first render rather than
// on every one.
const ROW_CHEVRON_PATH = chevronPathFor('right', ROW_CHEVRON)

// `ROW_CHEVRON.stroke` restates this glyph's authored 2.4-unit default rather than changing it: the node's
// 2px border at `Sizes.ICON_MD` is 2.4 units on a 24-unit canvas, and the two are the same double. Several
// shipped rows depend on both defaults, so they keep their values.
const ChevronRightIcon = ({color, size = Sizes.ICON_CHEVRON, strokeWidth = ROW_CHEVRON.stroke}: IconProps) => (
  <Svg width={size} height={size} viewBox={CHEVRON_VIEW_BOX} fill="none">
    <Path
      d={ROW_CHEVRON_PATH}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap={CHEVRON_STROKE_LINECAP}
      strokeLinejoin={CHEVRON_STROKE_LINEJOIN}
    />
  </Svg>
)

export default ChevronRightIcon
