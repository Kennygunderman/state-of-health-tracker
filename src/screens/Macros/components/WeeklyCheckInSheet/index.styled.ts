import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.MEDIUM,
    paddingBottom: Spacing.LARGE
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: 'bold'
  },
  expenditure: {
    fontSize: FontSize.BODY,
    fontWeight: '600',
    color: Theme.colors.accentGreen,
    marginTop: Spacing.X_SMALL
  },
  body: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginTop: Spacing.SMALL,
    lineHeight: 20
  },
  targetsRow: {
    flexDirection: 'row',
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD,
    paddingVertical: Spacing.SMALL,
    marginTop: Spacing.MEDIUM,
    marginBottom: Spacing.MEDIUM
  },
  targetCell: {
    flex: 1,
    alignItems: 'center'
  },
  targetValue: {
    fontSize: FontSize.STAT,
    fontWeight: '700'
  },
  targetLabel: {
    fontSize: FontSize.OVERLINE,
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2
  },
  hint: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.SMALL
  }
})
