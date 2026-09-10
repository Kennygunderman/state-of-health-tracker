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
  subCopy: {
    paddingTop: Spacing.X_SMALL,
    fontSize: FontSize.BODY,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.BODY,
    color: Theme.colors.textSecondary
  },
  form: {
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.MEDIUM
  },
  fieldGroup: {
    rowGap: Spacing.X_SMALL
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.SMALL
  },
  fieldLabel: {
    flexShrink: 1,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  heightRow: {
    flexDirection: 'row',
    columnGap: Spacing.SMALL
  },
  heightField: {
    flex: 1
  },
  prefillCaption: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.REGULAR,
    lineHeight: LineHeight.META,
    color: Theme.colors.textMuted
  },
  sexOptions: {
    rowGap: Spacing.X_SMALL
  }
})
