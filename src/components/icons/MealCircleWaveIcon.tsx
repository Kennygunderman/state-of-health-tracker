import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const MealCircleWaveIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.MEAL_GLYPH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 7.85786 16.1421 4.5 12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M8 12C10 10 12 14 16 11" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default MealCircleWaveIcon
