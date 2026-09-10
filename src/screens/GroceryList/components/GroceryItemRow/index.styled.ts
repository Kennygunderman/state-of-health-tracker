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
