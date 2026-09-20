import React from 'react'

import {Sizes} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {
  BACK_CHEVRON,
  CHEVRON_STROKE_LINECAP,
  CHEVRON_STROKE_LINEJOIN,
  CHEVRON_VIEW_BOX,
  chevronPathFor
} from './ChevronGeometry'
import {IconProps} from './IconProps'

// Transcribed from Figma `46:153` through the shared construction in `./ChevronGeometry`, which carries the
// derivation. Built once at module load so the coordinates are resolved before the first render rather than
// on every one.
const BACK_CHEVRON_PATH = chevronPathFor('left', BACK_CHEVRON)

const ChevronLeftIcon = ({color, size = Sizes.ICON_CHEVRON, strokeWidth = BACK_CHEVRON.stroke}: IconProps) => (
  <Svg width={size} height={size} viewBox={CHEVRON_VIEW_BOX} fill="none">
    <Path
      d={BACK_CHEVRON_PATH}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap={CHEVRON_STROKE_LINECAP}
      strokeLinejoin={CHEVRON_STROKE_LINEJOIN}
    />
  </Svg>
)

export default ChevronLeftIcon
