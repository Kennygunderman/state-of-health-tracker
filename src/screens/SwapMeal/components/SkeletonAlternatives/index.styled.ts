import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import {Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL
  },
  rowDivider: {
    borderTopWidth: Stroke.THIN,
    borderTopColor: Theme.colors.hairline
  },
  textColumn: {
    flex: 1,
    rowGap: Spacing.X_SMALL
  },
  skeletonBlock: {
    backgroundColor: Theme.colors.inset
  },
  skeletonBar: {
    backgroundColor: Theme.colors.inset
  }
})
