import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
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
  textColumn: {
    flex: 1
  },
  name: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  meta: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  // Width only: 8pt is the row's reconciled layout advance, while an unset height lets the slot hug the
  // glyph so the row keeps its content height from the 40pt tile and nothing is clipped vertically.
  chevronSlot: {
    width: Sizes.CHEVRON_SLOT,
    alignItems: 'center'
  },
  rowDivided: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  }
})
