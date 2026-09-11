import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const MealBowlIcon = ({color, size = Sizes.ICON_XL, strokeWidth = Stroke.MEAL_GLYPH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 10H20M6 10V17C6 17.7956 6.31607 18.5587 6.87868 19.1213C7.44129 19.6839 8.20435 20 9 20H15C15.7956 20 16.5587 19.6839 17.1213 19.1213C17.6839 18.5587 18 17.7956 18 17V10"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
)

export default MealBowlIcon
