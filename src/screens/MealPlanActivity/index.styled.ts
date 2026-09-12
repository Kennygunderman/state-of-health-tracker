import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  // No horizontal gutter and no top inset: both belong to ContentColumn, which wraps this body.
  scrollContent: {
    paddingBottom: Spacing.X_LARGE
  },
  optionList: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.X_SMALL
  },
  infoBannerWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.MEDIUM,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  subcopy: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.BODY,
    color: Theme.colors.textSecondary
  }
})
