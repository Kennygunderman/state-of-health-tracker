import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const MealDomeLargeIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.MEAL_GLYPH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 17H21M4 14H20C20 11.8783 19.1572 9.8434 17.6568 8.3431C16.1565 6.8429 14.1217 6 12 6C9.8783 6 7.8434 6.8429 6.3431 8.3431C4.8429 9.8434 4 11.8783 4 14Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
)

export default MealDomeLargeIcon
