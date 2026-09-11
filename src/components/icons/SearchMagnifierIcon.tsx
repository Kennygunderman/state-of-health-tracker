import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

const SearchMagnifierIcon = ({color, size = Sizes.ICON_SM, strokeWidth = Stroke.SEARCH_MAGNIFIER}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 17 17" fill="none">
    <Path
      d="M7.55555 12.8445C10.4765 12.8445 12.8444 10.4766 12.8444 7.55561C12.8444 4.63464 10.4765 2.26672 7.55555 2.26672C4.63458 2.26672 2.26666 4.63464 2.26666 7.55561C2.26666 10.4766 4.63458 12.8445 7.55555 12.8445Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M11.5222 11.5222L15.1111 15.1111" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default SearchMagnifierIcon
