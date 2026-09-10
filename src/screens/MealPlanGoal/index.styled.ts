import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.LARGE
  },
  headline: {
    paddingTop: Spacing.GUTTER,
    fontSize: FontSize.SCREEN_TITLE,
    fontWeight: FontWeight.BOLD,
    lineHeight: LineHeight.SCREEN_TITLE,
    letterSpacing: LetterSpacing.TITLE,
    color: Theme.colors.text
  },
  optionList: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.X_SMALL
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.GUTTER
  },
  controlLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  optionalLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  fieldWrapper: {
    alignSelf: 'stretch',
    paddingTop: Spacing.X_SMALL
  },
  paceSection: {
    alignSelf: 'stretch',
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.X_SMALL
  }
})
