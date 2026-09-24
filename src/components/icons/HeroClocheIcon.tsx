import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

// Renders the card tile's 1.6 px stroke at 24 px from this glyph's 70-unit viewBox
export const CLOCHE_CARD_STROKE: number = (Stroke.MEAL_GLYPH * Sizes.HERO_TILE_SM) / Sizes.ICON_XL

const HeroClocheIcon = ({color, size = Sizes.HERO_TILE_SM, strokeWidth = Stroke.HERO_ART_CLOCHE}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 70 70" fill="none">
    <Path
      d="M14.5833 34.9998H55.4166M20.4166 34.9998C20.4166 31.1321 21.9531 27.4228 24.688 24.6879C27.4229 21.953 31.1322 20.4165 35 20.4165C38.8677 20.4165 42.577 21.953 45.312 24.6879C48.0469 27.4228 49.5833 31.1321 49.5833 34.9998M17.5 43.7498H52.5"
      stroke={color}
      strokeWidth={strokeWidth}
    />
  </Svg>
)

export default HeroClocheIcon
