import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const WarningTriangleIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.WARNING_TRIANGLE}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path d="M9.00001 2.7002L15.3 14.4002H2.70001L9.00001 2.7002Z" stroke={color} strokeWidth={strokeWidth} />

    <Path d="M9 7.2002V10.3502" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default WarningTriangleIcon
