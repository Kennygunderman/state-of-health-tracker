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
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.LABEL
  },
  valueBody: {
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.BODY_COMPACT
  },
  // The stacked variant is the Review answers card (34:98) — the one node where Figma authors a line height on
  // the value, 19.5, and the box its 2/0.5 insets close on at 22. Every other card leaves the value automatic,
  // so the authored box belongs here with those insets rather than on the size variant.
  valueStacked: {
    paddingTop: Sizes.ROW_VALUE_INSET_T,
    paddingBottom: Sizes.ROW_VALUE_INSET_B,
    lineHeight: LineHeight.ROW_VALUE
  },
  // No textAlign: every label and value across the three cards is drawn LEFT/TOP, and the right-hand look is
  // the row's own space-between against a hug-width value. Right-aligning would only show up once a value
  // wraps, and then against the design.
  valueInline: {
    flexShrink: 1
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
