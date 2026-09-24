import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    paddingHorizontal: Spacing.GUTTER,
    paddingBottom: Spacing.X_LARGE
  },
  skeletonOverlay: {
    paddingHorizontal: Spacing.GUTTER
  },
  dateOverline: {
    fontSize: FontSize.OVERLINE,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.accentGreen,
    textTransform: 'uppercase',
    letterSpacing: LetterSpacing.OVERLINE
  },
  dateOverlineTouchable: {
    alignSelf: 'flex-start',
    marginTop: Spacing.MEDIUM
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  screenTitle: {
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.TITLE,
    marginTop: Spacing.XX_SMALL
  },
  historyButton: {
    padding: Spacing.X_SMALL
  },
  segmentRow: {
    marginTop: Spacing.MEDIUM
  },
  summaryCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  aiCardContainer: {
    marginTop: Spacing.SMALL
  },
  mealCardContainer: {
    marginTop: Spacing.SMALL
  },
  retryContainer: {
    alignItems: 'center',
    marginTop: Spacing.X_LARGE,
    padding: Spacing.MEDIUM
  },
  retryText: {
    fontSize: FontSize.PARAGRAPH,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary,
    textAlign: 'center'
  }
})
