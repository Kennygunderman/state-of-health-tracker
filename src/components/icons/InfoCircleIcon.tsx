import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const InfoCircleIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.WARNING_TRIANGLE}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path
      d="M9 15.75C12.7279 15.75 15.75 12.7279 15.75 9C15.75 5.27208 12.7279 2.25 9 2.25C5.27208 2.25 2.25 5.27208 2.25 9C2.25 12.7279 5.27208 15.75 9 15.75Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M9 5.8501V9.4501" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default InfoCircleIcon
