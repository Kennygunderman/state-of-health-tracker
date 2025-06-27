import {StyleSheet} from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  listFooter: {
    marginBottom: Spacing.LARGE
  },
  sectionHeaderContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: Spacing.MEDIUM,
    marginRight: Spacing.MEDIUM
  },
  sectionHeaderText: {
    marginLeft: Spacing.X_SMALL,
    fontSize: FontSize.H1,
    fontWeight: 'bold'
  },
  emptyText: {
    fontWeight: '200',
    paddingHorizontal: Spacing.MEDIUM,
    textAlign: 'center',
    alignSelf: 'center'
  },
  createButton: {
    alignSelf: 'flex-end',
    marginTop: Spacing.MEDIUM,
    marginBottom: Spacing.MEDIUM
  }
})
