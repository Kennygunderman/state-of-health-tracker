import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Stroke, Opacity} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL
  },
  rowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  checkbox: {
    flexShrink: 0
  },
  checkboxPending: {
    opacity: Opacity.DISABLED
  },
  name: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  /* BLITZY [A11Y]: 37:276 struck name #6E7B74 (textFaint) = 3.81:1 on card, below AA 4.5:1 on an interactive row. */
  /* Held per AAP 0.2.1/0.2.2 + Figma; textMuted (4.75:1) rejected. DESIGNER: approve a >=4.5:1 struck-name fill. */
  nameMuted: {
    textDecorationLine: 'line-through',
    color: Theme.colors.textFaint
  },
  quantity: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    textAlign: 'right',
    color: Theme.colors.textSecondary
  },
  /* BLITZY [A11Y]: 37:276 struck quantity #4B5750 (textDisabled) = 2.23:1 on card, below AA on an interactive row. */
  /* Held per AAP 0.2.1/0.2.2 + Figma (a distinct darker grey, not name-at-opacity). DESIGNER: approve >=4.5:1. */
  quantityMuted: {
    color: Theme.colors.textDisabled
  }
})
