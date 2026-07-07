import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize from '@styles/fontSize'
import Shadow from '@styles/shadow'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: Spacing.MEDIUM,
    paddingBottom: Spacing.LARGE
  },
  content: {
    flex: 1
  },
  title: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    marginTop: Spacing.SMALL
  },
  estimateCard: {
    ...Shadow.CARD,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.MEDIUM,
    marginTop: Spacing.LARGE,
    alignItems: 'center'
  },
  estimateLabel: {
    fontSize: FontSize.OVERLINE,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  estimateRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: Spacing.XX_SMALL,
    marginTop: Spacing.X_SMALL
  },
  estimateValue: {
    fontSize: FontSize.STAT_HERO,
    fontWeight: '700',
    letterSpacing: -0.5
  },
  estimateUnit: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginBottom: Spacing.X_SMALL
  },
  body: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginTop: Spacing.LARGE,
    lineHeight: 21
  },
  buttonWrapper: {
    marginTop: Spacing.MEDIUM
  }
})
