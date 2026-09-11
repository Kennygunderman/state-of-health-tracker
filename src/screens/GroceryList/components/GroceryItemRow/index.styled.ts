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
  // BLITZY [A11Y] — WCAG 1.4.3 exception, re-verified against Figma at review and upheld. Figma 37:276 authors
  // these checked deltas as two distinct opaque fills with no opacity anywhere: struck name #6E7B74 (3.81:1 on
  // the #161F1A card) and quantity #4B5750 (2.23:1), both under the 4.5:1 AA default for 15px/400 text. Figma
  // specifies them and outranks that default (AAP 0.2.1 F12 / 0.2.2 / 0.6.5 precedence), so they are matched
  // exactly, never lightened: textMuted (4.75:1) clears AA but collapses the two-tone mute into one grey and
  // breaks the frame 14b comparison. WCAG 1.4.1 still holds — the strike-through below, plus the filled box and
  // added tick CheckboxSquare renders, carry the state without colour. Raising a fill is a Figma change.
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
  quantityMuted: {
    color: Theme.colors.textDisabled
  }
})
