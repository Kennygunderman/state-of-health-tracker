import {Insets, StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

/* BLITZY [A11Y]: 34:92 draws the pill 73x32, so Figma stays authoritative for the drawn size and the 44px
   target comes from hitSlop rather than a minHeight that would have to re-centre the label Figma centres by
   symmetric padding alone. The height is arithmetic, not an assumption about font metrics: changeLabel pins
   its line box to LineHeight.LABEL, so the pill is exactly X_SMALL + 16 + X_SMALL = Sizes.PILL_SM as drawn,
   and Sizes.PILL_SM + 2 x TIGHT is exactly Sizes.TOUCH_TARGET. Width 73 already clears 44, so no horizontal
   slop is needed. Spacing.TIGHT is (Sizes.TOUCH_TARGET - Sizes.PILL_SM) / 2, the same 6px the app's other
   32px pills use, written as the token because the literal-scan gate rejects a bare divisor in a styled
   sheet. The row carries its own slop because a child's hitSlop cannot extend past its parent's bounds — the
   pill is centred in a 39px row, so its expanded target overhangs the row by 2.5px at each end, and both
   platforms gate the search for a touch target on the ancestor's own hit rect first. */
export const PLAN_STARTS_CHANGE_HIT_SLOP: Insets = {
  top: Spacing.TIGHT,
  bottom: Spacing.TIGHT
}

export const PLAN_STARTS_ROW_HIT_SLOP: Insets = {
  top: Spacing.TIGHT,
  bottom: Spacing.TIGHT
}

export default StyleSheet.create({
  card: {
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 0
  },
  textColumn: {
    flex: 1
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    // Figma 34:86 sets an explicit 18.85px line height, the same text style the "kcal" label uses, unlike the
    // auto-height 13px labels of the sibling answers rows, and the card's height derives from it.
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  value: {
    paddingTop: Sizes.ROW_VALUE_INSET_T,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  changeButton: {
    paddingVertical: Spacing.X_SMALL,
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.TILE,
    backgroundColor: Theme.colors.inset
  },
  changeLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    // Pinned so 34:93's box is the 16 Figma resolves instead of the platform font's own 13px line box, which
    // both reproduces the drawn 73x32 pill exactly and closes the hitSlop arithmetic above.
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.text
  }
})
