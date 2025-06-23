import {StyleSheet} from 'react-native'

import BorderRadius from '@constants/BorderRadius'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: BorderRadius.LIST_ITEM,
    padding: Spacing.X_SMALL,
    marginTop: Spacing.XX_SMALL,
    marginBottom: Spacing.XX_SMALL,
    marginHorizontal: Spacing.SMALL
  },
  textContainer: {
    flex: 1
  },
  title: {
    fontWeight: 'bold',
    marginLeft: 10,
    marginRight: Spacing.XX_SMALL
  },
  subtitle: {
    fontWeight: '200',
    marginLeft: 10
  }
})
