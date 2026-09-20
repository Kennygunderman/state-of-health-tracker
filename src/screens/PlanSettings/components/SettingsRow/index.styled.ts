import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL
  },
  rowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  textColumn: {
    flex: 1,
    rowGap: Sizes.ROW_VALUE_INSET_T
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  value: {
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.ROW_VALUE,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  // Width only, as `AlternativeRow`'s slot is: 8 pt is the advance frame 38:359 reconciles for the row
  // (value 301 + gap 12 + chevron 8 = 321), while the canvas 38:412's ink needs is wider and overhangs it
  // symmetrically, and an unset height lets the slot hug the glyph so the row keeps the content height its
  // text column sets.
  chevronSlot: {
    width: Sizes.CHEVRON_SLOT,
    alignItems: 'center'
  }
})
