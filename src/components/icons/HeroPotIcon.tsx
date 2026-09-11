import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

// Renders the card tile's 1.6 px stroke at 24 px from this glyph's 76-unit viewBox
export const POT_CARD_STROKE: number = (Stroke.MEAL_GLYPH * Sizes.HERO_TILE) / Sizes.ICON_XL

const HeroPotIcon = ({color, size = Sizes.HERO_TILE, strokeWidth = Stroke.HERO_ART}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 76 76" fill="none">
    <Path
      d="M12.6666 31.6667H63.3333M19 31.6667V53.8333C19 56.3529 20.0008 58.7693 21.7824 60.5509C23.564 62.3324 25.9804 63.3333 28.5 63.3333H47.5C50.0195 63.3333 52.4359 62.3324 54.2175 60.5509C55.9991 58.7693 57 56.3529 57 53.8333V31.6667M28.5 31.6667V19M47.5 31.6667V19"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
)

export default HeroPotIcon
