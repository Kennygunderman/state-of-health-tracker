import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const MealForkKnifeIcon = ({color, size = Sizes.ICON_XL, strokeWidth = Stroke.MEAL_GLYPH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 5V11C5 12.0609 5.42143 13.0783 6.17157 13.8284C6.92172 14.5786 7.93913 15 9 15V20M9 5V10M19 5C19 9 17 10 17 12V20"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
)

export default MealForkKnifeIcon
