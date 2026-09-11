import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const BannerCheckIcon = ({color, size = Sizes.ICON_SM, strokeWidth = Stroke.WARNING_TRIANGLE}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 17 17" fill="none">
    <Path d="M2.55 8.4999L5.95 11.8999L14.45 3.3999" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default BannerCheckIcon
