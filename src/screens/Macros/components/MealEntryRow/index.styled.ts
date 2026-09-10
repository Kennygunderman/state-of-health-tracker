import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL,
    paddingVertical: Spacing.SMALL,
    backgroundColor: Theme.colors.card
  },
  nameContainer: {
    flex: 1
  },
  name: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD
  },
  servingText: {
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  provenanceCaption: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  caloriesContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    columnGap: Spacing.XX_SMALL
  },
  calories: {
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.BOLD
  },
  caloriesLabel: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textSecondary
  }
})
