import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Sizes} from '@styles/sizes'
import {Theme} from '@styles/theme'

import {
  BACK_AFFORDANCE_SCAFFOLD_SHIFT,
  BACK_CHEVRON,
  BACK_CHEVRON_REFERENCE_SIZE,
  chevronInkOffsetAt,
  chevronInkShiftMargins
} from '@components/icons/ChevronGeometry'

// Figma does not centre this chevron's ink in its circle. Between the two sits wrapper `47:256`, which holds
// the glyph as an absolutely positioned child offset 1.136px into a 12px box and so places the glyph's frame
// 1.5px right of the circle's centre, while the glyph's own rotated frame paints only its two apex-facing
// edges and so carries its ink 2.4749px left of that frame's centre. The two combine to 0.9749px left of the
// circle's centre, which is where the design paints it and which centred artwork misses by half a stroke
// width — a whole device pixel at 2x and nearly four at 4x. Only the net offset is reproduced: the wrapper's
// 3px left padding is inert against an absolutely positioned child and is deliberately not honoured, and the
// wrapper is not modelled as a box because the glyph paints 1.864px past its top, bottom and right, so a real
// 12x9 box would clip the limb tips.
const GLYPH_INK_SHIFT =
  BACK_AFFORDANCE_SCAFFOLD_SHIFT + chevronInkOffsetAt('left', BACK_CHEVRON, BACK_CHEVRON_REFERENCE_SIZE)

export default StyleSheet.create({
  button: {
    width: Sizes.TILE_SM,
    height: Sizes.TILE_SM,
    borderRadius: BorderRadius.PILL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  default: {
    backgroundColor: Theme.colors.tile
  },
  scrim: {
    backgroundColor: Theme.colors.heroScrim
  },
  glyph: chevronInkShiftMargins(0, GLYPH_INK_SHIFT)
})
