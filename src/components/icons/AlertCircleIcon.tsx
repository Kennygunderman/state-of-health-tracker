import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

type AlertCircleVariant = 'lg' | 'inline'

interface Props extends IconProps {
  variant?: AlertCircleVariant
}

// The 15 px export is its own drawing — ring r 6 with a 4.6875 to 8.4375 stem — not the 30 px
// geometry halved, so each variant keeps the ring/stem pair transcribed from its own node.
const VARIANT_BOX: Record<AlertCircleVariant, number> = {
  lg: Sizes.ICON_ALERT,
  inline: Sizes.ICON_XS
}

const VARIANT_STROKE: Record<AlertCircleVariant, number> = {
  lg: Stroke.BADGE_ALERT,
  inline: Stroke.DEFAULT
}

const LG_RING_PATH =
  'M15 26.25C21.2132 26.25 26.25 21.2132 26.25 15C26.25 8.7868 21.2132 3.75 15 3.75C8.7868 3.75 3.75 8.7868 3.75 15C3.75 21.2132 8.7868 26.25 15 26.25Z'

const LG_STEM_PATH = 'M15 9.375V16.25'

const INLINE_RING_PATH =
  'M7.5 13.5C10.8137 13.5 13.5 10.8137 13.5 7.5C13.5 4.18629 10.8137 1.5 7.5 1.5C4.18629 1.5 1.5 4.18629 1.5 7.5C1.5 10.8137 4.18629 13.5 7.5 13.5Z'

const INLINE_STEM_PATH = 'M7.5 4.6875V8.4375'

const AlertCircleIcon = ({color, size, strokeWidth, variant = 'lg'}: Props) => {
  const box = VARIANT_BOX[variant]
  const stroke = strokeWidth ?? VARIANT_STROKE[variant]

  return (
    <Svg width={size ?? box} height={size ?? box} viewBox={`0 0 ${box} ${box}`} fill="none">
      <Path d={variant === 'lg' ? LG_RING_PATH : INLINE_RING_PATH} stroke={color} strokeWidth={stroke} />

      <Path d={variant === 'lg' ? LG_STEM_PATH : INLINE_STEM_PATH} stroke={color} strokeWidth={stroke} />
    </Svg>
  )
}

export default AlertCircleIcon
