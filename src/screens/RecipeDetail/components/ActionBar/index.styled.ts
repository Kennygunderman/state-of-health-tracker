import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma (node 49:669): the 22 px bottom padding is a floor beneath the live safe-area inset, never
// added to it; and the narrow action is drawn 8 px below the wide one only because the paint-less
// margin wrapper 49:677 applies a top padding inside a row, so the two share one centre line here —
// the 52 px content box the screen's ACTION_BAR_RESERVE budgets for.
export const actionBarPadding = (bottomInset: number): ViewStyle => ({
  paddingBottom: Math.max(bottomInset, Sizes.FOOTER_MIN_BOTTOM)
})

export default StyleSheet.create({
  bar: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    backgroundColor: Theme.colors.background,
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.X_SMALL
  },
  primarySlot: {
    flex: 235,
    minHeight: Sizes.CTA
  },
  secondarySlot: {
    flex: 110,
    minHeight: Sizes.CTA
  }
})
