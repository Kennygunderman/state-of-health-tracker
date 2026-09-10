import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // No horizontal padding: the screen gutter belongs to ContentColumn, which wraps this body.
  scrollContent: {
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
  dietGroup: {
    paddingTop: Spacing.GUTTER,
    gap: Spacing.X_SMALL
  },
  sectionLabel: {
    paddingTop: Spacing.LARGE,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  cloudWrapper: {
    paddingTop: Spacing.X_SMALL
  },
  helperText: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  }
})
