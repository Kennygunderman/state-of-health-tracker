import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    columnGap: Spacing.TIGHT,
    paddingTop: Spacing.X_SMALL
  },
  message: {
    flex: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.danger
  }
})
