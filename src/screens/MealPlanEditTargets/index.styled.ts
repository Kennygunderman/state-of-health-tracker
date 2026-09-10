import {StyleSheet} from 'react-native'

import FontSize, {FontWeight, LetterSpacing, LineHeight} from '@styles/fontSize'
import {Sizes} from '@styles/sizes'
import Spacing from '@styles/spacing'
import {Theme} from '@styles/theme'

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.X_LARGE
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: Spacing.SMALL,
    minHeight: Sizes.TILE_SM
  },
  headerLabel: {
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textMuted
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
  fieldGroup: {
    paddingTop: Spacing.GUTTER,
    rowGap: Spacing.MEDIUM
  },
  fieldBlock: {
    alignSelf: 'stretch'
  },
  fieldLabel: {
    paddingBottom: Spacing.X_SMALL,
    fontSize: FontSize.LABEL,
    fontWeight: FontWeight.SEMIBOLD,
    color: Theme.colors.textSecondary
  },
  bannerWrapper: {
    paddingTop: Spacing.GUTTER
  }
})
