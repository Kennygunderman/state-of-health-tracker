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
