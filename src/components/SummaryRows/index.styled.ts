import {StyleSheet, TextStyle} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const valueTextColor = (color: string): TextStyle => ({
  color
})

export default StyleSheet.create({
  container: {
    alignSelf: 'stretch'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  rowInline: {
    justifyContent: 'space-between'
  },
  rowSpaced: {
    marginTop: Spacing.SMALL
  },
  rowStacked: {
    paddingVertical: Spacing.SMALL
  },
  rowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  textColumn: {
    flex: 1
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  labelInline: {
    flexShrink: 1,
    lineHeight: LineHeight.META
  },
  value: {
    fontWeight: FontWeight.SEMIBOLD
  },
  valueLabel: {
    fontSize: FontSize.LABEL
  },
  valueBody: {
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.ROW_VALUE
  },
  valueStacked: {
    paddingTop: Sizes.ROW_VALUE_INSET_T,
    paddingBottom: Sizes.ROW_VALUE_INSET_B
  },
  valueInline: {
    flexShrink: 1,
    textAlign: 'right'
  },
  overline: {
    marginBottom: Spacing.SMALL,
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    letterSpacing: LetterSpacing.OVERLINE,
    lineHeight: LineHeight.OVERLINE,
    textTransform: 'uppercase',
    color: Theme.colors.textMuted
  }
})
