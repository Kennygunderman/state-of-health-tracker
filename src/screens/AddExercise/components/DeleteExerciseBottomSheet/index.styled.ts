import {StyleSheet} from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  title: {
    fontWeight: 'bold',
    fontSize: FontSize.H1
  },
  deleteContainer: {
    marginTop: Spacing.LARGE,
    flexDirection: 'row'
  },
  deleteText: {
    marginLeft: Spacing.X_SMALL,
    fontWeight: '600',
    alignSelf: 'center',
    fontSize: FontSize.H2
  }
})
