import React from 'react'

import {Sizes, Stroke} from '@styles/sizes'
import Svg, {Path} from 'react-native-svg'

import {IconProps} from './IconProps'

// Ring plus vertical stem is the whole glyph: Figma draws no detached dot under the stem on `34:272` or on its
// recolours `34:497`/`36:438`/`47:91`, so there are exactly two subpaths, and no strokeLinecap or strokeLinejoin
// because SVG's butt/miter defaults are what those nodes specify. The library info-circle glyphs carry a dot,
// so the absence reads like an omission and is not one — it has been raised as a defect and re-verified against
// Figma each time. What the check finds, on `34:497`:
//   - the node holds exactly two vector children, `34:498` the ring and `34:499` the stem, and exactly two
//     subpaths. There is no third child and no third subpath, visible or hidden, and no fill paint anywhere for
//     a dot to be filled with;
//   - the render was probed, not eyeballed. Every pixel beneath the stem and inside the ring is bit-exact banner
//     fill `#13342A` (max alpha 0, 0/255 per-channel deviation, one distinct colour), and the ink resolves to
//     two connected components at every alpha threshold down to 0.01. Injecting a dot takes that to three, so
//     the probe would have found one had it been there;
//   - the absent strokeLinecap/strokeLinejoin are authored, not dropped by the exporter: node `34:316` in the
//     same file emits `stroke-linecap="round"` on one path and omits it on that path's sibling, so an absent
//     attribute means the node asks for butt/miter.
// The two path strings below are byte-identical to that export. Do not add a dot, and do not reach for
// `AlertCircleIcon` at 18 px instead: the box ratio 18/30 = 0.6 reconciles the two rings (11.25 x 0.6 = 6.75,
// this ring exactly) but not the stroke (2.375 x 0.6 = 1.425 against the 1.53 authored here) and not the stem
// (6.875 x 0.6 = 4.125 against the 3.6 authored here), so the scaled glyph is wrong in the two places a
// matching ring hides. `Stroke.INFO_CIRCLE` is this glyph's own entry rather than the warning triangle's, which
// happens to share the number — see `@styles/sizes`.
const InfoCircleIcon = ({color, size = Sizes.ICON, strokeWidth = Stroke.INFO_CIRCLE}: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path
      d="M9 15.75C12.7279 15.75 15.75 12.7279 15.75 9C15.75 5.27208 12.7279 2.25 9 2.25C5.27208 2.25 2.25 5.27208 2.25 9C2.25 12.7279 5.27208 15.75 9 15.75Z"
      stroke={color}
      strokeWidth={strokeWidth}
    />

    <Path d="M9 5.8501V9.4501" stroke={color} strokeWidth={strokeWidth} />
  </Svg>
)

export default InfoCircleIcon
