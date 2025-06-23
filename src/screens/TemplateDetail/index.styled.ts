import {StyleSheet} from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  headerText: {
    paddingLeft: Spacing.LARGE,
    paddingVertical: Spacing.MEDIUM,
    fontSize: FontSize.H1,
    fontWeight: 'bold'
  },
  footerButton: {
    margin: Spacing.MEDIUM,
    marginBottom: Spacing.X_LARGE
  },
  itemMargin: {
    marginHorizontal: Spacing.MEDIUM
  }
})
