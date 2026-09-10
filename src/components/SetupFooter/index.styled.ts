import {StyleSheet, ViewStyle} from 'react-native'

import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma's footer bottom padding (22): a floor beneath the live safe-area inset, never added to it.
const FOOTER_MIN_BOTTOM_INSET = Spacing.MEDIUM + Spacing.TIGHT

export const footerBottomInset = (inset: number): ViewStyle => ({
  paddingBottom: Math.max(inset, FOOTER_MIN_BOTTOM_INSET)
})

export default StyleSheet.create({
  footer: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    gap: Spacing.X_SMALL,
    backgroundColor: Theme.colors.background
  },
  footerHairline: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.X_SMALL
  },
  splitPrimary: {
    flex: 235
  },
  splitSecondary: {
    flex: 110
  }
})
