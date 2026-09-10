import {StyleSheet, ViewStyle} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export const dotFill = (color: string): ViewStyle => ({
  backgroundColor: color
})

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.X_SMALL,
    paddingVertical: Spacing.X_SMALL
  },
  rowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  dot: {
    width: Spacing.X_SMALL,
    height: Spacing.X_SMALL,
    borderRadius: BorderRadius.PILL
  },
  label: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    textTransform: 'capitalize',
    color: Theme.colors.textSecondary
  },
  value: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    textAlign: 'right',
    color: Theme.colors.text
  }
})
