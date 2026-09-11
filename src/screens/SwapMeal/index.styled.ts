import {StyleSheet} from 'react-native'

import BorderRadius from '@styles/borderRadius'
import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    paddingBottom: Spacing.LARGE
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL
  },
  dateLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
  },
  title: {
    marginTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  titleAfterBanner: {
    marginTop: Spacing.GUTTER
  },
  errorBannerWrapper: {
    marginTop: Spacing.MEDIUM
  },
  currentMealWrapper: {
    marginTop: Spacing.MEDIUM
  },
  loadingRow: {
    marginTop: Spacing.GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.X_SMALL
  },
  loadingLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  skeletonWrapper: {
    marginTop: Spacing.SMALL
  },
  sectionRow: {
    marginTop: Spacing.GUTTER,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionHint: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  alternativesCard: {
    marginTop: Spacing.X_SMALL,
    paddingHorizontal: Spacing.MEDIUM,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  footnote: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textMuted
  },
  emptyCardWrapper: {
    marginTop: Spacing.MEDIUM
  },
  emptyCard: {
    padding: Spacing.GUTTER,
    backgroundColor: Theme.colors.card,
    borderRadius: BorderRadius.CARD_LG
  },
  infoBannerWrapper: {
    marginTop: Spacing.MEDIUM
  }
})
