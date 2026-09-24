import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    minHeight: Sizes.TOUCH_TARGET,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  labelContainer: {
    flex: 1
  },
  label: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  }
})
