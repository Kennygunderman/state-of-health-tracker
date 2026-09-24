import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const MealWrapIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.MEAL_GLYPH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M5 12H19M7 12C7 10.6739 7.5268 9.4021 8.4645 8.4645C9.4021 7.5268 10.6739 7 12 7C13.3261 7 14.5979 7.5268 15.5356 8.4645C16.4732 9.4021 17 10.6739 17 12M6 15H18"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
)

export default MealWrapIcon
