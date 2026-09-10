import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    paddingTop: Spacing.X_SMALL,
    paddingBottom: Spacing.LARGE
  },
  headline: {
    marginTop: Spacing.X_SMALL,
    fontSize: FontSize.SCREEN_TITLE,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    fontWeight: FontWeight.BOLD,
    color: Theme.colors.text
  },
  body: {
    marginTop: Spacing.SMALL,
    fontSize: FontSize.BODY,
    lineHeight: LineHeight.BODY,
    fontWeight: FontWeight.REGULAR,
    color: Theme.colors.textSecondary
  },
  sampleCardWrapper: {
    marginTop: Spacing.GUTTER
  }
})
