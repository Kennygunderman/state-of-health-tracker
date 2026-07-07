import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  rateHeader: {
    fontSize: FontSize.OVERLINE,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.LARGE,
    marginBottom: Spacing.X_SMALL
  },
  rateList: {
    rowGap: Spacing.X_SMALL
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.ITEM,
    borderWidth: 1.5,
    borderColor: Theme.colors.card,
    paddingHorizontal: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL
  },
  rateRowSelected: {
    borderColor: Theme.colors.accentGreen
  },
  rateLabel: {
    fontSize: FontSize.BODY,
    fontWeight: '600'
  },
  rateLabelSelected: {
    color: Theme.colors.accentGreen
  },
  rateSubLabel: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textMuted,
    marginTop: 2
  },
  rateWeekly: {
    fontSize: FontSize.LABEL,
    fontWeight: '600',
    color: Theme.colors.textMuted
  }
})
