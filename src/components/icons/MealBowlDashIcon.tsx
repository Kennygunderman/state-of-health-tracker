import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const MealBowlDashIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.MEAL_GLYPH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6 6H18V10C18 11.5913 17.3679 13.1174 16.2427 14.2427C15.1175 15.3679 13.5913 16 12 16C10.4087 16 8.8826 15.3679 7.7574 14.2427C6.6321 13.1174 6 11.5913 6 10V6Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M9 20H15" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default MealBowlDashIcon
