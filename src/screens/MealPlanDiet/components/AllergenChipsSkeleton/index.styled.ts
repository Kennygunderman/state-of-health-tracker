import {StyleSheet} from 'react-native'

import {Sizes} from '@styles/sizes'

// The pill is the 32px height Figma draws for a chip (`47:178`), which is also the whole height a loaded chip
// occupies: a chip reaches its 44px target through hitSlop reserved inside the band and handed back to the
// layout (@components/ChipCloud), so the drawn row measures the pill and nothing more. The placeholder row has
// to measure the same, or the helper text and the error row below the cloud move when the saved answer arrives.
export const CHIP_PILL_HEIGHT = Sizes.CHIP

// Four widths, cycled across the placeholders. The ten allergy labels run from 'Soy' to 'Tree nuts', so one
// width for all of them would wrap the cloud to a different number of rows than the answer will; these
// average the labels they stand for, which is what keeps the placeholder cloud the same height at the
// reference width. A row either way is the residual — set against a cloud of ten live chips that could be
// tapped before the saved answer had arrived.
export const CHIP_PILL_WIDTHS: readonly number[] = Object.freeze([
  Sizes.CTA,
  Sizes.TILE,
  Sizes.BADGE_DISC_LG,
  Sizes.HERO_TILE_SM
])

export default StyleSheet.create({
  // ChipCloud centres its cross axis, so this host's own height is what its row measures — and it measures
  // the drawn chip, the same height SelectableChip derives from its padding and label inside the loaded
  // cloud. The touch slop a loaded chip adds is reserved by the band and given back to the layout, so it is
  // no part of either row's height and must not be reserved twice here.
  pillHost: {
    justifyContent: 'center',
    minHeight: Sizes.CHIP
  }
})
