import {StyleSheet} from 'react-native'

import FontSize, {FontWeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  name: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.text
  },
  quantity: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    textAlign: 'right',
    color: Theme.colors.textSecondary
  }
})
