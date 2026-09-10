import {StyleSheet, ViewStyle} from 'react-native'

import {Opacity, Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const actionBarPadding = (bottomInset: number): ViewStyle => ({
  paddingBottom: Math.max(bottomInset, Spacing.MEDIUM + Spacing.TIGHT)
})

export default StyleSheet.create({
  bar: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    borderTopWidth: Stroke.THIN,
    backgroundColor: Theme.colors.background,
    borderTopColor: Theme.colors.hairline
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: Spacing.X_SMALL
  },
  primarySlot: {
    flex: 68,
    minHeight: Sizes.CTA
  },
  secondarySlot: {
    flex: 32,
    minHeight: Sizes.CTA,
    marginTop: Spacing.X_SMALL
  },
  secondarySlotDisabled: {
    opacity: Opacity.DISABLED
  }
})
