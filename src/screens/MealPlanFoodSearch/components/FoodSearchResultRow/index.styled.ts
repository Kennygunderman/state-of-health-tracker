import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const ROW_HIT_SLOP: number = Spacing.X_SMALL

export default StyleSheet.create({
  row: {
    paddingHorizontal: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card
  },
  rowFirst: {
    borderTopLeftRadius: BorderRadius.CARD_LG,
    borderTopRightRadius: BorderRadius.CARD_LG
  },
  rowLast: {
    borderBottomLeftRadius: BorderRadius.CARD_LG,
    borderBottomRightRadius: BorderRadius.CARD_LG
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL
  },
  rowContentDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  textColumn: {
    flex: 1,
    rowGap: 0
  },
  name: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  nameAdded: {
    fontWeight: FontWeight.SEMIBOLD
  },
  category: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  /* BLITZY [A11Y]: the added state implements Figma `47:387` exactly — accent-green fill under
     `47:388`'s white check — which measures 2.45:1, below the 3:1 non-text graphical minimum.
     Figma is the authoritative design contract for this pair, so the rendered values are matched
     rather than adjusted. Resolving it is a design-system decision rather than a local edit: the
     same accent-green-and-white pair is the checked-emphasis state of the shared CheckboxSquare,
     so changing only this control would fork the selection language. Either remedy clears the
     threshold if a designer chooses one — a near-black glyph on the accent-green surface
     (`Theme.colors.background` on `accentGreen` measures 7.67:1), or a darker selected surface
     keeping the white glyph. Flagged here for designer review. */
  addedControl: {
    width: Sizes.ICON_LG,
    height: Sizes.ICON_LG,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.CHECKBOX,
    backgroundColor: Theme.colors.accentGreen
  },
  addControl: {
    width: Sizes.ADD_CONTROL,
    height: Sizes.ADD_CONTROL,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.inset
  },
  addGlyph: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  }
})
