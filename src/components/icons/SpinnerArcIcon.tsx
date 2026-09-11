import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import {Theme} from '@styles/theme'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

type SpinnerArcVariant = 'lg' | 'sm'

interface Props extends IconProps {
  variant?: SpinnerArcVariant
}

// The 76 px and 18 px spinners are separate exports whose inset, stroke and arc sweep all differ,
// so each variant keeps the track/arc pair transcribed from its own node.
const VARIANT_BOX: Record<SpinnerArcVariant, number> = {
  lg: Sizes.SPINNER_LG,
  sm: Sizes.SPINNER
}

const VARIANT_STROKE: Record<SpinnerArcVariant, number> = {
  lg: Stroke.SPINNER_TRACK,
  sm: Stroke.SPINNER_TRACK_SM
}

const LG_TRACK_PATH =
  'M38 69.8139C55.5704 69.8139 69.8139 55.5704 69.8139 38C69.8139 20.4296 55.5704 6.18604 38 6.18604C20.4296 6.18604 6.18604 20.4296 6.18604 38C6.18604 55.5704 20.4296 69.8139 38 69.8139Z'

const LG_ARC_PATH =
  'M38 6.18604C42.3853 6.19452 46.7215 7.10954 50.7364 8.87364C54.7512 10.6377 58.358 13.2128 61.3302 16.4372'

const SM_TRACK_PATH =
  'M9 15.75C12.7279 15.75 15.75 12.7279 15.75 9C15.75 5.27208 12.7279 2.25 9 2.25C5.27208 2.25 2.25 5.27208 2.25 9C2.25 12.7279 5.27208 15.75 9 15.75Z'

const SM_ARC_PATH = 'M9 2.25C10.7896 2.25158 12.5053 2.96377 13.77 4.23'

const SpinnerArcIcon = ({color, size, strokeWidth, variant = 'lg'}: Props) => {
  const box = VARIANT_BOX[variant]
  const stroke = strokeWidth ?? VARIANT_STROKE[variant]

  return (
    <Svg width={size ?? box} height={size ?? box} viewBox={`0 0 ${box} ${box}`} fill="none">
      <Path d={variant === 'lg' ? LG_TRACK_PATH : SM_TRACK_PATH} stroke={Theme.colors.track} strokeWidth={stroke} />

      <Path
        d={variant === 'lg' ? LG_ARC_PATH : SM_ARC_PATH}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </Svg>
  )
}

export default SpinnerArcIcon
