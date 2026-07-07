import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize from '@styles/fontSize'
import Shadow from '@styles/shadow'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  card: {
    ...Shadow.CARD,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG,
    padding: Spacing.MEDIUM,
    marginTop: Spacing.MEDIUM
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: FontSize.OVERLINE,
    fontWeight: '600',
    color: Theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  confidenceChip: {
    backgroundColor: Theme.colors.accentGreen + '22',
    borderRadius: BorderRadius.CARD_LG,
    paddingHorizontal: Spacing.X_SMALL,
    paddingVertical: 2
  },
  confidenceChipCalibrating: {
    backgroundColor: Theme.colors.textMuted + '22'
  },
  confidenceText: {
    fontSize: FontSize.CAPTION,
    fontWeight: '700',
    color: Theme.colors.accentGreen
  },
  confidenceTextCalibrating: {
    color: Theme.colors.textMuted
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    columnGap: Spacing.XX_SMALL,
    marginTop: Spacing.XX_SMALL
  },
  value: {
    fontSize: FontSize.STAT_LG,
    fontWeight: '700',
    letterSpacing: -0.5
  },
  unit: {
    fontSize: FontSize.BODY,
    color: Theme.colors.textMuted,
    marginBottom: Spacing.XX_SMALL
  },
  chartWrapper: {
    marginTop: Spacing.MEDIUM
  },
  caption: {
    fontSize: FontSize.CAPTION,
    color: Theme.colors.textMuted,
    marginTop: Spacing.SMALL
  }
})
