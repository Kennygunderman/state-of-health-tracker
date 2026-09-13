import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
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
  name: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  // BLITZY [A11Y] — WCAG 1.4.3 exception, re-verified against Figma at review and upheld. Figma authors the
  // checked deltas of row 37:276 as two distinct opaque fills with no opacity anywhere: struck name 37:282
  // `textFaint` (3.81:1 on the `card` surface) and quantity 37:285 `textDisabled` (2.23:1), both under the
  // 4.5:1 AA default for 15px/400 text. The file proves these are authored values rather than a composited
  // opacity — a control node on the same screen does emit rgba where alpha exists — so there is no alpha to
  // remove and any remedy changes a colour. Figma specifies them and outranks that default, so they are
  // matched exactly, never lightened: `textMuted` (4.75:1) clears AA but collapses the two-tone mute into one
  // grey and breaks the frame 14b comparison. WCAG 1.4.1 still holds at row level — Figma declares the
  // strike-through below, and the unchecked box it replaces has no children at all, so checking adds a fill
  // and a tick rather than only shifting colour. Raising a fill is a Figma change: the coordinated decision
  // is recorded in the accessible-colour register in `@styles/theme`.
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
