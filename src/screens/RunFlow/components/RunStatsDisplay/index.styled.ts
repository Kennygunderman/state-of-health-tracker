import { StyleSheet } from 'react-native'

import FontSize from '@constants/FontSize'
import Spacing from '@constants/Spacing'

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.MEDIUM,
  },
  readyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  readyIcon: {
    marginBottom: Spacing.LARGE,
    opacity: 0.8,
  },
  readyText: {
    fontSize: FontSize.H1,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: Spacing.SMALL,
  },
  readySubtext: {
    fontSize: FontSize.PARAGRAPH,
    textAlign: 'center',
    opacity: 0.7,
    paddingHorizontal: Spacing.LARGE,
  },
  mainStatsContainer: {
    marginBottom: Spacing.LARGE,
  },
  primaryStatContainer: {
    alignItems: 'center',
    marginBottom: Spacing.LARGE,
  },
  primaryStatLabel: {
    fontSize: FontSize.PARAGRAPH,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.8,
    marginBottom: Spacing.XX_SMALL,
  },
  primaryStatValue: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  primaryStatUnit: {
    fontSize: FontSize.H2,
    fontWeight: '500',
    opacity: 0.8,
    marginTop: -Spacing.SMALL,
  },
  secondaryStatsContainer: {
    marginBottom: Spacing.X_LARGE,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.LARGE,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.SMALL,
  },
  statIcon: {
    marginBottom: Spacing.SMALL,
  },
  statLabel: {
    fontSize: FontSize.PARAGRAPH,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: Spacing.XX_SMALL,
  },
  statValue: {
    fontSize: FontSize.H3,
    fontWeight: 'bold',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.LARGE,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.SMALL,
  },
  statusText: {
    fontSize: FontSize.PARAGRAPH,
    fontWeight: '500',
    opacity: 0.9,
  },
})
