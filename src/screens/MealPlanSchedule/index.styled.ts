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
  // No horizontal padding and no top inset: both belong to ContentColumn, which wraps this body.
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  optionGroup: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.X_SMALL
  },
  sectionLabel: {
    paddingTop: Spacing.LARGE,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textSecondary
  },
  timesCardWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  timesCard: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.MEDIUM,
    borderRadius: BorderRadius.CARD_LG,
    backgroundColor: Theme.colors.card
  },
  placeholderWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.SMALL
  },
  footnote: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.LABEL,
    color: Theme.colors.textMuted
  },
  // Padding and the safe-area inset belong to GlobalBottomSheet, which already pads its own content view.
  sheetContent: {
    rowGap: Spacing.MEDIUM
  },
  sheetTitle: {
    fontSize: FontSize.CARD_TITLE,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.text
  }
})
