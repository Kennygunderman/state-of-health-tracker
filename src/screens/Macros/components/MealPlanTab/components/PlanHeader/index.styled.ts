import {Insets, StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

/* BLITZY [A11Y]: 49:34's disc is CONTROL_SM, and CONTROL_SM + 2 x XX_SMALL = TOUCH_TARGET (44px). */
export const GROCERY_BUTTON_HIT_SLOP: Insets = {
  top: Spacing.XX_SMALL,
  right: Spacing.XX_SMALL,
  bottom: Spacing.XX_SMALL,
  left: Spacing.XX_SMALL
}

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    columnGap: Spacing.SMALL
  },
  titleBlock: {
    flex: 1,
    paddingTop: Spacing.X_SMALL,
    rowGap: Spacing.XX_SMALL
  },
  title: {
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  // 49:9 draws no week-switch link: these two back the AAP-inferred one, shown only when an upcoming plan exists.
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  switchLink: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen
  },
  groceryButton: {
    width: Sizes.CONTROL_SM,
    height: Sizes.CONTROL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.tile
  }
})
