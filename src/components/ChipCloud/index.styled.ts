import {StyleSheet} from 'react-native'

import Spacing from '@styles/spacing'

// React Native clips a child's hitSlop to its parent's bounds, so the chips' own slop only becomes a real
// touch target once the band reserves room for it. The padding below gives each chip's slop somewhere to land
// inside this frame and the equal negative margin on each variant gives the layout back the height it
// reserved — the same pairing @screens/LogPlannedMeal/components/FractionChips uses for its own 32px chips.
// Net effect: the band still occupies the 32px Figma draws for a row of chips, so a chip row measures the
// drawn 40px once its screen adds the 8px rung above it (47:177, 47:287, 47:303, 47:431, 47:619), while the
// box the platform tests a touch against is Sizes.CHIP + 2 x Spacing.TIGHT = Sizes.TOUCH_TARGET tall. Every
// site has at least 8px of non-interactive rung above and below the band, so the reserved 6px can overlap no
// neighbouring target.
export const CHIP_BAND_SLOP = Spacing.TIGHT

export default StyleSheet.create({
  // A chip owns its own height (vertical padding around its line box), so a chip whose label wraps must not
  // stretch the rest of its line to match: the cross axis centres instead of taking the default stretch. The
  // gap is the 8px Figma derives between wrapped rows — 47:177 positions its chips at y 8/48/88, a 40px pitch
  // over 32px pills — so the drawn pitch follows from the chips and is never written here.
  cloud: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.X_SMALL,
    paddingVertical: CHIP_BAND_SLOP
  },
  // React Native's horizontal ScrollView base style is flexGrow: 1, which would stretch a single chip row down
  // the whole column-direction screen body it sits in. No height of any kind is declared beyond that: the band
  // hugs its chips, and the negative margin hands back the padding `cloud` reserves so the row still occupies
  // the drawn 32px. A scrolling band clips to its own bounds, which is exactly why the slop is reserved inside
  // them here rather than left to hitSlop the band would cut away.
  scroll: {
    flexGrow: 0,
    marginVertical: -CHIP_BAND_SLOP
  },
  wrap: {
    flexWrap: 'wrap',
    marginVertical: -CHIP_BAND_SLOP
  }
})
