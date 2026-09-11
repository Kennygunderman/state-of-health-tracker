import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes, Stroke} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  body: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: Sizes.CONTENT_MAX_WIDTH
  },
  dayStripContainer: {
    marginTop: Spacing.MEDIUM
  },
  totalsCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  bannerContainer: {
    marginTop: Spacing.MEDIUM
  },
  mealCardContainer: {
    marginTop: Spacing.SMALL
  },
  mealCardContainerFirst: {
    marginTop: Spacing.MEDIUM
  },
  planSettingsRowContainer: {
    marginTop: Spacing.MEDIUM
  },
  lastDayCardContainer: {
    marginTop: Spacing.MEDIUM
  },
  captionContainer: {
    marginTop: Spacing.X_SMALL
  },
  macrosHeader: {
    alignSelf: 'flex-start',
    marginTop: Spacing.MEDIUM
  },
  screenTitle: {
    marginTop: Spacing.XX_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    marginTop: Spacing.MEDIUM,
    paddingVertical: Spacing.SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.TIP,
    borderWidth: Stroke.THIN,
    borderColor: Theme.colors.dangerBorder,
    backgroundColor: Theme.colors.dangerTint
  },
  errorTitle: {
    flex: 1,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  },
  retryPill: {
    height: Sizes.PILL_SM,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.SMALL,
    borderRadius: BorderRadius.PILL,
    backgroundColor: Theme.colors.accentGreen
  },
  retryLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.onInverse
  },
  unavailableCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  unavailableText: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  staleCaption: {
    fontSize: FontSize.LABEL,
    lineHeight: LineHeight.META,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  skeletonStretch: {
    alignSelf: 'stretch'
  },
  skeletonHeaderRow: {
    rowGap: Spacing.XX_SMALL,
    marginTop: Spacing.MEDIUM
  },
  skeletonDayStrip: {
    flexDirection: 'row',
    columnGap: Spacing.TIGHT,
    marginTop: Spacing.MEDIUM
  },
  skeletonCard: {
    marginTop: Spacing.MEDIUM,
    padding: Spacing.GUTTER,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.X_SMALL
  }
})
