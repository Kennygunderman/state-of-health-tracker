import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const RefreshIcon = ({color, size = Sizes.ICON_XL, strokeWidth = Stroke.BADGE_REFRESH}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 12.0001C4.00258 10.4257 4.46962 8.88718 5.3426 7.57707C6.21558 6.26696 7.45571 5.24355 8.90766 4.63501C10.3596 4.02647 11.9588 3.85986 13.5051 4.15604C15.0513 4.45222 16.4757 5.19803 17.6 6.30006M20 12.0001C19.9974 13.5744 19.5304 15.1129 18.6574 16.423C17.7844 17.7332 16.5443 18.7566 15.0923 19.3651C13.6404 19.9736 12.0412 20.1403 10.4949 19.8441C8.94874 19.5479 7.52429 18.8021 6.4 17.7001"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M17.5 3.5V6.5H14.5M6.5 20.5V17.5H9.5" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default RefreshIcon
