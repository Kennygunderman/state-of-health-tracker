import {StyleSheet} from 'react-native'

import Spacing from '@styles/spacing'

// React Native clips a child's hitSlop to its parent's bounds, so the chips' own slop only becomes a real
// touch target once this band reserves room for it: rowContent's padding gives the slop somewhere to land
// inside the scroll view, which clips to its own bounds, and row's equal negative margin hands the reserved
// height back to the layout. 47:431 draws this row 40px — its own 8px rung, owned by the screen, over one
// 32px chip — and that is what it still measures.
const CHIP_BAND_SLOP = Spacing.TIGHT

export default StyleSheet.create({
  row: {
    flexGrow: 0,
    marginVertical: -CHIP_BAND_SLOP
  },
  rowContent: {
    columnGap: Spacing.X_SMALL,
    alignItems: 'center',
    paddingVertical: CHIP_BAND_SLOP
  }
})
