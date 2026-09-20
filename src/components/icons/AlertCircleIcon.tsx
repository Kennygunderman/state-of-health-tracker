import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

type AlertCircleVariant = 'lg' | 'inline'

interface Props extends IconProps {
  variant?: AlertCircleVariant
}

// The 15 px export is its own drawing — ring r 6 with a 4.6875 to 8.4375 stem — not the 30 px
// geometry halved (halving would give r 5.625, stroke 1.1875 and a 3.4375 stem), so each variant keeps the
// ring/stem pair transcribed from its own node. That is what these two tables are for.
//
// `InfoCircleIcon` is a third node, not a fourth entry here, and rendering this glyph at 18 px is not a
// substitute for it: the box ratio 18/30 = 0.6 does reconcile the rings (11.25 x 0.6 = 6.75, the info ring
// exactly) but not the stroke (2.375 x 0.6 = 1.425 against its authored 1.53) and not the stem
// (6.875 x 0.6 = 4.125 against its authored 3.6). A ring that scales is what makes the mismatch easy to miss.
const VARIANT_BOX: Record<AlertCircleVariant, number> = {
  lg: Sizes.ICON_ALERT,
  inline: Sizes.ICON_XS
}

const VARIANT_STROKE: Record<AlertCircleVariant, number> = {
  lg: Stroke.BADGE_ALERT,
  inline: Stroke.DEFAULT
}

// Ring plus vertical stem is the whole glyph: Figma draws no detached dot under the stem on either node
// (`34:380` at 30 px, `34:251` at 15 px), so there are exactly two subpaths, and no strokeLinecap or
// strokeLinejoin because SVG's butt/miter defaults are what those nodes specify. Feather, Lucide, Material and
// Ionicons all dot their alert-circle glyph, so the absence reads like an omission and is not one — it has been
// raised as a defect and re-verified against Figma each time. What the check finds, on `34:380`:
//   - the node holds exactly two vector children, `34:381` the ring and `34:382` the stem, and exactly two
//     subpaths. There is no third child and no third subpath, visible or hidden, and no fill paint anywhere for
//     a dot to be filled with;
//   - the render was probed, not eyeballed. Every pixel beneath the stem and inside the ring is bit-exact badge
//     fill `#39241F` (0/255 per-channel deviation, one distinct colour), and the ink resolves to two connected
//     components at every alpha threshold down to 0.01. Injecting a dot takes that to three, so the probe would
//     have found one had it been there;
//   - the absent strokeLinecap/strokeLinejoin are authored, not dropped by the exporter: node `34:316` in the
//     same file emits `stroke-linecap="round"` on one path and omits it on that path's sibling, so an absent
//     attribute means the node asks for butt/miter.
// The two path strings below are byte-identical to that export. Do not add a dot, and do not round 2.375.
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
