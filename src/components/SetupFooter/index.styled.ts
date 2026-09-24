import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const footerBottomInset = (inset: number): ViewStyle => ({
  paddingBottom: Math.max(inset, Sizes.FOOTER_MIN_BOTTOM)
})

export const footerKeyboardLift = (lift: number): ViewStyle => ({
  marginBottom: lift
})

const SPLIT_ROW_HEIGHT = Sizes.CTA

export default StyleSheet.create({
  footer: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    backgroundColor: Theme.colors.background
  },
  footerHairline: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  actionCap: {
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    alignSelf: 'center'
  },
  actionColumn: {
    gap: Spacing.X_SMALL
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: SPLIT_ROW_HEIGHT,
    columnGap: Spacing.X_SMALL
  },
  splitPrimary: {
    flex: 1,
    minHeight: Sizes.CTA
  },
  splitSecondary: {
    width: Sizes.ACTION_SECONDARY_W,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: Sizes.CTA
  }
})
