import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

type CheckVariant = 'default' | 'selection'

interface Props extends IconProps {
  variant?: CheckVariant
}

// The shipped app-wide tick: a round-capped polyline whose limbs measure 7.78 and 15.57 (1:2) inside a 24-unit
// viewBox. Every Workouts surface renders it, so its path, its 13 px canvas, its 3.2 stroke and its round
// terminations are held exactly as shipped — the canvas is smaller than the viewBox, which is why the two are
// separate maps below.
const DEFAULT_TICK_PATH = 'M4 12.5l5.5 5.5L20 6.5'

const DEFAULT_CANVAS = 13

const DEFAULT_VIEW_BOX = 24

const DEFAULT_STROKE = 3.2

// The meal-planning selection tick (`46:172`/`46:173` on the option disc, `37:262`/`37:263` and
// `37:277`/`37:278` on the checkbox, `47:507`, `47:647`) is its own drawing rather than the default at another
// size. Figma authors it as an 8x5 frame carrying only a 2 px bottom and left border drawn inside, rotated 45
// degrees about its own centre: a frame border has no cap or join property, but it renders butt terminations
// and a mitred 90-degree corner, and its centreline limbs are 4 and 7 (the 5 and 8 outer edges less the half
// stroke) at exactly 45 degrees each. The default variant's 1:2 limbs under round caps reach neither ratio at
// any scale — matching its long arm leaves the stroke too thin, matching the stroke oversizes the glyph — so
// the two variants are different artwork and not one path scaled.
//
// The path carries absolute coordinates inside the 22-unit host rather than a centred 9.19239-square asset,
// because the rotated node box is square while the ink fills only the part of it below a 2.12132 top inset:
// Figma places that box 1 px above the host centre precisely to cancel the inset. Rendering this path at 22 in
// a 22 px host therefore puts 9.19239 x 7.07107 of ink at offsets 6.40381 / 6.40381 / 7.52513 / 7.40381 with no
// centring arithmetic, where centring the square box instead would sit the ink about 1 px low.
export const SELECTION_TICK_PATH = 'M7.1109 10.3536L9.9393 13.182L14.8891 8.2322'

export const SELECTION_VIEW_BOX: number = Sizes.ICON_LG

export const SELECTION_STROKE: number = Stroke.BOLD

const VARIANT_VIEW_BOX: Record<CheckVariant, number> = {
  default: DEFAULT_VIEW_BOX,
  selection: SELECTION_VIEW_BOX
}

const VARIANT_CANVAS: Record<CheckVariant, number> = {
  default: DEFAULT_CANVAS,
  selection: Sizes.ICON_LG
}

const VARIANT_STROKE: Record<CheckVariant, number> = {
  default: DEFAULT_STROKE,
  selection: SELECTION_STROKE
}

const CheckIcon = ({color, size, strokeWidth, variant = 'default'}: Props): React.JSX.Element => {
  const isSelection = variant === 'selection'
  const viewBox = VARIANT_VIEW_BOX[variant]
  const canvas = size ?? VARIANT_CANVAS[variant]
  const stroke = strokeWidth ?? VARIANT_STROKE[variant]

  return (
    <Svg width={canvas} height={canvas} viewBox={`0 0 ${viewBox} ${viewBox}`} fill="none">
      <Path
        d={isSelection ? SELECTION_TICK_PATH : DEFAULT_TICK_PATH}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap={isSelection ? 'butt' : 'round'}
        strokeLinejoin={isSelection ? 'miter' : 'round'}
      />
    </Svg>
  )
}

export default CheckIcon
