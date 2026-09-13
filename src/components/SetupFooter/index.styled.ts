import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

// Figma's footer bottom padding (22): a floor beneath the live safe-area inset, never added to it.
export const footerBottomInset = (inset: number): ViewStyle => ({
  paddingBottom: Math.max(inset, Sizes.FOOTER_MIN_BOTTOM)
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
  // Figma's split footer (node 49:669) divides its content box 235:110, held here as
  // proportions so the pair splits any width the same way. Its narrow action is drawn 8 px
  // below the wide one — an artefact of the inert margin wrapper 49:677 — so the two share
  // one centre line, and each slot keeps the drawn 52 px CTA height as its floor.
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.X_SMALL
  },
  splitPrimary: {
    flex: 235,
    minHeight: Sizes.CTA
  },
  splitSecondary: {
    flex: 110,
    minHeight: Sizes.CTA
  }
})
