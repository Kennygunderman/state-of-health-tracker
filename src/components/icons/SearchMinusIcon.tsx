import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const SearchMinusIcon = ({color, size = Sizes.ICON_BADGE, strokeWidth = Stroke.BADGE_ZOOM}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 26 26" fill="none">
    <Path
      d="M11.375 18.4167C15.264 18.4167 18.4166 15.264 18.4166 11.3751C18.4166 7.4861 15.264 4.3334 11.375 4.3334C7.486 4.3334 4.3333 7.4861 4.3333 11.3751C4.3333 15.264 7.486 18.4167 11.375 18.4167Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M16.7917 16.7916L22.75 22.7499" stroke={color} strokeWidth={strokeWidth} />

    <Path d="M8.6667 11.375H14.0834" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default SearchMinusIcon
