import {StyleSheet, ViewStyle} from 'react-native'

import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const actionBarPadding = (bottomInset: number): ViewStyle => ({
  paddingBottom: Math.max(bottomInset, Sizes.FOOTER_MIN_BOTTOM)
})

const ACTION_ROW_HEIGHT = Sizes.CTA

const ACTION_BAR_ABOVE_INSET = Stroke.THIN + Spacing.SMALL + ACTION_ROW_HEIGHT

export const ACTION_BAR_RESERVE = ACTION_BAR_ABOVE_INSET + Sizes.FOOTER_MIN_BOTTOM

export const actionBarReserve = (bottomInset: number): number =>
  ACTION_BAR_ABOVE_INSET + Math.max(bottomInset, Sizes.FOOTER_MIN_BOTTOM)

export default StyleSheet.create({
  bar: {
    paddingTop: Spacing.SMALL,
    paddingHorizontal: Spacing.GUTTER,
    backgroundColor: Theme.colors.background,
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  splitRow: {
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: ACTION_ROW_HEIGHT,
    columnGap: Spacing.X_SMALL
  },
  primarySlot: {
    flex: 1,
    minHeight: Sizes.CTA
  },
  secondarySlot: {
    width: Sizes.ACTION_SECONDARY_W,
    flexGrow: 0,
    flexShrink: 0,
    minHeight: Sizes.CTA
  }
})
